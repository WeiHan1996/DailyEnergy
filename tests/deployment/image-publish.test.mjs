import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import {
  devImageSetDigest,
  generateDevImageSet,
  validateManifestRuntimeEvidence,
  validateDevPublicationEvidence,
  validateManifestImageSet,
  validateDevImageSet,
} from "../../tooling/deployment/image-set.mjs";
import {
  buildDevelopmentBundle,
  verifyDevelopmentBundle,
} from "../../tooling/deployment/deployment-bundle.mjs";
import { installDevelopmentBundle } from "../../tooling/deployment/install-dev-bundle.mjs";
import {
  developmentReleaseId,
  materializeDevelopmentRelease,
} from "../../tooling/deployment/materialize-dev-release.mjs";
import {
  validateReleaseTransition,
  validateRollbackTransition,
} from "../../tooling/deployment/release-contract.mjs";
import {
  commitSuccessfulDeployment,
  commitSuccessfulRollback,
  readReleaseState,
} from "../../tooling/deployment/release-state.mjs";
import {
  apiDeployConfigFingerprint,
  collectDevRuntimeEvidence,
  devRuntimeEvidenceDigest,
  pullDevelopmentRuntimeImage,
  runDevelopmentRuntimeImage,
  validateDevRuntimeEvidence,
} from "../../tooling/deployment/runtime-evidence.mjs";
import {
  collectDevSupplyEvidence,
  validateDevSupplyEvidence,
} from "../../tooling/deployment/supply-evidence.mjs";
import {
  REQUIRED_RELEASE_CHECKS,
  validateReleaseCiEvidence,
} from "../../tooling/deployment/verify-ci-release.mjs";
import { releaseManifestFixture } from "./release-fixture.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const COMMIT_SHA = "a".repeat(40);
const RELEASE_SELECTION_V1 = Object.freeze({
  cos_secret_version: "dev-cos-credential-v1",
  database_secret_version: "dev-secret-v1",
  object_config_ref: "dev-cos-config-v1",
});

function runtimeEvidence(releaseId) {
  return {
    evidence_version: "DevRuntimeEvidenceV1",
    fingerprints: {
      api_capability: "a".repeat(64),
      api_deploy_config: apiDeployConfigFingerprint(releaseId),
      worker_background: "c".repeat(64),
      worker_interactive: "d".repeat(64),
      worker_restricted: "e".repeat(64),
    },
    release_id: releaseId,
    server_image: `ghcr.io/weihan1996/dailyenergy-server@sha256:${"4".repeat(64)}`,
  };
}

function supplyEvidence(releaseId, { catalogFingerprint = "7" } = {}) {
  return {
    catalog_fingerprint: catalogFingerprint.repeat(64),
    ci_provenance_sha256: "5".repeat(64),
    ci_sbom_sha256: "6".repeat(64),
    evidence_version: "DevSupplyEvidenceV1",
    lockfile_sha256: "c".repeat(64),
    migration_head: "20260730000000_initial_application_schema",
    runtime_evidence_sha256: devRuntimeEvidenceDigest(
      runtimeEvidence(releaseId),
    ),
  };
}

async function metadataDirectory(t) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "dailyenergy-e012-images-"),
  );
  t.after(() => rm(directory, { force: true, recursive: true }));
  for (const [index, role] of [
    "admin",
    "migration",
    "proxy",
    "server",
    "stub",
  ].entries()) {
    const digest = `sha256:${String(index + 1).repeat(64)}`;
    await writeFile(
      path.join(directory, `${role}.json`),
      `${JSON.stringify({
        "containerimage.descriptor": { digest },
        "containerimage.digest": digest,
      })}\n`,
    );
  }
  return directory;
}

function successfulChecks(runId = "40000000001") {
  return REQUIRED_RELEASE_CHECKS.map((name) => ({
    conclusion: "success",
    details_url: `https://github.com/WeiHan1996/DailyEnergy/actions/runs/${runId}/job/1`,
    name,
    status: "completed",
  }));
}

function successfulWorkflowRun(runId = "40000000001") {
  return {
    conclusion: "success",
    event: "push",
    head_branch: "main",
    head_sha: COMMIT_SHA,
    id: Number(runId),
    name: "CI",
    run_attempt: 2,
    status: "completed",
  };
}

test("T-E012-IMAGE-001 normalizes installed bundle ownership before its mode", async () => {
  const installerSource = await readFile(
    path.join(repositoryRoot, "tooling/deployment/install-dev-bundle.mjs"),
    "utf8",
  );
  const helperStart = installerSource.indexOf(
    "async function copyProtectedFile(",
  );
  const helperEnd = installerSource.indexOf(
    "\n}\n\nasync function protectDirectories",
    helperStart,
  );
  assert.notEqual(helperStart, -1);
  assert.notEqual(helperEnd, -1);
  const helperSource = installerSource.slice(helperStart, helperEnd);
  const copyIndex = helperSource.indexOf(
    "await copyFile(source, destination, constants.COPYFILE_EXCL);",
  );
  const ownerIndex = helperSource.indexOf(
    "await chown(destination, expectedUid, expectedGid);",
  );
  const modeIndex = helperSource.indexOf("await chmod(destination, 0o600);");
  assert.ok(copyIndex >= 0);
  assert.ok(ownerIndex > copyIndex);
  assert.ok(modeIndex > ownerIndex);
});

test("T-E012-IMAGE-001 creates a closed five-role digest-only DEV image set", async (t) => {
  const directory = await metadataDirectory(t);
  const releaseId = `dev-${COMMIT_SHA.slice(0, 12)}-50000000001-1`;
  const value = await generateDevImageSet(directory, {
    ciRunAttempt: "1",
    ciRunId: "40000000001",
    commitSha: COMMIT_SHA,
    createdAtUtc: "2026-08-05T02:03:04.000Z",
    publicationRunAttempt: "1",
    publicationRunId: "50000000001",
    supplyEvidence: supplyEvidence(releaseId),
  });
  assert.equal(validateDevImageSet(value), value);
  assert.equal(value.evidence.production_eligible, false);
  assert.equal(
    value.evidence.provenance_status,
    "BUILDKIT_MAX_UNSIGNED_DEV_ONLY",
  );
  for (const image of Object.values(value.images)) {
    assert.match(image.reference, /@sha256:[a-f0-9]{64}$/u);
    assert.equal(image.reference.includes(":latest"), false);
  }
  assert.deepEqual(
    validateDevPublicationEvidence(
      value,
      supplyEvidence(releaseId),
      runtimeEvidence(releaseId),
    ),
    {
      image_set_id: value.image_set_id,
      runtime_fingerprints: 5,
      supply_fields: 6,
    },
  );

  const objectConfigSource = [
    "COS_BUCKET=dailyenergy-dev-1250000000",
    "COS_ENDPOINT=dailyenergy-dev-1250000000.cos-internal.ap-shanghai.tencentcos.cn",
    "COS_PREFIX=dev/objects/",
    "COS_REGION=ap-shanghai",
    "",
  ].join("\n");
  const materialized = materializeDevelopmentRelease({
    imageSet: value,
    objectConfigSource,
    runtimeEvidence: runtimeEvidence(releaseId),
    selection: RELEASE_SELECTION_V1,
    supplyEvidence: supplyEvidence(releaseId),
  });
  assert.match(materialized.release_id, /^devr-a{12}-[a-f0-9]{24}$/u);
  assert.equal(
    developmentReleaseId({
      imageSet: value,
      objectConfigSha256:
        materialized.config.runtime_fingerprints.object_config,
      selection: {
        object_config_ref: "dev-cos-config-v1",
        database_secret_version: "dev-secret-v1",
        cos_secret_version: "dev-cos-credential-v1",
      },
    }),
    materialized.release_id,
  );
  assert.deepEqual(materialized.compatibility.accepted_generations, [1, 2]);
  assert.deepEqual(
    validateManifestRuntimeEvidence(
      materialized,
      value,
      runtimeEvidence(releaseId),
    ),
    {
      fingerprints: 5,
      image_set_id: value.image_set_id,
      release_id: materialized.release_id,
    },
  );
  assert.equal(JSON.stringify(materialized).includes("1250000000"), false);

  const migratedReleaseId = `dev-${COMMIT_SHA.slice(0, 12)}-50000000002-1`;
  const migratedSupply = supplyEvidence(migratedReleaseId, {
    catalogFingerprint: "8",
  });
  const migratedImageSet = await generateDevImageSet(directory, {
    ciRunAttempt: "1",
    ciRunId: "40000000001",
    commitSha: COMMIT_SHA,
    createdAtUtc: "2026-08-05T03:03:04.000Z",
    publicationRunAttempt: "1",
    publicationRunId: "50000000002",
    supplyEvidence: migratedSupply,
  });
  const migratedManifest = materializeDevelopmentRelease({
    currentManifest: materialized,
    imageSet: migratedImageSet,
    objectConfigSource,
    runtimeEvidence: runtimeEvidence(migratedReleaseId),
    selection: RELEASE_SELECTION_V1,
    supplyEvidence: migratedSupply,
  });
  assert.equal(migratedManifest.migrations.catalog_generation, 2);
  assert.deepEqual(migratedManifest.compatibility.accepted_generations, [1, 2]);
  assert.deepEqual(
    migratedManifest.migrations.rollback_compatible_release_ids,
    [materialized.release_id],
  );

  const forwardReleaseId = `dev-${COMMIT_SHA.slice(0, 12)}-50000000003-1`;
  const forwardSupply = supplyEvidence(forwardReleaseId, {
    catalogFingerprint: "8",
  });
  const forwardImageSet = await generateDevImageSet(directory, {
    ciRunAttempt: "1",
    ciRunId: "40000000001",
    commitSha: COMMIT_SHA,
    createdAtUtc: "2026-08-05T04:03:04.000Z",
    publicationRunAttempt: "1",
    publicationRunId: "50000000003",
    supplyEvidence: forwardSupply,
  });
  const forwardManifest = materializeDevelopmentRelease({
    currentManifest: migratedManifest,
    imageSet: forwardImageSet,
    objectConfigSource,
    runtimeEvidence: runtimeEvidence(forwardReleaseId),
    selection: RELEASE_SELECTION_V1,
    supplyEvidence: forwardSupply,
  });
  assert.equal(forwardManifest.migrations.catalog_generation, 2);
  assert.deepEqual(forwardManifest.compatibility.accepted_generations, [2, 3]);

  await Promise.all([
    writeFile(
      path.join(directory, "dev-image-set.json"),
      `${JSON.stringify(value, null, 2)}\n`,
    ),
    writeFile(
      path.join(directory, "dev-runtime-evidence.json"),
      `${JSON.stringify(runtimeEvidence(releaseId), null, 2)}\n`,
    ),
    writeFile(
      path.join(directory, "dev-supply-evidence.json"),
      `${JSON.stringify(supplyEvidence(releaseId), null, 2)}\n`,
    ),
  ]);
  const bundle = path.join(directory, "bundle");
  const built = await buildDevelopmentBundle(bundle, directory);
  assert.equal(built.image_set_id, value.image_set_id);
  assert.equal(built.release_id, null);
  assert.equal(built.files, 16);
  assert.equal(built.materialized, false);
  assert.deepEqual(await verifyDevelopmentBundle(bundle), built);

  const developmentRoot = path.join(directory, "development-root");
  await mkdir(path.join(developmentRoot, "config"), {
    mode: 0o700,
    recursive: true,
  });
  await writeFile(
    path.join(developmentRoot, "config", "dev-cos-config-v1.env"),
    objectConfigSource,
    { mode: 0o600 },
  );
  const protection = {
    developmentRoot,
    expectedGid: process.getgid(),
    expectedUid: process.getuid(),
    selection: RELEASE_SELECTION_V1,
  };
  const installed = await installDevelopmentBundle(bundle, protection);
  assert.equal(installed.installed, true);
  assert.equal(installed.release_id, materialized.release_id);
  assert.equal(path.basename(installed.path), materialized.release_id);
  assert.deepEqual(
    await verifyDevelopmentBundle(installed.path, { materialized: true }),
    {
      files: 16,
      image_set_id: value.image_set_id,
      materialized: true,
      release_id: materialized.release_id,
    },
  );
  const replayed = await installDevelopmentBundle(bundle, protection);
  assert.equal(replayed.installed, false);
  assert.equal(replayed.manifest_sha256, installed.manifest_sha256);
  const installedManifest = JSON.parse(
    await readFile(path.join(installed.path, "release-manifest.json"), "utf8"),
  );
  const stateRoot = path.join(developmentRoot, "deployment");
  await commitSuccessfulDeployment(stateRoot, installedManifest, {
    acceptedAtUtc: "2026-08-05T04:10:00.000Z",
  });

  const selectionV2 = {
    cos_secret_version: "dev-cos-credential-v2",
    database_secret_version: "dev-secret-v2",
    object_config_ref: "dev-cos-config-v2",
  };
  await writeFile(
    path.join(developmentRoot, "config", "dev-cos-config-v2.env"),
    objectConfigSource,
    { mode: 0o600 },
  );
  const rotated = await installDevelopmentBundle(bundle, {
    ...protection,
    selection: selectionV2,
  });
  assert.equal(rotated.installed, true);
  assert.notEqual(rotated.release_id, installed.release_id);
  const rotatedManifest = JSON.parse(
    await readFile(path.join(rotated.path, "release-manifest.json"), "utf8"),
  );
  assert.equal(
    rotatedManifest.config.secret_ref_versions.database_api_url,
    "dev-secret-v2",
  );
  assert.equal(
    rotatedManifest.config.secret_ref_versions.cos_secret_key,
    "dev-cos-credential-v2",
  );
  assert.equal(rotatedManifest.topology.object_config_ref, "dev-cos-config-v2");
  assert.deepEqual(rotatedManifest.images, materialized.images);
  assert.deepEqual(rotatedManifest.migrations.rollback_compatible_release_ids, [
    installedManifest.release_id,
  ]);
  assert.deepEqual(
    validateReleaseTransition(installedManifest, rotatedManifest),
    {
      idempotent: false,
    },
  );
  assert.deepEqual(
    validateRollbackTransition(rotatedManifest, installedManifest),
    {
      compatible: true,
    },
  );
  await commitSuccessfulDeployment(stateRoot, rotatedManifest, {
    acceptedAtUtc: "2026-08-05T04:11:00.000Z",
  });
  await commitSuccessfulRollback(stateRoot, {
    acceptedAtUtc: "2026-08-05T04:12:00.000Z",
  });
  const rotatedBack = await readReleaseState(stateRoot);
  assert.equal(rotatedBack.current.release_id, installedManifest.release_id);
  assert.equal(rotatedBack.rollback_target, null);

  await writeFile(path.join(bundle, "compose.yaml"), "drift\n");
  await assert.rejects(
    verifyDevelopmentBundle(bundle),
    /DEV_BUNDLE_FILE_DIGEST_DRIFT:compose.yaml/u,
  );

  const manifest = releaseManifestFixture(value.image_set_id, {
    commit: "a",
    imageSetFingerprint: devImageSetDigest(value),
    runId: "40000000001",
  });
  assert.deepEqual(validateManifestImageSet(manifest, value), {
    image_set_id: value.image_set_id,
    images: 5,
  });
  const driftedManifest = structuredClone(manifest);
  driftedManifest.images.server = `ghcr.io/weihan1996/dailyenergy-server@sha256:${"9".repeat(64)}`;
  assert.throws(
    () => validateManifestImageSet(driftedManifest, value),
    /DEV_IMAGE_SET_MANIFEST_IMAGE_DRIFT/u,
  );

  const productionClaim = structuredClone(value);
  productionClaim.evidence.production_eligible = true;
  assert.throws(
    () => validateDevImageSet(productionClaim),
    /DEV_IMAGE_SET_PRODUCTION_GATE/u,
  );
  const tagInsteadOfDigest = structuredClone(value);
  tagInsteadOfDigest.images.server.reference =
    "ghcr.io/weihan1996/dailyenergy-server:latest";
  assert.throws(
    () => validateDevImageSet(tagInsteadOfDigest),
    /DEV_IMAGE_SET_IMAGE_INVALID/u,
  );
});

test("T-E012-IMAGE-001 binds the API deploy fingerprint to the materialized release identity", async (t) => {
  const directory = await metadataDirectory(t);
  const publicationReleaseId = `dev-${COMMIT_SHA.slice(0, 12)}-50000000001-1`;
  const evidence = supplyEvidence(publicationReleaseId);
  const imageSet = await generateDevImageSet(directory, {
    ciRunAttempt: "1",
    ciRunId: "40000000001",
    commitSha: COMMIT_SHA,
    createdAtUtc: "2026-08-05T02:03:04.000Z",
    publicationRunAttempt: "1",
    publicationRunId: "50000000001",
    supplyEvidence: evidence,
  });
  const publicationRuntimeEvidence = runtimeEvidence(publicationReleaseId);
  const manifest = materializeDevelopmentRelease({
    imageSet,
    objectConfigSource: [
      "COS_BUCKET=dailyenergy-dev-1250000000",
      "COS_ENDPOINT=dailyenergy-dev-1250000000.cos-internal.ap-shanghai.tencentcos.cn",
      "COS_PREFIX=dev/objects/",
      "COS_REGION=ap-shanghai",
      "",
    ].join("\n"),
    runtimeEvidence: publicationRuntimeEvidence,
    selection: RELEASE_SELECTION_V1,
    supplyEvidence: evidence,
  });

  assert.equal(
    manifest.config.runtime_fingerprints.api_deploy_config,
    apiDeployConfigFingerprint(manifest.release_id),
  );
  assert.notEqual(
    manifest.config.runtime_fingerprints.api_deploy_config,
    publicationRuntimeEvidence.fingerprints.api_deploy_config,
  );
  assert.doesNotThrow(() =>
    validateManifestRuntimeEvidence(
      manifest,
      imageSet,
      publicationRuntimeEvidence,
    ),
  );

  const publicationFingerprintReuse = structuredClone(manifest);
  publicationFingerprintReuse.config.runtime_fingerprints.api_deploy_config =
    publicationRuntimeEvidence.fingerprints.api_deploy_config;
  assert.throws(
    () =>
      validateManifestRuntimeEvidence(
        publicationFingerprintReuse,
        imageSet,
        publicationRuntimeEvidence,
      ),
    /DEV_RUNTIME_EVIDENCE_MANIFEST_DRIFT/u,
  );
});

test("T-E012-IMAGE-001 rejects missing and inconsistent BuildKit metadata", async (t) => {
  const directory = await metadataDirectory(t);
  await rm(path.join(directory, "stub.json"));
  await assert.rejects(
    generateDevImageSet(directory, {
      ciRunAttempt: "1",
      ciRunId: "40000000001",
      commitSha: COMMIT_SHA,
      createdAtUtc: "2026-08-05T02:03:04.000Z",
      publicationRunAttempt: "1",
      publicationRunId: "50000000001",
      supplyEvidence: supplyEvidence(
        `dev-${COMMIT_SHA.slice(0, 12)}-50000000001-1`,
      ),
    }),
    /DEV_IMAGE_SET_METADATA_READ:stub/u,
  );
});

test("T-E012-IMAGE-001 binds runtime fingerprints and CI supply evidence to the published commit", async (t) => {
  const directory = await metadataDirectory(t);
  const releaseId = `dev-${COMMIT_SHA.slice(0, 12)}-50000000001-1`;
  const pulledImages = [];
  const runtime = await collectDevRuntimeEvidence(
    path.join(directory, "server.json"),
    {
      commitSha: COMMIT_SHA,
      publicationRunAttempt: "1",
      publicationRunId: "50000000001",
    },
    {
      pullImage: (image) => pulledImages.push(image),
      runImage: (_image, arguments_, environment) =>
        arguments_.join(" ").includes("runtime-config")
          ? JSON.stringify({
              capabilityFingerprint: "a".repeat(64),
              deployConfigFingerprint: apiDeployConfigFingerprint(
                environment.DAILYENERGY_RELEASE_ID,
              ),
              releaseId: environment.DAILYENERGY_RELEASE_ID,
            })
          : JSON.stringify({
              background: "c".repeat(64),
              interactive: "d".repeat(64),
              restricted: "e".repeat(64),
            }),
    },
  );
  assert.equal(validateDevRuntimeEvidence(runtime), runtime);
  assert.equal(runtime.release_id, releaseId);
  assert.deepEqual(pulledImages, [runtime.server_image]);
  const driftedRuntimeFingerprint = structuredClone(runtime);
  driftedRuntimeFingerprint.fingerprints.api_deploy_config = "b".repeat(64);
  assert.throws(
    () => validateDevRuntimeEvidence(driftedRuntimeFingerprint),
    /DEV_RUNTIME_FINGERPRINT_INVALID:api-deploy-config/u,
  );

  const supplyDirectory = path.join(directory, "supply");
  const migrationsDirectory = path.join(directory, "migrations");
  await mkdir(supplyDirectory);
  await mkdir(migrationsDirectory);
  await mkdir(
    path.join(migrationsDirectory, "20260730000000_initial_application_schema"),
  );
  const runtimeFile = path.join(directory, "runtime-evidence.json");
  await writeFile(runtimeFile, `${JSON.stringify(runtime, null, 2)}\n`);
  const lockfileSha256 = "c".repeat(64);
  const buildSource = Buffer.from(
    `${JSON.stringify(
      {
        base_sha: COMMIT_SHA,
        entries: [],
        head_sha: COMMIT_SHA,
        lockfile_sha256: lockfileSha256,
        manifest_version: "e-011-build-digest-v2",
        tested_sha: COMMIT_SHA,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(supplyDirectory, "build-output-digests.json"),
    buildSource,
  );
  await writeFile(
    path.join(supplyDirectory, "provenance.intoto.json"),
    `${JSON.stringify({
      _type: "https://in-toto.io/Statement/v1",
      predicate: {
        buildDefinition: {
          externalParameters: {
            lockfile_sha256: lockfileSha256,
            tested_sha: COMMIT_SHA,
          },
        },
      },
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [
        {
          digest: {
            sha256: createHash("sha256").update(buildSource).digest("hex"),
          },
        },
      ],
    })}\n`,
  );
  await writeFile(
    path.join(supplyDirectory, "sbom.spdx.json"),
    `${JSON.stringify({
      documentNamespace: `https://dailyenergy.invalid/spdx/${COMMIT_SHA}/${lockfileSha256}`,
      spdxVersion: "SPDX-2.3",
    })}\n`,
  );
  await writeFile(
    path.join(migrationsDirectory, "catalog-fingerprint.json"),
    `${JSON.stringify({
      algorithm: "sha256",
      catalogSha256: "7".repeat(64),
    })}\n`,
  );
  const supply = await collectDevSupplyEvidence({
    commitSha: COMMIT_SHA,
    migrationsDirectory,
    runtimeEvidenceFile: runtimeFile,
    supplyChainDirectory: supplyDirectory,
  });
  assert.equal(validateDevSupplyEvidence(supply), supply);
  assert.equal(
    supply.runtime_evidence_sha256,
    devRuntimeEvidenceDigest(runtime),
  );

  const drifted = JSON.parse(
    await readFile(
      path.join(supplyDirectory, "provenance.intoto.json"),
      "utf8",
    ),
  );
  drifted.predicate.buildDefinition.externalParameters.tested_sha = "f".repeat(
    40,
  );
  await writeFile(
    path.join(supplyDirectory, "provenance.intoto.json"),
    `${JSON.stringify(drifted)}\n`,
  );
  await assert.rejects(
    collectDevSupplyEvidence({
      commitSha: COMMIT_SHA,
      migrationsDirectory,
      runtimeEvidenceFile: runtimeFile,
      supplyChainDirectory: supplyDirectory,
    }),
    /DEV_SUPPLY_BINDING_INVALID/u,
  );
});

test("T-E012-IMAGE-001 separates immutable image pull from the bounded runtime probe", () => {
  const image = `ghcr.io/weihan1996/dailyenergy-server@sha256:${"7".repeat(64)}`;
  const invocations = [];
  pullDevelopmentRuntimeImage(image, {
    runner: (executable, arguments_, options) => {
      invocations.push({ arguments_, executable, options });
      return { error: undefined, status: 0, stdout: "" };
    },
  });
  assert.equal(
    runDevelopmentRuntimeImage(
      image,
      ["--eval", "process.stdout.write('ok')"],
      { DAILYENERGY_ENVIRONMENT: "DEV" },
      {
        runner: (executable, arguments_, options) => {
          invocations.push({ arguments_, executable, options });
          return { error: undefined, status: 0, stdout: "ok\n" };
        },
      },
    ),
    "ok",
  );
  assert.deepEqual(invocations[0].arguments_, ["pull", image]);
  assert.equal(invocations[0].options.timeout, 180_000);
  assert.deepEqual(invocations[1].arguments_.slice(0, 6), [
    "run",
    "--rm",
    "--pull",
    "never",
    "--network",
    "none",
  ]);
  assert.equal(invocations[1].options.timeout, 30_000);
  assert.throws(
    () =>
      pullDevelopmentRuntimeImage("dailyenergy-server:latest", {
        runner: () => ({ error: undefined, status: 0, stdout: "" }),
      }),
    /DEV_RUNTIME_IMAGE_REFERENCE_INVALID:server/u,
  );
  assert.throws(
    () =>
      pullDevelopmentRuntimeImage(image, {
        runner: () => ({ error: undefined, status: 1, stdout: "" }),
      }),
    /DEV_RUNTIME_IMAGE_PULL_FAILED:server/u,
  );
});

test("T-E012-IMAGE-001 requires all release checks from one successful main CI run", () => {
  assert.deepEqual(
    validateReleaseCiEvidence(
      COMMIT_SHA,
      successfulChecks(),
      successfulWorkflowRun(),
    ),
    {
      checks: 11,
      releaseSha: COMMIT_SHA,
      runAttempt: 2,
      runId: "40000000001",
    },
  );
  const failed = successfulChecks();
  failed[0].conclusion = "failure";
  assert.throws(
    () =>
      validateReleaseCiEvidence(COMMIT_SHA, failed, successfulWorkflowRun()),
    /DEV_RELEASE_CI_GATE_INCOMPLETE/u,
  );
  const mixed = successfulChecks();
  mixed[0].details_url =
    "https://github.com/WeiHan1996/DailyEnergy/actions/runs/40000000002/job/1";
  assert.throws(
    () => validateReleaseCiEvidence(COMMIT_SHA, mixed, successfulWorkflowRun()),
    /DEV_RELEASE_CI_GATE_INCOMPLETE/u,
  );
  const wrongBranch = successfulWorkflowRun();
  wrongBranch.head_branch = "agent/untrusted";
  assert.throws(
    () =>
      validateReleaseCiEvidence(COMMIT_SHA, successfulChecks(), wrongBranch),
    /DEV_RELEASE_CI_RUN_INVALID/u,
  );
});

test("T-E012-IMAGE-001 keeps image publication manual, main-bound and non-deploying", async () => {
  const source = await readFile(
    path.join(repositoryRoot, ".github/workflows/publish-dev-images.yml"),
    "utf8",
  );
  const workflow = parse(source);
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.equal(workflow.on.workflow_dispatch.inputs.release_sha.required, true);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const job = workflow.jobs.publish;
  assert.equal(job.environment, "development");
  assert.deepEqual(job.permissions, {
    actions: "read",
    checks: "read",
    contents: "read",
    packages: "write",
  });
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert.equal(job["timeout-minutes"], 45);

  const actions = job.steps.filter((step) => step.uses);
  assert.deepEqual(
    actions.map((step) => step.uses),
    [
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c",
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    ],
  );
  assert.equal(actions[0].with.ref, "${{ inputs.release_sha }}");
  assert.equal(actions[0].with["fetch-depth"], 0);
  assert.equal(actions[0].with["persist-credentials"], false);
  assert.equal(actions[2].with.driver, "docker-container");

  const commands = job.steps
    .map((step) => step.run)
    .filter(Boolean)
    .join("\n");
  for (const required of [
    "git merge-base --is-ancestor",
    "verify-ci-release.mjs",
    "--github-output",
    "gh run download",
    "docker login ghcr.io",
    "--platform linux/amd64",
    "--provenance=mode=max",
    "--push",
    "--sbom=true",
    "e009-admin",
    "e009-migration",
    "e012-proxy",
    "e009-server",
    "e009-stub",
    "image-set.mjs --generate",
    "image-set.mjs --validate",
    "runtime-evidence.mjs --collect",
    "getcap",
    "/usr/bin/caddy",
    "--cap-drop ALL",
    "no-new-privileges=true",
    "--entrypoint caddy",
    "supply-evidence.mjs --collect",
    "deployment-bundle.mjs --build",
    "deployment-bundle.mjs --verify",
  ]) {
    assert.ok(commands.includes(required), required);
  }
  assert.equal(/\blatest\b/u.test(commands), false);
  assert.equal(/\b(?:ssh|scp|rsync)\b/u.test(commands), false);
  const upload = actions.at(-1);
  assert.equal(
    upload.if,
    "always() && steps.image_set_scan.outcome == 'success'",
  );
  assert.equal(upload.with["retention-days"], 90);
  assert.equal(upload.with["if-no-files-found"], "error");
});
