import * as z from "zod";

import {
  ActionKindSchema,
  BandSchema,
  EffortSchema,
  EnergySchema,
  ExpressionStyleSchema,
  GenerationModeSchema,
  MoodSchema,
  OpaqueIdSchema,
  PersonalizationLevelSchema,
  PositiveRevisionSchema,
  ProductDateSchema,
  RelationshipStageSchema,
  Rfc3339TimestampSchema,
  SemverSchema,
  SleepSchema,
  SourcePathSchema,
  StableDimensionIdSchema,
  StableDimensionIdValues,
  VersionTokenSchema,
  addCustomIssue,
  countDisplayCharacters,
  generatedTextSchema,
} from "./common.js";
import {
  OptionalTaskExpressionSchema,
  PrimaryActionExpressionSchema,
  isExactDimensionSet,
} from "./client-daily-content.js";

export const OverallLabelTokenValues = [
  "TAKE_IT_GENTLY",
  "KEEP_IT_STEADY",
  "ROOM_TO_MOVE",
] as const;
export const OverallLabelTokenSchema = z.enum(OverallLabelTokenValues);
export type OverallLabelToken = z.infer<typeof OverallLabelTokenSchema>;

const EXPECTED_LABEL_BY_BAND = {
  LOW: "TAKE_IT_GENTLY",
  STEADY: "KEEP_IT_STEADY",
  HIGH: "ROOM_TO_MOVE",
} as const;

const ScoredBandSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    band: BandSchema,
    label_token: OverallLabelTokenSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.label_token !== EXPECTED_LABEL_BY_BAND[value.band]) {
      addCustomIssue(
        context,
        ["label_token"],
        `must be ${EXPECTED_LABEL_BY_BAND[value.band]} for ${value.band}`,
      );
    }
  });

const PermittedContextSchema = z
  .object({
    source_ref: OpaqueIdSchema,
    source_type: z.enum([
      "CHECKIN",
      "RECENT_RECORD",
      "RELATIONSHIP",
      "IMPORTANT_MATTER",
    ]),
    source_revision: PositiveRevisionSchema,
    purpose: VersionTokenSchema,
    valid_for_product_date: ProductDateSchema,
  })
  .strict();

export const GenerationInputSnapshotSchema = z
  .object({
    snapshot_version: VersionTokenSchema,
    product_date: ProductDateSchema,
    result_version: VersionTokenSchema,
    user_ref: OpaqueIdSchema.optional(),
    checkin: z
      .object({
        revision: PositiveRevisionSchema,
        mood: MoodSchema,
        energy: EnergySchema,
        sleep: SleepSchema,
      })
      .strict(),
    profile: z
      .object({
        revision: PositiveRevisionSchema,
        preferred_name: generatedTextSchema(1, 20).optional(),
        expression_style: VersionTokenSchema,
      })
      .strict(),
    relationship: z
      .object({
        stage: RelationshipStageSchema,
        encounter_day_count: z.number().int().nonnegative(),
      })
      .strict(),
    permitted_context: z.array(PermittedContextSchema).max(8),
    product: z
      .object({
        locale: z.literal("zh-CN"),
        personality_version: VersionTokenSchema,
        content_policy_version: VersionTokenSchema,
        experiment_version: VersionTokenSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    value.permitted_context.forEach((item, index) => {
      if (item.valid_for_product_date !== value.product_date) {
        addCustomIssue(
          context,
          ["permitted_context", index, "valid_for_product_date"],
          "must match the snapshot product_date",
        );
      }
    });
  });
export type GenerationInputSnapshot = z.infer<
  typeof GenerationInputSnapshotSchema
>;

const DimensionFactSchema = ScoredBandSchema.safeExtend({
  id: StableDimensionIdSchema,
}).strict();

const ExplanationBasisSchema = z
  .object({
    type: z.enum([
      "CHECKIN_SIGNAL",
      "DIMENSION_SIGNAL",
      "PROFILE_SIGNAL",
      "RELATIONSHIP_SIGNAL",
      "CONTEXT_SIGNAL",
    ]),
    code: VersionTokenSchema,
  })
  .strict();

const ActionCandidateSchema = z
  .object({
    action_id: OpaqueIdSchema,
    kind: ActionKindSchema,
    target_scope: VersionTokenSchema,
    effort: EffortSchema,
    timebox_minutes: z.number().int().min(5).max(30).optional(),
    constraint_token: VersionTokenSchema.optional(),
    basis_refs: z.array(VersionTokenSchema).max(5).optional(),
  })
  .strict();

const OptionalTaskPlanSchema = z
  .object({
    task_id: OpaqueIdSchema,
    kind: ActionKindSchema,
    effort: EffortSchema,
    timebox_minutes: z.number().int().min(5).max(30).optional(),
  })
  .strict();

const ColorRitualFactSchema = z
  .object({
    ritual_id: OpaqueIdSchema,
    kind: z.literal("COLOR"),
    value: VersionTokenSchema,
  })
  .strict();

const NumberRitualFactSchema = z
  .object({
    ritual_id: OpaqueIdSchema,
    kind: z.literal("NUMBER"),
    value: z.number().int().min(1).max(9),
  })
  .strict();

export const RitualFactSchema = z.discriminatedUnion("kind", [
  ColorRitualFactSchema,
  NumberRitualFactSchema,
]);
export type RitualFact = z.infer<typeof RitualFactSchema>;

export const RuleFactsSchema = z
  .object({
    overall: ScoredBandSchema,
    dimensions: z.array(DimensionFactSchema).length(5),
    focus_dimension_id: StableDimensionIdSchema,
    supporting_dimension_id: StableDimensionIdSchema.optional(),
    care_dimension_id: StableDimensionIdSchema.optional(),
    display_order: z.array(StableDimensionIdSchema).length(5),
    explanation_basis: z.array(ExplanationBasisSchema).max(5),
    action_candidates: z.array(ActionCandidateSchema).min(1).max(3),
    selected_action_id: OpaqueIdSchema,
    optional_task_plan: OptionalTaskPlanSchema,
    ritual_facts: z.array(RitualFactSchema).max(2),
  })
  .strict()
  .superRefine((value, context) => {
    const dimensionIds = value.dimensions.map((item) => item.id);
    if (
      !StableDimensionIdValues.every((id, index) => dimensionIds[index] === id)
    ) {
      addCustomIssue(
        context,
        ["dimensions"],
        "must contain the five dimensions once in canonical order",
      );
    }
    if (!isExactDimensionSet(value.display_order)) {
      addCustomIssue(
        context,
        ["display_order"],
        "must be a unique permutation of all five dimensions",
      );
    }
    if (value.display_order[0] !== value.focus_dimension_id) {
      addCustomIssue(
        context,
        ["display_order", 0],
        "must equal focus_dimension_id",
      );
    }

    const actionIds = value.action_candidates.map((item) => item.action_id);
    if (new Set(actionIds).size !== actionIds.length) {
      addCustomIssue(
        context,
        ["action_candidates"],
        "action_id values must be unique",
      );
    }
    if (!actionIds.includes(value.selected_action_id)) {
      addCustomIssue(
        context,
        ["selected_action_id"],
        "must reference an action candidate",
      );
    }

    const ritualIds = value.ritual_facts.map((item) => item.ritual_id);
    const ritualKinds = value.ritual_facts.map((item) => item.kind);
    if (new Set(ritualIds).size !== ritualIds.length) {
      addCustomIssue(
        context,
        ["ritual_facts"],
        "ritual_id values must be unique",
      );
    }
    if (new Set(ritualKinds).size !== ritualKinds.length) {
      addCustomIssue(context, ["ritual_facts"], "ritual kinds must be unique");
    }
  });
export type RuleFacts = z.infer<typeof RuleFactsSchema>;

export const DailyExpressionRequiredSectionValues = [
  "greeting",
  "state_response",
  "overall_summary",
  "core_tip",
  "explanation_paragraphs",
  "dimension_explanations",
  "primary_action",
  "optional_task",
  "ritual_notes",
  "closing",
] as const;

export const DailyProhibitedClaimClassValues = [
  "FUTURE_PREDICTION",
  "DIAGNOSIS_OR_TREATMENT",
  "FINANCIAL_OR_LEGAL_ADVICE",
  "OTHER_PERSON_MIND_OR_RELATIONSHIP_OUTCOME",
  "RESULT_GUARANTEE",
  "RITUAL_CAUSALITY_OR_GAMBLING",
  "TASK_PUNISHMENT_OR_SHAME",
  "EXCLUSIVE_DEPENDENCY_OR_FABRICATED_INTIMACY",
  "FABRICATED_MEMORY_OR_REAL_WORLD_EXPERIENCE",
] as const;

const CheckinFieldSchema = z.enum(["mood", "energy", "sleep"]);
const AssertionModeSchema = z.enum([
  "LOW_ASSERTION",
  "PARTIAL_ASSERTION",
  "STANDARD",
]);
const TemplateVariantIdSchema = z.enum([
  "template.focus-first.v1",
  "template.care-then-step.v1",
  "template.support-then-focus.v1",
]);

export const ControlledExpressionPlanV1Schema = z
  .object({
    expression_contract_version: z.literal("daily-expression-v1"),
    output_schema_version: z.literal("1.0.0"),
    template_compatibility_version: z.literal("daily-template-v1"),
    result_version: z.literal("daily-v1"),
    template_variant_id: TemplateVariantIdSchema,
    assertion_mode: AssertionModeSchema,
    required_sections: z.tuple([
      z.literal("greeting"),
      z.literal("state_response"),
      z.literal("overall_summary"),
      z.literal("core_tip"),
      z.literal("explanation_paragraphs"),
      z.literal("dimension_explanations"),
      z.literal("primary_action"),
      z.literal("optional_task"),
      z.literal("ritual_notes"),
      z.literal("closing"),
    ]),
    semantic_slots: z
      .object({
        overall: z
          .object({
            band: BandSchema,
            label_token: OverallLabelTokenSchema,
          })
          .strict(),
        dimensions: z
          .array(
            z
              .object({ id: StableDimensionIdSchema, band: BandSchema })
              .strict(),
          )
          .length(5),
        focus_dimension_id: StableDimensionIdSchema,
        supporting_dimension_id: StableDimensionIdSchema.optional(),
        care_dimension_id: StableDimensionIdSchema.optional(),
        selected_action: ActionCandidateSchema,
        optional_task: OptionalTaskPlanSchema,
        rituals: z.array(RitualFactSchema).max(2),
        explanation_basis_codes: z.array(VersionTokenSchema).min(3).max(5),
      })
      .strict(),
    known_checkin_fields: z.array(CheckinFieldSchema).max(3),
    uncertain_checkin_fields: z.array(CheckinFieldSchema).max(3),
    allowed_state_assertion_basis_codes: z.array(VersionTokenSchema).max(5),
    requested_expression_style: ExpressionStyleSchema,
    effective_expression_constraints: z
      .object({
        humor_ceiling: z.enum(["NONE", "LIGHT"]),
        pressure_ceiling: z.enum(["VERY_LOW", "LIGHT"]),
        opening_requirement: z.enum([
          "UNCERTAINTY_FIRST",
          "CARE_FIRST",
          "FACT_FIRST",
        ]),
        dimension_explanation_mode: z.enum([
          "NON_ASSERTIVE",
          "KNOWN_SIGNALS_ONLY",
          "BAND_GUIDANCE",
        ]),
      })
      .strict(),
    greeting_context: z
      .object({
        preferred_name: generatedTextSchema(1, 20).optional(),
        relationship_mode: z.literal("GENERIC"),
      })
      .strict(),
    resolved_context_slots: z.tuple([]),
    source_dependency_requirements: z.tuple([]),
    prohibited_claim_classes: z.tuple([
      z.literal("FUTURE_PREDICTION"),
      z.literal("DIAGNOSIS_OR_TREATMENT"),
      z.literal("FINANCIAL_OR_LEGAL_ADVICE"),
      z.literal("OTHER_PERSON_MIND_OR_RELATIONSHIP_OUTCOME"),
      z.literal("RESULT_GUARANTEE"),
      z.literal("RITUAL_CAUSALITY_OR_GAMBLING"),
      z.literal("TASK_PUNISHMENT_OR_SHAME"),
      z.literal("EXCLUSIVE_DEPENDENCY_OR_FABRICATED_INTIMACY"),
      z.literal("FABRICATED_MEMORY_OR_REAL_WORLD_EXPERIENCE"),
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    const slots = value.semantic_slots;
    if (
      slots.overall.label_token !== EXPECTED_LABEL_BY_BAND[slots.overall.band]
    ) {
      addCustomIssue(
        context,
        ["semantic_slots", "overall", "label_token"],
        `must be ${EXPECTED_LABEL_BY_BAND[slots.overall.band]} for ${slots.overall.band}`,
      );
    }
    const dimensionIds = slots.dimensions.map(({ id }) => id);
    if (
      !StableDimensionIdValues.every((id, index) => dimensionIds[index] === id)
    ) {
      addCustomIssue(
        context,
        ["semantic_slots", "dimensions"],
        "must contain the five dimensions once in canonical order",
      );
    }
    if (
      slots.care_dimension_id !== undefined &&
      slots.care_dimension_id !== slots.focus_dimension_id
    ) {
      addCustomIssue(
        context,
        ["semantic_slots", "care_dimension_id"],
        "must equal focus_dimension_id",
      );
    }
    if (
      slots.supporting_dimension_id !== undefined &&
      slots.supporting_dimension_id === slots.focus_dimension_id
    ) {
      addCustomIssue(
        context,
        ["semantic_slots", "supporting_dimension_id"],
        "must differ from focus_dimension_id",
      );
    }
    if (slots.optional_task.kind !== slots.selected_action.kind) {
      addCustomIssue(
        context,
        ["semantic_slots", "optional_task", "kind"],
        "must match selected_action.kind",
      );
    }
    const ritualIds = slots.rituals.map(({ ritual_id }) => ritual_id);
    const ritualKinds = slots.rituals.map(({ kind }) => kind);
    if (
      new Set(ritualIds).size !== ritualIds.length ||
      new Set(ritualKinds).size !== ritualKinds.length
    ) {
      addCustomIssue(
        context,
        ["semantic_slots", "rituals"],
        "ritual ids and kinds must be unique",
      );
    }

    const known = value.known_checkin_fields;
    const uncertain = value.uncertain_checkin_fields;
    const partition = [...known, ...uncertain];
    if (
      new Set(known).size !== known.length ||
      new Set(uncertain).size !== uncertain.length ||
      new Set(partition).size !== 3 ||
      !["mood", "energy", "sleep"].every((field) =>
        partition.includes(field as (typeof partition)[number]),
      )
    ) {
      addCustomIssue(
        context,
        ["known_checkin_fields"],
        "known and uncertain fields must partition mood, energy, and sleep",
      );
    }
    const expectedAssertionMode =
      uncertain.length === 3
        ? "LOW_ASSERTION"
        : uncertain.length > 0
          ? "PARTIAL_ASSERTION"
          : "STANDARD";
    if (value.assertion_mode !== expectedAssertionMode) {
      addCustomIssue(
        context,
        ["assertion_mode"],
        `must be ${expectedAssertionMode} for the check-in field partition`,
      );
    }
    if (
      value.assertion_mode === "LOW_ASSERTION" &&
      value.allowed_state_assertion_basis_codes.length !== 0
    ) {
      addCustomIssue(
        context,
        ["allowed_state_assertion_basis_codes"],
        "must be empty for LOW_ASSERTION",
      );
    }
    if (
      value.assertion_mode === "PARTIAL_ASSERTION" &&
      value.allowed_state_assertion_basis_codes.some(
        (code) => !known.some((field) => code.startsWith(`checkin.${field}.`)),
      )
    ) {
      addCustomIssue(
        context,
        ["allowed_state_assertion_basis_codes"],
        "must only reference known check-in fields for PARTIAL_ASSERTION",
      );
    }

    const constrained =
      slots.care_dimension_id !== undefined ||
      value.assertion_mode === "LOW_ASSERTION";
    const constraints = value.effective_expression_constraints;
    if (
      constraints.humor_ceiling !== (constrained ? "NONE" : "LIGHT") ||
      constraints.pressure_ceiling !== (constrained ? "VERY_LOW" : "LIGHT")
    ) {
      addCustomIssue(
        context,
        ["effective_expression_constraints"],
        "humor and pressure ceilings must match care and assertion mode",
      );
    }
    const expectedOpening =
      slots.care_dimension_id !== undefined
        ? "CARE_FIRST"
        : value.assertion_mode === "STANDARD"
          ? "FACT_FIRST"
          : "UNCERTAINTY_FIRST";
    if (constraints.opening_requirement !== expectedOpening) {
      addCustomIssue(
        context,
        ["effective_expression_constraints", "opening_requirement"],
        `must be ${expectedOpening}`,
      );
    }
    const expectedDimensionMode =
      value.assertion_mode === "LOW_ASSERTION"
        ? "NON_ASSERTIVE"
        : value.assertion_mode === "PARTIAL_ASSERTION"
          ? "KNOWN_SIGNALS_ONLY"
          : "BAND_GUIDANCE";
    if (constraints.dimension_explanation_mode !== expectedDimensionMode) {
      addCustomIssue(
        context,
        ["effective_expression_constraints", "dimension_explanation_mode"],
        `must be ${expectedDimensionMode}`,
      );
    }
    if (
      (value.template_variant_id === "template.care-then-step.v1" &&
        slots.care_dimension_id === undefined) ||
      (value.template_variant_id === "template.support-then-focus.v1" &&
        (slots.supporting_dimension_id === undefined ||
          slots.care_dimension_id !== undefined))
    ) {
      addCustomIssue(
        context,
        ["template_variant_id"],
        "is not eligible for the plan's care/supporting roles",
      );
    }
  });
export type ControlledExpressionPlanV1 = z.infer<
  typeof ControlledExpressionPlanV1Schema
>;

const DimensionExplanationsSchema = z
  .object({
    pace: generatedTextSchema(12, 35),
    action: generatedTextSchema(12, 35),
    connection: generatedTextSchema(12, 35),
    resources: generatedTextSchema(12, 35),
    recovery: generatedTextSchema(12, 35),
  })
  .strict();

export const ExpressionPayloadSchema = z
  .object({
    greeting: generatedTextSchema(8, 24),
    state_response: generatedTextSchema(20, 60),
    overall_summary: generatedTextSchema(12, 30),
    core_tip: generatedTextSchema(20, 50),
    explanation_paragraphs: z.array(generatedTextSchema(1, 140)).min(1).max(2),
    dimension_explanations: DimensionExplanationsSchema,
    primary_action: PrimaryActionExpressionSchema,
    optional_task: OptionalTaskExpressionSchema,
    ritual_notes: z.record(OpaqueIdSchema, generatedTextSchema(8, 24)),
    closing: generatedTextSchema(8, 30),
  })
  .strict()
  .superRefine((value, context) => {
    const paragraphsLength = value.explanation_paragraphs.reduce(
      (total, item) => total + countDisplayCharacters(item),
      0,
    );
    if (paragraphsLength < 60 || paragraphsLength > 140) {
      addCustomIssue(
        context,
        ["explanation_paragraphs"],
        "must contain 60 to 140 display characters in total",
      );
    }

    const allText = [
      value.greeting,
      value.state_response,
      value.overall_summary,
      value.core_tip,
      ...value.explanation_paragraphs,
      ...Object.values(value.dimension_explanations),
      value.primary_action.instruction,
      value.primary_action.rationale,
      value.primary_action.constraint_label,
      value.optional_task.instruction,
      ...Object.values(value.ritual_notes),
      value.closing,
    ].filter((item): item is string => item !== undefined);
    const fullLength = allText.reduce(
      (total, item) => total + countDisplayCharacters(item),
      0,
    );
    if (fullLength > 480) {
      addCustomIssue(
        context,
        [],
        "all default-language content must not exceed 480 display characters",
      );
    }
  });
export type ExpressionPayload = z.infer<typeof ExpressionPayloadSchema>;

const SourceDependencySchema = z
  .object({
    source_ref: OpaqueIdSchema,
    source_type: z.enum([
      "CHECKIN",
      "RECENT_RECORD",
      "RELATIONSHIP",
      "IMPORTANT_MATTER",
    ]),
    source_revision: PositiveRevisionSchema,
    purpose: VersionTokenSchema,
    segment_paths: z.array(SourcePathSchema).min(1).max(8),
    fallback_paths: z.array(SourcePathSchema).min(1).max(8),
    valid_at_publish: z.literal(true),
  })
  .strict();

const ProvenanceSchema = z
  .object({
    input_snapshot_version: VersionTokenSchema,
    rule_version: VersionTokenSchema,
    algorithm_version: VersionTokenSchema,
    generation_mode: GenerationModeSchema,
    personalization_level: PersonalizationLevelSchema,
    prompt_version: VersionTokenSchema.optional(),
    template_version: VersionTokenSchema.optional(),
    provider: VersionTokenSchema.optional(),
    model: VersionTokenSchema.optional(),
    safety_policy_version: VersionTokenSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.generation_mode === "CONTROLLED_TEMPLATE") {
      if (!value.template_version) {
        addCustomIssue(
          context,
          ["template_version"],
          "is required for CONTROLLED_TEMPLATE",
        );
      }
      if (value.provider || value.model || value.prompt_version) {
        addCustomIssue(
          context,
          [],
          "template provenance must not contain model fields",
        );
      }
    } else if (!value.prompt_version || !value.provider || !value.model) {
      addCustomIssue(
        context,
        [],
        "AI provenance requires prompt_version, provider, and model",
      );
    }
  });

function addDailyReferenceIssues(
  value: {
    facts: z.infer<typeof RuleFactsSchema>;
    expression: z.infer<typeof ExpressionPayloadSchema>;
    source_dependencies: z.infer<typeof SourceDependencySchema>[];
    privacy_fallbacks: Record<string, string>;
  },
  context: z.RefinementCtx,
): void {
  if (
    value.expression.primary_action.action_id !== value.facts.selected_action_id
  ) {
    addCustomIssue(
      context,
      ["expression", "primary_action", "action_id"],
      "must equal facts.selected_action_id",
    );
  }
  if (
    value.expression.optional_task.task_id !==
    value.facts.optional_task_plan.task_id
  ) {
    addCustomIssue(
      context,
      ["expression", "optional_task", "task_id"],
      "must equal facts.optional_task_plan.task_id",
    );
  }

  const expectedRitualIds = value.facts.ritual_facts
    .map((item) => item.ritual_id)
    .sort();
  const actualRitualIds = Object.keys(value.expression.ritual_notes).sort();
  if (JSON.stringify(actualRitualIds) !== JSON.stringify(expectedRitualIds)) {
    addCustomIssue(
      context,
      ["expression", "ritual_notes"],
      "keys must match facts.ritual_facts exactly",
    );
  }

  const coreText = [
    value.expression.greeting,
    value.expression.state_response,
    value.expression.overall_summary,
    value.expression.core_tip,
    ...value.expression.explanation_paragraphs,
    value.expression.dimension_explanations[value.facts.focus_dimension_id],
    value.expression.primary_action.instruction,
    value.expression.primary_action.rationale,
    value.expression.primary_action.constraint_label,
    value.expression.optional_task.instruction,
    value.expression.closing,
  ].filter((item): item is string => item !== undefined);
  const coreLength = coreText.reduce(
    (total, item) => total + countDisplayCharacters(item),
    0,
  );
  if (coreLength > 320) {
    addCustomIssue(
      context,
      ["expression"],
      "core reading must not exceed 320 display characters",
    );
  }

  const fallbackKeys = new Set(Object.keys(value.privacy_fallbacks));
  value.source_dependencies.forEach((dependency, dependencyIndex) => {
    dependency.fallback_paths.forEach((path, pathIndex) => {
      if (!fallbackKeys.has(path)) {
        addCustomIssue(
          context,
          ["source_dependencies", dependencyIndex, "fallback_paths", pathIndex],
          "must reference a key in privacy_fallbacks",
        );
      }
    });
  });
}

export const PublishedDailyResultSchema = z
  .object({
    contract: z.literal("daily-content"),
    schema_version: SemverSchema,
    identity: z
      .object({
        result_id: OpaqueIdSchema,
        user_ref: OpaqueIdSchema,
        product_date: ProductDateSchema,
        result_version: VersionTokenSchema,
        generated_at: Rfc3339TimestampSchema,
      })
      .strict(),
    input_snapshot_ref: OpaqueIdSchema,
    facts: RuleFactsSchema,
    expression: ExpressionPayloadSchema,
    source_dependencies: z.array(SourceDependencySchema).max(12),
    privacy_fallbacks: z.record(SourcePathSchema, generatedTextSchema(4, 140)),
    provenance: ProvenanceSchema,
    validation: z
      .object({
        status: z.literal("PASSED"),
        validated_at: Rfc3339TimestampSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine(addDailyReferenceIssues);
export type PublishedDailyResult = z.infer<typeof PublishedDailyResultSchema>;
