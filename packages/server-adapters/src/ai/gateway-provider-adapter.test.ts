import type { GatewayProviderRouteV1 } from "@daily-energy/server-core/ai-gateway";
import type {
  GatewayProviderInvocationContextV1,
  GatewayProviderRequestV1,
} from "@daily-energy/server-core/ai-gateway/spi";
import { describe, expect, it } from "vitest";

import { createSyntheticProviderTransportV1 } from "../testing/synthetic-ai-provider.js";
import {
  ProviderAdapterBoundaryError,
  createGatewayProviderAdapterV1,
  type ProviderTransactionStateV1,
} from "./gateway-provider-adapter.js";

const route: GatewayProviderRouteV1 = Object.freeze({
  adapterId: "synthetic-adapter-primary",
  adapterVersion: "adapter-v1",
  capabilityProfileId: "strict-json-v1",
  connectDeadlineMs: 500,
  dataHandlingProfileId: "synthetic-no-retention-v1",
  egressTarget: "ai.daily.primary",
  endpointId: "endpoint-primary",
  endpointRegion: "local",
  maxOutputTokens: 1200,
  modelId: "model-primary-v1",
  priceEntryId: "price-primary-v1",
  providerAccountRef: "account-primary-v1",
  providerId: "provider-primary",
  providerParameterSetId: "parameters-v1",
  requestDeadlineMs: 4_000,
  role: "PRIMARY_AI",
});

const request: GatewayProviderRequestV1 = Object.freeze({
  attemptId: "00000000-0000-4000-8000-000000000201",
  outputSchemaVersion: "1.0.0",
  preparedModelInput: {
    contract: "prepared-daily-prompt-input-v1",
    semantic_slots: [{ allowed_meaning: "synthetic" }],
  },
  promptVersion: "daily-expression-zh-cn-v1",
  requestFingerprint: "1".repeat(64),
  role: "PRIMARY_AI",
  route,
  workload: "DAILY_EXPRESSION_V1",
});

const context: GatewayProviderInvocationContextV1 = Object.freeze({
  hardDeadlineAt: "2026-09-07T02:00:08.000Z",
  runtimeProfile: "INTERACTIVE",
});
const capabilityProfile = Object.freeze({
  capabilityProfileId: route.capabilityProfileId,
  streamingEnabled: false as const,
  strictSchemaNative: true,
  supportedWorkloads: ["DAILY_EXPRESSION_V1"] as const,
  supportsCancellation: true as const,
  toolsEnabled: false as const,
});

function success() {
  return {
    bodyUtf8: JSON.stringify({ message: "synthetic" }),
    observedModelId: route.modelId,
    providerRequestRef: "synthetic-request-ref",
    status: "SUCCESS" as const,
    usage: {
      billedCostMicrounits: 12,
      inputUnits: 2,
      outputUnits: 1,
    },
  };
}

describe("AI-001 provider adapter profile, egress and transaction contract", () => {
  it("allows one exact Interactive call outside a transaction without retry", async () => {
    const transport = createSyntheticProviderTransportV1([
      success(),
      {
        reasonCode: "PROVIDER_UNAVAILABLE",
        status: "FAILURE",
        usage: {
          billedCostMicrounits: null,
          inputUnits: null,
          outputUnits: null,
        },
      },
    ]);
    const adapter = createGatewayProviderAdapterV1({
      adapterId: route.adapterId,
      adapterVersion: route.adapterVersion,
      capabilityProfile,
      egressAllowlist: [route.egressTarget],
      now: () => new Date("2026-09-07T02:00:00.000Z"),
      runtimeProfile: "INTERACTIVE",
      transactionState: () => "OUTSIDE_TRANSACTION",
      transport,
    });

    expect(adapter.capabilities()).toEqual(capabilityProfile);
    await expect(adapter.healthProbe()).resolves.toEqual({
      status: "AVAILABLE",
    });
    await expect(adapter.invoke(request, context)).resolves.toEqual(success());
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.request.preparedModelInput).toEqual(
      request.preparedModelInput,
    );
  });

  it("rejects a provider call while a database transaction is active", async () => {
    let state: ProviderTransactionStateV1 = "IN_TRANSACTION";
    const transport = createSyntheticProviderTransportV1([success()]);
    const adapter = createGatewayProviderAdapterV1({
      adapterId: route.adapterId,
      adapterVersion: route.adapterVersion,
      capabilityProfile,
      egressAllowlist: [route.egressTarget],
      now: () => new Date("2026-09-07T02:00:00.000Z"),
      runtimeProfile: "INTERACTIVE",
      transactionState: () => state,
      transport,
    });

    await expect(adapter.invoke(request, context)).rejects.toMatchObject({
      code: "PROVIDER_CALL_IN_TRANSACTION",
    });
    expect(transport.calls).toHaveLength(0);
    state = "OUTSIDE_TRANSACTION";
    await expect(adapter.invoke(request, context)).resolves.toMatchObject({
      status: "SUCCESS",
    });
    expect(transport.calls).toHaveLength(1);
  });

  it("rejects the wrong profile and any endpoint outside the bound egress allowlist", async () => {
    const transport = createSyntheticProviderTransportV1([success()]);
    const adapter = createGatewayProviderAdapterV1({
      adapterId: route.adapterId,
      adapterVersion: route.adapterVersion,
      capabilityProfile,
      egressAllowlist: ["ai.daily.other"],
      now: () => new Date("2026-09-07T02:00:00.000Z"),
      runtimeProfile: "INTERACTIVE",
      transactionState: () => "OUTSIDE_TRANSACTION",
      transport,
    });

    await expect(
      adapter.invoke(request, { ...context, runtimeProfile: "BACKGROUND" }),
    ).rejects.toMatchObject({ code: "PROVIDER_PROFILE_REJECTED" });
    await expect(adapter.invoke(request, context)).rejects.toMatchObject({
      code: "PROVIDER_EGRESS_REJECTED",
    });
    expect(transport.calls).toHaveLength(0);
  });

  it("allows only the matching Background weekly and isolated Evaluation profiles", async () => {
    for (const [runtimeProfile, workload, egressTarget] of [
      ["BACKGROUND", "WEEKLY_EXPRESSION_V1", "ai.weekly"],
      ["EVALUATION", "DAILY_EXPRESSION_V1", "ai.evaluation"],
    ] as const) {
      const profiledRoute = { ...route, egressTarget };
      const transport = createSyntheticProviderTransportV1([success()]);
      const adapter = createGatewayProviderAdapterV1({
        adapterId: route.adapterId,
        adapterVersion: route.adapterVersion,
        capabilityProfile: {
          ...capabilityProfile,
          supportedWorkloads: [workload],
        },
        egressAllowlist: [egressTarget],
        now: () => new Date("2026-09-07T02:00:00.000Z"),
        runtimeProfile,
        transactionState: () => "OUTSIDE_TRANSACTION",
        transport,
      });

      await expect(
        adapter.invoke(
          { ...request, route: profiledRoute, workload },
          { ...context, runtimeProfile },
        ),
      ).resolves.toMatchObject({ status: "SUCCESS" });
      expect(transport.calls).toHaveLength(1);
    }
  });

  it("preserves UNKNOWN as metadata and rejects malformed usage without exposing bodies", async () => {
    const unknownTransport = createSyntheticProviderTransportV1([
      {
        providerRequestRef: "synthetic-unknown-ref",
        reasonCode: "PROVIDER_RESPONSE_TIMEOUT",
        status: "OUTCOME_UNKNOWN",
        usage: {
          billedCostMicrounits: null,
          inputUnits: null,
          outputUnits: null,
        },
      },
    ]);
    const unknownAdapter = createGatewayProviderAdapterV1({
      adapterId: route.adapterId,
      adapterVersion: route.adapterVersion,
      capabilityProfile,
      egressAllowlist: [route.egressTarget],
      now: () => new Date("2026-09-07T02:00:00.000Z"),
      runtimeProfile: "INTERACTIVE",
      transactionState: () => "OUTSIDE_TRANSACTION",
      transport: unknownTransport,
    });
    await expect(unknownAdapter.invoke(request, context)).resolves.toEqual({
      providerRequestRef: "synthetic-unknown-ref",
      reasonCode: "PROVIDER_RESPONSE_TIMEOUT",
      status: "OUTCOME_UNKNOWN",
      usage: {
        billedCostMicrounits: null,
        inputUnits: null,
        outputUnits: null,
      },
    });

    const invalidTransport = createSyntheticProviderTransportV1([
      {
        ...success(),
        bodyUtf8: "SYNTHETIC_PRIVATE_BODY",
        usage: { billedCostMicrounits: -1, inputUnits: 1, outputUnits: 1 },
      },
    ]);
    const invalidAdapter = createGatewayProviderAdapterV1({
      adapterId: route.adapterId,
      adapterVersion: route.adapterVersion,
      capabilityProfile,
      egressAllowlist: [route.egressTarget],
      now: () => new Date("2026-09-07T02:00:00.000Z"),
      runtimeProfile: "INTERACTIVE",
      transactionState: () => "OUTSIDE_TRANSACTION",
      transport: invalidTransport,
    });
    const failure = await invalidAdapter
      .invoke(request, context)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ProviderAdapterBoundaryError);
    expect(String(failure)).toBe(
      "ProviderAdapterBoundaryError: PROVIDER_RESULT_INVALID",
    );
    expect(String(failure)).not.toContain("SYNTHETIC_PRIVATE_BODY");
  });

  it("normalizes an arbitrary transport exception without retrying or exposing it", async () => {
    let calls = 0;
    const adapter = createGatewayProviderAdapterV1({
      adapterId: route.adapterId,
      adapterVersion: route.adapterVersion,
      capabilityProfile,
      egressAllowlist: [route.egressTarget],
      now: () => new Date("2026-09-07T02:00:00.000Z"),
      runtimeProfile: "INTERACTIVE",
      transactionState: () => "OUTSIDE_TRANSACTION",
      transport: {
        async healthProbe() {
          return { status: "AVAILABLE" };
        },
        async invoke() {
          calls += 1;
          throw new Error("SYNTHETIC_PROVIDER_SECRET_AND_BODY");
        },
      },
    });

    const result = await adapter.invoke(request, context);
    expect(result).toEqual({
      reasonCode: "PROVIDER_NETWORK_ERROR",
      status: "FAILURE",
      usage: {
        billedCostMicrounits: null,
        inputUnits: null,
        outputUnits: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain(
      "SYNTHETIC_PROVIDER_SECRET_AND_BODY",
    );
    expect(calls).toBe(1);
  });

  it("enforces the route deadline and returns UNKNOWN even if transport ignores cancellation", async () => {
    const shortRoute = { ...route, requestDeadlineMs: 1 };
    const adapter = createGatewayProviderAdapterV1({
      adapterId: route.adapterId,
      adapterVersion: route.adapterVersion,
      capabilityProfile,
      egressAllowlist: [route.egressTarget],
      now: () => new Date("2026-09-07T02:00:00.000Z"),
      runtimeProfile: "INTERACTIVE",
      transactionState: () => "OUTSIDE_TRANSACTION",
      transport: {
        async healthProbe() {
          return { status: "AVAILABLE" };
        },
        invoke() {
          return new Promise(() => undefined);
        },
      },
    });

    await expect(
      adapter.invoke({ ...request, route: shortRoute }, context),
    ).resolves.toEqual({
      reasonCode: "PROVIDER_RESPONSE_TIMEOUT",
      status: "OUTCOME_UNKNOWN",
      usage: {
        billedCostMicrounits: null,
        inputUnits: null,
        outputUnits: null,
      },
    });
  });
});
