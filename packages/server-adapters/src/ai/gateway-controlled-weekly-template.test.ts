import {
  WEEKLY_PROMPT_VERSION,
  WEEKLY_TEMPLATE_RENDERER_VERSION,
  WEEKLY_TEMPLATE_VERSION,
  buildPreparedWeeklyPromptInputV1,
} from "@daily-energy/prompt-library";
import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  createGatewayRouteManifestV1,
  fingerprintGatewayJson,
  type GatewayInvocationV1,
  type GatewayJsonObject,
  type GatewayProviderRouteV1,
} from "@daily-energy/server-core/ai-gateway";
import {
  assembleGatewayWeeklySummaryV1,
  deriveWeeklyAggregate,
  renderControlledWeeklyExpressionV2,
} from "@daily-energy/server-core/weekly-reflection";
import {
  PublishedWeeklySummarySchema,
  WeeklyExpressionPayloadSchema,
  type WeeklySourceSnapshot,
} from "@daily-energy/shared-schemas";
import { describe, expect, it } from "vitest";

import {
  CONTROLLED_WEEKLY_TEMPLATE_LOCALE_CATALOG_VERSION,
  CONTROLLED_WEEKLY_TEMPLATE_RENDERER_ID,
  WeeklyTemplateAdapterError,
  createGatewayControlledWeeklyTemplateRendererV1,
  parseWeeklyFrozenPlanV1,
  weeklyFrozenPlanToGatewayJson,
} from "./controlled-weekly-template.js";
import {
  createWeeklyOrchestrator,
  createWeeklyTemplateService,
} from "../testing/weekly-gateway-test-support.js";

const DATES = [
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
] as const;

function snapshot(realDays: number): WeeklySourceSnapshot {
  return {
    contract: "weekly-source-snapshot",
    days: DATES.map((productDate, index) =>
      index >= realDays
        ? { product_date: productDate, source_state: "MISSING" as const }
        : {
            checkin: {
              energy: "STEADY" as const,
              mood: index < 3 ? ("LOW" as const) : ("GOOD" as const),
              revision: 1,
              sleep: index % 2 === 0 ? ("OKAY" as const) : ("LOW" as const),
              source_ref: `checkin-source-${index}`,
            },
            helpfulness: {
              rating: "NEUTRAL" as const,
              revision: 1,
              source_ref: `help-source-${index}`,
            },
            light: {
              is_lit: index % 2 === 0,
              source_ref: `light-source-${index}`,
            },
            product_date: productDate,
            source_state: "RECORDED" as const,
            task: {
              revision: 1,
              source_ref: `task-source-${index}`,
              status: "UNMARKED" as const,
            },
          },
    ),
    schema_version: "1.0.0",
    source_fingerprint: `weekly-source-ai011-${realDays}`,
    window_end_date: DATES[6],
    window_id: `weekly-window-ai011-${realDays}`,
    window_rule_version: "window-v1",
    window_start_date: DATES[0],
  };
}

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

function build(realDays: number) {
  const derivation = deriveWeeklyAggregate(snapshot(realDays));
  const plan = derivation.expressionPlan;
  if (plan === undefined) {
    throw new Error("expected a Weekly expression plan");
  }
  const frozen = { aggregate: derivation.aggregate, plan };
  const frozenPlan = weeklyFrozenPlanToGatewayJson(frozen);
  const preparedModelInput = JSON.parse(
    JSON.stringify(
      buildPreparedWeeklyPromptInputV1({
        aggregate: derivation.aggregate,
        personalizationLevel: "REDUCED",
        plan,
      }),
    ),
  ) as GatewayJsonObject;
  const manifest = createGatewayRouteManifestV1({
    backup: providerRoute("BACKUP_AI", "backup"),
    compatibleOutputSchemaVersions: ["1.0.0"],
    compatiblePromptVersions: [WEEKLY_PROMPT_VERSION],
    compatibleSafetyPolicyVersions: ["safety-policy-v1"],
    gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
    inputLimits: {
      preparedModelInputBytes: 24 * 1_024,
      providerResponseBytes: 12 * 1_024,
    },
    invocationCostLimitMicrounits: 10_000,
    manifestVersion: "route-ai011-v1",
    outputLimits: { maxOutputTokens: 1_200 },
    priceCatalogVersion: "price-v1",
    primary: providerRoute("PRIMARY_AI", "primary"),
    status: "ACTIVE",
    template: {
      localeCatalogVersion: CONTROLLED_WEEKLY_TEMPLATE_LOCALE_CATALOG_VERSION,
      maxExecutionMs: 100,
      minimumReserveMs: 4_000,
      rendererId: CONTROLLED_WEEKLY_TEMPLATE_RENDERER_ID,
      rendererVersion: WEEKLY_TEMPLATE_RENDERER_VERSION,
      templateCompatibilityVersion: WEEKLY_TEMPLATE_VERSION,
    },
    workload: "WEEKLY_EXPRESSION_V1",
  });
  const invocation: GatewayInvocationV1 = {
    acceptedAt: "2026-08-25T01:00:00.000Z",
    gatewayContractVersion: GATEWAY_CONTRACT_VERSION,
    gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
    hardDeadlineAt: "2026-08-25T01:00:20.000Z",
    invocationId: "00000000-0000-4000-8000-000000000b11",
    outputSchemaVersion: "1.0.0",
    ownerIntentRef: "00000000-0000-4000-8000-000000000b12",
    personalizationLevel: "REDUCED",
    planContractVersion: "weekly-expression-plan-v1",
    planFingerprint: fingerprintGatewayJson(frozenPlan),
    planRef: "synthetic-plan-ai011-v1",
    preparedModelInput,
    promptVersion: WEEKLY_PROMPT_VERSION,
    routeManifestFingerprint: manifest.fingerprint,
    routeManifestVersion: manifest.manifestVersion,
    safetyPolicyVersion: "safety-policy-v1",
    templateVersion: WEEKLY_TEMPLATE_VERSION,
    workload: "WEEKLY_EXPRESSION_V1",
  };
  return { derivation, frozen, frozenPlan, invocation, manifest, plan };
}

describe("AI-011 Weekly controlled-template Gateway adapter", () => {
  it("renders the frozen aggregate and plan without any provider or network", async () => {
    const { frozenPlan, invocation, manifest, derivation, plan } = build(7);
    const result = await createWeeklyTemplateService().preflight({
      frozenPlan,
      invocation,
      manifest,
      runtimeProfile: "BACKGROUND",
    });
    expect(result.status).toBe("CANDIDATE_READY");
    if (result.status !== "CANDIDATE_READY") {
      throw new Error("expected a controlled template candidate");
    }
    expect(result.candidate.generationMode).toBe("CONTROLLED_TEMPLATE");
    expect(
      WeeklyExpressionPayloadSchema.safeParse(result.candidate.payload).success,
    ).toBe(true);
    expect(result.candidate.payload).toEqual(
      JSON.parse(
        JSON.stringify(
          renderControlledWeeklyExpressionV2(derivation.aggregate, plan),
        ),
      ),
    );
    expect(result.candidate.validationReceipt).toMatchObject({
      routeRole: "CONTROLLED_TEMPLATE",
      verdict: "PASS",
    });
  });

  it("refuses a drifted route, template version or malformed plan", async () => {
    const { frozenPlan, invocation, manifest } = build(5);
    const renderer = createGatewayControlledWeeklyTemplateRendererV1();
    const route = manifest.template;
    for (const drifted of [
      { ...route, rendererId: "controlled-daily-template" },
      { ...route, rendererVersion: "drifted-renderer-v2" },
      { ...route, templateCompatibilityVersion: "weekly-template-v3" },
      { ...route, localeCatalogVersion: "en-v1" },
    ]) {
      await expect(
        renderer.render({ frozenPlan, invocation, route: drifted }),
      ).rejects.toMatchObject({ code: "TEMPLATE_ROUTE_MISMATCH" });
    }
    await expect(
      renderer.render({
        frozenPlan,
        invocation: { ...invocation, templateVersion: "weekly-template-v1" },
        route,
      }),
    ).rejects.toMatchObject({ code: "TEMPLATE_ROUTE_MISMATCH" });
    for (const bad of [
      {},
      { aggregate: {}, plan: {} },
      { ...frozenPlan, extra: true },
      { aggregate: frozenPlan.aggregate },
    ] as GatewayJsonObject[]) {
      await expect(
        renderer.render({ frozenPlan: bad, invocation, route }),
      ).rejects.toBeInstanceOf(WeeklyTemplateAdapterError);
    }
    expect(() => parseWeeklyFrozenPlanV1(null)).toThrow(
      "TEMPLATE_PLAN_INVALID",
    );
  });

  it("falls back to the validated template after both providers fail and publishes it unchanged", async () => {
    const { derivation, frozenPlan, invocation, manifest, plan } = build(7);
    const providerRoles: string[] = [];
    const events: unknown[] = [];
    const routed = await createWeeklyOrchestrator(
      {
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
      },
      events,
    ).invoke({
      admission: { status: "ALLOWED" },
      frozenPlan,
      invocation,
      manifest,
      runtimeProfile: "BACKGROUND",
    });
    expect(routed.status).toBe("CANDIDATE_READY");
    if (routed.status !== "CANDIDATE_READY") {
      throw new Error("expected a routed template candidate");
    }
    expect(providerRoles).toEqual(["PRIMARY_AI", "BACKUP_AI"]);
    expect(routed.candidate.generationMode).toBe("CONTROLLED_TEMPLATE");
    expect(events.at(-1)).toMatchObject({
      outcomeCode: "CANDIDATE",
      reasonCode: "PROVIDER_PATHS_EXHAUSTED",
      role: "CONTROLLED_TEMPLATE",
    });
    const summary = assembleGatewayWeeklySummaryV1({
      aggregate: derivation.aggregate,
      aggregateFactsRef: "00000000-0000-4000-8000-000000000b14",
      candidate: routed.candidate,
      generatedAt: new Date("2026-08-25T01:00:00.200Z"),
      invocation,
      plan,
      summaryId: "00000000-0000-4000-8000-000000000b15",
      summaryRevision: 1,
      windowEndDate: DATES[6],
      windowId: derivation.aggregate.window_id,
      windowStartDate: DATES[0],
    });
    expect(PublishedWeeklySummarySchema.safeParse(summary).success).toBe(true);
    expect(summary.provenance).toMatchObject({
      generation_mode: "CONTROLLED_TEMPLATE",
      template_version: WEEKLY_TEMPLATE_VERSION,
    });
    expect(summary.expression).toEqual(
      renderControlledWeeklyExpressionV2(derivation.aggregate, plan),
    );
  });

  it("never calls a provider when the template preflight cannot be produced", async () => {
    const { frozenPlan, invocation, manifest } = build(5);
    const providerRoles: string[] = [];
    const routed = await createWeeklyOrchestrator(
      {
        async invoke(input) {
          providerRoles.push(input.role);
          throw new Error("provider must not be called");
        },
      },
      [],
    ).invoke({
      admission: { status: "ALLOWED" },
      frozenPlan: { ...frozenPlan, aggregate: {} },
      invocation,
      manifest,
      runtimeProfile: "BACKGROUND",
    });
    expect(routed.status).toBe("TERMINAL_GATEWAY_FAILURE");
    expect(providerRoles).toEqual([]);
  });

  it("renders PARTIAL coverage with honest disclosure and no invented days", async () => {
    const { frozenPlan, invocation, manifest } = build(5);
    const result = await createWeeklyTemplateService().preflight({
      frozenPlan,
      invocation,
      manifest,
      runtimeProfile: "BACKGROUND",
    });
    if (result.status !== "CANDIDATE_READY") {
      throw new Error("expected a controlled template candidate");
    }
    const text = JSON.stringify(result.candidate.payload);
    expect(text).toContain("5 天留下了真实记录");
    expect(text).toContain("2 天没有记录");
    expect(text).not.toContain("source_ref");
    expect(text).not.toContain("note");
  });
});
