#!/usr/bin/env node
import { withClient } from "./lib.mjs";

const recoveryTable = "daily_energy_recovery.restore_ledger_checkpoint";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DB_DATABASE_URL_REQUIRED");
}
const checkpoint = process.env.DB_RESTORE_LEDGER_CHECKPOINT;
if (!checkpoint) {
  throw new Error("DB_RESTORE_LEDGER_CHECKPOINT_REQUIRED");
}

await withClient(connectionString, async (client) => {
  const exists = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS present",
    [recoveryTable],
  );
  if (!exists.rows[0].present) {
    throw new Error("DB_RECOVERY_NOT_READY");
  }
  const result = await client.query(
    `SELECT "detectorPassedAt"
       FROM ${recoveryTable}
      WHERE singleton AND "checkpointCode"=$1`,
    [checkpoint],
  );
  if (result.rowCount !== 1 || !result.rows[0].detectorPassedAt) {
    throw new Error("DB_RECOVERY_NOT_READY");
  }
});
console.log(`DB_RECOVERY_READY:${checkpoint}`);
