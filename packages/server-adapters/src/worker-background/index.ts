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
import { BACKGROUND_WORKER_MANIFEST } from "../queue/manifests.js";
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
import { createDayLitHandlers } from "../relationship/day-lit-handler.js";
import { createWeeklyHandlers } from "../weekly/weekly-handler.js";
import { createAnalyticsHandlers } from "../analytics/analytics-handler.js";
export {
  PostgresAnalyticsStore,
  type AnalyticsBatchStore,
  type PostgresAnalyticsStoreConfig,
} from "../analytics/postgres-analytics-store.js";

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

export const workerBackgroundManifest = BACKGROUND_WORKER_MANIFEST;
export { fingerprintCapabilityManifest } from "../queue/contracts.js";

export function startWorkerBackgroundInfrastructure(
  config: WorkerInfrastructureConfig,
  handlers: readonly QueueJobHandler[] = [],
  telemetry?: QueueTelemetrySink,
): Promise<WorkerInfrastructureRuntime> {
  return startWorkerInfrastructure({
    config,
    handlers,
    manifest: BACKGROUND_WORKER_MANIFEST,
    ...(telemetry ? { telemetry } : {}),
  });
}

export function startWorkerBackgroundRuntime(
  config: WorkerInfrastructureConfig,
  handlers: readonly QueueJobHandler[] = [],
  telemetry?: QueueTelemetrySink,
): Promise<WorkerInfrastructureRuntime> {
  return startWorkerBackgroundInfrastructure(
    config,
    handlers.length > 0 ? handlers : createWorkerBackgroundHandlers(),
    telemetry,
  );
}

export { createDayLitHandlers } from "../relationship/day-lit-handler.js";
export { createWeeklyHandlers } from "../weekly/weekly-handler.js";
export { createAnalyticsHandlers } from "../analytics/analytics-handler.js";

export function createWorkerBackgroundHandlers(): readonly QueueJobHandler[] {
  return Object.freeze([
    ...createAnalyticsHandlers(),
    ...createDayLitHandlers(),
    ...createWeeklyHandlers(),
  ]);
}

export function startWorkerBackgroundTelemetry(
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
      runtimeProfile: "BACKGROUND",
      service: "background",
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
