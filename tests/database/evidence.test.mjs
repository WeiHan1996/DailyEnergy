#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import {
  loadAndValidateEvidenceManifest,
  validateEvidenceManifest,
} from "../../tooling/database/check-evidence.mjs";

const metadata = Object.freeze({
  test_id: "T-DB-EVIDENCE-001",
  source_ids: ["S31-TEST-018"],
  level: "STATIC",
  workload_or_profile: "TEST",
  fixture_version: "e-006-evidence-v1",
  fault_id: "MISSING_ASSERTION",
  expected_codes: ["DB_EVIDENCE_MISSING_ASSERTION"],
  evidence_class: "PR",
});

test(`${metadata.test_id} accepts the complete scoped manifest`, async () => {
  const result = await loadAndValidateEvidenceManifest();
  assert.deepEqual(result, {
    total: 101,
    counts: { COVERED: 53, NA_WITH_REASON: 48 },
  });
});

test(`${metadata.test_id} rejects COVERED entries without assertion evidence`, () => {
  const entries = [];
  for (let index = 1; index <= 20; index += 1) {
    entries.push({
      source_id: `SQL-${String(index).padStart(3, "0")}`,
      status: "COVERED",
      evidence: [
        {
          test_id: "T-SYNTHETIC",
          file: "tests/database/evidence.test.mjs",
          selector: "synthetic assertion",
          level: "DB",
          assertions: ["synthetic assertion"],
        },
      ],
    });
  }
  entries[0].evidence[0].assertions = [];
  for (let index = 1; index <= 9; index += 1) {
    entries.push({
      source_id: `TX-${String(index).padStart(2, "0")}`,
      status: "COVERED",
      evidence: [
        {
          test_id: "T-SYNTHETIC",
          file: "tests/database/evidence.test.mjs",
          selector: "synthetic assertion",
          level: "DB",
          assertions: ["synthetic assertion"],
        },
      ],
    });
  }
  for (let index = 1; index <= 64; index += 1) {
    entries.push({
      source_id: `S19-DB-${String(index).padStart(3, "0")}`,
      status: "NA_WITH_REASON",
      na: {
        missing_layer: "synthetic layer",
        reason: "synthetic reason",
        follow_up_owner: "E-010 synthetic suite",
      },
    });
  }
  for (let index = 17; index <= 24; index += 1) {
    entries.push({
      source_id: `S31-TEST-${String(index).padStart(3, "0")}`,
      status: "NA_WITH_REASON",
      na: {
        missing_layer: "synthetic layer",
        reason: "synthetic reason",
        follow_up_owner: "E-010 synthetic suite",
      },
    });
  }

  assert.throws(
    () =>
      validateEvidenceManifest({
        manifest_version: "e-006-evidence-v1",
        entries,
      }),
    /DB_EVIDENCE_MISSING_ASSERTION:SQL-001/u,
  );
});
