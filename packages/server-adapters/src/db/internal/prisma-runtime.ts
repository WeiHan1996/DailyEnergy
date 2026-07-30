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
  async inspectRoleIdentity(client) {
    const rows = await client.$queryRawUnsafe<
      Array<{
        currentUser: string;
        sessionUser: string;
        profileMemberships: string[] | null;
        ownerMember: boolean;
        restrictedRead: boolean;
        schemaCreate: boolean;
        superuser: boolean;
        createDatabase: boolean;
        createRole: boolean;
        bypassRls: boolean;
      }>
    >(`
      SELECT
        current_user AS "currentUser",
        session_user AS "sessionUser",
        COALESCE((
          SELECT array_agg(role_name ORDER BY role_name)
          FROM unnest(ARRAY[
            'daily_energy_api', 'daily_energy_interactive', 'daily_energy_background',
            'daily_energy_restricted', 'daily_energy_migration', 'daily_energy_test'
          ]) AS role_name
          WHERE pg_has_role(session_user, role_name, 'MEMBER')
        ), ARRAY[]::text[]) AS "profileMemberships",
        pg_has_role(session_user, 'daily_energy_owner', 'MEMBER') AS "ownerMember",
        has_table_privilege(session_user, 'daily_energy.restricted_safety_state', 'SELECT') AS "restrictedRead",
        has_schema_privilege(session_user, 'daily_energy', 'CREATE') AS "schemaCreate",
        role.rolsuper AS superuser,
        role.rolcreatedb AS "createDatabase",
        role.rolcreaterole AS "createRole",
        role.rolbypassrls AS "bypassRls"
      FROM pg_roles role
      WHERE role.rolname = session_user
    `);
    const identity = rows[0];
    if (rows.length !== 1 || !identity) {
      throw new Error("DB_ROLE_IDENTITY_UNAVAILABLE");
    }
    return {
      ...identity,
      profileMemberships: identity.profileMemberships ?? [],
    };
  },
};
