#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createCosConfigEvidence,
  runDevelopmentPreflight,
  SECRET_FILE_NAMES,
} from "./preflight.mjs";
import {
  canonicalReleaseManifest,
  deploymentPhases,
  releaseManifestDigest,
  validateDeploymentReceipts,
  validateReleaseManifest,
  validateReleaseTransition,
  validateRollbackTransition,
} from "./release-contract.mjs";
import {
  commitSuccessfulDeployment,
  commitSuccessfulRollback,
  loadReleaseManifest,
  readReleaseState,
  withReleaseLock,
} from "./release-state.mjs";

const DEVELOPMENT_ROOT = "/srv/dailyenergy";
const STATE_ROOT = `${DEVELOPMENT_ROOT}/deployment`;
const BUNDLE_ROOT = `${DEVELOPMENT_ROOT}/bundles`;
const COMPOSE_SECRET_ENVIRONMENT_NAMES = Object.freeze({
  cos_secret_id: "DAILYENERGY_DEV_COS_SECRET_ID",
  cos_secret_key: "DAILYENERGY_DEV_COS_SECRET_KEY",
  database_admin_url: "DAILYENERGY_DEV_DATABASE_ADMIN_URL",
  database_api_url: "DAILYENERGY_DEV_DATABASE_API_URL",
  database_background_url: "DAILYENERGY_DEV_DATABASE_BACKGROUND_URL",
  database_interactive_url: "DAILYENERGY_DEV_DATABASE_INTERACTIVE_URL",
  database_migration_url: "DAILYENERGY_DEV_DATABASE_MIGRATION_URL",
  database_restricted_url: "DAILYENERGY_DEV_DATABASE_RESTRICTED_URL",
  fault_control_token: "DAILYENERGY_DEV_FAULT_CONTROL_TOKEN",
  postgres_password: "DAILYENERGY_DEV_POSTGRES_PASSWORD",
});
const COMPOSE_COS_CONFIG_ENVIRONMENT = "DAILYENERGY_DEV_COS_CONFIG";

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

export async function loadDevelopmentComposeSecretEnvironment(
  manifest,
  { expectedGid = 0, expectedUid = 0, root = DEVELOPMENT_ROOT } = {},
) {
  validateReleaseManifest(manifest);
  const selectedRoot = path.resolve(root);
  if (selectedRoot === path.parse(selectedRoot).root) {
    fail("E012_DEPLOY_SECRET_ROOT_INVALID", "filesystem-root");
  }
  const configFile = path.join(
    selectedRoot,
    "config",
    `${manifest.topology.object_config_ref}.env`,
  );
  const entries = await Promise.all(
    Object.entries(SECRET_FILE_NAMES).map(async ([role, fileName]) => [
      COMPOSE_SECRET_ENVIRONMENT_NAMES[role],
      await readProtectedRuntimeFile(
        path.join(
          selectedRoot,
          "secrets",
          manifest.config.secret_ref_versions[role],
          fileName,
        ),
        { expectedGid, expectedUid, kind: "secret" },
      ),
    ]),
  );
  entries.push([
    COMPOSE_COS_CONFIG_ENVIRONMENT,
    await readProtectedRuntimeFile(configFile, {
      expectedGid,
      expectedUid,
      kind: "config",
    }),
  ]);
  return Object.freeze(Object.fromEntries(entries));
}

export function developmentComposeEnvironment(manifest) {
  const fingerprints = manifest.config.runtime_fingerprints;
  return Object.freeze({
    DAILYENERGY_ADMIN_IMAGE: manifest.images.admin,
    DAILYENERGY_API_CAPABILITY_FINGERPRINT: fingerprints.api_capability,
    DAILYENERGY_API_DEPLOY_FINGERPRINT: fingerprints.api_deploy_config,
    DAILYENERGY_CONFIG_DIR: `${DEVELOPMENT_ROOT}/config`,
    DAILYENERGY_COS_CONFIG_REF: manifest.topology.object_config_ref,
    DAILYENERGY_COS_SECRET_DIR: `${DEVELOPMENT_ROOT}/secrets/${manifest.config.secret_ref_versions.cos_secret_id}`,
    DAILYENERGY_LOG_LEVEL: manifest.config.log_level,
    DAILYENERGY_MIGRATION_IMAGE: manifest.images.migration,
    DAILYENERGY_PROXY_IMAGE: manifest.images.proxy,
    DAILYENERGY_REDIS_KEY_PREFIX: "dailyenergy-dev",
    DAILYENERGY_RELEASE_ID: manifest.release_id,
    DAILYENERGY_RUNTIME_ENVIRONMENT: manifest.config.environment,
    DAILYENERGY_SECRET_DIR: `${DEVELOPMENT_ROOT}/secrets/${databaseSecretVersion(manifest)}`,
    DAILYENERGY_SERVER_IMAGE: manifest.images.server,
    DAILYENERGY_STUB_IMAGE: manifest.images.stub,
    DAILYENERGY_WORKER_BACKGROUND_FINGERPRINT: fingerprints.worker_background,
    DAILYENERGY_WORKER_INTERACTIVE_FINGERPRINT: fingerprints.worker_interactive,
    DAILYENERGY_WORKER_REDIS_URL: "redis://redis:6379",
    DAILYENERGY_WORKER_RESTORE_READINESS: "NORMAL",
    DAILYENERGY_WORKER_RESTRICTED_FINGERPRINT: fingerprints.worker_restricted,
  });
}

export function renderComposeEnvironment(manifest) {
  return `${Object.entries(developmentComposeEnvironment(manifest))
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

function composeArguments(bundleRoot, environmentFile) {
  return [
    "compose",
    "--project-name",
    "dailyenergy-dev",
    "--env-file",
    environmentFile,
    "--file",
    path.join(bundleRoot, "compose.yaml"),
    "--file",
    path.join(bundleRoot, "docker/compose.dev.yaml"),
    "--profile",
    "dev",
  ];
}

export function developmentDeploymentCommands(bundleRoot, environmentFile) {
  const compose = composeArguments(bundleRoot, environmentFile);
  const command = (...arguments_) => ({
    arguments: [...compose, ...arguments_],
    executable: "docker",
  });
  return Object.freeze({
    admin: [
      command(
        "up",
        "-d",
        "--no-deps",
        "--wait",
        "--wait-timeout",
        "90",
        "admin",
      ),
    ],
    api: [
      command("up", "-d", "--no-deps", "--wait", "--wait-timeout", "90", "api"),
    ],
    health: [
      {
        arguments: [
          "--fail",
          "--silent",
          "--show-error",
          "--insecure",
          "https://127.0.0.1:8443/health/ready",
        ],
        executable: "curl",
      },
      {
        arguments: [
          "--fail",
          "--silent",
          "--show-error",
          "--insecure",
          "https://127.0.0.1:8444/login",
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
          "https://127.0.0.1:8443/health/ready",
        ],
        executable: "curl",
      },
    ],
    "maintenance-on": [command("stop", "--timeout", "10", "tls-proxy")],
    migration: [
      command("run", "--rm", "--no-deps", "database-init"),
      command("run", "--rm", "--no-deps", "database-verify"),
    ],
    preflight: [],
    pull: [command("--profile", "dev-smoke", "pull", "--policy", "always")],
    "smoke-delete": [
      command(
        "--profile",
        "dev-smoke",
        "run",
        "--rm",
        "--no-deps",
        "database-smoke",
        "deletion",
      ),
    ],
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
    "smoke-owner": [
      command(
        "--profile",
        "dev-smoke",
        "run",
        "--rm",
        "--no-deps",
        "database-smoke",
        "owner",
      ),
    ],
    "smoke-safety": [
      command(
        "--profile",
        "dev-smoke",
        "run",
        "--rm",
        "--no-deps",
        "database-smoke",
        "safety",
      ),
    ],
    "stateful-ready": [
      command(
        "up",
        "-d",
        "--wait",
        "--wait-timeout",
        "90",
        "postgres",
        "redis",
        "dependency-stub",
      ),
    ],
    "tls-ingress": [
      command(
        "up",
        "-d",
        "--no-deps",
        "--wait",
        "--wait-timeout",
        "90",
        "tls-proxy",
      ),
    ],
    "worker-background": [
      command(
        "up",
        "-d",
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
      command(
        "up",
        "-d",
        "--no-deps",
        "--wait",
        "--wait-timeout",
        "90",
        "worker-interactive",
      ),
    ],
    "worker-restricted": [
      command(
        "up",
        "-d",
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
    timeout: 180_000,
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
    `${receipt.operation}-${receipt.release_id}.json`,
  );
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, contents, { flag: "wx", mode: 0o600 });
  await rename(temporary, file);
}

async function runPhases({
  bundleRoot,
  environmentFile,
  runner,
  secretEnvironment,
}) {
  const commands = developmentDeploymentCommands(bundleRoot, environmentFile);
  const receipts = [];
  for (const phase of deploymentPhases) {
    for (const command of commands[phase]) {
      const result = await runner(command, {
        cwd: bundleRoot,
        environment: command.executable === "docker" ? secretEnvironment : {},
      });
      if (result.error || result.code !== 0) {
        fail("E012_DEPLOY_PHASE_FAILED", phase);
      }
    }
    receipts.push({ phase, result: "PASS" });
  }
  validateDeploymentReceipts(receipts);
  return receipts;
}

export async function executeDevelopmentDeployment({
  bundleRoot,
  imageSet,
  manifest,
  operation = "deploy",
  preflight = runDevelopmentPreflight,
  runner = runCommand,
  runtimeEvidence,
  secretEnvironmentLoader = loadDevelopmentComposeSecretEnvironment,
  stateRoot = STATE_ROOT,
}) {
  if (!["deploy", "rollback"].includes(operation)) {
    fail("E012_DEPLOY_OPERATION_INVALID", operation);
  }
  return withReleaseLock(
    stateRoot,
    `${operation}:${manifest.release_id}`,
    async () => {
      const state = await readReleaseState(stateRoot);
      if (operation === "deploy" && state !== null) {
        const current = await loadReleaseManifest(stateRoot, state.current);
        if (current.release_id === manifest.release_id) {
          if (
            releaseManifestDigest(current) !== releaseManifestDigest(manifest)
          ) {
            fail("RELEASE_ID_CONTENT_DRIFT", manifest.release_id);
          }
          await preflight(manifest, imageSet, runtimeEvidence);
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
      await writeExact(environmentFile, renderComposeEnvironment(manifest));
      await preflight(manifest, imageSet, runtimeEvidence);
      const secretEnvironment = await secretEnvironmentLoader(manifest);
      const receipts = await runPhases({
        bundleRoot,
        environmentFile,
        runner,
        secretEnvironment,
      });
      const committed =
        operation === "deploy"
          ? await commitSuccessfulDeployment(stateRoot, manifest)
          : await commitSuccessfulRollback(stateRoot);
      await persistReceipt(stateRoot, {
        completed_at_utc: new Date().toISOString(),
        manifest_sha256: releaseManifestDigest(manifest),
        operation,
        release_id: manifest.release_id,
        receipts,
        status: "PASS",
      });
      return Object.freeze({
        idempotent: committed.idempotent ?? false,
        receipts,
      });
    },
  );
}

async function main() {
  const [operation, manifestFile, imageSetFile, runtimeFile] =
    process.argv.slice(2);
  if (!operation || !manifestFile || !imageSetFile || !runtimeFile) {
    fail(
      "E012_DEPLOY_USAGE",
      "deploy|rollback manifest image-set runtime-evidence",
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
