#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { withClient } from "./lib.mjs";

const recoveryTable = "daily_energy_recovery.restore_ledger_checkpoint";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DB_DATABASE_URL_REQUIRED");
}
const detectorHook = process.env.DB_DELETED_DATA_DETECTOR_HOOK;
if (!detectorHook) {
  throw new Error("DB_DELETED_DATA_DETECTOR_HOOK_REQUIRED");
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
    throw new Error("DB_RESTORE_LEDGER_NOT_REPLAYED");
  }
  const ledger = await client.query(
    `SELECT "checkpointCode", "detectorPassedAt"
       FROM ${recoveryTable}
      WHERE singleton`,
  );
  if (ledger.rowCount !== 1 || ledger.rows[0].checkpointCode !== checkpoint) {
    throw new Error("DB_RESTORE_LEDGER_NOT_REPLAYED");
  }
  const result = spawnSync(detectorHook, [], {
    env: { ...process.env, DATABASE_URL: connectionString },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("DB_DELETED_DATA_DETECTOR_FAILED");
  }
  await client.query(
    `UPDATE ${recoveryTable}
        SET "detectorPassedAt"=now()
      WHERE singleton AND "checkpointCode"=$1`,
    [checkpoint],
  );
});
console.log(`DB_DELETED_DATA_DETECTOR_OK:${checkpoint}`);
