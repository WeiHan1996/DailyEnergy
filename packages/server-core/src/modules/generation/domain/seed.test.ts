import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

import { parseProductDate } from "../../product-time/public/index.js";
import { parseStableSubjectId } from "./stable-subject.js";
import {
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
} from "./seed.js";

const execFileAsync = promisify(execFile);

interface RootVector {
  readonly expected_sha256_hex: string;
  readonly material_hex?: string;
  readonly product_date: string;
  readonly result_version: string;
  readonly stable_subject_id: string;
}

interface ChoiceVector {
  readonly candidate_count: number;
  readonly counter: number;
  readonly expected_index: number;
  readonly expected_sha256_hex: string;
  readonly material_hex: string;
  readonly namespace: string;
}

interface Fixture {
  readonly seed_policy: {
    readonly choice_policy: {
      readonly rejection_boundaries: readonly {
        readonly candidate_count: number;
        readonly first_rejected?: string;
        readonly last_accepted: string;
        readonly last_accepted_index: number;
      }[];
      readonly root_seed_hex: string;
      readonly vectors: readonly ChoiceVector[];
    };
    readonly root_vectors: readonly RootVector[];
  };
}

let fixture: Fixture;

beforeAll(async () => {
  fixture = JSON.parse(
    await readFile(
      resolve(process.cwd(), "../../docs/decisions/adr-0002-test-vectors.json"),
      "utf8",
    ),
  ) as Fixture;
});

describe("C-005 seed-v1", () => {
  it("recomputes every normative root vector and exact LP32 material", () => {
    for (const vector of fixture.seed_policy.root_vectors) {
      const input = {
        productDate: parseProductDate(vector.product_date),
        resultVersion: vector.result_version,
        stableSubjectId: parseStableSubjectId(vector.stable_subject_id),
      };
      expect(deriveRootSeedHex(input)).toBe(vector.expected_sha256_hex);
      if (vector.material_hex !== undefined) {
        expect(bytesToHex(rootSeedMaterial(input))).toBe(vector.material_hex);
      }
    }
  });

  it("produces identical bytes in a separate Node process", async () => {
    const vector = fixture.seed_policy.root_vectors[0]!;
    const moduleUrl = pathToFileURL(
      resolve(process.cwd(), "dist/modules/generation/public/index.js"),
    ).href;
    const productTimeUrl = pathToFileURL(
      resolve(process.cwd(), "dist/modules/product-time/public/index.js"),
    ).href;
    const script = `
      const generation = await import(${JSON.stringify(moduleUrl)});
      const productTime = await import(${JSON.stringify(productTimeUrl)});
      process.stdout.write(generation.deriveRootSeedHex({
        stableSubjectId: generation.parseStableSubjectId(${JSON.stringify(vector.stable_subject_id)}),
        productDate: productTime.parseProductDate(${JSON.stringify(vector.product_date)}),
        resultVersion: ${JSON.stringify(vector.result_version)}
      }));
    `;
    const result = await execFileAsync(process.execPath, [
      "--input-type=module",
      "--eval",
      script,
    ]);
    expect(result.stdout).toBe(vector.expected_sha256_hex);
  });

  it("rejects Unicode, whitespace, invalid dates and ambiguous versions", () => {
    expect(() => parseStableSubjectId("用户_example")).toThrowError(
      expect.objectContaining({ code: "STABLE_SUBJECT_ID_INVALID" }),
    );
    expect(() => parseStableSubjectId("user example")).toThrowError(
      expect.objectContaining({ code: "STABLE_SUBJECT_ID_INVALID" }),
    );
    expect(() =>
      deriveRootSeed({
        productDate: parseProductDate("2026-07-20"),
        resultVersion: "latest",
        stableSubjectId: parseStableSubjectId("user_example"),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "ROOT_SEED_INPUT_INVALID" }),
    );
  });
});

describe("C-005 choice-v1", () => {
  it("recomputes every normative choice vector", () => {
    const rootSeed = Uint8Array.from(
      Buffer.from(fixture.seed_policy.choice_policy.root_seed_hex, "hex"),
    );
    for (const vector of fixture.seed_policy.choice_policy.vectors) {
      const input = {
        counter: vector.counter,
        namespace: vector.namespace,
        rootSeed,
      };
      expect(bytesToHex(namedChoiceMaterial(input))).toBe(vector.material_hex);
      expect(bytesToHex(deriveNamedChoiceDigest(input))).toBe(
        vector.expected_sha256_hex,
      );
      expect(
        selectNamedIndex({
          candidateCount: vector.candidate_count,
          namespace: vector.namespace,
          rootSeed,
        }),
      ).toEqual({ counter: vector.counter, index: vector.expected_index });
    }
  });

  it("matches every rejection boundary", () => {
    for (const vector of fixture.seed_policy.choice_policy
      .rejection_boundaries) {
      expect(
        choiceIndexFromU64(
          BigInt(vector.last_accepted),
          vector.candidate_count,
        ),
      ).toBe(vector.last_accepted_index);
      if (vector.first_rejected !== undefined) {
        expect(
          choiceIndexFromU64(
            BigInt(vector.first_rejected),
            vector.candidate_count,
          ),
        ).toBeUndefined();
      }
    }
  });

  it("keeps namespaces isolated and canonicalizes candidates by unique rank", () => {
    const rootSeed = deriveRootSeed({
      productDate: parseProductDate("2026-07-20"),
      resultVersion: "daily-v1",
      stableSubjectId: parseStableSubjectId("user_example"),
    });
    const shuffled = [
      { id: "candidate.three", rank: 3 },
      { id: "candidate.one", rank: 1 },
      { id: "candidate.two", rank: 2 },
    ] as const;
    expect(canonicalizeCandidates(shuffled).map(({ id }) => id)).toEqual([
      "candidate.one",
      "candidate.two",
      "candidate.three",
    ]);
    const first = selectCanonicalCandidate({
      candidates: shuffled,
      namespace: "action.tie.v1",
      rootSeed,
    });
    selectNamedIndex({
      candidateCount: 5,
      namespace: "ritual.color.v1",
      rootSeed,
    });
    expect(
      selectCanonicalCandidate({
        candidates: [...shuffled].reverse(),
        namespace: "action.tie.v1",
        rootSeed,
      }),
    ).toEqual(first);
  });

  it("fails closed for invalid counts, namespaces, duplicate IDs and ranks", () => {
    const rootSeed = new Uint8Array(32);
    for (const candidateCount of [0, 4_294_967_297]) {
      expect(() =>
        selectNamedIndex({
          candidateCount,
          namespace: "action.tie.v1",
          rootSeed,
        }),
      ).toThrowError(
        expect.objectContaining({ code: "CHOICE_COUNT_OUT_OF_RANGE" }),
      );
    }
    expect(() =>
      selectNamedIndex({
        candidateCount: 2,
        namespace: "Action Tie",
        rootSeed,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "CHOICE_NAMESPACE_INVALID" }),
    );
    expect(() =>
      canonicalizeCandidates([
        { id: "candidate.same", rank: 1 },
        { id: "candidate.same", rank: 2 },
      ]),
    ).toThrowError(expect.objectContaining({ code: "CATALOG_DUPLICATE_ID" }));
    expect(() =>
      canonicalizeCandidates([
        { id: "candidate.one", rank: 1 },
        { id: "candidate.two", rank: 1 },
      ]),
    ).toThrowError(expect.objectContaining({ code: "CATALOG_ORDER_INVALID" }));
  });
});
