import type {
  DatabaseConnection,
  DatabaseFactory,
  QueueJobHandler,
  QueueTelemetrySink,
  WorkerInfrastructureConfig,
  WorkerInfrastructureRuntime,
} from "@daily-energy/server-adapters/worker-interactive";
import {
  createWorkerInteractiveDatabaseFactory,
  startWorkerInteractiveRuntime,
  workerInteractiveManifest,
} from "@daily-energy/server-adapters/worker-interactive";

export type WorkerInfrastructureStarter = (
  config: WorkerInfrastructureConfig,
  handlers: readonly QueueJobHandler[],
  telemetry?: QueueTelemetrySink,
) => Promise<WorkerInfrastructureRuntime>;

export interface WorkerProcess {
  readonly profile: "worker-interactive";
  readonly runtime: WorkerInfrastructureRuntime;
  drain(): Promise<void>;
}

export interface WorkerEntrypoint {
  readonly profile: "worker-interactive";
  readonly capabilityFingerprintSource: typeof workerInteractiveManifest;
  start(
    config: WorkerInfrastructureConfig,
    telemetry?: QueueTelemetrySink,
  ): Promise<WorkerProcess>;
}

export function createInteractiveWorkerEntrypoint(
  databaseFactory: DatabaseFactory<
    "worker-interactive",
    unknown
  > = createWorkerInteractiveDatabaseFactory(),
  infrastructureStarter: WorkerInfrastructureStarter = startWorkerInteractiveRuntime,
  handlers: readonly QueueJobHandler[] = [],
): WorkerEntrypoint {
  return Object.freeze({
    capabilityFingerprintSource: workerInteractiveManifest,
    profile: "worker-interactive",
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
  database: DatabaseConnection<"worker-interactive", unknown>,
  runtime: WorkerInfrastructureRuntime,
): WorkerProcess {
  let drained = false;
  return Object.freeze({
    profile: "worker-interactive",
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
