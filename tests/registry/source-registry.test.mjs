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
      COVERED: 655,
      NA_WITH_REASON: 0,
      PLANNED: 349,
    },
    total: 1004,
  });

  const ai001Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/ai001-evidence-manifest.json",
    ),
  );
  assert.deepEqual(
    ai001Entries.map(({ source_id: sourceId }) => sourceId),
    [
      "G12-L01",
      "G12-L02",
      "G12-P01",
      "G12-P03",
      "G12-P04",
      "G12-P06",
      "PDM-U05",
      "S29-ARCH-008",
      "S29-ARCH-026",
      "S29-ARCH-031",
      "S29-ARCH-044",
      "S30-REPO-025",
      "S30-REPO-033",
      "S30-REPO-034",
      "S30-REPO-035",
      "S30-REPO-044",
    ],
  );

  const ai002Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/ai002-evidence-manifest.json",
    ),
  );
  assert.deepEqual(
    ai002Entries.map(({ source_id: sourceId }) => sourceId),
    [
      "G12-B01",
      "G12-B02",
      "G12-B03",
      "G12-B04",
      "G12-B05",
      "G12-B07",
      "G12-F01",
      "G12-F03",
      "G12-L05",
      "S33-OBS-033",
    ],
  );

  const ai003Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/ai003-evidence-manifest.json",
    ),
  );
  assert.deepEqual(
    ai003Entries.map(({ source_id: sourceId }) => sourceId),
    [
      "P13-C04",
      "P13-C06",
      "P13-C10",
      "S30-REPO-023",
      "S30-REPO-025",
      "S30-REPO-029",
      "S31-TEST-013",
      "S31-TEST-014",
    ],
  );

  const ai004Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/ai004-evidence-manifest.json",
    ),
  );
  assert.equal(ai004Entries.length, 69);
  assert.equal(
    [
      "G12-C01",
      "G12-L06",
      "P13-C01",
      "P13-W18",
      "S15-O01",
      "S15-O09",
      "S31-TEST-044",
    ].every((sourceId) =>
      ai004Entries.some(
        ({ source_id: candidateId, status }) =>
          candidateId === sourceId && status === "COVERED",
      ),
    ),
    true,
  );

  const ai005Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/ai005-evidence-manifest.json",
    ),
  );
  assert.deepEqual(
    ai005Entries.map(({ source_id: sourceId }) => sourceId),
    [
      "E16-P01",
      "E16-P02",
      "E16-P03",
      "E16-P04",
      "E16-P05",
      "E16-R07",
      "E16-T01",
      "E16-T04",
      "E16-T05",
      "E16-T06",
      "E16-T08",
      "E16-T12",
    ],
  );

  const analyticsEntries = registry.entries.filter(
    ({ source_sets: sourceSets }) =>
      sourceSets.some((sourceSet) =>
        ["s24-event-tracking", "s25-metrics"].includes(sourceSet),
      ),
  );
  assert.equal(analyticsEntries.length, 185);
  assert.equal(
    analyticsEntries.every(({ status }) => status === "COVERED"),
    true,
  );

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
      "D17-G03",
      "D17-I01",
      "D17-I03",
      "D17-I04",
      "D17-I05",
      "D17-I06",
      "D17-M05",
      "D17-M06",
      "D17-R01",
      "D17-R02",
      "D17-R03",
      "D17-R04",
      "D17-R05",
      "D17-R06",
      "D17-V01",
      "D17-V02",
      "D17-V03",
      "D17-V06",
      "D17-X05",
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

  const c008Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/c008-evidence-manifest.json",
    ),
  );
  assert.deepEqual(
    c008Entries.map(({ source_id: sourceId }) => sourceId),
    [
      "PDM-D03",
      "S20-C01",
      "S20-C03",
      "S20-C09",
      "S20-C10",
      "S20-D02",
      "S20-D03",
      "S20-D08",
      "S20-D09",
      "S20-D10",
      "S31-TEST-022",
    ],
  );

  const c016Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/c016-evidence-manifest.json",
    ),
  );
  assert.deepEqual(
    c016Entries.map(({ source_id: sourceId }) => sourceId),
    [
      "D17-G03",
      "D17-I01",
      "D17-R05",
      "D17-V03",
      "PDM-C04",
      "PDM-U04",
      "S20-A08",
      "S20-C05",
      "S20-C07",
      "S20-D07",
      "S20-E10",
      "S20-S01",
      "S20-S10",
      "S29-ARCH-009",
      "S29-ARCH-011",
      "S29-ARCH-017",
      "S29-ARCH-033",
      "S29-ARCH-037",
      "S29-ARCH-041",
      "S29-ARCH-042",
      "S31-TEST-016",
      "S31-TEST-033",
      "S31-TEST-034",
      "S31-TEST-039",
    ],
  );

  const c009Entries = registry.entries.filter(({ evidence }) =>
    evidence?.some(
      ({ origin }) => origin === "tests/registry/c009-evidence-manifest.json",
    ),
  );
  assert.deepEqual(
    c009Entries.map(({ source_id: sourceId }) => sourceId),
    ["D17-V02", "D17-V06", "D17-X05", "S28-STACK-007", "S30-REPO-022"],
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
