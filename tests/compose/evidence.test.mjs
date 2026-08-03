#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadAndValidateComposeEvidenceManifest,
  validateComposeEvidenceManifest,
} from "../../tooling/compose/check-evidence.mjs";

const manifest = JSON.parse(
  await readFile("tests/compose/evidence-manifest.json", "utf8"),
);

test("T-COMPOSE-EVIDENCE-001 validates the scoped E-009 manifest", async () => {
  await assert.doesNotReject(loadAndValidateComposeEvidenceManifest());
  assert.deepEqual(validateComposeEvidenceManifest(manifest), {
    covered: 23,
    total: 23,
  });
});

test("T-COMPOSE-EVIDENCE-002 rejects missing and unknown proof mappings", () => {
  assert.throws(
    () =>
      validateComposeEvidenceManifest({
        ...manifest,
        entries: manifest.entries.slice(1),
      }),
    /COMPOSE_EVIDENCE_UNMAPPED:S30-REPO-030/u,
  );
  assert.throws(
    () =>
      validateComposeEvidenceManifest({
        ...manifest,
        entries: [
          { ...manifest.entries[0], proof_ids: ["UNKNOWN"] },
          ...manifest.entries.slice(1),
        ],
      }),
    /COMPOSE_EVIDENCE_UNKNOWN_PROOF:S30-REPO-030:UNKNOWN/u,
  );
});

test("T-COMPOSE-EVIDENCE-003 rejects false coverage", () => {
  assert.throws(
    () =>
      validateComposeEvidenceManifest({
        ...manifest,
        entries: [
          { ...manifest.entries[0], status: "PLANNED" },
          ...manifest.entries.slice(1),
        ],
      }),
    /COMPOSE_EVIDENCE_STATUS:S30-REPO-030:PLANNED/u,
  );
});
