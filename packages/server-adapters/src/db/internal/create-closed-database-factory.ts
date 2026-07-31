import type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
  DatabaseProfile,
} from "./contracts.js";
import type {
  PrismaClientLifecycle,
  PrismaRuntime,
} from "./prisma-runtime.types.js";

export interface DatabaseCapability<Profile extends DatabaseProfile> {
  readonly profile: Profile;
  readonly databaseRole: string;
}

interface FactoryDefinition<Profile extends DatabaseProfile> {
  readonly profile: Profile;
  readonly databaseRole: string;
  readonly defaultConnectionLimit: number;
}

const ordinaryDatabaseRoles = new Set([
  "daily_energy_api",
  "daily_energy_interactive",
  "daily_energy_background",
]);

function assertPostgreSqlUrl(connectionString: string): void {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DB_CONFIG_INVALID: connection string must be a URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DB_CONFIG_INVALID: PostgreSQL connection required");
  }
}

function roleIdentityMatches(
  identity: Awaited<
    ReturnType<PrismaRuntime<PrismaClientLifecycle>["inspectRoleIdentity"]>
  >,
  expectedRole: string,
): boolean {
  const exactProfile =
    identity.profileMemberships.length === 1 &&
    identity.profileMemberships[0] === expectedRole;
  const unprivilegedLogin =
    identity.currentUser === identity.sessionUser &&
    !identity.superuser &&
    !identity.createDatabase &&
    !identity.createRole &&
    !identity.bypassRls;
  if (
    !exactProfile ||
    !unprivilegedLogin ||
    identity.extraRoleMemberships.length > 0 ||
    identity.capabilityMismatch ||
    identity.schemaCreate ||
    identity.immutableTableUpdate
  ) {
    return false;
  }

  if (ordinaryDatabaseRoles.has(expectedRole)) {
    return (
      !identity.ownerMember &&
      !identity.restrictedRead &&
      !identity.safetyWrite &&
      !identity.deletionTaskWrite &&
      !identity.subjectDelete &&
      !identity.evaluationAccess
    );
  }

  if (expectedRole === "daily_energy_migration") {
    return (
      identity.ownerMember &&
      !identity.restrictedRead &&
      !identity.evaluationAccess
    );
  }

  if (expectedRole === "daily_energy_safety") {
    return (
      !identity.ownerMember &&
      identity.restrictedRead &&
      identity.safetyWrite &&
      !identity.deletionTaskWrite &&
      !identity.subjectDelete &&
      !identity.evaluationAccess
    );
  }

  if (expectedRole === "daily_energy_deletion") {
    return (
      !identity.ownerMember &&
      identity.restrictedRead &&
      !identity.safetyWrite &&
      identity.deletionTaskWrite &&
      identity.subjectDelete &&
      !identity.evaluationAccess
    );
  }

  if (expectedRole === "daily_energy_restricted") {
    return (
      !identity.ownerMember &&
      !identity.restrictedRead &&
      !identity.safetyWrite &&
      !identity.deletionTaskWrite &&
      !identity.subjectDelete &&
      !identity.evaluationAccess
    );
  }

  return !identity.ownerMember;
}

export function createClosedDatabaseFactory<
  Profile extends DatabaseProfile,
  Client extends PrismaClientLifecycle,
>(
  definition: FactoryDefinition<Profile>,
  runtime: PrismaRuntime<Client>,
): DatabaseFactory<Profile, DatabaseCapability<Profile>> {
  return Object.freeze({
    profile: definition.profile,
    async connect(
      config: DatabaseFactoryConfig,
    ): Promise<DatabaseConnection<Profile, DatabaseCapability<Profile>>> {
      assertPostgreSqlUrl(config.connectionString);

      const adapter = runtime.createAdapter({
        applicationName:
          config.applicationName ?? `daily-energy:${definition.profile}`,
        connectionLimit:
          config.connectionLimit ?? definition.defaultConnectionLimit,
        connectionString: config.connectionString,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
        idleTimeoutMillis: config.idleTimeoutMillis,
      });
      const client = runtime.createClient(adapter);
      await client.$connect();

      try {
        const identity = await runtime.inspectRoleIdentity(
          client,
          definition.databaseRole,
        );
        if (!roleIdentityMatches(identity, definition.databaseRole)) {
          throw new Error(
            `DB_ROLE_MISMATCH: ${definition.profile} requires ${definition.databaseRole}`,
          );
        }
      } catch (error) {
        await client.$disconnect();
        throw error;
      }

      let disconnected = false;
      return Object.freeze({
        capability: Object.freeze({
          databaseRole: definition.databaseRole,
          profile: definition.profile,
        }),
        profile: definition.profile,
        async disconnect(): Promise<void> {
          if (disconnected) {
            return;
          }
          disconnected = true;
          await client.$disconnect();
        },
      });
    },
  });
}
