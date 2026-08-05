#!/usr/bin/env node
import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_RELEASE_CHECKS = Object.freeze([
  "E-011 automated full Gate",
  "automated (admin-e2e)",
  "automated (ai-deterministic)",
  "automated (api-e2e)",
  "automated (db-integration)",
  "automated (docs)",
  "automated (queue-integration)",
  "automated (resilience)",
  "automated (static)",
  "automated (unit-contract)",
  "supply-chain",
]);

const RELEASE_SHA = /^[a-f0-9]{40}$/u;

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function runIdFromDetailsUrl(url) {
  return /\/actions\/runs\/(\d{1,20})(?:\/|$)/u.exec(url ?? "")?.[1];
}

export function validateReleaseCiEvidence(releaseSha, checkRuns, workflowRun) {
  if (!RELEASE_SHA.test(releaseSha)) {
    fail("DEV_RELEASE_CI_SHA_INVALID", "release_sha");
  }
  if (!Array.isArray(checkRuns)) {
    fail("DEV_RELEASE_CI_CHECKS_INVALID", "checks");
  }
  const successfulByRun = new Map();
  for (const check of checkRuns) {
    const runId = runIdFromDetailsUrl(check.details_url);
    if (
      runId === undefined ||
      check.status !== "completed" ||
      check.conclusion !== "success" ||
      !REQUIRED_RELEASE_CHECKS.includes(check.name)
    ) {
      continue;
    }
    const names = successfulByRun.get(runId) ?? new Set();
    names.add(check.name);
    successfulByRun.set(runId, names);
  }
  const completeRunIds = [...successfulByRun.entries()]
    .filter(([, names]) =>
      REQUIRED_RELEASE_CHECKS.every((name) => names.has(name)),
    )
    .map(([runId]) => runId)
    .sort((left, right) => Number(right) - Number(left));
  if (completeRunIds.length === 0) {
    fail("DEV_RELEASE_CI_GATE_INCOMPLETE", "required-checks");
  }
  const runId = completeRunIds[0];
  if (
    String(workflowRun?.id) !== runId ||
    workflowRun.name !== "CI" ||
    workflowRun.head_sha !== releaseSha ||
    workflowRun.head_branch !== "main" ||
    workflowRun.status !== "completed" ||
    workflowRun.conclusion !== "success" ||
    !Number.isSafeInteger(workflowRun.run_attempt) ||
    workflowRun.run_attempt < 1 ||
    !["push", "workflow_dispatch"].includes(workflowRun.event)
  ) {
    fail("DEV_RELEASE_CI_RUN_INVALID", runId);
  }
  return Object.freeze({
    checks: REQUIRED_RELEASE_CHECKS.length,
    releaseSha,
    runAttempt: workflowRun.run_attempt,
    runId,
  });
}

async function githubJson(pathname, token) {
  let response;
  try {
    response = await fetch(`https://api.github.com${pathname}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "DailyEnergy-E012-release-gate",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    fail("DEV_RELEASE_CI_API_UNAVAILABLE", "network");
  }
  if (!response.ok) {
    fail("DEV_RELEASE_CI_API_UNAVAILABLE", `http-${response.status}`);
  }
  return response.json();
}

export async function verifyReleaseCiWithGitHub(releaseSha, environment) {
  const token = environment.GITHUB_TOKEN;
  if (
    environment.GITHUB_REPOSITORY !== "WeiHan1996/DailyEnergy" ||
    typeof token !== "string" ||
    token.length < 1
  ) {
    fail("DEV_RELEASE_CI_CONTEXT_INVALID", "repository-or-token");
  }
  const checks = await githubJson(
    `/repos/WeiHan1996/DailyEnergy/commits/${releaseSha}/check-runs?per_page=100`,
    token,
  );
  const candidateRunIds = [
    ...new Set(
      (checks.check_runs ?? [])
        .map(({ details_url: detailsUrl }) => runIdFromDetailsUrl(detailsUrl))
        .filter(Boolean),
    ),
  ].sort((left, right) => Number(right) - Number(left));
  for (const runId of candidateRunIds) {
    const workflowRun = await githubJson(
      `/repos/WeiHan1996/DailyEnergy/actions/runs/${runId}`,
      token,
    );
    try {
      return validateReleaseCiEvidence(
        releaseSha,
        checks.check_runs,
        workflowRun,
      );
    } catch (error) {
      if (!error.message.startsWith("DEV_RELEASE_CI_RUN_INVALID:")) {
        throw error;
      }
    }
  }
  fail("DEV_RELEASE_CI_GATE_INCOMPLETE", "no-valid-run");
}

async function main() {
  const [releaseSha, outputMode, outputFile] = process.argv.slice(2);
  if (
    releaseSha === undefined ||
    !(
      (outputMode === undefined && outputFile === undefined) ||
      (outputMode === "--github-output" && outputFile)
    )
  ) {
    fail("DEV_RELEASE_CI_USAGE", "release_sha [--github-output file]");
  }
  const result = await verifyReleaseCiWithGitHub(releaseSha, process.env);
  if (outputFile !== undefined) {
    await appendFile(
      outputFile,
      `ci_run_id=${result.runId}\nci_run_attempt=${result.runAttempt}\n`,
      { encoding: "utf8" },
    );
  }
  process.stdout.write(
    `DEV_RELEASE_CI_OK:sha=${result.releaseSha.slice(0, 12)}:run=${result.runId}:attempt=${result.runAttempt}:checks=${result.checks}\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
