#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { findArtifactDiagnostics } from "./policy.mjs";
import {
  boundedFailureSummary,
  repositoryRoot,
  runBounded,
} from "./runtime.mjs";

const laneId = process.argv[2];
const policy = JSON.parse(
  await readFile(path.resolve(repositoryRoot, "tests/ci/policy.json"), "utf8"),
);
const artifactPolicy = JSON.parse(
  await readFile(
    path.resolve(repositoryRoot, "tests/artifacts/policy.json"),
    "utf8",
  ),
);
const lane = policy.lanes.find(({ id }) => id === laneId);
if (!lane || lane.execution !== "AUTOMATED_REQUIRED") {
  throw new Error(`CI_LANE_NOT_AUTOMATED:${laneId ?? "missing"}`);
}

const startedAt = new Date();
const outputDirectory = path.resolve(repositoryRoot, ".artifacts/ci", laneId);
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });

const gitResult = await runBounded("git", ["rev-parse", "HEAD"]);
const commitSha = /^[a-f0-9]{40}$/u.test(process.env.GITHUB_SHA ?? "")
  ? process.env.GITHUB_SHA
  : gitResult.stdout.trim();
const pnpmResult = await runBounded("pnpm", ["--version"]);
if (pnpmResult.code !== 0 || pnpmResult.stdout.trim() !== policy.pnpm_version) {
  throw new Error("CI_LANE_PNPM_VERSION_DRIFT:runtime");
}
if (
  process.env.CI === "true" &&
  process.versions.node !== policy.node_version
) {
  throw new Error("CI_LANE_NODE_VERSION_DRIFT:runtime");
}

let completedCommands = 0;
let failure;
for (const [index, [command, ...arguments_]] of lane.commands.entries()) {
  const result = await runBounded(command, arguments_);
  if (result.code !== 0) {
    failure = { index: index + 1, result };
    break;
  }
  completedCommands += 1;
  console.log(`CI_COMMAND_OK:${laneId}:${index + 1}/${lane.commands.length}`);
}

const endedAt = new Date();
const toolchainFingerprint = createHash("sha256")
  .update(`node=${process.versions.node};pnpm=${pnpmResult.stdout.trim()}`)
  .digest("hex");
const evidence = {
  artifact_version: "e-011-ci-lane-evidence-v1",
  commit_sha: commitSha,
  duration_ms: endedAt.valueOf() - startedAt.valueOf(),
  failure_code: failure ? "COMMAND_FAILED" : "NONE",
  fixture_version: "synthetic-factory-v1",
  result: failure ? "FAIL" : "PASS",
  runner_version: policy.runner,
  source_ids: ["S31-TEST-008", "S31-TEST-047"],
  started_at_utc: startedAt.toISOString(),
  toolchain_fingerprint: toolchainFingerprint,
  lane_id: laneId,
  command_count: lane.commands.length,
  completed_command_count: completedCommands,
  failed_command_ordinal: failure?.index ?? null,
};
const diagnostics = findArtifactDiagnostics(evidence, artifactPolicy);
if (diagnostics.length > 0) {
  throw new Error(diagnostics.join("\n"));
}
await writeFile(
  path.resolve(outputDirectory, "evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);

if (failure) {
  const summary = boundedFailureSummary(failure.result);
  const summaryHash = createHash("sha256").update(summary).digest("hex");
  process.stderr.write(
    `CI_LANE_COMMAND_FAILED:${laneId}:${failure.index}:diagnostic_sha256=${summaryHash}\n${summary}\n`,
  );
  process.exitCode = 1;
} else {
  console.log(`CI_LANE_OK:${laneId}:commands=${completedCommands}`);
}
