import type { DatabaseFactoryConfig } from "../db/internal/contracts.js";
import { BullMqConsumer, BullMqProducer } from "./bullmq-runtime.js";
import { parseQueueRuntimeConfig, type QueueRuntimeConfig } from "./config.js";
import type {
  QueueJobHandler,
  QueueTelemetrySink,
  WorkerCapabilityManifest,
} from "./contracts.js";
import { noopQueueTelemetrySink } from "./contracts.js";
import { OutboxRelay, type OutboxRelayResult } from "./outbox-relay.js";
import { PostgresQueueStore } from "./postgres-store.js";
import {
  RedisLossRebuilder,
  type RedisRebuildResult,
} from "./redis-loss-rebuilder.js";

export interface WorkerInfrastructureConfig {
  readonly database: DatabaseFactoryConfig;
  readonly queue: QueueRuntimeConfig;
}

export interface WorkerInfrastructureRuntime {
  readonly manifest: WorkerCapabilityManifest;
  drain(): Promise<void>;
  rebuild(limit?: number): Promise<RedisRebuildResult>;
  relayOnce(options?: {
    readonly batchSize?: number;
    readonly maxAttempts?: number;
  }): Promise<OutboxRelayResult>;
}

export async function startWorkerInfrastructure(options: {
  readonly config: WorkerInfrastructureConfig;
  readonly handlers?: readonly QueueJobHandler[];
  readonly manifest: WorkerCapabilityManifest;
  readonly telemetry?: QueueTelemetrySink;
}): Promise<WorkerInfrastructureRuntime> {
  const telemetry = options.telemetry ?? noopQueueTelemetrySink;
  const queueConfig = parseQueueRuntimeConfig(
    options.config.queue,
    options.manifest,
  );
  const store = await PostgresQueueStore.connect({
    applicationName: `daily-energy:${options.manifest.profile}:queue-store`,
    connectionString: options.config.database.connectionString,
    expectedDatabaseRole: options.manifest.databaseRole,
    profile: options.manifest.profile,
    ...(options.config.database.connectionLimit === undefined
      ? {}
      : { connectionLimit: options.config.database.connectionLimit }),
  });
  let producer: BullMqProducer | undefined;
  let consumer: BullMqConsumer | undefined;
  try {
    producer = await BullMqProducer.connect(
      queueConfig.redisUrl,
      queueConfig.keyPrefix,
      telemetry,
    );
    const handlers = options.handlers ?? [];
    if (handlers.length > 0) {
      consumer = await BullMqConsumer.connect(
        options.manifest,
        queueConfig,
        handlers,
        store,
        telemetry,
      );
    }
  } catch (error) {
    await consumer?.drain(queueConfig.drainTimeoutMs).catch(() => undefined);
    await producer?.close().catch(() => undefined);
    await store.close();
    throw error;
  }

  const relay = new OutboxRelay({ producer, store, telemetry });
  const rebuilder = new RedisLossRebuilder({
    manifest: options.manifest,
    producer,
    store,
    telemetry,
  });
  let closed = false;
  return Object.freeze({
    manifest: options.manifest,
    async drain(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      try {
        await consumer?.drain(queueConfig.drainTimeoutMs);
      } finally {
        try {
          await producer.close();
        } finally {
          await store.close();
        }
      }
    },
    rebuild(limit?: number) {
      if (closed) {
        throw new Error("WORKER_RUNTIME_CLOSED");
      }
      return rebuilder.rebuild(limit);
    },
    relayOnce(relayOptions?: {
      readonly batchSize?: number;
      readonly maxAttempts?: number;
    }) {
      if (closed) {
        throw new Error("WORKER_RUNTIME_CLOSED");
      }
      if (options.manifest.profile !== "worker-background") {
        throw new Error("OUTBOX_RELAY_PROFILE_REJECTED");
      }
      return relay.relayOnce(relayOptions);
    },
  });
}
