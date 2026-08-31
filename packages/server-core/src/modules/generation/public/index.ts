export { DeterministicGenerationError } from "../domain/deterministic-error.js";
export type { DeterministicGenerationErrorCode } from "../domain/deterministic-error.js";

export { parseStableSubjectId } from "../domain/stable-subject.js";
export type { StableSubjectId } from "../domain/stable-subject.js";

export {
  CHOICE_POLICY_VERSION,
  SEED_POLICY_VERSION,
  bytesToHex,
  canonicalizeCandidates,
  choiceIndexFromU64,
  deriveNamedChoiceDigest,
  deriveRootSeed,
  deriveRootSeedHex,
  namedChoiceMaterial,
  rootSeedMaterial,
  selectCanonicalCandidate,
  selectNamedIndex,
} from "../domain/seed.js";
export type {
  CanonicalCandidate,
  NamedChoiceResult,
  RootSeedInput,
} from "../domain/seed.js";

export {
  DAILY_V1_GENERATION_MANIFEST,
  canonicalGenerationManifestJson,
  generationManifestFingerprintHex,
  parseGenerationManifest,
  parseManifestFingerprint,
  verifyGenerationManifestRecord,
} from "../domain/manifest.js";
export type {
  FrozenGenerationManifest,
  GenerationManifest,
  GenerationManifestRecord,
} from "../domain/manifest.js";

export { selectFrozenGenerationManifest } from "../application/select-manifest.js";

export { deriveDailyRulesV1 } from "../application/derive-daily-rules.js";
export type { DeriveDailyRulesV1Input } from "../application/derive-daily-rules.js";
export {
  DAILY_RULE_VERSION,
  DAILY_SCORE_VERSION,
} from "../domain/daily-rules.js";
export type {
  DailyChoiceTrace,
  DailyRuleDerivation,
} from "../domain/daily-rules.js";
export type { ControlledExpressionPlanV1 } from "@daily-energy/shared-schemas";

export {
  decideGenerationClaimV1,
  decideGenerationPublishV1,
  sameGenerationGuardV1,
} from "../domain/lifecycle.js";
export type {
  GenerationClaimDecision,
  GenerationGuardSnapshotV1,
  GenerationPublishDecision,
} from "../domain/lifecycle.js";
