import {
  DAILY_PROMPT_VERSION,
  DAILY_TEMPLATE_RENDERER_VERSION,
  DAILY_TEMPLATE_VERSION,
  buildPreparedDailyPromptInputV1,
} from "@daily-energy/prompt-library";
import {
  ControlledTemplateGatewayV1,
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  GatewayRouteOrchestratorV1,
  createGatewayRouteManifestV1,
  fingerprintGatewayJson,
  type GatewayInvocationV1,
  type GatewayJsonObject,
  type GatewayProviderRouteV1,
} from "@daily-energy/server-core/ai-gateway";
import type {
  ExpressionGatewayV1,
  GatewayBreakerStateStoreV1,
} from "@daily-energy/server-core/ai-gateway/spi";
import { assembleGatewayDailyResultV1 } from "@daily-energy/server-core/content-publication";
import {
  DAILY_V1_GENERATION_MANIFEST,
  deriveDailyRulesV1,
  deriveRootSeed,
  generationManifestFingerprintHex,
  parseStableSubjectId,
  type FrozenGenerationManifest,
} from "@daily-energy/server-core/generation";
import { parseProductDate } from "@daily-energy/server-core/product-time";
import { ExpressionPayloadSchema } from "@daily-energy/shared-schemas";
import { describe, expect, it } from "vitest";

import {
  CONTROLLED_DAILY_TEMPLATE_LOCALE_CATALOG_VERSION,
  CONTROLLED_DAILY_TEMPLATE_RENDERER_ID,
  createGatewayControlledDailyTemplateRendererV1,
} from "./controlled-daily-template.js";
import { createGatewayStructuredOutputValidatorV1 } from "./gateway-structured-output-validator.js";

const generationManifest: FrozenGenerationManifest = Object.freeze({
  fingerprintHex: generationManifestFingerprintHex(
    DAILY_V1_GENERATION_MANIFEST,
  ),
  manifest: DAILY_V1_GENERATION_MANIFEST,
  manifestRef: "manifest-ref-ai006",
  resultVersion: "daily-v1",
});

function providerRoute(
  role: "PRIMARY_AI" | "BACKUP_AI",
  suffix: string,
): GatewayProviderRouteV1 {
  return {
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
  };
}

describe("AI-006 real Daily controlled-template Gateway adapter", () => {
  it("renders and validates the frozen C-006 plan without provider, network or candidate fragments", async () => {
    const stableSubjectId = parseStableSubjectId("synthetic_ai006_subject");
    const snapshot = {
      snapshot_version: "input-v1",
      product_date: "2026-09-08",
      result_version: "daily-v1",
      checkin: {
        revision: 1,
        mood: "VERY_LOW" as const,
        energy: "EMPTY" as const,
        sleep: "POOR" as const,
      },
      profile: { revision: 1, expression_style: "LIGHT_HUMOR" as const },
      relationship: { stage: "NEWLY_MET" as const, encounter_day_count: 1 },
      permitted_context: [],
    };
    const derived = deriveDailyRulesV1({
      manifest: generationManifest,
      rootSeed: deriveRootSeed({
        productDate: parseProductDate(snapshot.product_date),
        resultVersion: snapshot.result_version,
        stableSubjectId,
      }),
      snapshot,
      stableSubjectId,
    });
    const frozenPlan = JSON.parse(
      JSON.stringify(derived.controlledExpressionPlan),
    ) as GatewayJsonObject;
    const preparedModelInput = JSON.parse(
      JSON.stringify(
        buildPreparedDailyPromptInputV1({
          personalizationLevel: "FULL",
          plan: derived.controlledExpressionPlan,
        }),
      ),
    ) as GatewayJsonObject;
    const manifest = createGatewayRouteManifestV1({
      backup: providerRoute("BACKUP_AI", "backup"),
      compatibleOutputSchemaVersions: ["1.0.0"],
      compatiblePromptVersions: [DAILY_PROMPT_VERSION],
      compatibleSafetyPolicyVersions: ["safety-policy-v1"],
      gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
      inputLimits: {
        preparedModelInputBytes: 16 * 1_024,
        providerResponseBytes: 12 * 1_024,
      },
      invocationCostLimitMicrounits: 10_000,
      manifestVersion: "route-ai006-v1",
      outputLimits: { maxOutputTokens: 1_200 },
      priceCatalogVersion: "price-v1",
      primary: providerRoute("PRIMARY_AI", "primary"),
      status: "ACTIVE",
      template: {
        localeCatalogVersion: CONTROLLED_DAILY_TEMPLATE_LOCALE_CATALOG_VERSION,
        maxExecutionMs: 100,
        minimumReserveMs: 1_000,
        rendererId: CONTROLLED_DAILY_TEMPLATE_RENDERER_ID,
        rendererVersion: DAILY_TEMPLATE_RENDERER_VERSION,
        templateCompatibilityVersion: DAILY_TEMPLATE_VERSION,
      },
      workload: "DAILY_EXPRESSION_V1",
    });
    const invocation: GatewayInvocationV1 = {
      acceptedAt: "2026-09-08T01:00:00.000Z",
      gatewayContractVersion: GATEWAY_CONTRACT_VERSION,
      gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
      hardDeadlineAt: "2026-09-08T01:00:08.000Z",
      invocationId: "00000000-0000-4000-8000-000000000611",
      outputSchemaVersion: "1.0.0",
      ownerIntentRef: "00000000-0000-4000-8000-000000000612",
      personalizationLevel: "FULL",
      planContractVersion: "daily-expression-v1",
      planFingerprint: fingerprintGatewayJson(frozenPlan),
      planRef: "synthetic-plan-ai006-v1",
      preparedModelInput,
      promptVersion: DAILY_PROMPT_VERSION,
      routeManifestFingerprint: manifest.fingerprint,
      routeManifestVersion: manifest.manifestVersion,
      safetyPolicyVersion: "safety-policy-v1",
      templateVersion: DAILY_TEMPLATE_VERSION,
      workload: "DAILY_EXPRESSION_V1",
    };
    const renderer = createGatewayControlledDailyTemplateRendererV1();
    const service = new ControlledTemplateGatewayV1({
      candidateValidator: createGatewayStructuredOutputValidatorV1(),
      clock: { now: () => new Date("2026-09-08T01:00:00.100Z") },
      ids: {
        nextAttemptId: () => "00000000-0000-4000-8000-000000000613",
      },
      renderer,
    });

    const result = await service.preflight({
      frozenPlan,
      invocation,
      manifest,
      runtimeProfile: "INTERACTIVE",
    });
    expect(result.status).toBe("CANDIDATE_READY");
    if (result.status !== "CANDIDATE_READY") {
      throw new Error("expected controlled template candidate");
    }
    expect(result.candidate.generationMode).toBe("CONTROLLED_TEMPLATE");
    expect(
      ExpressionPayloadSchema.safeParse(result.candidate.payload).success,
    ).toBe(true);
    expect(result.candidate.payload).toMatchObject({
      optional_task: {
        task_id: derived.ruleFacts.optional_task_plan.task_id,
      },
      primary_action: { action_id: derived.ruleFacts.selected_action_id },
    });
    expect(JSON.stringify(result.candidate.payload)).not.toContain("后台");
    expect(result.candidate.validationReceipt).toMatchObject({
      routeRole: "CONTROLLED_TEMPLATE",
      verdict: "PASS",
    });
    await expect(
      renderer.render({
        frozenPlan,
        invocation,
        route: { ...manifest.template, rendererVersion: "drifted-renderer-v2" },
      }),
    ).rejects.toMatchObject({ code: "TEMPLATE_ROUTE_MISMATCH" });

    const providerRoles: string[] = [];
    const providerGateway: ExpressionGatewayV1 = {
      async invoke(input) {
        providerRoles.push(input.role);
        return {
          failedRole: input.role,
          reasonCode:
            input.role === "PRIMARY_AI"
              ? "PROVIDER_RATE_LIMITED"
              : "PROVIDER_PROTOCOL_INVALID",
          status: "FALLBACK_REQUIRED",
        };
      },
    };
    const breakerValues = new Map<string, unknown>();
    const breaker: GatewayBreakerStateStoreV1 = {
      async compareAndSet(input) {
        const current = breakerValues.get(input.key) as
          { revision: number; routeFingerprint: string } | undefined;
        if (
          (current?.revision ?? null) !== input.expectedRevision ||
          (current?.routeFingerprint ?? null) !== input.expectedRouteFingerprint
        ) {
          return false;
        }
        breakerValues.set(input.key, input.next);
        return true;
      },
      async load(key) {
        return (breakerValues.get(key) ?? null) as Awaited<
          ReturnType<GatewayBreakerStateStoreV1["load"]>
        >;
      },
    };
    const routingEvents: unknown[] = [];
    const orchestrator = new GatewayRouteOrchestratorV1({
      breaker,
      clock: { now: () => new Date("2026-09-08T01:00:00.100Z") },
      gateway: providerGateway,
      guard: {
        async read() {
          return { status: "ALLOWED" };
        },
      },
      telemetry: {
        record(event) {
          routingEvents.push(event);
        },
      },
      template: service,
    });
    const routed = await orchestrator.invoke({
      admission: { status: "ALLOWED" },
      frozenPlan,
      invocation,
      manifest,
      runtimeProfile: "INTERACTIVE",
    });
    expect(routed.status).toBe("CANDIDATE_READY");
    if (routed.status !== "CANDIDATE_READY") {
      throw new Error("expected routed controlled template candidate");
    }
    expect(providerRoles).toEqual(["PRIMARY_AI", "BACKUP_AI"]);
    expect(routed.candidate.generationMode).toBe("CONTROLLED_TEMPLATE");
    expect(routingEvents.at(-1)).toMatchObject({
      outcomeCode: "CANDIDATE",
      reasonCode: "PROVIDER_PATHS_EXHAUSTED",
      role: "CONTROLLED_TEMPLATE",
    });
    const published = assembleGatewayDailyResultV1({
      candidate: routed.candidate,
      generatedAt: new Date("2026-09-08T01:00:00.200Z"),
      inputSnapshotRef: "00000000-0000-4000-8000-000000000614",
      invocation,
      productDate: "2026-09-08",
      resultId: "00000000-0000-4000-8000-000000000615",
      resultVersion: "daily-v1",
      ruleFacts: derived.ruleFacts,
      userRef: "00000000-0000-4000-8000-000000000616",
    });
    expect(published.facts).toEqual(derived.ruleFacts);
    expect(published.provenance).toMatchObject({
      generation_mode: "CONTROLLED_TEMPLATE",
      template_version: DAILY_TEMPLATE_VERSION,
    });
  });
});
