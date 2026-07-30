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

function databaseUser(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DB_CONFIG_INVALID: connection string must be a URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DB_CONFIG_INVALID: PostgreSQL connection required");
  }
  if (!url.username) {
    throw new Error("DB_CONFIG_INVALID: database role is required");
  }
  return decodeURIComponent(url.username);
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
      if (databaseUser(config.connectionString) !== definition.databaseRole) {
        throw new Error(
          `DB_ROLE_MISMATCH: ${definition.profile} requires ${definition.databaseRole}`,
        );
      }

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
