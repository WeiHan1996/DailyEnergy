#!/usr/bin/env node
import {
  APPLICATION_SCHEMA,
  DATABASE_GROUP_ROLES,
  DATABASE_OWNER_ROLE,
  readConnectionString,
  RUNTIME_ROLES,
  withClient,
} from "./lib.mjs";

const connectionString = await readConnectionString({
  fileName: "DATABASE_ADMIN_URL_FILE",
  requiredCode: "DB_ADMIN_DATABASE_URL_REQUIRED",
  valueName: "DATABASE_ADMIN_URL",
});

await withClient(connectionString, async (client) => {
  const administrator = await client.query(`
    SELECT rolsuper, rolcreaterole
    FROM pg_roles
    WHERE rolname = current_user
  `);
  const administratorRole = administrator.rows[0];
  if (
    administrator.rowCount !== 1 ||
    (!administratorRole.rolsuper && !administratorRole.rolcreaterole)
  ) {
    throw new Error("DB_BOOTSTRAP_ADMIN_REQUIRED");
  }

  for (const roleName of DATABASE_GROUP_ROLES) {
    const roleExists = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [roleName],
    );
    if (roleExists.rowCount === 0) {
      await client.query(
        `CREATE ROLE ${roleName} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
      );
    }
  }

  const attributes = await client.query(
    `SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolbypassrls
       FROM pg_roles
      WHERE rolname = ANY($1::text[])
      ORDER BY rolname`,
    [DATABASE_GROUP_ROLES],
  );
  if (
    attributes.rowCount !== DATABASE_GROUP_ROLES.length ||
    attributes.rows.some(
      (role) =>
        role.rolcanlogin ||
        role.rolsuper ||
        role.rolcreatedb ||
        role.rolcreaterole ||
        role.rolinherit ||
        role.rolbypassrls,
    )
  ) {
    throw new Error("DB_BOOTSTRAP_ROLE_ATTRIBUTES_MISMATCH");
  }

  await client.query(
    `GRANT ${DATABASE_OWNER_ROLE} TO ${RUNTIME_ROLES.migration} WITH INHERIT FALSE, SET TRUE`,
  );
  const ownerMembership = await client.query(
    `SELECT pg_has_role($1, $2, 'MEMBER') AS member`,
    [RUNTIME_ROLES.migration, DATABASE_OWNER_ROLE],
  );
  if (!ownerMembership.rows[0]?.member) {
    throw new Error("DB_BOOTSTRAP_OWNER_MEMBERSHIP_MISSING");
  }

  await client.query(
    `CREATE SCHEMA IF NOT EXISTS ${APPLICATION_SCHEMA} AUTHORIZATION ${DATABASE_OWNER_ROLE}`,
  );
  const schemaOwner = await client.query(
    `SELECT nspowner::regrole::text AS owner
       FROM pg_namespace
      WHERE nspname = $1`,
    [APPLICATION_SCHEMA],
  );
  if (schemaOwner.rows[0]?.owner !== DATABASE_OWNER_ROLE) {
    throw new Error("DB_BOOTSTRAP_SCHEMA_OWNER_MISMATCH");
  }
  await client.query(`REVOKE ALL ON SCHEMA ${APPLICATION_SCHEMA} FROM PUBLIC`);
});

console.log("DB_BOOTSTRAP_OK");
