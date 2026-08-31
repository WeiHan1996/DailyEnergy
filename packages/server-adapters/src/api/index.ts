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

export {
  PostgresAuthStore,
  type AuthAccountState,
  type AuthSessionView,
  type AuthStore,
  type NewAccountMaterial,
  type NewSessionMaterial,
  type PostgresAuthStoreConfig,
  type ProtectedExternalIdentity,
  type SessionInspection,
  type SessionRevocation,
} from "../auth/postgres-auth-store.js";

export {
  PostgresCheckinStore,
  UNAVAILABLE_CHECKIN_STORE,
  type CheckinGuardFailure,
  type CheckinMutationResult,
  type CheckinQueryResult,
  type CheckinStore,
  type PostgresCheckinStoreConfig,
  type StoredCheckinEnergy,
  type StoredCheckinMood,
  type StoredCheckinSleep,
  type StoredCheckinView,
} from "../checkin/postgres-checkin-store.js";

export {
  CURRENT_NECESSARY_CONSENT_NOTICE_VERSION,
  PostgresConsentProfileStore,
  UNAVAILABLE_CONSENT_PROFILE_STORE,
  type ConsentProfileStore,
  type PostgresConsentProfileStoreConfig,
  type ProtectedPreferredName,
  type StoredConsentView,
  type StoredExpressionStyle,
  type StoredMemoryPreferencesView,
  type StoredNotificationSettingsView,
  type StoredPermission,
  type StoredProfileView,
  type StoreMutation,
} from "../consent-profile/postgres-consent-profile-store.js";

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
