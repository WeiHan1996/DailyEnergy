import type {
  RuntimeConfig,
  RuntimeLogLevel,
} from "../bootstrap/runtime-config.js";

export type OperationCode =
  | "ADMIN_OPS_PLACEHOLDER"
  | "API_LIFECYCLE"
  | "HEALTH_LIVE"
  | "HEALTH_READY"
  | "HEALTH_STARTUP"
  | "PUBLIC_BOOTSTRAP_PLACEHOLDER"
  | "PUBLIC_WECHAT_SESSION_PLACEHOLDER"
  | "UNKNOWN_HTTP";

export type OutcomeCode =
  "SUCCESS" | "EXPECTED_REJECT" | "RETRYABLE" | "TERMINAL";

export interface OrdinaryLogEvent {
  readonly contract_version: "ordinary-log-v1";
  readonly duration_ms_bucket?: string;
  readonly environment: RuntimeConfig["environment"];
  readonly message_code: string;
  readonly operation_code: OperationCode;
  readonly outcome_code: OutcomeCode;
  readonly reason_code?: string;
  readonly release_id: string;
  readonly request_id?: string;
  readonly runtime_profile: "API";
  readonly service: "api";
  readonly severity: RuntimeLogLevel;
  readonly timestamp: string;
}

export interface OrdinaryLogSink {
  write(event: OrdinaryLogEvent): void;
}
