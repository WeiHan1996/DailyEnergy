#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { assertNoDbPush, assertSqlIdCoverage, listMigrations } from "./lib.mjs";

const repositoryRoot = path.resolve(".");
const prismaBin =
  process.env.PRISMA_BIN ||
  path.join(repositoryRoot, "node_modules/.bin/prisma");
const schemaFile = path.join(repositoryRoot, "prisma/schema.prisma");
const migrations = await listMigrations();
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  ".claude",
  "coverage",
  "dist",
  "node_modules",
  "tests",
]);
const scannedExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".mjs",
  ".mts",
  ".sh",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

async function assertRepositoryHasNoDbPush(directory = repositoryRoot) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await assertRepositoryHasNoDbPush(target);
      continue;
    }
    if (!scannedExtensions.has(path.extname(entry.name))) {
      continue;
    }
    const content = await readFile(target, "utf8");
    try {
      assertNoDbPush(content);
    } catch (error) {
      if (error instanceof Error && error.message === "DB_PUSH_FORBIDDEN") {
        throw new Error(
          `DB_PUSH_FORBIDDEN:${path.relative(repositoryRoot, target)}`,
          { cause: error },
        );
      }
      throw error;
    }
  }
}

if (migrations.length === 0) {
  throw new Error("DB_MIGRATION_HISTORY_EMPTY");
}
for (const migration of migrations) {
  const sql = await readFile(migration.file, "utf8");
  assertSqlIdCoverage(sql);
}

await assertRepositoryHasNoDbPush();

await access(prismaBin).catch(() => {
  throw new Error("DB_PRISMA_BIN_MISSING");
});
const environment = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://synthetic:synthetic@127.0.0.1:5432/daily_energy",
};
for (const args of [
  ["format", "--check", "--schema", schemaFile],
  ["validate", "--schema", schemaFile],
]) {
  const result = spawnSync(prismaBin, args, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(
      result.stderr.replace(
        /postgresql:\/\/[^\s]+/gu,
        "[REDACTED_DATABASE_URL]",
      ),
    );
    throw new Error(`DB_PRISMA_${args[0].toUpperCase()}_FAILED`);
  }
}
console.log(`DB_STATIC_OK:migrations=${migrations.length}:sql_ids=20`);
