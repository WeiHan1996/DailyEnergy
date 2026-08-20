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

async function ghApi(endpoint, jqExpression) {
  const arguments_ = ["api", endpoint];
  if (jqExpression) {
    arguments_.push("--jq", jqExpression);
  }
  const result = await runBounded("gh", arguments_);
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
  ghApi(
    `repos/${repository}`,
    "{allow_auto_merge,allow_merge_commit,allow_rebase_merge,allow_squash_merge,default_branch,full_name,license,private,security_and_analysis:{push_protection_status:.security_and_analysis.secret_scanning_push_protection.status,scanning_status:.security_and_analysis.secret_scanning.status},visibility}",
  ),
  ghApi(`repos/${repository}/rulesets`, "[.[] | {enforcement,id,name,target}]"),
  ghApi(`repos/${repository}/actions/permissions`, "{enabled}"),
  ghApi(
    `repos/${repository}/actions/permissions/fork-pr-contributor-approval`,
    "{approval_policy}",
  ),
  ghEnabled(`repos/${repository}/vulnerability-alerts`),
  ghEnabled(`repos/${repository}/automated-security-fixes`),
]);
repositoryDocument.security_and_analysis = {
  secret_scanning: {
    status: repositoryDocument.security_and_analysis.scanning_status,
  },
  secret_scanning_push_protection: {
    status: repositoryDocument.security_and_analysis.push_protection_status,
  },
};
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
  "{bypass_actors,conditions,enforcement,name,rules,source_type,target}",
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
