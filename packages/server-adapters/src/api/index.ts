import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type ApiDatabaseCapability = DatabaseCapability<"api">;

export function createApiDatabaseFactory(): DatabaseFactory<
  "api",
  ApiDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_api",
      defaultConnectionLimit: 10,
      profile: "api",
    },
    prismaRuntime,
  );
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "../db/internal/contracts.js";
