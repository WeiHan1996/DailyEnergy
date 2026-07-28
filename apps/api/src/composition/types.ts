export interface AudienceVerifier {
  verify(authorization: string | undefined): boolean | Promise<boolean>;
}

export interface SafetyContinuationVerifier {
  verify(continuation: string | undefined): boolean | Promise<boolean>;
}

export interface ShutdownDrainHook {
  drain(): void | Promise<void>;
}

export interface ReadinessCheckResult {
  readonly reasonCode?:
    "REQUIRED_DEPENDENCY_UNAVAILABLE" | "REQUIRED_DEPENDENCY_INDETERMINATE";
  readonly status: "UP" | "DOWN";
}

export interface ReadinessCheck {
  check(): ReadinessCheckResult | Promise<ReadinessCheckResult>;
}

export const DENY_ALL_AUDIENCE_VERIFIER: AudienceVerifier = {
  verify: () => false,
};

export const DENY_ALL_SAFETY_CONTINUATION_VERIFIER: SafetyContinuationVerifier =
  {
    verify: () => false,
  };
