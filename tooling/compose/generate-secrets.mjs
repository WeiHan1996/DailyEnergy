import { randomBytes } from "node:crypto";
import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const secretNames = Object.freeze([
  "database-admin-url",
  "database-api-url",
  "database-background-url",
  "database-interactive-url",
  "database-migration-url",
  "database-restricted-url",
  "fault-control-token",
  "postgres-password",
]);

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function password() {
  return randomBytes(32).toString("base64url");
}

function databaseUrl(username, value, fault) {
  const host = fault ? "fault-proxy:15432" : "postgres:5432";
  return `postgresql://${username}:${value}@${host}/daily_energy`;
}

export async function ensureSyntheticSecrets(directory, { fault }) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const presence = await Promise.all(
    secretNames.map((name) => exists(path.join(directory, name))),
  );
  if (presence.every(Boolean)) {
    return;
  }
  if (presence.some(Boolean)) {
    throw new Error("COMPOSE_SECRET_SET_INCOMPLETE");
  }

  const postgresPassword = password();
  const values = new Map([
    ["postgres-password", postgresPassword],
    ["database-admin-url", databaseUrl("postgres", postgresPassword, false)],
    [
      "database-api-url",
      databaseUrl("daily_energy_api_login", password(), fault),
    ],
    [
      "database-interactive-url",
      databaseUrl("daily_energy_interactive_login", password(), fault),
    ],
    [
      "database-background-url",
      databaseUrl("daily_energy_background_login", password(), fault),
    ],
    [
      "database-restricted-url",
      databaseUrl("daily_energy_deletion_login", password(), fault),
    ],
    [
      "database-migration-url",
      databaseUrl("daily_energy_migration_login", password(), false),
    ],
    ["fault-control-token", password()],
  ]);

  await Promise.all(
    [...values].map(([name, value]) =>
      writeFile(path.join(directory, name), `${value}\n`, {
        flag: "wx",
        mode: 0o600,
      }),
    ),
  );
}

export async function readFaultToken(directory) {
  return (
    await readFile(path.join(directory, "fault-control-token"), "utf8")
  ).trim();
}

export const composeSecretNames = secretNames;
