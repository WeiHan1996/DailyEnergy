import { describe, expect, it, vi } from "vitest";

import type { QueueProducerPort } from "./bullmq-runtime.js";
import type { VersionedJobEnvelope } from "./contracts.js";
import {
  BACKGROUND_WORKER_MANIFEST,
  INTERACTIVE_WORKER_MANIFEST,
} from "./manifests.js";
import {
  RedisLossRebuilder,
  type RedisRebuildStore,
} from "./redis-loss-rebuilder.js";

function envelope(eventId: string, eventType: string): VersionedJobEnvelope {
  return {
    aggregateRef: eventId,
    aggregateRevision: 1,
    contract: "dailyenergy.job",
    eventId,
    eventType,
    eventVersion: "v1",
    guardEpochs: {},
    occurredAt: "2026-08-02T02:00:00.000Z",
    queueVersion: 1,
  };
}

function setup() {
  const generation = envelope(
    "00000000-0000-4000-8000-000000000001",
    "GenerationIntentDue",
  );
  const notification = envelope(
    "00000000-0000-4000-8000-000000000002",
    "NotificationIntentDue",
  );
  const weekly = envelope(
    "00000000-0000-4000-8000-000000000006",
    "WeeklySummaryDue",
  );
  const published = envelope(
    "00000000-0000-4000-8000-000000000003",
    "DailyResultPublished",
  );
  const consumed = envelope("00000000-0000-4000-8000-000000000004", "DayLit");
  const unsupported = envelope(
    "00000000-0000-4000-8000-000000000005",
    "UnknownFutureEvent",
  );
  const store: RedisRebuildStore = {
    hasInboxReceipt: vi.fn(async (_consumerCode, eventId) =>
      Promise.resolve(eventId === consumed.eventId),
    ),
    listDataTasksDue: vi.fn(async () => []),
    listGenerationDue: vi.fn(async () => [generation]),
    listNotificationDue: vi.fn(async () => [notification]),
    listWeeklyDue: vi.fn(async () => [weekly]),
    listPublishedOutboxCandidates: vi.fn(async () => [
      published,
      consumed,
      unsupported,
    ]),
  };
  const enqueue = vi.fn(async () => undefined);
  return {
    consumed,
    enqueue,
    generation,
    notification,
    producer: { enqueue } satisfies QueueProducerPort,
    published,
    store,
    weekly,
  };
}

describe("Redis loss rebuilder", () => {
  it("rebuilds only the profile due rows", async () => {
    const state = setup();
    await expect(
      new RedisLossRebuilder({
        manifest: INTERACTIVE_WORKER_MANIFEST,
        producer: state.producer,
        store: state.store,
      }).rebuild(),
    ).resolves.toEqual({
      dueRows: 1,
      publishedOutbox: 0,
      skippedReceipts: 0,
      unsupported: 0,
    });
    expect(state.enqueue).toHaveBeenCalledWith("interactive", state.generation);
    expect(state.store.listPublishedOutboxCandidates).not.toHaveBeenCalled();
  });

  it("replays unconsumed published outbox and skips receipts/unknown routes", async () => {
    const state = setup();
    await expect(
      new RedisLossRebuilder({
        manifest: BACKGROUND_WORKER_MANIFEST,
        producer: state.producer,
        store: state.store,
      }).rebuild(50),
    ).resolves.toEqual({
      dueRows: 2,
      publishedOutbox: 1,
      skippedReceipts: 1,
      unsupported: 1,
    });
    expect(state.enqueue).toHaveBeenCalledWith(
      "background",
      state.notification,
    );
    expect(state.enqueue).toHaveBeenCalledWith("background", state.weekly);
    expect(state.enqueue).toHaveBeenCalledWith("background", state.published);
    expect(state.enqueue).not.toHaveBeenCalledWith(
      expect.anything(),
      state.consumed,
    );
  });

  it("rejects unbounded rebuild scans", async () => {
    const state = setup();
    await expect(
      new RedisLossRebuilder({
        manifest: BACKGROUND_WORKER_MANIFEST,
        producer: state.producer,
        store: state.store,
      }).rebuild(501),
    ).rejects.toThrow("REDIS_REBUILD_LIMIT_INVALID");
  });
});
