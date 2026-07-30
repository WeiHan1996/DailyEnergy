import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type WorkerBackgroundDatabaseCapability =
  DatabaseCapability<"worker-background">;

export function createWorkerBackgroundDatabaseFactory(): DatabaseFactory<
  "worker-background",
  WorkerBackgroundDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_background",
      defaultConnectionLimit: 6,
      profile: "worker-background",
    },
    prismaRuntime,
  );
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "../db/internal/contracts.js";
