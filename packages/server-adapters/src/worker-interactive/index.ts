import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";
import type {
  QueueJobHandler,
  QueueTelemetrySink,
} from "../queue/contracts.js";
import { INTERACTIVE_WORKER_MANIFEST } from "../queue/manifests.js";
import {
  startWorkerInfrastructure,
  type WorkerInfrastructureConfig,
  type WorkerInfrastructureRuntime,
} from "../queue/worker-runtime.js";
import { createQueueTelemetrySink } from "../telemetry/queue-sink.js";
import {
  startTelemetryRuntime,
  type TelemetryTransportConfig,
} from "../telemetry/runtime.js";
import { createInteractiveGenerationHandlers } from "../generation/interactive-generation-handler.js";
import { PostgresDailyGenerationRuntime } from "../generation/postgres-daily-generation-runtime.js";

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

export const workerInteractiveManifest = INTERACTIVE_WORKER_MANIFEST;
export { fingerprintCapabilityManifest } from "../queue/contracts.js";

export function startWorkerInteractiveInfrastructure(
  config: WorkerInfrastructureConfig,
  handlers: readonly QueueJobHandler[] = [],
  telemetry?: QueueTelemetrySink,
): Promise<WorkerInfrastructureRuntime> {
  return startWorkerInfrastructure({
    config,
    handlers,
    manifest: INTERACTIVE_WORKER_MANIFEST,
    ...(telemetry ? { telemetry } : {}),
  });
}

export async function startWorkerInteractiveRuntime(
  config: WorkerInfrastructureConfig,
  handlers: readonly QueueJobHandler[] = [],
  telemetry?: QueueTelemetrySink,
): Promise<WorkerInfrastructureRuntime> {
  if (handlers.length > 0) {
    return startWorkerInteractiveInfrastructure(config, handlers, telemetry);
  }
  const generation = await PostgresDailyGenerationRuntime.connect({
    applicationName: `${config.database.applicationName ?? "daily-energy:worker-interactive"}:generation`,
    connectionString: config.database.connectionString,
    expectedDatabaseRole: INTERACTIVE_WORKER_MANIFEST.databaseRole,
    ...(config.database.connectionLimit === undefined
      ? {}
      : { connectionLimit: config.database.connectionLimit }),
  });
  let infrastructure: WorkerInfrastructureRuntime;
  try {
    infrastructure = await startWorkerInteractiveInfrastructure(
      config,
      createInteractiveGenerationHandlers(generation),
      telemetry,
    );
  } catch (error) {
    await generation.close();
    throw error;
  }
  let closed = false;
  return Object.freeze({
    manifest: infrastructure.manifest,
    async drain(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      try {
        await infrastructure.drain();
      } finally {
        await generation.close();
      }
    },
    rebuild(limit?: number) {
      return infrastructure.rebuild(limit);
    },
    relayOnce(options?: {
      readonly batchSize?: number;
      readonly maxAttempts?: number;
    }) {
      return infrastructure.relayOnce(options);
    },
  });
}

export function startWorkerInteractiveTelemetry(
  config: TelemetryTransportConfig,
) {
  const runtime = startTelemetryRuntime({
    enabled: config.enabled,
    metricsHost: config.metricsHost,
    metricsPort: config.metricsPort,
    otlpTraceUrl: config.otlpTraceUrl,
    resource: {
      configSchemaVersion: config.configSchemaVersion,
      contractBundleVersion: config.contractBundleVersion,
      environment: config.environment,
      releaseId: config.releaseId,
      runtimeProfile: "INTERACTIVE",
      service: "interactive",
      serviceVersion: config.serviceVersion,
    },
  });
  return Object.freeze({ runtime, sink: createQueueTelemetrySink(runtime) });
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "../db/internal/contracts.js";
export type {
  QueueJobHandler,
  QueueTelemetryEvent,
  QueueTelemetrySink,
  QueueTransaction,
  QueueTransactionResult,
  VersionedJobEnvelope,
  WorkerCapabilityManifest,
} from "../queue/contracts.js";
export type {
  WorkerInfrastructureConfig,
  WorkerInfrastructureRuntime,
} from "../queue/worker-runtime.js";
export type {
  TelemetryRuntime,
  TelemetryTransportConfig,
} from "../telemetry/runtime.js";

export {
  PostgresGenerationManifestStore,
  type PostgresGenerationManifestStoreConfig,
} from "../generation/postgres-generation-manifest-store.js";
