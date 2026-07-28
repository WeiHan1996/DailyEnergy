import "reflect-metadata";

import type { AddressInfo } from "node:net";

import {
  loadRuntimeConfig,
  RuntimeConfigError,
} from "./bootstrap/runtime-config.js";
import { createApiApplication } from "./bootstrap/create-api-application.js";
import { ShutdownObserver } from "./bootstrap/shutdown-observer.js";
import { OrdinaryLogger } from "./observability/ordinary-logger.js";

type StartupFailureReason =
  RuntimeConfigError["reasonCode"] | "API_STARTUP_FAILED";

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
  try {
    const config = loadRuntimeConfig(process.env);
    const application = await createApiApplication(config);
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
    writeStartupFailure(
      error instanceof RuntimeConfigError
        ? error.reasonCode
        : "API_STARTUP_FAILED",
    );
    process.exitCode = 1;
  }
}

await main();
