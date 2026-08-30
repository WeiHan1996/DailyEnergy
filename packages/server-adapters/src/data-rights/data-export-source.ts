import { timingSafeEqual } from "node:crypto";

import {
  ConsentViewSchema,
  DataExportCheckinViewSchema,
  DataExportInteractionViewSchema,
  DataExportNotificationPreferencesSchema,
  DataExportSafetySummarySchema,
  DataExportTaskSummarySchema,
  PublishedDailyResultSchema,
  type DataExportDocument,
  type ProfileView,
} from "@daily-energy/shared-schemas";
import {
  dailyResultFingerprintV1,
  projectClientDailyContentViewV1,
} from "@daily-energy/server-core/content-publication";
import { z } from "zod";

const ProtectedTextSchema = z
  .object({
    ciphertext: z.string().min(1),
    key_version: z.string().min(1).max(64),
  })
  .strict();

const RawProfileSchema = z
  .object({
    revision: z.number().int().positive(),
    preferred_name_protected: ProtectedTextSchema.optional(),
    expression_style: z.enum([
      "BALANCED",
      "GENTLE",
      "LIGHT_HUMOR",
      "CLEAR_DIRECT",
    ]),
    onboarding_completed: z.boolean(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict();

const RawResultSourceSchema = z
  .object({
    result_id: z.uuid(),
    input_snapshot_id: z.uuid(),
    result_version: z.string().min(1).max(64),
    schema_version: z.string().min(1).max(64),
    generated_at: z.iso.datetime({ offset: true }),
    rule_facts_payload: z.unknown(),
    expression_core_payload: z.unknown(),
    provenance_payload: z.unknown(),
    validation_receipt: z.unknown(),
    result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();

const RawEveningSchema = z
  .object({
    revision: z.number().int().positive(),
    overall_feeling: z.enum([
      "VERY_HEAVY",
      "SOMEWHAT_HEAVY",
      "STEADY",
      "PRETTY_GOOD",
      "LIGHT",
      "UNSURE",
    ]),
    note_protected: ProtectedTextSchema.optional(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict();

const RawDaySchema = z
  .object({
    product_date: z.iso.date(),
    checkin: DataExportCheckinViewSchema.optional(),
    result_source: RawResultSourceSchema.optional(),
    interaction: DataExportInteractionViewSchema.optional(),
    evening: RawEveningSchema.optional(),
  })
  .strict();

const RawMatterSchema = z
  .object({
    revision: z.number().int().positive(),
    title_protected: ProtectedTextSchema,
    target_date: z.iso.date().nullable(),
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "EXPIRED"]),
    daily_use_granted: z.boolean(),
    weekly_use_granted: z.boolean(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict();

const RawRelationshipSchema = z
  .object({
    revision: z.number().int().positive(),
    state: z.literal("PRESENT"),
    encounter_day_count: z.number().int().nonnegative(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict();

const RawExportSourceSchema = z
  .object({
    profile: RawProfileSchema.nullable(),
    consent_summary: ConsentViewSchema,
    days: z.array(RawDaySchema).max(10_000),
    matters: z.array(RawMatterSchema).max(1_000),
    relationship_summary: RawRelationshipSchema.nullable(),
    notification_preferences: DataExportNotificationPreferencesSchema,
    safety_summary: DataExportSafetySummarySchema.nullable(),
    data_task_summaries: z.array(DataExportTaskSummarySchema).max(1_000),
  })
  .strict();

const ExportReadResultSchema = z.discriminatedUnion("outcome", [
  z
    .object({
      outcome: z.enum(["INVALID", "EXPIRED", "SOURCE_CHANGED", "NOT_READY"]),
    })
    .strict(),
  z
    .object({
      outcome: z.literal("READY"),
      ready_at: z.iso.datetime({ offset: true }),
      source_payload: RawExportSourceSchema,
    })
    .strict(),
]);

export interface ProtectedExportText {
  readonly ciphertext: Buffer;
  readonly keyVersion: string;
}

export interface StoredExportProfile extends Omit<
  ProfileView,
  "preferred_name"
> {
  readonly preferredName?: ProtectedExportText;
}

export interface StoredExportEvening extends Omit<
  NonNullable<DataExportDocument["days"][number]["evening"]>,
  "note"
> {
  readonly note?: ProtectedExportText;
}

export interface StoredExportDay extends Omit<
  DataExportDocument["days"][number],
  "evening"
> {
  readonly evening?: StoredExportEvening;
}

export interface StoredExportMatter extends Omit<
  DataExportDocument["matters"][number],
  "title"
> {
  readonly title: ProtectedExportText;
}

export interface StoredDataExportSource {
  readonly consentSummary: DataExportDocument["consent_summary"];
  readonly dataTaskSummaries: DataExportDocument["data_task_summaries"];
  readonly days: readonly StoredExportDay[];
  readonly matters: readonly StoredExportMatter[];
  readonly notificationPreferences: DataExportDocument["notification_preferences"];
  readonly profile?: StoredExportProfile;
  readonly relationshipSummary?: DataExportDocument["relationship_summary"];
  readonly safetySummary?: DataExportDocument["safety_summary"];
}

export type ExportArtifactReadResult =
  | { readonly status: "EXPIRED" | "INVALID" | "NOT_READY" | "SOURCE_CHANGED" }
  | {
      readonly readyAt: Date;
      readonly source: StoredDataExportSource;
      readonly status: "READY";
    };

export function parseExportArtifactReadResult(
  value: unknown,
  accountId: string,
): ExportArtifactReadResult {
  const parsed = ExportReadResultSchema.parse(value);
  if (parsed.outcome !== "READY") {
    return { status: parsed.outcome };
  }
  return {
    readyAt: new Date(parsed.ready_at),
    source: projectSource(parsed.source_payload, accountId),
    status: "READY",
  };
}

function projectSource(
  source: z.infer<typeof RawExportSourceSchema>,
  accountId: string,
): StoredDataExportSource {
  return {
    consentSummary: source.consent_summary,
    dataTaskSummaries: source.data_task_summaries,
    days: source.days.map((day) => projectDay(day, accountId)),
    matters: source.matters.map((matter) => ({
      daily_use_granted: matter.daily_use_granted,
      revision: matter.revision,
      status: matter.status,
      ...(matter.target_date === null
        ? {}
        : { target_date: matter.target_date }),
      title: protectedText(matter.title_protected),
      updated_at: matter.updated_at,
      weekly_use_granted: matter.weekly_use_granted,
    })),
    notificationPreferences: source.notification_preferences,
    ...(source.profile === null
      ? {}
      : {
          profile: {
            expression_style: source.profile.expression_style,
            onboarding_completed: source.profile.onboarding_completed,
            ...(source.profile.preferred_name_protected === undefined
              ? {}
              : {
                  preferredName: protectedText(
                    source.profile.preferred_name_protected,
                  ),
                }),
            revision: source.profile.revision,
            updated_at: source.profile.updated_at,
          },
        }),
    ...(source.relationship_summary === null
      ? {}
      : {
          relationshipSummary: {
            ...source.relationship_summary,
            stage: relationshipStage(
              source.relationship_summary.encounter_day_count,
            ),
          },
        }),
    ...(source.safety_summary === null
      ? {}
      : { safetySummary: source.safety_summary }),
  };
}

function projectDay(
  day: z.infer<typeof RawDaySchema>,
  accountId: string,
): StoredExportDay {
  const content =
    day.result_source === undefined
      ? undefined
      : projectDailyResult(day.result_source, day.product_date, accountId);
  return {
    product_date: day.product_date,
    ...(day.checkin === undefined ? {} : { checkin: day.checkin }),
    ...(content === undefined ? {} : { content }),
    ...(day.interaction === undefined ? {} : { interaction: day.interaction }),
    ...(day.evening === undefined
      ? {}
      : {
          evening: {
            overall_feeling: day.evening.overall_feeling,
            revision: day.evening.revision,
            ...(day.evening.note_protected === undefined
              ? {}
              : { note: protectedText(day.evening.note_protected) }),
            updated_at: day.evening.updated_at,
          },
        }),
  };
}

function projectDailyResult(
  source: z.infer<typeof RawResultSourceSchema>,
  productDate: string,
  accountId: string,
) {
  const result = PublishedDailyResultSchema.parse({
    contract: "daily-content",
    schema_version: source.schema_version,
    identity: {
      result_id: source.result_id,
      user_ref: accountId,
      product_date: productDate,
      result_version: source.result_version,
      generated_at: source.generated_at,
    },
    input_snapshot_ref: source.input_snapshot_id,
    facts: source.rule_facts_payload,
    expression: source.expression_core_payload,
    source_dependencies: [],
    privacy_fallbacks: {},
    provenance: source.provenance_payload,
    validation: source.validation_receipt,
  });
  const expected = dailyResultFingerprintV1(result);
  const actual = Buffer.from(source.result_fingerprint, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("DATA_EXPORT_RESULT_FINGERPRINT_MISMATCH");
  }
  return projectClientDailyContentViewV1(result);
}

function protectedText(
  value: z.infer<typeof ProtectedTextSchema>,
): ProtectedExportText {
  return {
    ciphertext: Buffer.from(value.ciphertext.replace(/\s+/gu, ""), "base64"),
    keyVersion: value.key_version,
  };
}

function relationshipStage(count: number) {
  return count === 0
    ? ("BEFORE_FIRST_MEETING" as const)
    : count < 3
      ? ("NEWLY_MET" as const)
      : count < 7
        ? ("BECOMING_FAMILIAR" as const)
        : ("FIRST_WEEK_RECORDED" as const);
}
