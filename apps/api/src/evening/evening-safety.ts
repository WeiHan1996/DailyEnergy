import type { SafetyOverlayView } from "@daily-energy/shared-schemas";

export type EveningSafetyDecision =
  | {
      readonly outcome: "CLEAR";
      readonly policyVersion: string;
      readonly ruleVersion: string;
      readonly classifierVersion: string;
      readonly irreversibleFingerprint: Buffer;
    }
  | {
      readonly outcome: "HIGH_RISK";
      readonly categoryCodes: readonly string[];
      readonly policyVersion: string;
      readonly ruleVersion: string;
      readonly classifierVersion: string;
      readonly irreversibleFingerprint: Buffer;
    }
  | { readonly outcome: "INDETERMINATE" };

export interface EveningSafetyInputGate {
  decide(input: {
    readonly note: string;
    readonly surface: "EVE-001";
  }): Promise<EveningSafetyDecision>;
}

export interface EveningSafetyStore {
  activate(input: {
    readonly accountId: string;
    readonly categoryCodes: readonly string[];
    readonly classifierVersion: string;
    readonly commandRef: string;
    readonly irreversibleFingerprint: Buffer;
    readonly now: Date;
    readonly policyVersion: string;
    readonly ruleVersion: string;
  }): Promise<
    | {
        readonly status: "ACCEPTED" | "DUPLICATE";
        readonly view: SafetyOverlayView;
      }
    | { readonly status: "IDEMPOTENCY_CONFLICT" }
  >;
  close(): Promise<void>;
}

export const UNAVAILABLE_EVENING_SAFETY_GATE: EveningSafetyInputGate = {
  async decide() {
    return { outcome: "INDETERMINATE" };
  },
};

export const UNAVAILABLE_EVENING_SAFETY_STORE: EveningSafetyStore = {
  async activate() {
    throw new Error("EVENING_SAFETY_STORE_UNAVAILABLE");
  },
  async close() {},
};
