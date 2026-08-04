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
const [lockfile, registry] = await Promise.all([
  readFile(path.resolve(repositoryRoot, "pnpm-lock.yaml")),
  readFile(
    path.resolve(repositoryRoot, "tests/registry/coverage-registry.json"),
    "utf8",
  ).then(JSON.parse),
]);
const lane = policy.lanes.find(({ id }) => id === laneId);
if (!lane || lane.execution !== "AUTOMATED_REQUIRED") {
  throw new Error(`CI_LANE_NOT_AUTOMATED:${laneId ?? "missing"}`);
}

const startedAt = new Date();
const outputDirectory = path.resolve(repositoryRoot, ".artifacts/ci", laneId);
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });

const [gitResult, branchResult, baseResult] = await Promise.all([
  runBounded("git", ["rev-parse", "HEAD"]),
  runBounded("git", ["branch", "--show-current"]),
  runBounded("git", ["merge-base", "HEAD", "origin/main"]),
]);
const localSha = gitResult.stdout.trim();
const testedSha =
  process.env.CI_TESTED_SHA || process.env.GITHUB_SHA || localSha;
const headSha = process.env.CI_HEAD_SHA || testedSha;
const baseSha = process.env.CI_BASE_SHA || baseResult.stdout.trim();
if (
  ![localSha, testedSha, headSha, baseSha].every((value) =>
    /^[a-f0-9]{40}$/u.test(value),
  ) ||
  testedSha !== localSha
) {
  throw new Error("CI_LANE_GIT_BINDING_INVALID:runtime");
}
const branch =
  process.env.CI_BRANCH ||
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  branchResult.stdout.trim() ||
  "detached";
const pullRequestText = process.env.CI_PULL_REQUEST_NUMBER ?? "";
const pullRequest = pullRequestText === "" ? null : Number(pullRequestText);
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
  .update(
    `node=${process.versions.node};pnpm=${pnpmResult.stdout.trim()};lockfile=${createHash("sha256").update(lockfile).digest("hex")};registry=${registry.registry_version}`,
  )
  .digest("hex");
const evidence = {
  artifact_version: "e-011-ci-lane-evidence-v2",
  repository: process.env.GITHUB_REPOSITORY ?? "WeiHan1996/DailyEnergy",
  event_name:
    process.env.CI_EVENT_NAME ?? process.env.GITHUB_EVENT_NAME ?? "local",
  branch,
  pull_request: pullRequest,
  head_sha: headSha,
  base_sha: baseSha,
  tested_sha: testedSha,
  started_at_utc: startedAt.toISOString(),
  ended_at_utc: endedAt.toISOString(),
  duration_ms: endedAt.valueOf() - startedAt.valueOf(),
  failure_code: failure ? "COMMAND_FAILED" : "NONE",
  next_action: failure ? "INSPECT_REDACTED_FAILURE_AND_RERUN" : "NONE",
  fixture_version: "synthetic-factory-v1",
  registry_version: registry.registry_version,
  result: failure ? "FAIL" : "PASS",
  runner_version: policy.runner,
  source_ids: lane.source_ids,
  lockfile_sha256: createHash("sha256").update(lockfile).digest("hex"),
  toolchain_fingerprint: toolchainFingerprint,
  tool_versions: {
    node: process.versions.node,
    pnpm: pnpmResult.stdout.trim(),
    ci_policy: policy.policy_version,
    ci_runner: "e-011-ci-runner-v2",
    artifact_scanner: "e-011-artifact-scanner-v2",
    source_registry: registry.registry_version,
  },
  lane_id: laneId,
  command_count: lane.commands.length,
  completed_command_count: completedCommands,
  failed_command_ordinal: failure?.index ?? null,
};
const diagnostics = findArtifactDiagnostics(evidence, artifactPolicy, {
  artifactName: "evidence.json",
  ciPolicy: policy,
  lane,
  registryVersion: registry.registry_version,
});
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
