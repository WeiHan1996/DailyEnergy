#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateRepositoryControls } from "./policy.mjs";
import {
  boundedFailureSummary,
  repositoryRoot,
  runBounded,
} from "./runtime.mjs";

const policy = JSON.parse(
  await readFile(path.resolve(repositoryRoot, "tests/ci/policy.json"), "utf8"),
);
const repository = policy.merge_gate.repository;

async function ghApi(endpoint) {
  const result = await runBounded("gh", ["api", endpoint]);
  if (result.code !== 0) {
    throw new Error(
      `CI_REPOSITORY_CONTROL_QUERY_FAILED:${endpoint}:${boundedFailureSummary(result, 8)}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`CI_REPOSITORY_CONTROL_QUERY_INVALID:${endpoint}`);
  }
}

async function ghEnabled(endpoint) {
  const result = await runBounded("gh", ["api", endpoint]);
  return result.code === 0;
}

const [
  repositoryDocument,
  rulesets,
  actionsPermissions,
  forkPullRequestApproval,
  vulnerabilityAlertsEnabled,
  automatedSecurityFixesEnabled,
] = await Promise.all([
  ghApi(`repos/${repository}`),
  ghApi(`repos/${repository}/rulesets`),
  ghApi(`repos/${repository}/actions/permissions`),
  ghApi(`repos/${repository}/actions/permissions/fork-pr-contributor-approval`),
  ghEnabled(`repos/${repository}/vulnerability-alerts`),
  ghEnabled(`repos/${repository}/automated-security-fixes`),
]);
const rulesetSummary = rulesets.filter(
  ({ name }) => name === policy.repository_controls.ruleset_name,
);
if (rulesetSummary.length !== 1) {
  throw new Error(
    `CI_REPOSITORY_RULESET_COUNT_INVALID:${rulesetSummary.length}`,
  );
}
const mainRuleset = await ghApi(
  `repos/${repository}/rulesets/${rulesetSummary[0].id}`,
);

const result = validateRepositoryControls(
  {
    actionsPermissions,
    automatedSecurityFixesEnabled,
    forkPullRequestApproval,
    mainRuleset,
    repository: repositoryDocument,
    vulnerabilityAlertsEnabled,
  },
  policy,
);
console.log(
  `CI_REPOSITORY_CONTROLS_OK:repository=${result.repository}:visibility=${result.visibility}:ruleset=${result.ruleset}:checks=${result.checks}`,
);
