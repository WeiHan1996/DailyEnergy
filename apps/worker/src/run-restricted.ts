import { createRestrictedWorkerEntrypoint } from "./entrypoints/restricted.js";
import { runWorker } from "./runtime-common.js";

const entrypoint = createRestrictedWorkerEntrypoint();

await runWorker({
  capabilityFingerprint: entrypoint.capabilityFingerprint,
  entrypoint,
  manifest: entrypoint.capabilityFingerprintSource,
});
