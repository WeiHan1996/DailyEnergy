import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse } from "yaml";

import {
  boundedDiagnosticOutput,
  contextDiagnostics,
  dependencyDiagnostics,
  redactDiagnosticOutput,
  resolveProfileOverride,
  selectChangedValidation,
  selectTaskRule,
} from "./lib/agent-workflow.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const [fixture, authority, policy] = await Promise.all([
  readFile(
    resolve(repositoryRoot, "tests/agent-workflow/cases.json"),
    "utf8",
  ).then(JSON.parse),
  readFile(
    resolve(repositoryRoot, "docs/agent/authority-index.yaml"),
    "utf8",
  ).then(parse),
  readFile(
    resolve(repositoryRoot, "docs/agent/validation-policy.yaml"),
    "utf8",
  ).then(parse),
]);
const failures = [];

function expectEqual(id, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(
      `${id}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

for (const testCase of fixture.contextCases) {
  const diagnostics = contextDiagnostics(testCase);
  expectEqual(
    testCase.id,
    diagnostics.map(({ ruleId }) => ruleId),
    testCase.expectedRuleIds,
  );
}

for (const testCase of fixture.dependencyCases) {
  const diagnostics = dependencyDiagnostics({
    completedStates: policy.completedStates,
    dependencies: policy.dependencies,
    taskId: testCase.taskId,
    taskStates: new Map(Object.entries(testCase.states)),
  });
  expectEqual(
    testCase.id,
    diagnostics.map(({ ruleId }) => ruleId),
    testCase.expectedRuleIds,
  );
}

for (const testCase of fixture.routeCases) {
  const rule = selectTaskRule(testCase.taskId, authority.taskRules);
  expectEqual(testCase.id, rule?.profile, testCase.expectedProfile);
}

for (const testCase of fixture.profileOverrideCases) {
  const resolution = resolveProfileOverride(
    testCase.inferredProfile,
    testCase.requestedProfile,
  );
  expectEqual(
    `${testCase.id}.profile`,
    resolution.profile,
    testCase.expectedProfile,
  );
  expectEqual(
    `${testCase.id}.rule`,
    resolution.diagnostic?.ruleId,
    testCase.expectedRuleId,
  );
}

for (const testCase of fixture.changedCases) {
  const selection = selectChangedValidation(testCase.paths, policy);
  if (testCase.expectedEscalation) {
    expectEqual(
      `${testCase.id}.escalation`,
      selection.escalation,
      testCase.expectedEscalation,
    );
  }
  if (testCase.expectedRuleIds) {
    expectEqual(
      `${testCase.id}.rules`,
      selection.matchedRuleIds,
      testCase.expectedRuleIds,
    );
  }
  if (testCase.expectedUnknownPaths) {
    expectEqual(
      `${testCase.id}.unknown`,
      selection.unknownPaths,
      testCase.expectedUnknownPaths,
    );
  }
  if (
    testCase.expectedCommandPrefix &&
    !selection.commands.some((command) =>
      command.join(" ").startsWith(testCase.expectedCommandPrefix),
    )
  ) {
    failures.push(
      `${testCase.id}: no command starts with ${testCase.expectedCommandPrefix}`,
    );
  }
}

for (const testCase of fixture.redactionCases) {
  const output = redactDiagnosticOutput(testCase.input);
  for (const forbidden of testCase.forbidden) {
    if (output.includes(forbidden)) {
      failures.push(`${testCase.id}: leaked forbidden canary`);
    }
  }
  for (const required of testCase.required) {
    if (!output.includes(required)) {
      failures.push(`${testCase.id}: missing ${required}`);
    }
  }
}

for (const testCase of fixture.boundedOutputCases) {
  const input = Array.from(
    { length: testCase.inputLineCount },
    (_, index) => `line-${String(index).padStart(3, "0")}`,
  ).join("\n");
  const output = boundedDiagnosticOutput(input, {
    lines: testCase.lineLimit,
    maxChars: testCase.maxChars,
  });
  if (!output.includes(testCase.required)) {
    failures.push(`${testCase.id}: missing tail marker`);
  }
  if (output.includes(testCase.forbidden)) {
    failures.push(`${testCase.id}: retained content outside bounded tail`);
  }
}

const cliCases = [
  {
    arguments: ["--mode=task", "--task=D-004", "--dry-run"],
    expectedStatus: 1,
    expectedText: "DEPENDENCY_BLOCKED",
    id: "cli-dependency-block",
  },
  {
    arguments: ["--mode=task", "--task=E-015", "--profile=docs", "--dry-run"],
    expectedStatus: 1,
    expectedText: "AGENT_PROFILE_DOWNGRADE_BLOCKED",
    id: "cli-profile-downgrade",
  },
];

for (const testCase of cliCases) {
  const execution = spawnSync(
    process.execPath,
    [
      resolve(repositoryRoot, "tooling/agent-validate.mjs"),
      ...testCase.arguments,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: "1" },
    },
  );
  const output = `${execution.stdout ?? ""}\n${execution.stderr ?? ""}`;
  if (
    execution.status !== testCase.expectedStatus ||
    !output.includes(testCase.expectedText)
  ) {
    failures.push(
      `${testCase.id}: expected exit ${testCase.expectedStatus} and ${testCase.expectedText}`,
    );
  }
}

const statusBeforePrepare = spawnSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all"],
  { cwd: repositoryRoot, encoding: "utf8" },
).stdout;
const prepareExecution = spawnSync(
  process.execPath,
  [resolve(repositoryRoot, "tooling/agent-prepare.mjs"), "E-015"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: "1" },
  },
);
const statusAfterPrepare = spawnSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all"],
  { cwd: repositoryRoot, encoding: "utf8" },
).stdout;
if (
  prepareExecution.status !== 0 ||
  !prepareExecution.stdout.includes("Agent prepare: READY") ||
  statusBeforePrepare !== statusAfterPrepare
) {
  failures.push(
    "cli-prepare-read-only: default prepare must pass without changing repository status",
  );
}

for (const profile of ["design", "hybrid", "research", "security"]) {
  if (policy.profiles[profile].finalStatus === "PASS") {
    failures.push(
      `profile-${profile}: manual or external evidence profile must not resolve to PASS`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`AGENT_WORKFLOW_FIXTURE_FAILED: ${failure}`);
  }
  process.exitCode = 1;
} else {
  const count = [
    fixture.contextCases,
    fixture.dependencyCases,
    fixture.routeCases,
    fixture.profileOverrideCases,
    fixture.changedCases,
    fixture.redactionCases,
    fixture.boundedOutputCases,
  ].reduce((total, cases) => total + cases.length, 0);
  console.log(
    `Agent workflow fixtures passed: ${count} versioned cases and ${cliCases.length + 1} CLI cases.`,
  );
}
