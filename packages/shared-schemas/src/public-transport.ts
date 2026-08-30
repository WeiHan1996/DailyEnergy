import * as z from "zod";

import {
  EnergySchema,
  ExpressionStyleSchema,
  HelpfulnessRatingSchema,
  HelpfulnessStateSchema,
  MoodSchema,
  OpaqueIdSchema,
  OverallFeelingSchema,
  PositiveRevisionSchema,
  ProductDateSchema,
  Rfc3339TimestampSchema,
  RevisionSchema,
  RelationshipStageSchema,
  SemverSchema,
  SleepSchema,
  TaskStatusSchema,
  VersionTokenSchema,
  WriteWindowSchema,
  singleLineTextSchema,
} from "./common.js";
import { ClientDailyContentViewSchema } from "./client-daily-content.js";
import { NotePatchSchema } from "./client-evening-feedback.js";

const COMMAND_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export const CommandRefSchema = z.string().regex(COMMAND_REF);

export const ClientContextSchema = z
  .object({
    app_version: z.string().min(1).max(64).optional(),
    scene: z.string().min(1).max(64).optional(),
  })
  .strict();

const PreferredNameSchema = singleLineTextSchema(1, 24);
const CommandShape = {
  command_ref: CommandRefSchema,
  client_context: ClientContextSchema.optional(),
} as const;

export const WechatSessionRequestSchema = z
  .object({
    code: z.string().min(1).max(256),
    channel: z.string().min(1).max(64).optional(),
  })
  .strict();

export type WechatSessionRequest = z.infer<typeof WechatSessionRequestSchema>;

export const ConsentAcceptRequestSchema = z
  .object({
    ...CommandShape,
    notice_version: VersionTokenSchema,
  })
  .strict();

export const ConsentWithdrawRequestSchema = ConsentAcceptRequestSchema;

export const OnboardingCompleteRequestSchema = z
  .object({
    ...CommandShape,
    preferred_name: PreferredNameSchema.optional(),
    expression_style: ExpressionStyleSchema,
  })
  .strict();

export const ProfileUpdateRequestSchema = z
  .object({
    ...CommandShape,
    expected_revision: PositiveRevisionSchema,
    preferred_name: PreferredNameSchema.optional(),
    clear_preferred_name: z.boolean().optional(),
    expression_style: ExpressionStyleSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.preferred_name !== undefined &&
      value.clear_preferred_name === true
    ) {
      context.addIssue({
        code: "custom",
        message:
          "preferred_name and clear_preferred_name are mutually exclusive",
        path: ["clear_preferred_name"],
      });
    }
    if (
      value.preferred_name === undefined &&
      value.clear_preferred_name !== true &&
      value.expression_style === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "at least one profile field must change",
      });
    }
  });

export const StyleCalibrationRequestSchema = z
  .object({
    ...CommandShape,
    expected_revision: PositiveRevisionSchema,
    expression_style: ExpressionStyleSchema,
  })
  .strict();

const CheckinValuesShape = {
  energy: EnergySchema,
  mood: MoodSchema,
  sleep: SleepSchema,
} as const;

export const CheckinSubmitRequestSchema = z
  .object({
    ...CommandShape,
    expected_revision: z.literal(0),
    ...CheckinValuesShape,
  })
  .strict();

export const CheckinCorrectRequestSchema = z
  .object({
    ...CommandShape,
    expected_revision: PositiveRevisionSchema,
    ...CheckinValuesShape,
  })
  .strict();

export const GenerationStartRequestSchema = z
  .object({
    ...CommandShape,
    expected_checkin_revision: PositiveRevisionSchema,
  })
  .strict();

export const LightDayRequestSchema = z
  .object({
    ...CommandShape,
    product_date: ProductDateSchema,
    result_ref: OpaqueIdSchema,
  })
  .strict();

export const TaskStateUpdateRequestSchema = z
  .object({
    ...CommandShape,
    expected_revision: PositiveRevisionSchema,
    product_date: ProductDateSchema,
    status: TaskStatusSchema,
    task_ref: OpaqueIdSchema,
  })
  .strict();

export const EveningSaveRequestSchema = z
  .object({
    ...CommandShape,
    product_date: ProductDateSchema,
    expected_feedback_revision: z.number().int().nonnegative(),
    expected_helpfulness_revision: z.number().int().nonnegative(),
    overall_feeling: OverallFeelingSchema,
    helpfulness_rating: HelpfulnessRatingSchema,
    task_patch: z
      .object({
        task_ref: OpaqueIdSchema,
        expected_revision: PositiveRevisionSchema,
        status: TaskStatusSchema,
      })
      .strict()
      .optional(),
    note_patch: NotePatchSchema.optional(),
    client_context: z
      .object({
        app_version: z.string().min(1).max(64).optional(),
        entry_source: z.enum([
          "TODAY_SECONDARY",
          "TODAY_EVENING_CARD",
          "REMINDER_DEEP_LINK",
          "EDIT_EXISTING",
        ]),
        view_schema_version: SemverSchema,
      })
      .strict(),
  })
  .strict();

export const MemoryPreferencesUpdateRequestSchema = z
  .object({
    ...CommandShape,
    expected_revision: PositiveRevisionSchema,
    master_enabled: z.boolean(),
    daily_use_enabled: z.boolean(),
    weekly_use_enabled: z.boolean(),
  })
  .strict();

export const NotificationSettingsUpdateRequestSchema = z
  .object({
    ...CommandShape,
    expected_revision: PositiveRevisionSchema,
    morning_enabled: z.boolean(),
    evening_enabled: z.boolean(),
  })
  .strict();

export const NotificationPermissionSyncRequestSchema = z
  .object({
    ...CommandShape,
    observed_permission: z.enum(["UNKNOWN", "GRANTED", "DENIED", "REVOKED"]),
    observed_at: Rfc3339TimestampSchema,
  })
  .strict();

export const ReauthVerifyRequestSchema = z
  .object({
    ...CommandShape,
    confirmation_challenge_ref: OpaqueIdSchema,
    wechat_code: z.string().min(1).max(256),
  })
  .strict();

export const ExportRequestSchema = z
  .object({
    ...CommandShape,
    export_format: z.literal("JSON"),
    confirmation_version: VersionTokenSchema,
  })
  .strict();

const DayDeletionTargetSchema = z
  .object({ product_date: ProductDateSchema })
  .strict();
const MatterDeletionTargetSchema = z
  .object({ matter_ref: OpaqueIdSchema })
  .strict();
const AccountDeletionTargetSchema = z
  .object({ subject: z.literal("SELF") })
  .strict();

export const DayExpectedRevisionSchema = z
  .object({
    product_date: ProductDateSchema,
    expected_revision: RevisionSchema,
  })
  .strict();

export const RelationshipDeletionTargetSchema = z
  .object({
    relationship_scope: z.literal("CURRENT_CYCLE_AND_HISTORY"),
    included_day_product_dates: z
      .array(ProductDateSchema)
      .max(45)
      .refine((dates) => new Set(dates).size === dates.length, {
        message: "included day dates must be unique",
      }),
  })
  .strict();

export const DeleteDayRequestSchema = z
  .object({
    ...CommandShape,
    scope: z.literal("DAY"),
    target: DayDeletionTargetSchema,
    confirmation_version: VersionTokenSchema,
    confirmed: z.literal(true),
    expected_revision: RevisionSchema,
  })
  .strict();

export const DeleteMatterRequestSchema = z
  .object({
    ...CommandShape,
    scope: z.literal("MATTER"),
    target: MatterDeletionTargetSchema,
    confirmation_version: VersionTokenSchema,
    confirmed: z.literal(true),
    expected_revision: PositiveRevisionSchema,
  })
  .strict();

export const DeleteRelationshipPrepareRequestSchema = z
  .object({
    ...CommandShape,
    scope: z.literal("RELATIONSHIP_DATA"),
    target: RelationshipDeletionTargetSchema,
    expected_relationship_revision: PositiveRevisionSchema,
    included_day_expected_revisions: z.array(DayExpectedRevisionSchema).max(45),
    confirmation_version: VersionTokenSchema,
  })
  .strict()
  .superRefine(addRelationshipRevisionIssues);

export const DeleteRelationshipConfirmRequestSchema = z
  .object({
    ...CommandShape,
    confirmation_challenge_ref: OpaqueIdSchema,
    scope: z.literal("RELATIONSHIP_DATA"),
    target: RelationshipDeletionTargetSchema,
    expected_relationship_revision: PositiveRevisionSchema,
    included_day_expected_revisions: z.array(DayExpectedRevisionSchema).max(45),
    confirmation_version: VersionTokenSchema,
    confirmed: z.literal(true),
    identity_verification_ref: OpaqueIdSchema.optional(),
  })
  .strict()
  .superRefine(addRelationshipRevisionIssues);

export const DeleteAccountPrepareRequestSchema = z
  .object({
    ...CommandShape,
    scope: z.literal("ACCOUNT"),
    target: AccountDeletionTargetSchema,
    expected_account_revision: PositiveRevisionSchema,
    confirmation_version: VersionTokenSchema,
  })
  .strict();

export const DeleteAccountConfirmRequestSchema = z
  .object({
    ...CommandShape,
    confirmation_challenge_ref: OpaqueIdSchema,
    scope: z.literal("ACCOUNT"),
    target: AccountDeletionTargetSchema,
    expected_account_revision: PositiveRevisionSchema,
    confirmation_version: VersionTokenSchema,
    confirmed: z.literal(true),
    identity_verification_ref: OpaqueIdSchema,
  })
  .strict();

export const DataTaskCancelRequestSchema = z
  .object({
    ...CommandShape,
    expected_task_revision: PositiveRevisionSchema,
  })
  .strict();

export const DataTaskStatusValues = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;
export const DataTaskStatusSchema = z.enum(DataTaskStatusValues);

export const ExportArtifactViewSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("PREPARING"),
      format: z.literal("JSON"),
    })
    .strict(),
  z
    .object({
      state: z.literal("READY"),
      format: z.literal("JSON"),
      download_ref: OpaqueIdSchema,
      ready_at: Rfc3339TimestampSchema,
      expires_at: Rfc3339TimestampSchema,
    })
    .strict(),
  z
    .object({
      state: z.enum(["EXPIRED", "INVALIDATED"]),
      format: z.literal("JSON"),
    })
    .strict(),
]);

export const DataTaskViewSchema = z
  .object({
    task_ref: OpaqueIdSchema,
    revision: PositiveRevisionSchema,
    kind: z.enum(["EXPORT", "DELETE"]),
    scope: z.enum(["DAY", "MATTER", "RELATIONSHIP_DATA", "ACCOUNT"]),
    target_summary: singleLineTextSchema(1, 120),
    status: DataTaskStatusSchema,
    online_erased_at: Rfc3339TimestampSchema.optional(),
    backup_purge_deadline: Rfc3339TimestampSchema.optional(),
    export_artifact: ExportArtifactViewSchema.optional(),
    can_cancel: z.boolean(),
    failure_summary_code: VersionTokenSchema.optional(),
    created_at: Rfc3339TimestampSchema,
    updated_at: Rfc3339TimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "DELETE" && value.export_artifact !== undefined) {
      context.addIssue({
        code: "custom",
        message: "a deletion cannot expose an export artifact",
        path: ["export_artifact"],
      });
    }
    if (
      value.kind === "EXPORT" &&
      ["PENDING", "RUNNING"].includes(value.status) &&
      value.export_artifact?.state !== "PREPARING"
    ) {
      context.addIssue({
        code: "custom",
        message: "an active export requires a PREPARING artifact",
        path: ["export_artifact"],
      });
    }
    if (
      value.kind === "EXPORT" &&
      value.status === "SUCCEEDED" &&
      (value.export_artifact === undefined ||
        value.export_artifact.state === "PREPARING")
    ) {
      context.addIssue({
        code: "custom",
        message: "a succeeded export requires a terminal export artifact",
        path: ["export_artifact"],
      });
    }
    if (
      value.kind === "EXPORT" &&
      (value.online_erased_at !== undefined ||
        value.backup_purge_deadline !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "an export cannot claim deletion completion timestamps",
      });
    }
    if (
      value.kind === "DELETE" &&
      value.status === "SUCCEEDED" &&
      (value.online_erased_at === undefined ||
        value.backup_purge_deadline === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "a succeeded deletion requires online and backup completion timestamps",
      });
    }
    if (value.status === "FAILED" && value.failure_summary_code === undefined) {
      context.addIssue({
        code: "custom",
        message: "FAILED requires a stable failure summary code",
        path: ["failure_summary_code"],
      });
    }
    if (
      value.can_cancel &&
      !(value.kind === "EXPORT" && value.status === "PENDING")
    ) {
      context.addIssue({
        code: "custom",
        message: "only a pending export can be cancelled",
        path: ["can_cancel"],
      });
    }
  });

export const DataTaskListViewSchema = z
  .object({
    items: z.array(DataTaskViewSchema).max(50),
    next_cursor: z.string().min(1).max(512).optional(),
    page_info: z.object({ has_more: z.boolean() }).strict(),
  })
  .strict();

export const DataRightsSummaryViewSchema = z
  .object({
    account: z
      .object({
        expected_revision: PositiveRevisionSchema,
        state: z.literal("ACTIVE"),
      })
      .strict(),
    relationship: z
      .object({
        expected_revision: PositiveRevisionSchema,
        state: z.literal("PRESENT"),
      })
      .strict()
      .optional(),
    capabilities: z
      .object({
        export_account: z.boolean(),
        delete_day: z.boolean(),
        delete_matter: z.boolean(),
        delete_relationship_data: z.boolean(),
        delete_account: z.boolean(),
      })
      .strict(),
    confirmation_versions: z
      .object({
        export_account: z.literal("data-export-v1"),
        delete_day: z.literal("data-rights-day-v1"),
        delete_matter: z.literal("data-rights-matter-v1"),
        delete_relationship_data: z.literal("data-rights-relationship-v1"),
        delete_account: z.literal("data-rights-account-v1"),
      })
      .strict(),
    online_erasure_sla_hours: z.literal(72),
    backup_max_days: z.literal(35),
  })
  .strict();

export const DeletionStatusGrantViewSchema = z
  .object({
    task_ref: OpaqueIdSchema,
    status_token: z
      .string()
      .min(32)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/u),
    expires_at: Rfc3339TimestampSchema,
  })
  .strict();

export const AccountDeletionAcceptedViewSchema = z
  .object({
    task: DataTaskViewSchema,
    status_grant: DeletionStatusGrantViewSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.task.kind !== "DELETE" || value.task.scope !== "ACCOUNT") {
      context.addIssue({
        code: "custom",
        message:
          "account deletion acceptance requires an ACCOUNT deletion task",
        path: ["task"],
      });
    }
    if (value.status_grant.task_ref !== value.task.task_ref) {
      context.addIssue({
        code: "custom",
        message: "status grant must target the accepted deletion task",
        path: ["status_grant", "task_ref"],
      });
    }
  });

const ConfirmationCommonShape = {
  confirmation_challenge_ref: OpaqueIdSchema,
  confirmation_version: VersionTokenSchema,
  expected_revision: PositiveRevisionSchema,
  immediate_effects: z.array(singleLineTextSchema(1, 160)).min(1).max(12),
  derived_effects: z.array(singleLineTextSchema(1, 160)).max(12),
  online_erasure_sla_hours: z.literal(72),
  backup_max_days: z.literal(35),
  identity_reverification_required: z.boolean(),
  expires_at: Rfc3339TimestampSchema,
} as const;

export const DeletionConfirmationViewSchema = z.discriminatedUnion("scope", [
  z
    .object({
      ...ConfirmationCommonShape,
      scope: z.literal("RELATIONSHIP_DATA"),
      target: RelationshipDeletionTargetSchema,
      expected_day_revisions: z.array(DayExpectedRevisionSchema).max(45),
    })
    .strict()
    .superRefine((value, context) => {
      addRelationshipRevisionIssues(
        {
          target: value.target,
          included_day_expected_revisions: value.expected_day_revisions,
        },
        context,
      );
    }),
  z
    .object({
      ...ConfirmationCommonShape,
      scope: z.literal("ACCOUNT"),
      target: AccountDeletionTargetSchema,
      expected_day_revisions: z.never().optional(),
      identity_reverification_required: z.literal(true),
    })
    .strict(),
]);

export const IdentityVerificationViewSchema = z
  .object({
    identity_verification_ref: OpaqueIdSchema,
    confirmation_challenge_ref: OpaqueIdSchema,
    expires_at: Rfc3339TimestampSchema,
  })
  .strict();

function addRelationshipRevisionIssues(
  value: {
    target: { included_day_product_dates: string[] };
    included_day_expected_revisions: Array<{
      product_date: string;
      expected_revision: number;
    }>;
  },
  context: z.RefinementCtx,
): void {
  const dates = value.target.included_day_product_dates;
  const revisions = value.included_day_expected_revisions.map(
    (revision) => revision.product_date,
  );
  if (JSON.stringify(dates) !== JSON.stringify(revisions)) {
    context.addIssue({
      code: "custom",
      message: "included day revisions must match target dates in exact order",
      path: ["included_day_expected_revisions"],
    });
  }
}

export const CommandReceiptViewSchema = z
  .object({
    command_ref: CommandRefSchema,
    operation: VersionTokenSchema,
    outcome: z.enum(["ACCEPTED", "DUPLICATE"]),
  })
  .strict();

export const ConsentViewSchema = z
  .object({
    state: z.enum(["MISSING", "ACCEPTED", "WITHDRAWN"]),
    notice_version: VersionTokenSchema,
    accepted_at: Rfc3339TimestampSchema.optional(),
  })
  .strict();

export const ProfileViewSchema = z
  .object({
    revision: PositiveRevisionSchema,
    preferred_name: PreferredNameSchema.optional(),
    expression_style: ExpressionStyleSchema,
    onboarding_completed: z.boolean(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const CheckinViewSchema = z
  .object({
    checkin_ref: z.string().uuid(),
    product_date: ProductDateSchema,
    revision: PositiveRevisionSchema,
    ...CheckinValuesShape,
    write_window: WriteWindowSchema,
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const MemoryPreferencesViewSchema = z
  .object({
    revision: PositiveRevisionSchema,
    master_enabled: z.boolean(),
    daily_use_enabled: z.boolean(),
    weekly_use_enabled: z.boolean(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const NotificationSettingsViewSchema = z
  .object({
    revision: PositiveRevisionSchema,
    morning_enabled: z.boolean(),
    evening_enabled: z.boolean(),
    observed_permission: z.enum(["UNKNOWN", "GRANTED", "DENIED", "REVOKED"]),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const DataExportCheckinViewSchema = z
  .object({
    revision: PositiveRevisionSchema,
    mood: MoodSchema,
    energy: EnergySchema,
    sleep: SleepSchema,
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const DataExportDailyContentViewSchema = ClientDailyContentViewSchema;

export const DataExportInteractionViewSchema = z
  .object({
    is_lit: z.boolean(),
    task: z
      .object({
        revision: PositiveRevisionSchema,
        status: TaskStatusSchema,
      })
      .strict(),
    helpfulness: z
      .object({
        revision: RevisionSchema,
        rating: HelpfulnessStateSchema,
      })
      .strict(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const DataExportEveningViewSchema = z
  .object({
    revision: PositiveRevisionSchema,
    overall_feeling: OverallFeelingSchema,
    note: z.string().max(80).optional(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const DataExportDaySchema = z
  .object({
    product_date: ProductDateSchema,
    checkin: DataExportCheckinViewSchema.optional(),
    content: DataExportDailyContentViewSchema.optional(),
    interaction: DataExportInteractionViewSchema.optional(),
    evening: DataExportEveningViewSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.checkin === undefined &&
      value.content === undefined &&
      value.interaction === undefined &&
      value.evening === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "an exported day requires at least one active product fact",
      });
    }
    if (
      value.content !== undefined &&
      value.content.product_date !== value.product_date
    ) {
      context.addIssue({
        code: "custom",
        message: "exported content date must match the day",
        path: ["content", "product_date"],
      });
    }
  });

export const DataExportMatterViewSchema = z
  .object({
    revision: PositiveRevisionSchema,
    title: singleLineTextSchema(1, 80),
    target_date: ProductDateSchema.optional(),
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "EXPIRED"]),
    daily_use_granted: z.boolean(),
    weekly_use_granted: z.boolean(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const DataExportRelationshipSummarySchema = z
  .object({
    revision: PositiveRevisionSchema,
    state: z.literal("PRESENT"),
    stage: RelationshipStageSchema,
    encounter_day_count: z.number().int().nonnegative(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const DataExportNotificationPreferencesSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            notification_type: VersionTokenSchema,
            enabled: z.boolean(),
            revision: PositiveRevisionSchema,
            updated_at: Rfc3339TimestampSchema,
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export const DataExportSafetySummarySchema = z
  .object({
    state: z.enum(["CLEAR", "ACTIVE", "RECOVERY_PENDING"]),
    revision: PositiveRevisionSchema,
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const DataExportTaskSummarySchema = z
  .object({
    revision: PositiveRevisionSchema,
    kind: z.enum(["EXPORT", "DELETE"]),
    scope: z.enum(["DAY", "MATTER", "RELATIONSHIP_DATA", "ACCOUNT"]),
    target_summary: singleLineTextSchema(1, 120),
    status: DataTaskStatusSchema,
    online_erased_at: Rfc3339TimestampSchema.optional(),
    backup_purge_deadline: Rfc3339TimestampSchema.optional(),
    failure_summary_code: VersionTokenSchema.optional(),
    created_at: Rfc3339TimestampSchema,
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const DataExportDocumentSchema = z
  .object({
    schema_version: z.literal("data-export-v1"),
    generated_at: Rfc3339TimestampSchema,
    profile: ProfileViewSchema.optional(),
    consent_summary: ConsentViewSchema,
    days: z.array(DataExportDaySchema).max(10_000),
    matters: z.array(DataExportMatterViewSchema).max(1_000),
    relationship_summary: DataExportRelationshipSummarySchema.optional(),
    notification_preferences: DataExportNotificationPreferencesSchema,
    safety_summary: DataExportSafetySummarySchema.optional(),
    data_task_summaries: z.array(DataExportTaskSummarySchema).max(1_000),
  })
  .strict();

export type ConsentAcceptRequest = z.infer<typeof ConsentAcceptRequestSchema>;
export type ConsentWithdrawRequest = z.infer<
  typeof ConsentWithdrawRequestSchema
>;
export type OnboardingCompleteRequest = z.infer<
  typeof OnboardingCompleteRequestSchema
>;
export type ProfileUpdateRequest = z.infer<typeof ProfileUpdateRequestSchema>;
export type StyleCalibrationRequest = z.infer<
  typeof StyleCalibrationRequestSchema
>;
export type CheckinSubmitRequest = z.infer<typeof CheckinSubmitRequestSchema>;
export type CheckinCorrectRequest = z.infer<typeof CheckinCorrectRequestSchema>;
export type GenerationStartRequest = z.infer<
  typeof GenerationStartRequestSchema
>;
export type LightDayRequest = z.infer<typeof LightDayRequestSchema>;
export type TaskStateUpdateRequest = z.infer<
  typeof TaskStateUpdateRequestSchema
>;
export type EveningSaveRequest = z.infer<typeof EveningSaveRequestSchema>;
export type MemoryPreferencesUpdateRequest = z.infer<
  typeof MemoryPreferencesUpdateRequestSchema
>;
export type NotificationSettingsUpdateRequest = z.infer<
  typeof NotificationSettingsUpdateRequestSchema
>;
export type NotificationPermissionSyncRequest = z.infer<
  typeof NotificationPermissionSyncRequestSchema
>;
export type ReauthVerifyRequest = z.infer<typeof ReauthVerifyRequestSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type DeleteDayRequest = z.infer<typeof DeleteDayRequestSchema>;
export type DeleteMatterRequest = z.infer<typeof DeleteMatterRequestSchema>;
export type DayExpectedRevision = z.infer<typeof DayExpectedRevisionSchema>;
export type RelationshipDeletionTarget = z.infer<
  typeof RelationshipDeletionTargetSchema
>;
export type DeleteRelationshipPrepareRequest = z.infer<
  typeof DeleteRelationshipPrepareRequestSchema
>;
export type DeleteRelationshipConfirmRequest = z.infer<
  typeof DeleteRelationshipConfirmRequestSchema
>;
export type DeleteAccountPrepareRequest = z.infer<
  typeof DeleteAccountPrepareRequestSchema
>;
export type DeleteAccountConfirmRequest = z.infer<
  typeof DeleteAccountConfirmRequestSchema
>;
export type DataTaskCancelRequest = z.infer<typeof DataTaskCancelRequestSchema>;
export type DataTaskStatus = z.infer<typeof DataTaskStatusSchema>;
export type ExportArtifactView = z.infer<typeof ExportArtifactViewSchema>;
export type DataTaskView = z.infer<typeof DataTaskViewSchema>;
export type DataTaskListView = z.infer<typeof DataTaskListViewSchema>;
export type DataRightsSummaryView = z.infer<typeof DataRightsSummaryViewSchema>;
export type DeletionStatusGrantView = z.infer<
  typeof DeletionStatusGrantViewSchema
>;
export type AccountDeletionAcceptedView = z.infer<
  typeof AccountDeletionAcceptedViewSchema
>;
export type DeletionConfirmationView = z.infer<
  typeof DeletionConfirmationViewSchema
>;
export type IdentityVerificationView = z.infer<
  typeof IdentityVerificationViewSchema
>;
export type CommandReceiptView = z.infer<typeof CommandReceiptViewSchema>;
export type ConsentView = z.infer<typeof ConsentViewSchema>;
export type ProfileView = z.infer<typeof ProfileViewSchema>;
export type CheckinView = z.infer<typeof CheckinViewSchema>;
export type MemoryPreferencesView = z.infer<typeof MemoryPreferencesViewSchema>;
export type NotificationSettingsView = z.infer<
  typeof NotificationSettingsViewSchema
>;
export type DataExportDocument = z.infer<typeof DataExportDocumentSchema>;
