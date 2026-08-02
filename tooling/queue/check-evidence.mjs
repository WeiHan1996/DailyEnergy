#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MANIFEST_VERSION = "e-007-evidence-v1";
const EXPECTED_SOURCE_IDS = [
  "S28-STACK-025",
  "S28-STACK-026",
  "S28-STACK-027",
  "S29-ARCH-007",
  "S29-ARCH-018",
  "S29-ARCH-019",
  "S29-ARCH-020",
  "S29-ARCH-021",
  "S29-ARCH-022",
  "S29-ARCH-023",
  "S29-ARCH-024",
  "S29-ARCH-032",
  "S30-REPO-026",
  "S30-REPO-027",
  "S30-REPO-028",
  "S30-REPO-029",
  "S30-REPO-030",
  "S30-REPO-031",
  "S30-REPO-032",
  "S30-REPO-040",
  "S31-TEST-025",
  "S31-TEST-026",
  "S31-TEST-027",
  "S31-TEST-028",
  "S31-TEST-029",
  "S31-TEST-030",
  "S31-TEST-032",
  "S32-DEPLOY-026",
  "S32-DEPLOY-027",
  "S32-DEPLOY-028",
  "S32-DEPLOY-038",
  "S33-OBS-025",
  "S33-OBS-028",
  "S33-OBS-029",
  "S33-OBS-030",
  "S33-OBS-031",
  "S33-OBS-032",
];

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function validateQueueEvidenceManifest(manifest) {
  if (manifest?.manifest_version !== MANIFEST_VERSION) {
    fail("QUEUE_EVIDENCE_VERSION", manifest?.manifest_version ?? "missing");
  }
  if (!manifest.proofs || typeof manifest.proofs !== "object") {
    fail("QUEUE_EVIDENCE_PROOFS", "missing");
  }
  if (!Array.isArray(manifest.entries)) {
    fail("QUEUE_EVIDENCE_ENTRIES", "missing");
  }

  for (const [proofId, proof] of Object.entries(manifest.proofs)) {
    if (
      !nonEmpty(proofId) ||
      !nonEmpty(proof?.file) ||
      !nonEmpty(proof?.selector) ||
      !nonEmpty(proof?.level) ||
      !Array.isArray(proof?.assertions) ||
      proof.assertions.length === 0 ||
      proof.assertions.some((assertion) => !nonEmpty(assertion))
    ) {
      fail("QUEUE_EVIDENCE_PROOF_INVALID", proofId);
    }
  }

  const entries = new Map();
  for (const entry of manifest.entries) {
    if (!nonEmpty(entry?.source_id)) {
      fail("QUEUE_EVIDENCE_SOURCE_ID", "missing");
    }
    if (entries.has(entry.source_id)) {
      fail("QUEUE_EVIDENCE_DUPLICATE", entry.source_id);
    }
    if (entry.status !== "COVERED") {
      fail("QUEUE_EVIDENCE_STATUS", `${entry.source_id}:${entry.status}`);
    }
    if (!Array.isArray(entry.proof_ids) || entry.proof_ids.length === 0) {
      fail("QUEUE_EVIDENCE_MISSING_PROOF", entry.source_id);
    }
    for (const proofId of entry.proof_ids) {
      if (!Object.hasOwn(manifest.proofs, proofId)) {
        fail("QUEUE_EVIDENCE_UNKNOWN_PROOF", `${entry.source_id}:${proofId}`);
      }
    }
    entries.set(entry.source_id, entry);
  }

  for (const sourceId of EXPECTED_SOURCE_IDS) {
    if (!entries.has(sourceId)) {
      fail("QUEUE_EVIDENCE_UNMAPPED", sourceId);
    }
  }
  for (const sourceId of entries.keys()) {
    if (!EXPECTED_SOURCE_IDS.includes(sourceId)) {
      fail("QUEUE_EVIDENCE_UNKNOWN_SOURCE", sourceId);
    }
  }
  return Object.freeze({ covered: entries.size, total: entries.size });
}

export async function loadAndValidateQueueEvidenceManifest(
  manifestPath = path.resolve("tests/queue/evidence-manifest.json"),
) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = validateQueueEvidenceManifest(manifest);
  await Promise.all(
    Object.values(manifest.proofs).map((proof) =>
      access(path.resolve(proof.file)),
    ),
  );
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await loadAndValidateQueueEvidenceManifest();
  console.log(
    `QUEUE_EVIDENCE_OK:total=${result.total}:covered=${result.covered}`,
  );
}
