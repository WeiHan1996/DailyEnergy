import { describe, expect, it, vi } from "vitest";

import type { QueueProducerPort } from "./bullmq-runtime.js";
import type { QueueTelemetryEvent, VersionedJobEnvelope } from "./contracts.js";
import { QueueRetryableError } from "./contracts.js";
import { INTERACTIVE_WORKER_MANIFEST } from "./manifests.js";
import {
  OutboxRelay,
  OutboxRelayCrashError,
  type OutboxRelayStore,
} from "./outbox-relay.js";
import type { ClaimedOutboxEvent } from "./postgres-store.js";

function envelope(
  eventType = "GenerationIntentAccepted",
): VersionedJobEnvelope {
  return {
    aggregateRef: "00000000-0000-4000-8000-000000000002",
    aggregateRevision: 1,
    contract: "dailyenergy.job",
    eventId: "00000000-0000-4000-8000-000000000001",
    eventType,
    eventVersion: "v1",
    guardEpochs: {},
    occurredAt: "2026-08-02T02:00:00.000Z",
    queueVersion: 1,
  };
}

function setup(events: readonly ClaimedOutboxEvent[]) {
  const markPublished = vi.fn(async () => undefined);
  const markRetryable = vi.fn(async () => undefined);
  const release = vi.fn(async () => undefined);
  const claimOutboxBatch = vi.fn(async () => ({
    events,
    markPublished,
    markRetryable,
    release,
  }));
  const enqueue = vi.fn(async () => undefined);
  const telemetry: QueueTelemetryEvent[] = [];
  return {
    enqueue,
    markPublished,
    markRetryable,
    producer: { enqueue } satisfies QueueProducerPort,
    release,
    store: { claimOutboxBatch } satisfies OutboxRelayStore,
    telemetry,
    telemetrySink: {
      record: (event: QueueTelemetryEvent) => telemetry.push(event),
    },
  };
}

describe("outbox relay", () => {
  it("releases the claim and leaves the event replayable after enqueue crash", async () => {
    const event = { attemptCount: 1, envelope: envelope() };
    const state = setup([event]);
    const relay = new OutboxRelay({
      faultHooks: {
        afterEnqueueBeforePublished: async () => {
          throw new OutboxRelayCrashError();
        },
      },
      producer: state.producer,
      store: state.store,
      telemetry: state.telemetrySink,
    });

    await expect(relay.relayOnce()).rejects.toThrow(
      "OUTBOX_RELAY_CRASH_INJECTED",
    );
    expect(state.enqueue).toHaveBeenCalledWith(
      INTERACTIVE_WORKER_MANIFEST.queueFamily,
      event.envelope,
    );
    expect(state.markPublished).not.toHaveBeenCalled();
    expect(state.markRetryable).not.toHaveBeenCalled();
    expect(state.release).toHaveBeenCalledOnce();
  });

  it("uses bounded retry and then records a terminal outcome", async () => {
    const retryable = setup([{ attemptCount: 2, envelope: envelope() }]);
    retryable.enqueue.mockRejectedValueOnce(
      new QueueRetryableError("QUEUE_ENQUEUE_FAILED"),
    );
    await expect(
      new OutboxRelay({
        producer: retryable.producer,
        store: retryable.store,
        telemetry: retryable.telemetrySink,
      }).relayOnce({ maxAttempts: 5 }),
    ).resolves.toEqual({
      failed: 0,
      published: 0,
      retryable: 1,
      unsupported: 0,
    });
    expect(retryable.markRetryable).toHaveBeenCalledWith(envelope().eventId, {
      delayMs: 2_000,
      terminal: false,
    });
    expect(retryable.telemetry).toContainEqual({
      operationCode: "OUTBOX_RELAY",
      outcomeCode: "RETRYABLE",
      profile: "worker-background",
      queueFamily: "interactive",
      reasonCode: "QUEUE_ENQUEUE_FAILED",
    });

    const terminal = setup([{ attemptCount: 5, envelope: envelope() }]);
    terminal.enqueue.mockRejectedValueOnce(new Error("synthetic failure"));
    await new OutboxRelay({
      producer: terminal.producer,
      store: terminal.store,
      telemetry: terminal.telemetrySink,
    }).relayOnce({ maxAttempts: 5 });
    expect(terminal.markRetryable).toHaveBeenCalledWith(envelope().eventId, {
      delayMs: 16_000,
      terminal: true,
    });
    expect(JSON.stringify(terminal.telemetry)).not.toContain(
      envelope().eventId,
    );
    expect(JSON.stringify(terminal.telemetry)).not.toContain(
      envelope().aggregateRef,
    );
  });

  it("terminally rejects unsupported events and invalid relay bounds", async () => {
    const state = setup([
      { attemptCount: 1, envelope: envelope("UnknownFutureEvent") },
    ]);
    await expect(
      new OutboxRelay({
        producer: state.producer,
        store: state.store,
      }).relayOnce(),
    ).resolves.toEqual({
      failed: 1,
      published: 0,
      retryable: 0,
      unsupported: 1,
    });
    expect(state.enqueue).not.toHaveBeenCalled();
    expect(state.markRetryable).toHaveBeenCalledWith(envelope().eventId, {
      delayMs: 0,
      terminal: true,
    });

    await expect(
      new OutboxRelay({
        producer: state.producer,
        store: state.store,
      }).relayOnce({ batchSize: 501 }),
    ).rejects.toThrow("OUTBOX_RELAY_OPTIONS_INVALID");
  });
});
