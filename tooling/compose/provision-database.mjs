#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  readConnectionString,
  RUNTIME_ROLES,
  withClient,
} from "../database/lib.mjs";

const profiles = Object.freeze([
  {
    faultable: true,
    groupRole: RUNTIME_ROLES.api,
    loginRole: "daily_energy_api_login",
    secretFile: "/run/secrets/database_api_url",
  },
  {
    faultable: true,
    groupRole: RUNTIME_ROLES.interactive,
    loginRole: "daily_energy_interactive_login",
    secretFile: "/run/secrets/database_interactive_url",
  },
  {
    faultable: true,
    groupRole: RUNTIME_ROLES.background,
    loginRole: "daily_energy_background_login",
    secretFile: "/run/secrets/database_background_url",
  },
  {
    faultable: true,
    groupRole: RUNTIME_ROLES.deletion,
    loginRole: "daily_energy_deletion_login",
    secretFile: "/run/secrets/database_restricted_url",
  },
  {
    faultable: false,
    groupRole: RUNTIME_ROLES.migration,
    loginRole: "daily_energy_migration_login",
    secretFile: "/run/secrets/database_migration_url",
  },
]);

function run(script, environment) {
  const result = spawnSync(process.execPath, [script], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`COMPOSE_DATABASE_COMMAND_FAILED:${path.basename(script)}`);
  }
  process.stdout.write(result.stdout);
}

function validateCredential(value, profile) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("COMPOSE_DATABASE_CREDENTIAL_INVALID");
  }
  const direct = url.hostname === "postgres" && url.port === "5432";
  const faultProxy =
    profile.faultable && url.hostname === "fault-proxy" && url.port === "15432";
  if (
    url.protocol !== "postgresql:" ||
    url.username !== profile.loginRole ||
    !/^[A-Za-z0-9_-]{32,128}$/u.test(url.password) ||
    (!direct && !faultProxy) ||
    url.pathname !== "/daily_energy"
  ) {
    throw new Error("COMPOSE_DATABASE_CREDENTIAL_INVALID");
  }
  return url.password;
}

const mode = process.argv[2] ?? "all";
if (!["all", "migrate", "prepare", "seed"].includes(mode)) {
  throw new Error("COMPOSE_DATABASE_MODE_INVALID");
}

if (mode === "all" || mode === "prepare") {
  const adminUrl = await readConnectionString({
    fileName: "DATABASE_ADMIN_URL_FILE",
    requiredCode: "DB_ADMIN_DATABASE_URL_REQUIRED",
    valueName: "DATABASE_ADMIN_URL",
  });

  run("tooling/database/bootstrap.mjs", {
    DATABASE_ADMIN_URL: undefined,
    DATABASE_ADMIN_URL_FILE: process.env.DATABASE_ADMIN_URL_FILE,
  });

  await withClient(adminUrl, async (client) => {
    for (const profile of profiles) {
      const credential = (await readFile(profile.secretFile, "utf8")).trim();
      const password = validateCredential(credential, profile);
      const existing = await client.query(
        "SELECT 1 FROM pg_roles WHERE rolname = $1",
        [profile.loginRole],
      );
      if (existing.rowCount === 0) {
        await client.query(
          `CREATE ROLE ${profile.loginRole} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
        );
      }
      await client.query(
        `ALTER ROLE ${profile.loginRole} PASSWORD '${password}'`,
      );
      await client.query(
        `GRANT ${profile.groupRole} TO ${profile.loginRole} WITH INHERIT TRUE, SET TRUE`,
      );
    }

    const identities = await client.query(
      `SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolbypassrls
         FROM pg_roles
        WHERE rolname = ANY($1::text[])
        ORDER BY rolname`,
      [profiles.map((profile) => profile.loginRole)],
    );
    if (
      identities.rowCount !== profiles.length ||
      identities.rows.some(
        (role) =>
          !role.rolcanlogin ||
          role.rolsuper ||
          role.rolcreatedb ||
          role.rolcreaterole ||
          !role.rolinherit ||
          role.rolbypassrls,
      )
    ) {
      throw new Error("COMPOSE_DATABASE_LOGIN_ROLE_MISMATCH");
    }
  });
}

if (mode === "all" || mode === "migrate") {
  run("tooling/database/migrate.mjs", {
    DATABASE_URL: undefined,
    DATABASE_URL_FILE: process.env.DATABASE_URL_FILE,
  });
}
if (mode === "all" || mode === "seed") {
  run("tooling/database/seed.mjs", {
    DATABASE_URL: undefined,
    DATABASE_URL_FILE: process.env.DB_SEED_DATABASE_URL_FILE,
  });
}

console.log(`COMPOSE_DATABASE_READY:${mode}`);
