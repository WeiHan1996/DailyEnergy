import "reflect-metadata";

import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import {
  PostgresAuthStore,
  PostgresCheckinStore,
  PostgresConsentProfileStore,
  PostgresDailyGenerationStore,
  PostgresDailyInteractionStore,
  PostgresEveningStore,
  RedisDailyContentCache,
  UNAVAILABLE_DAILY_CONTENT_CACHE,
  startApiTelemetry,
  type AuthStore,
  type CheckinStore,
  type ConsentProfileStore,
  type DailyGenerationStore,
  type DailyInteractionStore,
  type EveningStore,
  type TelemetryRuntime,
} from "@daily-energy/server-adapters/api";

import {
  loadRuntimeConfig,
  RuntimeConfigError,
} from "./bootstrap/runtime-config.js";
import { ApiDatabaseReadiness } from "./bootstrap/database-readiness.js";
import { createApiApplication } from "./bootstrap/create-api-application.js";
import { ShutdownObserver } from "./bootstrap/shutdown-observer.js";
import { OrdinaryLogger } from "./observability/ordinary-logger.js";
import { startApiTelemetrySafely } from "./observability/telemetry-startup.js";

type StartupFailureReason =
  | RuntimeConfigError["reasonCode"]
  | "API_DATABASE_NOT_READY"
  | "API_STARTUP_FAILED";

class ApiStartupError extends Error {
  public constructor(public readonly reasonCode: StartupFailureReason) {
    super(reasonCode);
    this.name = "ApiStartupError";
  }
}

function writeStartupFailure(reasonCode: StartupFailureReason): void {
  process.stderr.write(
    `${JSON.stringify({
      contract_version: "ordinary-log-v1",
      message_code: "API_STARTUP_FAILED",
      operation_code: "API_LIFECYCLE",
      outcome_code: "TERMINAL",
      reason_code: reasonCode,
      runtime_profile: "API",
      service: "api",
      severity: "ERROR",
      timestamp: new Date().toISOString(),
    })}\n`,
  );
}

async function main(): Promise<void> {
  let telemetry: TelemetryRuntime | undefined;
  let authStore: AuthStore | undefined;
  let checkinStore: CheckinStore | undefined;
  let consentProfileStore: ConsentProfileStore | undefined;
  let dailyGenerationStore: DailyGenerationStore | undefined;
  let dailyInteractionStore: DailyInteractionStore | undefined;
  let eveningStore: EveningStore | undefined;
  try {
    const config = loadRuntimeConfig(process.env);
    telemetry = startApiTelemetrySafely(startApiTelemetry, {
      configSchemaVersion: config.configSchemaVersion,
      contractBundleVersion: config.contractBundleVersion,
      enabled: config.telemetry.enabled,
      environment: config.environment,
      metricsHost: config.telemetry.metricsHost,
      metricsPort: config.telemetry.metricsPort,
      otlpTraceUrl: config.telemetry.otlpTraceUrl,
      releaseId: config.releaseId,
      serviceVersion: "0.1.0",
    });
    const readinessChecks = [];
    if (config.databaseUrlFile !== undefined) {
      const databaseReadiness = new ApiDatabaseReadiness(
        config.databaseUrlFile,
      );
      if ((await databaseReadiness.check()).status !== "UP") {
        throw new ApiStartupError("API_DATABASE_NOT_READY");
      }
      const connectionString = (
        await readFile(config.databaseUrlFile, "utf8")
      ).trim();
      if (connectionString.length === 0) {
        throw new ApiStartupError("API_DATABASE_NOT_READY");
      }
      try {
        authStore = await PostgresAuthStore.connect({
          applicationName: "daily-energy:api:auth",
          connectionLimit: 4,
          connectionString,
          expectedDatabaseRole: "daily_energy_api",
        });
        consentProfileStore = await PostgresConsentProfileStore.connect({
          applicationName: "daily-energy:api:consent-profile",
          connectionLimit: 4,
          connectionString,
          expectedDatabaseRole: "daily_energy_api",
        });
        checkinStore = await PostgresCheckinStore.connect({
          applicationName: "daily-energy:api:checkin",
          connectionLimit: 4,
          connectionString,
          expectedDatabaseRole: "daily_energy_api",
        });
        let dailyContentCache = UNAVAILABLE_DAILY_CONTENT_CACHE;
        if (config.redisCache !== undefined) {
          dailyContentCache = await RedisDailyContentCache.connect({
            keyPrefix: config.redisCache.keyPrefix,
            redisUrl: config.redisCache.redisUrl,
          }).catch(() => UNAVAILABLE_DAILY_CONTENT_CACHE);
        }
        dailyGenerationStore = await PostgresDailyGenerationStore.connect({
          applicationName: "daily-energy:api:generation",
          cache: dailyContentCache,
          connectionLimit: 4,
          connectionString,
          expectedDatabaseRole: "daily_energy_api",
        });
        dailyInteractionStore = await PostgresDailyInteractionStore.connect({
          applicationName: "daily-energy:api:daily-interaction",
          connectionLimit: 4,
          connectionString,
          expectedDatabaseRole: "daily_energy_api",
        });
        eveningStore = await PostgresEveningStore.connect({
          applicationName: "daily-energy:api:evening",
          connectionLimit: 4,
          connectionString,
          expectedDatabaseRole: "daily_energy_api",
        });
      } catch {
        throw new ApiStartupError("API_DATABASE_NOT_READY");
      }
      readinessChecks.push(databaseReadiness);
    }
    const application = await createApiApplication(config, {
      ...(authStore === undefined ? {} : { authStore }),
      ...(checkinStore === undefined ? {} : { checkinStore }),
      ...(consentProfileStore === undefined ? {} : { consentProfileStore }),
      ...(dailyGenerationStore === undefined ? {} : { dailyGenerationStore }),
      ...(dailyInteractionStore === undefined ? {} : { dailyInteractionStore }),
      ...(eveningStore === undefined ? {} : { eveningStore }),
      readinessChecks,
      shutdownDrainHooks: [
        ...(authStore === undefined
          ? []
          : [{ drain: () => authStore?.close() }]),
        ...(consentProfileStore === undefined
          ? []
          : [{ drain: () => consentProfileStore?.close() }]),
        ...(checkinStore === undefined
          ? []
          : [{ drain: () => checkinStore?.close() }]),
        ...(dailyGenerationStore === undefined
          ? []
          : [{ drain: () => dailyGenerationStore?.close() }]),
        ...(dailyInteractionStore === undefined
          ? []
          : [{ drain: () => dailyInteractionStore?.close() }]),
        ...(eveningStore === undefined
          ? []
          : [{ drain: () => eveningStore?.close() }]),
        { drain: () => telemetry?.shutdown() },
      ],
      telemetryRuntime: telemetry,
    });
    const logger = application.get(OrdinaryLogger);
    await application.listen(config.port, config.host);
    const address = application.getHttpServer().address() as
      AddressInfo | string | null;
    application.get(ShutdownObserver).install(application);
    logger.write("INFO", {
      message_code: "API_STARTED",
      operation_code: "API_LIFECYCLE",
      outcome_code: "SUCCESS",
      reason_code: address === null ? "LISTENER_UNKNOWN" : "LISTENER_READY",
    });
  } catch (error) {
    await authStore?.close().catch(() => undefined);
    await checkinStore?.close().catch(() => undefined);
    await consentProfileStore?.close().catch(() => undefined);
    await dailyGenerationStore?.close().catch(() => undefined);
    await dailyInteractionStore?.close().catch(() => undefined);
    await eveningStore?.close().catch(() => undefined);
    await telemetry?.shutdown().catch(() => undefined);
    writeStartupFailure(
      error instanceof RuntimeConfigError
        ? error.reasonCode
        : error instanceof ApiStartupError
          ? error.reasonCode
          : "API_STARTUP_FAILED",
    );
    process.exitCode = 1;
  }
}

await main();
