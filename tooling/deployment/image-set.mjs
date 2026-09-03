#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { validateReleaseManifest } from "./release-contract.mjs";
import {
  apiDeployConfigFingerprint,
  devRuntimeEvidenceDigest,
  validateDevRuntimeEvidence,
} from "./runtime-evidence.mjs";
import { validateDevSupplyEvidence } from "./supply-evidence.mjs";

const IMAGE_SET_VERSION = "DevImageSetV1";
const REPOSITORY = "WeiHan1996/DailyEnergy";
const IMAGE_ROLES = Object.freeze({
  admin: "e009-admin",
  migration: "e009-migration",
  proxy: "e012-proxy",
  server: "e009-server",
  stub: "e009-stub",
});
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/u;
const GIT_SHA = /^[a-f0-9]{40}$/u;
const RUN_ID = /^\d{1,20}$/u;

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function exactKeys(value, expected, ruleId) {
  const actual = Object.keys(value ?? {}).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(ruleId, actual.join(",") || "empty");
  }
}

function imageName(role) {
  return `ghcr.io/weihan1996/dailyenergy-${role}`;
}

function validateImage(role, image) {
  exactKeys(
    image,
    ["digest", "reference", "target"],
    "DEV_IMAGE_SET_IMAGE_KEYS",
  );
  if (
    !SHA256_DIGEST.test(image.digest) ||
    image.target !== IMAGE_ROLES[role] ||
    image.reference !== `${imageName(role)}@${image.digest}`
  ) {
    fail("DEV_IMAGE_SET_IMAGE_INVALID", role);
  }
}

export function validateDevImageSet(value) {
  exactKeys(
    value,
    [
      "created_at_utc",
      "evidence",
      "image_set_id",
      "image_set_version",
      "images",
      "source",
    ],
    "DEV_IMAGE_SET_KEYS",
  );
  if (
    value.image_set_version !== IMAGE_SET_VERSION ||
    !/^dev-[a-f0-9]{12}-\d{1,20}-\d{1,6}$/u.test(value.image_set_id) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(
      value.created_at_utc,
    )
  ) {
    fail("DEV_IMAGE_SET_IDENTITY", "document");
  }
  exactKeys(
    value.source,
    [
      "ci_run_attempt",
      "ci_run_id",
      "commit_sha",
      "publication_run_attempt",
      "publication_run_id",
      "repository",
    ],
    "DEV_IMAGE_SET_SOURCE_KEYS",
  );
  if (
    value.source.repository !== REPOSITORY ||
    !GIT_SHA.test(value.source.commit_sha) ||
    !RUN_ID.test(value.source.ci_run_id) ||
    !Number.isSafeInteger(value.source.ci_run_attempt) ||
    value.source.ci_run_attempt < 1 ||
    !RUN_ID.test(value.source.publication_run_id) ||
    !Number.isSafeInteger(value.source.publication_run_attempt) ||
    value.source.publication_run_attempt < 1
  ) {
    fail("DEV_IMAGE_SET_SOURCE", "source");
  }
  if (
    value.image_set_id !==
    `dev-${value.source.commit_sha.slice(0, 12)}-${value.source.publication_run_id}-${value.source.publication_run_attempt}`
  ) {
    fail("DEV_IMAGE_SET_SOURCE_BINDING", "image_set_id");
  }
  exactKeys(value.images, Object.keys(IMAGE_ROLES), "DEV_IMAGE_SET_ROLES");
  for (const [role, image] of Object.entries(value.images)) {
    validateImage(role, image);
  }
  exactKeys(
    value.evidence,
    [
      "build_platform",
      "catalog_fingerprint",
      "ci_provenance_sha256",
      "ci_sbom_sha256",
      "lockfile_sha256",
      "migration_head",
      "production_eligible",
      "provenance_status",
      "runtime_evidence_sha256",
      "sbom_status",
    ],
    "DEV_IMAGE_SET_EVIDENCE_KEYS",
  );
  if (
    value.evidence.build_platform !== "linux/amd64" ||
    value.evidence.production_eligible !== false ||
    value.evidence.provenance_status !== "BUILDKIT_MAX_UNSIGNED_DEV_ONLY" ||
    value.evidence.sbom_status !== "BUILDKIT_ATTACHED" ||
    [
      value.evidence.catalog_fingerprint,
      value.evidence.ci_provenance_sha256,
      value.evidence.ci_sbom_sha256,
      value.evidence.lockfile_sha256,
      value.evidence.runtime_evidence_sha256,
    ].some((entry) => !/^[a-f0-9]{64}$/u.test(entry)) ||
    !/^\d{14}_[a-z0-9_]{3,80}$/u.test(value.evidence.migration_head)
  ) {
    fail("DEV_IMAGE_SET_PRODUCTION_GATE", "dev-only");
  }
  return value;
}

function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function canonicalDevImageSet(value) {
  validateDevImageSet(value);
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

export function devImageSetDigest(value) {
  return createHash("sha256").update(canonicalDevImageSet(value)).digest("hex");
}

export function validateDevPublicationEvidence(
  imageSet,
  supplyEvidence,
  runtimeEvidence,
) {
  validateDevImageSet(imageSet);
  validateDevSupplyEvidence(supplyEvidence);
  validateDevRuntimeEvidence(runtimeEvidence);
  if (
    runtimeEvidence.release_id !== imageSet.image_set_id ||
    runtimeEvidence.server_image !== imageSet.images.server.reference ||
    supplyEvidence.runtime_evidence_sha256 !==
      devRuntimeEvidenceDigest(runtimeEvidence) ||
    Object.entries(supplyEvidence).some(
      ([name, value]) =>
        name !== "evidence_version" && imageSet.evidence[name] !== value,
    )
  ) {
    fail("DEV_PUBLICATION_EVIDENCE_DRIFT", imageSet.image_set_id);
  }
  return Object.freeze({
    image_set_id: imageSet.image_set_id,
    runtime_fingerprints: 5,
    supply_fields: 6,
  });
}

export function validateManifestImageSet(manifest, imageSet) {
  validateReleaseManifest(manifest);
  validateDevImageSet(imageSet);
  if (
    manifest.source.commit_sha !== imageSet.source.commit_sha ||
    manifest.source.ci_run_id !== imageSet.source.ci_run_id ||
    manifest.source.ci_run_attempt !== imageSet.source.ci_run_attempt ||
    manifest.source.lockfile_sha256 !== imageSet.evidence.lockfile_sha256 ||
    manifest.supply_chain.provenance_sha256 !==
      imageSet.evidence.ci_provenance_sha256 ||
    manifest.supply_chain.sbom_sha256 !== imageSet.evidence.ci_sbom_sha256 ||
    manifest.migrations.catalog_fingerprint !==
      imageSet.evidence.catalog_fingerprint ||
    manifest.migrations.migration_head !== imageSet.evidence.migration_head ||
    manifest.supply_chain.image_set_sha256 !== devImageSetDigest(imageSet)
  ) {
    fail("DEV_IMAGE_SET_MANIFEST_SOURCE_DRIFT", manifest.release_id);
  }
  for (const role of Object.keys(IMAGE_ROLES)) {
    if (manifest.images[role] !== imageSet.images[role].reference) {
      fail("DEV_IMAGE_SET_MANIFEST_IMAGE_DRIFT", role);
    }
  }
  return Object.freeze({
    image_set_id: imageSet.image_set_id,
    images: Object.keys(IMAGE_ROLES).length,
  });
}

export function validateManifestRuntimeEvidence(
  manifest,
  imageSet,
  runtimeEvidence,
) {
  validateManifestImageSet(manifest, imageSet);
  validateDevRuntimeEvidence(runtimeEvidence);
  if (
    runtimeEvidence.release_id !== imageSet.image_set_id ||
    runtimeEvidence.server_image !== manifest.images.server ||
    devRuntimeEvidenceDigest(runtimeEvidence) !==
      imageSet.evidence.runtime_evidence_sha256 ||
    Object.entries(runtimeEvidence.fingerprints).some(([name, fingerprint]) =>
      name === "api_deploy_config"
        ? manifest.config.runtime_fingerprints[name] !==
          apiDeployConfigFingerprint(manifest.release_id, {
            deploymentProfile:
              manifest.config.deployment_profile === "DEV_LITE"
                ? "DEV_LITE"
                : "STANDARD",
          })
        : manifest.config.runtime_fingerprints[name] !== fingerprint,
    )
  ) {
    fail("DEV_RUNTIME_EVIDENCE_MANIFEST_DRIFT", manifest.release_id);
  }
  return Object.freeze({
    fingerprints: 5,
    image_set_id: imageSet.image_set_id,
    release_id: manifest.release_id,
  });
}

function imageDigest(metadata, role) {
  const digest = metadata?.["containerimage.digest"];
  const descriptorDigest = metadata?.["containerimage.descriptor"]?.digest;
  if (
    !SHA256_DIGEST.test(digest ?? "") ||
    (descriptorDigest !== undefined && descriptorDigest !== digest)
  ) {
    fail("DEV_IMAGE_SET_METADATA_DIGEST", role);
  }
  return digest;
}

export async function generateDevImageSet(
  metadataDirectory,
  {
    ciRunAttempt,
    ciRunId,
    commitSha,
    createdAtUtc,
    publicationRunAttempt,
    publicationRunId,
    supplyEvidence,
  },
) {
  if (
    !GIT_SHA.test(commitSha ?? "") ||
    !RUN_ID.test(ciRunId ?? "") ||
    !/^\d{1,6}$/u.test(ciRunAttempt ?? "") ||
    !RUN_ID.test(publicationRunId ?? "") ||
    !/^\d{1,6}$/u.test(publicationRunAttempt ?? "") ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(
      createdAtUtc ?? "",
    )
  ) {
    fail("DEV_IMAGE_SET_GENERATION_CONTEXT", "environment");
  }
  validateDevSupplyEvidence(supplyEvidence);
  const images = {};
  for (const [role, target] of Object.entries(IMAGE_ROLES)) {
    let metadata;
    try {
      metadata = JSON.parse(
        await readFile(path.join(metadataDirectory, `${role}.json`), "utf8"),
      );
    } catch {
      fail("DEV_IMAGE_SET_METADATA_READ", role);
    }
    const digest = imageDigest(metadata, role);
    images[role] = {
      digest,
      reference: `${imageName(role)}@${digest}`,
      target,
    };
  }
  const value = {
    created_at_utc: createdAtUtc,
    evidence: {
      build_platform: "linux/amd64",
      catalog_fingerprint: supplyEvidence.catalog_fingerprint,
      ci_provenance_sha256: supplyEvidence.ci_provenance_sha256,
      ci_sbom_sha256: supplyEvidence.ci_sbom_sha256,
      lockfile_sha256: supplyEvidence.lockfile_sha256,
      migration_head: supplyEvidence.migration_head,
      production_eligible: false,
      provenance_status: "BUILDKIT_MAX_UNSIGNED_DEV_ONLY",
      runtime_evidence_sha256: supplyEvidence.runtime_evidence_sha256,
      sbom_status: "BUILDKIT_ATTACHED",
    },
    image_set_id: `dev-${commitSha.slice(0, 12)}-${publicationRunId}-${publicationRunAttempt}`,
    image_set_version: IMAGE_SET_VERSION,
    images,
    source: {
      ci_run_attempt: Number(ciRunAttempt),
      ci_run_id: ciRunId,
      commit_sha: commitSha,
      publication_run_attempt: Number(publicationRunAttempt),
      publication_run_id: publicationRunId,
      repository: REPOSITORY,
    },
  };
  return validateDevImageSet(value);
}

async function main() {
  const [mode, source, evidenceFile, destination] = process.argv.slice(2);
  if (
    mode === "--validate" &&
    source &&
    evidenceFile === undefined &&
    destination === undefined
  ) {
    const value = JSON.parse(await readFile(path.resolve(source), "utf8"));
    validateDevImageSet(value);
    process.stdout.write(
      `DEV_IMAGE_SET_OK:id=${value.image_set_id}:images=${Object.keys(IMAGE_ROLES).length}:production_eligible=false\n`,
    );
    return;
  }
  if (mode === "--validate-bundle" && source && evidenceFile && destination) {
    const [imageSet, supplyEvidence, runtimeEvidence] = await Promise.all(
      [source, evidenceFile, destination].map(async (file) =>
        JSON.parse(await readFile(path.resolve(file), "utf8")),
      ),
    );
    const result = validateDevPublicationEvidence(
      imageSet,
      supplyEvidence,
      runtimeEvidence,
    );
    process.stdout.write(
      `DEV_PUBLICATION_EVIDENCE_OK:id=${result.image_set_id}:runtime=${result.runtime_fingerprints}:supply=${result.supply_fields}\n`,
    );
    return;
  }
  if (mode === "--generate" && source && evidenceFile && destination) {
    const supplyEvidence = JSON.parse(
      await readFile(path.resolve(evidenceFile), "utf8"),
    );
    const value = await generateDevImageSet(path.resolve(source), {
      ciRunAttempt: process.env.CI_RUN_ATTEMPT,
      ciRunId: process.env.CI_RUN_ID,
      commitSha: process.env.RELEASE_SHA,
      createdAtUtc:
        process.env.IMAGE_SET_CREATED_AT_UTC ?? new Date().toISOString(),
      publicationRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
      publicationRunId: process.env.GITHUB_RUN_ID,
      supplyEvidence,
    });
    await writeFile(
      path.resolve(destination),
      `${JSON.stringify(value, null, 2)}\n`,
      { mode: 0o600 },
    );
    process.stdout.write(
      `DEV_IMAGE_SET_GENERATED:id=${value.image_set_id}:images=${Object.keys(IMAGE_ROLES).length}:production_eligible=false\n`,
    );
    return;
  }
  fail(
    "DEV_IMAGE_SET_USAGE",
    "--generate metadata-dir supply-evidence output|--validate file|--validate-bundle image-set supply-evidence runtime-evidence",
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
