import { createHash } from "node:crypto";

import {
  DailyMemoryContextProjectionV1Schema,
  type DailyMemoryContextProjectionV1,
} from "@daily-energy/shared-schemas";

import type {
  DailyMatterSelectionV1,
  SelectedDailyMatterV1,
} from "./matter-selection.js";

export const MEMORY_RESOLVER_VERSION = "memory-resolver-v1" as const;
export const MEMORY_SOURCE_REGISTRY_VERSION =
  "memory-source-registry-v1" as const;
export const MEMORY_GRANT_POLICY_VERSION = "memory-grant-policy-v1" as const;

export interface DailyMemoryServerDependencyV1 {
  readonly ownerRef: string;
  readonly sourceRef: string;
  readonly sourceRevision: number;
  readonly grantRef: string;
  readonly grantRevision: number;
  readonly masterRevision: number;
  readonly accountRevision: number;
  readonly safetyEpoch: string;
  readonly deletionEpoch: string;
  readonly sourceSafetyPolicyVersion: string;
  readonly sourceSafetyRuleVersion: string;
  readonly sourceSafetyClassifierVersion: string;
  readonly sourceSafetyFingerprintHex: string;
  readonly purpose: "DAILY_EXPRESSION";
  readonly segmentPaths: readonly ["expression.state_response"];
  readonly fallbackPaths: readonly ["expression.state_response"];
  readonly validUntilProductDate: string;
}

export interface DailyMemoryContextSnapshotV1 {
  readonly contract: "memory-context-snapshot-v1";
  readonly memoryPolicyVersion: "memory-policy-v1";
  readonly resolverVersion: typeof MEMORY_RESOLVER_VERSION;
  readonly sourceRegistryVersion: typeof MEMORY_SOURCE_REGISTRY_VERSION;
  readonly grantPolicyVersion: typeof MEMORY_GRANT_POLICY_VERSION;
  readonly projection: DailyMemoryContextProjectionV1;
  readonly dependency?: DailyMemoryServerDependencyV1;
  readonly snapshotFingerprint: string;
}

export function buildDailyMemoryContextSnapshotV1(input: {
  readonly invocationRef: string;
  readonly productDate: string;
  readonly selection: DailyMatterSelectionV1;
}): DailyMemoryContextSnapshotV1 {
  const selected =
    input.selection.status === "SELECTED"
      ? input.selection.candidate
      : undefined;
  const factId =
    selected === undefined
      ? undefined
      : memoryFactId(input.invocationRef, selected);
  const projectionSource = {
    contract: "memory-context-projection-v1" as const,
    workload: "DAILY_EXPRESSION_V2" as const,
    product_date: input.productDate,
    memory_facts:
      selected === undefined || factId === undefined
        ? []
        : [
            {
              fact_id: factId,
              fact_kind: "IMPORTANT_MATTER" as const,
              temporal_relation: selected.temporalRelation,
              allowed_claim: "USER_SAVED_MATTER" as const,
              allowed_date_literals: [] as [],
              allowed_numeric_literals: [] as [],
              prohibited_inferences: [
                "CAUSE",
                "OUTCOME",
                "PROFESSIONAL_CONCLUSION",
                "RELATIONSHIP_OR_IDENTITY",
              ] as const,
            },
          ],
    segment_contracts:
      factId === undefined
        ? []
        : [
            {
              segment_path: "expression.state_response" as const,
              exact_memory_fact_refs: [factId],
              memory_mention_allowed: true,
              fallback_path: "expression.state_response" as const,
            },
          ],
    personalization_expectation:
      selected === undefined ? ("REDUCED" as const) : ("FULL" as const),
  };
  const projection = withProjectionBytes(projectionSource);
  const dependency =
    selected === undefined ? undefined : serverDependency(selected);
  const source: Omit<DailyMemoryContextSnapshotV1, "snapshotFingerprint"> = {
    contract: "memory-context-snapshot-v1" as const,
    memoryPolicyVersion: "memory-policy-v1" as const,
    resolverVersion: MEMORY_RESOLVER_VERSION,
    sourceRegistryVersion: MEMORY_SOURCE_REGISTRY_VERSION,
    grantPolicyVersion: MEMORY_GRANT_POLICY_VERSION,
    projection,
    ...(dependency === undefined ? {} : { dependency }),
  };
  return deepFreeze({
    ...source,
    snapshotFingerprint: fingerprint(source),
  });
}

function withProjectionBytes(
  source: Omit<DailyMemoryContextProjectionV1, "provider_projection_bytes">,
): DailyMemoryContextProjectionV1 {
  let bytes = 0;
  for (let index = 0; index < 4; index += 1) {
    const next = Buffer.byteLength(
      JSON.stringify({ ...source, provider_projection_bytes: bytes }),
      "utf8",
    );
    if (next === bytes) {
      break;
    }
    bytes = next;
  }
  return DailyMemoryContextProjectionV1Schema.parse({
    ...source,
    provider_projection_bytes: bytes,
  });
}

function serverDependency(
  selected: SelectedDailyMatterV1,
): DailyMemoryServerDependencyV1 {
  return {
    ownerRef: selected.ownerRef,
    sourceRef: selected.sourceRef,
    sourceRevision: selected.sourceRevision,
    grantRef: selected.grantRef,
    grantRevision: selected.grantRevision,
    masterRevision: selected.masterRevision,
    accountRevision: selected.accountRevision,
    safetyEpoch: selected.safetyEpoch,
    deletionEpoch: selected.deletionEpoch,
    sourceSafetyPolicyVersion: selected.sourceSafetyPolicyVersion,
    sourceSafetyRuleVersion: selected.sourceSafetyRuleVersion,
    sourceSafetyClassifierVersion: selected.sourceSafetyClassifierVersion,
    sourceSafetyFingerprintHex: selected.sourceSafetyFingerprintHex,
    purpose: "DAILY_EXPRESSION",
    segmentPaths: ["expression.state_response"],
    fallbackPaths: ["expression.state_response"],
    validUntilProductDate: selected.validUntilProductDate,
  };
}

function memoryFactId(
  invocationRef: string,
  selected: SelectedDailyMatterV1,
): string {
  return `memory.fact.${createHash("sha256")
    .update(
      `${invocationRef}:${selected.sourceRef}:${selected.sourceRevision}:${selected.grantRevision}`,
      "utf8",
    )
    .digest("hex")
    .slice(0, 24)}`;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
