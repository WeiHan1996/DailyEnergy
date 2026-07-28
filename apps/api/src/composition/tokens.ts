import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import type { OrdinaryLogSink } from "../observability/ordinary-log.types.js";
import type { AudienceVerifier, ReadinessCheck } from "./types.js";

export const RUNTIME_CONFIG = Symbol("RUNTIME_CONFIG");
export const PUBLIC_AUDIENCE_VERIFIER = Symbol("PUBLIC_AUDIENCE_VERIFIER");
export const ADMIN_AUDIENCE_VERIFIER = Symbol("ADMIN_AUDIENCE_VERIFIER");
export const READINESS_CHECKS = Symbol("READINESS_CHECKS");
export const ORDINARY_LOG_SINK = Symbol("ORDINARY_LOG_SINK");

export interface ApiCompositionOverrides {
  readonly adminAudienceVerifier?: AudienceVerifier;
  readonly ordinaryLogSink?: OrdinaryLogSink;
  readonly publicAudienceVerifier?: AudienceVerifier;
  readonly readinessChecks?: readonly ReadinessCheck[];
}

export interface ApiComposition {
  readonly config: RuntimeConfig;
  readonly overrides?: ApiCompositionOverrides;
}
