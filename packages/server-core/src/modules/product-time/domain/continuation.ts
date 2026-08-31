import {
  addProductDateDays,
  parseProductDate,
  PRODUCT_DATE_POLICY_V1,
  productDateBounds,
  resolveProductDate,
  type ProductDate,
} from "./product-date.js";

export type ContinuationSurface = "DLY-003" | "EVE-001";
export type ProductDateWriteOperation =
  | "UPSERT_CHECKIN"
  | "START_GENERATION"
  | "ILLUMINATE"
  | "TASK_STATUS_SET"
  | "CONTENT_HELPFULNESS_SET"
  | "EVENING_SAVE";

export interface ViewContinuationGrant {
  readonly allowedOperations: readonly ProductDateWriteOperation[];
  readonly boundaryAt: Date;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly feedbackRevision?: number;
  readonly grantRef: string;
  readonly invalidatedAt?: Date;
  readonly ownerRef: string;
  readonly productDate: ProductDate;
  readonly productDatePolicyVersion: "product-date-v1";
  readonly resultRef: string;
  readonly revision: number;
  readonly sessionRef: string;
  readonly surface: ContinuationSurface;
}

export type WriteWindow = "OPEN" | "CONTINUATION_ONLY" | "CLOSED";

export type ContinuationErrorCode =
  "CONTINUATION_BINDING_INVALID" | "CONTINUATION_GRANT_INVALID";

export class ContinuationError extends Error {
  public constructor(public readonly code: ContinuationErrorCode) {
    super(code);
    this.name = "ContinuationError";
  }
}

const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const DLY_OPERATIONS = Object.freeze([
  "ILLUMINATE",
  "TASK_STATUS_SET",
  "CONTENT_HELPFULNESS_SET",
] as const);
const EVE_OPERATIONS = Object.freeze(["EVENING_SAVE"] as const);

export function createViewContinuationGrant(input: {
  readonly feedbackRevision?: number;
  readonly grantRef: string;
  readonly openedAt: Date;
  readonly ownerRef: string;
  readonly productDate: ProductDate;
  readonly resultRef: string;
  readonly sessionRef: string;
  readonly surface: ContinuationSurface;
}): ViewContinuationGrant {
  assertOpaqueRef(input.grantRef);
  assertOpaqueRef(input.ownerRef);
  assertOpaqueRef(input.resultRef);
  assertOpaqueRef(input.sessionRef);
  const resolution = resolveProductDate(input.openedAt);
  if (resolution.productDate !== input.productDate) {
    throw new ContinuationError("CONTINUATION_BINDING_INVALID");
  }
  if (
    input.surface === "EVE-001" &&
    (input.feedbackRevision === undefined ||
      !Number.isSafeInteger(input.feedbackRevision) ||
      input.feedbackRevision < 0)
  ) {
    throw new ContinuationError("CONTINUATION_BINDING_INVALID");
  }
  if (input.surface === "DLY-003" && input.feedbackRevision !== undefined) {
    throw new ContinuationError("CONTINUATION_BINDING_INVALID");
  }
  return freezeGrant({
    allowedOperations:
      input.surface === "DLY-003" ? DLY_OPERATIONS : EVE_OPERATIONS,
    boundaryAt: resolution.nextBoundaryAt,
    createdAt: new Date(input.openedAt.getTime()),
    expiresAt: new Date(
      resolution.nextBoundaryAt.getTime() +
        PRODUCT_DATE_POLICY_V1.viewContinuationMinutes * 60_000,
    ),
    ...(input.feedbackRevision === undefined
      ? {}
      : { feedbackRevision: input.feedbackRevision }),
    grantRef: input.grantRef,
    ownerRef: input.ownerRef,
    productDate: input.productDate,
    productDatePolicyVersion: PRODUCT_DATE_POLICY_V1.policyVersion,
    resultRef: input.resultRef,
    revision: 1,
    sessionRef: input.sessionRef,
    surface: input.surface,
  });
}

export function evaluateWriteWindow(input: {
  readonly grant?: ViewContinuationGrant;
  readonly now: Date;
  readonly operation: ProductDateWriteOperation;
  readonly ownerRef: string;
  readonly sessionRef: string;
  readonly surface: ContinuationSurface;
  readonly targetProductDate: ProductDate;
}): WriteWindow {
  const current = resolveProductDate(input.now);
  if (input.targetProductDate === current.productDate) {
    return "OPEN";
  }
  if (
    input.targetProductDate !== addProductDateDays(current.productDate, -1) ||
    input.grant === undefined
  ) {
    return "CLOSED";
  }
  validateGrant(input.grant);
  const grant = input.grant;
  return grant.invalidatedAt === undefined &&
    grant.ownerRef === input.ownerRef &&
    grant.sessionRef === input.sessionRef &&
    grant.surface === input.surface &&
    grant.productDate === input.targetProductDate &&
    grant.productDatePolicyVersion === current.policyVersion &&
    grant.boundaryAt.getTime() === current.boundaryAt.getTime() &&
    input.now.getTime() >= grant.boundaryAt.getTime() &&
    input.now.getTime() < grant.expiresAt.getTime() &&
    grant.allowedOperations.includes(input.operation)
    ? "CONTINUATION_ONLY"
    : "CLOSED";
}

export function invalidateViewContinuationGrant(
  grant: ViewContinuationGrant,
  invalidatedAt: Date,
): ViewContinuationGrant {
  validateGrant(grant);
  if (!Number.isFinite(invalidatedAt.getTime())) {
    throw new ContinuationError("CONTINUATION_GRANT_INVALID");
  }
  if (grant.invalidatedAt !== undefined) {
    return grant;
  }
  return freezeGrant({
    ...grant,
    invalidatedAt: new Date(invalidatedAt.getTime()),
    revision: grant.revision + 1,
  });
}

export function isGenerationCompletionEligible(input: {
  readonly intentCreatedAt: Date;
  readonly now: Date;
  readonly targetProductDate: ProductDate;
}): boolean {
  const current = resolveProductDate(input.now);
  if (input.targetProductDate === current.productDate) {
    return true;
  }
  if (input.targetProductDate !== addProductDateDays(current.productDate, -1)) {
    return false;
  }
  const { nextBoundaryAt } = productDateBounds(input.targetProductDate);
  return (
    input.intentCreatedAt.getTime() < nextBoundaryAt.getTime() &&
    input.now.getTime() >= nextBoundaryAt.getTime() &&
    input.now.getTime() <
      nextBoundaryAt.getTime() +
        PRODUCT_DATE_POLICY_V1.generationCompletionMinutes * 60_000
  );
}

export function validateViewContinuationGrant(
  value: ViewContinuationGrant,
): ViewContinuationGrant {
  validateGrant(value);
  return freezeGrant(value);
}

function validateGrant(grant: ViewContinuationGrant): void {
  assertOpaqueRef(grant.grantRef);
  assertOpaqueRef(grant.ownerRef);
  assertOpaqueRef(grant.resultRef);
  assertOpaqueRef(grant.sessionRef);
  parseProductDate(grant.productDate);
  const expectedOperations =
    grant.surface === "DLY-003" ? DLY_OPERATIONS : EVE_OPERATIONS;
  const expectedBoundary = productDateBounds(grant.productDate).nextBoundaryAt;
  const startBoundary = productDateBounds(grant.productDate).boundaryAt;
  const expectedExpiry =
    expectedBoundary.getTime() +
    PRODUCT_DATE_POLICY_V1.viewContinuationMinutes * 60_000;
  if (
    grant.productDatePolicyVersion !== PRODUCT_DATE_POLICY_V1.policyVersion ||
    !Number.isSafeInteger(grant.revision) ||
    grant.revision < 1 ||
    grant.boundaryAt.getTime() !== expectedBoundary.getTime() ||
    !Number.isFinite(grant.createdAt.getTime()) ||
    grant.createdAt.getTime() < startBoundary.getTime() ||
    grant.createdAt.getTime() >= expectedBoundary.getTime() ||
    grant.expiresAt.getTime() !== expectedExpiry ||
    (grant.invalidatedAt !== undefined &&
      (!Number.isFinite(grant.invalidatedAt.getTime()) ||
        grant.invalidatedAt.getTime() < grant.createdAt.getTime())) ||
    grant.allowedOperations.length !== expectedOperations.length ||
    grant.allowedOperations.some(
      (operation, index) => operation !== expectedOperations[index],
    ) ||
    (grant.surface === "DLY-003" && grant.feedbackRevision !== undefined) ||
    (grant.surface === "EVE-001" &&
      (grant.feedbackRevision === undefined ||
        !Number.isSafeInteger(grant.feedbackRevision) ||
        grant.feedbackRevision < 0))
  ) {
    throw new ContinuationError("CONTINUATION_GRANT_INVALID");
  }
}

function freezeGrant(grant: ViewContinuationGrant): ViewContinuationGrant {
  return Object.freeze({
    ...grant,
    allowedOperations: Object.freeze([...grant.allowedOperations]),
    boundaryAt: new Date(grant.boundaryAt.getTime()),
    createdAt: new Date(grant.createdAt.getTime()),
    expiresAt: new Date(grant.expiresAt.getTime()),
    ...(grant.invalidatedAt === undefined
      ? {}
      : { invalidatedAt: new Date(grant.invalidatedAt.getTime()) }),
  });
}

function assertOpaqueRef(value: string): void {
  if (!OPAQUE_REF.test(value)) {
    throw new ContinuationError("CONTINUATION_BINDING_INVALID");
  }
}
