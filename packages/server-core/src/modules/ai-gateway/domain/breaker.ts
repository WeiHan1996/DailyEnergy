export type GatewayBreakerMode =
  "CLOSED" | "OPEN" | "HALF_OPEN" | "AUTH_BLOCKED" | "QUALITY_BLOCKED";

export type GatewayBreakerOutcomeClass =
  | "SUCCESS"
  | "INFRASTRUCTURE_FAILURE"
  | "AUTH_OR_CONFIG_FAILURE"
  | "QUALITY_FAILURE"
  | "NEUTRAL";

export interface GatewayBreakerSnapshotV1 {
  readonly consecutiveInfrastructureFailures: number;
  readonly halfOpenInFlight: number;
  readonly halfOpenSuccesses: number;
  readonly infrastructureWindow: readonly boolean[];
  readonly mode: GatewayBreakerMode;
  readonly openCount: number;
  readonly openUntilMs: number | null;
  readonly qualityWindow: readonly boolean[];
  readonly revision: number;
  readonly routeFingerprint: string;
  readonly version: "gateway-breaker-v1";
}

export type GatewayBreakerClaimDecisionV1 =
  | {
      readonly allowed: false;
      readonly next: GatewayBreakerSnapshotV1;
      readonly reasonCode: "CIRCUIT_OPEN";
    }
  | {
      readonly allowed: true;
      readonly next: GatewayBreakerSnapshotV1;
      readonly probe: boolean;
    };

const COOLDOWNS_MS = [60_000, 120_000, 240_000, 480_000, 900_000] as const;
const SNAPSHOT_KEYS = [
  "consecutiveInfrastructureFailures",
  "halfOpenInFlight",
  "halfOpenSuccesses",
  "infrastructureWindow",
  "mode",
  "openCount",
  "openUntilMs",
  "qualityWindow",
  "revision",
  "routeFingerprint",
  "version",
] as const;

export function initialGatewayBreakerSnapshotV1(
  routeFingerprint: string,
): GatewayBreakerSnapshotV1 {
  assertFingerprint(routeFingerprint);
  return freeze({
    consecutiveInfrastructureFailures: 0,
    halfOpenInFlight: 0,
    halfOpenSuccesses: 0,
    infrastructureWindow: [],
    mode: "CLOSED",
    openCount: 0,
    openUntilMs: null,
    qualityWindow: [],
    revision: 0,
    routeFingerprint,
    version: "gateway-breaker-v1",
  });
}

export function decideGatewayBreakerClaimV1(input: {
  readonly nowMs: number;
  readonly routeFingerprint: string;
  readonly snapshot: GatewayBreakerSnapshotV1 | null;
}): GatewayBreakerClaimDecisionV1 {
  assertNowMs(input.nowMs);
  let snapshot = parseGatewayBreakerSnapshotV1(
    input.snapshot ?? initialGatewayBreakerSnapshotV1(input.routeFingerprint),
  );
  if (snapshot.routeFingerprint !== input.routeFingerprint) {
    snapshot = initialGatewayBreakerSnapshotV1(input.routeFingerprint);
  }
  if (snapshot.mode === "AUTH_BLOCKED" || snapshot.mode === "QUALITY_BLOCKED") {
    return { allowed: false, next: snapshot, reasonCode: "CIRCUIT_OPEN" };
  }
  if (snapshot.mode === "OPEN") {
    if (snapshot.openUntilMs === null || input.nowMs < snapshot.openUntilMs) {
      return { allowed: false, next: snapshot, reasonCode: "CIRCUIT_OPEN" };
    }
    snapshot = freeze({
      ...snapshot,
      halfOpenInFlight: 0,
      halfOpenSuccesses: 0,
      mode: "HALF_OPEN",
      revision: snapshot.revision + 1,
    });
  }
  if (snapshot.mode === "HALF_OPEN") {
    if (snapshot.halfOpenInFlight >= 2) {
      return { allowed: false, next: snapshot, reasonCode: "CIRCUIT_OPEN" };
    }
    return {
      allowed: true,
      next: freeze({
        ...snapshot,
        halfOpenInFlight: snapshot.halfOpenInFlight + 1,
        revision: snapshot.revision + 1,
      }),
      probe: true,
    };
  }
  return { allowed: true, next: snapshot, probe: false };
}

export function recordGatewayBreakerOutcomeV1(input: {
  readonly nowMs: number;
  readonly outcome: GatewayBreakerOutcomeClass;
  readonly snapshot: GatewayBreakerSnapshotV1;
}): GatewayBreakerSnapshotV1 {
  assertNowMs(input.nowMs);
  if (
    ![
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
      "AUTH_OR_CONFIG_FAILURE",
      "QUALITY_FAILURE",
      "NEUTRAL",
    ].includes(input.outcome)
  ) {
    throw new Error("GATEWAY_BREAKER_OUTCOME_INVALID");
  }
  const current = parseGatewayBreakerSnapshotV1(input.snapshot);
  if (input.outcome === "NEUTRAL") {
    if (current.mode !== "HALF_OPEN") {
      return current;
    }
    return freeze({
      ...current,
      halfOpenInFlight: Math.max(0, current.halfOpenInFlight - 1),
      revision: current.revision + 1,
    });
  }
  if (input.outcome === "AUTH_OR_CONFIG_FAILURE") {
    return freeze({
      ...current,
      halfOpenInFlight: 0,
      halfOpenSuccesses: 0,
      mode: "AUTH_BLOCKED",
      openUntilMs: null,
      revision: current.revision + 1,
    });
  }
  const infrastructureWindow =
    input.outcome === "INFRASTRUCTURE_FAILURE" || input.outcome === "SUCCESS"
      ? appendWindow(
          current.infrastructureWindow,
          input.outcome === "INFRASTRUCTURE_FAILURE",
        )
      : current.infrastructureWindow;
  const qualityWindow =
    input.outcome === "QUALITY_FAILURE" || input.outcome === "SUCCESS"
      ? appendWindow(current.qualityWindow, input.outcome === "QUALITY_FAILURE")
      : current.qualityWindow;
  if (
    (input.outcome === "QUALITY_FAILURE" || input.outcome === "SUCCESS") &&
    qualityTrips(qualityWindow)
  ) {
    return freeze({
      ...current,
      halfOpenInFlight: 0,
      halfOpenSuccesses: 0,
      infrastructureWindow,
      mode: "QUALITY_BLOCKED",
      openUntilMs: null,
      qualityWindow,
      revision: current.revision + 1,
    });
  }
  const consecutive =
    input.outcome === "INFRASTRUCTURE_FAILURE"
      ? current.consecutiveInfrastructureFailures + 1
      : input.outcome === "SUCCESS"
        ? 0
        : current.consecutiveInfrastructureFailures;
  if (
    (input.outcome === "INFRASTRUCTURE_FAILURE" &&
      current.mode === "HALF_OPEN") ||
    consecutive >= 5 ||
    infrastructureTrips(infrastructureWindow)
  ) {
    const openCount = current.openCount + 1;
    return freeze({
      ...current,
      consecutiveInfrastructureFailures: consecutive,
      halfOpenInFlight: 0,
      halfOpenSuccesses: 0,
      infrastructureWindow,
      mode: "OPEN",
      openCount,
      openUntilMs: input.nowMs + COOLDOWNS_MS[Math.min(openCount - 1, 4)]!,
      qualityWindow,
      revision: current.revision + 1,
    });
  }
  if (input.outcome === "SUCCESS" && current.mode === "HALF_OPEN") {
    const successes = current.halfOpenSuccesses + 1;
    if (successes >= 2) {
      return freeze({
        ...initialGatewayBreakerSnapshotV1(current.routeFingerprint),
        revision: current.revision + 1,
      });
    }
    return freeze({
      ...current,
      consecutiveInfrastructureFailures: 0,
      halfOpenInFlight: Math.max(0, current.halfOpenInFlight - 1),
      halfOpenSuccesses: successes,
      infrastructureWindow,
      qualityWindow,
      revision: current.revision + 1,
    });
  }
  if (input.outcome === "QUALITY_FAILURE" && current.mode === "HALF_OPEN") {
    return freeze({
      ...current,
      halfOpenInFlight: Math.max(0, current.halfOpenInFlight - 1),
      infrastructureWindow,
      qualityWindow,
      revision: current.revision + 1,
    });
  }
  return freeze({
    ...current,
    consecutiveInfrastructureFailures: consecutive,
    infrastructureWindow,
    qualityWindow,
    revision: current.revision + 1,
  });
}

export function parseGatewayBreakerSnapshotV1(
  value: unknown,
): GatewayBreakerSnapshotV1 {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== SNAPSHOT_KEYS.length ||
    SNAPSHOT_KEYS.some((key) => !(key in value)) ||
    value.version !== "gateway-breaker-v1" ||
    typeof value.mode !== "string" ||
    ![
      "CLOSED",
      "OPEN",
      "HALF_OPEN",
      "AUTH_BLOCKED",
      "QUALITY_BLOCKED",
    ].includes(value.mode) ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) < 0 ||
    !Number.isInteger(value.openCount) ||
    Number(value.openCount) < 0 ||
    !Number.isInteger(value.consecutiveInfrastructureFailures) ||
    Number(value.consecutiveInfrastructureFailures) < 0 ||
    !Number.isInteger(value.halfOpenInFlight) ||
    Number(value.halfOpenInFlight) < 0 ||
    Number(value.halfOpenInFlight) > 2 ||
    !Number.isInteger(value.halfOpenSuccesses) ||
    Number(value.halfOpenSuccesses) < 0 ||
    Number(value.halfOpenSuccesses) > 1 ||
    (value.openUntilMs !== null &&
      (!Number.isSafeInteger(value.openUntilMs) ||
        Number(value.openUntilMs) < 0)) ||
    !Array.isArray(value.infrastructureWindow) ||
    !Array.isArray(value.qualityWindow) ||
    value.infrastructureWindow.length > 20 ||
    value.qualityWindow.length > 20 ||
    value.infrastructureWindow.some((item) => typeof item !== "boolean") ||
    value.qualityWindow.some((item) => typeof item !== "boolean")
  ) {
    throw new Error("GATEWAY_BREAKER_SNAPSHOT_INVALID");
  }
  if (
    ((value.mode === "CLOSED" ||
      value.mode === "AUTH_BLOCKED" ||
      value.mode === "QUALITY_BLOCKED") &&
      (value.openUntilMs !== null ||
        value.halfOpenInFlight !== 0 ||
        value.halfOpenSuccesses !== 0)) ||
    (value.mode === "CLOSED" && value.openCount !== 0) ||
    (value.mode === "OPEN" &&
      (value.openUntilMs === null ||
        value.openCount === 0 ||
        value.halfOpenInFlight !== 0 ||
        value.halfOpenSuccesses !== 0)) ||
    (value.mode === "HALF_OPEN" &&
      (value.openUntilMs === null || value.openCount === 0))
  ) {
    throw new Error("GATEWAY_BREAKER_SNAPSHOT_INVALID");
  }
  if (typeof value.routeFingerprint !== "string") {
    throw new Error("GATEWAY_BREAKER_SNAPSHOT_INVALID");
  }
  assertFingerprint(value.routeFingerprint);
  return freeze(structuredClone(value) as unknown as GatewayBreakerSnapshotV1);
}

function infrastructureTrips(window: readonly boolean[]): boolean {
  return (
    window.length >= 10 && window.filter(Boolean).length / window.length >= 0.5
  );
}

function qualityTrips(window: readonly boolean[]): boolean {
  return (
    window.length >= 10 && window.filter(Boolean).length / window.length >= 0.3
  );
}

function appendWindow(
  window: readonly boolean[],
  failure: boolean,
): readonly boolean[] {
  return Object.freeze([...window, failure].slice(-20));
}

function assertFingerprint(value: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error("GATEWAY_BREAKER_FINGERPRINT_INVALID");
  }
}

function assertNowMs(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("GATEWAY_BREAKER_TIME_INVALID");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
