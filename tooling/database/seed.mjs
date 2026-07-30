#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { APPLICATION_SCHEMA, withClient } from "./lib.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DB_DATABASE_URL_REQUIRED");
}
const seedPath = process.env.DB_SEED_FILE
  ? path.resolve(process.env.DB_SEED_FILE)
  : path.resolve("prisma/seed/synthetic-v1.json");
const seed = JSON.parse(await readFile(seedPath, "utf8"));
const now = new Date("2026-07-30T00:00:00.000Z");

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function bytesHex(value) {
  return Buffer.from(value).toString("hex");
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`DB_SYNTHETIC_SEED_CONFLICT:${label}`);
  }
}

await withClient(connectionString, async (client) => {
  await client.query("BEGIN");
  try {
    await client.query(
      `SET LOCAL search_path TO "${APPLICATION_SCHEMA}", pg_catalog`,
    );
    for (const entry of seed.records.version_catalog) {
      const inserted = await client.query(
        `INSERT INTO system_version_catalog_entry
          (id, "catalogType", version, "compatibilityPayload", fingerprint, state, "activatedAt", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3::jsonb, decode($4, 'hex'), 'ACTIVE', $5, $5)
         ON CONFLICT ("catalogType", version) DO NOTHING
         RETURNING id`,
        [
          entry.catalog_type,
          entry.version,
          JSON.stringify(entry.compatibility),
          entry.fingerprint_hex,
          now,
        ],
      );
      if (inserted.rowCount === 0) {
        const existing = await client.query(
          `SELECT "compatibilityPayload", fingerprint, state
             FROM system_version_catalog_entry
            WHERE "catalogType"=$1 AND version=$2`,
          [entry.catalog_type, entry.version],
        );
        const row = existing.rows[0];
        if (!row) {
          throw new Error("DB_SYNTHETIC_SEED_CONFLICT:version_catalog_missing");
        }
        assertEqual(
          "version_catalog.compatibility",
          stableJson(row.compatibilityPayload),
          stableJson(entry.compatibility),
        );
        assertEqual(
          "version_catalog.fingerprint",
          bytesHex(row.fingerprint),
          entry.fingerprint_hex,
        );
        assertEqual("version_catalog.state", row.state, "ACTIVE");
      }
    }
    for (const entry of seed.records.retention_policy) {
      const inserted = await client.query(
        `INSERT INTO system_retention_policy_entry
          (id, "policyVersion", "dataTypeCode", "dataClass", "purposeCode", "anchorCode",
           "maxDurationIso8601", "terminalAction", "scopeBehavior", "backupDurationIso8601",
           fingerprint, state, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8, decode($9, 'hex'), 'ACTIVE', $10)
         ON CONFLICT ("policyVersion", "dataTypeCode") DO NOTHING
         RETURNING id`,
        [
          seed.retention_policy,
          entry.data_type_code,
          entry.data_class,
          entry.purpose_code,
          entry.anchor_code,
          entry.max_duration_iso8601,
          entry.terminal_action,
          entry.backup_duration_iso8601,
          entry.fingerprint_hex,
          now,
        ],
      );
      if (inserted.rowCount === 0) {
        const existing = await client.query(
          `SELECT "dataClass", "purposeCode", "anchorCode", "maxDurationIso8601",
                  "terminalAction", "scopeBehavior", "backupDurationIso8601", fingerprint, state
             FROM system_retention_policy_entry
            WHERE "policyVersion"=$1 AND "dataTypeCode"=$2`,
          [seed.retention_policy, entry.data_type_code],
        );
        const row = existing.rows[0];
        if (!row) {
          throw new Error(
            "DB_SYNTHETIC_SEED_CONFLICT:retention_policy_missing",
          );
        }
        for (const [label, actual, expected] of [
          ["data_class", row.dataClass, entry.data_class],
          ["purpose_code", row.purposeCode, entry.purpose_code],
          ["anchor_code", row.anchorCode, entry.anchor_code],
          ["max_duration", row.maxDurationIso8601, entry.max_duration_iso8601],
          ["terminal_action", row.terminalAction, entry.terminal_action],
          [
            "backup_duration",
            row.backupDurationIso8601,
            entry.backup_duration_iso8601,
          ],
          ["state", row.state, "ACTIVE"],
        ]) {
          assertEqual(`retention_policy.${label}`, actual, expected);
        }
        assertEqual(
          "retention_policy.scope_behavior",
          stableJson(row.scopeBehavior),
          stableJson({}),
        );
        assertEqual(
          "retention_policy.fingerprint",
          bytesHex(row.fingerprint),
          entry.fingerprint_hex,
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
});
console.log(`DB_SYNTHETIC_SEED_OK:${seed.version}`);
