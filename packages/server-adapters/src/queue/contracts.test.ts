import { describe, expect, it } from "vitest";

import {
  fingerprintCapabilityManifest,
  parseVersionedJobEnvelope,
  QueueContractError,
} from "./contracts.js";
import {
  BACKGROUND_WORKER_MANIFEST,
  INTERACTIVE_WORKER_MANIFEST,
  RESTRICTED_WORKER_MANIFEST,
  routeForEvent,
  WORKER_MANIFESTS,
} from "./manifests.js";

function envelope() {
  return {
    aggregateRef: "00000000-0000-4000-8000-000000000002",
    aggregateRevision: 2,
    contract: "dailyenergy.job",
    eventId: "00000000-0000-4000-8000-000000000001",
    eventType: "GenerationIntentAccepted",
    eventVersion: "v1",
    guardEpochs: { deletion: "0", safety: "3" },
    occurredAt: "2026-08-02T10:00:00.000+08:00",
    queueVersion: 1,
  } as const;
}

describe("versioned queue contract", () => {
  it("accepts only the minimal opaque envelope", () => {
    expect(parseVersionedJobEnvelope(envelope())).toEqual(envelope());
  });

  it.each(["note", "title", "prompt", "expression", "accountId"])(
    "rejects forbidden or unknown %s content",
    (field) => {
      expect(() =>
        parseVersionedJobEnvelope({
          ...envelope(),
          [field]: "synthetic forbidden content",
        }),
      ).toThrow(QueueContractError);
    },
  );

  it("bounds guard metadata and rejects malformed refs", () => {
    expect(() =>
      parseVersionedJobEnvelope({
        ...envelope(),
        guardEpochs: Object.fromEntries(
          Array.from({ length: 9 }, (_, index) => [`guard${index}`, "1"]),
        ),
      }),
    ).toThrow("QUEUE_CONTRACT_INVALID");
    expect(() =>
      parseVersionedJobEnvelope({ ...envelope(), eventId: "account-raw" }),
    ).toThrow("QUEUE_CONTRACT_INVALID");
  });
});

describe("worker capability manifests", () => {
  it("routes every handler to exactly one static profile", () => {
    const manifests = Object.values(WORKER_MANIFESTS);
    const keys = manifests.flatMap((manifest) =>
      manifest.handlers.map(
        (handler) => `${handler.eventType}@${handler.eventVersion}`,
      ),
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const manifest of manifests) {
      for (const handler of manifest.handlers) {
        expect(routeForEvent(handler.eventType, handler.eventVersion)).toEqual({
          capability: handler,
          queueFamily: manifest.queueFamily,
        });
      }
    }
    expect(routeForEvent("UnknownFutureEvent", "v2")).toBeUndefined();
  });

  it("keeps queue, role and egress fingerprints profile-specific", () => {
    const fingerprints = [
      INTERACTIVE_WORKER_MANIFEST,
      BACKGROUND_WORKER_MANIFEST,
      RESTRICTED_WORKER_MANIFEST,
    ].map((manifest) => fingerprintCapabilityManifest(manifest));
    expect(new Set(fingerprints).size).toBe(3);
    expect(fingerprints.every((value) => /^[a-f0-9]{64}$/u.test(value))).toBe(
      true,
    );
  });
});
