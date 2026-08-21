import { DeterministicGenerationError } from "./deterministic-error.js";

export type StableSubjectId = string & {
  readonly __stableSubjectId: unique symbol;
};

const STABLE_SUBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export function parseStableSubjectId(value: string): StableSubjectId {
  if (!STABLE_SUBJECT_ID.test(value) || !isAscii(value)) {
    throw new DeterministicGenerationError("STABLE_SUBJECT_ID_INVALID");
  }
  return value as StableSubjectId;
}

function isAscii(value: string): boolean {
  return [...value].every((character) => character.codePointAt(0)! <= 0x7f);
}
