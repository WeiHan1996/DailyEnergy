import type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "@daily-energy/server-adapters/worker-interactive";
import { createWorkerInteractiveDatabaseFactory } from "@daily-energy/server-adapters/worker-interactive";

export interface WorkerEntrypoint {
  readonly profile: "worker-interactive";
  start(
    config: DatabaseFactoryConfig,
  ): Promise<DatabaseConnection<"worker-interactive", unknown>>;
}

export function createInteractiveWorkerEntrypoint(
  databaseFactory: DatabaseFactory<
    "worker-interactive",
    unknown
  > = createWorkerInteractiveDatabaseFactory(),
): WorkerEntrypoint {
  return Object.freeze({
    profile: "worker-interactive",
    start(config: DatabaseFactoryConfig) {
      return databaseFactory.connect(config);
    },
  });
}
