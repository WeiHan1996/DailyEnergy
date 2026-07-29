import * as z from "zod";

import {
  HelpfulnessRatingSchema,
  OpaqueIdSchema,
  OverallFeelingSchema,
  PositiveRevisionSchema,
  ProductDateSchema,
  Rfc3339TimestampSchema,
  SemverSchema,
  TaskStatusSchema,
  VersionTokenSchema,
  addCustomIssue,
  singleLineTextSchema,
} from "./common.js";

export const EveningFeedbackDraftSchema = z
  .object({
    product_date: ProductDateSchema,
    overall_feeling: OverallFeelingSchema.optional(),
    helpfulness_rating: HelpfulnessRatingSchema.optional(),
    task_status: TaskStatusSchema.optional(),
    note: singleLineTextSchema(1, 80).optional(),
    last_edited_at: Rfc3339TimestampSchema,
  })
  .strict();
export type EveningFeedbackDraft = z.infer<typeof EveningFeedbackDraftSchema>;

export const EveningFeedbackRecordSchema = z
  .object({
    contract: z.literal("evening-feedback"),
    schema_version: SemverSchema,
    feedback_id: OpaqueIdSchema,
    user_ref: OpaqueIdSchema,
    product_date: ProductDateSchema,
    revision: PositiveRevisionSchema,
    overall_feeling: OverallFeelingSchema,
    note: singleLineTextSchema(1, 80).optional(),
    first_submitted_at: Rfc3339TimestampSchema,
    updated_at: Rfc3339TimestampSchema,
    source_submission_id: OpaqueIdSchema,
    safety_policy_version: VersionTokenSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.updated_at) < Date.parse(value.first_submitted_at)) {
      addCustomIssue(
        context,
        ["updated_at"],
        "must not precede first_submitted_at",
      );
    }
  });
export type EveningFeedbackRecord = z.infer<typeof EveningFeedbackRecordSchema>;

export const EveningFeedbackRevisionSchema = z
  .object({
    contract: z.literal("evening-feedback-revision"),
    schema_version: SemverSchema,
    feedback_id: OpaqueIdSchema,
    revision: PositiveRevisionSchema,
    changed_fields: z
      .array(z.enum(["overall_feeling", "note"]))
      .min(1)
      .max(2),
    source_submission_id: OpaqueIdSchema,
    changed_at: Rfc3339TimestampSchema,
    change_source: z.enum(["USER_SUBMISSION", "DATA_RIGHTS_PROCESS"]),
    safety_policy_version: VersionTokenSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.changed_fields).size !== value.changed_fields.length) {
      addCustomIssue(context, ["changed_fields"], "values must be unique");
    }
  });
export type EveningFeedbackRevision = z.infer<
  typeof EveningFeedbackRevisionSchema
>;

export const DailyHelpfulnessRecordSchema = z
  .object({
    contract: z.literal("daily-helpfulness"),
    schema_version: SemverSchema,
    helpfulness_id: OpaqueIdSchema,
    user_ref: OpaqueIdSchema,
    product_date: ProductDateSchema,
    revision: PositiveRevisionSchema,
    rating: HelpfulnessRatingSchema,
    updated_at: Rfc3339TimestampSchema,
    source_submission_id: OpaqueIdSchema,
  })
  .strict();
export type DailyHelpfulnessRecord = z.infer<
  typeof DailyHelpfulnessRecordSchema
>;

export const DailyTaskStateSchema = z
  .object({
    contract: z.literal("daily-task-state"),
    schema_version: SemverSchema,
    task_id: OpaqueIdSchema,
    user_ref: OpaqueIdSchema,
    product_date: ProductDateSchema,
    revision: PositiveRevisionSchema,
    status: TaskStatusSchema,
    updated_at: Rfc3339TimestampSchema,
    source_submission_id: OpaqueIdSchema,
  })
  .strict();
export type DailyTaskState = z.infer<typeof DailyTaskStateSchema>;
