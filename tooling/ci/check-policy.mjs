#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  validateCiPolicy,
  validateTelemetryPolicy,
  validateTurboPolicy,
  validateWorkflow,
} from "./policy.mjs";
import { repositoryRoot } from "./runtime.mjs";

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.resolve(repositoryRoot, relativePath), "utf8"),
  );
}

const [
  policy,
  telemetry,
  turbo,
  packageDocument,
  nodeVersion,
  nvmVersion,
  workflow,
] = await Promise.all([
  readJson("tests/ci/policy.json"),
  readJson("tests/ci/telemetry-policy.json"),
  readJson("turbo.json"),
  readJson("package.json"),
  readFile(path.resolve(repositoryRoot, ".node-version"), "utf8"),
  readFile(path.resolve(repositoryRoot, ".nvmrc"), "utf8"),
  readFile(path.resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8"),
]);

const laneResult = validateCiPolicy(policy);
const telemetryResult = validateTelemetryPolicy(telemetry);
const cacheResult = validateTurboPolicy(turbo);
validateWorkflow(workflow, policy);

if (
  packageDocument.packageManager !== `pnpm@${policy.pnpm_version}` ||
  packageDocument.engines?.pnpm !== policy.pnpm_version ||
  packageDocument.engines?.node !== ">=24 <25" ||
  nodeVersion.trim() !== policy.node_version ||
  nvmVersion.trim() !== policy.node_version
) {
  throw new Error("CI_TOOLCHAIN_VERSION_DRIFT:root");
}

const external = policy.lanes
  .filter(({ execution }) => execution !== "AUTOMATED_REQUIRED")
  .map(({ execution, id }) => `${id}=${execution}`)
  .join(",");
console.log(
  `CI_POLICY_OK:lanes=${laneResult.lanes}:automated=${laneResult.automated}:external=${laneResult.external}:metrics=${telemetryResult.metrics}:series=${telemetryResult.totalSeries}:turbo_tasks=${cacheResult.tasks}`,
);
console.log(`CI_EXTERNAL_EVIDENCE_PENDING:${external}`);
