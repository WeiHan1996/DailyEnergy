import "reflect-metadata";

import type { AddressInfo } from "node:net";
import {
  startApiTelemetry,
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
      readinessChecks.push(databaseReadiness);
    }
    const application = await createApiApplication(config, {
      readinessChecks,
      shutdownDrainHooks: [{ drain: () => telemetry?.shutdown() }],
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
