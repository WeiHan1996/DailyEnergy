import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);
const requireFromRoot = createRequire(
  new URL("../../package.json", import.meta.url),
);

export const APPLICATION_SCHEMA = "daily_energy";
export const MIGRATIONS_DIRECTORY = path.join(
  repositoryRoot,
  "prisma/migrations",
);
export const MIGRATION_CHECKSUM_MANIFEST = path.join(
  MIGRATIONS_DIRECTORY,
  "checksums.json",
);
export const EXPECTED_SQL_IDS = Array.from(
  { length: 20 },
  (_, index) => `SQL-${String(index + 1).padStart(3, "0")}`,
);
export const RUNTIME_ROLES = Object.freeze({
  api: "daily_energy_api",
  interactive: "daily_energy_interactive",
  background: "daily_energy_background",
  restricted: "daily_energy_restricted",
  migration: "daily_energy_migration",
  test: "daily_energy_test",
});

export async function listMigrations(directory = MIGRATIONS_DIRECTORY) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isDirectory() && /^\d{14}_[a-z0-9_]+$/.test(entry.name),
    )
    .map((entry) => ({
      name: entry.name,
      file: path.join(directory, entry.name, "migration.sql"),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function migrationChecksums(directory = MIGRATIONS_DIRECTORY) {
  const migrations = await listMigrations(directory);
  return Promise.all(
    migrations.map(async ({ name, file }) => {
      const contents = await readFile(file);
      return {
        name,
        sha256: createHash("sha256").update(contents).digest("hex"),
      };
    }),
  );
}

export async function assertMigrationChecksumManifest({
  directory = MIGRATIONS_DIRECTORY,
  manifestPath = MIGRATION_CHECKSUM_MANIFEST,
} = {}) {
  const expected = JSON.parse(await readFile(manifestPath, "utf8"));
  if (expected.algorithm !== "sha256" || !Array.isArray(expected.migrations)) {
    throw new Error("DB_MIGRATION_CHECKSUM_MANIFEST_INVALID");
  }
  const actual = await migrationChecksums(directory);
  if (JSON.stringify(expected.migrations) !== JSON.stringify(actual)) {
    throw new Error("DB_MIGRATION_CHECKSUM_MISMATCH");
  }
  return actual;
}

export function assertSqlIdCoverage(sql) {
  const missing = EXPECTED_SQL_IDS.filter(
    (sourceId) => !sql.includes(sourceId),
  );
  if (missing.length > 0) {
    throw new Error(`DB_SQL_ID_MISSING:${missing.join(",")}`);
  }
}

export function assertNoDbPush(command) {
  const normalized = command
    .replace(/\\s\+/gu, " ")
    .replace(/["'`]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (
    /(^|[;&|\s])(?:pnpm|npm|npx|yarn|bunx)?\s*prisma\s+db\s+push(?:\s|$)/iu.test(
      normalized,
    )
  ) {
    throw new Error("DB_PUSH_FORBIDDEN");
  }
}

function matches(sql, expression) {
  return new Set(Array.from(sql.matchAll(expression), (match) => match[1]));
}

function expectedTriggerNames(sql) {
  const names = matches(sql, /^CREATE (?:CONSTRAINT )?TRIGGER "([^"]+)"/gmu);
  const generated = sql.match(
    /FOREACH table_name IN ARRAY ARRAY\[([\s\S]*?)\][\s\S]*?left\('([^']+)' \|\| table_name \|\| '([^']+)', 63\)/u,
  );
  if (generated) {
    const [, list, prefix, suffix] = generated;
    for (const match of list.matchAll(/'([^']+)'/gu)) {
      names.add(`${prefix}${match[1]}${suffix}`.slice(0, 63));
    }
  }
  return names;
}

export function expectedSchemaObjects(sql) {
  return {
    tables: matches(sql, /^CREATE TABLE "([^"]+)"/gmu),
    enums: matches(sql, /^CREATE TYPE "([^"]+)" AS ENUM/gmu),
    indexes: matches(sql, /^CREATE (?:UNIQUE )?INDEX "([^"]+)"/gmu),
    constraints: matches(sql, /(?:CONSTRAINT|ADD CONSTRAINT) "([^"]+)"/gu),
    triggers: expectedTriggerNames(sql),
    functions: matches(
      sql,
      /^CREATE OR REPLACE FUNCTION "daily_energy"\."([^"]+)"/gmu,
    ),
  };
}

export function assertExactNames(kind, expected, actual) {
  const missing = [...expected].filter((name) => !actual.has(name));
  const unexpected = [...actual].filter((name) => !expected.has(name));
  if (missing.length || unexpected.length) {
    throw new Error(
      `DB_DRIFT_${kind.toUpperCase()}:missing=${missing.join(",")}:unexpected=${unexpected.join(",")}`,
    );
  }
}

export async function importPg() {
  try {
    return requireFromRoot("pg");
  } catch {
    try {
      return requireFromRoot("./node_modules/.pnpm/pg@8.22.0/node_modules/pg");
    } catch {
      throw new Error(
        "DB_DRIVER_MISSING: install the pinned pg dependency before running database integration",
      );
    }
  }
}

export async function withClient(connectionString, callback) {
  const { Client } = await importPg();
  const client = new Client({
    connectionString,
    application_name: "daily-energy-e006",
  });
  await client.connect();
  try {
    await client.query("SET TIME ZONE 'UTC'");
    return await callback(client);
  } finally {
    await client.end();
  }
}
