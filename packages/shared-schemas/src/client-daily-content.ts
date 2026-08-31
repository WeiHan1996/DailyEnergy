import * as z from "zod";

import {
  BandSchema,
  HelpfulnessStateSchema,
  OpaqueIdSchema,
  PositiveRevisionSchema,
  ProductDateSchema,
  RelationshipStageSchema,
  Rfc3339TimestampSchema,
  RitualKindSchema,
  SemverSchema,
  StableDimensionIdSchema,
  StableDimensionIdValues,
  TaskStatusSchema,
  VersionTokenSchema,
  addCustomIssue,
  countDisplayCharacters,
  generatedTextSchema,
} from "./common.js";

export function isExactDimensionSet(values: readonly string[]): boolean {
  return (
    values.length === StableDimensionIdValues.length &&
    new Set(values).size === StableDimensionIdValues.length &&
    StableDimensionIdValues.every((id) => values.includes(id))
  );
}

export const PrimaryActionExpressionSchema = z
  .object({
    action_id: OpaqueIdSchema,
    instruction: generatedTextSchema(15, 45),
    rationale: generatedTextSchema(10, 35).optional(),
    constraint_label: generatedTextSchema(4, 16).optional(),
  })
  .strict();

export const OptionalTaskExpressionSchema = z
  .object({
    task_id: OpaqueIdSchema,
    instruction: generatedTextSchema(10, 35),
  })
  .strict();

const ClientDimensionSchema = z
  .object({
    id: StableDimensionIdSchema,
    label: generatedTextSchema(2, 12),
    band: BandSchema,
    band_label: generatedTextSchema(2, 12),
    explanation: generatedTextSchema(12, 35),
    is_focus: z.boolean(),
  })
  .strict();

const ClientRitualSchema = z
  .object({
    kind: RitualKindSchema,
    display_value: generatedTextSchema(1, 12),
    note: generatedTextSchema(8, 24),
  })
  .strict();

export const ClientDailyContentViewSchema = z
  .object({
    contract: z.literal("daily-content-view"),
    schema_version: SemverSchema,
    result_id: OpaqueIdSchema,
    product_date: ProductDateSchema,
    result_version: VersionTokenSchema,
    generated_at: Rfc3339TimestampSchema,
    content_label: z.literal("娱乐与行动参考"),
    greeting: generatedTextSchema(8, 24),
    state_response: generatedTextSchema(20, 60),
    overall: z
      .object({
        band: BandSchema,
        band_label: generatedTextSchema(2, 12),
        summary: generatedTextSchema(12, 30),
      })
      .strict(),
    focus_dimension_id: StableDimensionIdSchema,
    dimensions: z.array(ClientDimensionSchema).length(5),
    core_tip: generatedTextSchema(20, 50),
    explanation_paragraphs: z.array(generatedTextSchema(1, 140)).min(1).max(2),
    primary_action: PrimaryActionExpressionSchema,
    optional_task: OptionalTaskExpressionSchema,
    rituals: z.array(ClientRitualSchema).max(2),
    closing: generatedTextSchema(8, 30),
    personalization_notice: z.enum(["NONE", "PERSONALIZATION_REDUCED"]),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.dimensions.map((item) => item.id);
    if (!isExactDimensionSet(ids)) {
      addCustomIssue(
        context,
        ["dimensions"],
        "must contain each stable dimension exactly once",
      );
    }
    if (ids[0] !== value.focus_dimension_id) {
      addCustomIssue(
        context,
        ["dimensions", 0, "id"],
        "first dimension must be the focus dimension",
      );
    }
    const focused = value.dimensions.filter((item) => item.is_focus);
    if (focused.length !== 1 || focused[0]?.id !== value.focus_dimension_id) {
      addCustomIssue(
        context,
        ["dimensions"],
        "exactly one is_focus must match focus_dimension_id",
      );
    }
    const ritualKinds = value.rituals.map((item) => item.kind);
    if (new Set(ritualKinds).size !== ritualKinds.length) {
      addCustomIssue(context, ["rituals"], "ritual kinds must be unique");
    }
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
  });
export type ClientDailyContentView = z.infer<
  typeof ClientDailyContentViewSchema
>;

export const DailyInteractionStateSchema = z
  .object({
    contract: z.literal("daily-interaction-state"),
    schema_version: SemverSchema,
    result_id: OpaqueIdSchema,
    product_date: ProductDateSchema,
    is_lit: z.boolean(),
    task: z
      .object({
        task_id: OpaqueIdSchema,
        revision: PositiveRevisionSchema,
        status: TaskStatusSchema,
      })
      .strict(),
    helpfulness: z
      .object({
        revision: z.number().int().nonnegative(),
        rating: HelpfulnessStateSchema,
      })
      .strict(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.helpfulness.rating === "UNRATED" &&
      value.helpfulness.revision !== 0
    ) {
      addCustomIssue(
        context,
        ["helpfulness", "revision"],
        "must be 0 when rating is UNRATED",
      );
    }
    if (
      value.helpfulness.rating !== "UNRATED" &&
      value.helpfulness.revision < 1
    ) {
      addCustomIssue(
        context,
        ["helpfulness", "revision"],
        "must be positive when a rating exists",
      );
    }
  });
export type DailyInteractionState = z.infer<typeof DailyInteractionStateSchema>;

export const GenerationIntentStatusValues = [
  "QUEUED",
  "RUNNING",
  "FALLBACK_RUNNING",
  "RETRYABLE_FAILED",
  "SUCCEEDED",
  "TERMINAL_FAILED",
  "CANCELLED",
] as const;
export const GenerationIntentStatusSchema = z.enum(
  GenerationIntentStatusValues,
);
export type GenerationIntentStatus = z.infer<
  typeof GenerationIntentStatusSchema
>;

export const GenerationIntentViewSchema = z
  .object({
    intent_ref: OpaqueIdSchema,
    product_date: ProductDateSchema,
    status: GenerationIntentStatusSchema,
    result_ref: OpaqueIdSchema.optional(),
    retry_after_seconds: z.number().int().min(0).max(3_600).optional(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "SUCCEEDED" && value.result_ref === undefined) {
      addCustomIssue(
        context,
        ["result_ref"],
        "is required when status is SUCCEEDED",
      );
    }
    if (value.status !== "SUCCEEDED" && value.result_ref !== undefined) {
      addCustomIssue(
        context,
        ["result_ref"],
        "is forbidden unless status is SUCCEEDED",
      );
    }
    const running = [
      "QUEUED",
      "RUNNING",
      "FALLBACK_RUNNING",
      "RETRYABLE_FAILED",
    ].includes(value.status);
    if (!running && value.retry_after_seconds !== undefined) {
      addCustomIssue(
        context,
        ["retry_after_seconds"],
        "is only allowed for a recoverable in-progress status",
      );
    }
  });
export type GenerationIntentView = z.infer<typeof GenerationIntentViewSchema>;

export const RelationshipViewSchema = z
  .object({
    stage: RelationshipStageSchema,
    encounter_day_count: z.number().int().nonnegative(),
    display_token: VersionTokenSchema.optional(),
  })
  .strict();
export type RelationshipView = z.infer<typeof RelationshipViewSchema>;

export const TodayViewSchema = z
  .object({
    content: ClientDailyContentViewSchema,
    interaction: DailyInteractionStateSchema,
    relationship: RelationshipViewSchema,
  })
  .strict();
export type TodayView = z.infer<typeof TodayViewSchema>;
