#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  devImageSetDigest,
  validateDevPublicationEvidence,
} from "./image-set.mjs";
import { createCosConfigEvidence } from "./preflight.mjs";
import {
  canonicalReleaseManifest,
  RELEASE_MANIFEST_VERSION,
  validateReleaseManifest,
  validateReleaseTransition,
} from "./release-contract.mjs";

const DATABASE_SECRET_VERSION = "dev-secret-v1";
const COS_SECRET_VERSION = "dev-cos-credential-v1";

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

export function materializeDevelopmentRelease({
  currentManifest = null,
  imageSet,
  objectConfigSource,
  runtimeEvidence,
  supplyEvidence,
}) {
  validateDevPublicationEvidence(imageSet, supplyEvidence, runtimeEvidence);
  if (currentManifest !== null) {
    validateReleaseManifest(currentManifest);
    if (currentManifest.release_id === imageSet.image_set_id) {
      fail("DEV_RELEASE_ALREADY_MATERIALIZED", imageSet.image_set_id);
    }
  }
  const objectConfig = createCosConfigEvidence(objectConfigSource);
  const catalogChanged =
    currentManifest !== null &&
    currentManifest.migrations.catalog_fingerprint !==
      supplyEvidence.catalog_fingerprint;
  const catalogGeneration =
    currentManifest === null
      ? 1
      : currentManifest.migrations.catalog_generation +
        (catalogChanged ? 1 : 0);
  const acceptedGenerations = [
    ...new Set(
      catalogChanged
        ? [currentManifest.migrations.catalog_generation, catalogGeneration]
        : [catalogGeneration, catalogGeneration + 1],
    ),
  ].sort((left, right) => left - right);
  const manifest = {
    compatibility: {
      accepted_generations: acceptedGenerations,
      generation: catalogGeneration,
      manifest_versions: [RELEASE_MANIFEST_VERSION],
    },
    config: {
      config_schema_version: "api-runtime-config-v1",
      contract_bundle_version: "api-contract-v1",
      environment: "DEV",
      log_level: "INFO",
      product_date_policy_version: "product-date-v1",
      runtime_fingerprints: {
        ...runtimeEvidence.fingerprints,
        object_config: objectConfig.config_sha256,
      },
      secret_ref_versions: {
        cos_secret_id: COS_SECRET_VERSION,
        cos_secret_key: COS_SECRET_VERSION,
        database_admin_url: DATABASE_SECRET_VERSION,
        database_api_url: DATABASE_SECRET_VERSION,
        database_background_url: DATABASE_SECRET_VERSION,
        database_interactive_url: DATABASE_SECRET_VERSION,
        database_migration_url: DATABASE_SECRET_VERSION,
        database_restricted_url: DATABASE_SECRET_VERSION,
        fault_control_token: DATABASE_SECRET_VERSION,
        postgres_password: DATABASE_SECRET_VERSION,
      },
    },
    evidence: {
      required_gates: [
        "ci-full",
        "deletion",
        "migration",
        "owner",
        "safety",
        "synthetic-smoke",
      ],
      source_ids: ["S31-TEST-047", "S32-DEPLOY-010"],
      synthetic_only: true,
    },
    images: Object.fromEntries(
      Object.entries(imageSet.images).map(([role, image]) => [
        role,
        image.reference,
      ]),
    ),
    manifest_version: RELEASE_MANIFEST_VERSION,
    migrations: {
      catalog_fingerprint: supplyEvidence.catalog_fingerprint,
      catalog_generation: catalogGeneration,
      destructive: false,
      migration_head: supplyEvidence.migration_head,
      rollback_compatible_release_ids:
        currentManifest === null ? [] : [currentManifest.release_id],
    },
    release_id: imageSet.image_set_id,
    source: {
      ci_run_attempt: imageSet.source.ci_run_attempt,
      ci_run_id: imageSet.source.ci_run_id,
      commit_sha: imageSet.source.commit_sha,
      lockfile_sha256: supplyEvidence.lockfile_sha256,
      repository: imageSet.source.repository,
    },
    supply_chain: {
      gate_ref: `github-actions:run:${imageSet.source.ci_run_id}:attempt:${imageSet.source.ci_run_attempt}`,
      image_set_sha256: devImageSetDigest(imageSet),
      provenance_sha256: supplyEvidence.ci_provenance_sha256,
      sbom_sha256: supplyEvidence.ci_sbom_sha256,
    },
    topology: {
      object_config_ref: "dev-cos-config-v1",
      object_endpoint: "TENCENT_COS_PRIVATE_INTERNAL",
      object_prefix: "dev/objects/",
      object_region: "ap-shanghai",
      production_enabled: false,
      public_ingress: "LOOPBACK_TLS_UNTIL_ICP",
      stateful_topology: "DEV_COLOCATED_EXCEPTION",
    },
  };
  validateReleaseManifest(manifest);
  if (currentManifest !== null) {
    validateReleaseTransition(currentManifest, manifest);
  }
  return manifest;
}

async function main() {
  const [
    imageSetFile,
    supplyFile,
    runtimeFile,
    objectConfigFile,
    outputFile,
    currentFile,
  ] = process.argv.slice(2);
  if (
    !imageSetFile ||
    !supplyFile ||
    !runtimeFile ||
    !objectConfigFile ||
    !outputFile
  ) {
    fail(
      "DEV_RELEASE_MATERIALIZE_USAGE",
      "image-set supply runtime object-config output [current-manifest]",
    );
  }
  const [
    imageSet,
    supplyEvidence,
    runtimeEvidence,
    objectConfigSource,
    currentManifest,
  ] = await Promise.all([
    readFile(path.resolve(imageSetFile), "utf8").then(JSON.parse),
    readFile(path.resolve(supplyFile), "utf8").then(JSON.parse),
    readFile(path.resolve(runtimeFile), "utf8").then(JSON.parse),
    readFile(path.resolve(objectConfigFile), "utf8"),
    currentFile
      ? readFile(path.resolve(currentFile), "utf8").then(JSON.parse)
      : null,
  ]);
  const manifest = materializeDevelopmentRelease({
    currentManifest,
    imageSet,
    objectConfigSource,
    runtimeEvidence,
    supplyEvidence,
  });
  await writeFile(
    path.resolve(outputFile),
    canonicalReleaseManifest(manifest),
    {
      flag: "wx",
      mode: 0o600,
    },
  );
  process.stdout.write(
    `DEV_RELEASE_MANIFEST_OK:id=${manifest.release_id}:generation=${manifest.compatibility.generation}:production_enabled=false\n`,
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
