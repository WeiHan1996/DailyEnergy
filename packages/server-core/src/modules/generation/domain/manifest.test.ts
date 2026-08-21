import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { GenerationManifestStore } from "../spi/index.js";
import { selectFrozenGenerationManifest } from "../application/select-manifest.js";
import {
  DAILY_V1_GENERATION_MANIFEST,
  generationManifestFingerprintHex,
  parseGenerationManifest,
  parseManifestFingerprint,
  type GenerationManifest,
  type GenerationManifestRecord,
} from "./manifest.js";
import { describe, expect, it } from "vitest";

function record(
  manifest: GenerationManifest = DAILY_V1_GENERATION_MANIFEST,
): GenerationManifestRecord {
  return {
    activatedAt: new Date("2026-07-20T00:00:00.000Z"),
    fingerprintHex: generationManifestFingerprintHex(manifest),
    manifest,
    manifestRef: `manifest-ref-${manifest.result_version}`,
  };
}

function store(
  records: readonly GenerationManifestRecord[],
): GenerationManifestStore {
  const active = records.at(-1);
  return {
    close: async () => undefined,
    findByVersion: async (version) =>
      records.find(({ manifest }) => manifest.result_version === version),
    selectActive: async () => active,
  };
}

describe("C-005 GenerationManifest", () => {
  it("rejects a non-SHA256 manifest fingerprint byte sequence", () => {
    expect(() => parseManifestFingerprint(new Uint8Array(31))).toThrowError(
      expect.objectContaining({ code: "MANIFEST_INVALID" }),
    );
  });

  it("matches the Accepted S-11 daily-v1 manifest exactly", async () => {
    const fixture = JSON.parse(
      await readFile(
        resolve(
          import.meta.dirname,
          "../../../../../../docs/ai/s11-test-vectors.json",
        ),
        "utf8",
      ),
    ) as { manifest: unknown };
    expect(parseGenerationManifest(fixture.manifest)).toEqual(
      DAILY_V1_GENERATION_MANIFEST,
    );
    expect(
      generationManifestFingerprintHex(DAILY_V1_GENERATION_MANIFEST),
    ).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("freezes an existing selection across a same-day active release", async () => {
    const v1 = record();
    const v2Manifest = parseGenerationManifest({
      ...DAILY_V1_GENERATION_MANIFEST,
      result_version: "daily-v2",
      rule_version: "daily-rules-v2",
    });
    const v2 = record(v2Manifest);
    const registry = store([v1, v2]);
    await expect(
      selectFrozenGenerationManifest(registry, {
        acceptedAt: new Date("2026-07-21T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ resultVersion: "daily-v2" });
    await expect(
      selectFrozenGenerationManifest(registry, {
        acceptedAt: new Date("2026-07-21T00:00:01.000Z"),
        existing: {
          fingerprintHex: v1.fingerprintHex,
          manifestRef: v1.manifestRef,
          resultVersion: "daily-v1",
        },
      }),
    ).resolves.toMatchObject({
      fingerprintHex: v1.fingerprintHex,
      resultVersion: "daily-v1",
    });
  });

  it("rejects unknown, open-ended, mutated and mismatched manifests", async () => {
    expect(() =>
      parseGenerationManifest({
        ...DAILY_V1_GENERATION_MANIFEST,
        rule_version: "latest",
      }),
    ).toThrowError(expect.objectContaining({ code: "MANIFEST_INVALID" }));
    expect(() =>
      parseGenerationManifest({
        ...DAILY_V1_GENERATION_MANIFEST,
        unreviewed: "field",
      }),
    ).toThrowError(expect.objectContaining({ code: "MANIFEST_INVALID" }));

    const v1 = record();
    await expect(
      selectFrozenGenerationManifest(store([]), {
        acceptedAt: new Date("2026-07-21T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "MANIFEST_NOT_FOUND" });
    await expect(
      selectFrozenGenerationManifest(store([v1]), {
        acceptedAt: new Date("2026-07-21T00:00:00.000Z"),
        existing: {
          fingerprintHex: "0".repeat(64),
          manifestRef: v1.manifestRef,
          resultVersion: "daily-v1",
        },
      }),
    ).rejects.toMatchObject({ code: "MANIFEST_FINGERPRINT_MISMATCH" });
  });
});
