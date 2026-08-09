#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import {
  APPLICATION_SCHEMA,
  readConnectionString,
  withClient,
} from "../database/lib.mjs";

function fail(code) {
  throw new Error(code);
}

async function safety(client) {
  const result = await client.query(
    `SELECT
       has_table_privilege('daily_energy_safety', $1 || '.restricted_safety_state', 'SELECT') AS can_read,
       NOT has_table_privilege('daily_energy_safety', $1 || '.restricted_safety_state', 'DELETE') AS cannot_delete,
       has_table_privilege('daily_energy_safety', $1 || '.runtime_outbox_event', 'INSERT') AS can_emit`,
    [APPLICATION_SCHEMA],
  );
  if (
    !result.rows[0]?.can_read ||
    !result.rows[0]?.cannot_delete ||
    !result.rows[0]?.can_emit
  ) {
    fail("E012_DATABASE_SMOKE_SAFETY_FAILED");
  }
}

async function owner(client) {
  const result = await client.query(
    `SELECT nspowner::regrole::text AS owner,
            NOT has_schema_privilege('public', $1, 'USAGE') AS public_denied
       FROM pg_namespace
      WHERE nspname = $1`,
    [APPLICATION_SCHEMA],
  );
  if (
    result.rowCount !== 1 ||
    result.rows[0]?.owner !== "daily_energy_owner" ||
    !result.rows[0]?.public_denied
  ) {
    fail("E012_DATABASE_SMOKE_OWNER_FAILED");
  }
}

async function deletion(client) {
  const result = await client.query(
    `SELECT
       has_table_privilege('daily_energy_deletion', $1 || '.restricted_safety_state', 'SELECT') AS safety_read,
       has_table_privilege('daily_energy_deletion', $1 || '.app_morning_checkin', 'DELETE') AS ordinary_delete,
       NOT has_table_privilege('daily_energy_deletion', $1 || '.evaluation_run', 'SELECT') AS evaluation_denied,
       NOT has_table_privilege('daily_energy_restricted', $1 || '.restricted_safety_state', 'SELECT') AS legacy_denied`,
    [APPLICATION_SCHEMA],
  );
  if (
    !result.rows[0]?.safety_read ||
    !result.rows[0]?.ordinary_delete ||
    !result.rows[0]?.evaluation_denied ||
    !result.rows[0]?.legacy_denied
  ) {
    fail("E012_DATABASE_SMOKE_DELETION_FAILED");
  }
}

export async function runDatabaseSmoke(phase, connectionString) {
  const operation = { deletion, owner, safety }[phase];
  if (operation === undefined) {
    fail("E012_DATABASE_SMOKE_PHASE_INVALID");
  }
  await withClient(connectionString, operation);
  return Object.freeze({ phase, status: "PASS" });
}

async function main() {
  const phase = process.argv[2];
  if (process.argv.length !== 3) {
    fail("E012_DATABASE_SMOKE_USAGE");
  }
  const connectionString = await readConnectionString({
    fileName: "DATABASE_URL_FILE",
    requiredCode: "DB_DATABASE_URL_REQUIRED",
    valueName: "DATABASE_URL",
  });
  const result = await runDatabaseSmoke(phase, connectionString);
  process.stdout.write(`E012_DATABASE_SMOKE_OK:phase=${result.phase}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
