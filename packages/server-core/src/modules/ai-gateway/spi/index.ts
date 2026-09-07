import type {
  GatewayAttemptOutcome,
  GatewayCandidateV1,
  GatewayInvocationV1,
  GatewayJsonObject,
  GatewayNormalizedUsageV1,
  GatewayProviderRole,
  GatewayProviderRouteV1,
  GatewayRouteManifestV1,
  GatewayRouteRole,
  GatewayRuntimeProfile,
  GatewayValidationReceiptV1,
  GatewayWorkload,
} from "../domain/contracts.js";
import type {
  GatewayBreakerOutcomeClass,
  GatewayBreakerSnapshotV1,
} from "../domain/breaker.js";

export interface GatewayBreakerStateStoreV1 {
  compareAndSet(input: {
    readonly expectedRevision: number | null;
    readonly expectedRouteFingerprint: string | null;
    readonly key: string;
    readonly next: GatewayBreakerSnapshotV1;
    readonly ttlMs: number;
  }): Promise<boolean>;
  load(key: string): Promise<GatewayBreakerSnapshotV1 | null>;
}

export interface GatewayLiveGuardV1 {
  read(): Promise<
    | { readonly status: "ALLOWED" }
    | {
        readonly reasonCode:
          | "OWNER_CANCELLED_OR_DELETED"
          | "RESULT_ALREADY_AVAILABLE"
          | "SAFETY_OVERLAY_ACTIVE"
          | "STALE_PUBLISH_GUARD";
        readonly status: "BLOCKED";
      }
  >;
}

export interface GatewayRoutingTelemetrySinkV1 {
  record(event: {
    readonly outcomeCode: "BLOCKED" | "CANDIDATE" | "FALLBACK";
    readonly reasonCode: string;
    readonly role?: GatewayProviderRole;
    readonly routeManifestVersion: string;
    readonly workload: GatewayWorkload;
  }): void;
}

export interface GatewayAttemptTelemetrySinkV1 {
  record(event: {
    readonly costCompleteness: "KNOWN" | "UNKNOWN";
    readonly modelRevisionBucket: "CURRENT" | "OTHER" | "UNKNOWN";
    readonly outcomeCode: GatewayAttemptOutcome;
    readonly reasonCode: string;
    readonly role: GatewayProviderRole;
    readonly routeManifestVersion: string;
    readonly usage: GatewayNormalizedUsageV1;
    readonly usageCompleteness: "KNOWN" | "UNKNOWN";
    readonly workload: GatewayWorkload;
  }): void;
}

export type { GatewayBreakerOutcomeClass, GatewayBreakerSnapshotV1 };

export interface GatewayAttemptReservationV1 {
  readonly adapterVersion: string;
  readonly attemptId: string;
  readonly endpointId: string;
  readonly invocationId: string;
  readonly modelId: string;
  readonly ordinal: 1 | 2 | 3;
  readonly providerProfileVersion: string;
  readonly requestFingerprint: string;
  readonly routeRole: GatewayRouteRole;
  readonly startedAt: string;
}

export type GatewayAttemptReservationResultV1 =
  | { readonly status: "RESERVED" }
  | {
      readonly existingOutcome: GatewayAttemptOutcome | null;
      readonly existingRequestFingerprint: string;
      readonly status: "EXISTING";
    };

export interface GatewayAttemptCompletionV1 {
  readonly attemptId: string;
  readonly candidateFingerprint?: string;
  readonly failureCode?: string;
  readonly finishedAt: string;
  readonly outcome: GatewayAttemptOutcome;
  readonly providerRequestRef?: string;
  readonly retryAfterMs?: number;
  readonly usage: GatewayNormalizedUsageV1;
}

export interface GatewayAttemptStoreV1 {
  completeAttempt(input: GatewayAttemptCompletionV1): Promise<void>;
  reserveAttempt(
    input: GatewayAttemptReservationV1,
  ): Promise<GatewayAttemptReservationResultV1>;
}

export interface GatewayProviderRequestV1 {
  readonly attemptId: string;
  readonly outputSchemaVersion: string;
  readonly preparedModelInput: GatewayJsonObject;
  readonly promptVersion: string;
  readonly requestFingerprint: string;
  readonly role: GatewayProviderRole;
  readonly route: GatewayProviderRouteV1;
  readonly workload: GatewayWorkload;
}

export interface GatewayProviderInvocationContextV1 {
  readonly hardDeadlineAt: string;
  readonly runtimeProfile: GatewayRuntimeProfile;
  readonly signal?: AbortSignal;
}

export type GatewayProviderFailureCode =
  | "PROVIDER_AUTH_INVALID"
  | "PROVIDER_CANCELLED"
  | "PROVIDER_CONNECT_TIMEOUT"
  | "PROVIDER_CONTENT_BLOCKED"
  | "PROVIDER_NETWORK_ERROR"
  | "PROVIDER_PROTOCOL_INVALID"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_RESPONSE_TIMEOUT"
  | "PROVIDER_UNAVAILABLE";

export type GatewayProviderResultV1 =
  | {
      readonly bodyUtf8: string;
      readonly observedModelId: string;
      readonly providerRequestRef?: string;
      readonly status: "SUCCESS";
      readonly usage: GatewayNormalizedUsageV1;
    }
  | {
      readonly providerRequestRef?: string;
      readonly reasonCode:
        | "PROVIDER_CONNECT_TIMEOUT"
        | "PROVIDER_NETWORK_ERROR"
        | "PROVIDER_RESPONSE_TIMEOUT";
      readonly status: "OUTCOME_UNKNOWN";
      readonly usage: GatewayNormalizedUsageV1;
    }
  | {
      readonly providerRequestRef?: string;
      readonly reasonCode: GatewayProviderFailureCode;
      readonly retryAfterMs?: number;
      readonly status: "FAILURE";
      readonly usage: GatewayNormalizedUsageV1;
    };

export interface GatewayProviderCapabilityProfileV1 {
  readonly capabilityProfileId: string;
  readonly streamingEnabled: false;
  readonly strictSchemaNative: boolean;
  readonly supportedWorkloads: readonly GatewayWorkload[];
  readonly supportsCancellation: true;
  readonly toolsEnabled: false;
}

export type GatewayProviderHealthResultV1 =
  | { readonly status: "AVAILABLE" }
  | {
      readonly reasonCode:
        | "PROVIDER_AUTH_INVALID"
        | "PROVIDER_NETWORK_ERROR"
        | "PROVIDER_UNAVAILABLE";
      readonly status: "UNAVAILABLE";
    };

export interface GatewayProviderAdapterV1 {
  readonly adapterId: string;
  readonly adapterVersion: string;
  capabilities(): GatewayProviderCapabilityProfileV1;
  healthProbe(): Promise<GatewayProviderHealthResultV1>;
  invoke(
    request: GatewayProviderRequestV1,
    context: GatewayProviderInvocationContextV1,
  ): Promise<GatewayProviderResultV1>;
}

export interface GatewayProviderRegistryV1 {
  resolve(route: GatewayProviderRouteV1): GatewayProviderAdapterV1 | undefined;
}

export type GatewayCandidateValidationResultV1 =
  | {
      readonly payload: GatewayJsonObject;
      readonly payloadFingerprint: string;
      readonly receipt: GatewayValidationReceiptV1;
      readonly status: "PASS";
    }
  | {
      readonly outcome: "INVALID_SCHEMA" | "UNSAFE";
      readonly reasonCode: string;
      readonly status: "REJECT";
    };

export interface GatewayCandidateValidatorV1 {
  validate(input: {
    readonly candidate: GatewayJsonObject | string;
    readonly invocation: GatewayInvocationV1;
    readonly source: GatewayRouteRole;
  }): Promise<GatewayCandidateValidationResultV1>;
}

export interface GatewayIdFactoryV1 {
  nextAttemptId(): string;
}

export interface GatewayClockV1 {
  now(): Date;
}

export interface ExpressionGatewayV1 {
  invoke(input: {
    readonly admission: import("../domain/contracts.js").GatewayAdmissionV1;
    readonly invocation: GatewayInvocationV1;
    readonly manifest: GatewayRouteManifestV1;
    readonly role: GatewayProviderRole;
    readonly runtimeProfile: GatewayRuntimeProfile;
    readonly signal?: AbortSignal;
  }): Promise<import("../domain/contracts.js").GatewayOutcomeV1>;
}

export type { GatewayCandidateV1 };
