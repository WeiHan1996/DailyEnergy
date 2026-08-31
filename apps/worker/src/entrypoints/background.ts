import type {
  DatabaseConnection,
  DatabaseFactory,
  QueueJobHandler,
  QueueTelemetrySink,
  WorkerInfrastructureConfig,
  WorkerInfrastructureRuntime,
} from "@daily-energy/server-adapters/worker-background";
import {
  createWorkerBackgroundDatabaseFactory,
  startWorkerBackgroundRuntime,
  workerBackgroundManifest,
} from "@daily-energy/server-adapters/worker-background";

export type WorkerInfrastructureStarter = (
  config: WorkerInfrastructureConfig,
  handlers: readonly QueueJobHandler[],
  telemetry?: QueueTelemetrySink,
) => Promise<WorkerInfrastructureRuntime>;

export interface WorkerProcess {
  readonly profile: "worker-background";
  readonly runtime: WorkerInfrastructureRuntime;
  drain(): Promise<void>;
}

export interface WorkerEntrypoint {
  readonly profile: "worker-background";
  readonly capabilityFingerprintSource: typeof workerBackgroundManifest;
  start(
    config: WorkerInfrastructureConfig,
    telemetry?: QueueTelemetrySink,
  ): Promise<WorkerProcess>;
}

export function createBackgroundWorkerEntrypoint(
  databaseFactory: DatabaseFactory<
    "worker-background",
    unknown
  > = createWorkerBackgroundDatabaseFactory(),
  infrastructureStarter: WorkerInfrastructureStarter = startWorkerBackgroundRuntime,
  handlers: readonly QueueJobHandler[] = [],
): WorkerEntrypoint {
  return Object.freeze({
    capabilityFingerprintSource: workerBackgroundManifest,
    profile: "worker-background",
    async start(
      config: WorkerInfrastructureConfig,
      telemetry?: QueueTelemetrySink,
    ): Promise<WorkerProcess> {
      const database = await databaseFactory.connect(config.database);
      let runtime: WorkerInfrastructureRuntime;
      try {
        runtime = await infrastructureStarter(
          config,
          handlers,
          ...(telemetry === undefined ? [] : [telemetry]),
        );
      } catch (error) {
        await database.disconnect();
        throw error;
      }
      return createWorkerProcess(database, runtime);
    },
  });
}

function createWorkerProcess(
  database: DatabaseConnection<"worker-background", unknown>,
  runtime: WorkerInfrastructureRuntime,
): WorkerProcess {
  let drained = false;
  return Object.freeze({
    profile: "worker-background",
    runtime,
    async drain(): Promise<void> {
      if (drained) {
        return;
      }
      drained = true;
      try {
        await runtime.drain();
      } finally {
        await database.disconnect();
      }
    },
  });
}
