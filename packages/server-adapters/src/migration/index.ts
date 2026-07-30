import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type MigrationDatabaseCapability = DatabaseCapability<"migration">;

export function createMigrationDatabaseFactory(): DatabaseFactory<
  "migration",
  MigrationDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_migration",
      defaultConnectionLimit: 1,
      profile: "migration",
    },
    prismaRuntime,
  );
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "../db/internal/contracts.js";
