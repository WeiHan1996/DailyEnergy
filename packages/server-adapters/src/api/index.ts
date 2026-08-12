import type { DatabaseFactory } from "../db/internal/contracts.js";
import {
  createClosedDatabaseFactory,
  type DatabaseCapability,
} from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";
import {
  startTelemetryRuntime,
  type TelemetryTransportConfig,
} from "../telemetry/runtime.js";

export type ApiDatabaseCapability = DatabaseCapability<"api">;

export function createApiDatabaseFactory(): DatabaseFactory<
  "api",
  ApiDatabaseCapability
> {
  return createClosedDatabaseFactory(
    {
      databaseRole: "daily_energy_api",
      defaultConnectionLimit: 10,
      profile: "api",
    },
    prismaRuntime,
  );
}

export function startApiTelemetry(config: TelemetryTransportConfig) {
  return startTelemetryRuntime({
    enabled: config.enabled,
    metricsHost: config.metricsHost,
    metricsPort: config.metricsPort,
    otlpTraceUrl: config.otlpTraceUrl,
    resource: {
      configSchemaVersion: config.configSchemaVersion,
      contractBundleVersion: config.contractBundleVersion,
      environment: config.environment,
      releaseId: config.releaseId,
      runtimeProfile: "API",
      service: "api",
      serviceVersion: config.serviceVersion,
    },
  });
}

export type {
  MetricName,
  TelemetryAttributes,
} from "../telemetry/contracts.js";
export type {
  TelemetryRuntime,
  TelemetrySpan,
  TelemetryTransportConfig,
} from "../telemetry/runtime.js";

export type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "../db/internal/contracts.js";
