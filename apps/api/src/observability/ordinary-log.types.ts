import { z } from "zod";

import type {
  RuntimeConfig,
  RuntimeLogLevel,
} from "../bootstrap/runtime-config.js";
import { API_ERROR_CATALOG } from "../transport/common/api-exception.js";

export const OPERATION_CODES = [
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
  "PUBLIC_BOOTSTRAP_PLACEHOLDER",
  "PUBLIC_WECHAT_SESSION_PLACEHOLDER",
  "UNKNOWN_HTTP",
] as const;

export const OUTCOME_CODES = [
  "SUCCESS",
  "EXPECTED_REJECT",
  "RETRYABLE",
  "TERMINAL",
] as const;

export const MESSAGE_CODES = [
  "API_SHUTDOWN_COMPLETED",
  "API_SHUTDOWN_FAILED",
  "API_SHUTDOWN_STARTED",
  "API_SHUTDOWN_TIMED_OUT",
  "API_STARTED",
  "API_STARTUP_FAILED",
  "HTTP_REQUEST_COMPLETED",
  "LOG_CONTRACT_REJECTED",
  "LOG_SERIALIZATION_FAILED",
] as const;

export const DURATION_MS_BUCKETS = [
  "LT_10",
  "LT_50",
  "LT_250",
  "LT_1000",
  "GTE_1000",
] as const;

const API_ERROR_CODES = Object.keys(API_ERROR_CATALOG) as [
  keyof typeof API_ERROR_CATALOG,
  ...(keyof typeof API_ERROR_CATALOG)[],
];

export const REASON_CODES = [
  ...API_ERROR_CODES,
  "API_STARTUP_FAILED",
  "APPLICATION_CLOSE",
  "CAPABILITY_FINGERPRINT_MISMATCH",
  "DEPENDENCY_UNAVAILABLE",
  "DEPLOY_CONFIG_FINGERPRINT_MISMATCH",
  "LISTENER_READY",
  "LISTENER_UNKNOWN",
  "LOG_EVENT_INVALID",
  "RUNTIME_CONFIG_INVALID",
  "SHUTDOWN_DEADLINE_EXCEEDED",
  "SHUTDOWN_FAILED",
  "SIGNAL",
] as const;

export type OperationCode = (typeof OPERATION_CODES)[number];
export type OutcomeCode = (typeof OUTCOME_CODES)[number];
export type MessageCode = (typeof MESSAGE_CODES)[number];
export type DurationMsBucket = (typeof DURATION_MS_BUCKETS)[number];
export type ReasonCode = (typeof REASON_CODES)[number];

export interface OrdinaryLogEvent {
  readonly contract_version: "ordinary-log-v1";
  readonly duration_ms_bucket?: DurationMsBucket;
  readonly environment: RuntimeConfig["environment"];
  readonly message_code: MessageCode;
  readonly operation_code: OperationCode;
  readonly outcome_code: OutcomeCode;
  readonly reason_code?: ReasonCode;
  readonly release_id: string;
  readonly request_id?: string;
  readonly runtime_profile: "API";
  readonly service: "api";
  readonly severity: RuntimeLogLevel;
  readonly timestamp: string;
  readonly trace_id?: string;
}

export const OrdinaryLogEventSchema = z.strictObject({
  contract_version: z.literal("ordinary-log-v1"),
  duration_ms_bucket: z.enum(DURATION_MS_BUCKETS).optional(),
  environment: z.enum([
    "LOCAL",
    "CI",
    "DEV",
    "STAGING",
    "PRODUCTION",
    "RECOVERY",
  ]),
  message_code: z.enum(MESSAGE_CODES),
  operation_code: z.enum(OPERATION_CODES),
  outcome_code: z.enum(OUTCOME_CODES),
  reason_code: z.enum(REASON_CODES).optional(),
  release_id: z.string().min(1).max(64),
  request_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/u)
    .optional(),
  runtime_profile: z.literal("API"),
  service: z.literal("api"),
  severity: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]),
  timestamp: z.iso.datetime({ offset: true }),
  trace_id: z
    .string()
    .regex(/^[a-f0-9]{32}$/u)
    .optional(),
});

export interface OrdinaryLogSink {
  write(event: OrdinaryLogEvent): void;
}
