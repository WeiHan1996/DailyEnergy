#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEVELOPMENT_ROOT = "/srv/dailyenergy";
const DEVELOPMENT_SECRET_VERSION = "dev-secret-v1";
const DATABASE_NAME = "daily_energy";
const DATABASE_HOST = "postgres";
const DATABASE_PORT = "5432";
const VALUE = /^[A-Za-z0-9_-]{32,128}$/u;

const databaseProfiles = Object.freeze([
  ["database-admin-url", "postgres"],
  ["database-api-url", "daily_energy_api_login"],
  ["database-background-url", "daily_energy_background_login"],
  ["database-interactive-url", "daily_energy_interactive_login"],
  ["database-migration-url", "daily_energy_migration_login"],
  ["database-restricted-url", "daily_energy_deletion_login"],
]);

export const developmentSecretFileNames = Object.freeze(
  [
    ...databaseProfiles.map(([fileName]) => fileName),
    "fault-control-token",
    "postgres-password",
  ].sort(),
);

function fail(code) {
  throw new Error(code);
}

function secretValue() {
  return randomBytes(32).toString("base64url");
}

function databaseUrl(username, password) {
  return `postgresql://${username}:${password}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;
}

function validateDatabaseUrl(source, expectedUsername) {
  let value;
  try {
    value = new URL(source);
  } catch {
    fail("E012_DEV_SECRET_DATABASE_URL_INVALID");
  }
  if (
    value.protocol !== "postgresql:" ||
    value.username !== expectedUsername ||
    !VALUE.test(value.password) ||
    value.hostname !== DATABASE_HOST ||
    value.port !== DATABASE_PORT ||
    value.pathname !== `/${DATABASE_NAME}` ||
    value.search !== "" ||
    value.hash !== ""
  ) {
    fail("E012_DEV_SECRET_DATABASE_URL_INVALID");
  }
  return value.password;
}

async function validateDirectory(directory, expectedUid, expectedGid) {
  const metadata = await lstat(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== expectedUid ||
    metadata.gid !== expectedGid ||
    (metadata.mode & 0o777) !== 0o700
  ) {
    fail("E012_DEV_SECRET_DIRECTORY_INVALID");
  }
}

async function validateProtectedParent(directory, expectedUid, expectedGid) {
  const metadata = await lstat(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== expectedUid ||
    metadata.gid !== expectedGid ||
    (metadata.mode & 0o022) !== 0
  ) {
    fail("E012_DEV_SECRET_PARENT_INVALID");
  }
}

async function validateSecretFile(file, expectedUid, expectedGid) {
  const metadata = await lstat(file);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1 ||
    metadata.uid !== expectedUid ||
    metadata.gid !== expectedGid ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    fail("E012_DEV_SECRET_FILE_INVALID");
  }
  const source = await readFile(file, "utf8");
  if (!source.endsWith("\n") || source.slice(0, -1).includes("\n")) {
    fail("E012_DEV_SECRET_FILE_CONTENT_INVALID");
  }
  return source.slice(0, -1);
}

async function validateCompleteSet(directory, expectedUid, expectedGid) {
  await validateDirectory(directory, expectedUid, expectedGid);
  const entries = (await readdir(directory)).sort();
  if (JSON.stringify(entries) !== JSON.stringify(developmentSecretFileNames)) {
    fail("E012_DEV_SECRET_SET_INCOMPLETE");
  }
  const values = new Map(
    await Promise.all(
      developmentSecretFileNames.map(async (fileName) => [
        fileName,
        await validateSecretFile(
          path.join(directory, fileName),
          expectedUid,
          expectedGid,
        ),
      ]),
    ),
  );
  const postgresPassword = values.get("postgres-password");
  if (!VALUE.test(postgresPassword)) {
    fail("E012_DEV_SECRET_VALUE_INVALID");
  }
  for (const [fileName, username] of databaseProfiles) {
    const password = validateDatabaseUrl(values.get(fileName), username);
    if (fileName === "database-admin-url" && password !== postgresPassword) {
      fail("E012_DEV_SECRET_ADMIN_PASSWORD_MISMATCH");
    }
  }
  if (!VALUE.test(values.get("fault-control-token"))) {
    fail("E012_DEV_SECRET_VALUE_INVALID");
  }
}

export async function provisionDevelopmentSecrets({
  expectedGid = process.getgid?.(),
  expectedUid = process.getuid?.(),
  root = DEVELOPMENT_ROOT,
  version = DEVELOPMENT_SECRET_VERSION,
} = {}) {
  if (!Number.isInteger(expectedUid) || !Number.isInteger(expectedGid)) {
    fail("E012_DEV_SECRET_OWNER_UNAVAILABLE");
  }
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(version)) {
    fail("E012_DEV_SECRET_VERSION_INVALID");
  }
  const secretsRoot = path.join(root, "secrets");
  await validateProtectedParent(root, expectedUid, expectedGid);
  await validateProtectedParent(secretsRoot, expectedUid, expectedGid);
  const directory = path.join(secretsRoot, version);
  try {
    await mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }
  await validateDirectory(directory, expectedUid, expectedGid);
  const existing = await readdir(directory);
  if (existing.length > 0) {
    await validateCompleteSet(directory, expectedUid, expectedGid);
    return Object.freeze({
      files: developmentSecretFileNames.length,
      status: "UNCHANGED",
    });
  }

  const postgresPassword = secretValue();
  const values = new Map([
    ["postgres-password", postgresPassword],
    ["database-admin-url", databaseUrl("postgres", postgresPassword)],
    ["database-api-url", databaseUrl("daily_energy_api_login", secretValue())],
    [
      "database-background-url",
      databaseUrl("daily_energy_background_login", secretValue()),
    ],
    [
      "database-interactive-url",
      databaseUrl("daily_energy_interactive_login", secretValue()),
    ],
    [
      "database-migration-url",
      databaseUrl("daily_energy_migration_login", secretValue()),
    ],
    [
      "database-restricted-url",
      databaseUrl("daily_energy_deletion_login", secretValue()),
    ],
    ["fault-control-token", secretValue()],
  ]);
  await Promise.all(
    [...values].map(([fileName, value]) =>
      writeFile(path.join(directory, fileName), `${value}\n`, {
        flag: "wx",
        mode: 0o600,
      }),
    ),
  );
  await validateCompleteSet(directory, expectedUid, expectedGid);
  return Object.freeze({
    files: developmentSecretFileNames.length,
    status: "CREATED",
  });
}

async function main() {
  if (process.getuid?.() !== 0 || process.argv.length !== 2) {
    fail("E012_DEV_SECRET_PROVISION_USAGE");
  }
  const result = await provisionDevelopmentSecrets();
  process.stdout.write(
    `E012_DEV_SECRETS_OK:status=${result.status}:files=${result.files}:version=${DEVELOPMENT_SECRET_VERSION}\n`,
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
