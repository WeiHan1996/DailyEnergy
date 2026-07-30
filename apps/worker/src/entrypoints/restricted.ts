import type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "@daily-energy/server-adapters/worker-restricted";
import { createWorkerRestrictedDatabaseFactory } from "@daily-energy/server-adapters/worker-restricted";

export interface WorkerEntrypoint {
  readonly profile: "worker-restricted";
  start(
    config: DatabaseFactoryConfig,
  ): Promise<DatabaseConnection<"worker-restricted", unknown>>;
}

export function createRestrictedWorkerEntrypoint(
  databaseFactory: DatabaseFactory<
    "worker-restricted",
    unknown
  > = createWorkerRestrictedDatabaseFactory(),
): WorkerEntrypoint {
  return Object.freeze({
    profile: "worker-restricted",
    start(config: DatabaseFactoryConfig) {
      return databaseFactory.connect(config);
    },
  });
}
