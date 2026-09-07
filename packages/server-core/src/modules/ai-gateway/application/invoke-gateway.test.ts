import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  GatewayContractError,
  createGatewayRouteManifestV1,
  type GatewayInvocationV1,
  type GatewayJsonObject,
  type GatewayProviderRouteV1,
  type GatewayRouteManifestV1,
} from "../domain/contracts.js";
import type {
  GatewayAttemptCompletionV1,
  GatewayAttemptReservationResultV1,
  GatewayAttemptReservationV1,
  GatewayAttemptStoreV1,
  GatewayCandidateValidatorV1,
  GatewayProviderAdapterV1,
  GatewayProviderRegistryV1,
  GatewayProviderResultV1,
} from "../spi/index.js";
import { AiGatewayV1 } from "./invoke-gateway.js";

const ACCEPTED_AT = "2026-09-07T02:00:00.000Z";
const DEADLINE_AT = "2026-09-07T02:00:08.000Z";
const PLAN_FINGERPRINT = "1".repeat(64);
const UUIDS = [
  "00000000-0000-4000-8000-000000000101",
  "00000000-0000-4000-8000-000000000102",
  "00000000-0000-4000-8000-000000000103",
  "00000000-0000-4000-8000-000000000104",
] as const;

class MemoryAttemptStore implements GatewayAttemptStoreV1 {
  readonly completions: GatewayAttemptCompletionV1[] = [];
  readonly reservations: GatewayAttemptReservationV1[] = [];
  readonly #attempts = new Map<
    string,
    {
      readonly attemptId: string;
      outcome: GatewayAttemptCompletionV1["outcome"] | null;
      readonly requestFingerprint: string;
    }
  >();

  public async reserveAttempt(
    input: GatewayAttemptReservationV1,
  ): Promise<GatewayAttemptReservationResultV1> {
    const key = `${input.invocationId}:${input.routeRole}:${input.ordinal}`;
    const existing = this.#attempts.get(key);
    if (existing) {
      return {
        existingOutcome: existing.outcome,
        existingRequestFingerprint: existing.requestFingerprint,
        status: "EXISTING",
      };
    }
    this.reservations.push(structuredClone(input));
    this.#attempts.set(key, {
      attemptId: input.attemptId,
      outcome: null,
      requestFingerprint: input.requestFingerprint,
    });
    return { status: "RESERVED" };
  }

  public async completeAttempt(
    input: GatewayAttemptCompletionV1,
  ): Promise<void> {
    const attempt = [...this.#attempts.values()].find(
      ({ attemptId }) => attemptId === input.attemptId,
    );
    if (!attempt) {
      throw new Error("SYNTHETIC_ATTEMPT_NOT_FOUND");
    }
    attempt.outcome = input.outcome;
    this.completions.push(structuredClone(input));
  }
}

function providerRoute(
  role: GatewayProviderRouteV1["role"],
  suffix: string,
): GatewayProviderRouteV1 {
  return {
    adapterId: `synthetic-adapter-${suffix}`,
    adapterVersion: "adapter-v1",
    capabilityProfileId: "strict-json-v1",
    connectDeadlineMs: 500,
    dataHandlingProfileId: "synthetic-no-retention-v1",
    egressTarget:
      role === "PRIMARY_AI" ? "ai.daily.primary" : "ai.daily.backup",
    endpointId: `endpoint-${suffix}`,
    endpointRegion: "local",
    maxOutputTokens: 1200,
    modelId: `model-${suffix}-v1`,
    priceEntryId: `price-${suffix}-v1`,
    providerAccountRef: `account-${suffix}-v1`,
    providerId: `provider-${suffix}`,
    providerParameterSetId: "parameters-v1",
    requestDeadlineMs: role === "PRIMARY_AI" ? 4_000 : 3_000,
    role,
  };
}

function manifest(): GatewayRouteManifestV1 {
  return createGatewayRouteManifestV1({
    backup: providerRoute("BACKUP_AI", "backup"),
    compatibleOutputSchemaVersions: ["1.0.0"],
    compatiblePromptVersions: ["daily-expression-zh-cn-v1"],
    compatibleSafetyPolicyVersions: ["safety-policy-v1"],
    gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
    inputLimits: {
      preparedModelInputBytes: 16 * 1024,
      providerResponseBytes: 12 * 1024,
    },
    invocationCostLimitMicrounits: 10_000,
    manifestVersion: "daily-route-synthetic-v1",
    outputLimits: { maxOutputTokens: 1200 },
    priceCatalogVersion: "price-catalog-synthetic-v1",
    primary: providerRoute("PRIMARY_AI", "primary"),
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
}

function invocation(route: GatewayRouteManifestV1): GatewayInvocationV1 {
  return {
    acceptedAt: ACCEPTED_AT,
    gatewayContractVersion: GATEWAY_CONTRACT_VERSION,
    gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
    hardDeadlineAt: DEADLINE_AT,
    invocationId: UUIDS[0],
    outputSchemaVersion: "1.0.0",
    ownerIntentRef: UUIDS[1],
    personalizationLevel: "FULL",
    planContractVersion: "controlled-expression-plan-v1",
    planFingerprint: PLAN_FINGERPRINT,
    planRef: "synthetic-plan-v1",
    preparedModelInput: {
      contract: "prepared-daily-prompt-input-v1",
      preferred_name: "小陈",
      semantic_slots: [{ allowed_meaning: "今天适合稳稳推进" }],
    },
    promptVersion: "daily-expression-zh-cn-v1",
    routeManifestFingerprint: route.fingerprint,
    routeManifestVersion: route.manifestVersion,
    safetyPolicyVersion: "safety-policy-v1",
    templateVersion: "daily-template-v1",
    workload: "DAILY_EXPRESSION_V1",
  };
}

function fingerprint(value: GatewayJsonObject): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function validator(): GatewayCandidateValidatorV1 {
  return {
    async validate(input) {
      let payload: unknown = input.candidate;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return {
            outcome: "INVALID_SCHEMA",
            reasonCode: "OUTPUT_NOT_SINGLE_JSON_OBJECT",
            status: "REJECT",
          };
        }
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload) ||
        Object.keys(payload).join("|") !== "message" ||
        typeof (payload as { message?: unknown }).message !== "string"
      ) {
        return {
          outcome: "INVALID_SCHEMA",
          reasonCode: "OUTPUT_SCHEMA_INVALID",
          status: "REJECT",
        };
      }
      const parsed = Object.freeze({
        message: (payload as { message: string }).message,
      });
      return {
        payload: parsed,
        payloadFingerprint: fingerprint(parsed),
        receipt: {
          validatorVersion: "synthetic-validator-v1",
          verdict: "PASS",
        },
        status: "PASS",
      };
    },
  };
}

function adapter(
  route: GatewayProviderRouteV1,
  result: GatewayProviderResultV1,
): GatewayProviderAdapterV1 & {
  readonly invoke: ReturnType<typeof vi.fn>;
} {
  return {
    adapterId: route.adapterId,
    adapterVersion: route.adapterVersion,
    capabilities: () => ({
      capabilityProfileId: route.capabilityProfileId,
      streamingEnabled: false,
      strictSchemaNative: true,
      supportedWorkloads: ["DAILY_EXPRESSION_V1"],
      supportsCancellation: true,
      toolsEnabled: false,
    }),
    healthProbe: async () => ({ status: "AVAILABLE" }),
    invoke: vi.fn(async () => result),
  };
}

function registry(
  adapters: readonly GatewayProviderAdapterV1[],
): GatewayProviderRegistryV1 {
  return {
    resolve(route) {
      return adapters.find(
        (entry) =>
          entry.adapterId === route.adapterId &&
          entry.adapterVersion === route.adapterVersion,
      );
    },
  };
}

function ids() {
  let ordinal = 2;
  return { nextAttemptId: () => UUIDS[ordinal++]! };
}

function success(route: GatewayProviderRouteV1, message: string) {
  return {
    bodyUtf8: JSON.stringify({ message }),
    observedModelId: route.modelId,
    providerRequestRef: `request-${route.role.toLowerCase()}`,
    status: "SUCCESS",
    usage: {
      billedCostMicrounits: 120,
      inputUnits: 20,
      outputUnits: 10,
    },
  } as const satisfies GatewayProviderResultV1;
}

function gateway(input: {
  readonly adapters?: readonly GatewayProviderAdapterV1[];
  readonly attempts?: MemoryAttemptStore;
}) {
  return new AiGatewayV1({
    attempts: input.attempts ?? new MemoryAttemptStore(),
    candidateValidator: validator(),
    clock: { now: () => new Date(ACCEPTED_AT) },
    ids: ids(),
    providers: registry(input.adapters ?? []),
  });
}

describe("AI-001 immutable route and invocation contracts", () => {
  it("pins semantic fields and rejects latest, drift and forbidden prepared input keys", async () => {
    const route = manifest();
    expect(Object.isFrozen(route)).toBe(true);
    expect(route.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(() =>
      createGatewayRouteManifestV1({
        ...route,
        manifestVersion: "latest",
      }),
    ).toThrowError(GatewayContractError);

    for (const forbiddenInput of [
      { account_ref: UUIDS[1] },
      { user_id: "synthetic-user" },
      { root_seed: "synthetic-seed" },
      { raw_score: 80 },
      { source_refs: ["synthetic-source"] },
      { raw_note: "synthetic-note" },
      { safety_category: "synthetic-category" },
    ]) {
      await expect(
        gateway({}).invoke({
          admission: { status: "ALLOWED" },
          invocation: {
            ...invocation(route),
            preparedModelInput: forbiddenInput,
          },
          manifest: route,
          role: "PRIMARY_AI",
          runtimeProfile: "INTERACTIVE",
        }),
      ).resolves.toMatchObject({
        reasonCode: "INVOCATION_SCHEMA_INVALID",
        status: "TERMINAL_GATEWAY_FAILURE",
      });
    }

    const drifted: GatewayRouteManifestV1 = {
      ...route,
      primary: { ...route.primary, modelId: "changed-model-v2" },
    };
    await expect(
      gateway({}).invoke({
        admission: { status: "ALLOWED" },
        invocation: invocation(route),
        manifest: drifted,
        role: "PRIMARY_AI",
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toMatchObject({
      reasonCode: "ROUTE_FINGERPRINT_MISMATCH",
      status: "TERMINAL_GATEWAY_FAILURE",
    });
  });
});

describe("AI-001 Gateway MODULE and deterministic AI_EVAL", () => {
  it("G12-N01 returns one complete candidate from the explicitly selected role", async () => {
    const route = manifest();
    const attempts = new MemoryAttemptStore();
    const primary = adapter(
      route.primary,
      success(route.primary, "主路完整候选"),
    );

    await expect(
      gateway({ adapters: [primary], attempts }).invoke({
        admission: { status: "ALLOWED" },
        invocation: invocation(route),
        manifest: route,
        role: "PRIMARY_AI",
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toMatchObject({
      candidate: {
        generationMode: "PRIMARY_AI",
        payload: { message: "主路完整候选" },
      },
      status: "CANDIDATE_READY",
    });
    expect(primary.invoke).toHaveBeenCalledTimes(1);
    expect(attempts.reservations.map(({ routeRole }) => routeRole)).toEqual([
      "PRIMARY_AI",
    ]);
    expect(attempts.completions).toHaveLength(1);
    expect(attempts.completions[0]).toMatchObject({
      outcome: "SUCCEEDED",
      usage: { billedCostMicrounits: 120, inputUnits: 20, outputUnits: 10 },
    });
    expect(JSON.stringify(attempts)).not.toContain("主路完整候选");
    expect(JSON.stringify(attempts)).not.toContain("小陈");
  });

  it("G12-L01/G12-L02 records UNKNOWN once and never redispatches the same role", async () => {
    const route = manifest();
    const attempts = new MemoryAttemptStore();
    const primary = adapter(route.primary, {
      reasonCode: "PROVIDER_RESPONSE_TIMEOUT",
      status: "OUTCOME_UNKNOWN",
      usage: {
        billedCostMicrounits: null,
        inputUnits: null,
        outputUnits: null,
      },
    });
    const service = gateway({ adapters: [primary], attempts });
    const input = {
      admission: { status: "ALLOWED" as const },
      invocation: invocation(route),
      manifest: route,
      role: "PRIMARY_AI" as const,
      runtimeProfile: "INTERACTIVE" as const,
    };

    await expect(service.invoke(input)).resolves.toEqual({
      failedRole: "PRIMARY_AI",
      reasonCode: "OUTCOME_UNKNOWN",
      status: "FALLBACK_REQUIRED",
    });
    expect(attempts.completions.map(({ outcome }) => outcome)).toEqual([
      "OUTCOME_UNKNOWN",
    ]);
    await expect(service.invoke(input)).resolves.toEqual({
      failedRole: "PRIMARY_AI",
      reasonCode: "OUTCOME_UNKNOWN",
      status: "FALLBACK_REQUIRED",
    });
    expect(primary.invoke).toHaveBeenCalledTimes(1);
  });

  it("S29-ARCH-031 lets one concurrent claim dispatch while the loser recovers", async () => {
    const route = manifest();
    const attempts = new MemoryAttemptStore();
    let releaseProvider!: (result: GatewayProviderResultV1) => void;
    let markStarted!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const providerResult = new Promise<GatewayProviderResultV1>((resolve) => {
      releaseProvider = resolve;
    });
    const invoke = vi.fn(async () => {
      markStarted();
      return providerResult;
    });
    const primary: GatewayProviderAdapterV1 = {
      adapterId: route.primary.adapterId,
      adapterVersion: route.primary.adapterVersion,
      capabilities: () => ({
        capabilityProfileId: route.primary.capabilityProfileId,
        streamingEnabled: false,
        strictSchemaNative: true,
        supportedWorkloads: ["DAILY_EXPRESSION_V1"],
        supportsCancellation: true,
        toolsEnabled: false,
      }),
      healthProbe: async () => ({ status: "AVAILABLE" }),
      invoke,
    };
    const service = gateway({ adapters: [primary], attempts });
    const input = {
      admission: { status: "ALLOWED" as const },
      invocation: invocation(route),
      manifest: route,
      role: "PRIMARY_AI" as const,
      runtimeProfile: "INTERACTIVE" as const,
    };

    const winner = service.invoke(input);
    await providerStarted;
    await expect(service.invoke(input)).resolves.toEqual({
      reasonCode: "ATTEMPT_ALREADY_EXISTS",
      status: "RECOVER_EXISTING",
    });
    releaseProvider(success(route.primary, "并发胜者"));
    await expect(winner).resolves.toMatchObject({
      candidate: { payload: { message: "并发胜者" } },
      status: "CANDIDATE_READY",
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("returns FALLBACK_REQUIRED without choosing backup or rendering a template", async () => {
    const route = manifest();
    await expect(
      gateway({}).invoke({
        admission: { status: "ALLOWED" },
        invocation: invocation(route),
        manifest: route,
        role: "PRIMARY_AI",
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      failedRole: "PRIMARY_AI",
      reasonCode: "PROVIDER_UNAVAILABLE",
      status: "FALLBACK_REQUIRED",
    });
  });

  it("allows the caller to explicitly select the frozen backup role", async () => {
    const route = manifest();
    const backup = adapter(route.backup, success(route.backup, "显式备用候选"));
    await expect(
      gateway({ adapters: [backup] }).invoke({
        admission: { status: "ALLOWED" },
        invocation: invocation(route),
        manifest: route,
        role: "BACKUP_AI",
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toMatchObject({
      candidate: {
        generationMode: "BACKUP_AI",
        payload: { message: "显式备用候选" },
      },
      status: "CANDIDATE_READY",
    });
    expect(backup.invoke).toHaveBeenCalledTimes(1);
  });

  it("G12-P03 rejects invalid raw output without storing its body", async () => {
    const route = manifest();
    const attempts = new MemoryAttemptStore();
    const privateRawBody = JSON.stringify({
      message: "看似可用的局部字段",
      source_ref: "SYNTHETIC_PRIVATE_SOURCE",
    });
    const primary = adapter(route.primary, {
      ...success(route.primary, "unused"),
      bodyUtf8: privateRawBody,
    });

    await expect(
      gateway({ adapters: [primary], attempts }).invoke({
        admission: { status: "ALLOWED" },
        invocation: invocation(route),
        manifest: route,
        role: "PRIMARY_AI",
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      failedRole: "PRIMARY_AI",
      reasonCode: "OUTPUT_SCHEMA_INVALID",
      status: "FALLBACK_REQUIRED",
    });
    expect(attempts.completions.map(({ outcome }) => outcome)).toEqual([
      "INVALID_SCHEMA",
    ]);
    expect(JSON.stringify(attempts)).not.toContain(privateRawBody);
    expect(JSON.stringify(attempts)).not.toContain("SYNTHETIC_PRIVATE_SOURCE");
  });

  it("finishes the attempt when a validator returns an invalid PASS receipt", async () => {
    const route = manifest();
    const attempts = new MemoryAttemptStore();
    const primary = adapter(route.primary, success(route.primary, "synthetic"));
    const service = new AiGatewayV1({
      attempts,
      candidateValidator: {
        async validate() {
          return {
            payload: { message: "synthetic" },
            payloadFingerprint: "0".repeat(64),
            receipt: {
              validatorVersion: "synthetic-validator-v1",
              verdict: "PASS",
            },
            status: "PASS",
          };
        },
      },
      clock: { now: () => new Date(ACCEPTED_AT) },
      ids: ids(),
      providers: registry([primary]),
    });

    await expect(
      service.invoke({
        admission: { status: "ALLOWED" },
        invocation: invocation(route),
        manifest: route,
        role: "PRIMARY_AI",
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      failedRole: "PRIMARY_AI",
      reasonCode: "OUTPUT_VALIDATOR_CONTRACT_INVALID",
      status: "FALLBACK_REQUIRED",
    });
    expect(attempts.completions).toMatchObject([
      {
        failureCode: "OUTPUT_VALIDATOR_CONTRACT_INVALID",
        outcome: "INVALID_SCHEMA",
      },
    ]);
  });

  it("G12-P06 blocks high-risk admission before any ordinary call", async () => {
    const route = manifest();
    const primary = adapter(
      route.primary,
      success(route.primary, "不应被调用"),
    );
    await expect(
      gateway({ adapters: [primary] }).invoke({
        admission: {
          reasonCode: "SAFETY_OVERLAY_ACTIVE",
          status: "ORDINARY_GATEWAY_BLOCKED",
        },
        invocation: invocation(route),
        manifest: route,
        role: "PRIMARY_AI",
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "SAFETY_OVERLAY_ACTIVE",
      status: "BLOCKED",
    });
    expect(primary.invoke).not.toHaveBeenCalled();
  });

  it("returns a caller-controlled template fallback when breaker state is unreadable", async () => {
    const route = manifest();
    const primary = adapter(
      route.primary,
      success(route.primary, "不应被调用"),
    );
    await expect(
      gateway({ adapters: [primary] }).invoke({
        admission: {
          reasonCode: "BREAKER_STATE_UNAVAILABLE",
          status: "PROVIDER_CALLS_DISABLED",
        },
        invocation: invocation(route),
        manifest: route,
        role: "PRIMARY_AI",
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      failedRole: "PRIMARY_AI",
      reasonCode: "BREAKER_STATE_UNAVAILABLE",
      status: "FALLBACK_REQUIRED",
    });
    expect(primary.invoke).not.toHaveBeenCalled();
  });

  it("rejects the wrong workload profile without dispatch", async () => {
    const route = manifest();
    const primary = adapter(
      route.primary,
      success(route.primary, "不应被调用"),
    );
    await expect(
      gateway({ adapters: [primary] }).invoke({
        admission: { status: "ALLOWED" },
        invocation: invocation(route),
        manifest: route,
        role: "PRIMARY_AI",
        runtimeProfile: "BACKGROUND",
      }),
    ).resolves.toMatchObject({
      reasonCode: "ROUTE_COMPATIBILITY_INVALID",
      status: "TERMINAL_GATEWAY_FAILURE",
    });
    expect(primary.invoke).not.toHaveBeenCalled();
  });
});
