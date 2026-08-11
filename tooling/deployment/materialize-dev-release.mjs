#!/usr/bin/env node
import { createHash } from "node:crypto";
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
import { apiDeployConfigFingerprint } from "./runtime-evidence.mjs";

const VERSION_REF = /^[a-z0-9][a-z0-9-]{2,63}$/u;

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

export function validateDevelopmentReleaseSelection(value) {
  const keys = Object.keys(value ?? {}).sort();
  if (
    JSON.stringify(keys) !==
      JSON.stringify([
        "cos_secret_version",
        "database_secret_version",
        "object_config_ref",
      ]) ||
    Object.entries(value).some(([, ref]) => !VERSION_REF.test(ref))
  ) {
    fail("DEV_RELEASE_SELECTION_INVALID", "version-refs");
  }
  return Object.freeze({
    cos_secret_version: value.cos_secret_version,
    database_secret_version: value.database_secret_version,
    object_config_ref: value.object_config_ref,
  });
}

export function developmentReleaseId({
  imageSet,
  objectConfigSha256,
  selection,
}) {
  const selected = validateDevelopmentReleaseSelection(selection);
  if (!/^[a-f0-9]{64}$/u.test(objectConfigSha256)) {
    fail("DEV_RELEASE_OBJECT_CONFIG_FINGERPRINT_INVALID", "sha256");
  }
  const binding = JSON.stringify({
    image_set_id: imageSet.image_set_id,
    object_config_sha256: objectConfigSha256,
    ...selected,
  });
  const digest = createHash("sha256").update(binding).digest("hex");
  return `devr-${imageSet.source.commit_sha.slice(0, 12)}-${digest.slice(0, 24)}`;
}

export function materializeDevelopmentRelease({
  currentManifest = null,
  catalogManifest = currentManifest,
  imageSet,
  objectConfigSource,
  runtimeEvidence,
  selection,
  supplyEvidence,
}) {
  validateDevPublicationEvidence(imageSet, supplyEvidence, runtimeEvidence);
  const selected = validateDevelopmentReleaseSelection(selection);
  if (currentManifest !== null) {
    validateReleaseManifest(currentManifest);
  }
  if (catalogManifest !== null) {
    validateReleaseManifest(catalogManifest);
  }
  const objectConfig = createCosConfigEvidence(objectConfigSource);
  const materializedReleaseId = developmentReleaseId({
    imageSet,
    objectConfigSha256: objectConfig.config_sha256,
    selection: selected,
  });
  const catalogChanged =
    catalogManifest !== null &&
    catalogManifest.migrations.catalog_fingerprint !==
      supplyEvidence.catalog_fingerprint;
  const catalogGeneration =
    catalogManifest === null
      ? 1
      : catalogManifest.migrations.catalog_generation +
        (catalogChanged ? 1 : 0);
  const currentApplicationGeneration =
    currentManifest?.compatibility.generation ?? catalogGeneration;
  const acceptedGenerations = [
    ...new Set(
      currentApplicationGeneration !== catalogGeneration
        ? [currentApplicationGeneration, catalogGeneration]
        : catalogChanged
          ? [catalogManifest.migrations.catalog_generation, catalogGeneration]
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
        api_deploy_config: apiDeployConfigFingerprint(materializedReleaseId),
        object_config: objectConfig.config_sha256,
      },
      secret_ref_versions: {
        cos_secret_id: selected.cos_secret_version,
        cos_secret_key: selected.cos_secret_version,
        database_admin_url: selected.database_secret_version,
        database_api_url: selected.database_secret_version,
        database_background_url: selected.database_secret_version,
        database_interactive_url: selected.database_secret_version,
        database_migration_url: selected.database_secret_version,
        database_restricted_url: selected.database_secret_version,
        fault_control_token: selected.database_secret_version,
        postgres_password: selected.database_secret_version,
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
    release_id: materializedReleaseId,
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
      object_config_ref: selected.object_config_ref,
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
    catalogFile,
    databaseSecretVersion,
    cosSecretVersion,
    objectConfigRef,
  ] = process.argv.slice(2);
  if (
    !imageSetFile ||
    !supplyFile ||
    !runtimeFile ||
    !objectConfigFile ||
    !outputFile ||
    !databaseSecretVersion ||
    !cosSecretVersion ||
    !objectConfigRef
  ) {
    fail(
      "DEV_RELEASE_MATERIALIZE_USAGE",
      "image-set supply runtime object-config output [current-manifest|-] [catalog-manifest|-] database-secret-version cos-secret-version object-config-ref",
    );
  }
  const [
    imageSet,
    supplyEvidence,
    runtimeEvidence,
    objectConfigSource,
    currentManifest,
    catalogManifest,
  ] = await Promise.all([
    readFile(path.resolve(imageSetFile), "utf8").then(JSON.parse),
    readFile(path.resolve(supplyFile), "utf8").then(JSON.parse),
    readFile(path.resolve(runtimeFile), "utf8").then(JSON.parse),
    readFile(path.resolve(objectConfigFile), "utf8"),
    currentFile && currentFile !== "-"
      ? readFile(path.resolve(currentFile), "utf8").then(JSON.parse)
      : null,
    catalogFile && catalogFile !== "-"
      ? readFile(path.resolve(catalogFile), "utf8").then(JSON.parse)
      : null,
  ]);
  const manifest = materializeDevelopmentRelease({
    catalogManifest,
    currentManifest,
    imageSet,
    objectConfigSource,
    runtimeEvidence,
    selection: {
      cos_secret_version: cosSecretVersion,
      database_secret_version: databaseSecretVersion,
      object_config_ref: objectConfigRef,
    },
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
