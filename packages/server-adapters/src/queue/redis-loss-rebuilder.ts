import type { QueueProducerPort } from "./bullmq-runtime.js";
import type {
  QueueTelemetrySink,
  VersionedJobEnvelope,
  WorkerCapabilityManifest,
  WorkerProfile,
} from "./contracts.js";
import { noopQueueTelemetrySink } from "./contracts.js";
import { routeForEvent, WORKER_MANIFESTS } from "./manifests.js";

export interface RedisRebuildStore {
  hasInboxReceipt(consumerCode: string, eventId: string): Promise<boolean>;
  listDataTasksDue(limit: number): Promise<readonly VersionedJobEnvelope[]>;
  listGenerationDue(limit: number): Promise<readonly VersionedJobEnvelope[]>;
  listNotificationDue(limit: number): Promise<readonly VersionedJobEnvelope[]>;
  listWeeklyDue(limit: number): Promise<readonly VersionedJobEnvelope[]>;
  listPublishedOutboxCandidates(
    limit: number,
  ): Promise<readonly VersionedJobEnvelope[]>;
}

export interface RedisRebuildResult {
  readonly dueRows: number;
  readonly publishedOutbox: number;
  readonly skippedReceipts: number;
  readonly unsupported: number;
}

export class RedisLossRebuilder {
  readonly #manifest: WorkerCapabilityManifest;
  readonly #manifests: Readonly<
    Record<WorkerProfile, WorkerCapabilityManifest>
  >;
  readonly #producer: QueueProducerPort;
  readonly #store: RedisRebuildStore;
  readonly #telemetry: QueueTelemetrySink;

  constructor(options: {
    readonly manifest: WorkerCapabilityManifest;
    readonly manifests?: Readonly<
      Record<WorkerProfile, WorkerCapabilityManifest>
    >;
    readonly producer: QueueProducerPort;
    readonly store: RedisRebuildStore;
    readonly telemetry?: QueueTelemetrySink;
  }) {
    this.#manifest = options.manifest;
    this.#manifests = options.manifests ?? WORKER_MANIFESTS;
    this.#producer = options.producer;
    this.#store = options.store;
    this.#telemetry = options.telemetry ?? noopQueueTelemetrySink;
  }

  async rebuild(limit = 100): Promise<RedisRebuildResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error("REDIS_REBUILD_LIMIT_INVALID");
    }
    let dueRows = 0;
    let publishedOutbox = 0;
    let skippedReceipts = 0;
    let unsupported = 0;

    const due = await this.#listDue(limit);
    for (const envelope of due) {
      await this.#producer.enqueue(this.#manifest.queueFamily, envelope);
      dueRows += 1;
    }

    if (this.#manifest.profile === "worker-background") {
      const published = await this.#store.listPublishedOutboxCandidates(limit);
      for (const envelope of published) {
        const route = routeForEvent(
          envelope.eventType,
          envelope.eventVersion,
          this.#manifests,
        );
        if (!route) {
          unsupported += 1;
          continue;
        }
        if (
          await this.#store.hasInboxReceipt(
            route.capability.consumerCode,
            envelope.eventId,
          )
        ) {
          skippedReceipts += 1;
          continue;
        }
        await this.#producer.enqueue(route.queueFamily, envelope);
        publishedOutbox += 1;
      }
    }

    this.#telemetry.record({
      operationCode: "REDIS_REBUILD",
      outcomeCode: "SUCCESS",
      profile: this.#manifest.profile,
      queueFamily: this.#manifest.queueFamily,
    });
    return Object.freeze({
      dueRows,
      publishedOutbox,
      skippedReceipts,
      unsupported,
    });
  }

  #listDue(limit: number): Promise<readonly VersionedJobEnvelope[]> {
    switch (this.#manifest.profile) {
      case "worker-interactive":
        return this.#store.listGenerationDue(limit);
      case "worker-background":
        return Promise.all([
          this.#store.listNotificationDue(limit),
          this.#store.listWeeklyDue(limit),
        ]).then(([notifications, weekly]) =>
          [...notifications, ...weekly].slice(0, limit),
        );
      case "worker-restricted":
        return this.#store.listDataTasksDue(limit);
    }
  }
}
