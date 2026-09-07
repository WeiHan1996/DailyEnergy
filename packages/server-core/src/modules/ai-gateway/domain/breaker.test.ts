import { describe, expect, it } from "vitest";

import {
  decideGatewayBreakerClaimV1,
  initialGatewayBreakerSnapshotV1,
  parseGatewayBreakerSnapshotV1,
  recordGatewayBreakerOutcomeV1,
} from "./breaker.js";

const ROUTE_A = "a".repeat(64);
const ROUTE_B = "b".repeat(64);

describe("AI-002 gateway breaker policy", () => {
  it("opens after five consecutive infrastructure failures with bounded cooldown", () => {
    let state = initialGatewayBreakerSnapshotV1(ROUTE_A);
    for (let index = 0; index < 5; index += 1) {
      state = recordGatewayBreakerOutcomeV1({
        nowMs: 1_000,
        outcome: "INFRASTRUCTURE_FAILURE",
        snapshot: state,
      });
    }
    expect(state).toMatchObject({
      mode: "OPEN",
      openCount: 1,
      openUntilMs: 61_000,
    });
    expect(
      decideGatewayBreakerClaimV1({
        nowMs: 60_999,
        routeFingerprint: ROUTE_A,
        snapshot: state,
      }).allowed,
    ).toBe(false);
  });

  it("reopens a failed half-open probe with escalating bounded cooldowns", () => {
    let state = initialGatewayBreakerSnapshotV1(ROUTE_A);
    for (let index = 0; index < 5; index += 1) {
      state = recordGatewayBreakerOutcomeV1({
        nowMs: 0,
        outcome: "INFRASTRUCTURE_FAILURE",
        snapshot: state,
      });
    }
    const expectedCooldowns = [120_000, 240_000, 480_000, 900_000, 900_000];
    for (const expectedCooldown of expectedCooldowns) {
      const probeAt = state.openUntilMs!;
      const claim = decideGatewayBreakerClaimV1({
        nowMs: probeAt,
        routeFingerprint: ROUTE_A,
        snapshot: state,
      });
      expect(claim.allowed).toBe(true);
      state = recordGatewayBreakerOutcomeV1({
        nowMs: probeAt,
        outcome: "INFRASTRUCTURE_FAILURE",
        snapshot: claim.next,
      });
      expect(state.openUntilMs).toBe(probeAt + expectedCooldown);
    }
  });

  it("opens at ten samples and fifty percent infrastructure failures", () => {
    let state = initialGatewayBreakerSnapshotV1(ROUTE_A);
    for (let index = 0; index < 10; index += 1) {
      state = recordGatewayBreakerOutcomeV1({
        nowMs: index,
        outcome: index % 2 === 0 ? "INFRASTRUCTURE_FAILURE" : "SUCCESS",
        snapshot: state,
      });
    }
    expect(state.mode).toBe("OPEN");
  });

  it("uses a bounded rolling window and evaluates the threshold after success", () => {
    let state = initialGatewayBreakerSnapshotV1(ROUTE_A);
    const firstNineteen = [
      "SUCCESS",
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
      "SUCCESS",
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
      "INFRASTRUCTURE_FAILURE",
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
      "SUCCESS",
      "INFRASTRUCTURE_FAILURE",
    ] as const;
    for (const [index, outcome] of firstNineteen.entries()) {
      state = recordGatewayBreakerOutcomeV1({
        nowMs: index,
        outcome,
        snapshot: state,
      });
      expect(state.mode).toBe("CLOSED");
    }
    state = recordGatewayBreakerOutcomeV1({
      nowMs: 20,
      outcome: "INFRASTRUCTURE_FAILURE",
      snapshot: state,
    });
    expect(state).toMatchObject({
      infrastructureWindow: expect.arrayContaining([true, false]),
      mode: "OPEN",
    });
    expect(state.infrastructureWindow).toHaveLength(20);
  });

  it("allows at most two half-open probes and closes after two successes", () => {
    let state = initialGatewayBreakerSnapshotV1(ROUTE_A);
    for (let index = 0; index < 5; index += 1) {
      state = recordGatewayBreakerOutcomeV1({
        nowMs: 0,
        outcome: "INFRASTRUCTURE_FAILURE",
        snapshot: state,
      });
    }
    const first = decideGatewayBreakerClaimV1({
      nowMs: 60_000,
      routeFingerprint: ROUTE_A,
      snapshot: state,
    });
    expect(first.allowed).toBe(true);
    state = first.next;
    const second = decideGatewayBreakerClaimV1({
      nowMs: 60_000,
      routeFingerprint: ROUTE_A,
      snapshot: state,
    });
    expect(second.allowed).toBe(true);
    state = second.next;
    expect(
      decideGatewayBreakerClaimV1({
        nowMs: 60_000,
        routeFingerprint: ROUTE_A,
        snapshot: state,
      }).allowed,
    ).toBe(false);
    state = recordGatewayBreakerOutcomeV1({
      nowMs: 60_001,
      outcome: "SUCCESS",
      snapshot: state,
    });
    state = recordGatewayBreakerOutcomeV1({
      nowMs: 60_002,
      outcome: "SUCCESS",
      snapshot: state,
    });
    expect(state).toMatchObject({ mode: "CLOSED", openCount: 0 });
  });

  it("keeps auth and quality blocks until the route fingerprint changes", () => {
    const auth = recordGatewayBreakerOutcomeV1({
      nowMs: 0,
      outcome: "AUTH_OR_CONFIG_FAILURE",
      snapshot: initialGatewayBreakerSnapshotV1(ROUTE_A),
    });
    expect(auth.mode).toBe("AUTH_BLOCKED");
    expect(
      decideGatewayBreakerClaimV1({
        nowMs: 999_999,
        routeFingerprint: ROUTE_A,
        snapshot: auth,
      }).allowed,
    ).toBe(false);
    expect(
      decideGatewayBreakerClaimV1({
        nowMs: 999_999,
        routeFingerprint: ROUTE_B,
        snapshot: auth,
      }),
    ).toMatchObject({ allowed: true, next: { mode: "CLOSED" } });

    let quality = initialGatewayBreakerSnapshotV1(ROUTE_A);
    for (let index = 0; index < 10; index += 1) {
      quality = recordGatewayBreakerOutcomeV1({
        nowMs: index,
        outcome: index < 3 ? "QUALITY_FAILURE" : "SUCCESS",
        snapshot: quality,
      });
    }
    expect(quality.mode).toBe("QUALITY_BLOCKED");
  });

  it("keeps quality and neutral outcomes out of the infrastructure denominator", () => {
    let state = initialGatewayBreakerSnapshotV1(ROUTE_A);
    state = recordGatewayBreakerOutcomeV1({
      nowMs: 0,
      outcome: "INFRASTRUCTURE_FAILURE",
      snapshot: state,
    });
    const before = state.infrastructureWindow;
    state = recordGatewayBreakerOutcomeV1({
      nowMs: 100,
      outcome: "QUALITY_FAILURE",
      snapshot: state,
    });
    state = recordGatewayBreakerOutcomeV1({
      nowMs: 101,
      outcome: "NEUTRAL",
      snapshot: state,
    });
    expect(state.infrastructureWindow).toEqual(before);
    expect(state.consecutiveInfrastructureFailures).toBe(1);
    expect(state.qualityWindow).toEqual([true]);
  });

  it("rejects malformed or internally inconsistent persisted snapshots", () => {
    const valid = initialGatewayBreakerSnapshotV1(ROUTE_A);
    expect(() =>
      parseGatewayBreakerSnapshotV1({ ...valid, unexpected: true }),
    ).toThrowError("GATEWAY_BREAKER_SNAPSHOT_INVALID");
    expect(() =>
      parseGatewayBreakerSnapshotV1({
        ...valid,
        halfOpenInFlight: 1,
      }),
    ).toThrowError("GATEWAY_BREAKER_SNAPSHOT_INVALID");
    expect(() =>
      decideGatewayBreakerClaimV1({
        nowMs: Number.NaN,
        routeFingerprint: ROUTE_A,
        snapshot: valid,
      }),
    ).toThrowError("GATEWAY_BREAKER_TIME_INVALID");
  });
});
