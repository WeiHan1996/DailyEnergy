import { z } from "zod";

export const TELEMETRY_SCHEMA_VERSION = "dailyenergy-telemetry-v1";

export const TELEMETRY_ENVIRONMENTS = [
  "LOCAL",
  "CI",
  "DEV",
  "STAGING",
  "PRODUCTION",
  "RECOVERY",
] as const;

export const TELEMETRY_SERVICES = [
  "api",
  "admin",
  "interactive",
  "background",
  "restricted",
  "collector",
  "database",
  "redis",
] as const;

export const TELEMETRY_RUNTIME_PROFILES = [
  "API",
  "ADMIN",
  "INTERACTIVE",
  "BACKGROUND",
  "RESTRICTED",
  "MIGRATION",
  "EVALUATION",
] as const;

export const TELEMETRY_OPERATION_CODES = [
  "ADMIN_OPS_PLACEHOLDER",
  "API_LIFECYCLE",
  "AUTH_SESSION_LOGOUT",
  "AUTH_SESSION_REFRESH",
  "CHECKIN_CORRECT",
  "CHECKIN_READ",
  "CHECKIN_SUBMIT",
  "CONSENT_ACCEPT",
  "CONSENT_CURRENT",
  "CONSENT_WITHDRAW",
  "DAILY_TODAY_READ",
  "DAILY_HISTORY_READ",
  "DAILY_INTERACTION_READ",
  "DAILY_LIGHT_CREATE",
  "DAILY_TASK_UPDATE",
  "HISTORY_LIST_READ",
  "BACKUP_VERIFY",
  "DATA_TASK_STEP",
  "GATEWAY_INVOKE",
  "GENERATION_START",
  "GENERATION_STATUS",
  "HEALTH_LIVE",
  "HEALTH_READY",
  "HEALTH_STARTUP",
  "MEMORY_PREFERENCES_READ",
  "MEMORY_PREFERENCES_UPDATE",
  "NOTIFICATION_PERMISSION_SYNC",
  "NOTIFICATION_SETTINGS_READ",
  "NOTIFICATION_SETTINGS_UPDATE",
  "ONBOARDING_COMPLETE",
  "PROFILE_READ",
  "PROFILE_STYLE_CALIBRATION",
  "PROFILE_UPDATE",
  "OUTBOX_RELAY",
  "PUBLIC_BOOTSTRAP_PLACEHOLDER",
  "PUBLIC_WECHAT_SESSION_PLACEHOLDER",
  "QUEUE_CONNECT",
  "QUEUE_DRAIN",
  "QUEUE_ENQUEUE",
  "QUEUE_HANDLE",
  "REDIS_REBUILD",
  "RELEASE_OBSERVATION",
  "TELEMETRY_EXPORT",
  "UNKNOWN_HTTP",
  "WORKER_LIFECYCLE",
] as const;

export const TELEMETRY_OUTCOME_CODES = [
  "SUCCESS",
  "EXPECTED_REJECT",
  "DUPLICATE",
  "RETRYABLE",
  "TERMINAL",
  "UNKNOWN",
] as const;

export const TELEMETRY_REASON_CODES = [
  "ALERT_DELIVERY_FAILED",
  "BACKUP_EXPIRED",
  "BREAKER_STATE_UNAVAILABLE",
  "BUDGET_HARD_LIMIT",
  "CAPABILITY_REJECTED",
  "COLLECTOR_UNAVAILABLE",
  "CONTRACT_FAILURE",
  "COST_UNKNOWN",
  "DATA_TASK_DEADLINE",
  "DEPENDENCY_UNAVAILABLE",
  "LOG_EVENT_INVALID",
  "MODEL_MISMATCH",
  "NONE",
  "OUTBOX_RELAY_EXHAUSTED",
  "OUTBOX_RELAY_RETRYABLE",
  "OUTBOX_ROUTE_UNSUPPORTED",
  "PRICE_CATALOG_STALE",
  "RATE_LIMITED",
  "RAW_CONTENT_MATCH",
  "REDIS_REBUILD_UNSUPPORTED",
  "RESTORE_DENY_FAILED",
  "SCHEMA_GRANT_DRIFT",
  "TELEMETRY_CONTRACT_REJECTED",
  "TELEMETRY_DROPPED",
  "WAL_GAP",
] as const;

export const TELEMETRY_QUEUE_FAMILIES = [
  "INTERACTIVE",
  "BACKGROUND",
  "RESTRICTED",
  "OTHER",
] as const;

export const TELEMETRY_WORKLOADS = [
  "DAILY",
  "WEEKLY",
  "EVALUATION",
  "OTHER",
] as const;

export const TELEMETRY_GENERATION_MODES = [
  "PRIMARY_AI",
  "BACKUP_AI",
  "CONTROLLED_TEMPLATE",
  "NO_RESULT",
] as const;

export const TELEMETRY_STATUS_CLASSES = [
  "2xx",
  "3xx",
  "4xx",
  "5xx",
  "CANCELLED",
  "OTHER",
] as const;

export const TELEMETRY_HTTP_METHODS = [
  "GET",
  "POST",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "OTHER",
] as const;

export type TelemetryEnvironment = (typeof TELEMETRY_ENVIRONMENTS)[number];
export type TelemetryService = (typeof TELEMETRY_SERVICES)[number];
export type TelemetryRuntimeProfile =
  (typeof TELEMETRY_RUNTIME_PROFILES)[number];
export type TelemetryOperationCode = (typeof TELEMETRY_OPERATION_CODES)[number];
export type TelemetryOutcomeCode = (typeof TELEMETRY_OUTCOME_CODES)[number];
export type TelemetryReasonCode = (typeof TELEMETRY_REASON_CODES)[number];

export const TelemetryResourceSchema = z.strictObject({
  configSchemaVersion: z.string().min(1).max(64),
  contractBundleVersion: z.string().min(1).max(64),
  environment: z.enum(TELEMETRY_ENVIRONMENTS),
  releaseId: z.string().min(1).max(64),
  runtimeProfile: z.enum(TELEMETRY_RUNTIME_PROFILES),
  service: z.enum(TELEMETRY_SERVICES),
  serviceVersion: z.string().min(1).max(32),
});

export type TelemetryResource = z.infer<typeof TelemetryResourceSchema>;

export const TelemetryAttributesSchema = z.strictObject({
  generationMode: z.enum(TELEMETRY_GENERATION_MODES).optional(),
  httpMethod: z.enum(TELEMETRY_HTTP_METHODS).optional(),
  modelRevisionBucket: z
    .enum(["CURRENT", "PREVIOUS", "OTHER", "UNKNOWN"])
    .optional(),
  operationCode: z.enum(TELEMETRY_OPERATION_CODES),
  outcomeCode: z.enum(TELEMETRY_OUTCOME_CODES),
  providerCode: z.enum(["PRIMARY", "BACKUP", "OTHER", "UNKNOWN"]).optional(),
  queueFamily: z.enum(TELEMETRY_QUEUE_FAMILIES).optional(),
  reasonCode: z.enum(TELEMETRY_REASON_CODES).optional(),
  statusClass: z.enum(TELEMETRY_STATUS_CLASSES).optional(),
  workload: z.enum(TELEMETRY_WORKLOADS).optional(),
});

export type TelemetryAttributes = z.infer<typeof TelemetryAttributesSchema>;

const labelsFor = <const Labels extends readonly string[]>(labels: Labels) =>
  labels;

const durationBuckets = <const Buckets extends readonly number[]>(
  buckets: Buckets,
) => buckets;

export const HTTP_DURATION_BUCKETS_SECONDS = durationBuckets([
  0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10,
]);

export const GATEWAY_DURATION_BUCKETS_SECONDS = durationBuckets([
  0.25, 0.5, 1, 2, 5, 8, 10, 15, 30, 60,
]);

export const DEFAULT_DURATION_BUCKETS_SECONDS = durationBuckets([
  0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
]);

export const METRIC_DEFINITIONS = {
  dailyenergy_backup_expiry_violations_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_backup_last_success_timestamp_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "outcomeCode"]),
    unit: "s",
  },
  dailyenergy_budget_approved_micros: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "workload"]),
    unit: "micros",
  },
  dailyenergy_budget_forecast_micros: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "workload"]),
    unit: "micros",
  },
  dailyenergy_command_conflicts_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode"]),
    unit: "1",
  },
  dailyenergy_client_poll_outcomes_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_command_receipts_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode"]),
    unit: "1",
  },
  dailyenergy_cost_micros_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "providerCode",
      "modelRevisionBucket",
      "workload",
    ]),
    unit: "micros",
  },
  dailyenergy_cost_unknown_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "reasonCode", "workload"]),
    unit: "1",
  },
  dailyenergy_cost_terminal_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "workload"]),
    unit: "1",
  },
  dailyenergy_cost_price_covered_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "workload"]),
    unit: "1",
  },
  dailyenergy_data_task_deadline_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "s",
  },
  dailyenergy_data_task_oldest_age_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "s",
  },
  dailyenergy_data_task_state_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_deletion_guard_failures_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_deleted_data_detector_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_gateway_end_to_end_duration_seconds: {
    buckets: GATEWAY_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "generationMode",
      "workload",
    ]),
    unit: "s",
  },
  dailyenergy_gateway_attempt_duration_seconds: {
    buckets: DEFAULT_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "providerCode",
      "workload",
    ]),
    unit: "s",
  },
  dailyenergy_gateway_attempts_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "providerCode",
      "workload",
    ]),
    unit: "1",
  },
  dailyenergy_gateway_breaker_state: {
    kind: "gauge",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "providerCode",
      "reasonCode",
    ]),
    unit: "1",
  },
  dailyenergy_gateway_candidate_validation_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "providerCode",
      "reasonCode",
    ]),
    unit: "1",
  },
  dailyenergy_gateway_cost_micros_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "providerCode",
      "modelRevisionBucket",
      "workload",
    ]),
    unit: "micros",
  },
  dailyenergy_gateway_generation_mode_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "generationMode",
      "workload",
    ]),
    unit: "1",
  },
  dailyenergy_gateway_invocations_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "generationMode",
      "workload",
    ]),
    unit: "1",
  },
  dailyenergy_gateway_observed_model_mismatch_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "reasonCode",
      "providerCode",
      "modelRevisionBucket",
    ]),
    unit: "1",
  },
  dailyenergy_gateway_semaphore_wait_seconds: {
    buckets: DEFAULT_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "providerCode",
      "workload",
    ]),
    unit: "s",
  },
  dailyenergy_gateway_usage_units_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "providerCode",
      "modelRevisionBucket",
      "workload",
    ]),
    unit: "1",
  },
  dailyenergy_gateway_usage_unknown_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "reasonCode",
      "providerCode",
      "workload",
    ]),
    unit: "1",
  },
  dailyenergy_guard_rejections_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_http_in_flight_requests: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "httpMethod"]),
    unit: "1",
  },
  dailyenergy_http_response_contract_failures_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_http_server_request_duration_seconds: {
    buckets: HTTP_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "httpMethod",
      "statusClass",
    ]),
    unit: "s",
  },
  dailyenergy_http_server_requests_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "httpMethod",
      "statusClass",
    ]),
    unit: "1",
  },
  dailyenergy_outbox_oldest_unpublished_age_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "queueFamily"]),
    unit: "s",
  },
  dailyenergy_outbox_events_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "queueFamily",
      "reasonCode",
    ]),
    unit: "1",
  },
  dailyenergy_outbox_relay_batch_duration_seconds: {
    buckets: DEFAULT_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "queueFamily",
      "reasonCode",
    ]),
    unit: "s",
  },
  dailyenergy_postgres_pool_saturation_ratio: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "outcomeCode"]),
    unit: "1",
  },
  dailyenergy_postgres_pool_wait_seconds: {
    buckets: DEFAULT_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor(["operationCode", "outcomeCode"]),
    unit: "s",
  },
  dailyenergy_provider_deletion_request_age_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "s",
  },
  dailyenergy_queue_active_jobs: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "queueFamily"]),
    unit: "1",
  },
  dailyenergy_queue_jobs_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "queueFamily",
      "reasonCode",
    ]),
    unit: "1",
  },
  dailyenergy_queue_oldest_eligible_age_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "queueFamily"]),
    unit: "s",
  },
  dailyenergy_queue_retry_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "queueFamily",
      "reasonCode",
    ]),
    unit: "1",
  },
  dailyenergy_queue_terminal_failures_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "queueFamily",
      "reasonCode",
    ]),
    unit: "1",
  },
  dailyenergy_rate_limit_decisions_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_recovery_copy_destroy_age_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "s",
  },
  dailyenergy_release_gate_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_redis_rebuild_duration_seconds: {
    buckets: DEFAULT_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor(["operationCode", "outcomeCode", "queueFamily"]),
    unit: "s",
  },
  dailyenergy_restore_deny_replay_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_restore_drill_duration_seconds: {
    buckets: DEFAULT_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "s",
  },
  dailyenergy_telemetry_contract_rejections_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_telemetry_dropped_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "reasonCode"]),
    unit: "1",
  },
  dailyenergy_telemetry_heartbeat_timestamp_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "outcomeCode"]),
    unit: "s",
  },
  dailyenergy_wal_archive_gap_seconds: {
    kind: "gauge",
    labels: labelsFor(["operationCode", "outcomeCode", "reasonCode"]),
    unit: "s",
  },
  dailyenergy_worker_inbox_duplicate_total: {
    kind: "counter",
    labels: labelsFor(["operationCode", "outcomeCode", "queueFamily"]),
    unit: "1",
  },
  dailyenergy_worker_graceful_shutdown_seconds: {
    buckets: DEFAULT_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor(["operationCode", "outcomeCode", "queueFamily"]),
    unit: "s",
  },
  dailyenergy_worker_guard_rejection_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "queueFamily",
      "reasonCode",
    ]),
    unit: "1",
  },
  dailyenergy_worker_handler_duration_seconds: {
    buckets: DEFAULT_DURATION_BUCKETS_SECONDS,
    kind: "histogram",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "queueFamily",
      "reasonCode",
    ]),
    unit: "s",
  },
  dailyenergy_worker_profile_rejection_total: {
    kind: "counter",
    labels: labelsFor([
      "operationCode",
      "outcomeCode",
      "queueFamily",
      "reasonCode",
    ]),
    unit: "1",
  },
} as const;

export type MetricName = keyof typeof METRIC_DEFINITIONS;

export const FORBIDDEN_TELEMETRY_KEYS = [
  "account_ref",
  "stable_subject_id",
  "openid",
  "unionid",
  "session_id",
  "device_id",
  "ip",
  "request_id",
  "trace_id",
  "span_id",
  "command_ref",
  "event_ref",
  "job_ref",
  "attempt_ref",
  "result_ref",
  "task_ref",
  "object_ref",
  "preferred_name",
  "mood",
  "energy",
  "sleep",
  "matter",
  "note",
  "safety_raw_text",
  "prompt",
  "provider_request",
  "provider_response",
  "raw_url",
  "query",
  "user_agent",
  "referer",
  "sql",
  "bind_values",
  "exception_message",
  "stack",
] as const;

export const MAXIMUM_SERIES_BUDGET = 12_288;
export const MAXIMUM_ACTIVE_SERIES_PER_METRIC = 128;

export const ATTRIBUTE_CARDINALITY = Object.freeze({
  generationMode: 4,
  httpMethod: 6,
  modelRevisionBucket: 4,
  operationCode: 64,
  outcomeCode: 12,
  providerCode: 4,
  queueFamily: 4,
  reasonCode: 24,
  statusClass: 6,
  workload: 4,
});

export function metricMaximumSeries(name: MetricName): number {
  return METRIC_DEFINITIONS[name].labels.reduce(
    (total, label) => total * ATTRIBUTE_CARDINALITY[label],
    1,
  );
}

export function metricActiveSeriesLimit(name: MetricName): number {
  return Math.min(metricMaximumSeries(name), MAXIMUM_ACTIVE_SERIES_PER_METRIC);
}
