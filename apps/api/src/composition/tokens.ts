import type {
  AuthStore,
  TelemetryRuntime,
} from "@daily-energy/server-adapters/api";

import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import type { WechatCodeExchange } from "../auth/contracts.js";
import type { OrdinaryLogSink } from "../observability/ordinary-log.types.js";
import type {
  AudienceVerifier,
  ReadinessCheck,
  SafetyContinuationVerifier,
  ShutdownDrainHook,
} from "./types.js";

export const RUNTIME_CONFIG = Symbol("RUNTIME_CONFIG");
export const AUTH_STORE = Symbol("AUTH_STORE");
export const WECHAT_CODE_EXCHANGE = Symbol("WECHAT_CODE_EXCHANGE");
export const PUBLIC_AUDIENCE_VERIFIER = Symbol("PUBLIC_AUDIENCE_VERIFIER");
export const SAFETY_CONTINUATION_VERIFIER = Symbol(
  "SAFETY_CONTINUATION_VERIFIER",
);
export const ADMIN_AUDIENCE_VERIFIER = Symbol("ADMIN_AUDIENCE_VERIFIER");
export const READINESS_CHECKS = Symbol("READINESS_CHECKS");
export const SHUTDOWN_DRAIN_HOOKS = Symbol("SHUTDOWN_DRAIN_HOOKS");
export const ORDINARY_LOG_SINK = Symbol("ORDINARY_LOG_SINK");
export const TELEMETRY_RUNTIME = Symbol("TELEMETRY_RUNTIME");

export interface ApiCompositionOverrides {
  readonly adminAudienceVerifier?: AudienceVerifier;
  readonly authStore?: AuthStore;
  readonly ordinaryLogSink?: OrdinaryLogSink;
  readonly telemetryRuntime?: TelemetryRuntime;
  readonly publicAudienceVerifier?: AudienceVerifier;
  readonly readinessChecks?: readonly ReadinessCheck[];
  readonly safetyContinuationVerifier?: SafetyContinuationVerifier;
  readonly shutdownDrainHooks?: readonly ShutdownDrainHook[];
  readonly wechatCodeExchange?: WechatCodeExchange;
}

export interface ApiComposition {
  readonly config: RuntimeConfig;
  readonly overrides?: ApiCompositionOverrides;
}
