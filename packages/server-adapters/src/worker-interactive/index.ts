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
