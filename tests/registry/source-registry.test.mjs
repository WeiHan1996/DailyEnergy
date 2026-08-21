import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverExpectedSources,
  loadAndValidateCoverageRegistry,
  loadCoverageRegistryDocument,
  loadRegistryConfiguration,
  validateCoverageRegistry,
} from "../../tooling/testing/source-registry.mjs";

const configuration = await loadRegistryConfiguration();
const expected = await discoverExpectedSources(configuration);
const registry = await loadCoverageRegistryDocument();

function cloneRegistry() {
  return structuredClone(registry);
}

test("T-E010-REGISTRY-001 validates every explicit Source-ID state", async () => {
  assert.deepEqual(await loadAndValidateCoverageRegistry(), {
    counts: {
      COVERED: 271,
      NA_WITH_REASON: 0,
      PLANNED: 516,
    },
    total: 787,
  });

  const domainEntries = registry.entries.filter(({ source_id: sourceId }) =>
    sourceId.startsWith("D17-"),
  );
  assert.equal(domainEntries.length, 48);
  assert.deepEqual(
    domainEntries
      .filter(({ status }) => status === "COVERED")
      .map(({ source_id: sourceId }) => sourceId),
    [
      "D17-D01",
      "D17-D02",
      "D17-D03",
      "D17-D04",
      "D17-D05",
      "D17-D06",
      "D17-I03",
      "D17-I04",
      "D17-I05",
      "D17-I06",
      "D17-V01",
    ],
  );

  const c007Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/c007-evidence-manifest.json",
    ),
  );
  assert.deepEqual(
    c007Entries.map(({ source_id: sourceId }) => sourceId),
    [
      "P13-C03",
      "P13-C06",
      "P13-C07",
      "P13-D01",
      "P13-D02",
      "P13-D03",
      "P13-D04",
      "P13-D05",
      "P13-D06",
      "P13-D07",
      "P13-D08",
      "P13-D09",
      "P13-D10",
      "P13-D11",
      "P13-D12",
      "P13-D13",
      "P13-D14",
      "P13-D15",
      "P13-D16",
      "P13-D17",
      "P13-D18",
      "P13-D19",
      "P13-D20",
      "P13-D21",
      "P13-D22",
      "P13-D23",
      "P13-D24",
    ],
  );
});

test("T-E010-REGISTRY-001 rejects unmapped and duplicate Source IDs", () => {
  const missing = cloneRegistry();
  missing.entries = missing.entries.slice(1);
  assert.throws(
    () => validateCoverageRegistry(missing, expected),
    /SOURCE_REGISTRY_UNMAPPED:/u,
  );

  const duplicate = cloneRegistry();
  duplicate.entries.push(structuredClone(duplicate.entries[0]));
  assert.throws(
    () => validateCoverageRegistry(duplicate, expected),
    /SOURCE_REGISTRY_DUPLICATE:/u,
  );
});

test("T-E010-REGISTRY-001 rejects unknown states and unapproved NA", () => {
  const unknownStatus = cloneRegistry();
  unknownStatus.entries[0].status = "PARTIAL";
  assert.throws(
    () => validateCoverageRegistry(unknownStatus, expected),
    /SOURCE_REGISTRY_STATUS:/u,
  );

  const unapproved = cloneRegistry();
  unapproved.entries[0] = {
    ...unapproved.entries[0],
    na: { reason: "Synthetic unsupported boundary" },
    planned: undefined,
    status: "NA_WITH_REASON",
  };
  assert.throws(
    () => validateCoverageRegistry(unapproved, expected),
    /SOURCE_REGISTRY_NA_APPROVAL:/u,
  );
});

test("T-E010-REGISTRY-001 rejects coverage without assertions", () => {
  const mutation = cloneRegistry();
  const entry = mutation.entries.find(
    ({ source_id: sourceId }) => sourceId === "SQL-001",
  );
  assert.ok(entry);
  entry.evidence[0].assertions = [];
  assert.throws(
    () => validateCoverageRegistry(mutation, expected),
    /SOURCE_REGISTRY_MISSING_ASSERTION:SQL-001/u,
  );
});

test("T-E010-REGISTRY-001 rejects evidence below a mandatory layer", () => {
  const mutation = cloneRegistry();
  const entry = mutation.entries.find(
    ({ source_id: sourceId }) => sourceId === "SQL-001",
  );
  assert.ok(entry);
  entry.evidence = entry.evidence.map((evidence) => ({
    ...evidence,
    level: "UNIT",
  }));
  assert.throws(
    () => validateCoverageRegistry(mutation, expected),
    /SOURCE_REGISTRY_LEVEL_INSUFFICIENT:SQL-001/u,
  );
});
