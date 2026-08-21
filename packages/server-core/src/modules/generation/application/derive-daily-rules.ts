import {
  ExpressionStyleSchema,
  GenerationInputSnapshotSchema,
  type GenerationInputSnapshot,
} from "@daily-energy/shared-schemas";

import { parseProductDate } from "../../product-time/public/index.js";
import { DeterministicGenerationError } from "../domain/deterministic-error.js";
import {
  DAILY_V1_GENERATION_MANIFEST,
  canonicalGenerationManifestJson,
  generationManifestFingerprintHex,
  parseGenerationManifest,
  type FrozenGenerationManifest,
} from "../domain/manifest.js";
import {
  deriveControlledExpressionPlanV1,
  deriveDailyRuleFactsV1,
  type DailyRuleDerivation,
  type DailyRuleSnapshot,
} from "../domain/daily-rules.js";
import { deriveRootSeed } from "../domain/seed.js";
import {
  parseStableSubjectId,
  type StableSubjectId,
} from "../domain/stable-subject.js";

export interface DeriveDailyRulesV1Input {
  readonly manifest: FrozenGenerationManifest;
  readonly rootSeed: Uint8Array;
  readonly snapshot: unknown;
  readonly stableSubjectId: StableSubjectId;
}

export function deriveDailyRulesV1(
  input: DeriveDailyRulesV1Input,
): DailyRuleDerivation {
  const manifest = validateManifest(input.manifest);
  const stableSubjectId = parseStableSubjectId(input.stableSubjectId);
  const snapshot = validateSnapshot(input.snapshot, manifest.result_version);
  if (
    !(input.rootSeed instanceof Uint8Array) ||
    input.rootSeed.byteLength !== 32
  ) {
    throw new DeterministicGenerationError("ROOT_SEED_MISMATCH");
  }
  const expectedRootSeed = deriveRootSeed({
    productDate: parseProductDate(snapshot.product_date),
    resultVersion: snapshot.result_version,
    stableSubjectId,
  });
  if (!bytesEqual(expectedRootSeed, input.rootSeed)) {
    throw new DeterministicGenerationError("ROOT_SEED_MISMATCH");
  }
  const factsDerivation = deriveDailyRuleFactsV1(snapshot, input.rootSeed);
  const planDerivation = deriveControlledExpressionPlanV1(
    snapshot,
    factsDerivation.ruleFacts,
    input.rootSeed,
  );
  return deepFreeze({
    choiceTrace: [...factsDerivation.choiceTrace, planDerivation.choiceTrace],
    controlledExpressionPlan: planDerivation.plan,
    ruleFacts: factsDerivation.ruleFacts,
  });
}

function validateManifest(
  frozen: FrozenGenerationManifest,
): typeof DAILY_V1_GENERATION_MANIFEST {
  const manifest = parseGenerationManifest(frozen.manifest);
  if (generationManifestFingerprintHex(manifest) !== frozen.fingerprintHex) {
    throw new DeterministicGenerationError("MANIFEST_FINGERPRINT_MISMATCH");
  }
  if (
    frozen.resultVersion !== manifest.result_version ||
    manifest.result_version !== DAILY_V1_GENERATION_MANIFEST.result_version ||
    canonicalGenerationManifestJson(manifest) !==
      canonicalGenerationManifestJson(DAILY_V1_GENERATION_MANIFEST)
  ) {
    throw new DeterministicGenerationError("MANIFEST_DEPENDENCY_INVALID");
  }
  return DAILY_V1_GENERATION_MANIFEST;
}

function validateSnapshot(
  value: unknown,
  resultVersion: string,
): DailyRuleSnapshot {
  const parsed = GenerationInputSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new DeterministicGenerationError("SNAPSHOT_FIELD_INVALID");
  }
  const snapshot: GenerationInputSnapshot = parsed.data;
  if (
    snapshot.snapshot_version !==
    DAILY_V1_GENERATION_MANIFEST.input_snapshot_version
  ) {
    throw new DeterministicGenerationError("SNAPSHOT_VERSION_MISMATCH");
  }
  if (
    snapshot.result_version !== resultVersion ||
    snapshot.result_version !== DAILY_V1_GENERATION_MANIFEST.result_version
  ) {
    throw new DeterministicGenerationError("SNAPSHOT_BINDING_MISMATCH");
  }
  const expressionStyle = ExpressionStyleSchema.safeParse(
    snapshot.profile.expression_style,
  );
  if (!expressionStyle.success || snapshot.product !== undefined) {
    throw new DeterministicGenerationError("SNAPSHOT_FIELD_INVALID");
  }
  return deepFreeze({
    ...snapshot,
    profile: {
      ...snapshot.profile,
      expression_style: expressionStyle.data,
    },
  });
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index])
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
