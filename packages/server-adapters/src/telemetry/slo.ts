import { z } from "zod";

export const SLO_IDS = [
  "S33-SLO-01",
  "S33-SLO-02",
  "S33-SLO-03",
  "S33-SLO-04",
  "S33-SLO-05",
  "S33-SLO-06",
  "S33-SLO-07",
] as const;

export const SloEventSchema = z.strictObject({
  available: z.boolean(),
  elapsedSeconds: z.number().nonnegative().nullable(),
  expectedReject: z.boolean(),
  generationMode: z
    .enum(["PRIMARY_AI", "BACKUP_AI", "CONTROLLED_TEMPLATE", "NO_RESULT"])
    .optional(),
  operationGroup: z.enum(["CORE_API", "CORE_READ", "CORE_WRITE", "GENERATION"]),
  outcome: z.enum([
    "SUCCESS",
    "EXPECTED_REJECT",
    "SERVICE_FAILURE",
    "USER_CANCEL",
    "GUARD_CANCEL",
    "EXISTING_RESULT",
    "UNKNOWN",
  ]),
});

export type SloEvent = z.infer<typeof SloEventSchema>;

export interface SloClassification {
  readonly availability: "GOOD" | "BAD" | "EXCLUDED" | "UNKNOWN";
  readonly latency: "GOOD" | "BAD" | "EXCLUDED" | "UNKNOWN";
}

export function classifySloEvent(event: SloEvent): SloClassification {
  const value = SloEventSchema.parse(event);
  if (
    value.outcome === "USER_CANCEL" ||
    value.outcome === "GUARD_CANCEL" ||
    value.outcome === "EXISTING_RESULT"
  ) {
    return Object.freeze({ availability: "EXCLUDED", latency: "EXCLUDED" });
  }
  if (value.outcome === "UNKNOWN") {
    return Object.freeze({ availability: "UNKNOWN", latency: "UNKNOWN" });
  }
  if (value.expectedReject) {
    return Object.freeze({ availability: "GOOD", latency: "EXCLUDED" });
  }
  const availability =
    value.outcome === "SUCCESS" && value.available ? "GOOD" : "BAD";
  if (availability !== "GOOD") {
    return Object.freeze({ availability, latency: "EXCLUDED" });
  }
  if (value.elapsedSeconds === null) {
    return Object.freeze({ availability, latency: "UNKNOWN" });
  }
  const target =
    value.operationGroup === "CORE_READ"
      ? 0.5
      : value.operationGroup === "CORE_WRITE"
        ? 0.75
        : value.operationGroup === "GENERATION"
          ? 10
          : Number.POSITIVE_INFINITY;
  return Object.freeze({
    availability,
    latency: value.elapsedSeconds <= target ? "GOOD" : "BAD",
  });
}

export interface BurnWindow {
  readonly bad: number;
  readonly total: number;
}

export type BurnAlert =
  "PAGE_14_4" | "PAGE_6" | "TICKET_3" | "TICKET_1" | "NONE";

function burnRate(window: BurnWindow, target: number): number | null {
  if (
    !Number.isInteger(window.bad) ||
    !Number.isInteger(window.total) ||
    window.bad < 0 ||
    window.total < 0 ||
    window.bad > window.total ||
    target <= 0 ||
    target >= 1
  ) {
    throw new Error("SLO_BURN_INPUT_INVALID");
  }
  return window.total === 0 ? null : window.bad / window.total / (1 - target);
}

export function evaluateBurn(input: {
  readonly absoluteFailures: number;
  readonly long: BurnWindow;
  readonly minimumRequests: number;
  readonly short: BurnWindow;
  readonly syntheticFailed: boolean;
  readonly target: number;
  readonly threshold: 14.4 | 6 | 3 | 1;
}): BurnAlert {
  const longBurn = burnRate(input.long, input.target);
  const shortBurn = burnRate(input.short, input.target);
  if (
    longBurn === null ||
    shortBurn === null ||
    longBurn < input.threshold ||
    shortBurn < input.threshold
  ) {
    return "NONE";
  }
  if (
    input.short.total < input.minimumRequests &&
    !input.syntheticFailed &&
    input.absoluteFailures < 5
  ) {
    return "NONE";
  }
  switch (input.threshold) {
    case 14.4:
      return "PAGE_14_4";
    case 6:
      return "PAGE_6";
    case 3:
      return "TICKET_3";
    case 1:
      return "TICKET_1";
  }
}

export function errorBudgetState(input: {
  readonly allowedBad: number;
  readonly consumedBad: number;
  readonly telemetryCompleteness: number;
}): "HEALTHY" | "APPROVAL_REQUIRED" | "FROZEN" | "EXHAUSTED" | "BLOCKED" {
  if (
    !Number.isFinite(input.allowedBad) ||
    !Number.isFinite(input.consumedBad) ||
    input.allowedBad <= 0 ||
    input.consumedBad < 0 ||
    input.telemetryCompleteness < 0 ||
    input.telemetryCompleteness > 1
  ) {
    throw new Error("SLO_BUDGET_INPUT_INVALID");
  }
  if (input.telemetryCompleteness < 0.99) {
    return "BLOCKED";
  }
  const remaining = 1 - input.consumedBad / input.allowedBad;
  if (remaining <= 0) {
    return "EXHAUSTED";
  }
  if (remaining < 0.25) {
    return "FROZEN";
  }
  if (remaining < 0.5) {
    return "APPROVAL_REQUIRED";
  }
  return "HEALTHY";
}

export function errorBudgetReleaseDecision(input: {
  readonly approved: boolean;
  readonly changeClass:
    | "ORDINARY_FEATURE"
    | "RELIABILITY_FIX"
    | "ROLLBACK"
    | "SAFETY_PRIVACY"
    | "RECOVERY"
    | "COMPLIANCE";
  readonly state:
    "HEALTHY" | "APPROVAL_REQUIRED" | "FROZEN" | "EXHAUSTED" | "BLOCKED";
}): "ALLOW" | "REQUIRE_APPROVAL" | "DENY" {
  if (input.state === "HEALTHY") {
    return "ALLOW";
  }
  if (input.state === "APPROVAL_REQUIRED") {
    return input.approved ? "ALLOW" : "REQUIRE_APPROVAL";
  }
  const exception = new Set([
    "RELIABILITY_FIX",
    "ROLLBACK",
    "SAFETY_PRIVACY",
    "RECOVERY",
    "COMPLIANCE",
  ]).has(input.changeClass);
  return exception ? "ALLOW" : "DENY";
}
