import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type WorkerInteractiveDatabaseCapability =
  DatabaseCapability<"worker-interactive">;

export function createWorkerInteractiveDatabaseFactory(): DatabaseFactory<
  "worker-interactive",
  WorkerInteractiveDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_interactive",
      defaultConnectionLimit: 8,
      profile: "worker-interactive",
    },
    prismaRuntime,
  );
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "../db/internal/contracts.js";
