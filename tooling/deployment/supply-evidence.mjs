#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  devRuntimeEvidenceDigest,
  validateDevRuntimeEvidence,
} from "./runtime-evidence.mjs";

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_SHA = /^[a-f0-9]{40}$/u;

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateDevSupplyEvidence(value) {
  const keys = Object.keys(value ?? {}).sort();
  const expected = [
    "catalog_fingerprint",
    "ci_provenance_sha256",
    "ci_sbom_sha256",
    "evidence_version",
    "lockfile_sha256",
    "migration_head",
    "runtime_evidence_sha256",
  ].sort();
  if (
    JSON.stringify(keys) !== JSON.stringify(expected) ||
    value.evidence_version !== "DevSupplyEvidenceV1" ||
    [
      value.catalog_fingerprint,
      value.ci_provenance_sha256,
      value.ci_sbom_sha256,
      value.lockfile_sha256,
      value.runtime_evidence_sha256,
    ].some((entry) => !SHA256.test(entry)) ||
    !/^\d{14}_[a-z0-9_]{3,80}$/u.test(value.migration_head)
  ) {
    fail("DEV_SUPPLY_EVIDENCE_INVALID", "document");
  }
  return value;
}

export async function collectDevSupplyEvidence({
  commitSha,
  migrationsDirectory,
  runtimeEvidenceFile,
  supplyChainDirectory,
}) {
  if (!GIT_SHA.test(commitSha ?? "")) {
    fail("DEV_SUPPLY_COMMIT_INVALID", "commit");
  }
  const [buildSource, provenanceSource, sbomSource, runtimeSource, catalog] =
    await Promise.all([
      readFile(path.join(supplyChainDirectory, "build-output-digests.json")),
      readFile(path.join(supplyChainDirectory, "provenance.intoto.json")),
      readFile(path.join(supplyChainDirectory, "sbom.spdx.json")),
      readFile(runtimeEvidenceFile, "utf8"),
      readFile(
        path.join(migrationsDirectory, "catalog-fingerprint.json"),
        "utf8",
      ),
    ]);
  let build;
  let provenance;
  let sbom;
  let runtime;
  let catalogFingerprint;
  try {
    build = JSON.parse(buildSource);
    provenance = JSON.parse(provenanceSource);
    sbom = JSON.parse(sbomSource);
    runtime = JSON.parse(runtimeSource);
    catalogFingerprint = JSON.parse(catalog);
  } catch {
    fail("DEV_SUPPLY_JSON_INVALID", "artifact");
  }
  validateDevRuntimeEvidence(runtime);
  const lockfileSha256 = build.lockfile_sha256;
  if (
    build.manifest_version !== "e-011-build-digest-v2" ||
    build.tested_sha !== commitSha ||
    build.head_sha !== commitSha ||
    !SHA256.test(lockfileSha256 ?? "") ||
    provenance?._type !== "https://in-toto.io/Statement/v1" ||
    provenance?.predicateType !== "https://slsa.dev/provenance/v1" ||
    provenance?.predicate?.buildDefinition?.externalParameters?.tested_sha !==
      commitSha ||
    provenance?.predicate?.buildDefinition?.externalParameters
      ?.lockfile_sha256 !== lockfileSha256 ||
    provenance?.subject?.[0]?.digest?.sha256 !== sha256(buildSource) ||
    sbom?.spdxVersion !== "SPDX-2.3" ||
    !String(sbom.documentNamespace ?? "").includes(commitSha) ||
    !String(sbom.documentNamespace ?? "").includes(lockfileSha256) ||
    catalogFingerprint?.algorithm !== "sha256" ||
    !SHA256.test(catalogFingerprint?.catalogSha256 ?? "")
  ) {
    fail("DEV_SUPPLY_BINDING_INVALID", "ci-or-catalog");
  }
  const migrations = (
    await readdir(migrationsDirectory, { withFileTypes: true })
  )
    .filter(
      (entry) =>
        entry.isDirectory() && /^\d{14}_[a-z0-9_]{3,80}$/u.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
  if (migrations.length === 0) {
    fail("DEV_SUPPLY_MIGRATION_HEAD_MISSING", "migrations");
  }
  return validateDevSupplyEvidence({
    catalog_fingerprint: catalogFingerprint.catalogSha256,
    ci_provenance_sha256: sha256(provenanceSource),
    ci_sbom_sha256: sha256(sbomSource),
    evidence_version: "DevSupplyEvidenceV1",
    lockfile_sha256: lockfileSha256,
    migration_head: migrations.at(-1),
    runtime_evidence_sha256: devRuntimeEvidenceDigest(runtime),
  });
}

async function main() {
  const [mode, supplyDirectory, runtimeEvidenceFile, destination] =
    process.argv.slice(2);
  if (
    mode === "--validate" &&
    supplyDirectory &&
    runtimeEvidenceFile === undefined &&
    destination === undefined
  ) {
    const value = JSON.parse(
      await readFile(path.resolve(supplyDirectory), "utf8"),
    );
    validateDevSupplyEvidence(value);
    process.stdout.write(
      `DEV_SUPPLY_EVIDENCE_OK:migration=${value.migration_head}:runtime=bound\n`,
    );
    return;
  }
  if (
    mode !== "--collect" ||
    !supplyDirectory ||
    !runtimeEvidenceFile ||
    !destination
  ) {
    fail(
      "DEV_SUPPLY_EVIDENCE_USAGE",
      "--collect supply-dir runtime-evidence output|--validate file",
    );
  }
  const value = await collectDevSupplyEvidence({
    commitSha: process.env.RELEASE_SHA,
    migrationsDirectory: path.resolve("prisma/migrations"),
    runtimeEvidenceFile: path.resolve(runtimeEvidenceFile),
    supplyChainDirectory: path.resolve(supplyDirectory),
  });
  await writeFile(
    path.resolve(destination),
    `${JSON.stringify(value, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `DEV_SUPPLY_EVIDENCE_OK:migration=${value.migration_head}:runtime=bound\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
