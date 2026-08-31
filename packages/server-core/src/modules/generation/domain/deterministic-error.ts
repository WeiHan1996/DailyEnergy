export type DeterministicGenerationErrorCode =
  | "CATALOG_DUPLICATE_ID"
  | "CATALOG_ORDER_INVALID"
  | "CHOICE_COUNT_OUT_OF_RANGE"
  | "CHOICE_COUNTER_EXHAUSTED"
  | "CHOICE_NAMESPACE_INVALID"
  | "MANIFEST_FINGERPRINT_MISMATCH"
  | "MANIFEST_INVALID"
  | "MANIFEST_NOT_FOUND"
  | "ROOT_SEED_INPUT_INVALID"
  | "STABLE_SUBJECT_ID_INVALID";

export class DeterministicGenerationError extends Error {
  public constructor(public readonly code: DeterministicGenerationErrorCode) {
    super(code);
    this.name = "DeterministicGenerationError";
  }
}
