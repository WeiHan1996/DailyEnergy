import type { GenerationIntentStatus } from "@daily-energy/shared-schemas";

export interface GenerationGuardSnapshotV1 {
  readonly accountRevision: number;
  readonly deletionEpoch: bigint;
  readonly deletionRevision: number;
  readonly safetyEpoch: bigint;
  readonly safetyRevision: number;
  readonly status:
    | "ALLOWED"
    | "ACCOUNT_DELETED"
    | "ACCOUNT_DELETING"
    | "ACCOUNT_RESTRICTED"
    | "CONSENT_REQUIRED"
    | "ONBOARDING_REQUIRED"
    | "SAFETY_BLOCKED"
    | "STATE_PRECONDITION_FAILED";
}

export type GenerationClaimDecision =
  | { readonly outcome: "CLAIM"; readonly nextRevision: number }
  | { readonly outcome: "RESUME" | "RETURN_EXISTING" }
  | {
      readonly outcome: "BLOCKED" | "CANCELLED" | "TERMINAL" | "STALE";
      readonly reasonCode: string;
    };

export function decideGenerationClaimV1(input: {
  readonly currentRevision: number;
  readonly envelopeRevision: number;
  readonly guardMatches: boolean;
  readonly guardStatus: GenerationGuardSnapshotV1["status"];
  readonly state: GenerationIntentStatus;
}): GenerationClaimDecision {
  if (input.guardStatus !== "ALLOWED" || !input.guardMatches) {
    return Object.freeze({
      outcome: "BLOCKED",
      reasonCode:
        input.guardStatus === "ALLOWED"
          ? "GENERATION_GUARD_STALE"
          : input.guardStatus,
    });
  }
  if (input.state === "SUCCEEDED") {
    return Object.freeze({ outcome: "RETURN_EXISTING" });
  }
  if (input.state === "CANCELLED") {
    return Object.freeze({
      outcome: "CANCELLED",
      reasonCode: "GENERATION_CANCELLED",
    });
  }
  if (input.state === "TERMINAL_FAILED") {
    return Object.freeze({
      outcome: "TERMINAL",
      reasonCode: "GENERATION_FAILED_TERMINAL",
    });
  }
  if (input.state === "RUNNING" || input.state === "FALLBACK_RUNNING") {
    return Object.freeze({ outcome: "RESUME" });
  }
  if (input.currentRevision !== input.envelopeRevision) {
    return Object.freeze({
      outcome: "STALE",
      reasonCode: "GENERATION_EVENT_REVISION_STALE",
    });
  }
  return Object.freeze({
    nextRevision: input.currentRevision + 1,
    outcome: "CLAIM",
  });
}

export type GenerationPublishDecision =
  | { readonly outcome: "PUBLISH" }
  | { readonly outcome: "RETURN_EXISTING" }
  | {
      readonly outcome: "BLOCKED" | "CANCELLED" | "RETRYABLE" | "TERMINAL";
      readonly reasonCode: string;
    };

export function decideGenerationPublishV1(input: {
  readonly completionEligible: boolean;
  readonly currentGuard: GenerationGuardSnapshotV1;
  readonly currentRevision: number;
  readonly expectedGuard: GenerationGuardSnapshotV1;
  readonly expectedRevision: number;
  readonly hasPublishedResult: boolean;
  readonly state: GenerationIntentStatus;
}): GenerationPublishDecision {
  if (
    input.currentGuard.status !== "ALLOWED" ||
    !sameGenerationGuardV1(input.currentGuard, input.expectedGuard)
  ) {
    return Object.freeze({
      outcome: "BLOCKED",
      reasonCode:
        input.currentGuard.status === "ALLOWED"
          ? "GENERATION_GUARD_STALE"
          : input.currentGuard.status,
    });
  }
  if (input.hasPublishedResult || input.state === "SUCCEEDED") {
    return Object.freeze({ outcome: "RETURN_EXISTING" });
  }
  if (input.state === "CANCELLED") {
    return Object.freeze({
      outcome: "CANCELLED",
      reasonCode: "GENERATION_CANCELLED",
    });
  }
  if (input.state === "TERMINAL_FAILED") {
    return Object.freeze({
      outcome: "TERMINAL",
      reasonCode: "GENERATION_FAILED_TERMINAL",
    });
  }
  if (!input.completionEligible) {
    return Object.freeze({
      outcome: "CANCELLED",
      reasonCode: "GENERATION_WINDOW_CLOSED",
    });
  }
  if (input.currentRevision !== input.expectedRevision) {
    return Object.freeze({
      outcome: "RETRYABLE",
      reasonCode: "GENERATION_INTENT_REVISION_CHANGED",
    });
  }
  if (input.state !== "RUNNING" && input.state !== "FALLBACK_RUNNING") {
    return Object.freeze({
      outcome: "RETRYABLE",
      reasonCode: "GENERATION_NOT_CLAIMED",
    });
  }
  return Object.freeze({ outcome: "PUBLISH" });
}

export function sameGenerationGuardV1(
  left: GenerationGuardSnapshotV1,
  right: GenerationGuardSnapshotV1,
): boolean {
  return (
    left.status === right.status &&
    left.accountRevision === right.accountRevision &&
    left.safetyRevision === right.safetyRevision &&
    left.safetyEpoch === right.safetyEpoch &&
    left.deletionRevision === right.deletionRevision &&
    left.deletionEpoch === right.deletionEpoch
  );
}
