import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type TestingDatabaseCapability = DatabaseCapability<"testing">;

export function createTestingDatabaseFactory(): DatabaseFactory<
  "testing",
  TestingDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_test",
      defaultConnectionLimit: 4,
      profile: "testing",
    },
    prismaRuntime,
  );
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
  DatabaseProfile,
} from "../db/internal/contracts.js";
