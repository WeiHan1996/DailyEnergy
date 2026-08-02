import {
  Queue,
  UnrecoverableError,
  Worker,
  type JobsOptions,
  type Job,
} from "bullmq";
import { Redis } from "ioredis";

import type { QueueRuntimeConfig } from "./config.js";
import type {
  QueueFamily,
  QueueJobHandler,
  QueueTelemetrySink,
  VersionedJobEnvelope,
  WorkerCapabilityManifest,
} from "./contracts.js";
import {
  handlerKey,
  noopQueueTelemetrySink,
  parseVersionedJobEnvelope,
  QueueContractError,
  QueueRetryableError,
  QueueTerminalError,
} from "./contracts.js";
import { WORKER_MANIFESTS } from "./manifests.js";
import type { PostgresQueueStore } from "./postgres-store.js";

export const DEFAULT_JOB_OPTIONS: Readonly<JobsOptions> = Object.freeze({
  attempts: 5,
  backoff: Object.freeze({ delay: 1_000, type: "exponential" }),
  removeOnComplete: Object.freeze({ age: 3_600, count: 1_000 }),
  removeOnFail: Object.freeze({ age: 86_400, count: 1_000 }),
});

interface RedisConnectionDefinition {
  readonly maxRetriesPerRequest: number | null;
  readonly name: string;
}

function createRedisConnection(
  redisUrl: string,
  definition: RedisConnectionDefinition,
): Redis {
  return new Redis(redisUrl, {
    connectionName: definition.name,
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: definition.maxRetriesPerRequest,
    retryStrategy(attempt) {
      return Math.min(attempt * 100, 1_000);
    },
  });
}

async function connectRedis8(connection: Redis): Promise<void> {
  try {
    await connection.connect();
    const info = await connection.info("server");
    const version = /^redis_version:([^\r\n]+)/mu.exec(info)?.[1];
    if (!version || Number.parseInt(version, 10) !== 8) {
      throw new Error("REDIS_VERSION_MISMATCH");
    }
  } catch (error) {
    connection.disconnect(false);
    if (error instanceof Error && error.message === "REDIS_VERSION_MISMATCH") {
      throw error;
    }
    throw new Error("REDIS_CONNECTION_FAILED", { cause: error });
  }
}

function queueNameForFamily(family: QueueFamily): string {
  const manifest = Object.values(WORKER_MANIFESTS).find(
    (candidate) => candidate.queueFamily === family,
  );
  if (!manifest) {
    throw new Error("QUEUE_FAMILY_UNKNOWN");
  }
  return manifest.queueName;
}

export interface QueueProducerPort {
  enqueue(
    queueFamily: QueueFamily,
    envelope: VersionedJobEnvelope,
    options?: QueueEnqueueOptions,
  ): Promise<void>;
}

export interface QueueEnqueueOptions {
  readonly attempts?: number;
  readonly backoffDelayMs?: number;
  readonly delayMs?: number;
}

export interface QueueConsumerFaultHooks {
  afterInboxCommitBeforeAck?(eventId: string): Promise<void>;
}

export class BullMqProducer implements QueueProducerPort {
  readonly #connection: Redis;
  readonly #keyPrefix: string;
  readonly #queues = new Map<QueueFamily, Queue<VersionedJobEnvelope>>();
  readonly #telemetry: QueueTelemetrySink;
  #closed = false;

  private constructor(
    connection: Redis,
    keyPrefix: string,
    telemetry: QueueTelemetrySink,
  ) {
    this.#connection = connection;
    this.#keyPrefix = keyPrefix;
    this.#telemetry = telemetry;
  }

  static async connect(
    redisUrl: string,
    keyPrefix: string,
    telemetry: QueueTelemetrySink = noopQueueTelemetrySink,
  ): Promise<BullMqProducer> {
    const connection = createRedisConnection(redisUrl, {
      maxRetriesPerRequest: 1,
      name: "daily-energy:queue-producer",
    });
    await connectRedis8(connection);
    return new BullMqProducer(connection, keyPrefix, telemetry);
  }

  async enqueue(
    queueFamily: QueueFamily,
    envelope: VersionedJobEnvelope,
    options: QueueEnqueueOptions = {},
  ): Promise<void> {
    if (this.#closed) {
      throw new Error("QUEUE_PRODUCER_CLOSED");
    }
    const parsed = parseVersionedJobEnvelope(envelope);
    const jobOptions = boundedJobOptions(options);
    const queue = this.#queue(queueFamily);
    try {
      await queue.add(
        handlerKey(parsed.eventType, parsed.eventVersion),
        parsed,
        {
          ...jobOptions,
          jobId: parsed.eventId,
        },
      );
      this.#telemetry.record({
        operationCode: "QUEUE_ENQUEUE",
        outcomeCode: "SUCCESS",
        profile: WORKER_MANIFESTS[`worker-${queueFamily}`].profile,
        queueFamily,
      });
    } catch {
      this.#telemetry.record({
        operationCode: "QUEUE_ENQUEUE",
        outcomeCode: "RETRYABLE",
        profile: WORKER_MANIFESTS[`worker-${queueFamily}`].profile,
        queueFamily,
        reasonCode: "QUEUE_ENQUEUE_FAILED",
      });
      throw new QueueRetryableError("QUEUE_ENQUEUE_FAILED");
    }
  }

  async getJobCounts(
    queueFamily: QueueFamily,
  ): Promise<Record<string, number>> {
    return this.#queue(queueFamily).getJobCounts(
      "active",
      "completed",
      "delayed",
      "failed",
      "paused",
      "prioritized",
      "waiting",
      "waiting-children",
    );
  }

  async getJob(
    queueFamily: QueueFamily,
    jobId: string,
  ): Promise<Job<VersionedJobEnvelope> | undefined> {
    return (await this.#queue(queueFamily).getJob(jobId)) ?? undefined;
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await Promise.all([...this.#queues.values()].map((queue) => queue.close()));
    await this.#connection.quit();
  }

  #queue(queueFamily: QueueFamily): Queue<VersionedJobEnvelope> {
    const current = this.#queues.get(queueFamily);
    if (current) {
      return current;
    }
    const queue = new Queue<VersionedJobEnvelope>(
      queueNameForFamily(queueFamily),
      {
        connection: this.#connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
        prefix: this.#keyPrefix,
      },
    );
    this.#queues.set(queueFamily, queue);
    return queue;
  }
}

export class BullMqConsumer {
  readonly #connection: Redis;
  readonly #manifest: WorkerCapabilityManifest;
  readonly #telemetry: QueueTelemetrySink;
  readonly #worker: Worker<VersionedJobEnvelope>;
  #closed = false;

  private constructor(
    connection: Redis,
    manifest: WorkerCapabilityManifest,
    telemetry: QueueTelemetrySink,
    worker: Worker<VersionedJobEnvelope>,
  ) {
    this.#connection = connection;
    this.#manifest = manifest;
    this.#telemetry = telemetry;
    this.#worker = worker;
  }

  static async connect(
    manifest: WorkerCapabilityManifest,
    config: QueueRuntimeConfig,
    handlers: readonly QueueJobHandler[],
    store: PostgresQueueStore,
    telemetry: QueueTelemetrySink = noopQueueTelemetrySink,
    faultHooks: QueueConsumerFaultHooks = {},
  ): Promise<BullMqConsumer> {
    const registeredHandlers = new Map<string, QueueJobHandler>();
    const allowedHandlers = new Map(
      manifest.handlers.map((candidate) => [
        handlerKey(candidate.eventType, candidate.eventVersion),
        candidate,
      ]),
    );
    for (const handler of handlers) {
      const key = handlerKey(handler.eventType, handler.eventVersion);
      if (!allowedHandlers.has(key) || registeredHandlers.has(key)) {
        throw new Error("QUEUE_HANDLER_CAPABILITY_MISMATCH");
      }
      registeredHandlers.set(key, handler);
    }

    const connection = createRedisConnection(config.redisUrl, {
      maxRetriesPerRequest: null,
      name: `daily-energy:${manifest.profile}`,
    });
    await connectRedis8(connection);

    const worker = new Worker<VersionedJobEnvelope>(
      manifest.queueName,
      async (job) => {
        let envelope: VersionedJobEnvelope;
        try {
          envelope = parseVersionedJobEnvelope(job.data);
        } catch (error) {
          telemetry.record({
            operationCode: "QUEUE_HANDLE",
            outcomeCode: "TERMINAL",
            profile: manifest.profile,
            queueFamily: manifest.queueFamily,
            reasonCode: "QUEUE_CONTRACT_INVALID",
            retryOrdinal: job.attemptsMade + 1,
          });
          throw new UnrecoverableError(
            error instanceof QueueContractError
              ? error.code
              : "QUEUE_CONTRACT_INVALID",
          );
        }

        const key = handlerKey(envelope.eventType, envelope.eventVersion);
        const capability = allowedHandlers.get(key);
        if (job.name !== key || !capability) {
          telemetry.record({
            operationCode: "QUEUE_HANDLE",
            outcomeCode: "EXPECTED_REJECT",
            profile: manifest.profile,
            queueFamily: manifest.queueFamily,
            reasonCode: "QUEUE_PROFILE_REJECTED",
            retryOrdinal: job.attemptsMade + 1,
          });
          throw new UnrecoverableError("QUEUE_PROFILE_REJECTED");
        }
        const handler = registeredHandlers.get(key);
        if (!handler) {
          telemetry.record({
            operationCode: "QUEUE_HANDLE",
            outcomeCode: "TERMINAL",
            profile: manifest.profile,
            queueFamily: manifest.queueFamily,
            reasonCode: "QUEUE_HANDLER_NOT_REGISTERED",
            retryOrdinal: job.attemptsMade + 1,
          });
          throw new UnrecoverableError("QUEUE_HANDLER_NOT_REGISTERED");
        }

        try {
          const result = await store.consumeInbox(
            capability.consumerCode,
            envelope,
            (transaction) => handler.handle(envelope, transaction),
          );
          try {
            await faultHooks.afterInboxCommitBeforeAck?.(envelope.eventId);
          } catch {
            throw new QueueRetryableError("QUEUE_ACK_CRASH_WINDOW");
          }
          if (result.terminal) {
            telemetry.record({
              operationCode: "QUEUE_HANDLE",
              outcomeCode: "TERMINAL",
              profile: manifest.profile,
              queueFamily: manifest.queueFamily,
              reasonCode: result.outcomeCode,
              retryOrdinal: job.attemptsMade + 1,
            });
            throw new UnrecoverableError(result.outcomeCode);
          }
          telemetry.record({
            operationCode: "QUEUE_HANDLE",
            outcomeCode: result.duplicate ? "DUPLICATE" : "SUCCESS",
            profile: manifest.profile,
            queueFamily: manifest.queueFamily,
            retryOrdinal: job.attemptsMade + 1,
          });
        } catch (error) {
          if (error instanceof UnrecoverableError) {
            throw error;
          }
          if (error instanceof QueueTerminalError) {
            telemetry.record({
              operationCode: "QUEUE_HANDLE",
              outcomeCode: "TERMINAL",
              profile: manifest.profile,
              queueFamily: manifest.queueFamily,
              reasonCode: error.code,
              retryOrdinal: job.attemptsMade + 1,
            });
            throw new UnrecoverableError(error.code);
          }
          const code =
            error instanceof QueueRetryableError
              ? error.code
              : "QUEUE_HANDLER_RETRYABLE";
          telemetry.record({
            operationCode: "QUEUE_HANDLE",
            outcomeCode: "RETRYABLE",
            profile: manifest.profile,
            queueFamily: manifest.queueFamily,
            reasonCode: code,
            retryOrdinal: job.attemptsMade + 1,
          });
          throw new Error(code, { cause: error });
        }
      },
      {
        connection,
        concurrency: config.concurrency,
        prefix: config.keyPrefix,
      },
    );
    try {
      await worker.waitUntilReady();
    } catch {
      await worker.close(true).catch(() => undefined);
      connection.disconnect(false);
      throw new Error("QUEUE_CONSUMER_START_FAILED");
    }
    return new BullMqConsumer(connection, manifest, telemetry, worker);
  }

  async drain(timeoutMs: number): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#worker.pause(true);

    let timeout: NodeJS.Timeout | undefined;
    const graceful = this.#worker.close(false);
    const timedOut = new Promise<"timeout">((resolve) => {
      timeout = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const result = await Promise.race([
      graceful.then(() => "closed" as const),
      timedOut,
    ]);
    if (timeout) {
      clearTimeout(timeout);
    }
    if (result === "timeout") {
      await this.#worker.close(true);
      this.#telemetry.record({
        operationCode: "QUEUE_DRAIN",
        outcomeCode: "TERMINAL",
        profile: this.#manifest.profile,
        queueFamily: this.#manifest.queueFamily,
        reasonCode: "QUEUE_DRAIN_TIMEOUT",
      });
    } else {
      this.#telemetry.record({
        operationCode: "QUEUE_DRAIN",
        outcomeCode: "SUCCESS",
        profile: this.#manifest.profile,
        queueFamily: this.#manifest.queueFamily,
      });
    }
    if (this.#connection.status !== "end") {
      await this.#connection.quit();
    }
  }
}

function boundedJobOptions(options: QueueEnqueueOptions): JobsOptions {
  const attempts = options.attempts ?? DEFAULT_JOB_OPTIONS.attempts;
  const backoffDelayMs =
    options.backoffDelayMs ??
    (typeof DEFAULT_JOB_OPTIONS.backoff === "object"
      ? DEFAULT_JOB_OPTIONS.backoff.delay
      : undefined);
  const delayMs = options.delayMs ?? 0;
  if (
    !Number.isInteger(attempts) ||
    attempts === undefined ||
    attempts < 1 ||
    attempts > 5 ||
    !Number.isInteger(backoffDelayMs) ||
    backoffDelayMs === undefined ||
    backoffDelayMs < 10 ||
    backoffDelayMs > 60_000 ||
    !Number.isInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 86_400_000
  ) {
    throw new QueueContractError("QUEUE_RETRY_POLICY_INVALID");
  }
  return {
    ...DEFAULT_JOB_OPTIONS,
    attempts,
    backoff: { delay: backoffDelayMs, type: "exponential" },
    delay: delayMs,
  };
}
