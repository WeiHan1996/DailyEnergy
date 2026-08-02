import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type TestingDatabaseCapability = DatabaseCapability<"testing">;

export function createTestingDatabaseFactory(): DatabaseFactory<
  "testing",
  TestingDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_test",
      defaultConnectionLimit: 4,
      profile: "testing",
    },
    prismaRuntime,
  );
}

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
  DatabaseProfile,
} from "../db/internal/contracts.js";

export {
  BullMqConsumer,
  BullMqProducer,
  DEFAULT_JOB_OPTIONS,
} from "../queue/bullmq-runtime.js";
export { parseQueueRuntimeConfig } from "../queue/config.js";
export {
  fingerprintCapabilityManifest,
  handlerKey,
  parseVersionedJobEnvelope,
  QueueContractError,
  QueueRetryableError,
  QueueTerminalError,
} from "../queue/contracts.js";
export {
  BACKGROUND_WORKER_MANIFEST,
  INTERACTIVE_WORKER_MANIFEST,
  RESTRICTED_WORKER_MANIFEST,
  routeForEvent,
  WORKER_MANIFESTS,
} from "../queue/manifests.js";
export { OutboxRelay, OutboxRelayCrashError } from "../queue/outbox-relay.js";
export { PostgresQueueStore } from "../queue/postgres-store.js";
export { RedisLossRebuilder } from "../queue/redis-loss-rebuilder.js";
export { startWorkerInfrastructure } from "../queue/worker-runtime.js";
export type { QueueRuntimeConfig } from "../queue/config.js";
export type {
  QueueConsumerFaultHooks,
  QueueEnqueueOptions,
  QueueProducerPort,
} from "../queue/bullmq-runtime.js";
export type {
  HandlerCapability,
  QueueFamily,
  QueueJobHandler,
  QueueTelemetryEvent,
  QueueTelemetrySink,
  QueueTransaction,
  QueueTransactionResult,
  VersionedJobEnvelope,
  WorkerCapabilityManifest,
  WorkerProfile,
} from "../queue/contracts.js";
export type {
  OutboxRelayFaultHooks,
  OutboxRelayResult,
  OutboxRelayStore,
} from "../queue/outbox-relay.js";
export type {
  InboxConsumeResult,
  OutboxClaimBatch,
  PostgresQueueStoreConfig,
} from "../queue/postgres-store.js";
export type {
  RedisRebuildResult,
  RedisRebuildStore,
} from "../queue/redis-loss-rebuilder.js";
export type {
  WorkerInfrastructureConfig,
  WorkerInfrastructureRuntime,
} from "../queue/worker-runtime.js";
