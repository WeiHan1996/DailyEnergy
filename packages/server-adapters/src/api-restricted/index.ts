import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type ApiRestrictedDatabaseCapability =
  DatabaseCapability<"api-restricted">;

export function createApiRestrictedDatabaseFactory(): DatabaseFactory<
  "api-restricted",
  ApiRestrictedDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_restricted",
      defaultConnectionLimit: 2,
      profile: "api-restricted",
    },
    prismaRuntime,
  );
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "../db/internal/contracts.js";
