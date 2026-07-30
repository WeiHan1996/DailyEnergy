#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { assertMigrationChecksumManifest, migrationChecksums } from "./lib.mjs";

const manifestPath = path.resolve("prisma/migrations/checksums.json");
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
  console.log(`DB_MIGRATION_CHECKSUM_OK:${checksums.length}`);
}
