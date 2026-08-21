export type DeterministicGenerationErrorCode =
  | "CATALOG_DUPLICATE_ID"
  | "CATALOG_NOT_FOUND"
  | "CATALOG_ORDER_INVALID"
  | "CHOICE_COUNT_OUT_OF_RANGE"
  | "CHOICE_COUNTER_EXHAUSTED"
  | "CHOICE_NAMESPACE_INVALID"
  | "MANIFEST_FINGERPRINT_MISMATCH"
  | "MANIFEST_DEPENDENCY_INVALID"
  | "MANIFEST_INVALID"
  | "MANIFEST_NOT_FOUND"
  | "MANDATORY_CANDIDATE_EMPTY"
  | "EXPRESSION_PLAN_INVARIANT_FAILED"
  | "ROOT_SEED_MISMATCH"
  | "ROOT_SEED_INPUT_INVALID"
  | "RULE_FACTS_INVARIANT_FAILED"
  | "SNAPSHOT_BINDING_MISMATCH"
  | "SNAPSHOT_FIELD_INVALID"
  | "SNAPSHOT_VERSION_MISMATCH"
  | "STABLE_SUBJECT_ID_INVALID";

export class DeterministicGenerationError extends Error {
  public constructor(public readonly code: DeterministicGenerationErrorCode) {
    super(code);
    this.name = "DeterministicGenerationError";
  }
}
