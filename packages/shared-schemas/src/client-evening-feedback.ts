import * as z from "zod";

import {
  HelpfulnessRatingSchema,
  HelpfulnessRatingValues,
  HelpfulnessStateSchema,
  OpaqueIdSchema,
  OverallFeelingSchema,
  OverallFeelingValues,
  PositiveRevisionSchema,
  ProductDateSchema,
  RevisionSchema,
  Rfc3339TimestampSchema,
  SemverSchema,
  TaskStatusSchema,
  TaskStatusValues,
  VersionTokenSchema,
  WriteWindowSchema,
  addCustomIssue,
  generatedTextSchema,
  singleLineTextSchema,
} from "./common.js";

export const NotePatchSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("SET"),
      value: singleLineTextSchema(1, 80),
    })
    .strict(),
  z.object({ operation: z.literal("CLEAR") }).strict(),
]);
export type NotePatch = z.infer<typeof NotePatchSchema>;

const TaskPatchSchema = z
  .object({
    task_id: OpaqueIdSchema,
    expected_revision: RevisionSchema,
    status: TaskStatusSchema,
  })
  .strict();

export const EveningReflectionSubmissionSchema = z
  .object({
    contract: z.literal("evening-reflection-submission"),
    schema_version: SemverSchema,
    submission_id: OpaqueIdSchema,
    product_date: ProductDateSchema,
    expected_feedback_revision: RevisionSchema,
    expected_helpfulness_revision: RevisionSchema,
    overall_feeling: OverallFeelingSchema,
    helpfulness_rating: HelpfulnessRatingSchema,
    task_patch: TaskPatchSchema.optional(),
    note_patch: NotePatchSchema.optional(),
    client_context: z
      .object({
        entry_source: VersionTokenSchema,
        view_schema_version: SemverSchema,
      })
      .strict(),
  })
  .strict();
export type EveningReflectionSubmission = z.infer<
  typeof EveningReflectionSubmissionSchema
>;

export const EveningFeedbackAvailabilityValues = [
  "UNAVAILABLE",
  "EDITABLE_EMPTY",
  "EDITABLE_SUBMITTED",
  "READ_ONLY_SUBMITTED",
  "READ_ONLY_EMPTY",
] as const;
export const EveningFeedbackAvailabilitySchema = z.enum(
  EveningFeedbackAvailabilityValues,
);
export type EveningFeedbackAvailability = z.infer<
  typeof EveningFeedbackAvailabilitySchema
>;

export const EveningPrimaryActionValues = [
  "SAVE",
  "SAVE_CHANGES",
  "READ_ONLY",
] as const;
export const EveningPrimaryActionSchema = z.enum(EveningPrimaryActionValues);
export type EveningPrimaryAction = z.infer<typeof EveningPrimaryActionSchema>;

const OverallFeelingOptionsSchema = z.tuple([
  z.literal(OverallFeelingValues[0]),
  z.literal(OverallFeelingValues[1]),
  z.literal(OverallFeelingValues[2]),
  z.literal(OverallFeelingValues[3]),
  z.literal(OverallFeelingValues[4]),
  z.literal(OverallFeelingValues[5]),
]);

const HelpfulnessOptionsSchema = z.tuple([
  z.literal(HelpfulnessRatingValues[0]),
  z.literal(HelpfulnessRatingValues[1]),
  z.literal(HelpfulnessRatingValues[2]),
  z.literal(HelpfulnessRatingValues[3]),
]);

const TaskStatusOptionsSchema = z.tuple([
  z.literal(TaskStatusValues[0]),
  z.literal(TaskStatusValues[1]),
  z.literal(TaskStatusValues[2]),
  z.literal(TaskStatusValues[3]),
]);

const ClientFeedbackValueSchema = z
  .object({
    revision: PositiveRevisionSchema,
    overall_feeling: OverallFeelingSchema,
    note: singleLineTextSchema(1, 80).optional(),
    first_submitted_at: Rfc3339TimestampSchema,
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

const ClientHelpfulnessValueSchema = z
  .object({
    revision: RevisionSchema,
    rating: HelpfulnessStateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.rating === "UNRATED" && value.revision !== 0) {
      addCustomIssue(context, ["revision"], "must be 0 when UNRATED");
    }
    if (value.rating !== "UNRATED" && value.revision < 1) {
      addCustomIssue(context, ["revision"], "must be positive when rated");
    }
  });

const ClientTaskValueSchema = z
  .object({
    task_id: OpaqueIdSchema,
    instruction: generatedTextSchema(10, 35),
    revision: PositiveRevisionSchema,
    status: TaskStatusSchema,
  })
  .strict();

const EXPECTED_ACTION = {
  UNAVAILABLE: "READ_ONLY",
  EDITABLE_EMPTY: "SAVE",
  EDITABLE_SUBMITTED: "SAVE_CHANGES",
  READ_ONLY_SUBMITTED: "READ_ONLY",
  READ_ONLY_EMPTY: "READ_ONLY",
} as const;

export const ClientEveningFeedbackViewSchema = z
  .object({
    contract: z.literal("evening-feedback-view"),
    schema_version: SemverSchema,
    product_date: ProductDateSchema,
    availability: EveningFeedbackAvailabilitySchema,
    write_window: WriteWindowSchema,
    unavailable_message: generatedTextSchema(4, 60).optional(),
    feedback: ClientFeedbackValueSchema.optional(),
    helpfulness: ClientHelpfulnessValueSchema,
    task: ClientTaskValueSchema.optional(),
    options: z
      .object({
        overall_feeling: OverallFeelingOptionsSchema,
        helpfulness: HelpfulnessOptionsSchema,
        task_status: TaskStatusOptionsSchema,
      })
      .strict(),
    note_max_characters: z.literal(80),
    primary_action: EveningPrimaryActionSchema,
    completion_message: generatedTextSchema(8, 40),
  })
  .strict()
  .superRefine((value, context) => {
    const submitted = value.availability.endsWith("SUBMITTED");
    if (submitted !== (value.feedback !== undefined)) {
      addCustomIssue(
        context,
        ["feedback"],
        submitted
          ? "is required for a submitted availability"
          : "must be omitted when no feedback exists",
      );
    }

    const expectedAction = EXPECTED_ACTION[value.availability];
    if (value.primary_action !== expectedAction) {
      addCustomIssue(
        context,
        ["primary_action"],
        `must be ${expectedAction} for ${value.availability}`,
      );
    }

    const editable = value.availability.startsWith("EDITABLE_");
    if (editable && value.write_window === "CLOSED") {
      addCustomIssue(
        context,
        ["write_window"],
        "an editable view cannot have a closed write window",
      );
    }
    if (!editable && value.primary_action !== "READ_ONLY") {
      addCustomIssue(
        context,
        ["primary_action"],
        "a non-editable view must be read only",
      );
    }
    if (value.availability === "UNAVAILABLE" && !value.unavailable_message) {
      addCustomIssue(
        context,
        ["unavailable_message"],
        "is required when availability is UNAVAILABLE",
      );
    }
    if (value.availability !== "UNAVAILABLE" && value.unavailable_message) {
      addCustomIssue(
        context,
        ["unavailable_message"],
        "must be omitted when the view is available",
      );
    }
  });
export type ClientEveningFeedbackView = z.infer<
  typeof ClientEveningFeedbackViewSchema
>;
