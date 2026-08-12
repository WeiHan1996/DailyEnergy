import {
  fingerprintCapabilityManifest,
  startWorkerInteractiveTelemetry,
  workerInteractiveManifest,
} from "@daily-energy/server-adapters/worker-interactive";

import { createInteractiveWorkerEntrypoint } from "./entrypoints/interactive.js";
import { runWorker } from "./runtime-common.js";

await runWorker({
  capabilityFingerprint: fingerprintCapabilityManifest(
    workerInteractiveManifest,
  ),
  entrypoint: createInteractiveWorkerEntrypoint(),
  manifest: workerInteractiveManifest,
  telemetryFactory: startWorkerInteractiveTelemetry,
});
