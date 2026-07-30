import type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "@daily-energy/server-adapters/worker-background";
import { createWorkerBackgroundDatabaseFactory } from "@daily-energy/server-adapters/worker-background";

export interface WorkerEntrypoint {
  readonly profile: "worker-background";
  start(
    config: DatabaseFactoryConfig,
  ): Promise<DatabaseConnection<"worker-background", unknown>>;
}

export function createBackgroundWorkerEntrypoint(
  databaseFactory: DatabaseFactory<
    "worker-background",
    unknown
  > = createWorkerBackgroundDatabaseFactory(),
): WorkerEntrypoint {
  return Object.freeze({
    profile: "worker-background",
    start(config: DatabaseFactoryConfig) {
      return databaseFactory.connect(config);
    },
  });
}
