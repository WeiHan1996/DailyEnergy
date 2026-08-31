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
  migrationChecksums,
} from "../../tooling/database/lib.mjs";

const root = path.resolve(".");
const migrationFile = path.join(
  root,
  "prisma/migrations/20260730000000_initial_application_schema/migration.sql",
);
const bootstrapFile = path.join(root, "tooling/database/bootstrap.mjs");

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
    const targetDirectory = path.join(
      temporaryRoot,
      "20260730000000_initial_application_schema",
    );
    await mkdir(targetDirectory);
    const upgradeDirectory = path.join(
      temporaryRoot,
      "20260731000000_owner_upgrade_probe",
    );
    await mkdir(upgradeDirectory);
    const securityDirectory = path.join(
      temporaryRoot,
      "20260731000001_security_fixes_sql007_sql013_roles",
    );
    await mkdir(securityDirectory);
    const queueDirectory = path.join(
      temporaryRoot,
      "20260802000000_e007_queue_inbox_permissions",
    );
    await mkdir(queueDirectory);
    const authDirectory = path.join(
      temporaryRoot,
      "20260819000000_c001_auth_column_permissions",
    );
    await mkdir(authDirectory);
    const consentProfileDirectory = path.join(
      temporaryRoot,
      "20260820000000_c002_consent_profile_permissions",
    );
    await mkdir(consentProfileDirectory);
    const checkinDirectory = path.join(
      temporaryRoot,
      "20260821000000_c004_checkin_guard",
    );
    await mkdir(checkinDirectory);
    const target = path.join(targetDirectory, "migration.sql");
    await copyFile(migrationFile, target);
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260731000000_owner_upgrade_probe/migration.sql",
      ),
      path.join(upgradeDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260731000001_security_fixes_sql007_sql013_roles/migration.sql",
      ),
      path.join(securityDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260802000000_e007_queue_inbox_permissions/migration.sql",
      ),
      path.join(queueDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260819000000_c001_auth_column_permissions/migration.sql",
      ),
      path.join(authDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260820000000_c002_consent_profile_permissions/migration.sql",
      ),
      path.join(consentProfileDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260821000000_c004_checkin_guard/migration.sql",
      ),
      path.join(checkinDirectory, "migration.sql"),
    );
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
    const targetDirectory = path.join(
      temporaryRoot,
      "20260730000000_initial_application_schema",
    );
    await mkdir(targetDirectory);
    const upgradeDirectory = path.join(
      temporaryRoot,
      "20260731000000_owner_upgrade_probe",
    );
    await mkdir(upgradeDirectory);
    const securityDirectory = path.join(
      temporaryRoot,
      "20260731000001_security_fixes_sql007_sql013_roles",
    );
    await mkdir(securityDirectory);
    const queueDirectory = path.join(
      temporaryRoot,
      "20260802000000_e007_queue_inbox_permissions",
    );
    await mkdir(queueDirectory);
    const authDirectory = path.join(
      temporaryRoot,
      "20260819000000_c001_auth_column_permissions",
    );
    await mkdir(authDirectory);
    const consentProfileDirectory = path.join(
      temporaryRoot,
      "20260820000000_c002_consent_profile_permissions",
    );
    await mkdir(consentProfileDirectory);
    const checkinDirectory = path.join(
      temporaryRoot,
      "20260821000000_c004_checkin_guard",
    );
    await mkdir(checkinDirectory);
    const target = path.join(targetDirectory, "migration.sql");
    await copyFile(migrationFile, target);
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260731000000_owner_upgrade_probe/migration.sql",
      ),
      path.join(upgradeDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260731000001_security_fixes_sql007_sql013_roles/migration.sql",
      ),
      path.join(securityDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260802000000_e007_queue_inbox_permissions/migration.sql",
      ),
      path.join(queueDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260819000000_c001_auth_column_permissions/migration.sql",
      ),
      path.join(authDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260820000000_c002_consent_profile_permissions/migration.sql",
      ),
      path.join(consentProfileDirectory, "migration.sql"),
    );
    await copyFile(
      path.join(
        root,
        "prisma/migrations/20260821000000_c004_checkin_guard/migration.sql",
      ),
      path.join(checkinDirectory, "migration.sql"),
    );
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
