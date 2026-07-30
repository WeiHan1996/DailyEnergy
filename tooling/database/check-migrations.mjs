#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertCatalogFingerprint } from "./catalog-fingerprint.mjs";
import { assertMigrationChecksumManifest, migrationChecksums } from "./lib.mjs";

const manifestPath = path.resolve("prisma/migrations/checksums.json");
const catalogFingerprintPath = path.resolve(
  "prisma/migrations/catalog-fingerprint.json",
);
const checksums = await migrationChecksums();
const manifest = `${JSON.stringify(
  { algorithm: "sha256", migrations: checksums },
  null,
  2,
)}\n`;

if (process.argv.includes("--write")) {
  await writeFile(manifestPath, manifest, { mode: 0o644 });
  console.log(`DB_MIGRATION_CHECKSUM_WRITTEN:${checksums.length}`);
} else {
  await assertMigrationChecksumManifest({ manifestPath });
  const catalogFingerprint = JSON.parse(
    await readFile(catalogFingerprintPath, "utf8"),
  );
  assertCatalogFingerprint(catalogFingerprint, catalogFingerprint);
  console.log(`DB_MIGRATION_CHECKSUM_OK:${checksums.length}`);
}
