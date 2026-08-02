import type {
  QueueFamily,
  QueueTelemetrySink,
  WorkerCapabilityManifest,
  WorkerProfile,
} from "./contracts.js";
import { noopQueueTelemetrySink, QueueRetryableError } from "./contracts.js";
import type { QueueProducerPort } from "./bullmq-runtime.js";
import type { OutboxClaimBatch } from "./postgres-store.js";
import { routeForEvent, WORKER_MANIFESTS } from "./manifests.js";

export interface OutboxRelayFaultHooks {
  afterEnqueueBeforePublished?(eventId: string): Promise<void>;
}

export interface OutboxRelayStore {
  claimOutboxBatch(
    batchSize: number,
    maxAttempts: number,
  ): Promise<OutboxClaimBatch>;
}

export interface OutboxRelayResult {
  readonly failed: number;
  readonly published: number;
  readonly retryable: number;
  readonly unsupported: number;
}

export class OutboxRelayCrashError extends Error {
  constructor() {
    super("OUTBOX_RELAY_CRASH_INJECTED");
    this.name = "OutboxRelayCrashError";
  }
}

export class OutboxRelay {
  readonly #faultHooks: OutboxRelayFaultHooks;
  readonly #manifests: Readonly<
    Record<WorkerProfile, WorkerCapabilityManifest>
  >;
  readonly #producer: QueueProducerPort;
  readonly #store: OutboxRelayStore;
  readonly #telemetry: QueueTelemetrySink;

  constructor(options: {
    readonly faultHooks?: OutboxRelayFaultHooks;
    readonly manifests?: Readonly<
      Record<WorkerProfile, WorkerCapabilityManifest>
    >;
    readonly producer: QueueProducerPort;
    readonly store: OutboxRelayStore;
    readonly telemetry?: QueueTelemetrySink;
  }) {
    this.#faultHooks = options.faultHooks ?? {};
    this.#manifests = options.manifests ?? WORKER_MANIFESTS;
    this.#producer = options.producer;
    this.#store = options.store;
    this.#telemetry = options.telemetry ?? noopQueueTelemetrySink;
  }

  async relayOnce(options?: {
    readonly batchSize?: number;
    readonly maxAttempts?: number;
  }): Promise<OutboxRelayResult> {
    const batchSize = options?.batchSize ?? 50;
    const maxAttempts = options?.maxAttempts ?? 5;
    if (
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > 500 ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1 ||
      maxAttempts > 20
    ) {
      throw new Error("OUTBOX_RELAY_OPTIONS_INVALID");
    }
    const batch = await this.#store.claimOutboxBatch(batchSize, maxAttempts);
    let failed = 0;
    let published = 0;
    let retryable = 0;
    let unsupported = 0;
    try {
      for (const event of batch.events) {
        const route = routeForEvent(
          event.envelope.eventType,
          event.envelope.eventVersion,
          this.#manifests,
        );
        if (!route) {
          unsupported += 1;
          failed += 1;
          await batch.markRetryable(event.envelope.eventId, {
            delayMs: 0,
            terminal: true,
          });
          this.#record("background", "TERMINAL", "OUTBOX_ROUTE_UNSUPPORTED");
          continue;
        }
        try {
          await this.#producer.enqueue(route.queueFamily, event.envelope);
          await this.#faultHooks.afterEnqueueBeforePublished?.(
            event.envelope.eventId,
          );
          await batch.markPublished(event.envelope.eventId);
          published += 1;
          this.#record(route.queueFamily, "SUCCESS");
        } catch (error) {
          if (error instanceof OutboxRelayCrashError) {
            throw error;
          }
          const terminal = event.attemptCount >= maxAttempts;
          await batch.markRetryable(event.envelope.eventId, {
            delayMs: retryDelayMs(event.attemptCount),
            terminal,
          });
          if (terminal) {
            failed += 1;
            this.#record(
              route.queueFamily,
              "TERMINAL",
              "OUTBOX_RELAY_EXHAUSTED",
            );
          } else {
            retryable += 1;
            this.#record(
              route.queueFamily,
              "RETRYABLE",
              error instanceof QueueRetryableError
                ? error.code
                : "OUTBOX_RELAY_RETRYABLE",
            );
          }
        }
      }
    } finally {
      await batch.release();
    }
    return Object.freeze({ failed, published, retryable, unsupported });
  }

  #record(
    queueFamily: QueueFamily,
    outcomeCode: "SUCCESS" | "RETRYABLE" | "TERMINAL",
    reasonCode?: string,
  ): void {
    this.#telemetry.record({
      operationCode: "OUTBOX_RELAY",
      outcomeCode,
      profile: "worker-background",
      queueFamily,
      ...(reasonCode ? { reasonCode } : {}),
    });
  }
}

function retryDelayMs(attempt: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 60_000);
}
