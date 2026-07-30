import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type WorkerRestrictedDatabaseCapability =
  DatabaseCapability<"worker-restricted">;

export function createWorkerRestrictedDatabaseFactory(): DatabaseFactory<
  "worker-restricted",
  WorkerRestrictedDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_restricted",
      defaultConnectionLimit: 4,
      profile: "worker-restricted",
    },
    prismaRuntime,
  );
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "../db/internal/contracts.js";
