import {
  fingerprintCapabilityManifest,
  workerBackgroundManifest,
} from "@daily-energy/server-adapters/worker-background";

import { createBackgroundWorkerEntrypoint } from "./entrypoints/background.js";
import { runWorker } from "./runtime-common.js";

await runWorker({
  capabilityFingerprint: fingerprintCapabilityManifest(
    workerBackgroundManifest,
  ),
  entrypoint: createBackgroundWorkerEntrypoint(),
  manifest: workerBackgroundManifest,
});
