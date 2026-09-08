import { describe, expect, it, vi } from "vitest";

import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  createGatewayRouteManifestV1,
  createGatewayValidationReceiptV1,
  fingerprintGatewayJson,
  type GatewayInvocationV1,
  type GatewayJsonObject,
  type GatewayProviderRouteV1,
} from "../domain/contracts.js";
import type {
  GatewayCandidateValidatorV1,
  GatewayTemplateRendererV1,
} from "../spi/index.js";
import { ControlledTemplateGatewayV1 } from "./controlled-template.js";

const frozenPlan = Object.freeze({
  contract: "daily-expression-v1",
  selected_action_id: "action.synthetic.v1",
}) satisfies GatewayJsonObject;

const providerRoute = (
  role: "PRIMARY_AI" | "BACKUP_AI",
  suffix: string,
): GatewayProviderRouteV1 => ({
  adapterId: `adapter-${suffix}`,
  adapterVersion: "adapter-v1",
  capabilityProfileId: "strict-json-v1",
  connectDeadlineMs: 500,
  dataHandlingProfileId: "synthetic-no-retention-v1",
  egressTarget: `ai.synthetic.${suffix}`,
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
});

const manifest = createGatewayRouteManifestV1({
  backup: providerRoute("BACKUP_AI", "backup"),
  compatibleOutputSchemaVersions: ["1.0.0"],
  compatiblePromptVersions: ["daily-expression-zh-cn-v1"],
  compatibleSafetyPolicyVersions: ["safety-policy-v1"],
  gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
  inputLimits: {
    preparedModelInputBytes: 16 * 1_024,
    providerResponseBytes: 12 * 1_024,
  },
  invocationCostLimitMicrounits: 10_000,
  manifestVersion: "route-template-test-v1",
  outputLimits: { maxOutputTokens: 1_200 },
  priceCatalogVersion: "price-v1",
  primary: providerRoute("PRIMARY_AI", "primary"),
  status: "ACTIVE",
  template: {
    localeCatalogVersion: "zh-cn-v1",
    maxExecutionMs: 100,
    minimumReserveMs: 1_000,
    rendererId: "controlled-daily-template",
    rendererVersion: "controlled-daily-template-renderer-v1",
    templateCompatibilityVersion: "daily-template-v1",
  },
  workload: "DAILY_EXPRESSION_V1",
});

const invocation: GatewayInvocationV1 = {
  acceptedAt: "2026-09-08T01:00:00.000Z",
  gatewayContractVersion: GATEWAY_CONTRACT_VERSION,
  gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
  hardDeadlineAt: "2026-09-08T01:00:08.000Z",
  invocationId: "00000000-0000-4000-8000-000000000601",
  outputSchemaVersion: "1.0.0",
  ownerIntentRef: "00000000-0000-4000-8000-000000000602",
  personalizationLevel: "FULL",
  planContractVersion: "daily-expression-v1",
  planFingerprint: fingerprintGatewayJson(frozenPlan),
  planRef: "synthetic-plan-ai006-v1",
  preparedModelInput: { contract: "prepared-daily-prompt-input-v1" },
  promptVersion: "daily-expression-zh-cn-v1",
  routeManifestFingerprint: manifest.fingerprint,
  routeManifestVersion: manifest.manifestVersion,
  safetyPolicyVersion: "safety-policy-v1",
  templateVersion: "daily-template-v1",
  workload: "DAILY_EXPRESSION_V1",
};

function passingValidator(): GatewayCandidateValidatorV1 {
  return {
    async validate(input) {
      const payload = input.candidate as GatewayJsonObject;
      const payloadFingerprint = fingerprintGatewayJson(payload);
      return {
        payload,
        payloadFingerprint,
        receipt: createGatewayValidationReceiptV1({
          outputSchemaVersion: input.invocation.outputSchemaVersion,
          payloadFingerprint,
          planFingerprint: input.invocation.planFingerprint,
          promptVersion: input.invocation.promptVersion,
          routeRole: input.source,
          safetyPolicyVersion: input.invocation.safetyPolicyVersion,
          validatorVersion: "validator-v1",
          workload: input.invocation.workload,
        }),
        status: "PASS",
      };
    },
  };
}

describe("AI-006 controlled template preflight", () => {
  it("returns one frozen, fingerprinted template candidate through the common validator", async () => {
    const renderer: GatewayTemplateRendererV1 = {
      render: vi.fn(async () => ({ message: "完整本地候选" })),
    };
    const service = new ControlledTemplateGatewayV1({
      candidateValidator: passingValidator(),
      clock: { now: () => new Date("2026-09-08T01:00:00.100Z") },
      ids: {
        nextAttemptId: () => "00000000-0000-4000-8000-000000000603",
      },
      renderer,
    });

    const result = await service.preflight({
      frozenPlan,
      invocation,
      manifest,
      runtimeProfile: "INTERACTIVE",
    });
    expect(result).toMatchObject({
      candidate: {
        generationMode: "CONTROLLED_TEMPLATE",
        payload: { message: "完整本地候选" },
        provenance: { templateVersion: "daily-template-v1" },
        validationReceipt: {
          routeRole: "CONTROLLED_TEMPLATE",
          verdict: "PASS",
        },
      },
      status: "CANDIDATE_READY",
    });
    expect(renderer.render).toHaveBeenCalledOnce();
    if (result.status === "CANDIDATE_READY") {
      expect(Object.isFrozen(result.candidate)).toBe(true);
      expect(Object.isFrozen(result.candidate.payload)).toBe(true);
    }
  });

  it("rejects plan fingerprint drift before rendering", async () => {
    const renderer: GatewayTemplateRendererV1 = {
      render: vi.fn(async () => ({ message: "must not render" })),
    };
    const service = new ControlledTemplateGatewayV1({
      candidateValidator: passingValidator(),
      clock: { now: () => new Date("2026-09-08T01:00:00.100Z") },
      renderer,
    });
    await expect(
      service.preflight({
        frozenPlan: { ...frozenPlan, selected_action_id: "drifted" },
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "PLAN_BINDING_INVALID",
      status: "TERMINAL_GATEWAY_FAILURE",
    });
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it.each(["INVALID", "REJECTED", "INDETERMINATE"] as const)(
    "turns validator %s into F4 without returning partial content",
    async (status) => {
      const service = new ControlledTemplateGatewayV1({
        candidateValidator: {
          async validate() {
            return status === "INDETERMINATE"
              ? {
                  reasonCode: "OUTPUT_VALIDATOR_UNAVAILABLE",
                  status,
                }
              : { reasonCode: "SYNTHETIC_TEMPLATE_REJECTED", status };
          },
        },
        clock: { now: () => new Date("2026-09-08T01:00:00.100Z") },
        renderer: {
          async render() {
            return { partial: "must not escape" };
          },
        },
      });
      const result = await service.preflight({
        frozenPlan,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      });
      expect(result).toEqual({
        reasonCode: "TEMPLATE_PREFLIGHT_FAILED",
        status: "TERMINAL_GATEWAY_FAILURE",
      });
      expect(JSON.stringify(result)).not.toContain("must not escape");
    },
  );

  it("fails closed when local rendering exceeds its bounded execution budget", async () => {
    const times = [
      new Date("2026-09-08T01:00:00.000Z"),
      new Date("2026-09-08T01:00:00.101Z"),
    ];
    const service = new ControlledTemplateGatewayV1({
      candidateValidator: passingValidator(),
      clock: { now: () => times.shift()! },
      renderer: {
        async render() {
          return { message: "late" };
        },
      },
    });
    await expect(
      service.preflight({
        frozenPlan,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "TEMPLATE_PREFLIGHT_FAILED",
      status: "TERMINAL_GATEWAY_FAILURE",
    });
  });

  it("includes candidate validation in the bounded local execution budget", async () => {
    const times = [
      new Date("2026-09-08T01:00:00.000Z"),
      new Date("2026-09-08T01:00:00.050Z"),
      new Date("2026-09-08T01:00:00.101Z"),
    ];
    const service = new ControlledTemplateGatewayV1({
      candidateValidator: passingValidator(),
      clock: { now: () => times.shift()! },
      renderer: {
        async render() {
          return { message: "validation finishes too late" };
        },
      },
    });
    await expect(
      service.preflight({
        frozenPlan,
        invocation,
        manifest,
        runtimeProfile: "INTERACTIVE",
      }),
    ).resolves.toEqual({
      reasonCode: "TEMPLATE_PREFLIGHT_FAILED",
      status: "TERMINAL_GATEWAY_FAILURE",
    });
  });
});
