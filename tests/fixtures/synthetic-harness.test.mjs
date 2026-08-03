import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createDeterministicSources,
  createFaultController,
  createNetworkStub,
  createProviderStub,
  createSyntheticSubject,
  SYNTHETIC_FACTORY_VERSION,
} from "../../tooling/testing/synthetic-harness.mjs";
import {
  scanArtifactContent,
  validateEvidenceRecord,
  validateFixtureCatalog,
  validateGoldenProvenance,
} from "../../tooling/testing/policy-gates.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureCatalog = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/fixtures/catalog.json"),
    "utf8",
  ),
);
const faultCatalog = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/resilience/fault-plans.json"),
    "utf8",
  ),
);
const artifactPolicy = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/artifacts/policy.json"),
    "utf8",
  ),
);

describe("T-E010-HARNESS-001 synthetic fixture and fault harness", () => {
  it("uses fixed time, replayable random input, and synthetic identities", () => {
    expect(validateFixtureCatalog(fixtureCatalog)).toEqual({
      factoryVersion: SYNTHETIC_FACTORY_VERSION,
    });
    const first = createDeterministicSources({
      now: fixtureCatalog.default_clock,
      seed: fixtureCatalog.default_random_seed,
    });
    const second = createDeterministicSources({
      now: fixtureCatalog.default_clock,
      seed: fixtureCatalog.default_random_seed,
    });
    expect(first.now().toISOString()).toBe("2026-08-02T20:00:00.000Z");
    expect([first.random(), first.random(), first.random()]).toEqual([
      second.random(),
      second.random(),
      second.random(),
    ]);
    expect(createSyntheticSubject(7)).toMatchObject({
      account_ref: "synthetic-account-0007",
      subject_ref: "synthetic-subject-0007",
    });
  });

  it("keeps network and provider behavior closed and scripted", async () => {
    const network = createNetworkStub({
      allowedOrigin: "http://127.0.0.1:4310",
      responses: {
        "GET /v1/bootstrap/launch": { status: "SYNTHETIC_READY" },
      },
    });
    await expect(network.request("/v1/bootstrap/launch")).resolves.toEqual({
      status: "SYNTHETIC_READY",
    });
    await expect(
      network.request("https://external.example/v1/bootstrap/launch"),
    ).rejects.toThrow("SYNTHETIC_NETWORK_TARGET_DENIED");

    const provider = createProviderStub([{ outcome: "TIMEOUT" }]);
    await expect(
      provider.invoke({
        invocation_ref: "synthetic-invocation-0001",
        role: "PRIMARY",
      }),
    ).resolves.toEqual({ outcome: "TIMEOUT" });
    await expect(
      provider.invoke({
        invocation_ref: "synthetic-invocation-0001",
        role: "PRIMARY",
      }),
    ).rejects.toThrow("SYNTHETIC_PROVIDER_SCRIPT_EXHAUSTED");
  });

  it("injects a named fault once and then permits deterministic recovery", () => {
    const faults = createFaultController(faultCatalog);
    expect(() => faults.hit("CRASH-RELAY-AFTER-ENQUEUE")).toThrow(
      "CRASH-RELAY-AFTER-ENQUEUE",
    );
    expect(faults.hit("CRASH-RELAY-AFTER-ENQUEUE")).toEqual({
      fault_id: "CRASH-RELAY-AFTER-ENQUEUE",
      hit: 2,
    });
  });

  it("rejects implementation-recorded golden data and missing property seeds", () => {
    expect(() =>
      validateGoldenProvenance({ expected_source: "CURRENT_IMPLEMENTATION" }),
    ).toThrow("TEST_GOLDEN_PROVENANCE_INVALID");
    expect(() =>
      validateEvidenceRecord({
        fixture_version: "",
        result: "FAIL",
        test_id: "T-SYNTHETIC-PROPERTY",
        test_kind: "PROPERTY",
      }),
    ).toThrow("TEST_PROPERTY_REPLAY_METADATA_MISSING");
  });

  it("accepts synthetic artifact metadata and rejects sensitive canaries", () => {
    expect(
      scanArtifactContent(
        {
          fixture_version: SYNTHETIC_FACTORY_VERSION,
          result: "PASS",
          source_ids: ["S31-TEST-004"],
        },
        artifactPolicy,
      ),
    ).toEqual([]);
    expect(
      scanArtifactContent(
        { openid: "synthetic-known-fail-canary" },
        artifactPolicy,
      ),
    ).toEqual(["TEST_ARTIFACT_FORBIDDEN_KEY:$.openid"]);
  });
});
