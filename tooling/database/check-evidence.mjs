#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MANIFEST_VERSION = "e-006-evidence-v1";
const ALLOWED_STATUSES = new Set(["COVERED", "NA_WITH_REASON"]);
const REQUIRED_PREFIX_COUNTS = new Map([
  ["SQL-", 20],
  ["TX-", 9],
  ["S19-DB-", 64],
  ["S31-TEST-", 8],
]);

function expectedIds() {
  return [
    ...Array.from(
      { length: 20 },
      (_, index) => `SQL-${String(index + 1).padStart(3, "0")}`,
    ),
    ...Array.from(
      { length: 9 },
      (_, index) => `TX-${String(index + 1).padStart(2, "0")}`,
    ),
    ...Array.from(
      { length: 64 },
      (_, index) => `S19-DB-${String(index + 1).padStart(3, "0")}`,
    ),
    ...Array.from(
      { length: 8 },
      (_, index) => `S31-TEST-${String(index + 17).padStart(3, "0")}`,
    ),
  ];
}

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function assertNonEmpty(value, ruleId, detail) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(ruleId, detail);
  }
}

export function validateEvidenceManifest(manifest) {
  if (manifest?.manifest_version !== MANIFEST_VERSION) {
    fail("DB_EVIDENCE_VERSION", manifest?.manifest_version ?? "missing");
  }
  if (!Array.isArray(manifest.entries)) {
    fail("DB_EVIDENCE_ENTRIES", "entries must be an array");
  }

  const entriesById = new Map();
  for (const entry of manifest.entries) {
    assertNonEmpty(entry?.source_id, "DB_EVIDENCE_SOURCE_ID", "missing");
    if (entriesById.has(entry.source_id)) {
      fail("DB_EVIDENCE_DUPLICATE", entry.source_id);
    }
    if (!ALLOWED_STATUSES.has(entry.status)) {
      fail("DB_EVIDENCE_STATUS", `${entry.source_id}:${entry.status}`);
    }

    if (entry.status === "COVERED") {
      if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
        fail("DB_EVIDENCE_MISSING_ASSERTION", entry.source_id);
      }
      if (entry.na !== undefined) {
        fail("DB_EVIDENCE_CONFLICTING_STATUS", entry.source_id);
      }
      for (const evidence of entry.evidence) {
        assertNonEmpty(
          evidence.test_id,
          "DB_EVIDENCE_TEST_ID",
          entry.source_id,
        );
        assertNonEmpty(evidence.file, "DB_EVIDENCE_FILE", entry.source_id);
        assertNonEmpty(
          evidence.selector,
          "DB_EVIDENCE_SELECTOR",
          entry.source_id,
        );
        assertNonEmpty(evidence.level, "DB_EVIDENCE_LEVEL", entry.source_id);
        if (
          !Array.isArray(evidence.assertions) ||
          evidence.assertions.length === 0
        ) {
          fail("DB_EVIDENCE_MISSING_ASSERTION", entry.source_id);
        }
        for (const assertion of evidence.assertions) {
          assertNonEmpty(
            assertion,
            "DB_EVIDENCE_MISSING_ASSERTION",
            entry.source_id,
          );
        }
      }
    } else {
      if (entry.evidence !== undefined) {
        fail("DB_EVIDENCE_CONFLICTING_STATUS", entry.source_id);
      }
      assertNonEmpty(
        entry.na?.missing_layer,
        "DB_EVIDENCE_NA_LAYER",
        entry.source_id,
      );
      assertNonEmpty(
        entry.na?.reason,
        "DB_EVIDENCE_NA_REASON",
        entry.source_id,
      );
      assertNonEmpty(
        entry.na?.follow_up_owner,
        "DB_EVIDENCE_NA_OWNER",
        entry.source_id,
      );
    }
    entriesById.set(entry.source_id, entry);
  }

  const expected = expectedIds();
  for (const sourceId of expected) {
    if (!entriesById.has(sourceId)) {
      fail("DB_EVIDENCE_UNMAPPED", sourceId);
    }
  }
  for (const sourceId of entriesById.keys()) {
    if (!expected.includes(sourceId)) {
      fail("DB_EVIDENCE_UNKNOWN_SOURCE", sourceId);
    }
  }

  for (const [prefix, count] of REQUIRED_PREFIX_COUNTS) {
    const actual = [...entriesById.keys()].filter((id) =>
      id.startsWith(prefix),
    ).length;
    if (actual !== count) {
      fail("DB_EVIDENCE_SET_COUNT", `${prefix}:${actual}/${count}`);
    }
  }

  for (const sourceId of expected.filter(
    (id) => id.startsWith("SQL-") || id.startsWith("TX-"),
  )) {
    if (entriesById.get(sourceId).status !== "COVERED") {
      fail("DB_EVIDENCE_E006_CONTRACT_NOT_COVERED", sourceId);
    }
  }

  const counts = { COVERED: 0, NA_WITH_REASON: 0 };
  for (const entry of entriesById.values()) {
    counts[entry.status] += 1;
  }
  return { total: entriesById.size, counts };
}

export async function loadAndValidateEvidenceManifest(
  manifestPath = path.resolve("tests/database/evidence-manifest.json"),
) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return validateEvidenceManifest(manifest);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await loadAndValidateEvidenceManifest();
  console.log(
    `DB_EVIDENCE_OK:total=${result.total}:covered=${result.counts.COVERED}:na_with_reason=${result.counts.NA_WITH_REASON}`,
  );
}
