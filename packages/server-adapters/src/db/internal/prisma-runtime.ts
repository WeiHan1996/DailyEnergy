import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import type {
  PrismaClientLifecycle,
  PrismaRuntime,
} from "./prisma-runtime.types.js";

export const prismaRuntime: PrismaRuntime<PrismaClientLifecycle> = {
  createClient(adapter) {
    type ClientOptions = ConstructorParameters<typeof PrismaClient>[0];
    type Adapter = Exclude<ClientOptions["adapter"], undefined>;
    return new PrismaClient({ adapter: adapter as Adapter });
  },
  createAdapter(config) {
    return new PrismaPg({
      application_name: config.applicationName,
      connectionString: config.connectionString,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      idleTimeoutMillis: config.idleTimeoutMillis,
      max: config.connectionLimit,
    });
  },
  async inspectRoleIdentity(client, expectedRole) {
    const rows = await client.$queryRawUnsafe<
      Array<{
        capabilityMismatch: boolean;
        currentUser: string;
        sessionUser: string;
        profileMemberships: string[] | null;
        membershipMismatch: boolean;
        ownerMember: boolean;
        restrictedRead: boolean;
        safetyWrite: boolean;
        outboxWrite: boolean;
        deletionTaskWrite: boolean;
        subjectDelete: boolean;
        evaluationAccess: boolean;
        extraRoleMemberships: string[] | null;
        schemaCreate: boolean;
        superuser: boolean;
        createDatabase: boolean;
        createRole: boolean;
        replication: boolean;
        bypassRls: boolean;
        immutableTableUpdate: boolean;
      }>
    >(
      `
      WITH application_relations AS (
        SELECT object.oid, object.relname
        FROM pg_class object
        JOIN pg_namespace namespace ON namespace.oid = object.relnamespace
        WHERE namespace.nspname = 'daily_energy'
      )
      SELECT
        current_user::text AS "currentUser",
        session_user::text AS "sessionUser",
        COALESCE((
          SELECT array_agg(role_name ORDER BY role_name)
          FROM unnest(ARRAY[
            'daily_energy_api', 'daily_energy_interactive', 'daily_energy_background',
            'daily_energy_restricted', 'daily_energy_safety', 'daily_energy_deletion',
            'daily_energy_migration', 'daily_energy_test'
          ]) AS role_name
          WHERE pg_has_role(session_user, role_name, 'MEMBER')
        ), ARRAY[]::text[]) AS "profileMemberships",
        NOT EXISTS (
          SELECT 1
          FROM pg_auth_members membership
          JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
          JOIN pg_roles member_role ON member_role.oid = membership.member
          WHERE granted_role.rolname = $1
            AND member_role.rolname = session_user
            AND NOT membership.admin_option
            AND membership.inherit_option
            AND membership.set_option
        ) AS "membershipMismatch",
        pg_has_role(session_user, 'daily_energy_owner', 'MEMBER') AS "ownerMember",
        has_table_privilege(session_user, restricted_safety_state.oid, 'SELECT') AS "restrictedRead",
        has_table_privilege(session_user, restricted_safety_state.oid, 'INSERT')
          AND has_table_privilege(session_user, restricted_safety_state.oid, 'UPDATE') AS "safetyWrite",
        has_table_privilege(session_user, runtime_outbox_event.oid, 'INSERT') AS "outboxWrite",
        has_table_privilege(session_user, restricted_data_task.oid, 'INSERT')
          AND has_table_privilege(session_user, restricted_data_task.oid, 'UPDATE')
          AND has_table_privilege(session_user, restricted_data_task.oid, 'DELETE') AS "deletionTaskWrite",
        has_table_privilege(session_user, app_morning_checkin.oid, 'DELETE') AS "subjectDelete",
        EXISTS(
          SELECT 1 FROM application_relations evaluation_table
          WHERE evaluation_table.relname LIKE 'evaluation_%'
            AND (
              has_table_privilege(session_user, evaluation_table.oid, 'SELECT')
              OR has_table_privilege(session_user, evaluation_table.oid, 'INSERT')
              OR has_table_privilege(session_user, evaluation_table.oid, 'UPDATE')
              OR has_table_privilege(session_user, evaluation_table.oid, 'DELETE')
            )
        ) AS "evaluationAccess",
        COALESCE((
          SELECT array_agg(candidate.rolname::text ORDER BY candidate.rolname::text)
          FROM pg_roles candidate
          WHERE candidate.rolname <> session_user
            AND pg_has_role(session_user, candidate.oid, 'MEMBER')
            AND candidate.rolname NOT IN (
              'daily_energy_api', 'daily_energy_interactive', 'daily_energy_background',
              'daily_energy_restricted', 'daily_energy_safety', 'daily_energy_deletion',
              'daily_energy_migration', 'daily_energy_test', 'daily_energy_owner'
            )
        ), ARRAY[]::text[]) AS "extraRoleMemberships",
        has_schema_privilege(session_user, 'daily_energy', 'CREATE') AS "schemaCreate",
        role.rolsuper AS superuser,
        role.rolcreatedb AS "createDatabase",
        role.rolcreaterole AS "createRole",
        role.rolreplication AS replication,
        role.rolbypassrls AS "bypassRls",
        (
          has_table_privilege(session_user, app_published_daily_result.oid, 'UPDATE')
          OR has_table_privilege(session_user, app_generation_input_snapshot.oid, 'UPDATE')
          OR has_table_privilege(session_user, app_published_weekly_summary_revision.oid, 'UPDATE')
          OR has_table_privilege(session_user, system_version_catalog_entry.oid, 'UPDATE')
        ) AS "immutableTableUpdate",
        (
          has_schema_privilege(session_user, 'daily_energy', 'USAGE')
            IS DISTINCT FROM has_schema_privilege($1, 'daily_energy', 'USAGE')
          OR has_schema_privilege(session_user, 'daily_energy', 'USAGE WITH GRANT OPTION')
            IS DISTINCT FROM has_schema_privilege($1, 'daily_energy', 'USAGE WITH GRANT OPTION')
          OR has_schema_privilege(session_user, 'daily_energy', 'CREATE')
            IS DISTINCT FROM has_schema_privilege($1, 'daily_energy', 'CREATE')
          OR has_schema_privilege(session_user, 'daily_energy', 'CREATE WITH GRANT OPTION')
            IS DISTINCT FROM has_schema_privilege($1, 'daily_energy', 'CREATE WITH GRANT OPTION')
          OR EXISTS (
            SELECT 1
            FROM pg_class object
            JOIN pg_namespace namespace ON namespace.oid = object.relnamespace
            CROSS JOIN (VALUES
              ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
              ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN'),
              ('SELECT WITH GRANT OPTION'), ('INSERT WITH GRANT OPTION'),
              ('UPDATE WITH GRANT OPTION'), ('DELETE WITH GRANT OPTION'),
              ('TRUNCATE WITH GRANT OPTION'), ('REFERENCES WITH GRANT OPTION'),
              ('TRIGGER WITH GRANT OPTION'), ('MAINTAIN WITH GRANT OPTION')
            ) AS privilege(name)
            WHERE namespace.nspname = 'daily_energy'
              AND object.relkind IN ('r', 'p', 'v', 'm', 'f')
              AND has_table_privilege(session_user, object.oid, privilege.name)
                IS DISTINCT FROM has_table_privilege($1, object.oid, privilege.name)
          )
          OR EXISTS (
            SELECT 1
            FROM pg_class object
            JOIN pg_namespace namespace ON namespace.oid = object.relnamespace
            JOIN pg_attribute column_row ON column_row.attrelid = object.oid
            CROSS JOIN (VALUES
              ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES'),
              ('SELECT WITH GRANT OPTION'), ('INSERT WITH GRANT OPTION'),
              ('UPDATE WITH GRANT OPTION'), ('REFERENCES WITH GRANT OPTION')
            ) AS privilege(name)
            WHERE namespace.nspname = 'daily_energy'
              AND object.relkind IN ('r', 'p', 'v', 'm', 'f')
              AND column_row.attnum > 0
              AND NOT column_row.attisdropped
              AND has_column_privilege(
                    session_user, object.oid, column_row.attnum, privilege.name
                  ) IS DISTINCT FROM has_column_privilege(
                    $1, object.oid, column_row.attnum, privilege.name
                  )
          )
          OR EXISTS (
            SELECT 1
            FROM pg_class object
            JOIN pg_namespace namespace ON namespace.oid = object.relnamespace
            CROSS JOIN (VALUES
              ('USAGE'), ('SELECT'), ('UPDATE'),
              ('USAGE WITH GRANT OPTION'), ('SELECT WITH GRANT OPTION'),
              ('UPDATE WITH GRANT OPTION')
            ) AS privilege(name)
            WHERE namespace.nspname = 'daily_energy'
              AND object.relkind = 'S'
              AND has_sequence_privilege(session_user, object.oid, privilege.name)
                IS DISTINCT FROM has_sequence_privilege($1, object.oid, privilege.name)
          )
          OR EXISTS (
            SELECT 1
            FROM pg_proc function
            JOIN pg_namespace namespace ON namespace.oid = function.pronamespace
            CROSS JOIN (VALUES
              ('EXECUTE'), ('EXECUTE WITH GRANT OPTION')
            ) AS privilege(name)
            WHERE namespace.nspname = 'daily_energy'
              AND has_function_privilege(session_user, function.oid, privilege.name)
                IS DISTINCT FROM has_function_privilege($1, function.oid, privilege.name)
          )
          OR EXISTS (
            SELECT 1 FROM (VALUES
              ('CONNECT'), ('CREATE'), ('TEMP'),
              ('CONNECT WITH GRANT OPTION'), ('CREATE WITH GRANT OPTION'),
              ('TEMP WITH GRANT OPTION')
            ) AS privilege(name)
            WHERE has_database_privilege(session_user, current_database(), privilege.name)
              IS DISTINCT FROM has_database_privilege($1, current_database(), privilege.name)
          )
        ) AS "capabilityMismatch"
      FROM pg_roles role
      CROSS JOIN LATERAL (
        SELECT oid FROM application_relations WHERE relname = 'restricted_safety_state'
      ) restricted_safety_state
      CROSS JOIN LATERAL (
        SELECT oid FROM application_relations WHERE relname = 'runtime_outbox_event'
      ) runtime_outbox_event
      CROSS JOIN LATERAL (
        SELECT oid FROM application_relations WHERE relname = 'restricted_data_task'
      ) restricted_data_task
      CROSS JOIN LATERAL (
        SELECT oid FROM application_relations WHERE relname = 'app_morning_checkin'
      ) app_morning_checkin
      CROSS JOIN LATERAL (
        SELECT oid FROM application_relations WHERE relname = 'app_published_daily_result'
      ) app_published_daily_result
      CROSS JOIN LATERAL (
        SELECT oid FROM application_relations WHERE relname = 'app_generation_input_snapshot'
      ) app_generation_input_snapshot
      CROSS JOIN LATERAL (
        SELECT oid FROM application_relations WHERE relname = 'app_published_weekly_summary_revision'
      ) app_published_weekly_summary_revision
      CROSS JOIN LATERAL (
        SELECT oid FROM application_relations WHERE relname = 'system_version_catalog_entry'
      ) system_version_catalog_entry
      WHERE role.rolname = session_user
    `,
      expectedRole,
    );
    const identity = rows[0];
    if (rows.length !== 1 || !identity) {
      throw new Error("DB_ROLE_IDENTITY_UNAVAILABLE");
    }
    return {
      ...identity,
      profileMemberships: identity.profileMemberships ?? [],
      extraRoleMemberships: identity.extraRoleMemberships ?? [],
    };
  },
};
