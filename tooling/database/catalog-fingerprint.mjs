import { createHash } from "node:crypto";

import { APPLICATION_SCHEMA, DATABASE_GROUP_ROLES } from "./lib.mjs";

const catalogQueries = Object.freeze({
  schemas: `
    SELECT n.nspname AS name, owner.rolname AS owner
    FROM pg_namespace n
    JOIN pg_roles owner ON owner.oid = n.nspowner
    WHERE n.nspname = $1
    ORDER BY n.nspname`,
  relations: `
    SELECT c.relname AS name, c.relkind AS kind, owner.rolname AS owner,
           c.relpersistence AS persistence, c.relrowsecurity AS row_security,
           c.relforcerowsecurity AS force_row_security
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles owner ON owner.oid = c.relowner
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'S')
    ORDER BY c.relkind, c.relname`,
  columns: `
    SELECT c.relname AS relation, a.attnum AS ordinal, a.attname AS name,
           pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull AS not_null,
           pg_get_expr(d.adbin, d.adrelid, true) AS default_expression,
           a.attidentity AS identity, a.attgenerated AS generated,
           CASE WHEN a.attcollation = 0 THEN NULL ELSE coll.collname END AS collation
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    LEFT JOIN pg_collation coll ON coll.oid = a.attcollation
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'S')
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum`,
  enums: `
    SELECT t.typname AS type, owner.rolname AS owner, e.enumsortorder::text AS ordinal,
           e.enumlabel AS label
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_roles owner ON owner.oid = t.typowner
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = $1
    ORDER BY t.typname, e.enumsortorder`,
  constraints: `
    SELECT c.relname AS relation, constraint_row.conname AS name,
           constraint_row.contype AS type,
           constraint_row.condeferrable AS deferrable,
           constraint_row.condeferred AS initially_deferred,
           constraint_row.convalidated AS validated,
           pg_get_constraintdef(constraint_row.oid, true) AS definition
    FROM pg_constraint constraint_row
    JOIN pg_namespace n ON n.oid = constraint_row.connamespace
    LEFT JOIN pg_class c ON c.oid = constraint_row.conrelid
    WHERE n.nspname = $1
    ORDER BY c.relname NULLS FIRST, constraint_row.conname`,
  indexes: `
    SELECT table_row.relname AS relation, index_row.relname AS name,
           owner.rolname AS owner, index_meta.indisunique AS unique,
           index_meta.indisprimary AS primary, index_meta.indisvalid AS valid,
           index_meta.indisready AS ready,
           pg_get_indexdef(index_row.oid, 0, true) AS definition
    FROM pg_index index_meta
    JOIN pg_class index_row ON index_row.oid = index_meta.indexrelid
    JOIN pg_class table_row ON table_row.oid = index_meta.indrelid
    JOIN pg_namespace n ON n.oid = table_row.relnamespace
    JOIN pg_roles owner ON owner.oid = index_row.relowner
    WHERE n.nspname = $1
    ORDER BY table_row.relname, index_row.relname`,
  triggers: `
    SELECT table_row.relname AS relation, trigger_row.tgname AS name,
           trigger_row.tgenabled AS enabled,
           pg_get_triggerdef(trigger_row.oid, true) AS definition
    FROM pg_trigger trigger_row
    JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid
    JOIN pg_namespace n ON n.oid = table_row.relnamespace
    WHERE n.nspname = $1 AND NOT trigger_row.tgisinternal
    ORDER BY table_row.relname, trigger_row.tgname`,
  functions: `
    SELECT function_row.proname AS name,
           pg_get_function_identity_arguments(function_row.oid) AS identity_arguments,
           owner.rolname AS owner, language.lanname AS language,
           function_row.provolatile AS volatility,
           function_row.prosecdef AS security_definer,
           function_row.proleakproof AS leakproof,
           function_row.proconfig AS configuration,
           pg_get_functiondef(function_row.oid) AS definition
    FROM pg_proc function_row
    JOIN pg_namespace n ON n.oid = function_row.pronamespace
    JOIN pg_roles owner ON owner.oid = function_row.proowner
    JOIN pg_language language ON language.oid = function_row.prolang
    WHERE n.nspname = $1
    ORDER BY function_row.proname, pg_get_function_identity_arguments(function_row.oid)`,
  schemaAcl: `
    SELECT n.nspname AS object, owner.rolname AS owner,
           CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
           acl.privilege_type AS privilege, acl.is_grantable AS grantable
    FROM pg_namespace n
    JOIN pg_roles owner ON owner.oid = n.nspowner
    CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n'::"char", n.nspowner))) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname = $1
    ORDER BY object, grantee, privilege`,
  relationAcl: `
    SELECT c.relkind AS kind, c.relname AS object, owner.rolname AS owner,
           CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
           acl.privilege_type AS privilege, acl.is_grantable AS grantable
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles owner ON owner.oid = c.relowner
    CROSS JOIN LATERAL aclexplode(COALESCE(
      c.relacl,
      acldefault((CASE WHEN c.relkind = 'S' THEN 'S' ELSE 'r' END)::"char", c.relowner)
    )) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'S')
    ORDER BY kind, object, grantee, privilege`,
  functionAcl: `
    SELECT function_row.proname AS object,
           pg_get_function_identity_arguments(function_row.oid) AS identity_arguments,
           owner.rolname AS owner,
           CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
           acl.privilege_type AS privilege, acl.is_grantable AS grantable
    FROM pg_proc function_row
    JOIN pg_namespace n ON n.oid = function_row.pronamespace
    JOIN pg_roles owner ON owner.oid = function_row.proowner
    CROSS JOIN LATERAL aclexplode(COALESCE(
      function_row.proacl,
      acldefault('f'::"char", function_row.proowner)
    )) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname = $1
    ORDER BY object, identity_arguments, grantee, privilege`,
  defaultPrivileges: `
    SELECT owner.rolname AS owner, COALESCE(n.nspname, '') AS schema,
           defaults.defaclobjtype AS object_type,
           CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
           acl.privilege_type AS privilege, acl.is_grantable AS grantable
    FROM pg_default_acl defaults
    JOIN pg_roles owner ON owner.oid = defaults.defaclrole
    LEFT JOIN pg_namespace n ON n.oid = defaults.defaclnamespace
    CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname = $1 OR (n.oid IS NULL AND owner.rolname = ANY($2::text[]))
    ORDER BY owner, schema, object_type, grantee, privilege`,
  roles: `
    SELECT rolname AS name, rolcanlogin AS login, rolsuper AS superuser,
           rolcreatedb AS create_database, rolcreaterole AS create_role,
           rolinherit AS inherit, rolreplication AS replication,
           rolbypassrls AS bypass_rls, rolconnlimit AS connection_limit
    FROM pg_roles
    WHERE rolname = ANY($2::text[])
    ORDER BY rolname`,
  memberships: `
    SELECT granted.rolname AS granted_role, member.rolname AS member_role,
           membership.admin_option AS admin_option,
           membership.inherit_option AS inherit_option,
           membership.set_option AS set_option
    FROM pg_auth_members membership
    JOIN pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_roles member ON member.oid = membership.member
    WHERE granted.rolname = ANY($2::text[]) AND member.rolname = ANY($2::text[])
    ORDER BY granted_role, member_role`,
});
export const CATALOG_SECTIONS = Object.freeze(Object.keys(catalogQueries));

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function collectCatalogSnapshot(client) {
  const snapshot = {};
  for (const [section, query] of Object.entries(catalogQueries)) {
    const usesSchema = query.includes("$1");
    const usesRoles = query.includes("$2");
    const statement =
      usesRoles && !usesSchema ? query.replaceAll("$2", "$1") : query;
    const parameters = usesSchema
      ? usesRoles
        ? [APPLICATION_SCHEMA, DATABASE_GROUP_ROLES]
        : [APPLICATION_SCHEMA]
      : [DATABASE_GROUP_ROLES];
    const result = await client.query(statement, parameters);
    snapshot[section] = result.rows;
  }
  return snapshot;
}

export function fingerprintCatalog(snapshot) {
  const sections = {};
  for (const [section, rows] of Object.entries(snapshot)) {
    sections[section] = { count: rows.length, sha256: hash(rows) };
  }
  return {
    version: 1,
    algorithm: "sha256",
    schema: APPLICATION_SCHEMA,
    catalogSha256: hash(snapshot),
    sections,
  };
}

export function assertCatalogFingerprint(expected, actual) {
  if (
    expected.version !== 1 ||
    expected.algorithm !== "sha256" ||
    expected.schema !== APPLICATION_SCHEMA ||
    typeof expected.sections !== "object" ||
    JSON.stringify(Object.keys(expected.sections)) !==
      JSON.stringify(CATALOG_SECTIONS) ||
    JSON.stringify(Object.keys(actual.sections)) !==
      JSON.stringify(CATALOG_SECTIONS)
  ) {
    throw new Error("DB_CATALOG_FINGERPRINT_INVALID");
  }
  for (const section of Object.keys(actual.sections)) {
    if (
      expected.sections[section]?.count !== actual.sections[section].count ||
      expected.sections[section]?.sha256 !== actual.sections[section].sha256
    ) {
      throw new Error(`DB_DRIFT_FINGERPRINT:${section}`);
    }
  }
  if (expected.catalogSha256 !== actual.catalogSha256) {
    throw new Error("DB_DRIFT_FINGERPRINT:catalog");
  }
}
