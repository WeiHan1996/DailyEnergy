#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

import { validatePrMergeGate } from "./policy.mjs";
import {
  boundedFailureSummary,
  repositoryRoot,
  runBounded,
} from "./runtime.mjs";

const [pullRequestNumber, expectedHeadSha] = process.argv.slice(2);
if (!/^\d+$/u.test(pullRequestNumber ?? "")) {
  throw new Error("CI_PR_MERGE_GATE_PR_INVALID:argument");
}

const policy = JSON.parse(
  await readFile(path.resolve(repositoryRoot, "tests/ci/policy.json"), "utf8"),
);
const execution = await runBounded("gh", [
  "pr",
  "view",
  pullRequestNumber,
  "--repo",
  policy.merge_gate.repository,
  "--json",
  [
    "baseRefName",
    "headRefOid",
    "isDraft",
    "mergeable",
    "mergeStateStatus",
    "number",
    "state",
    "statusCheckRollup",
  ].join(","),
]);
if (execution.code !== 0) {
  throw new Error(
    `CI_PR_MERGE_GATE_QUERY_FAILED:${boundedFailureSummary(execution, 10)}`,
  );
}

let pullRequest;
try {
  pullRequest = JSON.parse(execution.stdout);
} catch {
  throw new Error("CI_PR_MERGE_GATE_QUERY_INVALID:json");
}

const result = validatePrMergeGate(pullRequest, policy, expectedHeadSha);
console.log(
  `CI_PR_MERGE_GATE_OK:pr=${result.pullRequest}:head=${result.headSha}:run=${result.runId}:checks=${result.checks}`,
);
