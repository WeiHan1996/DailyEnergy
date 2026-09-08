import { createHash } from "node:crypto";

import {
  OpaqueIdSchema,
  ProductDateSchema,
  type RelationshipNodeCode,
  type RelationshipStage,
} from "@daily-energy/shared-schemas";

export const RELATIONSHIP_POLICY_VERSION = "relationship-policy-v1";
export const RELATIONSHIP_FINGERPRINT_VERSION = "relationship-projection-v1";
export const RELATIONSHIP_NODE_RECEIPT_POLICY_VERSION =
  "relationship-node-receipt-v1";

const NODE_THRESHOLDS = Object.freeze([
  Object.freeze({ count: 1, node: "FIRST_MEETING" as const }),
  Object.freeze({ count: 3, node: "STYLE_CALIBRATION_AVAILABLE" as const }),
  Object.freeze({
    count: 4,
    node: "IMPORTANT_MATTER_INVITE_AVAILABLE" as const,
  }),
  Object.freeze({
    count: 7,
    node: "FIRST_SEVEN_DAY_REVIEW_AVAILABLE" as const,
  }),
]);

const PUBLISHABLE_NODE_BY_COUNT = new Map<number, RelationshipNodeCode>([
  [1, "FIRST_MEETING"],
  [3, "STYLE_CALIBRATION_AVAILABLE"],
  [7, "FIRST_SEVEN_DAY_REVIEW_AVAILABLE"],
]);

export interface RelationshipEncounterSourceV1 {
  readonly productDate: string;
  readonly sourceLightRef: string;
  readonly sourceValidityRevision: number;
}

export interface RelationshipProjectionV1 {
  readonly eligibleNodeCodes: readonly RelationshipNodeCode[];
  readonly encounterDayCount: number;
  readonly policyVersion: typeof RELATIONSHIP_POLICY_VERSION;
  readonly sourceFingerprintHex: string;
  readonly stage: RelationshipStage;
}

export class RelationshipPolicyError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "RelationshipPolicyError";
  }
}

export function deriveRelationshipProjectionV1(
  sources: readonly RelationshipEncounterSourceV1[],
): RelationshipProjectionV1 {
  const byDate = new Map<string, RelationshipEncounterSourceV1>();
  for (const source of sources) {
    if (
      typeof source !== "object" ||
      source === null ||
      Object.keys(source).length !== 3 ||
      !Object.hasOwn(source, "productDate") ||
      !Object.hasOwn(source, "sourceLightRef") ||
      !Object.hasOwn(source, "sourceValidityRevision")
    ) {
      throw new RelationshipPolicyError("RELATIONSHIP_SOURCE_INVALID");
    }
    const parsedDate = ProductDateSchema.safeParse(source.productDate);
    const parsedRef = OpaqueIdSchema.safeParse(source.sourceLightRef);
    if (
      !parsedDate.success ||
      !parsedRef.success ||
      !Number.isSafeInteger(source.sourceValidityRevision) ||
      source.sourceValidityRevision < 1
    ) {
      throw new RelationshipPolicyError("RELATIONSHIP_SOURCE_INVALID");
    }
    const normalized = Object.freeze({
      productDate: parsedDate.data,
      sourceLightRef: parsedRef.data,
      sourceValidityRevision: source.sourceValidityRevision,
    });
    const existing = byDate.get(normalized.productDate);
    if (
      existing !== undefined &&
      (existing.sourceLightRef !== normalized.sourceLightRef ||
        existing.sourceValidityRevision !== normalized.sourceValidityRevision)
    ) {
      throw new RelationshipPolicyError("RELATIONSHIP_SOURCE_DATE_CONFLICT");
    }
    byDate.set(normalized.productDate, normalized);
  }
  const canonicalSources = [...byDate.values()].sort(
    (left, right) =>
      left.productDate.localeCompare(right.productDate, "en") ||
      left.sourceLightRef.localeCompare(right.sourceLightRef, "en"),
  );
  const encounterDayCount = canonicalSources.length;
  return deepFreeze({
    eligibleNodeCodes: eligibleRelationshipNodesV1(encounterDayCount),
    encounterDayCount,
    policyVersion: RELATIONSHIP_POLICY_VERSION,
    sourceFingerprintHex: relationshipSourceFingerprintV1(canonicalSources),
    stage: relationshipStageV1(encounterDayCount),
  });
}

export function relationshipStageV1(
  encounterDayCount: number,
): RelationshipStage {
  assertCount(encounterDayCount);
  return encounterDayCount === 0
    ? "BEFORE_FIRST_MEETING"
    : encounterDayCount < 3
      ? "NEWLY_MET"
      : encounterDayCount < 7
        ? "BECOMING_FAMILIAR"
        : "FIRST_WEEK_RECORDED";
}

export function eligibleRelationshipNodesV1(
  encounterDayCount: number,
): readonly RelationshipNodeCode[] {
  assertCount(encounterDayCount);
  return Object.freeze(
    NODE_THRESHOLDS.filter(({ count }) => encounterDayCount >= count).map(
      ({ node }) => node,
    ),
  );
}

export function publishableRelationshipNodeV1(
  encounterDayCount: number,
): RelationshipNodeCode | undefined {
  assertCount(encounterDayCount);
  return PUBLISHABLE_NODE_BY_COUNT.get(encounterDayCount);
}

export function relationshipSourceFingerprintV1(
  canonicalSources: readonly RelationshipEncounterSourceV1[],
): string {
  const source = canonicalSources
    .map(
      (item) =>
        `${item.productDate}:${item.sourceLightRef}:${item.sourceValidityRevision}`,
    )
    .join("|");
  return createHash("sha256")
    .update(`${RELATIONSHIP_FINGERPRINT_VERSION}|${source}`, "utf8")
    .digest("hex");
}

function assertCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RelationshipPolicyError("RELATIONSHIP_COUNT_INVALID");
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
