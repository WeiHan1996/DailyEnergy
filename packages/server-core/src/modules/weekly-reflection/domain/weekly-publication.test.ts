import { describe, expect, it } from "vitest";

import {
  PublishedWeeklySummarySchema,
  type WeeklySourceSnapshot,
} from "@daily-energy/shared-schemas";

import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  createGatewayValidationReceiptV1,
  fingerprintGatewayJson,
  type GatewayCandidateV1,
  type GatewayInvocationV1,
  type GatewayJsonObject,
} from "../../ai-gateway/public/index.js";
import {
  WeeklyPublicationError,
  assembleGatewayWeeklySummaryV1,
} from "./weekly-publication.js";
import {
  deriveWeeklyAggregate,
  renderControlledWeeklyExpression,
} from "./weekly-aggregate.js";

const WEEKLY_PROMPT = "weekly-expression-zh-cn-v1";
const WEEKLY_TEMPLATE = "weekly-template-v1";
const SAFETY = "safety-policy-v1";
const DATES = [
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
] as const;

function source(): WeeklySourceSnapshot {
  return {
    contract: "weekly-source-snapshot",
    days: DATES.map((productDate, index) => ({
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
      light: { is_lit: index % 2 === 0, source_ref: `light-source-${index}` },
      product_date: productDate,
      source_state: "RECORDED" as const,
      task: {
        revision: 1,
        source_ref: `task-source-${index}`,
        status: "UNMARKED" as const,
      },
    })),
    schema_version: "1.0.0",
    source_fingerprint: "weekly-source-publication-v1",
    window_end_date: DATES[6],
    window_id: "weekly-window-publication-v1",
    window_rule_version: "window-v1",
    window_start_date: DATES[0],
  };
}

const derivation = deriveWeeklyAggregate(source());
const aggregate = derivation.aggregate;
const plan = derivation.expressionPlan!;
const expression = renderControlledWeeklyExpression(aggregate, plan);

function invocation(
  over: Partial<GatewayInvocationV1> = {},
): GatewayInvocationV1 {
  const frozenPlan = JSON.parse(JSON.stringify(plan)) as GatewayJsonObject;
  return {
    acceptedAt: "2026-08-25T01:00:00.000Z",
    gatewayContractVersion: GATEWAY_CONTRACT_VERSION,
    gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
    hardDeadlineAt: "2026-08-25T01:00:20.000Z",
    invocationId: "00000000-0000-4000-8000-000000000a11",
    outputSchemaVersion: "1.0.0",
    ownerIntentRef: "00000000-0000-4000-8000-000000000a12",
    personalizationLevel: "REDUCED",
    planContractVersion: "weekly-expression-plan-v1",
    planFingerprint: fingerprintGatewayJson(frozenPlan),
    planRef: "synthetic-weekly-plan-v1",
    preparedModelInput: { synthetic: "prepared" },
    promptVersion: WEEKLY_PROMPT,
    routeManifestFingerprint: "a".repeat(64),
    routeManifestVersion: "route-weekly-v1",
    safetyPolicyVersion: SAFETY,
    templateVersion: WEEKLY_TEMPLATE,
    workload: "WEEKLY_EXPRESSION_V1",
    ...over,
  };
}

function candidate(
  mode: "BACKUP_AI" | "CONTROLLED_TEMPLATE" | "PRIMARY_AI",
  over: { invocation?: GatewayInvocationV1; payload?: GatewayJsonObject } = {},
): GatewayCandidateV1 {
  const call = over.invocation ?? invocation();
  const payload = (over.payload ??
    JSON.parse(JSON.stringify(expression))) as GatewayJsonObject;
  const payloadFingerprint = fingerprintGatewayJson(payload);
  const base = {
    attemptId: "00000000-0000-4000-8000-000000000a13",
    payload,
    payloadFingerprint,
    validationReceipt: createGatewayValidationReceiptV1({
      outputSchemaVersion: call.outputSchemaVersion,
      payloadFingerprint,
      planFingerprint: call.planFingerprint,
      promptVersion: call.promptVersion,
      routeRole: mode,
      safetyPolicyVersion: call.safetyPolicyVersion,
      validatorVersion: "structured-output-validator-v1",
      workload: call.workload,
    }),
    workload: call.workload,
  };
  return mode === "CONTROLLED_TEMPLATE"
    ? {
        ...base,
        generationMode: mode,
        provenance: { templateVersion: WEEKLY_TEMPLATE },
      }
    : {
        ...base,
        generationMode: mode,
        provenance: {
          model: "model-synthetic-v1",
          promptVersion: WEEKLY_PROMPT,
          provider: "provider-synthetic",
        },
      };
}

function assemble(
  value: GatewayCandidateV1,
  over: Partial<Parameters<typeof assembleGatewayWeeklySummaryV1>[0]> = {},
) {
  return assembleGatewayWeeklySummaryV1({
    aggregate,
    aggregateFactsRef: "snapshot-ref-1",
    candidate: value,
    generatedAt: new Date("2026-08-25T01:00:05.000Z"),
    invocation: invocation(),
    plan,
    summaryId: "summary-1",
    summaryRevision: 1,
    windowEndDate: DATES[6],
    windowId: aggregate.window_id,
    windowStartDate: DATES[0],
    ...over,
  });
}

describe("AI-011 Weekly publication assembly", () => {
  it.each(["PRIMARY_AI", "BACKUP_AI"] as const)(
    "publishes a validated %s candidate with its model provenance",
    (mode) => {
      const summary = assemble(candidate(mode));
      expect(PublishedWeeklySummarySchema.safeParse(summary).success).toBe(
        true,
      );
      expect(summary.provenance).toMatchObject({
        generation_mode: mode,
        model: "model-synthetic-v1",
        prompt_version: WEEKLY_PROMPT,
        provider: "provider-synthetic",
        safety_policy_version: SAFETY,
      });
      expect(summary.provenance.template_version).toBeUndefined();
      expect(summary.source_dependencies).toEqual([]);
    },
  );

  it("publishes the template fallback through the same path with template provenance", () => {
    const summary = assemble(candidate("CONTROLLED_TEMPLATE"));
    expect(summary.provenance).toMatchObject({
      generation_mode: "CONTROLLED_TEMPLATE",
      template_version: WEEKLY_TEMPLATE,
    });
    expect(summary.provenance.model).toBeUndefined();
    expect(summary.expression).toEqual(expression);
  });

  it("binds the published facts to the frozen aggregate, never to the candidate", () => {
    const summary = assemble(candidate("PRIMARY_AI"));
    expect(summary.source_fingerprint).toBe(aggregate.source_fingerprint);
    expect(summary.expression_plan).toEqual(plan);
    expect(summary.window_id).toBe(aggregate.window_id);
    expect(summary.aggregate_facts_ref).toBe("snapshot-ref-1");
  });

  it("links a revision to the previous summary", () => {
    const summary = assemble(candidate("PRIMARY_AI"), {
      previousSummaryId: "summary-0",
      summaryRevision: 2,
    });
    expect(summary).toMatchObject({
      summary_revision: 2,
      supersedes_summary_id: "summary-0",
    });
  });

  it("rejects a payload whose fingerprint was altered after validation", () => {
    const tampered = {
      ...candidate("PRIMARY_AI"),
      payloadFingerprint: "b".repeat(64),
    } as GatewayCandidateV1;
    expect(() => assemble(tampered)).toThrow(WeeklyPublicationError);
    expect(() => assemble(tampered)).toThrow(
      "WEEKLY_CANDIDATE_BINDING_INVALID",
    );
  });

  it("rejects a Daily-workload invocation, a drifted prompt or template version", () => {
    // The Gateway invocation validator already refuses a Daily workload with
    // Weekly versions; the explicit workload guard in the assembler is
    // defence in depth and is not independently reachable through this path.
    expect(() =>
      assemble(candidate("PRIMARY_AI"), {
        invocation: invocation({ workload: "DAILY_EXPRESSION_V1" }),
      }),
    ).toThrow("WEEKLY_CANDIDATE_BINDING_INVALID");
    expect(() =>
      assemble(candidate("PRIMARY_AI"), {
        invocation: invocation({ promptVersion: "weekly-expression-zh-cn-v2" }),
      }),
    ).toThrow(/WEEKLY_CANDIDATE_(BINDING|RECEIPT)_INVALID/u);
    expect(() =>
      assemble(candidate("CONTROLLED_TEMPLATE"), {
        invocation: invocation({ templateVersion: "weekly-template-v2" }),
      }),
    ).toThrow("WEEKLY_CANDIDATE_BINDING_INVALID");
  });

  it("rejects a receipt issued for another plan, role or payload", () => {
    const other = invocation({ planFingerprint: "c".repeat(64) });
    expect(() =>
      assemble(candidate("PRIMARY_AI", { invocation: other })),
    ).toThrow("WEEKLY_CANDIDATE_RECEIPT_INVALID");
    const wrongRole = {
      ...candidate("PRIMARY_AI"),
      generationMode: "BACKUP_AI",
    } as GatewayCandidateV1;
    expect(() => assemble(wrongRole)).toThrow(
      "WEEKLY_CANDIDATE_RECEIPT_INVALID",
    );
  });

  it("rejects a candidate that is not a valid Weekly expression", () => {
    const broken = candidate("PRIMARY_AI", {
      payload: { title: "只有标题" } as GatewayJsonObject,
    });
    expect(() => assemble(broken)).toThrow("WEEKLY_CANDIDATE_BINDING_INVALID");
  });

  it("rejects an aggregate or plan that does not bind to the window", () => {
    expect(() =>
      assemble(candidate("PRIMARY_AI"), { windowId: "another-window" }),
    ).toThrow("WEEKLY_PLAN_BINDING_INVALID");
    expect(() =>
      assemble(candidate("PRIMARY_AI"), { plan: { not: "a plan" } }),
    ).toThrow("WEEKLY_PLAN_BINDING_INVALID");
  });

  it("records only owner-scoped memory dependencies, sorted, never duplicated", () => {
    const summary = assemble(candidate("PRIMARY_AI"), {
      memoryDependencies: [
        { purpose: "WEEKLY_SUMMARY", sourceRef: "src-b", sourceRevision: 3 },
        { purpose: "WEEKLY_SUMMARY", sourceRef: "src-a", sourceRevision: 1 },
      ],
    });
    expect(summary.source_dependencies.map((item) => item.source_ref)).toEqual([
      "src-a",
      "src-b",
    ]);
    expect(() =>
      assemble(candidate("PRIMARY_AI"), {
        memoryDependencies: [
          { purpose: "WEEKLY_SUMMARY", sourceRef: "src-a", sourceRevision: 1 },
          { purpose: "WEEKLY_SUMMARY", sourceRef: "src-a", sourceRevision: 2 },
        ],
      }),
    ).toThrow("WEEKLY_SOURCE_DEPENDENCY_INVALID");
    expect(() =>
      assemble(candidate("PRIMARY_AI"), {
        memoryDependencies: [
          { purpose: "WEEKLY_SUMMARY", sourceRef: "src-a", sourceRevision: 0 },
        ],
      }),
    ).toThrow("WEEKLY_SOURCE_DEPENDENCY_INVALID");
  });

  it("is deterministic for the same candidate and time", () => {
    expect(assemble(candidate("PRIMARY_AI"))).toEqual(
      assemble(candidate("PRIMARY_AI")),
    );
  });
});
