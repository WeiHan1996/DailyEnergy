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
import { RESTRICTED_WORKER_MANIFEST } from "../queue/manifests.js";
import {
  startWorkerInfrastructure,
  type WorkerInfrastructureConfig,
  type WorkerInfrastructureRuntime,
} from "../queue/worker-runtime.js";

export type WorkerRestrictedDatabaseCapability =
  DatabaseCapability<"worker-restricted">;

export function createWorkerRestrictedDatabaseFactory(): DatabaseFactory<
  "worker-restricted",
  WorkerRestrictedDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_deletion",
      defaultConnectionLimit: 4,
      profile: "worker-restricted",
    },
    prismaRuntime,
  );
}

export const workerRestrictedManifest = RESTRICTED_WORKER_MANIFEST;
export { fingerprintCapabilityManifest } from "../queue/contracts.js";

export function startWorkerRestrictedInfrastructure(
  config: WorkerInfrastructureConfig,
  handlers: readonly QueueJobHandler[] = [],
  telemetry?: QueueTelemetrySink,
): Promise<WorkerInfrastructureRuntime> {
  return startWorkerInfrastructure({
    config,
    handlers,
    manifest: RESTRICTED_WORKER_MANIFEST,
    ...(telemetry ? { telemetry } : {}),
  });
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
