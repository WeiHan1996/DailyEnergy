import * as z from "zod";

import {
  ActionKindSchema,
  BandSchema,
  EffortSchema,
  EnergySchema,
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
