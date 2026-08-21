import { createHash } from "node:crypto";

import type { ProductDate } from "../../product-time/public/index.js";
import { parseProductDate } from "../../product-time/public/index.js";
import { DeterministicGenerationError } from "./deterministic-error.js";
import type { StableSubjectId } from "./stable-subject.js";
import { parseStableSubjectId } from "./stable-subject.js";

export const SEED_POLICY_VERSION = "seed-v1";
export const CHOICE_POLICY_VERSION = "choice-v1";

const U32_MAX = 0xffff_ffff;
const U32_SPACE = 0x1_0000_0000;
const U64_SPACE = 1n << 64n;
const VERSION_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const CHOICE_NAMESPACE = /^[a-z][a-z0-9.-]{2,63}$/u;
const ROOT_FIELDS = [
  "dailyenergy",
  "daily-result",
  SEED_POLICY_VERSION,
] as const;
const CHOICE_FIELDS = ["dailyenergy-choice", CHOICE_POLICY_VERSION] as const;
const encoder = new TextEncoder();

export interface RootSeedInput {
  readonly productDate: ProductDate;
  readonly resultVersion: string;
  readonly stableSubjectId: StableSubjectId;
}

export interface NamedChoiceResult {
  readonly counter: number;
  readonly index: number;
}

export interface CanonicalCandidate {
  readonly id: string;
  readonly rank: number;
}

export function rootSeedMaterial(input: RootSeedInput): Uint8Array {
  parseStableSubjectId(input.stableSubjectId);
  parseProductDate(input.productDate);
  if (
    !VERSION_TOKEN.test(input.resultVersion) ||
    !isAscii(input.resultVersion) ||
    input.resultVersion === "latest"
  ) {
    throw new DeterministicGenerationError("ROOT_SEED_INPUT_INVALID");
  }
  return concatBytes(
    ...[
      ...ROOT_FIELDS,
      input.stableSubjectId,
      input.productDate,
      input.resultVersion,
    ].map((value) => lp32(encoder.encode(value))),
  );
}

export function deriveRootSeed(input: RootSeedInput): Uint8Array {
  return sha256(rootSeedMaterial(input));
}

export function deriveRootSeedHex(input: RootSeedInput): string {
  return bytesToHex(deriveRootSeed(input));
}

export function namedChoiceMaterial(input: {
  readonly counter: number;
  readonly namespace: string;
  readonly rootSeed: Uint8Array;
}): Uint8Array {
  validateChoiceInput(input);
  return concatBytes(
    lp32(encoder.encode(CHOICE_FIELDS[0])),
    lp32(encoder.encode(CHOICE_FIELDS[1])),
    lp32(input.rootSeed),
    lp32(encoder.encode(input.namespace)),
    u32be(input.counter),
  );
}

export function deriveNamedChoiceDigest(input: {
  readonly counter: number;
  readonly namespace: string;
  readonly rootSeed: Uint8Array;
}): Uint8Array {
  return sha256(namedChoiceMaterial(input));
}

export function selectNamedIndex(input: {
  readonly candidateCount: number;
  readonly namespace: string;
  readonly rootSeed: Uint8Array;
}): NamedChoiceResult {
  validateCandidateCount(input.candidateCount);
  validateNamespace(input.namespace);
  validateRootSeed(input.rootSeed);
  if (input.candidateCount === 1) {
    return Object.freeze({ counter: 0, index: 0 });
  }
  for (let counter = 0; counter <= U32_MAX; counter += 1) {
    const digest = deriveNamedChoiceDigest({
      counter,
      namespace: input.namespace,
      rootSeed: input.rootSeed,
    });
    const index = choiceIndexFromU64(firstU64Be(digest), input.candidateCount);
    if (index !== undefined) {
      return Object.freeze({ counter, index });
    }
    if (counter === U32_MAX) {
      break;
    }
  }
  throw new DeterministicGenerationError("CHOICE_COUNTER_EXHAUSTED");
}

export function choiceIndexFromU64(
  value: bigint,
  candidateCount: number,
): number | undefined {
  validateCandidateCount(candidateCount);
  if (value < 0n || value >= U64_SPACE) {
    throw new DeterministicGenerationError("ROOT_SEED_INPUT_INVALID");
  }
  const count = BigInt(candidateCount);
  const limit = U64_SPACE - (U64_SPACE % count);
  return value < limit ? Number(value % count) : undefined;
}

export function canonicalizeCandidates<T extends CanonicalCandidate>(
  candidates: readonly T[],
): readonly T[] {
  const ids = new Set<string>();
  const ranks = new Set<number>();
  for (const candidate of candidates) {
    if (
      !VERSION_TOKEN.test(candidate.id) ||
      !Number.isSafeInteger(candidate.rank) ||
      candidate.rank < 0
    ) {
      throw new DeterministicGenerationError("CATALOG_ORDER_INVALID");
    }
    if (ids.has(candidate.id)) {
      throw new DeterministicGenerationError("CATALOG_DUPLICATE_ID");
    }
    if (ranks.has(candidate.rank)) {
      throw new DeterministicGenerationError("CATALOG_ORDER_INVALID");
    }
    ids.add(candidate.id);
    ranks.add(candidate.rank);
  }
  return Object.freeze(
    [...candidates].sort((left, right) => left.rank - right.rank),
  );
}

export function selectCanonicalCandidate<T extends CanonicalCandidate>(input: {
  readonly candidates: readonly T[];
  readonly namespace: string;
  readonly rootSeed: Uint8Array;
}): {
  readonly candidate: T;
  readonly counter: number;
  readonly index: number;
} {
  const canonical = canonicalizeCandidates(input.candidates);
  const choice = selectNamedIndex({
    candidateCount: canonical.length,
    namespace: input.namespace,
    rootSeed: input.rootSeed,
  });
  const candidate = canonical[choice.index];
  if (candidate === undefined) {
    throw new DeterministicGenerationError("CHOICE_COUNT_OUT_OF_RANGE");
  }
  return Object.freeze({ candidate, ...choice });
}

export function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function lp32(value: Uint8Array): Uint8Array {
  if (value.byteLength > U32_MAX) {
    throw new DeterministicGenerationError("ROOT_SEED_INPUT_INVALID");
  }
  return concatBytes(u32be(value.byteLength), value);
}

function u32be(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value >= U32_SPACE) {
    throw new DeterministicGenerationError("ROOT_SEED_INPUT_INVALID");
  }
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value, false);
  return result;
}

function firstU64Be(value: Uint8Array): bigint {
  if (value.byteLength < 8) {
    throw new DeterministicGenerationError("ROOT_SEED_INPUT_INVALID");
  }
  return new DataView(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  ).getBigUint64(0, false);
}

function concatBytes(...values: readonly Uint8Array[]): Uint8Array {
  const total = values.reduce((sum, value) => sum + value.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.byteLength;
  }
  return result;
}

function sha256(value: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(value).digest());
}

function validateChoiceInput(input: {
  readonly counter: number;
  readonly namespace: string;
  readonly rootSeed: Uint8Array;
}): void {
  validateNamespace(input.namespace);
  validateRootSeed(input.rootSeed);
  if (
    !Number.isSafeInteger(input.counter) ||
    input.counter < 0 ||
    input.counter > U32_MAX
  ) {
    throw new DeterministicGenerationError("ROOT_SEED_INPUT_INVALID");
  }
}

function validateNamespace(value: string): void {
  if (!CHOICE_NAMESPACE.test(value) || !isAscii(value)) {
    throw new DeterministicGenerationError("CHOICE_NAMESPACE_INVALID");
  }
}

function validateRootSeed(value: Uint8Array): void {
  if (value.byteLength !== 32) {
    throw new DeterministicGenerationError("ROOT_SEED_INPUT_INVALID");
  }
}

function validateCandidateCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > U32_SPACE) {
    throw new DeterministicGenerationError("CHOICE_COUNT_OUT_OF_RANGE");
  }
}

function isAscii(value: string): boolean {
  return [...value].every((character) => character.codePointAt(0)! <= 0x7f);
}
