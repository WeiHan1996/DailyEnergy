import { describe, expect, it } from "vitest";

import {
  ControlledExpressionPlanV1Schema,
  DailyExpressionRequiredSectionValues,
  DailyProhibitedClaimClassValues,
} from "@daily-energy/shared-schemas";

import {
  DAILY_MEMORY_PROMPT_PACKAGE_V2,
  buildPreparedDailyMemoryPromptInputV2,
  compileDailyMemoryPromptRequestV2,
  renderControlledDailyMemoryV2,
  validateDailyMemoryOutputV2,
} from "./daily-memory-v2.js";
import { buildPreparedDailyPromptInputV1 } from "./prepared-prompt-input.js";
import { renderControlledDailyTemplateV1 } from "./render-daily-template.js";
import { DAILY_TEMPLATE_REGISTRY_V1 } from "./daily-template-registry.js";

function prepared(memory = true) {
  const plan = dailyPlan();
  const baseDaily = buildPreparedDailyPromptInputV1({
    personalizationLevel: "FULL",
    plan,
  });
  const projection = {
    contract: "memory-context-projection-v1" as const,
    workload: "DAILY_EXPRESSION_V2" as const,
    product_date: "2026-09-20",
    memory_facts: memory
      ? [
          {
            fact_id: "memory.fact.synthetic",
            fact_kind: "IMPORTANT_MATTER" as const,
            temporal_relation: "TARGET_TODAY" as const,
            allowed_claim: "USER_SAVED_MATTER" as const,
            allowed_date_literals: [] as [],
            allowed_numeric_literals: [] as [],
            prohibited_inferences: [
              "CAUSE" as const,
              "OUTCOME" as const,
              "PROFESSIONAL_CONCLUSION" as const,
              "RELATIONSHIP_OR_IDENTITY" as const,
            ] as const,
          },
        ]
      : [],
    segment_contracts: memory
      ? [
          {
            segment_path: "expression.state_response" as const,
            exact_memory_fact_refs: ["memory.fact.synthetic"],
            memory_mention_allowed: true,
            fallback_path: "expression.state_response" as const,
          },
        ]
      : [],
    personalization_expectation: memory
      ? ("FULL" as const)
      : ("REDUCED" as const),
    provider_projection_bytes: 0,
  };
  let bytes = 0;
  for (let index = 0; index < 4; index += 1) {
    bytes = Buffer.byteLength(
      JSON.stringify({ ...projection, provider_projection_bytes: bytes }),
    );
  }
  return {
    plan,
    prepared: buildPreparedDailyMemoryPromptInputV2({
      baseDaily,
      memoryContext: { ...projection, provider_projection_bytes: bytes },
    }),
  };
}

describe("daily-expression-zh-cn-v2 staged memory contract", () => {
  it("pins a STAGED package with no external provider calls", () => {
    expect(DAILY_MEMORY_PROMPT_PACKAGE_V2).toMatchObject({
      promptVersion: "daily-expression-zh-cn-v2",
      status: "STAGED",
      externalProviderCallsAllowed: false,
    });
    expect(DAILY_MEMORY_PROMPT_PACKAGE_V2.packageFingerprint).toMatch(
      /^31adaeebbf49b9d9808b7e9edaae870893a57d98fcb00ac153212c5bd46e5a43$/u,
    );
  });

  it("renders one exact state_response binding with a complete fallback", () => {
    const input = prepared();
    const base = renderControlledDailyTemplateV1(input.plan).expression;
    const output = renderControlledDailyMemoryV2({
      baseExpression: base,
      context: input.prepared.memory_context,
    });
    expect(output.memory_bindings).toEqual([
      {
        segment_path: "expression.state_response",
        exact_memory_fact_refs: ["memory.fact.synthetic"],
      },
    ]);
    expect(output.privacy_fallbacks["expression.state_response"]).toBe(
      base.state_response,
    );
    expect(JSON.stringify(input.prepared.memory_context)).not.toMatch(
      /source_ref|owner_ref|title/u,
    );
    expect(
      validateDailyMemoryOutputV2({
        candidate: output,
        prepared: input.prepared,
      }),
    ).toEqual(output);
    const compiled = compileDailyMemoryPromptRequestV2(input.prepared);
    expect(compiled.outputSchema.$id).toContain("daily-expression-payload-v2");
    expect(compiled.requestFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(compiled.inputJson).not.toMatch(/source_ref|owner_ref|title/u);
  });

  it("keeps no-memory output complete and rejects a substituted fact ref", () => {
    const empty = prepared(false);
    const base = renderControlledDailyTemplateV1(empty.plan).expression;
    expect(
      renderControlledDailyMemoryV2({
        baseExpression: base,
        context: empty.prepared.memory_context,
      }),
    ).toMatchObject({ memory_bindings: [], privacy_fallbacks: {} });

    const withMemory = prepared();
    const output = renderControlledDailyMemoryV2({
      baseExpression: base,
      context: withMemory.prepared.memory_context,
    });
    expect(() =>
      validateDailyMemoryOutputV2({
        candidate: {
          ...output,
          memory_bindings: [
            {
              segment_path: "expression.state_response",
              exact_memory_fact_refs: ["memory.fact.substituted"],
            },
          ],
        },
        prepared: withMemory.prepared,
      }),
    ).toThrow("DAILY_MEMORY_OUTPUT_BINDING_INVALID");
    expect(() =>
      validateDailyMemoryOutputV2({
        candidate: { ...output, privacy_fallbacks: {} },
        prepared: withMemory.prepared,
      }),
    ).toThrow();
  });
});

function dailyPlan() {
  const action =
    DAILY_TEMPLATE_REGISTRY_V1.actionCopyById["action.prepare-one-step.v1"]!;
  return ControlledExpressionPlanV1Schema.parse({
    allowed_state_assertion_basis_codes: ["checkin.mood.steady.v1"],
    assertion_mode: "STANDARD",
    effective_expression_constraints: {
      dimension_explanation_mode: "BAND_GUIDANCE",
      humor_ceiling: "LIGHT",
      opening_requirement: "FACT_FIRST",
      pressure_ceiling: "LIGHT",
    },
    expression_contract_version: "daily-expression-v1",
    greeting_context: { relationship_mode: "GENERIC" },
    known_checkin_fields: ["mood", "energy", "sleep"],
    output_schema_version: "1.0.0",
    prohibited_claim_classes: [...DailyProhibitedClaimClassValues],
    requested_expression_style: "BALANCED",
    required_sections: [...DailyExpressionRequiredSectionValues],
    resolved_context_slots: [],
    result_version: "daily-v1",
    semantic_slots: {
      dimensions: [
        { band: "STEADY", id: "pace" },
        { band: "STEADY", id: "action" },
        { band: "STEADY", id: "connection" },
        { band: "STEADY", id: "resources" },
        { band: "HIGH", id: "recovery" },
      ],
      explanation_basis_codes: [
        "checkin.mood.steady.v1",
        "checkin.energy.steady.v1",
        "checkin.sleep.okay.v1",
        "dimension.action.steady.v1",
        "dimension.recovery.high.v1",
      ],
      focus_dimension_id: "action",
      optional_task: {
        effort: "VERY_LIGHT",
        kind: action.kind,
        task_id: action.taskId,
        timebox_minutes: 5,
      },
      overall: { band: "STEADY", label_token: "KEEP_IT_STEADY" },
      rituals: [
        {
          kind: "COLOR",
          ritual_id: "ritual.color.sage-green.v1",
          value: "SAGE_GREEN",
        },
      ],
      selected_action: {
        action_id: action.actionId,
        basis_refs: ["dimension.action.steady.v1"],
        constraint_token: action.constraintToken,
        effort: action.effort,
        kind: action.kind,
        target_scope: action.targetScope,
        timebox_minutes: action.timeboxMinutes,
      },
      supporting_dimension_id: "recovery",
    },
    source_dependency_requirements: [],
    template_compatibility_version: "daily-template-v1",
    template_variant_id: "template.support-then-focus.v1",
    uncertain_checkin_fields: [],
  });
}
