import { describe, expect, it, vi } from "vitest";

import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  createGatewayRouteManifestV1,
  fingerprintGatewayJson,
  type GatewayAdmissionV1,
  type GatewayCandidateV1,
  type GatewayInvocationV1,
  type GatewayOutcomeV1,
  type GatewayProviderRouteV1,
} from "../domain/contracts.js";
import {
  initialGatewayBreakerSnapshotV1,
  recordGatewayBreakerOutcomeV1,
} from "../domain/breaker.js";
import type {
  ExpressionGatewayV1,
  GatewayBreakerStateStoreV1,
  GatewayLiveGuardV1,
  GatewayRoutingTelemetrySinkV1,
} from "../spi/index.js";
import { GatewayRouteOrchestratorV1 } from "./route-gateway.js";

const candidate = {
  attemptId: "attempt",
  generationMode: "BACKUP_AI",
  payload: { message: "synthetic" },
  payloadFingerprint: "a".repeat(64),
  validationReceipt: { validatorVersion: "validator-v1", verdict: "PASS" },
  workload: "DAILY_EXPRESSION_V1",
} as const satisfies GatewayCandidateV1;

const route = (role: "PRIMARY_AI" | "BACKUP_AI", suffix: string) =>
  ({
    adapterId: `adapter-${suffix}`,
    adapterVersion: "adapter-v1",
    capabilityProfileId: "strict-json-v1",
    connectDeadlineMs: 500,
    dataHandlingProfileId: "synthetic-no-retention-v1",
    egressTarget: `ai.daily.${suffix}`,
    endpointId: `endpoint-${suffix}`,
    endpointRegion: "local",
    immutableModelRevision: `model-${suffix}-v1`,
    maxOutputTokens: 1_200,
    modelId: `model-${suffix}`,
    priceEntryId: `price-${suffix}-v1`,
    providerAccountRef: `account-${suffix}`,
    providerId: `provider-${suffix}`,
    providerParameterSetId: "parameters-v1",
    requestDeadlineMs: role === "PRIMARY_AI" ? 4_000 : 3_000,
    role,
  }) satisfies GatewayProviderRouteV1;
const manifest = createGatewayRouteManifestV1({
  backup: route("BACKUP_AI", "backup"),
  compatibleOutputSchemaVersions: ["1.0.0"],
  compatiblePromptVersions: ["daily-expression-zh-cn-v1"],
  compatibleSafetyPolicyVersions: ["safety-policy-v1"],
  gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
  inputLimits: {
    preparedModelInputBytes: 16 * 1_024,
    providerResponseBytes: 12 * 1_024,
  },
  invocationCostLimitMicrounits: 10_000,
  manifestVersion: "route-v1",
  outputLimits: { maxOutputTokens: 1_200 },
  priceCatalogVersion: "price-v1",
  primary: route("PRIMARY_AI", "primary"),
  status: "ACTIVE",
  template: {
    localeCatalogVersion: "zh-cn-v1",
    maxExecutionMs: 100,
    minimumReserveMs: 1_000,
    rendererId: "controlled-daily-template",
    rendererVersion: "renderer-v1",
    templateCompatibilityVersion: "daily-template-v1",
  },
  workload: "DAILY_EXPRESSION_V1",
});
const invocation = {
  acceptedAt: "2026-09-07T02:00:00.000Z",
  gatewayContractVersion: GATEWAY_CONTRACT_VERSION,
  gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
  hardDeadlineAt: "2026-09-07T02:00:08.000Z",
  invocationId: "00000000-0000-4000-8000-000000000201",
  outputSchemaVersion: "1.0.0",
  ownerIntentRef: "00000000-0000-4000-8000-000000000202",
  personalizationLevel: "FULL",
  planContractVersion: "controlled-expression-plan-v1",
  planFingerprint: "1".repeat(64),
  planRef: "synthetic-plan-v1",
  preparedModelInput: { contract: "prepared-daily-prompt-input-v1" },
  promptVersion: "daily-expression-zh-cn-v1",
  routeManifestFingerprint: manifest.fingerprint,
  routeManifestVersion: manifest.manifestVersion,
  safetyPolicyVersion: "safety-policy-v1",
  templateVersion: "daily-template-v1",
  workload: "DAILY_EXPRESSION_V1",
} satisfies GatewayInvocationV1;
const allowed: GatewayAdmissionV1 = { status: "ALLOWED" };

class MemoryBreaker implements GatewayBreakerStateStoreV1 {
  readonly values = new Map();
  async load(key: string) {
    return this.values.get(key) ?? null;
  }
  async compareAndSet(
    input: Parameters<GatewayBreakerStateStoreV1["compareAndSet"]>[0],
  ) {
    const current = this.values.get(input.key);
    if (
      (current?.revision ?? null) !== input.expectedRevision ||
      (current?.routeFingerprint ?? null) !== input.expectedRouteFingerprint
    ) {
      return false;
    }
    this.values.set(input.key, input.next);
    return true;
  }
}

function setup(input: {
  readonly outcomes: readonly GatewayOutcomeV1[];
  readonly breaker?: GatewayBreakerStateStoreV1;
  readonly guard?: GatewayLiveGuardV1;
  readonly guards?: readonly Awaited<ReturnType<GatewayLiveGuardV1["read"]>>[];
  readonly telemetry?: GatewayRoutingTelemetrySinkV1;
}) {
  const outcomes = [...input.outcomes];
  const calls: Parameters<ExpressionGatewayV1["invoke"]>[0][] = [];
  const roles: string[] = [];
  const gateway: ExpressionGatewayV1 = {
    async invoke(value) {
      calls.push(value);
      roles.push(value.role);
      return outcomes.shift()!;
    },
  };
  const guards = [...(input.guards ?? [{ status: "ALLOWED" as const }])];
  const guard: GatewayLiveGuardV1 = input.guard ?? {
    async read() {
      return guards.shift() ?? { status: "ALLOWED" };
    },
  };
  const events: Parameters<GatewayRoutingTelemetrySinkV1["record"]>[0][] = [];
  const telemetry: GatewayRoutingTelemetrySinkV1 = input.telemetry ?? {
    record: (event) => events.push(event),
  };
  return {
    calls,
    events,
    roles,
    value: new GatewayRouteOrchestratorV1({
      breaker: input.breaker ?? new MemoryBreaker(),
      clock: { now: () => new Date("2026-09-07T02:00:00Z") },
      gateway,
      guard,
      telemetry,
    }),
  };
}

describe("AI-002 sequential Gateway routing", () => {
  it("G12-F01 moves from primary timeout to one backup candidate without racing or changing input", async () => {
    const context = setup({
      outcomes: [
        {
          failedRole: "PRIMARY_AI",
          reasonCode: "PROVIDER_RESPONSE_TIMEOUT",
          status: "FALLBACK_REQUIRED",
        },
        { candidate, status: "CANDIDATE_READY" },
      ],
    });
    await expect(
      context.value.invoke({
        admission: allowed,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({ candidate, status: "CANDIDATE_READY" });
    expect(context.roles).toEqual(["PRIMARY_AI", "BACKUP_AI"]);
    expect(
      context.calls.map(({ invocation: value }) => ({
        planFingerprint: value.planFingerprint,
        preparedModelInput: value.preparedModelInput,
        routeManifestFingerprint: value.routeManifestFingerprint,
      })),
    ).toEqual([
      {
        planFingerprint: invocation.planFingerprint,
        preparedModelInput: invocation.preparedModelInput,
        routeManifestFingerprint: invocation.routeManifestFingerprint,
      },
      {
        planFingerprint: invocation.planFingerprint,
        preparedModelInput: invocation.preparedModelInput,
        routeManifestFingerprint: invocation.routeManifestFingerprint,
      },
    ]);
  });

  it.each([
    "PROVIDER_CONNECT_TIMEOUT",
    "PROVIDER_NETWORK_ERROR",
    "PROVIDER_RATE_LIMITED",
    "PROVIDER_PROTOCOL_INVALID",
    "PROVIDER_UNAVAILABLE",
    "OUTPUT_SCHEMA_INVALID",
    "OUTCOME_UNKNOWN",
  ])("routes stable failure %s to one backup attempt", async (reasonCode) => {
    const context = setup({
      outcomes: [
        {
          failedRole: "PRIMARY_AI",
          reasonCode,
          status: "FALLBACK_REQUIRED",
        },
        { candidate, status: "CANDIDATE_READY" },
      ],
    });
    await expect(
      context.value.invoke({
        admission: allowed,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({ candidate, status: "CANDIDATE_READY" });
    expect(context.roles).toEqual(["PRIMARY_AI", "BACKUP_AI"]);
  });

  it("returns a template decision after both provider roles fail", async () => {
    const context = setup({
      outcomes: [
        {
          failedRole: "PRIMARY_AI",
          reasonCode: "PROVIDER_RATE_LIMITED",
          status: "FALLBACK_REQUIRED",
        },
        {
          failedRole: "BACKUP_AI",
          reasonCode: "OUTCOME_UNKNOWN",
          status: "FALLBACK_REQUIRED",
        },
      ],
    });
    await expect(
      context.value.invoke({
        admission: allowed,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "PROVIDER_PATHS_EXHAUSTED",
      status: "CONTROLLED_TEMPLATE_REQUIRED",
    });
    expect(context.roles).toEqual(["PRIMARY_AI", "BACKUP_AI"]);
  });

  it("fails closed to template when breaker state is unreadable", async () => {
    const context = setup({
      breaker: {
        compareAndSet: vi.fn(),
        load: async () => {
          throw new Error("synthetic redis loss");
        },
      },
      outcomes: [],
    });
    await expect(
      context.value.invoke({
        admission: allowed,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "BREAKER_STATE_UNAVAILABLE",
      status: "CONTROLLED_TEMPLATE_REQUIRED",
    });
    expect(context.roles).toEqual([]);
  });

  it("lets Safety and budget hard stops bypass every provider", async () => {
    for (const admission of [
      {
        reasonCode: "SAFETY_OVERLAY_ACTIVE",
        status: "ORDINARY_GATEWAY_BLOCKED",
      },
      { reasonCode: "BUDGET_HARD_LIMIT", status: "PROVIDER_CALLS_DISABLED" },
    ] as const) {
      const context = setup({ outcomes: [] });
      const result = await context.value.invoke({
        admission,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      });
      expect(result.status).toMatch(/BLOCKED|CONTROLLED_TEMPLATE_REQUIRED/u);
      expect(context.roles).toEqual([]);
    }
  });

  it("discards a candidate when the live PublishGuard changes after return", async () => {
    const context = setup({
      guards: [
        { status: "ALLOWED" },
        { reasonCode: "STALE_PUBLISH_GUARD", status: "BLOCKED" },
      ],
      outcomes: [{ candidate, status: "CANDIDATE_READY" }],
    });
    await expect(
      context.value.invoke({
        admission: allowed,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "STALE_PUBLISH_GUARD",
      status: "BLOCKED",
    });
  });

  it("G12-F03 skips an open primary breaker and continues directly to backup", async () => {
    const breaker = new MemoryBreaker();
    const primaryKey = fingerprintGatewayJson({
      endpoint: manifest.primary.endpointId,
      model:
        manifest.primary.immutableModelRevision ?? manifest.primary.modelId,
      provider: manifest.primary.providerId,
      provider_account: manifest.primary.providerAccountRef,
      workload: invocation.workload,
    });
    breaker.values.set(
      primaryKey,
      recordGatewayBreakerOutcomeV1({
        nowMs: 0,
        outcome: "AUTH_OR_CONFIG_FAILURE",
        snapshot: initialGatewayBreakerSnapshotV1(
          fingerprintGatewayJson(manifest.primary),
        ),
      }),
    );
    const context = setup({
      breaker,
      outcomes: [{ candidate, status: "CANDIDATE_READY" }],
    });

    await expect(
      context.value.invoke({
        admission: allowed,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({ candidate, status: "CANDIDATE_READY" });
    expect(context.roles).toEqual(["BACKUP_AI"]);
    expect(context.events).toContainEqual(
      expect.objectContaining({
        outcomeCode: "FALLBACK",
        reasonCode: "CIRCUIT_OPEN",
        role: "PRIMARY_AI",
      }),
    );
  });

  it("does not count a replayed UNKNOWN attempt as a second breaker sample", async () => {
    const breaker = new MemoryBreaker();
    const context = setup({
      breaker,
      outcomes: [
        {
          failedRole: "PRIMARY_AI",
          reasonCode: "OUTCOME_UNKNOWN",
          replayedAttempt: true,
          status: "FALLBACK_REQUIRED",
        },
        { candidate, status: "CANDIDATE_READY" },
      ],
    });
    await context.value.invoke({
      admission: allowed,
      invocation,
      manifest,
      runtimeProfile: "INTERACTIVE",
    });
    const primaryKey = fingerprintGatewayJson({
      endpoint: manifest.primary.endpointId,
      model:
        manifest.primary.immutableModelRevision ?? manifest.primary.modelId,
      provider: manifest.primary.providerId,
      provider_account: manifest.primary.providerAccountRef,
      workload: invocation.workload,
    });
    expect(breaker.values.get(primaryKey)).toMatchObject({
      infrastructureWindow: [],
      mode: "CLOSED",
    });
  });

  it("fails closed before providers when the live guard is unreadable", async () => {
    const context = setup({
      guard: {
        async read() {
          throw new Error("synthetic guard loss");
        },
      },
      outcomes: [],
    });
    await expect(
      context.value.invoke({
        admission: allowed,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "LIVE_GUARD_UNAVAILABLE",
      status: "BLOCKED",
    });
    expect(context.roles).toEqual([]);
  });

  it("rejects a malformed manifest before reading breaker state", async () => {
    const breaker: GatewayBreakerStateStoreV1 = {
      compareAndSet: vi.fn(),
      load: vi.fn(),
    };
    const context = setup({ breaker, outcomes: [] });
    await expect(
      context.value.invoke({
        admission: allowed,
        invocation,
        manifest: {
          ...manifest,
          primary: { ...manifest.primary, modelId: "drifted-model" },
        },
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "ROUTE_FINGERPRINT_MISMATCH",
      status: "TERMINAL_GATEWAY_FAILURE",
    });
    expect(breaker.load).not.toHaveBeenCalled();
  });

  it("rejects route compatibility drift before reading breaker state", async () => {
    const breaker: GatewayBreakerStateStoreV1 = {
      compareAndSet: vi.fn(),
      load: vi.fn(),
    };
    const context = setup({ breaker, outcomes: [] });
    await expect(
      context.value.invoke({
        admission: allowed,
        invocation: { ...invocation, routeManifestVersion: "route-v2" },
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "ROUTE_FINGERPRINT_MISMATCH",
      status: "TERMINAL_GATEWAY_FAILURE",
    });
    expect(breaker.load).not.toHaveBeenCalled();
  });

  it("contains telemetry failures without changing a Safety block", async () => {
    const context = setup({
      outcomes: [],
      telemetry: {
        record() {
          throw new Error("synthetic telemetry loss");
        },
      },
    });
    await expect(
      context.value.invoke({
        admission: {
          reasonCode: "SAFETY_OVERLAY_ACTIVE",
          status: "ORDINARY_GATEWAY_BLOCKED",
        },
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "SAFETY_OVERLAY_ACTIVE",
      status: "BLOCKED",
    });
    expect(context.roles).toEqual([]);
  });
});
