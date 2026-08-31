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
  PostgresProductTimeStore,
  type PostgresProductTimeStoreConfig,
} from "../product-time/postgres-product-time-store.js";

export {
  PostgresDailyGenerationStore,
  UNAVAILABLE_DAILY_GENERATION_STORE,
  type DailyGenerationStore,
  type GenerationGuardFailure,
  type HistoryDayQueryResult,
  type GenerationIntentQueryResult,
  type GenerationStartResult,
  type PostgresDailyGenerationStoreConfig,
  type TodayQueryResult,
} from "../generation/postgres-daily-generation-store.js";

export {
  PostgresDailyInteractionStore,
  UNAVAILABLE_DAILY_INTERACTION_STORE,
  type DailyInteractionGuardFailure,
  type DailyInteractionQueryResult,
  type DailyInteractionStore,
  type DailyLightMutationResult,
  type DailyTaskMutationResult,
  type HistoryListQueryResult,
  type PostgresDailyInteractionStoreConfig,
} from "../daily-interaction/postgres-daily-interaction-store.js";
export {
  PostgresEveningStore,
  UNAVAILABLE_EVENING_STORE,
  type EveningGuardFailure,
  type EveningQueryResult,
  type EveningSaveResult,
  type EveningStore,
  type PostgresEveningStoreConfig,
  type ProtectedEveningNote,
  type StoredEveningView,
} from "../evening/postgres-evening-store.js";
export {
  PostgresWeeklyStore,
  UNAVAILABLE_WEEKLY_STORE,
  type PostgresWeeklyStoreConfig,
  type WeeklyGuardFailure,
  type WeeklyQueryResult,
  type WeeklyStore,
} from "../weekly/postgres-weekly-store.js";
export {
  DataRightsStoreError,
  PostgresDataRightsStore,
  UNAVAILABLE_DATA_RIGHTS_STORE,
  type DataRightsStore,
  type DataRightsStoreErrorCode,
  type PostgresDataRightsStoreConfig,
  type StoredAccountDeletionAccepted,
} from "../data-rights/postgres-data-rights-store.js";
export type {
  ExportArtifactReadResult,
  ProtectedExportText,
  StoredDataExportSource,
  StoredExportDay,
  StoredExportEvening,
  StoredExportMatter,
  StoredExportProfile,
} from "../data-rights/data-export-source.js";
export {
  RedisDailyContentCache,
  UNAVAILABLE_DAILY_CONTENT_CACHE,
  type DailyContentCache,
  type DailyContentCacheIdentity,
} from "../generation/daily-content-cache.js";

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

export {
  DEVELOPMENT_SUBJECT_KEY_VERSION,
  developmentSubjectLookupToken,
  protectDevelopmentSubject,
} from "../identity/development-protected-subject.js";
