import * as z from "zod";

import {
  EnergySchema,
  ExpressionStyleSchema,
  MoodSchema,
  OpaqueIdSchema,
  PositiveRevisionSchema,
  ProductDateSchema,
  Rfc3339TimestampSchema,
  SleepSchema,
  TaskStatusSchema,
  VersionTokenSchema,
  WriteWindowSchema,
  singleLineTextSchema,
} from "./common.js";

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

export const TaskStateUpdateRequestSchema = z
  .object({
    ...CommandShape,
    expected_revision: PositiveRevisionSchema,
    product_date: ProductDateSchema,
    status: TaskStatusSchema,
    task_ref: OpaqueIdSchema,
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
export type TaskStateUpdateRequest = z.infer<
  typeof TaskStateUpdateRequestSchema
>;
export type MemoryPreferencesUpdateRequest = z.infer<
  typeof MemoryPreferencesUpdateRequestSchema
>;
export type NotificationSettingsUpdateRequest = z.infer<
  typeof NotificationSettingsUpdateRequestSchema
>;
export type NotificationPermissionSyncRequest = z.infer<
  typeof NotificationPermissionSyncRequestSchema
>;
export type CommandReceiptView = z.infer<typeof CommandReceiptViewSchema>;
export type ConsentView = z.infer<typeof ConsentViewSchema>;
export type ProfileView = z.infer<typeof ProfileViewSchema>;
export type CheckinView = z.infer<typeof CheckinViewSchema>;
export type MemoryPreferencesView = z.infer<typeof MemoryPreferencesViewSchema>;
export type NotificationSettingsView = z.infer<
  typeof NotificationSettingsViewSchema
>;
