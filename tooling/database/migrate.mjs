#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  assertMigrationLogin,
  assertMigrationChecksumManifest,
  assumeDatabaseOwner,
  DATABASE_OWNER_ROLE,
  MIGRATION_CHECKSUM_MANIFEST,
  withClient,
} from "./lib.mjs";
import { redactSensitiveDiagnosticOutput } from "../lib/sensitive-redaction.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DB_DATABASE_URL_REQUIRED");
}
const prismaBin =
  process.env.PRISMA_BIN || path.resolve("node_modules/.bin/prisma");
const advisoryKey = 768_006;
const manifestPath = process.env.DB_MIGRATION_CHECKSUM_MANIFEST
  ? path.resolve(process.env.DB_MIGRATION_CHECKSUM_MANIFEST)
  : MIGRATION_CHECKSUM_MANIFEST;
const expectedMigrations = await assertMigrationChecksumManifest({
  manifestPath,
});

await withClient(connectionString, async (client) => {
  await assertMigrationLogin(client);
  await assumeDatabaseOwner(client);
  const acquired = await client.query(
    "SELECT pg_try_advisory_lock($1) AS acquired",
    [advisoryKey],
  );
  if (!acquired.rows[0]?.acquired) {
    throw new Error("DB_MIGRATION_LOCKED");
  }
  try {
    const prismaUrl = new URL(connectionString);
    prismaUrl.searchParams.set("schema", "daily_energy");
    prismaUrl.searchParams.set(
      "options",
      `-c lock_timeout=5s -c statement_timeout=5min -c role=${DATABASE_OWNER_ROLE}`,
    );
    const result = spawnSync(prismaBin, ["migrate", "deploy"], {
      cwd: path.resolve("."),
      env: {
        ...process.env,
        DATABASE_URL: prismaUrl.toString(),
        PGOPTIONS: `-c lock_timeout=5s -c statement_timeout=5min -c role=${DATABASE_OWNER_ROLE}`,
      },
      encoding: "utf8",
    });
    if (result.status !== 0) {
      process.stderr.write(redactSensitiveDiagnosticOutput(result.stderr));
      throw new Error("DB_MIGRATION_DEPLOY_FAILED");
    }
    const applied = await client.query(
      "SELECT migration_name, checksum, finished_at, rolled_back_at FROM daily_energy._prisma_migrations ORDER BY migration_name",
    );
    if (applied.rows.length !== expectedMigrations.length) {
      throw new Error("DB_MIGRATION_HISTORY_UNEXPECTED");
    }
    for (const migration of expectedMigrations) {
      const row = applied.rows.find(
        (candidate) => candidate.migration_name === migration.name,
      );
      if (
        !row ||
        row.checksum !== migration.sha256 ||
        !row.finished_at ||
        row.rolled_back_at
      ) {
        throw new Error(`DB_MIGRATION_HISTORY_MISMATCH:${migration.name}`);
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [advisoryKey]);
  }
});
console.log("DB_MIGRATION_DEPLOY_OK");
