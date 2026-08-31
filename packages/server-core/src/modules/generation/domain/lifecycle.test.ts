import { describe, expect, it } from "vitest";

import {
  decideGenerationClaimV1,
  decideGenerationPublishV1,
  sameGenerationGuardV1,
  type GenerationGuardSnapshotV1,
} from "./lifecycle.js";

const allowed: GenerationGuardSnapshotV1 = Object.freeze({
  accountRevision: 1,
  deletionEpoch: 0n,
  deletionRevision: 0,
  safetyEpoch: 0n,
  safetyRevision: 0,
  status: "ALLOWED",
});

describe("C-008 generation lifecycle and PublishGuard", () => {
  it("claims only an exact eligible queued/retryable revision", () => {
    expect(
      decideGenerationClaimV1({
        currentRevision: 1,
        envelopeRevision: 1,
        guardMatches: true,
        guardStatus: "ALLOWED",
        state: "QUEUED",
      }),
    ).toEqual({ nextRevision: 2, outcome: "CLAIM" });
    expect(
      decideGenerationClaimV1({
        currentRevision: 2,
        envelopeRevision: 1,
        guardMatches: true,
        guardStatus: "ALLOWED",
        state: "RUNNING",
      }),
    ).toEqual({ outcome: "RESUME" });
    expect(
      decideGenerationClaimV1({
        currentRevision: 2,
        envelopeRevision: 1,
        guardMatches: true,
        guardStatus: "ALLOWED",
        state: "RETRYABLE_FAILED",
      }),
    ).toEqual({
      outcome: "STALE",
      reasonCode: "GENERATION_EVENT_REVISION_STALE",
    });
  });

  it("gives live guards priority over existing, stale, and late work", () => {
    expect(
      decideGenerationClaimV1({
        currentRevision: 1,
        envelopeRevision: 1,
        guardMatches: false,
        guardStatus: "ALLOWED",
        state: "SUCCEEDED",
      }),
    ).toEqual({ outcome: "BLOCKED", reasonCode: "GENERATION_GUARD_STALE" });

    const safety = {
      ...allowed,
      safetyEpoch: 1n,
      status: "SAFETY_BLOCKED" as const,
    };
    expect(
      decideGenerationPublishV1({
        completionEligible: true,
        currentGuard: safety,
        currentRevision: 2,
        expectedGuard: allowed,
        expectedRevision: 2,
        hasPublishedResult: true,
        state: "SUCCEEDED",
      }),
    ).toEqual({ outcome: "BLOCKED", reasonCode: "SAFETY_BLOCKED" });
    expect(sameGenerationGuardV1(allowed, { ...allowed })).toBe(true);
    expect(
      sameGenerationGuardV1(allowed, { ...allowed, deletionEpoch: 1n }),
    ).toBe(false);
  });

  it("publishes once, returns the winner, and cancels a closed window", () => {
    expect(
      decideGenerationPublishV1({
        completionEligible: true,
        currentGuard: allowed,
        currentRevision: 2,
        expectedGuard: allowed,
        expectedRevision: 2,
        hasPublishedResult: false,
        state: "RUNNING",
      }),
    ).toEqual({ outcome: "PUBLISH" });
    expect(
      decideGenerationPublishV1({
        completionEligible: true,
        currentGuard: allowed,
        currentRevision: 3,
        expectedGuard: allowed,
        expectedRevision: 2,
        hasPublishedResult: true,
        state: "SUCCEEDED",
      }),
    ).toEqual({ outcome: "RETURN_EXISTING" });
    expect(
      decideGenerationPublishV1({
        completionEligible: false,
        currentGuard: allowed,
        currentRevision: 2,
        expectedGuard: allowed,
        expectedRevision: 2,
        hasPublishedResult: false,
        state: "RUNNING",
      }),
    ).toEqual({
      outcome: "CANCELLED",
      reasonCode: "GENERATION_WINDOW_CLOSED",
    });
  });
});
