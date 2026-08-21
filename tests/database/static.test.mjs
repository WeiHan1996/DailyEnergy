#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertMigrationChecksumManifest,
  assertNoDbPush,
  assertSqlIdCoverage,
  expectedSchemaObjects,
  listMigrations,
  migrationChecksums,
} from "../../tooling/database/lib.mjs";

const root = path.resolve(".");
const migrationFile = path.join(
  root,
  "prisma/migrations/20260730000000_initial_application_schema/migration.sql",
);
const bootstrapFile = path.join(root, "tooling/database/bootstrap.mjs");

async function copyMigrationHistory(targetRoot) {
  const sourceRoot = path.join(root, "prisma/migrations");
  const migrations = await listMigrations(sourceRoot);
  for (const migration of migrations) {
    const targetDirectory = path.join(targetRoot, migration.name);
    await mkdir(targetDirectory);
    await copyFile(migration.file, path.join(targetDirectory, "migration.sql"));
  }
  return path.join(targetRoot, migrations[0].name, "migration.sql");
}

test("T-DB-STATIC-001 initial migration covers the accepted structure and SQL IDs", async () => {
  const sql = await readFile(migrationFile, "utf8");
  assert.equal((sql.match(/^CREATE TABLE/gmu) || []).length, 70);
  assert.equal((sql.match(/^CREATE TYPE/gmu) || []).length, 35);
  assertSqlIdCoverage(sql);
  const objects = expectedSchemaObjects(sql);
  assert.equal(objects.tables.size, 70);
  assert.equal(objects.enums.size, 35);
  assert.ok(objects.indexes.size > 100);
  assert.ok(objects.constraints.size > 100);
  assert.ok(objects.triggers.size >= 10);
  assert.ok(objects.functions.size >= 5);
  const bootstrap = await readFile(bootstrapFile, "utf8");
  assert.match(
    bootstrap,
    /CREATE SCHEMA IF NOT EXISTS.*AUTHORIZATION.*DATABASE_OWNER_ROLE/su,
  );
  assert.match(bootstrap, /CREATE ROLE.*NOLOGIN.*NOINHERIT/su);
});

test("T-DB-STATIC-002 db push gate rejects unsafe commands", () => {
  for (const knownFail of [
    "prisma db push",
    "pnpm prisma db push --force-reset",
    '"db:push": "prisma db push"',
    "npx prisma\\s+db\\s+push",
    "yarn prisma db push && start-api",
  ]) {
    assert.throws(() => assertNoDbPush(knownFail), /DB_PUSH_FORBIDDEN/u);
  }
  assert.doesNotThrow(() => assertNoDbPush("prisma migrate deploy"));
});

test("T-DB-STATIC-003 migration checksum changes on mutation", async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "daily-energy-migration-"),
  );
  try {
    const target = await copyMigrationHistory(temporaryRoot);
    const before = await migrationChecksums(temporaryRoot);
    await writeFile(
      target,
      `${await readFile(target, "utf8")}\n-- synthetic checksum mutation\n`,
    );
    const after = await migrationChecksums(temporaryRoot);
    assert.notEqual(before[0].sha256, after[0].sha256);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("T-DB-STATIC-004 checksum manifest gate rejects a changed migration", async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "daily-energy-checksum-gate-"),
  );
  try {
    const target = await copyMigrationHistory(temporaryRoot);
    const manifestPath = path.join(temporaryRoot, "checksums.json");
    await copyFile(
      path.join(root, "prisma/migrations/checksums.json"),
      manifestPath,
    );
    await assertMigrationChecksumManifest({
      directory: temporaryRoot,
      manifestPath,
    });
    await writeFile(
      target,
      `${await readFile(target, "utf8")}\n-- synthetic checksum mutation\n`,
    );
    await assert.rejects(
      assertMigrationChecksumManifest({
        directory: temporaryRoot,
        manifestPath,
      }),
      /DB_MIGRATION_CHECKSUM_MISMATCH/u,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
