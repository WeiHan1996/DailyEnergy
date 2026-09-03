#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmod,
  chown,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createCosConfigEvidence,
  DEV_LITE_SECRET_FILE_NAMES,
  runDevelopmentPreflight,
  SECRET_FILE_NAMES,
} from "./preflight.mjs";
import {
  canonicalReleaseManifest,
  deploymentPhases,
  RELEASE_MANIFEST_VERSION_V2,
  reconciliationPhases,
  releaseManifestDigest,
  validateDeploymentReceipts,
  validateReconciliationReceipts,
  validateReleaseClassMatch,
  validateReleaseManifest,
  validateReleaseTransition,
  validateRollbackTransition,
} from "./release-contract.mjs";
import {
  beginReconciliationOperation,
  commitSuccessfulDeployment,
  commitSuccessfulRollback,
  beginReleaseOperation,
  clearReleaseOperation,
  commitRecoveredCurrent,
  loadCatalogManifest,
  loadOperationManifest,
  loadReleaseManifest,
  markReleaseOperationFailed,
  markReleaseOperationMigrationApplied,
  markReleaseOperationRecovering,
  readReleaseOperation,
  readReleaseState,
  restartInitialReleaseOperation,
  restartReconciliationOperation,
  updateReleaseOperationPhase,
  withReleaseLock,
} from "./release-state.mjs";

const DEVELOPMENT_ROOT = "/srv/dailyenergy";
const STATE_ROOT = `${DEVELOPMENT_ROOT}/deployment`;
const BUNDLE_ROOT = `${DEVELOPMENT_ROOT}/bundles`;
const COMPOSE_SECRET_FILE_NAMES = Object.freeze({
  cos_config: "cos-config.env",
  ...SECRET_FILE_NAMES,
});

function isDevelopmentLiteManifest(manifest) {
  return manifest.manifest_version === RELEASE_MANIFEST_VERSION_V2;
}

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

function databaseSecretVersion(manifest) {
  const names = [
    "database_admin_url",
    "database_api_url",
    "database_background_url",
    "database_interactive_url",
    "database_migration_url",
    "database_restricted_url",
    "fault_control_token",
    "postgres_password",
  ];
  const versions = new Set(
    names.map((name) => manifest.config.secret_ref_versions[name]),
  );
  if (versions.size !== 1) {
    fail("E012_DEPLOY_DATABASE_SECRET_VERSION_SPLIT", "manifest");
  }
  return [...versions][0];
}

async function readProtectedRuntimeFile(
  file,
  { expectedGid, expectedUid, kind },
) {
  let metadata;
  try {
    metadata = await lstat(file);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("E012_DEPLOY_SECRET_FILE_MISSING", path.basename(file));
    }
    throw error;
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1 ||
    metadata.uid !== expectedUid ||
    metadata.gid !== expectedGid ||
    (metadata.mode & 0o777) !== 0o600 ||
    metadata.size < 1 ||
    metadata.size > (kind === "config" ? 4096 : 8192) ||
    (await realpath(file)) !== file
  ) {
    fail("E012_DEPLOY_SECRET_FILE_PROTECTION", path.basename(file));
  }
  const source = await readFile(file, "utf8");
  if (kind === "config") {
    createCosConfigEvidence(source);
    return source;
  }
  const value = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (value.length < 1 || value.length > 4096 || /[\0\r\n]/u.test(value)) {
    fail("E012_DEPLOY_SECRET_FILE_CONTENT", path.basename(file));
  }
  return value;
}

async function validateProtectedDirectory(
  directory,
  { expectedGid, expectedUid, mode, ruleId },
) {
  let metadata;
  try {
    metadata = await lstat(directory);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(ruleId, "missing");
    }
    throw error;
  }
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== expectedUid ||
    metadata.gid !== expectedGid ||
    (metadata.mode & 0o777) !== mode ||
    (await realpath(directory)) !== directory
  ) {
    fail(ruleId, "protection");
  }
}

function composeSecretIdentity(
  role,
  { postgresGid, postgresUid, serviceGid, serviceUid },
) {
  return role === "postgres_password"
    ? { gid: postgresGid, uid: postgresUid }
    : { gid: serviceGid, uid: serviceUid };
}

async function readDevelopmentComposeSecretMaterials(
  manifest,
  {
    expectedSourceGid,
    expectedSourceUid,
    postgresGid,
    postgresUid,
    root,
    serviceGid,
    serviceUid,
  },
) {
  const developmentLite = isDevelopmentLiteManifest(manifest);
  const secretFileNames = developmentLite
    ? DEV_LITE_SECRET_FILE_NAMES
    : SECRET_FILE_NAMES;
  const entries = await Promise.all(
    Object.entries(secretFileNames).map(async ([role, sourceFileName]) => ({
      ...composeSecretIdentity(role, {
        postgresGid,
        postgresUid,
        serviceGid,
        serviceUid,
      }),
      contents: await readProtectedRuntimeFile(
        path.join(
          root,
          "secrets",
          manifest.config.secret_ref_versions[role],
          sourceFileName,
        ),
        {
          expectedGid: expectedSourceGid,
          expectedUid: expectedSourceUid,
          kind: "secret",
        },
      ),
      fileName: COMPOSE_SECRET_FILE_NAMES[role],
      role,
    })),
  );
  if (!developmentLite) {
    const configFile = path.join(
      root,
      "config",
      `${manifest.topology.object_config_ref}.env`,
    );
    entries.push({
      ...composeSecretIdentity("cos_config", {
        postgresGid,
        postgresUid,
        serviceGid,
        serviceUid,
      }),
      contents: await readProtectedRuntimeFile(configFile, {
        expectedGid: expectedSourceGid,
        expectedUid: expectedSourceUid,
        kind: "config",
      }),
      fileName: COMPOSE_SECRET_FILE_NAMES.cos_config,
      role: "cos_config",
    });
  }
  return entries;
}

async function validateMaterializedSecretDirectory(
  directory,
  materials,
  { expectedGid, expectedUid },
) {
  await validateProtectedDirectory(directory, {
    expectedGid,
    expectedUid,
    mode: 0o700,
    ruleId: "E012_DEPLOY_MATERIALIZED_SECRET_DIRECTORY",
  });
  const actualFiles = (await readdir(directory)).sort();
  const expectedFiles = materials.map(({ fileName }) => fileName).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail("E012_DEPLOY_MATERIALIZED_SECRET_DRIFT", "file-set");
  }
  for (const material of materials) {
    const file = path.join(directory, material.fileName);
    const metadata = await lstat(file);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.nlink !== 1 ||
      metadata.uid !== material.uid ||
      metadata.gid !== material.gid ||
      (metadata.mode & 0o777) !== 0o400 ||
      (await realpath(file)) !== file ||
      (await readFile(file, "utf8")) !== material.contents
    ) {
      fail("E012_DEPLOY_MATERIALIZED_SECRET_DRIFT", material.role);
    }
  }
}

export function developmentComposeSecretDirectory(
  manifest,
  { root = DEVELOPMENT_ROOT } = {},
) {
  validateReleaseManifest(manifest);
  const selectedRoot = path.resolve(root);
  if (selectedRoot === path.parse(selectedRoot).root) {
    fail("E012_DEPLOY_SECRET_ROOT_INVALID", "filesystem-root");
  }
  return path.join(selectedRoot, "runtime-secrets", manifest.release_id);
}

export async function materializeDevelopmentComposeSecrets(
  manifest,
  {
    expectedSourceGid = 0,
    expectedSourceUid = 0,
    postgresGid = 999,
    postgresUid = 999,
    root = DEVELOPMENT_ROOT,
    serviceGid = 1000,
    serviceUid = 1000,
  } = {},
) {
  const selectedRoot = path.resolve(root);
  const finalDirectory = developmentComposeSecretDirectory(manifest, {
    root: selectedRoot,
  });
  const runtimeRoot = path.dirname(finalDirectory);
  const materials = await readDevelopmentComposeSecretMaterials(manifest, {
    expectedSourceGid,
    expectedSourceUid,
    postgresGid,
    postgresUid,
    root: selectedRoot,
    serviceGid,
    serviceUid,
  });
  await mkdir(runtimeRoot, { mode: 0o700, recursive: true });
  await validateProtectedDirectory(runtimeRoot, {
    expectedGid: expectedSourceGid,
    expectedUid: expectedSourceUid,
    mode: 0o700,
    ruleId: "E012_DEPLOY_MATERIALIZED_SECRET_ROOT",
  });
  try {
    await validateMaterializedSecretDirectory(finalDirectory, materials, {
      expectedGid: expectedSourceGid,
      expectedUid: expectedSourceUid,
    });
    return finalDirectory;
  } catch (error) {
    if (
      !String(error?.message).startsWith(
        "E012_DEPLOY_MATERIALIZED_SECRET_DIRECTORY:missing",
      )
    ) {
      throw error;
    }
  }
  const stagingDirectory = path.join(
    runtimeRoot,
    `.${manifest.release_id}.${randomUUID()}`,
  );
  await mkdir(stagingDirectory, { mode: 0o700 });
  try {
    for (const material of materials) {
      const file = path.join(stagingDirectory, material.fileName);
      await writeFile(file, material.contents, { flag: "wx", mode: 0o400 });
      await chown(file, material.uid, material.gid);
      await chmod(file, 0o400);
    }
    await rename(stagingDirectory, finalDirectory);
  } catch (error) {
    await rm(stagingDirectory, { force: true, recursive: true });
    throw error;
  }
  await validateMaterializedSecretDirectory(finalDirectory, materials, {
    expectedGid: expectedSourceGid,
    expectedUid: expectedSourceUid,
  });
  return finalDirectory;
}

export function developmentComposeEnvironment(
  manifest,
  { composeSecretDirectory = developmentComposeSecretDirectory(manifest) } = {},
) {
  const developmentLite = isDevelopmentLiteManifest(manifest);
  const fingerprints = manifest.config.runtime_fingerprints;
  return Object.freeze({
    DAILYENERGY_ADMIN_IMAGE: manifest.images.admin,
    DAILYENERGY_API_CAPABILITY_FINGERPRINT: fingerprints.api_capability,
    DAILYENERGY_API_DEPLOY_FINGERPRINT: fingerprints.api_deploy_config,
    DAILYENERGY_API_REDIS_URL: "redis://redis:6379",
    DAILYENERGY_CONFIG_DIR: `${DEVELOPMENT_ROOT}/config`,
    ...(!developmentLite
      ? {
          DAILYENERGY_COS_CONFIG_REF: manifest.topology.object_config_ref,
          DAILYENERGY_COS_SECRET_DIR: `${DEVELOPMENT_ROOT}/secrets/${manifest.config.secret_ref_versions.cos_secret_id}`,
        }
      : {
          DAILYENERGY_DEPLOYMENT_PROFILE: "DEV_LITE",
          DAILYENERGY_DEV_LITE_COMPOSE_SECRET_DIR: composeSecretDirectory,
        }),
    DAILYENERGY_DEV_COMPOSE_SECRET_DIR: composeSecretDirectory,
    DAILYENERGY_LOG_LEVEL: manifest.config.log_level,
    DAILYENERGY_MIGRATION_IMAGE: manifest.images.migration,
    DAILYENERGY_PROXY_IMAGE: manifest.images.proxy,
    DAILYENERGY_REDIS_KEY_PREFIX: developmentLite
      ? "dailyenergy-dev-lite"
      : "dailyenergy-dev",
    DAILYENERGY_RELEASE_ID: manifest.release_id,
    DAILYENERGY_RUNTIME_ENVIRONMENT: manifest.config.environment,
    DAILYENERGY_SECRET_DIR: developmentLite
      ? composeSecretDirectory
      : `${DEVELOPMENT_ROOT}/secrets/${databaseSecretVersion(manifest)}`,
    DAILYENERGY_SERVER_IMAGE: manifest.images.server,
    DAILYENERGY_STUB_IMAGE: manifest.images.stub,
    DAILYENERGY_TELEMETRY_ENABLED: "false",
    DAILYENERGY_TELEMETRY_OTLP_TRACE_URL: "http://collector:4318/v1/traces",
    DAILYENERGY_WORKER_BACKGROUND_FINGERPRINT: fingerprints.worker_background,
    DAILYENERGY_WORKER_INTERACTIVE_FINGERPRINT: fingerprints.worker_interactive,
    DAILYENERGY_WORKER_REDIS_URL: "redis://redis:6379",
    DAILYENERGY_WORKER_RESTORE_READINESS: "NORMAL",
    DAILYENERGY_WORKER_RESTRICTED_FINGERPRINT: fingerprints.worker_restricted,
  });
}

export function renderComposeEnvironment(manifest, options) {
  return `${Object.entries(developmentComposeEnvironment(manifest, options))
    .map(([name, value]) => {
      if (
        typeof value !== "string" ||
        value.length === 0 ||
        /[\r\n]/u.test(value)
      ) {
        fail("E012_DEPLOY_ENV_VALUE_INVALID", name);
      }
      return `${name}=${value}`;
    })
    .join("\n")}\n`;
}

function composeArguments(
  bundleRoot,
  environmentFile,
  developmentLite = false,
) {
  return [
    "compose",
    "--project-name",
    developmentLite ? "dailyenergy-dev-lite" : "dailyenergy-dev",
    "--env-file",
    environmentFile,
    "--file",
    path.join(bundleRoot, "compose.yaml"),
    "--file",
    path.join(
      bundleRoot,
      developmentLite
        ? "docker/compose.dev-lite.yaml"
        : "docker/compose.dev.yaml",
    ),
    ...(developmentLite ? [] : ["--profile", "dev"]),
  ];
}

function developmentLiteDeploymentCommands(bundleRoot, environmentFile) {
  const compose = composeArguments(bundleRoot, environmentFile, true);
  const profiles = Object.freeze({
    admin: "dev-lite-admin",
    background: "dev-lite-background",
    core: "dev-lite-core",
    interactive: "dev-lite-interactive",
    oneShot: "dev-lite-one-shot",
    restricted: "dev-lite-restricted",
  });
  const allProfiles = Object.values(profiles);
  const command = (selectedProfiles, ...arguments_) => ({
    arguments: [
      ...compose,
      ...selectedProfiles.flatMap((profile) => ["--profile", profile]),
      ...arguments_,
    ],
    executable: "docker",
  });
  const stopTransients = () =>
    command(
      allProfiles,
      "stop",
      "--timeout",
      "10",
      "admin",
      "worker-interactive",
      "worker-background",
      "worker-restricted",
    );
  const stopApplication = () =>
    command(
      allProfiles,
      "stop",
      "--timeout",
      "10",
      "tls-proxy",
      "api",
      "admin",
      "worker-interactive",
      "worker-background",
      "worker-restricted",
    );
  const converge = (profile, service) =>
    command(
      [profile],
      "up",
      "-d",
      "--force-recreate",
      "--no-deps",
      "--wait",
      "--wait-timeout",
      "120",
      service,
    );
  const databaseCommand = (mode, operationCheckpoint) => ({
    ...command(
      [profiles.oneShot],
      "run",
      "--rm",
      "--no-deps",
      "--name",
      "dailyenergy-dev-lite-database-init",
      "database-init",
      "node",
      "tooling/compose/provision-database.mjs",
      mode,
    ),
    ...(operationCheckpoint === undefined ? {} : { operationCheckpoint }),
  });
  const databaseVerifyCommand = () =>
    command(
      [profiles.oneShot],
      "run",
      "--rm",
      "--no-deps",
      "--name",
      "dailyenergy-dev-lite-database-verify",
      "database-verify",
    );
  const databaseSmokeCommand = (phase) =>
    command(
      [profiles.oneShot],
      "run",
      "--rm",
      "--no-deps",
      "--name",
      `dailyenergy-dev-lite-database-smoke-${phase}`,
      "database-smoke",
      "node",
      "tooling/deployment/database-smoke.mjs",
      phase,
    );
  const apiHealth = {
    arguments: [
      "--fail",
      "--silent",
      "--show-error",
      "--insecure",
      "--resolve",
      "localhost:8443:127.0.0.1",
      "https://localhost:8443/health/ready",
    ],
    executable: "curl",
  };
  const adminHealth = {
    arguments: [
      "--fail",
      "--silent",
      "--show-error",
      "--insecure",
      "--resolve",
      "localhost:8444:127.0.0.1",
      "https://localhost:8444/login",
    ],
    executable: "curl",
  };
  const pull = command(allProfiles, "pull", "--policy", "always");
  pull.timeoutMs = 1_800_000;
  return Object.freeze({
    admin: [
      stopTransients(),
      converge(profiles.admin, "admin"),
      converge(profiles.core, "tls-proxy"),
      adminHealth,
      command(allProfiles, "stop", "--timeout", "10", "tls-proxy"),
    ],
    api: [stopTransients(), converge(profiles.core, "api")],
    drift: [databaseVerifyCommand()],
    health: [apiHealth],
    "maintenance-off": [apiHealth],
    "maintenance-on": [stopApplication()],
    migration: [
      databaseCommand("prepare"),
      databaseCommand("migrate", "MIGRATION_APPLIED"),
      databaseCommand("seed"),
      databaseVerifyCommand(),
    ],
    preflight: [],
    pull: [stopApplication(), pull],
    "smoke-delete": [databaseSmokeCommand("deletion")],
    "smoke-object": [
      command(
        [profiles.oneShot],
        "run",
        "--rm",
        "--no-deps",
        "--name",
        "dailyenergy-dev-lite-object-smoke",
        "object-smoke",
      ),
    ],
    "smoke-owner": [databaseSmokeCommand("owner")],
    "smoke-safety": [databaseSmokeCommand("safety")],
    "stateful-ready": [
      stopApplication(),
      command(
        [profiles.core],
        "up",
        "-d",
        "--force-recreate",
        "--wait",
        "--wait-timeout",
        "120",
        "postgres",
        "redis",
        "dependency-stub",
      ),
    ],
    "tls-ingress": [stopTransients(), converge(profiles.core, "tls-proxy")],
    "worker-background": [
      stopTransients(),
      converge(profiles.background, "worker-background"),
    ],
    "worker-drain": [stopTransients()],
    "worker-interactive": [
      stopTransients(),
      converge(profiles.interactive, "worker-interactive"),
    ],
    "worker-restricted": [
      stopTransients(),
      converge(profiles.restricted, "worker-restricted"),
    ],
  });
}

export function developmentDeploymentCommands(
  bundleRoot,
  environmentFile,
  manifestOrProfile = "STANDARD",
) {
  const developmentLite =
    manifestOrProfile === "DEV_LITE" ||
    manifestOrProfile?.config?.deployment_profile === "DEV_LITE";
  if (developmentLite) {
    return developmentLiteDeploymentCommands(bundleRoot, environmentFile);
  }
  const compose = composeArguments(bundleRoot, environmentFile);
  const command = (...arguments_) => ({
    arguments: [...compose, ...arguments_],
    executable: "docker",
  });
  const convergeService = (...arguments_) =>
    command("up", "-d", "--force-recreate", ...arguments_);
  const databaseCommand = (mode, operationCheckpoint) => ({
    ...command(
      "run",
      "--rm",
      "--no-deps",
      "database-init",
      "node",
      "tooling/compose/provision-database.mjs",
      mode,
    ),
    ...(operationCheckpoint === undefined ? {} : { operationCheckpoint }),
  });
  const databaseSmokeCommand = (phase) =>
    command(
      "--profile",
      "dev-smoke",
      "run",
      "--rm",
      "--no-deps",
      "database-smoke",
      "node",
      "tooling/deployment/database-smoke.mjs",
      phase,
    );
  const databaseVerifyCommand = () =>
    command("run", "--rm", "--no-deps", "database-verify");
  return Object.freeze({
    admin: [
      convergeService("--no-deps", "--wait", "--wait-timeout", "90", "admin"),
    ],
    api: [
      convergeService("--no-deps", "--wait", "--wait-timeout", "90", "api"),
    ],
    drift: [databaseVerifyCommand()],
    health: [
      {
        arguments: [
          "--fail",
          "--silent",
          "--show-error",
          "--insecure",
          "--resolve",
          "localhost:8443:127.0.0.1",
          "https://localhost:8443/health/ready",
        ],
        executable: "curl",
      },
      {
        arguments: [
          "--fail",
          "--silent",
          "--show-error",
          "--insecure",
          "--resolve",
          "localhost:8444:127.0.0.1",
          "https://localhost:8444/login",
        ],
        executable: "curl",
      },
    ],
    "maintenance-off": [
      {
        arguments: [
          "--fail",
          "--silent",
          "--show-error",
          "--insecure",
          "--resolve",
          "localhost:8443:127.0.0.1",
          "https://localhost:8443/health/ready",
        ],
        executable: "curl",
      },
    ],
    "maintenance-on": [command("stop", "--timeout", "10", "tls-proxy")],
    migration: [
      databaseCommand("prepare"),
      databaseCommand("migrate", "MIGRATION_APPLIED"),
      databaseCommand("seed"),
      databaseVerifyCommand(),
    ],
    preflight: [],
    pull: [command("--profile", "dev-smoke", "pull", "--policy", "always")],
    "smoke-delete": [databaseSmokeCommand("deletion")],
    "smoke-object": [
      command(
        "--profile",
        "dev-smoke",
        "run",
        "--rm",
        "--no-deps",
        "object-smoke",
      ),
    ],
    "smoke-owner": [databaseSmokeCommand("owner")],
    "smoke-safety": [databaseSmokeCommand("safety")],
    "stateful-ready": [
      convergeService(
        "--wait",
        "--wait-timeout",
        "90",
        "postgres",
        "redis",
        "dependency-stub",
      ),
    ],
    "tls-ingress": [
      convergeService(
        "--no-deps",
        "--wait",
        "--wait-timeout",
        "90",
        "tls-proxy",
      ),
    ],
    "worker-background": [
      convergeService(
        "--no-deps",
        "--wait",
        "--wait-timeout",
        "90",
        "worker-background",
      ),
    ],
    "worker-drain": [
      command(
        "stop",
        "--timeout",
        "10",
        "worker-interactive",
        "worker-background",
        "worker-restricted",
      ),
    ],
    "worker-interactive": [
      convergeService(
        "--no-deps",
        "--wait",
        "--wait-timeout",
        "90",
        "worker-interactive",
      ),
    ],
    "worker-restricted": [
      convergeService(
        "--no-deps",
        "--wait",
        "--wait-timeout",
        "90",
        "worker-restricted",
      ),
    ],
  });
}

function runCommand(command, { cwd, environment = {} }) {
  const result = spawnSync(command.executable, command.arguments, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...environment },
    maxBuffer: 2 * 1024 * 1024,
    timeout: command.timeoutMs ?? 180_000,
  });
  return { code: result.status, error: result.error };
}

async function writeExact(file, contents) {
  try {
    await writeFile(file, contents, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
    if ((await readFile(file, "utf8")) !== contents) {
      fail("E012_DEPLOY_BUNDLE_CONTENT_DRIFT", path.basename(file));
    }
  }
}

async function persistReceipt(stateRoot, receipt) {
  const directory = path.join(stateRoot, "receipts");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(
    directory,
    `${receipt.operation}-${receipt.release_id}-${receipt.operation_id}.json`,
  );
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  try {
    const existing = await readFile(file, "utf8");
    if (existing !== contents) {
      fail("RELEASE_RECEIPT_CONTENT_DRIFT", path.basename(file));
    }
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, contents, { flag: "wx", mode: 0o600 });
  await rename(temporary, file);
}

function operationReferenceMatches(left, right) {
  return (
    left?.release_id === right?.release_id &&
    left?.manifest_sha256 === right?.manifest_sha256
  );
}

function completedOperationReceipt(pending, completedAtUtc) {
  const receipts = pending.completed_phases.map((phase) => ({
    phase,
    result: "PASS",
  }));
  if (pending.kind === "RECONCILE_CURRENT") {
    validateReconciliationReceipts(receipts);
  } else {
    validateDeploymentReceipts(receipts);
  }
  if (pending.active_phase !== null) {
    fail("RELEASE_RECEIPT_OPERATION_INCOMPLETE", pending.target.release_id);
  }
  const reference =
    pending.kind === "RECOVER_CURRENT" ? pending.from_current : pending.target;
  if (reference === null) {
    fail("RELEASE_RECEIPT_REFERENCE_MISSING", pending.kind);
  }
  return {
    completed_at_utc: completedAtUtc,
    ...(pending.kind === "RECONCILE_CURRENT"
      ? { effective_catalog: pending.recovery_catalog }
      : {}),
    manifest_sha256: reference.manifest_sha256,
    operation: pending.kind.toLowerCase().replaceAll("_", "-"),
    operation_id: pending.operation_id,
    release_id: reference.release_id,
    receipts,
    status: "PASS",
  };
}

async function persistCompletedOperationReceipt(stateRoot) {
  const [pending, state] = await Promise.all([
    readReleaseOperation(stateRoot),
    readReleaseState(stateRoot),
  ]);
  if (pending === null || state === null) {
    fail("RELEASE_RECEIPT_OPERATION_MISSING", "pending-operation-or-state");
  }
  const completedAtUtc =
    pending.kind === "RECONCILE_CURRENT"
      ? pending.updated_at_utc
      : state.updated_at_utc;
  const receipt = completedOperationReceipt(pending, completedAtUtc);
  await persistReceipt(stateRoot, receipt);
  return receipt;
}

function replaceableFailedInitialOperation(state, pending) {
  const migrationPhaseIndex = deploymentPhases.indexOf("migration");
  return (
    state === null &&
    pending?.kind === "DEPLOY" &&
    pending.status === "FAILED" &&
    pending.from_current === null &&
    pending.recovery_catalog === null &&
    pending.migration_applied === false &&
    pending.migration_verified === false &&
    pending.failure_code !== null &&
    pending.completed_phases.every(
      (phase) => deploymentPhases.indexOf(phase) < migrationPhaseIndex,
    ) &&
    (pending.active_phase === null ||
      deploymentPhases.indexOf(pending.active_phase) < migrationPhaseIndex)
  );
}

async function persistSupersededInitialOperationReceipt(
  stateRoot,
  pending,
  replacementManifest,
) {
  if (!replaceableFailedInitialOperation(null, pending)) {
    fail("RELEASE_INITIAL_REPLACEMENT_INVALID", pending?.target?.release_id);
  }
  validateReleaseManifest(replacementManifest);
  const receipts = pending.completed_phases.map((phase) => ({
    phase,
    result: "PASS",
  }));
  if (pending.active_phase !== null) {
    receipts.push({ phase: pending.active_phase, result: "FAIL" });
  }
  const receipt = {
    completed_at_utc: pending.updated_at_utc,
    failure_code: pending.failure_code,
    manifest_sha256: pending.target.manifest_sha256,
    operation: "superseded-initial-deploy",
    operation_id: pending.operation_id,
    release_id: pending.target.release_id,
    replacement: {
      manifest_sha256: releaseManifestDigest(replacementManifest),
      release_id: replacementManifest.release_id,
    },
    receipts,
    status: "SUPERSEDED_BEFORE_MIGRATION",
  };
  await persistReceipt(stateRoot, receipt);
  return receipt;
}

async function finalizeCommittedOperation(stateRoot, state, pending) {
  const applicationCommitted =
    !["RECONCILE_CURRENT", "RECOVER_CURRENT"].includes(pending.kind) &&
    operationReferenceMatches(state?.current, pending.target);
  const recoveryCommitted =
    pending.kind === "RECOVER_CURRENT" &&
    operationReferenceMatches(state?.current, pending.from_current) &&
    operationReferenceMatches(state?.catalog, pending.recovery_catalog);
  const reconciliationCommitted =
    pending.kind === "RECONCILE_CURRENT" &&
    pending.active_phase === null &&
    pending.completed_phases.length === reconciliationPhases.length &&
    operationReferenceMatches(state?.current, pending.from_current) &&
    operationReferenceMatches(state?.catalog, pending.recovery_catalog);
  if (!applicationCommitted && !recoveryCommitted && !reconciliationCommitted) {
    return false;
  }
  await persistCompletedOperationReceipt(stateRoot);
  await clearReleaseOperation(stateRoot);
  return true;
}

async function probeRecoveryCatalog({
  bundleRoot,
  composeSecretDirectory,
  manifest,
  runner,
  stateRoot,
}) {
  const environmentFile = path.join(
    stateRoot,
    `catalog-probe-${manifest.release_id}-${releaseManifestDigest(manifest).slice(0, 12)}.env`,
  );
  await writeExact(
    environmentFile,
    renderComposeEnvironment(manifest, { composeSecretDirectory }),
  );
  const command = developmentDeploymentCommands(
    bundleRoot,
    environmentFile,
    manifest,
  ).migration.at(-1);
  const result = await runner(command, {
    cwd: bundleRoot,
    environment: {},
  });
  return !result.error && result.code === 0;
}

async function resolveRecoveryCatalogReference({
  bundleRoot,
  composeSecretDirectory,
  pending,
  runner,
  state,
  stateRoot,
}) {
  if (pending.recovery_catalog !== null) {
    return pending.recovery_catalog;
  }
  if (pending.migration_verified) {
    return pending.target;
  }
  const stateCatalog = {
    manifest_sha256: state.catalog.manifest_sha256,
    release_id: state.catalog.release_id,
  };
  const candidates = pending.migration_applied
    ? [pending.target]
    : [stateCatalog, pending.target];
  for (const reference of candidates) {
    const candidate = await loadOperationManifest(stateRoot, reference);
    if (
      await probeRecoveryCatalog({
        bundleRoot,
        composeSecretDirectory,
        manifest: candidate,
        runner,
        stateRoot,
      })
    ) {
      return reference;
    }
  }
  fail("RECOVER_CURRENT_CATALOG_UNRESOLVED", pending.target.release_id);
}

async function runPhases({
  bundleRoot,
  environmentFile,
  manifest,
  onCommandPass = async () => undefined,
  onPhasePass = async () => undefined,
  onPhaseStart = async () => undefined,
  phases = deploymentPhases,
  receiptValidator = validateDeploymentReceipts,
  runner,
}) {
  const commands = developmentDeploymentCommands(
    bundleRoot,
    environmentFile,
    manifest,
  );
  const receipts = [];
  for (const phase of phases) {
    await onPhaseStart(phase);
    for (const command of commands[phase]) {
      const result = await runner(command, {
        cwd: bundleRoot,
        environment: {},
      });
      if (result.error || result.code !== 0) {
        fail("E012_DEPLOY_PHASE_FAILED", phase);
      }
      await onCommandPass(phase, command);
    }
    if (isDevelopmentLiteManifest(manifest)) {
      const runtimeCheck = {
        arguments: [
          path.join(
            bundleRoot,
            "tooling/deployment/dev-lite-runtime-check.mjs",
          ),
          phase,
        ],
        executable: "/usr/local/bin/dailyenergy-node",
      };
      const result = await runner(runtimeCheck, {
        cwd: bundleRoot,
        environment: {},
      });
      if (result.error || result.code !== 0) {
        fail("E017_DEV_LITE_RUNTIME_CHECK_FAILED", phase);
      }
      await onCommandPass(phase, runtimeCheck);
    }
    receipts.push({ phase, result: "PASS" });
    await onPhasePass(phase);
  }
  receiptValidator(receipts);
  return receipts;
}

export async function executeDevelopmentDeployment({
  bundleRoot,
  imageSet,
  manifest,
  operation = "deploy",
  preflight = runDevelopmentPreflight,
  releaseLock = withReleaseLock,
  runner = runCommand,
  runtimeEvidence,
  secretMaterializer = materializeDevelopmentComposeSecrets,
  stateRoot = STATE_ROOT,
}) {
  if (
    !["deploy", "reconcile-current", "recover-current", "rollback"].includes(
      operation,
    )
  ) {
    fail("E012_DEPLOY_OPERATION_INVALID", operation);
  }
  return releaseLock(
    stateRoot,
    `${operation}:${manifest.release_id}`,
    async () => {
      const state = await readReleaseState(stateRoot);
      let pending = await readReleaseOperation(stateRoot);
      const committedPendingOperation = pending?.kind
        .toLowerCase()
        .replaceAll("_", "-");
      const committedPendingReference =
        pending?.kind === "RECOVER_CURRENT"
          ? pending.from_current
          : pending?.target;
      if (
        pending !== null &&
        (await finalizeCommittedOperation(stateRoot, state, pending))
      ) {
        pending = null;
        if (
          operation === committedPendingOperation &&
          operationReferenceMatches(committedPendingReference, {
            manifest_sha256: releaseManifestDigest(manifest),
            release_id: manifest.release_id,
          })
        ) {
          await preflight(manifest, imageSet, runtimeEvidence);
          await secretMaterializer(manifest);
          return Object.freeze({ idempotent: true, receipts: [] });
        }
      }
      let retryInitialRelease = false;
      let retryReconciliation = false;
      let replaceInitialRelease = false;
      if (
        !["reconcile-current", "recover-current"].includes(operation) &&
        pending !== null
      ) {
        if (
          operation === "deploy" &&
          state === null &&
          pending.from_current === null &&
          pending.target.release_id === manifest.release_id &&
          pending.target.manifest_sha256 === releaseManifestDigest(manifest)
        ) {
          retryInitialRelease = true;
        } else if (
          operation === "deploy" &&
          pending.target.release_id !== manifest.release_id &&
          replaceableFailedInitialOperation(state, pending)
        ) {
          validateReleaseClassMatch(
            await loadOperationManifest(stateRoot, pending.target),
            manifest,
            "RELEASE_INITIAL_REPLACEMENT_TOPOLOGY_REQUIRES_FRESH_STATE",
          );
          replaceInitialRelease = true;
        } else {
          fail("RELEASE_RECOVERY_REQUIRED", pending.target.release_id);
        }
      }
      if (operation === "reconcile-current") {
        if (state === null) {
          fail("RECONCILE_CURRENT_MISSING", "release-state");
        }
        const manifestReference = {
          manifest_sha256: releaseManifestDigest(manifest),
          release_id: manifest.release_id,
        };
        if (!operationReferenceMatches(state.current, manifestReference)) {
          fail("RECONCILE_CURRENT_MANIFEST_MISMATCH", manifest.release_id);
        }
        if (pending !== null) {
          if (
            pending.kind === "RECONCILE_CURRENT" &&
            pending.status === "FAILED" &&
            operationReferenceMatches(pending.target, state.current) &&
            operationReferenceMatches(pending.from_current, state.current) &&
            operationReferenceMatches(pending.recovery_catalog, state.catalog)
          ) {
            retryReconciliation = true;
          } else {
            fail("RELEASE_RECOVERY_REQUIRED", pending.target.release_id);
          }
        }
        const [currentManifest, catalogManifest] = await Promise.all([
          loadReleaseManifest(stateRoot, state.current),
          loadCatalogManifest(stateRoot, state.catalog),
        ]);
        validateReleaseClassMatch(
          currentManifest,
          catalogManifest,
          "RECONCILE_CURRENT_CATALOG_TOPOLOGY_REQUIRES_FRESH_STATE",
        );
        if (
          !currentManifest.compatibility.accepted_generations.includes(
            catalogManifest.migrations.catalog_generation,
          )
        ) {
          fail(
            "RECONCILE_CURRENT_CATALOG_INCOMPATIBLE",
            `${currentManifest.release_id}->${catalogManifest.release_id}`,
          );
        }
        await preflight(currentManifest, imageSet, runtimeEvidence);
        const composeSecretDirectory =
          await secretMaterializer(currentManifest);
        const convergenceManifest = structuredClone(currentManifest);
        convergenceManifest.images.migration = catalogManifest.images.migration;
        convergenceManifest.migrations = structuredClone(
          catalogManifest.migrations,
        );
        const environmentFile = path.join(
          stateRoot,
          `reconcile-${currentManifest.release_id}-${catalogManifest.release_id}.env`,
        );
        await writeExact(
          environmentFile,
          renderComposeEnvironment(convergenceManifest, {
            composeSecretDirectory,
          }),
        );
        if (retryReconciliation) {
          await restartReconciliationOperation(
            stateRoot,
            currentManifest,
            state.current,
            state.catalog,
          );
        } else {
          await beginReconciliationOperation(
            stateRoot,
            currentManifest,
            state.current,
            state.catalog,
          );
        }
        let receipts;
        try {
          receipts = await runPhases({
            bundleRoot,
            environmentFile,
            manifest: convergenceManifest,
            onPhasePass: (phase) =>
              updateReleaseOperationPhase(stateRoot, phase, true),
            onPhaseStart: (phase) =>
              updateReleaseOperationPhase(stateRoot, phase, false),
            phases: reconciliationPhases,
            receiptValidator: validateReconciliationReceipts,
            runner,
          });
        } catch (error) {
          await markReleaseOperationFailed(stateRoot, error);
          throw error;
        }
        await persistCompletedOperationReceipt(stateRoot);
        await clearReleaseOperation(stateRoot);
        return Object.freeze({ idempotent: false, receipts });
      }
      if (operation === "recover-current") {
        if (pending === null || state === null) {
          fail("RECOVER_CURRENT_MISSING", "pending-operation");
        }
        if (pending.kind === "RECONCILE_CURRENT") {
          fail("RELEASE_RECOVERY_REQUIRED", pending.target.release_id);
        }
        if (
          state.current.release_id !== manifest.release_id ||
          state.current.manifest_sha256 !== releaseManifestDigest(manifest) ||
          pending.from_current?.release_id !== manifest.release_id ||
          pending.from_current.manifest_sha256 !==
            releaseManifestDigest(manifest)
        ) {
          fail("RECOVER_CURRENT_MANIFEST_MISMATCH", manifest.release_id);
        }
        const recoveryClassManifests = await Promise.all([
          loadCatalogManifest(stateRoot, state.catalog),
          loadOperationManifest(stateRoot, pending.target),
          ...(pending.recovery_catalog === null
            ? []
            : [loadOperationManifest(stateRoot, pending.recovery_catalog)]),
        ]);
        for (const recoveryClassManifest of recoveryClassManifests) {
          validateReleaseClassMatch(
            manifest,
            recoveryClassManifest,
            "RECOVER_CURRENT_CATALOG_TOPOLOGY_REQUIRES_FRESH_STATE",
          );
        }
        await preflight(manifest, imageSet, runtimeEvidence);
        const composeSecretDirectory = await secretMaterializer(manifest);
        const recoveryCatalogReference = await resolveRecoveryCatalogReference({
          bundleRoot,
          composeSecretDirectory,
          pending,
          runner,
          state,
          stateRoot,
        });
        const catalogManifest = await loadOperationManifest(
          stateRoot,
          recoveryCatalogReference,
        );
        validateReleaseClassMatch(
          manifest,
          catalogManifest,
          "RECOVER_CURRENT_CATALOG_TOPOLOGY_REQUIRES_FRESH_STATE",
        );
        if (
          !manifest.compatibility.accepted_generations.includes(
            catalogManifest.migrations.catalog_generation,
          )
        ) {
          fail(
            "RECOVER_CURRENT_CATALOG_INCOMPATIBLE",
            catalogManifest.release_id,
          );
        }
        await markReleaseOperationRecovering(
          stateRoot,
          recoveryCatalogReference,
        );
        const convergenceManifest = structuredClone(manifest);
        convergenceManifest.images.migration = catalogManifest.images.migration;
        convergenceManifest.migrations = structuredClone(
          catalogManifest.migrations,
        );
        const environmentFile = path.join(
          stateRoot,
          `recover-${manifest.release_id}-${catalogManifest.release_id}.env`,
        );
        await writeExact(
          environmentFile,
          renderComposeEnvironment(convergenceManifest, {
            composeSecretDirectory,
          }),
        );
        try {
          const receipts = await runPhases({
            bundleRoot,
            environmentFile,
            manifest: convergenceManifest,
            onCommandPass: (_phase, command) =>
              command.operationCheckpoint === "MIGRATION_APPLIED"
                ? markReleaseOperationMigrationApplied(stateRoot)
                : undefined,
            onPhasePass: (phase) =>
              updateReleaseOperationPhase(stateRoot, phase, true),
            onPhaseStart: (phase) =>
              updateReleaseOperationPhase(stateRoot, phase, false),
            runner,
          });
          await commitRecoveredCurrent(stateRoot, catalogManifest);
          await persistCompletedOperationReceipt(stateRoot);
          await clearReleaseOperation(stateRoot);
          return Object.freeze({ idempotent: false, receipts });
        } catch (error) {
          await markReleaseOperationFailed(stateRoot, error);
          throw error;
        }
      }
      if (operation === "deploy" && state !== null) {
        const current = await loadReleaseManifest(stateRoot, state.current);
        if (current.release_id === manifest.release_id) {
          if (
            releaseManifestDigest(current) !== releaseManifestDigest(manifest)
          ) {
            fail("RELEASE_ID_CONTENT_DRIFT", manifest.release_id);
          }
          await preflight(manifest, imageSet, runtimeEvidence);
          await secretMaterializer(manifest);
          return Object.freeze({ idempotent: true, receipts: [] });
        }
        validateReleaseTransition(current, manifest);
      }
      if (operation === "rollback") {
        if (
          state?.rollback_target?.release_id !== manifest.release_id ||
          state.rollback_target.manifest_sha256 !==
            releaseManifestDigest(manifest)
        ) {
          fail("ROLLBACK_TARGET_MISSING", manifest.release_id);
        }
        const current = await loadReleaseManifest(stateRoot, state.current);
        validateRollbackTransition(current, manifest);
      }

      const environmentFile = path.join(bundleRoot, "release.env");
      await preflight(manifest, imageSet, runtimeEvidence);
      const composeSecretDirectory = await secretMaterializer(manifest);
      await writeExact(
        environmentFile,
        renderComposeEnvironment(manifest, { composeSecretDirectory }),
      );
      if (retryInitialRelease) {
        await restartInitialReleaseOperation(stateRoot, manifest);
      } else {
        if (replaceInitialRelease) {
          await persistSupersededInitialOperationReceipt(
            stateRoot,
            pending,
            manifest,
          );
          await clearReleaseOperation(stateRoot);
        }
        await beginReleaseOperation(
          stateRoot,
          operation.toUpperCase(),
          manifest,
          state?.current ?? null,
        );
      }
      try {
        const receipts = await runPhases({
          bundleRoot,
          environmentFile,
          manifest,
          onCommandPass: (_phase, command) =>
            command.operationCheckpoint === "MIGRATION_APPLIED"
              ? markReleaseOperationMigrationApplied(stateRoot)
              : undefined,
          onPhasePass: (phase) =>
            updateReleaseOperationPhase(stateRoot, phase, true),
          onPhaseStart: (phase) =>
            updateReleaseOperationPhase(stateRoot, phase, false),
          runner,
        });
        const committed =
          operation === "deploy"
            ? await commitSuccessfulDeployment(stateRoot, manifest)
            : await commitSuccessfulRollback(stateRoot);
        await persistCompletedOperationReceipt(stateRoot);
        await clearReleaseOperation(stateRoot);
        return Object.freeze({
          idempotent: committed.idempotent ?? false,
          receipts,
        });
      } catch (error) {
        await markReleaseOperationFailed(stateRoot, error);
        throw error;
      }
    },
  );
}

async function main() {
  const [operation, manifestFile, imageSetFile, runtimeFile] =
    process.argv.slice(2);
  if (!operation || !manifestFile || !imageSetFile || !runtimeFile) {
    fail(
      "E012_DEPLOY_USAGE",
      "deploy|rollback|recover-current|reconcile-current manifest image-set runtime-evidence",
    );
  }
  const bundleRoot = path.resolve(".");
  const [manifest, imageSet, runtimeEvidence] = await Promise.all(
    [manifestFile, imageSetFile, runtimeFile].map(async (file) =>
      JSON.parse(await readFile(path.resolve(file), "utf8")),
    ),
  );
  if (bundleRoot !== path.join(BUNDLE_ROOT, manifest.release_id)) {
    fail("E012_DEPLOY_BUNDLE_ROOT_INVALID", path.basename(bundleRoot));
  }
  const result = await executeDevelopmentDeployment({
    bundleRoot,
    imageSet,
    manifest,
    operation,
    runtimeEvidence,
  });
  process.stdout.write(
    `E012_DEV_DEPLOY_OK:operation=${operation}:id=${manifest.release_id}:idempotent=${result.idempotent}:phases=${result.receipts.length}\n`,
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

export const deploymentTesting = Object.freeze({
  canonicalReleaseManifest,
});
