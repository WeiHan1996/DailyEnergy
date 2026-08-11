import assert from "node:assert/strict";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath as resolveRealpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertSecretVersionsActive,
  deploymentPhases,
  reconciliationPhases,
  releaseManifestDigest,
  validateDeploymentReceipts,
  validateReconciliationReceipts,
  validateReleaseManifest,
  validateReleaseTransition,
  validateRollbackTransition,
} from "../../tooling/deployment/release-contract.mjs";
import {
  beginReconciliationOperation,
  beginReleaseOperation,
  commitRecoveredCurrent,
  commitSuccessfulDeployment,
  commitSuccessfulRollback,
  markReleaseOperationRecovering,
  readReleaseOperation,
  readReleaseState,
  updateReleaseOperationPhase,
  withReleaseLock,
} from "../../tooling/deployment/release-state.mjs";
import {
  developmentDeploymentCommands,
  executeDevelopmentDeployment as executeWithReleaseLock,
  materializeDevelopmentComposeSecrets,
  renderComposeEnvironment,
} from "../../tooling/deployment/deploy-dev.mjs";
import { releaseManifestFixture as manifest } from "./release-fixture.mjs";

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "dailyenergy-e012-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  return root;
}

const noSecretMaterializer = async () => "/synthetic/runtime-secrets";
const inProcessReleaseLock = async (_root, _owner, operation) => operation();

function executeDevelopmentDeployment(options) {
  return executeWithReleaseLock({
    ...options,
    releaseLock: inProcessReleaseLock,
  });
}

test("T-E012-MANIFEST-001 accepts strict DEV ReleaseManifestV1", () => {
  const value = manifest("e012-release-a");
  assert.equal(validateReleaseManifest(value), value);
  assert.match(releaseManifestDigest(value), /^[a-f0-9]{64}$/u);
});

test("T-E012-MANIFEST-001 rejects mutable images and production topology", () => {
  assert.throws(
    () =>
      validateReleaseManifest(
        manifest("e012-mutable", {
          mutate: (value) => {
            value.images.server =
              "ghcr.io/weihan1996/dailyenergy-server:latest";
          },
        }),
      ),
    /RELEASE_MANIFEST_IMAGE_NOT_IMMUTABLE/u,
  );
  assert.throws(
    () =>
      validateReleaseManifest(
        manifest("e012-production", {
          mutate: (value) => {
            value.config.environment = "PRODUCTION";
            value.topology.production_enabled = true;
          },
        }),
      ),
    /RELEASE_MANIFEST_DEV_CONFIG_INVALID/u,
  );
  for (const [field, invalid] of [
    ["object_endpoint", "SYNTHETIC_NON_PERSISTENT"],
    ["object_region", "ap-guangzhou"],
    ["object_prefix", "dev/"],
  ]) {
    assert.throws(
      () =>
        validateReleaseManifest(
          manifest(`e012-invalid-${field.replaceAll("_", "-")}`, {
            mutate: (value) => {
              value.topology[field] = invalid;
            },
          }),
        ),
      /RELEASE_MANIFEST_PRODUCTION_GATE/u,
    );
  }
});

test("T-E012-MANIFEST-001 rejects unknown config and revoked secret versions", () => {
  assert.throws(
    () =>
      validateReleaseManifest(
        manifest("e012-unknown-config", {
          mutate: (value) => {
            value.config.DEBUG_BODY_LOG = "true";
          },
        }),
      ),
    /RELEASE_MANIFEST_CONFIG_KEYS/u,
  );
  assert.throws(
    () =>
      assertSecretVersionsActive(manifest("e012-revoked"), ["dev-secret-v1"]),
    /RELEASE_SECRET_VERSION_REVOKED/u,
  );
  assert.throws(
    () =>
      validateReleaseManifest(
        manifest("e012-missing-safety", {
          mutate: (value) => {
            value.evidence.required_gates = [
              "ci-full",
              "deletion",
              "migration",
              "owner",
              "synthetic-smoke",
            ];
          },
        }),
      ),
    /RELEASE_MANIFEST_REQUIRED_GATES/u,
  );
});

test("T-E012-COMPAT-001 enforces mutual N/N-1 and explicit rollback compatibility", () => {
  const previous = manifest("e012-release-n1", {
    acceptedGenerations: [1, 2],
  });
  const current = manifest("e012-release-n", {
    acceptedGenerations: [1, 2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [previous.release_id],
  });
  assert.deepEqual(validateReleaseTransition(previous, current), {
    idempotent: false,
  });
  assert.deepEqual(validateRollbackTransition(current, previous), {
    compatible: true,
  });

  const incompatible = manifest("e012-release-bad", {
    acceptedGenerations: [2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [previous.release_id],
  });
  assert.throws(
    () => validateReleaseTransition(previous, incompatible),
    /RELEASE_N_MINUS_ONE_INCOMPATIBLE/u,
  );

  const drift = manifest("e012-release-drift", {
    acceptedGenerations: [1, 2],
    rollbackCompatibleReleaseIds: [previous.release_id],
    mutate: (value) => {
      value.migrations.catalog_fingerprint = "f".repeat(64);
    },
  });
  assert.throws(
    () => validateReleaseTransition(previous, drift),
    /RELEASE_CATALOG_FINGERPRINT_DRIFT/u,
  );
});

test("T-E012-LOCK-001 rejects concurrency and releases ownership with the process", async (t) => {
  const root = await temporaryRoot(t);
  let releaseFirst;
  const held = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let acquired;
  const entered = new Promise((resolve) => {
    acquired = resolve;
  });
  const first = withReleaseLock(root, "deploy:first", async () => {
    acquired();
    await held;
  });
  await entered;
  await assert.rejects(
    withReleaseLock(root, "deploy:second", async () => undefined),
    /RELEASE_LOCK_HELD/u,
  );
  releaseFirst();
  await first;
  await withReleaseLock(root, "deploy:after-owner-exit", async () => undefined);
});

test("T-E012-STATE-001 records one rollback target and makes replay idempotent", async (t) => {
  const root = await temporaryRoot(t);
  const previous = manifest("e012-state-n1", {
    acceptedGenerations: [1, 2],
  });
  const current = manifest("e012-state-n", {
    acceptedGenerations: [1, 2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [previous.release_id],
  });
  const first = await commitSuccessfulDeployment(root, previous, {
    acceptedAtUtc: "2026-08-05T01:00:00.000Z",
  });
  assert.equal(first.state.rollback_target, null);
  assert.equal(first.state.catalog.release_id, previous.release_id);
  const second = await commitSuccessfulDeployment(root, current, {
    acceptedAtUtc: "2026-08-05T01:01:00.000Z",
  });
  assert.equal(second.state.rollback_target.release_id, previous.release_id);
  assert.equal(second.state.catalog.release_id, current.release_id);
  const replay = await commitSuccessfulDeployment(root, current, {
    acceptedAtUtc: "2026-08-05T01:02:00.000Z",
  });
  assert.equal(replay.idempotent, true);
  assert.equal(replay.state.rollback_target.release_id, previous.release_id);

  const rolledBack = await commitSuccessfulRollback(root, {
    acceptedAtUtc: "2026-08-05T01:03:00.000Z",
  });
  assert.equal(rolledBack.state.current.release_id, previous.release_id);
  assert.equal(rolledBack.state.rollback_target, null);
  await assert.rejects(
    commitSuccessfulRollback(root),
    /ROLLBACK_TARGET_MISSING/u,
  );
  assert.deepEqual(await readReleaseState(root), rolledBack.state);
});

test("T-E012-ORDER-001 requires consumer-before-producer and complete smoke receipts", () => {
  const receipts = deploymentPhases.map((phase) => ({
    phase,
    result: "PASS",
  }));
  assert.deepEqual(validateDeploymentReceipts(receipts), {
    phases: deploymentPhases.length,
  });
  const api = deploymentPhases.indexOf("api");
  assert.ok(deploymentPhases.indexOf("worker-interactive") < api);
  assert.ok(deploymentPhases.indexOf("worker-background") < api);
  assert.ok(deploymentPhases.indexOf("migration") < api);
  assert.ok(deploymentPhases.indexOf("smoke-safety") > api);
  assert.ok(deploymentPhases.indexOf("smoke-object") > api);
  assert.ok(deploymentPhases.indexOf("smoke-owner") > api);
  assert.ok(deploymentPhases.indexOf("smoke-delete") > api);
  const failed = structuredClone(receipts);
  failed[failed.length - 2].result = "FAIL";
  assert.throws(
    () => validateDeploymentReceipts(failed),
    /RELEASE_PHASE_ORDER_OR_RESULT/u,
  );

  const reconciliationReceipts = reconciliationPhases.map((phase) => ({
    phase,
    result: "PASS",
  }));
  assert.deepEqual(validateReconciliationReceipts(reconciliationReceipts), {
    phases: reconciliationPhases.length,
  });
  assert.equal(reconciliationPhases.includes("pull"), false);
  assert.equal(reconciliationPhases.includes("migration"), false);
  assert.ok(
    reconciliationPhases.indexOf("drift") <
      reconciliationPhases.indexOf("worker-interactive"),
  );
  const outOfOrder = structuredClone(reconciliationReceipts);
  [outOfOrder[4], outOfOrder[5]] = [outOfOrder[5], outOfOrder[4]];
  assert.throws(
    () => validateReconciliationReceipts(outOfOrder),
    /RELEASE_PHASE_ORDER_OR_RESULT/u,
  );
});

test("T-E012-DEPLOY-001 materializes root-only values as release-scoped file secrets", async (t) => {
  const root = await temporaryRoot(t);
  const value = manifest("e012-compose-secrets");
  const configDirectory = path.join(root, "config");
  const databaseDirectory = path.join(root, "secrets", "dev-secret-v1");
  const cosDirectory = path.join(root, "secrets", "dev-cos-credential-v1");
  await Promise.all(
    [configDirectory, databaseDirectory, cosDirectory].map((directory) =>
      mkdir(directory, { mode: 0o700, recursive: true }),
    ),
  );
  const configFile = path.join(configDirectory, "dev-cos-config-v1.env");
  await writeFile(
    configFile,
    [
      "COS_BUCKET=dailyenergy-dev-1250000000",
      "COS_ENDPOINT=dailyenergy-dev-1250000000.cos-internal.ap-shanghai.tencentcos.cn",
      "COS_PREFIX=dev/objects/",
      "COS_REGION=ap-shanghai",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  for (const [directory, files] of [
    [
      databaseDirectory,
      [
        "database-admin-url",
        "database-api-url",
        "database-background-url",
        "database-interactive-url",
        "database-migration-url",
        "database-restricted-url",
        "fault-control-token",
        "postgres-password",
      ],
    ],
    [cosDirectory, ["cos-secret-id", "cos-secret-key"]],
  ]) {
    await Promise.all(
      files.map((file) =>
        writeFile(path.join(directory, file), `synthetic-${file}\n`, {
          mode: 0o600,
        }),
      ),
    );
  }
  const options = {
    expectedSourceGid: process.getgid(),
    expectedSourceUid: process.getuid(),
    postgresGid: process.getgid(),
    postgresUid: process.getuid(),
    root: await resolveRealpath(root),
    serviceGid: process.getgid(),
    serviceUid: process.getuid(),
  };
  const directory = await materializeDevelopmentComposeSecrets(value, options);
  assert.equal(
    directory,
    path.join(options.root, "runtime-secrets", value.release_id),
  );
  assert.deepEqual((await readdir(directory)).sort(), [
    "cos-config.env",
    "cos-secret-id",
    "cos-secret-key",
    "database-admin-url",
    "database-api-url",
    "database-background-url",
    "database-interactive-url",
    "database-migration-url",
    "database-restricted-url",
    "fault-control-token",
    "postgres-password",
  ]);
  const directoryMetadata = await lstat(directory);
  assert.equal(directoryMetadata.mode & 0o777, 0o700);
  for (const fileName of await readdir(directory)) {
    const metadata = await lstat(path.join(directory, fileName));
    assert.equal(metadata.mode & 0o777, 0o400);
    assert.equal(metadata.uid, process.getuid());
    assert.equal(metadata.gid, process.getgid());
  }
  const persistedEnvironment = renderComposeEnvironment(value, {
    composeSecretDirectory: directory,
  });
  assert.ok(persistedEnvironment.includes(directory));
  assert.equal(persistedEnvironment.includes("synthetic-"), false);
  assert.equal(
    persistedEnvironment.includes("DAILYENERGY_DEV_DATABASE_"),
    false,
  );
  assert.equal(
    await materializeDevelopmentComposeSecrets(value, options),
    directory,
  );

  const materializedConfig = path.join(directory, "cos-config.env");
  await chmod(materializedConfig, 0o600);
  await assert.rejects(
    materializeDevelopmentComposeSecrets(value, options),
    /E012_DEPLOY_MATERIALIZED_SECRET_DRIFT:cos_config/u,
  );
  await chmod(materializedConfig, 0o400);

  await chmod(configFile, 0o640);
  await assert.rejects(
    materializeDevelopmentComposeSecrets(value, options),
    /E012_DEPLOY_SECRET_FILE_PROTECTION:dev-cos-config-v1.env/u,
  );
});

test("T-E012-DEPLOY-001 executes the closed phase plan and makes exact replay idempotent", async (t) => {
  const root = await temporaryRoot(t);
  const bundleRoot = path.join(root, "bundle");
  const stateRoot = path.join(root, "state");
  await mkdir(bundleRoot);
  const value = manifest("e012-deploy-first");
  const seen = [];
  const seenEnvironments = [];
  let preflights = 0;
  const first = await executeDevelopmentDeployment({
    bundleRoot,
    imageSet: {},
    manifest: value,
    preflight: async () => {
      preflights += 1;
    },
    runner: async (command, context) => {
      seen.push([command.executable, ...command.arguments]);
      seenEnvironments.push([command.executable, context.environment]);
      return { code: 0 };
    },
    runtimeEvidence: {},
    secretMaterializer: async () => "/synthetic/runtime-secrets",
    stateRoot,
  });
  assert.equal(first.idempotent, false);
  assert.equal(first.receipts.length, deploymentPhases.length);
  assert.equal(preflights, 1);
  assert.equal(
    seen.some((command) => command.includes("build")),
    false,
  );
  assert.equal(
    seen.some((command) => command.includes("object-smoke")),
    true,
  );
  assert.equal(
    seen.some(
      (command) =>
        command.includes("database-smoke") && command.includes("deletion"),
    ),
    true,
  );
  const environment = await readFile(
    path.join(bundleRoot, "release.env"),
    "utf8",
  );
  assert.equal(
    environment,
    renderComposeEnvironment(value, {
      composeSecretDirectory: "/synthetic/runtime-secrets",
    }),
  );
  assert.equal(environment.includes("postgresql://"), false);
  assert.equal(environment.includes("COS_BUCKET"), false);
  assert.equal(
    seenEnvironments.every(([, values]) => Object.keys(values).length === 0),
    true,
  );

  const replay = await executeDevelopmentDeployment({
    bundleRoot,
    imageSet: {},
    manifest: value,
    preflight: async () => {
      preflights += 1;
    },
    runner: async () => {
      throw new Error("idempotent replay must not execute Docker commands");
    },
    runtimeEvidence: {},
    secretMaterializer: async () => "/synthetic/runtime-secrets",
    stateRoot,
  });
  assert.deepEqual(replay, { idempotent: true, receipts: [] });
  assert.equal(preflights, 2);
});

test("T-E012-DEPLOY-001 does not accept release state when any ordered phase fails", async (t) => {
  const root = await temporaryRoot(t);
  const bundleRoot = path.join(root, "bundle");
  const stateRoot = path.join(root, "state");
  await mkdir(bundleRoot);
  await assert.rejects(
    executeDevelopmentDeployment({
      bundleRoot,
      imageSet: {},
      manifest: manifest("e012-deploy-fail"),
      preflight: async () => undefined,
      runner: async (command) => ({
        code: command.arguments.includes("object-smoke") ? 1 : 0,
      }),
      runtimeEvidence: {},
      secretMaterializer: noSecretMaterializer,
      stateRoot,
    }),
    /E012_DEPLOY_PHASE_FAILED:smoke-object/u,
  );
  assert.equal(await readReleaseState(stateRoot), null);
  const pending = await readReleaseOperation(stateRoot);
  assert.equal(pending.status, "FAILED");
  assert.equal(pending.target.release_id, "e012-deploy-fail");
  const retried = await executeDevelopmentDeployment({
    bundleRoot,
    imageSet: {},
    manifest: manifest("e012-deploy-fail"),
    preflight: async () => undefined,
    runner: async () => ({ code: 0 }),
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  });
  assert.equal(retried.receipts.length, deploymentPhases.length);
  assert.equal(
    (await readReleaseState(stateRoot)).current.release_id,
    "e012-deploy-fail",
  );
  assert.equal(await readReleaseOperation(stateRoot), null);
});

test("T-E012-DEPLOY-001 replaces only a failed pre-migration initial candidate", async (t) => {
  const root = await temporaryRoot(t);
  const firstBundle = path.join(root, "first");
  const replacementBundle = path.join(root, "replacement");
  const stateRoot = path.join(root, "state");
  await Promise.all([mkdir(firstBundle), mkdir(replacementBundle)]);
  const first = manifest("e012-initial-runtime-broken");
  const replacement = manifest("e012-initial-runtime-fixed");
  const common = {
    imageSet: {},
    preflight: async () => undefined,
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: firstBundle,
      manifest: first,
      runner: async (command) => ({
        code: command.arguments.includes("postgres") ? 1 : 0,
      }),
    }),
    /E012_DEPLOY_PHASE_FAILED:stateful-ready/u,
  );
  const failed = await readReleaseOperation(stateRoot);
  assert.equal(failed.active_phase, "stateful-ready");
  assert.equal(failed.migration_applied, false);

  const deployed = await executeDevelopmentDeployment({
    ...common,
    bundleRoot: replacementBundle,
    manifest: replacement,
    runner: async () => ({ code: 0 }),
  });
  assert.equal(deployed.receipts.length, deploymentPhases.length);
  assert.equal(
    (await readReleaseState(stateRoot)).current.release_id,
    replacement.release_id,
  );
  assert.equal(await readReleaseOperation(stateRoot), null);
  const receiptFiles = await readdir(path.join(stateRoot, "receipts"));
  const supersededFile = receiptFiles.find((file) =>
    file.startsWith(`superseded-initial-deploy-${first.release_id}-`),
  );
  assert.ok(supersededFile);
  const superseded = JSON.parse(
    await readFile(path.join(stateRoot, "receipts", supersededFile), "utf8"),
  );
  assert.equal(superseded.operation_id, failed.operation_id);
  assert.equal(superseded.status, "SUPERSEDED_BEFORE_MIGRATION");
  assert.equal(superseded.replacement.release_id, replacement.release_id);
  assert.deepEqual(superseded.receipts.at(-1), {
    phase: "stateful-ready",
    result: "FAIL",
  });
});

test("T-E012-DEPLOY-001 refuses to replace an initial candidate that reached migration", async (t) => {
  const root = await temporaryRoot(t);
  const firstBundle = path.join(root, "first");
  const replacementBundle = path.join(root, "replacement");
  const stateRoot = path.join(root, "state");
  await Promise.all([mkdir(firstBundle), mkdir(replacementBundle)]);
  const first = manifest("e012-initial-migration-uncertain");
  const replacement = manifest("e012-initial-migration-replacement");
  const common = {
    imageSet: {},
    preflight: async () => undefined,
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: firstBundle,
      manifest: first,
      runner: async (command) => ({
        code: command.arguments.at(-1) === "prepare" ? 1 : 0,
      }),
    }),
    /E012_DEPLOY_PHASE_FAILED:migration/u,
  );
  const failed = await readReleaseOperation(stateRoot);
  assert.equal(failed.active_phase, "migration");
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: replacementBundle,
      manifest: replacement,
      runner: async () => ({ code: 0 }),
    }),
    new RegExp(`RELEASE_RECOVERY_REQUIRED:${first.release_id}`, "u"),
  );
  assert.equal(
    (await readReleaseOperation(stateRoot)).operation_id,
    failed.operation_id,
  );
  assert.equal(await readReleaseState(stateRoot), null);
});

test("T-E012-DEPLOY-001 converges Accepted N after N+1 fails after migration", async (t) => {
  const root = await temporaryRoot(t);
  const firstBundle = path.join(root, "first");
  const secondBundle = path.join(root, "second");
  const stateRoot = path.join(root, "state");
  await Promise.all([mkdir(firstBundle), mkdir(secondBundle)]);
  const current = manifest("e012-recover-n", {
    acceptedGenerations: [1, 2],
  });
  const candidate = manifest("e012-recover-n-plus-one", {
    acceptedGenerations: [1, 2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [current.release_id],
    mutate: (value) => {
      value.images.migration = `ghcr.io/weihan1996/dailyenergy-migration@sha256:${"9".repeat(64)}`;
      value.migrations.catalog_fingerprint = "f".repeat(64);
    },
  });
  const common = {
    imageSet: {},
    preflight: async () => undefined,
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    runner: async () => ({ code: 0 }),
  });
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: secondBundle,
      manifest: candidate,
      runner: async (command) => ({
        code: command.arguments.includes("object-smoke") ? 1 : 0,
      }),
    }),
    /E012_DEPLOY_PHASE_FAILED:smoke-object/u,
  );
  const dirty = await readReleaseOperation(stateRoot);
  assert.equal(dirty.status, "FAILED");
  assert.equal(dirty.migration_applied, true);
  assert.equal(dirty.migration_verified, true);
  assert.equal(dirty.target.release_id, candidate.release_id);
  assert.equal(
    (await readReleaseState(stateRoot)).current.release_id,
    current.release_id,
  );

  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: firstBundle,
      manifest: current,
      runner: async () => ({ code: 0 }),
    }),
    /RELEASE_RECOVERY_REQUIRED:e012-recover-n-plus-one/u,
  );
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: firstBundle,
      manifest: current,
      operation: "rollback",
      runner: async () => ({ code: 0 }),
    }),
    /RELEASE_RECOVERY_REQUIRED:e012-recover-n-plus-one/u,
  );

  const recovered = await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    operation: "recover-current",
    runner: async () => ({ code: 0 }),
  });
  assert.equal(recovered.receipts.length, deploymentPhases.length);
  const recoveredState = await readReleaseState(stateRoot);
  assert.equal(recoveredState.current.release_id, current.release_id);
  assert.equal(recoveredState.catalog.release_id, candidate.release_id);
  assert.equal(recoveredState.catalog.catalog_generation, 2);
  assert.equal(await readReleaseOperation(stateRoot), null);
  const recoveryEnvironment = await readFile(
    path.join(
      stateRoot,
      `recover-${current.release_id}-${candidate.release_id}.env`,
    ),
    "utf8",
  );
  assert.ok(recoveryEnvironment.includes(current.images.server));
  assert.ok(recoveryEnvironment.includes(candidate.images.migration));

  const replay = await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    runner: async () => {
      throw new Error("recovered Accepted replay must be idempotent");
    },
  });
  assert.deepEqual(replay, { idempotent: true, receipts: [] });
});

test("T-E012-DEPLOY-001 keeps the effective catalog when candidate migration does not apply", async (t) => {
  const root = await temporaryRoot(t);
  const firstBundle = path.join(root, "first");
  const secondBundle = path.join(root, "second");
  const stateRoot = path.join(root, "state");
  await Promise.all([mkdir(firstBundle), mkdir(secondBundle)]);
  const current = manifest("e012-migration-failure-n", {
    acceptedGenerations: [1, 2],
  });
  const candidate = manifest("e012-migration-failure-n-plus-one", {
    acceptedGenerations: [1, 2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [current.release_id],
    mutate: (value) => {
      value.images.migration = `ghcr.io/weihan1996/dailyenergy-migration@sha256:${"9".repeat(64)}`;
      value.migrations.catalog_fingerprint = "f".repeat(64);
    },
  });
  const common = {
    imageSet: {},
    preflight: async () => undefined,
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    runner: async () => ({ code: 0 }),
  });
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: secondBundle,
      manifest: candidate,
      runner: async (command) => ({
        code: command.arguments.at(-1) === "prepare" ? 1 : 0,
      }),
    }),
    /E012_DEPLOY_PHASE_FAILED:migration/u,
  );
  assert.equal(
    (await readReleaseOperation(stateRoot)).migration_applied,
    false,
  );
  assert.equal(
    (await readReleaseOperation(stateRoot)).migration_verified,
    false,
  );

  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    operation: "recover-current",
    runner: async () => ({ code: 0 }),
  });
  const recoveredState = await readReleaseState(stateRoot);
  assert.equal(recoveredState.catalog.release_id, current.release_id);
  const recoveryEnvironment = await readFile(
    path.join(
      stateRoot,
      `recover-${current.release_id}-${current.release_id}.env`,
    ),
    "utf8",
  );
  assert.ok(recoveryEnvironment.includes(current.images.migration));
  assert.equal(recoveryEnvironment.includes(candidate.images.migration), false);
});

test("T-E012-DEPLOY-001 recovers candidate catalog after migration applies and seed fails", async (t) => {
  const root = await temporaryRoot(t);
  const firstBundle = path.join(root, "first");
  const secondBundle = path.join(root, "second");
  const stateRoot = path.join(root, "state");
  await Promise.all([mkdir(firstBundle), mkdir(secondBundle)]);
  const current = manifest("e012-seed-failure-n", {
    acceptedGenerations: [1, 2],
  });
  const candidate = manifest("e012-seed-failure-n-plus-one", {
    acceptedGenerations: [1, 2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [current.release_id],
    mutate: (value) => {
      value.images.migration = `ghcr.io/weihan1996/dailyenergy-migration@sha256:${"9".repeat(64)}`;
      value.migrations.catalog_fingerprint = "f".repeat(64);
    },
  });
  const common = {
    imageSet: {},
    preflight: async () => undefined,
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    runner: async () => ({ code: 0 }),
  });
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: secondBundle,
      manifest: candidate,
      runner: async (command) => ({
        code: command.arguments.at(-1) === "seed" ? 1 : 0,
      }),
    }),
    /E012_DEPLOY_PHASE_FAILED:migration/u,
  );
  const pending = await readReleaseOperation(stateRoot);
  assert.equal(pending.migration_applied, true);
  assert.equal(pending.migration_verified, false);

  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    operation: "recover-current",
    runner: async () => ({ code: 0 }),
  });
  const recoveredState = await readReleaseState(stateRoot);
  assert.equal(recoveredState.catalog.release_id, candidate.release_id);
  const recoveryEnvironment = await readFile(
    path.join(
      stateRoot,
      `recover-${current.release_id}-${candidate.release_id}.env`,
    ),
    "utf8",
  );
  assert.ok(recoveryEnvironment.includes(current.images.server));
  assert.ok(recoveryEnvironment.includes(candidate.images.migration));
});

test("T-E012-DEPLOY-001 probes candidate catalog when the host checkpoint is lost", async (t) => {
  const root = await temporaryRoot(t);
  const firstBundle = path.join(root, "first");
  const secondBundle = path.join(root, "second");
  const stateRoot = path.join(root, "state");
  await Promise.all([mkdir(firstBundle), mkdir(secondBundle)]);
  const current = manifest("e012-checkpoint-loss-n", {
    acceptedGenerations: [1, 2],
  });
  const candidate = manifest("e012-checkpoint-loss-n-plus-one", {
    acceptedGenerations: [1, 2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [current.release_id],
    mutate: (value) => {
      value.images.migration = `ghcr.io/weihan1996/dailyenergy-migration@sha256:${"9".repeat(64)}`;
      value.migrations.catalog_fingerprint = "f".repeat(64);
    },
  });
  const common = {
    imageSet: {},
    preflight: async () => undefined,
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    runner: async () => ({ code: 0 }),
  });
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: secondBundle,
      manifest: candidate,
      runner: async (command) => ({
        code: command.arguments.at(-1) === "prepare" ? 1 : 0,
      }),
    }),
    /E012_DEPLOY_PHASE_FAILED:migration/u,
  );
  const pending = await readReleaseOperation(stateRoot);
  assert.equal(pending.migration_applied, false);
  const currentProbe = `catalog-probe-${current.release_id}-${releaseManifestDigest(current).slice(0, 12)}.env`;

  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: firstBundle,
      manifest: current,
      operation: "recover-current",
      runner: async () => ({ code: 1 }),
    }),
    /RECOVER_CURRENT_CATALOG_UNRESOLVED:e012-checkpoint-loss-n-plus-one/u,
  );
  const unresolved = await readReleaseOperation(stateRoot);
  assert.equal(unresolved.status, "FAILED");
  assert.equal(unresolved.recovery_catalog, null);

  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: current,
    operation: "recover-current",
    runner: async (command) => ({
      code: command.arguments.some(
        (argument) => path.basename(argument) === currentProbe,
      )
        ? 1
        : 0,
    }),
  });
  const recoveredState = await readReleaseState(stateRoot);
  assert.equal(recoveredState.catalog.release_id, candidate.release_id);
});

test("T-E012-DEPLOY-001 rebuilds a PASS receipt after state commit", async (t) => {
  const root = await temporaryRoot(t);
  const bundleRoot = path.join(root, "bundle");
  const stateRoot = path.join(root, "state");
  const value = manifest("e012-receipt-recovery");
  const operationId = "00000000-0000-4000-8000-000000000001";
  await mkdir(bundleRoot);
  await beginReleaseOperation(stateRoot, "DEPLOY", value, null, {
    operationId,
  });
  for (const phase of deploymentPhases) {
    await updateReleaseOperationPhase(stateRoot, phase, false);
    await updateReleaseOperationPhase(stateRoot, phase, true);
  }
  await commitSuccessfulDeployment(stateRoot, value);

  const replay = await executeDevelopmentDeployment({
    bundleRoot,
    imageSet: {},
    manifest: value,
    preflight: async () => undefined,
    runner: async () => {
      throw new Error("receipt recovery must not rerun deployment phases");
    },
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  });
  assert.deepEqual(replay, { idempotent: true, receipts: [] });
  assert.equal(await readReleaseOperation(stateRoot), null);
  const receipt = JSON.parse(
    await readFile(
      path.join(
        stateRoot,
        "receipts",
        `deploy-${value.release_id}-${operationId}.json`,
      ),
      "utf8",
    ),
  );
  assert.equal(receipt.operation_id, operationId);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.receipts.length, deploymentPhases.length);
});

test("T-E012-DEPLOY-001 rolls back only to the recorded compatible manifest and consumes the target", async (t) => {
  const root = await temporaryRoot(t);
  const firstBundle = path.join(root, "first");
  const secondBundle = path.join(root, "second");
  const stateRoot = path.join(root, "state");
  await Promise.all([mkdir(firstBundle), mkdir(secondBundle)]);
  const previous = manifest("e012-rollback-n1", {
    acceptedGenerations: [1, 2],
  });
  const current = manifest("e012-rollback-n", {
    acceptedGenerations: [1, 2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [previous.release_id],
  });
  const common = {
    imageSet: {},
    preflight: async () => undefined,
    runner: async () => ({ code: 0 }),
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: previous,
  });
  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: secondBundle,
    manifest: current,
  });
  const rolledBack = await executeDevelopmentDeployment({
    ...common,
    bundleRoot: firstBundle,
    manifest: previous,
    operation: "rollback",
  });
  assert.equal(rolledBack.receipts.length, deploymentPhases.length);
  const state = await readReleaseState(stateRoot);
  assert.equal(state.current.release_id, previous.release_id);
  assert.equal(state.rollback_target, null);
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      bundleRoot: firstBundle,
      manifest: previous,
      operation: "rollback",
    }),
    /ROLLBACK_TARGET_MISSING/u,
  );

  await executeDevelopmentDeployment({
    ...common,
    bundleRoot: secondBundle,
    manifest: current,
  });
  const receiptFiles = await readdir(path.join(stateRoot, "receipts"));
  assert.equal(receiptFiles.length, 4);
  const operationIds = await Promise.all(
    receiptFiles.map(async (file) => {
      const receipt = JSON.parse(
        await readFile(path.join(stateRoot, "receipts", file), "utf8"),
      );
      return receipt.operation_id;
    }),
  );
  assert.equal(new Set(operationIds).size, operationIds.length);
});

test("T-E012-DEPLOY-001 reconciles Accepted current against its effective catalog without changing state", async (t) => {
  const root = await temporaryRoot(t);
  const bundleRoot = path.join(root, "bundle");
  const stateRoot = path.join(root, "state");
  await mkdir(bundleRoot);
  const current = manifest("e012-reconcile-current", {
    acceptedGenerations: [1, 2],
  });
  const catalog = manifest("e012-reconcile-catalog", {
    acceptedGenerations: [1, 2],
    catalogGeneration: 2,
    generation: 2,
    rollbackCompatibleReleaseIds: [current.release_id],
    mutate: (value) => {
      value.images.migration = `ghcr.io/weihan1996/dailyenergy-migration@sha256:${"9".repeat(64)}`;
      value.migrations.catalog_fingerprint = "f".repeat(64);
    },
  });
  await commitSuccessfulDeployment(stateRoot, current);
  await commitRecoveredCurrent(stateRoot, catalog);
  const stateFile = path.join(stateRoot, "release-state.json");
  const stateBefore = await readFile(stateFile, "utf8");
  const seen = [];
  const reconciled = await executeDevelopmentDeployment({
    bundleRoot,
    imageSet: {},
    manifest: current,
    operation: "reconcile-current",
    preflight: async () => undefined,
    runner: async (command) => {
      seen.push([command.executable, ...command.arguments]);
      return { code: 0 };
    },
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  });
  assert.equal(reconciled.idempotent, false);
  assert.equal(reconciled.receipts.length, reconciliationPhases.length);
  assert.equal(await readFile(stateFile, "utf8"), stateBefore);
  assert.equal(await readReleaseOperation(stateRoot), null);
  assert.equal(
    seen.some((command) => command.includes("pull")),
    false,
  );
  for (const forbidden of ["prepare", "migrate", "seed"]) {
    assert.equal(
      seen.some((command) => command.at(-1) === forbidden),
      false,
      forbidden,
    );
  }
  assert.equal(
    seen.filter((command) => command.includes("database-verify")).length,
    1,
  );
  const convergenceCommands = seen.filter((command) => command.includes("up"));
  assert.equal(convergenceCommands.length, 7);
  assert.equal(
    convergenceCommands.every((command) =>
      command.includes("--force-recreate"),
    ),
    true,
  );
  const environment = await readFile(
    path.join(
      stateRoot,
      `reconcile-${current.release_id}-${catalog.release_id}.env`,
    ),
    "utf8",
  );
  for (const image of [
    current.images.admin,
    current.images.proxy,
    current.images.server,
    current.images.stub,
    catalog.images.migration,
  ]) {
    assert.ok(environment.includes(image), image);
  }
  assert.equal(environment.includes(current.images.migration), false);

  const receiptFiles = await readdir(path.join(stateRoot, "receipts"));
  const reconciliationFile = receiptFiles.find((file) =>
    file.startsWith(`reconcile-current-${current.release_id}-`),
  );
  assert.ok(reconciliationFile);
  const receipt = JSON.parse(
    await readFile(
      path.join(stateRoot, "receipts", reconciliationFile),
      "utf8",
    ),
  );
  assert.equal(receipt.operation, "reconcile-current");
  assert.match(
    receipt.operation_id,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u,
  );
  assert.deepEqual(receipt.effective_catalog, {
    manifest_sha256: releaseManifestDigest(catalog),
    release_id: catalog.release_id,
  });
  const operationIds = await Promise.all(
    receiptFiles.map(
      async (file) =>
        JSON.parse(
          await readFile(path.join(stateRoot, "receipts", file), "utf8"),
        ).operation_id,
    ),
  );
  assert.equal(new Set(operationIds).size, operationIds.length);
});

test("T-E012-DEPLOY-001 retries only the same failed reconciliation operation", async (t) => {
  const root = await temporaryRoot(t);
  const bundleRoot = path.join(root, "bundle");
  const stateRoot = path.join(root, "state");
  await mkdir(bundleRoot);
  const current = manifest("e012-reconcile-retry");
  await commitSuccessfulDeployment(stateRoot, current);
  const stateFile = path.join(stateRoot, "release-state.json");
  const stateBefore = await readFile(stateFile, "utf8");
  const common = {
    bundleRoot,
    imageSet: {},
    manifest: current,
    operation: "reconcile-current",
    preflight: async () => undefined,
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      runner: async (command) => ({
        code:
          command.arguments.some((argument) =>
            argument.endsWith("database-smoke.mjs"),
          ) && command.arguments.at(-1) === "safety"
            ? 1
            : 0,
      }),
    }),
    /E012_DEPLOY_PHASE_FAILED:smoke-safety/u,
  );
  assert.equal(await readFile(stateFile, "utf8"), stateBefore);
  const failed = await readReleaseOperation(stateRoot);
  assert.equal(failed.kind, "RECONCILE_CURRENT");
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.active_phase, "smoke-safety");
  assert.equal(failed.migration_applied, false);
  assert.equal(failed.migration_verified, false);
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      operation: "recover-current",
      runner: async () => ({ code: 0 }),
    }),
    new RegExp(`RELEASE_RECOVERY_REQUIRED:${current.release_id}`, "u"),
  );
  assert.equal(
    (await readReleaseOperation(stateRoot)).operation_id,
    failed.operation_id,
  );

  const retried = await executeDevelopmentDeployment({
    ...common,
    runner: async () => ({ code: 0 }),
  });
  assert.equal(retried.receipts.length, reconciliationPhases.length);
  assert.equal(await readFile(stateFile, "utf8"), stateBefore);
  assert.equal(await readReleaseOperation(stateRoot), null);
  const receiptFile = (await readdir(path.join(stateRoot, "receipts"))).find(
    (file) => file.startsWith(`reconcile-current-${current.release_id}-`),
  );
  assert.ok(receiptFile);
  const receipt = JSON.parse(
    await readFile(path.join(stateRoot, "receipts", receiptFile), "utf8"),
  );
  assert.equal(receipt.operation_id, failed.operation_id);
});

test("T-E012-DEPLOY-001 rejects reconciliation without exact Accepted state", async (t) => {
  const root = await temporaryRoot(t);
  const bundleRoot = path.join(root, "bundle");
  const stateRoot = path.join(root, "state");
  await mkdir(bundleRoot);
  const current = manifest("e012-reconcile-required");
  const common = {
    bundleRoot,
    imageSet: {},
    operation: "reconcile-current",
    preflight: async () => undefined,
    runner: async () => ({ code: 0 }),
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  };
  await assert.rejects(
    executeDevelopmentDeployment({ ...common, manifest: current }),
    /RECONCILE_CURRENT_MISSING:release-state/u,
  );
  await commitSuccessfulDeployment(stateRoot, current);
  await assert.rejects(
    executeDevelopmentDeployment({
      ...common,
      manifest: manifest("e012-reconcile-not-current"),
    }),
    /RECONCILE_CURRENT_MANIFEST_MISMATCH:e012-reconcile-not-current/u,
  );
});

test("T-E012-DEPLOY-001 rejects unrelated dirty operations during reconciliation", async (t) => {
  for (const kind of ["DEPLOY", "RECOVER_CURRENT", "ROLLBACK"]) {
    await t.test(kind, async (t) => {
      const root = await temporaryRoot(t);
      const bundleRoot = path.join(root, "bundle");
      const stateRoot = path.join(root, "state");
      await mkdir(bundleRoot);
      const current = manifest(
        `e012-reconcile-dirty-${kind.toLowerCase().replaceAll("_", "-")}`,
      );
      const candidate = manifest(
        `e012-reconcile-pending-${kind.toLowerCase().replaceAll("_", "-")}`,
      );
      const accepted = await commitSuccessfulDeployment(stateRoot, current);
      await beginReleaseOperation(
        stateRoot,
        kind === "RECOVER_CURRENT" ? "DEPLOY" : kind,
        candidate,
        accepted.state.current,
      );
      if (kind === "RECOVER_CURRENT") {
        await markReleaseOperationRecovering(stateRoot, {
          manifest_sha256: releaseManifestDigest(candidate),
          release_id: candidate.release_id,
        });
      }
      await assert.rejects(
        executeDevelopmentDeployment({
          bundleRoot,
          imageSet: {},
          manifest: current,
          operation: "reconcile-current",
          preflight: async () => undefined,
          runner: async () => ({ code: 0 }),
          runtimeEvidence: {},
          secretMaterializer: noSecretMaterializer,
          stateRoot,
        }),
        new RegExp(`RELEASE_RECOVERY_REQUIRED:${candidate.release_id}`, "u"),
      );
    });
  }
});

test("T-E012-DEPLOY-001 repairs a completed reconciliation receipt without rerunning phases", async (t) => {
  const root = await temporaryRoot(t);
  const bundleRoot = path.join(root, "bundle");
  const stateRoot = path.join(root, "state");
  await mkdir(bundleRoot);
  const current = manifest("e012-reconcile-receipt-repair");
  const operationId = "00000000-0000-4000-8000-000000000012";
  const accepted = await commitSuccessfulDeployment(stateRoot, current);
  const stateFile = path.join(stateRoot, "release-state.json");
  const stateBefore = await readFile(stateFile, "utf8");
  await beginReconciliationOperation(
    stateRoot,
    current,
    accepted.state.current,
    accepted.state.catalog,
    { operationId },
  );
  for (const phase of reconciliationPhases) {
    await updateReleaseOperationPhase(stateRoot, phase, false);
    await updateReleaseOperationPhase(stateRoot, phase, true);
  }

  const repaired = await executeDevelopmentDeployment({
    bundleRoot,
    imageSet: {},
    manifest: current,
    operation: "reconcile-current",
    preflight: async () => undefined,
    runner: async () => {
      throw new Error("receipt repair must not rerun reconciliation phases");
    },
    runtimeEvidence: {},
    secretMaterializer: noSecretMaterializer,
    stateRoot,
  });
  assert.deepEqual(repaired, { idempotent: true, receipts: [] });
  assert.equal(await readFile(stateFile, "utf8"), stateBefore);
  assert.equal(await readReleaseOperation(stateRoot), null);
  const receipt = JSON.parse(
    await readFile(
      path.join(
        stateRoot,
        "receipts",
        `reconcile-current-${current.release_id}-${operationId}.json`,
      ),
      "utf8",
    ),
  );
  assert.equal(receipt.operation_id, operationId);
  assert.equal(receipt.receipts.length, reconciliationPhases.length);
});

test("T-E012-DEPLOY-001 keeps Docker builds, public bindings and raw secrets out of the deployment plan", () => {
  const value = manifest("e012-deploy-plan");
  const environment = renderComposeEnvironment(value);
  const commands = developmentDeploymentCommands(
    "/srv/dailyenergy/bundles/e012-deploy-plan",
    "/srv/dailyenergy/bundles/e012-deploy-plan/release.env",
  );
  const serialized = JSON.stringify(commands);
  assert.equal(serialized.includes(" build"), false);
  assert.equal(serialized.includes("docker.sock"), false);
  assert.equal(serialized.includes("0.0.0.0:443"), false);
  assert.deepEqual(
    commands.migration.slice(0, 3).map((command) => command.arguments.at(-1)),
    ["prepare", "migrate", "seed"],
  );
  assert.equal(commands.migration[1].operationCheckpoint, "MIGRATION_APPLIED");
  for (const command of [...commands.health, ...commands["maintenance-off"]]) {
    assert.ok(command.arguments.includes("--resolve"));
    assert.ok(
      command.arguments.some((argument) =>
        /^localhost:844[34]:127\.0\.0\.1$/u.test(argument),
      ),
    );
    assert.ok(
      command.arguments.some((argument) =>
        /^https:\/\/localhost:844[34]\//u.test(argument),
      ),
    );
    assert.equal(
      command.arguments.some((argument) =>
        /^https:\/\/127\.0\.0\.1:844[34]\//u.test(argument),
      ),
      false,
    );
  }
  for (const phase of [
    "worker-interactive",
    "worker-background",
    "api",
    "admin",
    "worker-restricted",
    "tls-ingress",
  ]) {
    assert.ok(commands[phase][0].arguments.includes("--no-deps"), phase);
  }
  assert.equal(environment.includes("database-admin-url"), false);
  assert.ok(
    environment.includes("DAILYENERGY_REDIS_KEY_PREFIX=dailyenergy-dev\n"),
  );
  assert.equal(
    environment.includes(
      `DAILYENERGY_REDIS_KEY_PREFIX=dailyenergy-dev-${value.release_id}`,
    ),
    false,
  );
  assert.ok(environment.includes("/srv/dailyenergy/secrets/dev-secret-v1"));
  assert.ok(
    environment.includes("/srv/dailyenergy/secrets/dev-cos-credential-v1"),
  );
});

test("T-E012-DEPLOY-001 force-recreates every service convergence phase", () => {
  const commands = developmentDeploymentCommands(
    "/srv/dailyenergy/bundles/e012-force-recreate",
    "/srv/dailyenergy/bundles/e012-force-recreate/release.env",
  );
  const composeUpCommands = Object.values(commands)
    .flat()
    .filter(
      (command) =>
        command.executable === "docker" && command.arguments.includes("up"),
    );
  assert.equal(composeUpCommands.length, 7);
  for (const command of composeUpCommands) {
    assert.ok(
      command.arguments.includes("--force-recreate"),
      `Compose up must replace stale release-scoped secret mounts: ${command.arguments.at(-1)}`,
    );
  }
});
