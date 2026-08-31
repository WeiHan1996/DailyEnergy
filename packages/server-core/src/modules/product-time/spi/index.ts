import type { ViewContinuationGrant } from "../public/index.js";

export type ContinuationGrantMutation =
  | {
      readonly status: "ACCEPTED" | "DUPLICATE";
      readonly grant: ViewContinuationGrant;
    }
  | { readonly status: "CONFLICT"; readonly current: ViewContinuationGrant };

export type ContinuationGrantRejectionReason =
  | "ACCOUNT_DELETED"
  | "ACCOUNT_DELETING"
  | "ACCOUNT_RESTRICTED"
  | "CONSENT_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "RESULT_INVALID"
  | "SAFETY_BLOCKED"
  | "SESSION_INVALID"
  | "STATE_PRECONDITION_FAILED";

export type ContinuationGrantCreateMutation =
  | ContinuationGrantMutation
  | {
      readonly reason: ContinuationGrantRejectionReason;
      readonly status: "GUARD_REJECTED";
    };

export interface ProductTimeStore {
  close(): Promise<void>;
  createGrant(
    grant: ViewContinuationGrant,
  ): Promise<ContinuationGrantCreateMutation>;
  getGrant(input: {
    readonly grantRef: string;
    readonly ownerRef: string;
    readonly sessionRef: string;
  }): Promise<ViewContinuationGrant | undefined>;
  invalidateGrant(input: {
    readonly expectedRevision: number;
    readonly grantRef: string;
    readonly invalidatedAt: Date;
    readonly ownerRef: string;
    readonly sessionRef: string;
  }): Promise<ContinuationGrantMutation | undefined>;
  invalidateSessionGrants(input: {
    readonly invalidatedAt: Date;
    readonly sessionRef: string;
  }): Promise<number>;
}
