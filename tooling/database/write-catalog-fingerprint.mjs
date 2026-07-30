#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  collectCatalogSnapshot,
  fingerprintCatalog,
} from "./catalog-fingerprint.mjs";
import { withClient } from "./lib.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DB_DATABASE_URL_REQUIRED");
}
if (process.env.DB_CATALOG_FINGERPRINT_WRITE !== "1") {
  throw new Error("DB_CATALOG_FINGERPRINT_WRITE_NOT_CONFIRMED");
}

const target = path.resolve(
  process.env.DB_CATALOG_FINGERPRINT_MANIFEST ??
    "prisma/migrations/catalog-fingerprint.json",
);
await withClient(connectionString, async (client) => {
  const fingerprint = fingerprintCatalog(await collectCatalogSnapshot(client));
  await writeFile(target, `${JSON.stringify(fingerprint, null, 2)}\n`, {
    mode: 0o644,
  });
  console.log(
    `DB_CATALOG_FINGERPRINT_WRITTEN:sections=${Object.keys(fingerprint.sections).length}`,
  );
});
