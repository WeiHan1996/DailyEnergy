import { z } from "zod";

import {
  ProductDateSchema,
  Rfc3339TimestampSchema,
  SemverSchema,
  VersionTokenSchema,
} from "./common.js";

export const AnalyticsPlaneValues = [
  "PRODUCT",
  "RUNTIME",
  "GOVERNANCE",
  "SAFETY_CONTROL",
] as const;
export const AnalyticsPlaneSchema = z.enum(AnalyticsPlaneValues);
export type AnalyticsPlane = z.infer<typeof AnalyticsPlaneSchema>;

export const AnalyticsEnvironmentValues = [
  "PROD",
  "STAGING",
  "TEST",
  "DEV",
] as const;
export const AnalyticsEnvironmentSchema = z.enum(AnalyticsEnvironmentValues);
export type AnalyticsEnvironment = z.infer<typeof AnalyticsEnvironmentSchema>;

export const AnalyticsSceneCodeValues = [
  "DIRECT",
  "CHANNEL_LANDING",
  "SHARE",
  "NOTIFICATION",
  "OTHER",
] as const;
export const AnalyticsSceneCodeSchema = z.enum(AnalyticsSceneCodeValues);

export const AnalyticsLocaleBucketValues = ["ZH_CN", "OTHER"] as const;
export const AnalyticsLocaleBucketSchema = z.enum(AnalyticsLocaleBucketValues);

export const AnalyticsLatencyBucketValues = [
  "LT_250MS",
  "250_999MS",
  "1_2_99S",
  "3_7_99S",
  "8_14_99S",
  "GE_15S",
  "UNKNOWN",
] as const;
export const AnalyticsQueueAgeBucketValues = [
  "LT_1S",
  "1_4_99S",
  "5_14_99S",
  "15_59_99S",
  "GE_60S",
  "UNKNOWN",
] as const;
export const AnalyticsGenerationModeValues = [
  "AI",
  "CONTROLLED_TEMPLATE",
  "NO_GENERATION",
] as const;
export const AnalyticsCacheOutcomeValues = [
  "HIT",
  "MISS",
  "STALE_REJECTED",
  "NOT_APPLICABLE",
] as const;

const EVENT_NAMES = [
  "app_launch_resolved",
  "landing_viewed",
  "landing_primary_action_clicked",
  "consent_accepted",
  "consent_withdrawn",
  "onboarding_completed",
  "checkin_submitted",
  "checkin_corrected",
  "checkin_rebuilt",
  "generation_started",
  "daily_result_available",
  "daily_result_read",
  "main_action_reached",
  "dimensions_expanded",
  "day_lit",
  "task_status_updated",
  "helpfulness_updated",
  "evening_saved",
  "evening_updated",
  "evening_skipped",
  "weekly_view_read",
  "weekly_summary_read",
  "history_day_read",
  "settings_viewed",
  "faq_opened",
  "profile_updated",
  "style_calibration_saved",
  "matter_created",
  "matter_updated",
  "matter_status_changed",
  "matter_deleted",
  "notification_settings_updated",
  "notification_permission_observed",
  "notification_intent_outcome",
  "notification_deeplink_resolved",
  "share_preview_created",
  "share_intent_created",
  "support_feedback_submitted",
  "data_rights_entry_viewed",
  "data_task_created",
  "data_task_stage_changed",
  "data_task_sla_outcome",
  "deleted_data_reactivation_blocked",
  "api_operation_outcome",
  "product_date_resolution_outcome",
  "generation_runtime_outcome",
  "cache_lookup_outcome",
  "queue_stage_outcome",
  "gateway_usage_aggregate",
  "notification_dispatch_outcome",
  "raw_content_detector_outcome",
  "provider_profile_conformance_outcome",
  "release_contract_outcome",
  "safety_input_gate_outcome",
  "safety_fixed_response_outcome",
  "safety_resource_registry_outcome",
  "safety_resource_action_aggregate",
  "safety_recovery_outcome",
] as const;

export const AnalyticsEventNameValues = EVENT_NAMES;
export const AnalyticsEventNameSchema = z.enum(EVENT_NAMES);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;

type EventKind = "AUTHORITY_FACT" | "SERVER_PROJECTION" | "CLIENT_SIGNAL";
type PropertyRule = readonly string[] | "VERSION_BUCKET" | "BOOLEAN";

interface EventContract {
  readonly id: string;
  readonly kind: EventKind;
  readonly plane: AnalyticsPlane;
  readonly properties: Readonly<Record<string, PropertyRule>>;
}

const values = <const Values extends readonly string[]>(input: Values) => input;
const none = Object.freeze({}) as Readonly<Record<string, PropertyRule>>;

export const AnalyticsEventRegistry = Object.freeze({
  app_launch_resolved: event("S24-P01", "PRODUCT", "SERVER_PROJECTION", {
    latency_bucket: values(AnalyticsLatencyBucketValues),
    outcome_code: values([
      "SAFETY",
      "DELETING",
      "AUTH",
      "CONSENT",
      "ONBOARDING",
      "CHECKIN",
      "GENERATION",
      "TODAY",
      "OTHER",
    ]),
    scene_code: values(AnalyticsSceneCodeValues),
  }),
  landing_viewed: event("S24-P02", "PRODUCT", "CLIENT_SIGNAL", {
    scene_code: values(AnalyticsSceneCodeValues),
    surface_version_bucket: "VERSION_BUCKET",
  }),
  landing_primary_action_clicked: event("S24-P03", "PRODUCT", "CLIENT_SIGNAL", {
    scene_code: values(AnalyticsSceneCodeValues),
    surface_version_bucket: "VERSION_BUCKET",
  }),
  consent_accepted: event("S24-P04", "PRODUCT", "AUTHORITY_FACT", {
    notice_version_bucket: "VERSION_BUCKET",
  }),
  consent_withdrawn: event("S24-P05", "PRODUCT", "AUTHORITY_FACT", {
    notice_version_bucket: "VERSION_BUCKET",
  }),
  onboarding_completed: event("S24-P06", "PRODUCT", "AUTHORITY_FACT", none),
  checkin_submitted: event("S24-P07", "PRODUCT", "AUTHORITY_FACT", none),
  checkin_corrected: event("S24-P08", "PRODUCT", "AUTHORITY_FACT", none),
  checkin_rebuilt: event("S24-P09", "PRODUCT", "AUTHORITY_FACT", {
    generation_mode: values(["CONTROLLED_TEMPLATE"]),
  }),
  generation_started: event("S24-P10", "PRODUCT", "AUTHORITY_FACT", {
    generation_mode: values(["AI"]),
  }),
  daily_result_available: event("S24-P11", "PRODUCT", "AUTHORITY_FACT", {
    cache_outcome: values(AnalyticsCacheOutcomeValues),
    generation_mode: values(AnalyticsGenerationModeValues),
    latency_bucket: values(AnalyticsLatencyBucketValues),
  }),
  daily_result_read: event("S24-P12", "PRODUCT", "SERVER_PROJECTION", {
    cache_outcome: values(AnalyticsCacheOutcomeValues),
    generation_mode: values(AnalyticsGenerationModeValues),
  }),
  main_action_reached: event("S24-P13", "PRODUCT", "CLIENT_SIGNAL", none),
  dimensions_expanded: event("S24-P14", "PRODUCT", "CLIENT_SIGNAL", none),
  day_lit: event("S24-P15", "PRODUCT", "AUTHORITY_FACT", none),
  task_status_updated: event("S24-P16", "PRODUCT", "AUTHORITY_FACT", {
    task_status: values(["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"]),
  }),
  helpfulness_updated: event("S24-P17", "PRODUCT", "AUTHORITY_FACT", {
    helpfulness: values(["HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"]),
  }),
  evening_saved: event("S24-P18", "PRODUCT", "AUTHORITY_FACT", none),
  evening_updated: event("S24-P19", "PRODUCT", "AUTHORITY_FACT", none),
  evening_skipped: event("S24-P20", "PRODUCT", "AUTHORITY_FACT", none),
  weekly_view_read: event("S24-P21", "PRODUCT", "SERVER_PROJECTION", {
    summary_status: values(["AVAILABLE", "ABSENT", "INVALIDATED", "FAILED"]),
  }),
  weekly_summary_read: event("S24-P22", "PRODUCT", "CLIENT_SIGNAL", none),
  history_day_read: event("S24-P23", "PRODUCT", "SERVER_PROJECTION", {
    day_state: values(["AVAILABLE", "MISSING"]),
  }),
  settings_viewed: event("S24-P24", "PRODUCT", "CLIENT_SIGNAL", none),
  faq_opened: event("S24-P25", "PRODUCT", "CLIENT_SIGNAL", {
    faq_category_code: values([
      "PRODUCT",
      "PRIVACY",
      "SAFETY",
      "DATA_RIGHTS",
      "ACCOUNT",
      "NOTIFICATIONS",
      "SUPPORT",
      "OTHER",
    ]),
  }),
  profile_updated: event("S24-O01", "PRODUCT", "AUTHORITY_FACT", {
    change_group: values(["NAME_OR_STYLE", "STYLE_ONLY"]),
  }),
  style_calibration_saved: event("S24-O02", "PRODUCT", "AUTHORITY_FACT", none),
  matter_created: event("S24-O03", "PRODUCT", "AUTHORITY_FACT", none),
  matter_updated: event("S24-O04", "PRODUCT", "AUTHORITY_FACT", none),
  matter_status_changed: event("S24-O05", "PRODUCT", "AUTHORITY_FACT", {
    matter_status: values(["ACTIVE", "PAUSED", "COMPLETED"]),
  }),
  matter_deleted: event("S24-O06", "PRODUCT", "AUTHORITY_FACT", none),
  notification_settings_updated: event("S24-O07", "PRODUCT", "AUTHORITY_FACT", {
    enabled: "BOOLEAN",
    notification_type: values(["MORNING", "EVENING", "OTHER"]),
  }),
  notification_permission_observed: event(
    "S24-O08",
    "PRODUCT",
    "AUTHORITY_FACT",
    { permission_state: values(["GRANTED", "DENIED", "UNKNOWN"]) },
  ),
  notification_intent_outcome: event("S24-O09", "PRODUCT", "AUTHORITY_FACT", {
    intent_outcome: values(["CANCELLED", "SUPPRESSED", "SENT", "EXPIRED"]),
    notification_type: values(["MORNING", "EVENING", "OTHER"]),
  }),
  notification_deeplink_resolved: event(
    "S24-O10",
    "PRODUCT",
    "SERVER_PROJECTION",
    {
      deeplink_outcome: values([
        "VALID",
        "EXPIRED",
        "SOURCE_GONE",
        "GUARD_BLOCKED",
      ]),
      notification_type: values(["MORNING", "EVENING", "OTHER"]),
    },
  ),
  share_preview_created: event("S24-O11", "PRODUCT", "AUTHORITY_FACT", {
    share_surface: values(["DAILY", "WEEKLY"]),
  }),
  share_intent_created: event("S24-O12", "PRODUCT", "AUTHORITY_FACT", {
    share_surface: values(["DAILY", "WEEKLY"]),
  }),
  support_feedback_submitted: event(
    "S24-O13",
    "PRODUCT",
    "SERVER_PROJECTION",
    none,
  ),
  data_rights_entry_viewed: event("S24-O14", "PRODUCT", "CLIENT_SIGNAL", none),
  data_task_created: event("S24-G01", "GOVERNANCE", "AUTHORITY_FACT", {
    scope: values(["DAY", "ACCOUNT"]),
    task_kind: values(["EXPORT", "DELETE"]),
  }),
  data_task_stage_changed: event("S24-G02", "GOVERNANCE", "AUTHORITY_FACT", {
    scope: values(["DAY", "ACCOUNT"]),
    stage_code: values([
      "PENDING",
      "RUNNING",
      "FAILED",
      "SUCCEEDED",
      "CANCELLED",
    ]),
    task_kind: values(["EXPORT", "DELETE"]),
  }),
  data_task_sla_outcome: event("S24-G03", "GOVERNANCE", "SERVER_PROJECTION", {
    scope: values(["DAY", "ACCOUNT"]),
    sla_outcome: values(["MET", "BREACHED", "UNKNOWN"]),
    task_kind: values(["EXPORT", "DELETE"]),
  }),
  deleted_data_reactivation_blocked: event(
    "S24-G04",
    "GOVERNANCE",
    "SERVER_PROJECTION",
    {
      subsystem: values([
        "CACHE",
        "QUEUE",
        "BACKUP",
        "PROVIDER",
        "CLIENT",
        "OTHER",
      ]),
    },
  ),
  api_operation_outcome: event("S24-R01", "RUNTIME", "SERVER_PROJECTION", {
    failure_class: values([
      "AUTH",
      "GUARD",
      "VALIDATION",
      "CONFLICT",
      "RATE_LIMIT",
      "TRANSIENT",
      "TERMINAL",
      "SAFETY",
    ]),
    latency_bucket: values(AnalyticsLatencyBucketValues),
    operation_group: values([
      "AUTH",
      "BOOTSTRAP",
      "CONSENT",
      "PROFILE",
      "DAILY",
      "EVENING",
      "WEEKLY",
      "HISTORY",
      "MATTERS",
      "MEMORY",
      "NOTIFICATIONS",
      "SHARE",
      "SAFETY",
      "DATA_RIGHTS",
      "SUPPORT",
      "ADMIN",
      "OTHER",
    ]),
    outcome_code: values(["SUCCESS", "FAILURE"]),
  }),
  product_date_resolution_outcome: event(
    "S24-R02",
    "RUNTIME",
    "SERVER_PROJECTION",
    {
      outcome_code: values(["SUCCESS", "FAILURE"]),
      policy_version_bucket: "VERSION_BUCKET",
    },
  ),
  generation_runtime_outcome: event("S24-R03", "RUNTIME", "SERVER_PROJECTION", {
    generation_mode: values(AnalyticsGenerationModeValues),
    latency_bucket: values(AnalyticsLatencyBucketValues),
    outcome_code: values(["AVAILABLE", "FAILED", "CANCELLED", "UNKNOWN"]),
    workload: values(["DAILY", "WEEKLY"]),
  }),
  cache_lookup_outcome: event("S24-R04", "RUNTIME", "SERVER_PROJECTION", {
    cache_group: values(["DAILY_CONTENT", "WEEKLY_VIEW", "OTHER"]),
    cache_outcome: values(AnalyticsCacheOutcomeValues),
  }),
  queue_stage_outcome: event("S24-R05", "RUNTIME", "SERVER_PROJECTION", {
    outcome_code: values(["SUCCESS", "FAILURE", "RETRYABLE", "DUPLICATE"]),
    queue_age_bucket: values(AnalyticsQueueAgeBucketValues),
    queue_group: values(["INTERACTIVE", "BACKGROUND", "RESTRICTED", "OTHER"]),
  }),
  gateway_usage_aggregate: event("S24-R06", "RUNTIME", "AUTHORITY_FACT", {
    generation_mode: values(AnalyticsGenerationModeValues),
    usage_outcome: values(["KNOWN", "UNKNOWN"]),
    workload: values(["DAILY", "WEEKLY"]),
  }),
  notification_dispatch_outcome: event("S24-R07", "RUNTIME", "AUTHORITY_FACT", {
    intent_outcome: values(["CANCELLED", "SUPPRESSED", "SENT", "EXPIRED"]),
    notification_type: values(["MORNING", "EVENING", "OTHER"]),
  }),
  raw_content_detector_outcome: event(
    "S24-R08",
    "RUNTIME",
    "SERVER_PROJECTION",
    {
      outcome_code: values(["CLEAN", "MATCH", "BLOCKED", "FAILED"]),
      subsystem: values([
        "CONTRACT",
        "QUEUE",
        "LOG",
        "AGGREGATE",
        "EXPORT",
        "OTHER",
      ]),
    },
  ),
  provider_profile_conformance_outcome: event(
    "S24-R09",
    "RUNTIME",
    "SERVER_PROJECTION",
    {
      outcome_code: values(["PASS", "DRIFT", "UNKNOWN"]),
      workload: values(["DAILY", "WEEKLY"]),
    },
  ),
  release_contract_outcome: event("S24-R10", "RUNTIME", "SERVER_PROJECTION", {
    contract_group: values([
      "SCHEMA",
      "API",
      "EVENT",
      "METRIC",
      "DATABASE",
      "OTHER",
    ]),
    outcome_code: values(["PASS", "FAIL"]),
  }),
  safety_input_gate_outcome: event(
    "S24-S01",
    "SAFETY_CONTROL",
    "SERVER_PROJECTION",
    {
      latency_bucket: values(AnalyticsLatencyBucketValues),
      outcome_code: values(["ORDINARY", "DIVERTED", "INDETERMINATE"]),
      surface_bucket: values([
        "PROFILE",
        "EVENING",
        "MATTER",
        "SUPPORT",
        "OTHER",
      ]),
    },
  ),
  safety_fixed_response_outcome: event(
    "S24-S02",
    "SAFETY_CONTROL",
    "SERVER_PROJECTION",
    {
      outcome_code: values(["PRIMARY", "FALLBACK", "FAILED"]),
      response_version_bucket: "VERSION_BUCKET",
    },
  ),
  safety_resource_registry_outcome: event(
    "S24-S03",
    "SAFETY_CONTROL",
    "SERVER_PROJECTION",
    { resource_outcome: values(["PRIMARY", "FALLBACK", "GENERIC", "FAILED"]) },
  ),
  safety_resource_action_aggregate: event(
    "S24-S04",
    "SAFETY_CONTROL",
    "AUTHORITY_FACT",
    { action_type: values(["CALL", "OPEN_LINK", "COPY", "OTHER"]) },
  ),
  safety_recovery_outcome: event(
    "S24-S05",
    "SAFETY_CONTROL",
    "AUTHORITY_FACT",
    {
      outcome_code: values(["ACCEPTED", "REJECTED", "CONFLICT"]),
      recovery_step: values(["START", "CONFIRM"]),
    },
  ),
} satisfies Record<AnalyticsEventName, EventContract>);

function event(
  id: string,
  plane: AnalyticsPlane,
  kind: EventKind,
  properties: Readonly<Record<string, PropertyRule>>,
): EventContract {
  return Object.freeze({ id, kind, plane, properties });
}

const PropertyBagSchema = z.record(z.string().min(1).max(64), z.unknown());
const VersionBucketSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^(?:[A-Z][A-Z0-9_]{0,30}|OTHER)$/u);
const AppVersionBucketSchema = z.union([
  z.literal("OTHER"),
  z.string().regex(/^\d+\.\d+$/u),
]);
export const ClientAnalyticsAppVersionBucketValues = ["0.1", "OTHER"] as const;
export const ClientAnalyticsSurfaceVersionBucketValues = [
  "LANDING_V1",
] as const;
const ClientAnalyticsSurfaceVersionBucketSchema = z.enum(
  ClientAnalyticsSurfaceVersionBucketValues,
);
const AnalyticsDimensionCodeSchema = z.union([
  VersionBucketSchema,
  AppVersionBucketSchema,
  ProductDateSchema,
]);

export const AnalyticsProjectionV1Schema = z
  .strictObject({
    app_version_bucket: AppVersionBucketSchema.optional(),
    environment: AnalyticsEnvironmentSchema,
    event_name: AnalyticsEventNameSchema,
    event_properties: PropertyBagSchema.optional(),
    event_schema_version: z.literal(1),
    locale_bucket: AnalyticsLocaleBucketSchema.optional(),
    plane: AnalyticsPlaneSchema,
    product_date: ProductDateSchema,
    product_date_policy_version: VersionTokenSchema,
    server_received_at: Rfc3339TimestampSchema,
  })
  .superRefine((input, context) => {
    const contract = AnalyticsEventRegistry[input.event_name];
    if (input.plane !== contract.plane) {
      context.addIssue({
        code: "custom",
        message: "event plane does not match the registry",
        path: ["plane"],
      });
    }
    const properties = input.event_properties ?? {};
    for (const [key, value] of Object.entries(properties)) {
      const rule = contract.properties[key];
      if (rule === undefined) {
        context.addIssue({
          code: "custom",
          message: "property is not allowed for this event",
          path: ["event_properties", key],
        });
        continue;
      }
      if (rule === "BOOLEAN" && typeof value !== "boolean") {
        context.addIssue({
          code: "custom",
          message: "property must be boolean",
          path: ["event_properties", key],
        });
      } else if (rule === "VERSION_BUCKET") {
        const result = VersionBucketSchema.safeParse(value);
        if (!result.success) {
          context.addIssue({
            code: "custom",
            message: "property must be a registered version bucket",
            path: ["event_properties", key],
          });
        }
      } else if (
        Array.isArray(rule) &&
        (typeof value !== "string" || !rule.includes(value))
      ) {
        context.addIssue({
          code: "custom",
          message: "property value is outside the registry",
          path: ["event_properties", key],
        });
      }
    }
  });
export type AnalyticsProjectionV1 = z.infer<typeof AnalyticsProjectionV1Schema>;

const ClientSignalBase = {
  app_version: SemverSchema,
  event_schema_version: z.literal(1),
  locale: z.enum(["zh-CN", "other"]),
};

export const ClientAnalyticsSignalRequestSchema = z.discriminatedUnion(
  "event_name",
  [
    z.strictObject({
      ...ClientSignalBase,
      event_name: z.literal("landing_viewed"),
      scene_code: AnalyticsSceneCodeSchema,
      surface_version_bucket: ClientAnalyticsSurfaceVersionBucketSchema,
    }),
    z.strictObject({
      ...ClientSignalBase,
      event_name: z.literal("landing_primary_action_clicked"),
      scene_code: AnalyticsSceneCodeSchema,
      surface_version_bucket: ClientAnalyticsSurfaceVersionBucketSchema,
    }),
    z.strictObject({
      ...ClientSignalBase,
      event_name: z.literal("main_action_reached"),
    }),
    z.strictObject({
      ...ClientSignalBase,
      event_name: z.literal("dimensions_expanded"),
    }),
    z.strictObject({
      ...ClientSignalBase,
      event_name: z.literal("weekly_summary_read"),
    }),
    z.strictObject({
      ...ClientSignalBase,
      event_name: z.literal("settings_viewed"),
    }),
    z.strictObject({
      ...ClientSignalBase,
      event_name: z.literal("faq_opened"),
      faq_category_code: z.enum(
        AnalyticsEventRegistry.faq_opened.properties
          .faq_category_code as readonly [string, ...string[]],
      ),
    }),
    z.strictObject({
      ...ClientSignalBase,
      event_name: z.literal("data_rights_entry_viewed"),
    }),
  ],
);
export type ClientAnalyticsSignalRequest = z.infer<
  typeof ClientAnalyticsSignalRequestSchema
>;

export const ClientAnalyticsSignalAcceptedViewSchema = z.strictObject({
  accepted: z.literal(true),
});
export type ClientAnalyticsSignalAcceptedView = z.infer<
  typeof ClientAnalyticsSignalAcceptedViewSchema
>;

export const AnonymousDailyAggregateV1Schema = z.strictObject({
  aggregate_schema_version: z.literal("anonymous-daily-aggregate-v1"),
  aggregation_revision: z.number().int().positive(),
  dimensions: z
    .array(
      z.strictObject({
        code: AnalyticsDimensionCodeSchema,
        name: VersionTokenSchema,
      }),
    )
    .max(2),
  environment: AnalyticsEnvironmentSchema,
  event_count: z.number().int().nonnegative(),
  event_name: AnalyticsEventNameSchema,
  event_schema_version: z.literal(1),
  expires_at: Rfc3339TimestampSchema,
  generated_at: Rfc3339TimestampSchema,
  plane: AnalyticsPlaneSchema,
  product_date: ProductDateSchema,
  source_contract_version: VersionTokenSchema,
  sum_value: z.number().int().nonnegative().optional(),
  unique_owner_count: z.number().int().nonnegative().optional(),
});
export type AnonymousDailyAggregateV1 = z.infer<
  typeof AnonymousDailyAggregateV1Schema
>;

export const MetricIdValues = [
  "S25-M01",
  "S25-M02",
  "S25-M03",
  "S25-M04",
  "S25-M05",
  "S25-M06",
  "S25-M07",
  "S25-M08",
  "S25-M09",
  "S25-M10",
  "S25-M11",
  "S25-M12",
  "S25-M13",
  "S25-M14",
  "S25-M15",
  "S25-M16",
  "S25-M17",
  "S25-M18",
  "S25-M19",
  "S25-M20",
  "S25-M21",
  "S25-M22",
  "S25-M23",
] as const;
export const MetricIdSchema = z.enum(MetricIdValues);
export const MetricGateIdValues = [
  "S25-G01",
  "S25-G02",
  "S25-G03",
  "S25-G04",
] as const;
export const MetricGateIdSchema = z.enum(MetricGateIdValues);
export const ResearchMetricIdValues = ["S25-Q01", "S25-Q02"] as const;

export const MetricGateReportV1Schema = z.strictObject({
  aggregation_revision: z.number().int().positive(),
  gate_id: MetricGateIdSchema,
  generated_at: Rfc3339TimestampSchema,
  reason_codes: z
    .array(
      z.enum([
        "CONTRACT_FAILURE",
        "RAW_CONTENT_MATCH",
        "SMALL_CELL_OR_JOIN_PATH",
        "DELETION_OR_TTL_BREACH",
      ]),
    )
    .max(4),
  status: z.enum(["PASS", "BLOCKED"]),
});
export type MetricGateReportV1 = z.infer<typeof MetricGateReportV1Schema>;

export const MetricRegistry = Object.freeze(
  Object.fromEntries(
    MetricIdValues.map((metricId) => [
      metricId,
      Object.freeze({ metricId, metricVersion: 1 }),
    ]),
  ) as Record<
    (typeof MetricIdValues)[number],
    {
      readonly metricId: (typeof MetricIdValues)[number];
      readonly metricVersion: 1;
    }
  >,
);

export const MetricStatusValues = [
  "PROVISIONAL",
  "FINALIZED",
  "SUPPRESSED",
  "BLOCKED",
  "UNAVAILABLE",
] as const;
export const MetricNotesCodeValues = [
  "PROVISIONAL",
  "TEMPLATE_INCLUDED",
  "BEST_EFFORT_SIGNAL",
  "POST_AGGREGATION_DELETION_NOT_RESTATED",
  "CHANNEL_UNAVAILABLE",
  "SOURCE_INCOMPLETE",
  "SOURCE_UNAVAILABLE",
] as const;

export const MetricReportV1Schema = z
  .strictObject({
    aggregation_revision: z.number().int().positive(),
    denominator: z.number().int().nonnegative().optional(),
    dimensions: z
      .array(
        z.strictObject({
          code: AnalyticsDimensionCodeSchema,
          name: VersionTokenSchema,
        }),
      )
      .max(2),
    expires_at: Rfc3339TimestampSchema,
    generated_at: Rfc3339TimestampSchema,
    metric_id: MetricIdSchema,
    metric_version: z.literal(1),
    notes_code: z.array(z.enum(MetricNotesCodeValues)).max(5),
    numerator: z.number().int().nonnegative().optional(),
    period_or_cohort: ProductDateSchema,
    source_contract_version: VersionTokenSchema,
    status: z.enum(MetricStatusValues),
    value: z.number().nonnegative().optional(),
    wilson_high: z.number().min(0).max(1).optional(),
    wilson_low: z.number().min(0).max(1).optional(),
  })
  .superRefine((report, context) => {
    const publishesExact = ["PROVISIONAL", "FINALIZED"].includes(report.status);
    if (
      publishesExact &&
      (report.numerator === undefined ||
        report.denominator === undefined ||
        report.value === undefined ||
        report.denominator < 10)
    ) {
      context.addIssue({
        code: "custom",
        message: "published metrics require an exact k-safe ratio",
        path: ["status"],
      });
    }
    if (
      !publishesExact &&
      [report.numerator, report.denominator, report.value].some(
        (value) => value !== undefined,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "non-published metrics cannot expose exact values",
        path: ["status"],
      });
    }
  });
export type MetricReportV1 = z.infer<typeof MetricReportV1Schema>;
