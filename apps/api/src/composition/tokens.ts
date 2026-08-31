import type {
  AuthStore,
  CheckinStore,
  ConsentProfileStore,
  DailyGenerationStore,
  DailyInteractionStore,
  TelemetryRuntime,
} from "@daily-energy/server-adapters/api";

import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import type { WechatCodeExchange } from "../auth/contracts.js";
import type { PreferredNameCodec } from "../consent-profile/preferred-name-codec.js";
import type { OrdinaryLogSink } from "../observability/ordinary-log.types.js";
import type { ProductDateClock } from "../product-date/product-date.js";
import type {
  AudienceVerifier,
  ReadinessCheck,
  SafetyContinuationVerifier,
  ShutdownDrainHook,
} from "./types.js";

export const RUNTIME_CONFIG = Symbol("RUNTIME_CONFIG");
export const AUTH_STORE = Symbol("AUTH_STORE");
export const CHECKIN_STORE = Symbol("CHECKIN_STORE");
export const CONSENT_PROFILE_STORE = Symbol("CONSENT_PROFILE_STORE");
export const DAILY_GENERATION_STORE = Symbol("DAILY_GENERATION_STORE");
export const DAILY_INTERACTION_STORE = Symbol("DAILY_INTERACTION_STORE");
export const PREFERRED_NAME_CODEC = Symbol("PREFERRED_NAME_CODEC");
export const PRODUCT_DATE_CLOCK = Symbol("PRODUCT_DATE_CLOCK");
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
  readonly checkinStore?: CheckinStore;
  readonly consentProfileStore?: ConsentProfileStore;
  readonly dailyGenerationStore?: DailyGenerationStore;
  readonly dailyInteractionStore?: DailyInteractionStore;
  readonly ordinaryLogSink?: OrdinaryLogSink;
  readonly telemetryRuntime?: TelemetryRuntime;
  readonly publicAudienceVerifier?: AudienceVerifier;
  readonly preferredNameCodec?: PreferredNameCodec;
  readonly productDateClock?: ProductDateClock;
  readonly readinessChecks?: readonly ReadinessCheck[];
  readonly safetyContinuationVerifier?: SafetyContinuationVerifier;
  readonly shutdownDrainHooks?: readonly ShutdownDrainHook[];
  readonly wechatCodeExchange?: WechatCodeExchange;
}

export interface ApiComposition {
  readonly config: RuntimeConfig;
  readonly overrides?: ApiCompositionOverrides;
}
