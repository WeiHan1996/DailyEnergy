#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertCatalogFingerprint,
  collectCatalogSnapshot,
  fingerprintCatalog,
} from "./catalog-fingerprint.mjs";
import {
  APPLICATION_SCHEMA,
  assertExactNames,
  expectedSchemaObjects,
  EXPECTED_SQL_IDS,
  listMigrations,
  RUNTIME_ROLES,
  withClient,
} from "./lib.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DB_DATABASE_URL_REQUIRED");
}
const migrationSql = (
  await Promise.all(
    (await listMigrations()).map((migration) =>
      readFile(migration.file, "utf8"),
    ),
  )
).join("\n");
const expected = expectedSchemaObjects(migrationSql);
const fingerprintManifestPath = path.resolve(
  process.env.DB_CATALOG_FINGERPRINT_MANIFEST ??
    "prisma/migrations/catalog-fingerprint.json",
);
const expectedFingerprint = JSON.parse(
  await readFile(fingerprintManifestPath, "utf8"),
);

await withClient(connectionString, async (client) => {
  const queries = {
    tables: `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('r','p') AND c.relname <> '_prisma_migrations'`,
    enums: `SELECT t.typname AS name FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typtype='e'`,
    indexes: `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='i' AND NOT EXISTS (SELECT 1 FROM pg_constraint x WHERE x.conindid=c.oid)`,
    constraints: `SELECT c.conname AS name FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=$1 AND c.conname = ANY($2::text[])`,
    triggers: `SELECT t.tgname AS name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal`,
    functions: `SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1`,
  };
  for (const [kind, query] of Object.entries(queries)) {
    const parameters =
      kind === "constraints"
        ? [APPLICATION_SCHEMA, [...expected.constraints]]
        : [APPLICATION_SCHEMA];
    const result = await client.query(query, parameters);
    assertExactNames(
      kind,
      expected[kind],
      new Set(result.rows.map((row) => row.name)),
    );
  }

  const missingSqlIds = EXPECTED_SQL_IDS.filter(
    (id) => !migrationSql.includes(id),
  );
  if (missingSqlIds.length) {
    throw new Error(`DB_DRIFT_SQL_IDS:${missingSqlIds.join(",")}`);
  }

  const roles = await client.query(
    `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolinherit
       FROM pg_roles WHERE rolname = ANY($1::text[])`,
    [Object.values(RUNTIME_ROLES)],
  );
  if (roles.rowCount !== Object.values(RUNTIME_ROLES).length) {
    throw new Error("DB_DRIFT_ROLE_MATRIX");
  }
  for (const role of roles.rows) {
    if (
      role.rolsuper ||
      role.rolcreatedb ||
      role.rolcreaterole ||
      role.rolinherit
    ) {
      throw new Error(`DB_DRIFT_ROLE_ATTRIBUTES:${role.rolname}`);
    }
  }

  const publicPrivileges = await client.query(
    `SELECT count(*)::int AS count
       FROM information_schema.role_table_grants
      WHERE table_schema=$1 AND grantee='PUBLIC'`,
    [APPLICATION_SCHEMA],
  );
  if (publicPrivileges.rows[0].count !== 0) {
    throw new Error("DB_DRIFT_PUBLIC_GRANT");
  }

  const requiredGrants = await client.query(
    `SELECT
       has_schema_privilege('daily_energy_api', $1, 'USAGE') AS api_schema,
       has_table_privilege('daily_energy_api', $1 || '.app_morning_checkin', 'SELECT') AS api_read,
       has_table_privilege('daily_energy_safety', $1 || '.restricted_safety_state', 'SELECT') AS safety_read,
       has_table_privilege('daily_energy_deletion', $1 || '.restricted_safety_state', 'SELECT') AS deletion_read,
       NOT has_table_privilege('daily_energy_restricted', $1 || '.restricted_safety_state', 'SELECT') AS legacy_restricted_no_read,
       has_table_privilege('daily_energy_api', $1 || '.restricted_safety_state', 'SELECT') AS api_restricted_read,
       has_table_privilege('daily_energy_api', $1 || '.app_user_profile', 'SELECT') AS api_ciphertext_read,
       NOT has_table_privilege('daily_energy_safety', $1 || '.restricted_safety_state', 'DELETE') AS safety_no_delete,
       has_table_privilege('daily_energy_safety', $1 || '.runtime_outbox_event', 'INSERT') AS safety_outbox_insert,
       has_table_privilege('daily_energy_deletion', $1 || '.runtime_outbox_event', 'INSERT') AS deletion_outbox_insert,
       NOT has_table_privilege('daily_energy_deletion', $1 || '.evaluation_run', 'SELECT') AS deletion_no_eval,
       has_table_privilege('daily_energy_deletion', $1 || '.app_morning_checkin', 'DELETE') AS deletion_app_delete`,
    [APPLICATION_SCHEMA],
  );
  const grants = requiredGrants.rows[0];
  if (
    !grants.api_schema ||
    !grants.api_read ||
    !grants.safety_read ||
    !grants.deletion_read ||
    !grants.legacy_restricted_no_read ||
    grants.api_restricted_read ||
    grants.api_ciphertext_read ||
    !grants.safety_no_delete ||
    !grants.safety_outbox_insert ||
    !grants.deletion_outbox_insert ||
    !grants.deletion_no_eval ||
    !grants.deletion_app_delete
  ) {
    throw new Error("DB_DRIFT_GRANT_MATRIX");
  }

  const actualFingerprint = fingerprintCatalog(
    await collectCatalogSnapshot(client),
  );
  assertCatalogFingerprint(expectedFingerprint, actualFingerprint);
});
console.log(
  `DB_DRIFT_OK:tables=${expected.tables.size}:enums=${expected.enums.size}:indexes=${expected.indexes.size}:constraints=${expected.constraints.size}:triggers=${expected.triggers.size}:functions=${expected.functions.size}`,
);
