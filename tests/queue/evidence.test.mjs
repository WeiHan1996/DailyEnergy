#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadAndValidateQueueEvidenceManifest,
  validateQueueEvidenceManifest,
} from "../../tooling/queue/check-evidence.mjs";

const manifest = JSON.parse(
  await readFile("tests/queue/evidence-manifest.json", "utf8"),
);

test("T-QUEUE-EVIDENCE-001 validates the scoped E-007 registry", async () => {
  await assert.doesNotReject(loadAndValidateQueueEvidenceManifest());
  assert.deepEqual(validateQueueEvidenceManifest(manifest), {
    covered: 37,
    total: 37,
  });
});

test("T-QUEUE-EVIDENCE-002 rejects missing and unproven Source IDs", () => {
  assert.throws(
    () =>
      validateQueueEvidenceManifest({
        ...manifest,
        entries: manifest.entries.slice(1),
      }),
    /QUEUE_EVIDENCE_UNMAPPED:S28-STACK-025/u,
  );
  assert.throws(
    () =>
      validateQueueEvidenceManifest({
        ...manifest,
        entries: [
          { ...manifest.entries[0], proof_ids: ["UNKNOWN"] },
          ...manifest.entries.slice(1),
        ],
      }),
    /QUEUE_EVIDENCE_UNKNOWN_PROOF:S28-STACK-025:UNKNOWN/u,
  );
});

test("T-QUEUE-EVIDENCE-003 rejects false coverage metadata", () => {
  assert.throws(
    () =>
      validateQueueEvidenceManifest({
        ...manifest,
        entries: [
          { ...manifest.entries[0], status: "PLANNED" },
          ...manifest.entries.slice(1),
        ],
      }),
    /QUEUE_EVIDENCE_STATUS:S28-STACK-025:PLANNED/u,
  );
  assert.throws(
    () =>
      validateQueueEvidenceManifest({
        ...manifest,
        proofs: {
          ...manifest.proofs,
          "T-QUEUE-CONTRACT-001": {
            ...manifest.proofs["T-QUEUE-CONTRACT-001"],
            assertions: [],
          },
        },
      }),
    /QUEUE_EVIDENCE_PROOF_INVALID:T-QUEUE-CONTRACT-001/u,
  );
});
