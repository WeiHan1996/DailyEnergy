import { describe, expect, it } from "vitest";

import { buildDailyMemoryContextSnapshotV1 } from "./daily-context.js";
import type { SelectedDailyMatterV1 } from "./matter-selection.js";

const selected: SelectedDailyMatterV1 = {
  ownerRef: "owner-1",
  accountRevision: 2,
  safetyEpoch: "3",
  deletionEpoch: "4",
  masterRevision: 5,
  sourceSafetyPolicyVersion: "safety-v1",
  sourceSafetyRuleVersion: "rules-v1",
  sourceSafetyClassifierVersion: "classifier-v1",
  sourceSafetyFingerprintHex: "ab".repeat(32),
  temporalRelation: "TARGET_TODAY",
  sourceRef: "matter-1",
  sourceRevision: 6,
  grantRef: "grant-1",
  grantRevision: 7,
  validUntilProductDate: "2026-09-20",
  policyVersion: "memory-policy-v1",
};

describe("memory-context-snapshot-v1", () => {
  it("projects one title-free fact and keeps source bindings server-only", () => {
    const snapshot = buildDailyMemoryContextSnapshotV1({
      invocationRef: "invocation-1",
      productDate: "2026-09-20",
      selection: { status: "SELECTED", candidate: selected },
    });
    expect(snapshot.projection.memory_facts).toHaveLength(1);
    expect(snapshot.projection.provider_projection_bytes).toBeLessThanOrEqual(
      1024,
    );
    expect(snapshot.projection.segment_contracts[0]).toMatchObject({
      segment_path: "expression.state_response",
      memory_mention_allowed: true,
    });
    expect(JSON.stringify(snapshot.projection)).not.toMatch(
      /owner-1|matter-1|grant-1|sourceRevision/u,
    );
    expect(snapshot.dependency).toMatchObject({
      ownerRef: "owner-1",
      sourceRevision: 6,
      grantRevision: 7,
    });
  });

  it("returns a complete deterministic no-memory snapshot", () => {
    const first = buildDailyMemoryContextSnapshotV1({
      invocationRef: "invocation-1",
      productDate: "2026-09-20",
      selection: { status: "NO_ELIGIBLE_MEMORY" },
    });
    const second = buildDailyMemoryContextSnapshotV1({
      invocationRef: "invocation-1",
      productDate: "2026-09-20",
      selection: { status: "NO_ELIGIBLE_MEMORY" },
    });
    expect(first).toEqual(second);
    expect(first.projection.memory_facts).toEqual([]);
    expect(first.projection.segment_contracts).toEqual([]);
    expect(first).not.toHaveProperty("dependency");
  });

  it("changes the fingerprint when a live dependency revision changes", () => {
    const first = buildDailyMemoryContextSnapshotV1({
      invocationRef: "invocation-1",
      productDate: "2026-09-20",
      selection: { status: "SELECTED", candidate: selected },
    });
    const next = buildDailyMemoryContextSnapshotV1({
      invocationRef: "invocation-1",
      productDate: "2026-09-20",
      selection: {
        status: "SELECTED",
        candidate: { ...selected, grantRevision: 8 },
      },
    });
    expect(next.snapshotFingerprint).not.toBe(first.snapshotFingerprint);
  });
});
