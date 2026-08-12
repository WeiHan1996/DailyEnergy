import type {
  DatabaseConnection,
  DatabaseFactory,
  QueueJobHandler,
  QueueTelemetrySink,
  WorkerInfrastructureConfig,
  WorkerInfrastructureRuntime,
} from "@daily-energy/server-adapters/worker-restricted";
import {
  createWorkerRestrictedDatabaseFactory,
  fingerprintCapabilityManifest,
  startWorkerRestrictedInfrastructure,
  startWorkerRestrictedTelemetry,
  workerRestrictedManifest,
} from "@daily-energy/server-adapters/worker-restricted";

export const restrictedTelemetryFactory = startWorkerRestrictedTelemetry;

export type WorkerInfrastructureStarter = (
  config: WorkerInfrastructureConfig,
  handlers: readonly QueueJobHandler[],
  telemetry?: QueueTelemetrySink,
) => Promise<WorkerInfrastructureRuntime>;

export interface WorkerProcess {
  readonly profile: "worker-restricted";
  readonly runtime: WorkerInfrastructureRuntime;
  drain(): Promise<void>;
}

export interface WorkerEntrypoint {
  readonly capabilityFingerprint: string;
  readonly profile: "worker-restricted";
  readonly capabilityFingerprintSource: typeof workerRestrictedManifest;
  start(
    config: WorkerInfrastructureConfig,
    telemetry?: QueueTelemetrySink,
  ): Promise<WorkerProcess>;
}

export function createRestrictedWorkerEntrypoint(
  databaseFactory: DatabaseFactory<
    "worker-restricted",
    unknown
  > = createWorkerRestrictedDatabaseFactory(),
  infrastructureStarter: WorkerInfrastructureStarter = startWorkerRestrictedInfrastructure,
  handlers: readonly QueueJobHandler[] = [],
): WorkerEntrypoint {
  return Object.freeze({
    capabilityFingerprint: fingerprintCapabilityManifest(
      workerRestrictedManifest,
    ),
    capabilityFingerprintSource: workerRestrictedManifest,
    profile: "worker-restricted",
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
  database: DatabaseConnection<"worker-restricted", unknown>,
  runtime: WorkerInfrastructureRuntime,
): WorkerProcess {
  let drained = false;
  return Object.freeze({
    profile: "worker-restricted",
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
