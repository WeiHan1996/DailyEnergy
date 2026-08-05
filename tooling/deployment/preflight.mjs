import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath, statfs } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  assertSecretVersionsActive,
  validateReleaseManifest,
} from "./release-contract.mjs";
import { validateManifestRuntimeEvidence } from "./image-set.mjs";

const execFileAsync = promisify(execFile);
const DEVELOPMENT_ROOT = "/srv/dailyenergy";
const GIBIBYTE = 1024 ** 3;
const MINIMUM_COMPOSE_VERSION = [2, 40, 0];
const MINIMUM_DOCKER_VERSION = [29, 0, 0];
const MINIMUM_UBUNTU_VERSION = [24, 4];
const PROTECTED_PORTS = new Set([80, 443, 5432, 6379, 8443, 8444]);

export const SECRET_FILE_NAMES = Object.freeze({
  cos_secret_id: "cos-secret-id",
  cos_secret_key: "cos-secret-key",
  database_admin_url: "database-admin-url",
  database_api_url: "database-api-url",
  database_background_url: "database-background-url",
  database_interactive_url: "database-interactive-url",
  database_migration_url: "database-migration-url",
  database_restricted_url: "database-restricted-url",
  fault_control_token: "fault-control-token",
  postgres_password: "postgres-password",
});

const COS_CONFIG_KEYS = Object.freeze([
  "COS_BUCKET",
  "COS_ENDPOINT",
  "COS_PREFIX",
  "COS_REGION",
]);

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeConfigValue(raw, key) {
  if (raw.length === 0 || /[\0\r\n]/u.test(raw)) {
    fail("PREFLIGHT_COS_CONFIG_VALUE", key);
  }
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    const value = raw.slice(1, -1);
    if (value.length === 0 || /["'`$\\]/u.test(value)) {
      fail("PREFLIGHT_COS_CONFIG_VALUE", key);
    }
    return value;
  }
  if (/\s|[#'"`$\\]/u.test(raw)) {
    fail("PREFLIGHT_COS_CONFIG_VALUE", key);
  }
  return raw;
}

function parseCosConfig(source) {
  const values = {};
  for (const line of source.split("\n")) {
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (match === null) {
      fail("PREFLIGHT_COS_CONFIG_SYNTAX", "line");
    }
    const [, key, raw] = match;
    if (Object.hasOwn(values, key)) {
      fail("PREFLIGHT_COS_CONFIG_DUPLICATE", key);
    }
    values[key] = decodeConfigValue(raw, key);
  }
  exactKeys(values, COS_CONFIG_KEYS, "PREFLIGHT_COS_CONFIG_KEYS");
  return values;
}

export function createCosConfigEvidence(source) {
  const values = parseCosConfig(source);
  if (!/^[a-z0-9][a-z0-9-]{1,52}-[0-9]{5,12}$/u.test(values.COS_BUCKET)) {
    fail("PREFLIGHT_COS_BUCKET", "shape");
  }
  if (
    values.COS_REGION !== "ap-shanghai" ||
    values.COS_PREFIX !== "dev/objects/"
  ) {
    fail("PREFLIGHT_COS_SCOPE", "region-or-prefix");
  }
  if (
    values.COS_ENDPOINT !==
    `${values.COS_BUCKET}.cos-internal.${values.COS_REGION}.tencentcos.cn`
  ) {
    fail("PREFLIGHT_COS_ENDPOINT", "private-internal");
  }
  return Object.freeze({
    config_sha256: sha256(source),
    endpoint_class: "TENCENT_COS_PRIVATE_INTERNAL",
    keys: COS_CONFIG_KEYS,
    prefix: "dev/objects/",
    region: "ap-shanghai",
  });
}

function versionParts(value, ruleId) {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?/u.exec(value);
  if (match === null) {
    fail(ruleId, "version");
  }
  return match.slice(1, 4).map((part) => Number(part ?? "0"));
}

function versionAtLeast(value, minimum, ruleId) {
  const actual = versionParts(value, ruleId);
  for (const [index, expected] of minimum.entries()) {
    if (actual[index] > expected) {
      return true;
    }
    if (actual[index] < expected) {
      return false;
    }
  }
  return true;
}

function validateSecretVersions(manifest) {
  const versions = manifest.config.secret_ref_versions;
  if (versions.cos_secret_id !== versions.cos_secret_key) {
    fail("PREFLIGHT_COS_SECRET_VERSION_SPLIT", "cos-credential");
  }
}

function validateHostEvidence(host) {
  exactKeys(
    host,
    [
      "architecture",
      "compose_version",
      "cpu_count",
      "disk_free_bytes",
      "deployment_node_version",
      "docker_version",
      "non_loopback_protected_ports",
      "ntp_synchronized",
      "os_id",
      "os_version",
      "run_uid",
      "timezone",
      "total_memory_bytes",
    ],
    "PREFLIGHT_HOST_EVIDENCE_KEYS",
  );
  if (
    host.run_uid !== 0 ||
    host.os_id !== "ubuntu" ||
    host.architecture !== "x86_64" ||
    !versionAtLeast(
      host.os_version,
      MINIMUM_UBUNTU_VERSION,
      "PREFLIGHT_OS_VERSION",
    ) ||
    host.timezone !== "Asia/Shanghai" ||
    host.ntp_synchronized !== true
  ) {
    fail("PREFLIGHT_HOST_BASELINE", "os-time-or-owner");
  }
  if (host.deployment_node_version !== "24.18.0") {
    fail("PREFLIGHT_DEPLOYMENT_NODE_VERSION", "node");
  }
  if (
    !Number.isSafeInteger(host.cpu_count) ||
    host.cpu_count < 4 ||
    !Number.isSafeInteger(host.total_memory_bytes) ||
    host.total_memory_bytes < 7 * GIBIBYTE ||
    !Number.isSafeInteger(host.disk_free_bytes) ||
    host.disk_free_bytes < 20 * GIBIBYTE
  ) {
    fail("PREFLIGHT_HOST_CAPACITY", "cpu-memory-or-disk");
  }
  if (
    !versionAtLeast(
      host.docker_version,
      MINIMUM_DOCKER_VERSION,
      "PREFLIGHT_DOCKER_VERSION",
    ) ||
    !versionAtLeast(
      host.compose_version,
      MINIMUM_COMPOSE_VERSION,
      "PREFLIGHT_COMPOSE_VERSION",
    )
  ) {
    fail("PREFLIGHT_CONTAINER_RUNTIME", "docker-or-compose");
  }
  if (
    !Array.isArray(host.non_loopback_protected_ports) ||
    host.non_loopback_protected_ports.length !== 0
  ) {
    fail("PREFLIGHT_PUBLIC_PORT_EXPOSURE", "protected-port");
  }
}

function validateFileEvidence(files, manifest) {
  exactKeys(
    files,
    ["config", "directories", "secrets"],
    "PREFLIGHT_FILE_EVIDENCE_KEYS",
  );
  exactKeys(
    files.config,
    [
      "config_sha256",
      "endpoint_class",
      "keys",
      "prefix",
      "protection",
      "region",
      "role",
    ],
    "PREFLIGHT_COS_CONFIG_EVIDENCE_KEYS",
  );
  if (
    files.config.protection !== "ROOT_0600_REGULAR" ||
    files.config.config_sha256 !==
      manifest.config.runtime_fingerprints.object_config ||
    files.config.endpoint_class !== manifest.topology.object_endpoint ||
    files.config.region !== manifest.topology.object_region ||
    files.config.prefix !== manifest.topology.object_prefix ||
    JSON.stringify(files.config.keys) !== JSON.stringify(COS_CONFIG_KEYS)
  ) {
    fail("PREFLIGHT_COS_CONFIG_DRIFT", "object-config");
  }
  const expectedRoles = Object.keys(SECRET_FILE_NAMES).sort();
  const actualRoles = files.secrets.map(({ role }) => role).sort();
  if (JSON.stringify(actualRoles) !== JSON.stringify(expectedRoles)) {
    fail("PREFLIGHT_SECRET_FILE_SET", "roles");
  }
  if (
    files.secrets.some((secret) => {
      exactKeys(
        secret,
        ["content_status", "protection", "role"],
        "PREFLIGHT_SECRET_FILE_EVIDENCE_KEYS",
      );
      return (
        secret.protection !== "ROOT_0600_REGULAR" ||
        secret.content_status !== "PRESENT_SINGLE_LINE"
      );
    })
  ) {
    fail("PREFLIGHT_SECRET_FILE_INVALID", "metadata-or-content");
  }
  const expectedDirectories = [
    "config",
    "root",
    "secrets",
    ...[...new Set(Object.values(manifest.config.secret_ref_versions))].map(
      (version) => `secret-version:${version}`,
    ),
  ].sort();
  const actualDirectories = files.directories
    .map((directory) => directory.role)
    .sort();
  if (
    !Array.isArray(files.directories) ||
    JSON.stringify(actualDirectories) !== JSON.stringify(expectedDirectories) ||
    files.directories.some((directory) => {
      exactKeys(
        directory,
        ["protection", "role"],
        "PREFLIGHT_DIRECTORY_EVIDENCE_KEYS",
      );
      return directory.protection !== "ROOT_NOT_WRITABLE_BY_OTHERS";
    })
  ) {
    fail("PREFLIGHT_SECRET_DIRECTORY_INVALID", "metadata");
  }
}

export function validateDevelopmentPreflightEvidence({
  files,
  host,
  imageSet,
  manifest,
  revokedSecretVersions = [],
  runtimeEvidence,
}) {
  validateReleaseManifest(manifest);
  validateManifestRuntimeEvidence(manifest, imageSet, runtimeEvidence);
  validateSecretVersions(manifest);
  assertSecretVersionsActive(manifest, revokedSecretVersions);
  validateFileEvidence(files, manifest);
  validateHostEvidence(host);
  return Object.freeze({
    checks: {
      capacity: "PASS",
      cos_config: "PASS",
      host_baseline: "PASS",
      network_exposure: "PASS",
      secret_files: "PASS",
    },
    gate: "E012_DEV_PREFLIGHT",
    release_id: manifest.release_id,
    status: "PASS",
  });
}

async function protectedDirectoryEvidence(directory, role) {
  let metadata;
  try {
    metadata = await lstat(directory);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("PREFLIGHT_DIRECTORY_MISSING", role);
    }
    throw error;
  }
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o022) !== 0
  ) {
    fail("PREFLIGHT_DIRECTORY_PROTECTION", role);
  }
  return {
    protection: "ROOT_NOT_WRITABLE_BY_OTHERS",
    role,
  };
}

async function protectedFile(directory, fileName, role, kind) {
  const file = path.join(directory, fileName);
  let metadata;
  try {
    metadata = await lstat(file);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("PREFLIGHT_FILE_MISSING", role);
    }
    throw error;
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600 ||
    metadata.nlink !== 1 ||
    metadata.size < 1 ||
    metadata.size > (kind === "config" ? 4096 : 8192)
  ) {
    fail("PREFLIGHT_FILE_PROTECTION", role);
  }
  if ((await realpath(file)) !== file) {
    fail("PREFLIGHT_FILE_REALPATH", role);
  }
  const contents = await readFile(file, "utf8");
  if (kind === "config") {
    return {
      ...createCosConfigEvidence(contents),
      protection: "ROOT_0600_REGULAR",
      role,
    };
  }
  const value = contents.endsWith("\n") ? contents.slice(0, -1) : contents;
  if (value.length < 1 || value.length > 4096 || /[\0\r\n]/u.test(value)) {
    fail("PREFLIGHT_SECRET_CONTENT", role);
  }
  return {
    content_status: "PRESENT_SINGLE_LINE",
    protection: "ROOT_0600_REGULAR",
    role,
  };
}

async function commandOutput(command, args, role) {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8",
      maxBuffer: 128 * 1024,
      timeout: 10_000,
    });
    return result.stdout.trim();
  } catch {
    fail("PREFLIGHT_HOST_PROBE_FAILED", role);
  }
}

function parseOsRelease(source) {
  const values = {};
  for (const line of source.split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (match === null) {
      continue;
    }
    const [, key, raw] = match;
    values[key] = raw.replace(/^"|"$/gu, "");
  }
  return values;
}

function nonLoopbackProtectedPorts(source) {
  const ports = new Set();
  for (const line of source.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    const fields = line.trim().split(/\s+/u);
    const local = fields[3] ?? "";
    const portMatch = /:(\d+)$/u.exec(local);
    if (portMatch === null) {
      continue;
    }
    const port = Number(portMatch[1]);
    if (!PROTECTED_PORTS.has(port)) {
      continue;
    }
    if (
      !local.startsWith("127.") &&
      !local.startsWith("[::1]:") &&
      !local.startsWith("::1:")
    ) {
      ports.add(port);
    }
  }
  return [...ports].sort((left, right) => left - right);
}

async function collectHostEvidence(root) {
  const [
    osReleaseSource,
    dockerVersion,
    composeVersion,
    deploymentNodeVersion,
    ntpSynchronized,
    timezone,
    sockets,
    filesystem,
  ] = await Promise.all([
    readFile("/etc/os-release", "utf8"),
    commandOutput(
      "docker",
      ["version", "--format", "{{.Server.Version}}"],
      "docker",
    ),
    commandOutput("docker", ["compose", "version", "--short"], "compose"),
    commandOutput(
      "/opt/dailyenergy/runtime/node-v24.18.0/bin/node",
      ["--version"],
      "deployment-node",
    ),
    commandOutput(
      "timedatectl",
      ["show", "--property=NTPSynchronized", "--value"],
      "ntp",
    ),
    commandOutput(
      "timedatectl",
      ["show", "--property=Timezone", "--value"],
      "timezone",
    ),
    commandOutput("ss", ["-H", "-ltn"], "network"),
    statfs(root, { bigint: true }),
  ]);
  const osRelease = parseOsRelease(osReleaseSource);
  const freeBytes = filesystem.bavail * filesystem.bsize;
  const runUid = process.getuid?.();
  return {
    architecture: os.arch() === "x64" ? "x86_64" : os.arch(),
    compose_version: composeVersion,
    cpu_count: os.cpus().length,
    deployment_node_version: deploymentNodeVersion.replace(/^v/u, ""),
    disk_free_bytes: Number(freeBytes),
    docker_version: dockerVersion,
    non_loopback_protected_ports: nonLoopbackProtectedPorts(sockets),
    ntp_synchronized: ntpSynchronized === "yes",
    os_id: osRelease.ID,
    os_version: osRelease.VERSION_ID,
    run_uid: runUid,
    timezone,
    total_memory_bytes: os.totalmem(),
  };
}

async function collectFileEvidence(root, manifest) {
  const configDirectory = path.join(root, "config");
  const secretsDirectory = path.join(root, "secrets");
  const versions = [
    ...new Set(Object.values(manifest.config.secret_ref_versions)),
  ].sort();
  const directories = await Promise.all([
    protectedDirectoryEvidence(root, "root"),
    protectedDirectoryEvidence(configDirectory, "config"),
    protectedDirectoryEvidence(secretsDirectory, "secrets"),
    ...versions.map((version) =>
      protectedDirectoryEvidence(
        path.join(secretsDirectory, version),
        `secret-version:${version}`,
      ),
    ),
  ]);
  const config = await protectedFile(
    configDirectory,
    `${manifest.topology.object_config_ref}.env`,
    "object_config",
    "config",
  );
  const secrets = await Promise.all(
    Object.entries(SECRET_FILE_NAMES).map(([role, fileName]) =>
      protectedFile(
        path.join(secretsDirectory, manifest.config.secret_ref_versions[role]),
        fileName,
        role,
        "secret",
      ),
    ),
  );
  return { config, directories, secrets };
}

export async function runDevelopmentPreflight(
  manifest,
  imageSet,
  runtimeEvidence,
  { root = DEVELOPMENT_ROOT, revokedSecretVersions = [] } = {},
) {
  if (path.resolve(root) !== DEVELOPMENT_ROOT) {
    fail("PREFLIGHT_ROOT_INVALID", "root");
  }
  validateReleaseManifest(manifest);
  validateManifestRuntimeEvidence(manifest, imageSet, runtimeEvidence);
  validateSecretVersions(manifest);
  const [files, host] = await Promise.all([
    collectFileEvidence(root, manifest),
    collectHostEvidence(root),
  ]);
  return validateDevelopmentPreflightEvidence({
    files,
    host,
    imageSet,
    manifest,
    revokedSecretVersions,
    runtimeEvidence,
  });
}

async function main() {
  if (process.argv.length !== 5) {
    fail(
      "PREFLIGHT_USAGE",
      "release-manifest.json dev-image-set.json runtime-evidence.json",
    );
  }
  let manifest;
  let imageSet;
  let runtimeEvidence;
  try {
    [manifest, imageSet, runtimeEvidence] = await Promise.all(
      process.argv
        .slice(2)
        .map(async (file) =>
          JSON.parse(await readFile(path.resolve(file), "utf8")),
        ),
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail("PREFLIGHT_MANIFEST_JSON", "invalid");
    }
    throw error;
  }
  const report = await runDevelopmentPreflight(
    manifest,
    imageSet,
    runtimeEvidence,
  );
  process.stdout.write(`${JSON.stringify(report)}\n`);
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
