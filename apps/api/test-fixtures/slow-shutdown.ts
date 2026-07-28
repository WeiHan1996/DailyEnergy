import "reflect-metadata";

import type { AddressInfo } from "node:net";

import { createApiApplication } from "../src/bootstrap/create-api-application.js";
import { loadRuntimeConfig } from "../src/bootstrap/runtime-config.js";
import { ShutdownObserver } from "../src/bootstrap/shutdown-observer.js";
import { OrdinaryLogger } from "../src/observability/ordinary-logger.js";

const config = loadRuntimeConfig(process.env);
const application = await createApiApplication(config, {
  shutdownDrainHooks: [
    {
      drain: () => new Promise<void>(() => undefined),
    },
  ],
});
await application.listen(config.port, config.host);
const logger = application.get(OrdinaryLogger);
const address = application.getHttpServer().address() as
  AddressInfo | string | null;
logger.write("INFO", {
  message_code: "API_STARTED",
  operation_code: "API_LIFECYCLE",
  outcome_code: "SUCCESS",
  reason_code: address === null ? "LISTENER_UNKNOWN" : "LISTENER_READY",
});
application.get(ShutdownObserver).install(application);
