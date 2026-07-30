#!/usr/bin/env node
import path from "node:path";
import { withClient } from "./lib.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DB_DATABASE_URL_REQUIRED");
}
const checkpoint = process.env.DB_RESTORE_LEDGER_CHECKPOINT;
if (!checkpoint) {
  throw new Error("DB_RESTORE_LEDGER_CHECKPOINT_REQUIRED");
}
const expectedFingerprint = process.env.DB_RESTORE_LEDGER_FINGERPRINT;
if (!expectedFingerprint) {
  throw new Error("DB_RESTORE_LEDGER_FINGERPRINT_REQUIRED");
}
const stage = process.env.DB_RECOVERY_STAGE || "isolated";
if (stage !== "isolated") {
  throw new Error("DB_RECOVERY_NOT_ISOLATED");
}
const detectorHook = process.env.DB_DELETED_DATA_DETECTOR_HOOK;
if (!detectorHook || !path.isAbsolute(detectorHook)) {
  throw new Error("DB_DELETED_DATA_DETECTOR_HOOK_REQUIRED");
}

const recoverySchema = "daily_energy_recovery";

await withClient(connectionString, async (client) => {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${recoverySchema}`);
  await client.query(`CREATE TABLE IF NOT EXISTS ${recoverySchema}.restore_ledger_checkpoint (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    "checkpointCode" text NOT NULL,
    "ledgerFingerprint" text NOT NULL,
    "replayedAt" timestamptz NOT NULL DEFAULT now(),
    "detectorPassedAt" timestamptz
  )`);
  const existing = await client.query(
    `SELECT "checkpointCode", "ledgerFingerprint", "detectorPassedAt"
       FROM ${recoverySchema}.restore_ledger_checkpoint
      WHERE singleton`,
  );
  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO ${recoverySchema}.restore_ledger_checkpoint
        (singleton, "checkpointCode", "ledgerFingerprint") VALUES (true, $1, $2)`,
      [checkpoint, expectedFingerprint],
    );
  } else if (
    existing.rows[0].checkpointCode !== checkpoint ||
    existing.rows[0].ledgerFingerprint !== expectedFingerprint
  ) {
    throw new Error("DB_RESTORE_LEDGER_CONFLICT");
  }
});
console.log(`DB_RESTORE_LEDGER_REPLAY_OK:${checkpoint}`);
