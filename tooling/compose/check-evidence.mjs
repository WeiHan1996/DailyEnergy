#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const manifestVersion = "e-009-evidence-v1";
const expectedSourceIds = [
  "S30-REPO-030",
  "S30-REPO-032",
  "S31-TEST-027",
  "S31-TEST-030",
  "S31-TEST-047",
  "S32-DEPLOY-003",
  "S32-DEPLOY-004",
  "S32-DEPLOY-005",
  "S32-DEPLOY-011",
  "S32-DEPLOY-012",
  "S32-DEPLOY-017",
  "S32-DEPLOY-021",
  "S32-DEPLOY-026",
  "S32-DEPLOY-027",
  "S32-DEPLOY-029",
  "S32-DEPLOY-038",
  "S32-DEPLOY-041",
  "S32-DEPLOY-044",
  "S32-DEPLOY-045",
  "S33-OBS-021",
  "S33-OBS-023",
  "S33-OBS-024",
  "S33-OBS-030",
];

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function validateComposeEvidenceManifest(manifest) {
  if (manifest?.manifest_version !== manifestVersion) {
    fail("COMPOSE_EVIDENCE_VERSION", manifest?.manifest_version ?? "missing");
  }
  if (!manifest.proofs || typeof manifest.proofs !== "object") {
    fail("COMPOSE_EVIDENCE_PROOFS", "missing");
  }
  for (const [proofId, proof] of Object.entries(manifest.proofs)) {
    if (
      !nonEmpty(proofId) ||
      !nonEmpty(proof.file) ||
      !nonEmpty(proof.selector) ||
      !nonEmpty(proof.level) ||
      !Array.isArray(proof.assertions) ||
      proof.assertions.length === 0 ||
      proof.assertions.some((assertion) => !nonEmpty(assertion))
    ) {
      fail("COMPOSE_EVIDENCE_PROOF_INVALID", proofId);
    }
  }
  const entries = new Map();
  for (const entry of manifest.entries ?? []) {
    if (!nonEmpty(entry.source_id) || entries.has(entry.source_id)) {
      fail("COMPOSE_EVIDENCE_SOURCE_ID", entry?.source_id ?? "missing");
    }
    if (entry.status !== "COVERED") {
      fail("COMPOSE_EVIDENCE_STATUS", `${entry.source_id}:${entry.status}`);
    }
    if (!Array.isArray(entry.proof_ids) || entry.proof_ids.length === 0) {
      fail("COMPOSE_EVIDENCE_MISSING_PROOF", entry.source_id);
    }
    for (const proofId of entry.proof_ids) {
      if (!Object.hasOwn(manifest.proofs, proofId)) {
        fail("COMPOSE_EVIDENCE_UNKNOWN_PROOF", `${entry.source_id}:${proofId}`);
      }
    }
    entries.set(entry.source_id, entry);
  }
  for (const sourceId of expectedSourceIds) {
    if (!entries.has(sourceId)) {
      fail("COMPOSE_EVIDENCE_UNMAPPED", sourceId);
    }
  }
  for (const sourceId of entries.keys()) {
    if (!expectedSourceIds.includes(sourceId)) {
      fail("COMPOSE_EVIDENCE_UNKNOWN_SOURCE", sourceId);
    }
  }
  return Object.freeze({ covered: entries.size, total: entries.size });
}

export async function loadAndValidateComposeEvidenceManifest() {
  const manifest = JSON.parse(
    await readFile(
      path.resolve("tests/compose/evidence-manifest.json"),
      "utf8",
    ),
  );
  const result = validateComposeEvidenceManifest(manifest);
  await Promise.all(
    Object.values(manifest.proofs).map((proof) =>
      access(path.resolve(proof.file)),
    ),
  );
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await loadAndValidateComposeEvidenceManifest();
  console.log(
    `COMPOSE_EVIDENCE_OK:total=${result.total}:covered=${result.covered}`,
  );
}
