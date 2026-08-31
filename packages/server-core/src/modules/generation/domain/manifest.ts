import { createHash } from "node:crypto";

import { DeterministicGenerationError } from "./deterministic-error.js";
import { bytesToHex } from "./seed.js";

export interface GenerationManifest {
  readonly action_catalog_version: string;
  readonly algorithm_version: string;
  readonly choice_policy_version: "choice-v1";
  readonly content_catalog_version: string;
  readonly daily_content_schema_version: string;
  readonly experiment_variant_version: string;
  readonly expression_contract_version: string;
  readonly input_snapshot_version: string;
  readonly manifest_schema_version: "generation-manifest-v1";
  readonly namespace_registry_version: string;
  readonly product_date_policy_version: "product-date-v1";
  readonly result_version: string;
  readonly ritual_catalog_version: string;
  readonly rule_version: string;
  readonly safety_contract_floor: string;
  readonly seed_policy_version: "seed-v1";
  readonly shared_schema_contract_version: string;
  readonly shared_schema_major: number;
  readonly task_catalog_version: string;
  readonly template_compatibility_version: string;
}

export interface GenerationManifestRecord {
  readonly activatedAt: Date;
  readonly fingerprintHex: string;
  readonly manifest: GenerationManifest;
  readonly manifestRef: string;
}

export interface FrozenGenerationManifest {
  readonly fingerprintHex: string;
  readonly manifest: GenerationManifest;
  readonly manifestRef: string;
  readonly resultVersion: string;
}

export const DAILY_V1_GENERATION_MANIFEST: GenerationManifest = deepFreeze({
  action_catalog_version: "action-catalog-v1",
  algorithm_version: "daily-score-v1",
  choice_policy_version: "choice-v1",
  content_catalog_version: "content-catalog-v1",
  daily_content_schema_version: "1.0.0",
  experiment_variant_version: "none-v1",
  expression_contract_version: "daily-expression-v1",
  input_snapshot_version: "input-v1",
  manifest_schema_version: "generation-manifest-v1",
  namespace_registry_version: "namespace-registry-v1",
  product_date_policy_version: "product-date-v1",
  result_version: "daily-v1",
  ritual_catalog_version: "ritual-catalog-v1",
  rule_version: "daily-rules-v1",
  safety_contract_floor: "safety-baseline-v1",
  seed_policy_version: "seed-v1",
  shared_schema_contract_version: "0.1.0",
  shared_schema_major: 0,
  task_catalog_version: "task-catalog-v1",
  template_compatibility_version: "daily-template-v1",
});

const MANIFEST_KEYS = Object.freeze(
  Object.keys(DAILY_V1_GENERATION_MANIFEST).sort(),
);
const VERSION_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export function parseGenerationManifest(value: unknown): GenerationManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DeterministicGenerationError("MANIFEST_INVALID");
  }
  const candidate = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(candidate).sort()) !==
      JSON.stringify(MANIFEST_KEYS) ||
    candidate.manifest_schema_version !== "generation-manifest-v1" ||
    candidate.product_date_policy_version !== "product-date-v1" ||
    candidate.seed_policy_version !== "seed-v1" ||
    candidate.choice_policy_version !== "choice-v1" ||
    !Number.isSafeInteger(candidate.shared_schema_major) ||
    Number(candidate.shared_schema_major) < 0
  ) {
    throw new DeterministicGenerationError("MANIFEST_INVALID");
  }
  for (const [key, entry] of Object.entries(candidate)) {
    if (
      key !== "shared_schema_major" &&
      (typeof entry !== "string" ||
        !VERSION_TOKEN.test(entry) ||
        entry === "latest")
    ) {
      throw new DeterministicGenerationError("MANIFEST_INVALID");
    }
  }
  return deepFreeze(candidate as unknown as GenerationManifest);
}

export function canonicalGenerationManifestJson(
  manifest: GenerationManifest,
): string {
  return JSON.stringify(canonicalize(parseGenerationManifest(manifest)));
}

export function generationManifestFingerprintHex(
  manifest: GenerationManifest,
): string {
  return createHash("sha256")
    .update(canonicalGenerationManifestJson(manifest), "utf8")
    .digest("hex");
}

export function verifyGenerationManifestRecord(
  record: GenerationManifestRecord,
): FrozenGenerationManifest {
  if (
    !OPAQUE_REF.test(record.manifestRef) ||
    !SHA256_HEX.test(record.fingerprintHex) ||
    !Number.isFinite(record.activatedAt.getTime())
  ) {
    throw new DeterministicGenerationError("MANIFEST_INVALID");
  }
  const manifest = parseGenerationManifest(record.manifest);
  if (generationManifestFingerprintHex(manifest) !== record.fingerprintHex) {
    throw new DeterministicGenerationError("MANIFEST_FINGERPRINT_MISMATCH");
  }
  return Object.freeze({
    fingerprintHex: record.fingerprintHex,
    manifest,
    manifestRef: record.manifestRef,
    resultVersion: manifest.result_version,
  });
}

export function parseManifestFingerprint(value: Uint8Array): string {
  if (value.byteLength !== 32) {
    throw new DeterministicGenerationError("MANIFEST_INVALID");
  }
  return bytesToHex(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }
  return value;
}
