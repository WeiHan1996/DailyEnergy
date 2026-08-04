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
      COVERED: 155,
      NA_WITH_REASON: 0,
      PLANNED: 581,
    },
    total: 736,
  });
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
