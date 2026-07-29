import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parse } from "yaml";

import {
  boundedDiagnosticOutput,
  contextDiagnostics,
  dependencyDiagnostics,
  determineValidationStatuses,
  parseTaskStateObservations,
  redactDiagnosticOutput,
  remoteStateDiagnostics,
  resolveEffectiveProfile,
  resolveProfileFinalStatus,
  resolveProfileOverride,
  resolveTaskStates,
  selectAuthoritySources,
  selectChangedValidation,
  selectTaskRule,
  taskStateConflictDiagnostics,
} from "./lib/agent-workflow.mjs";
import { discoverGitChangeScope } from "./lib/git-change-scope.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const [fixture, authority, policy, currentTaskDocument] = await Promise.all([
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
  readFile(resolve(repositoryRoot, "tasks/current.md"), "utf8"),
]);
const failures = [];
const currentTaskForFixtures = currentTaskDocument.match(
  /\*\*当前任务\*\*：\s*([A-Z]+-\d+)\b/u,
)?.[1];
if (!currentTaskForFixtures) {
  failures.push("current-task-fixture: tasks/current.md has no current task");
}

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
  expectEqual(testCase.id, rule?.profile ?? null, testCase.expectedProfile);
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
  if (testCase.expectedImpactProfiles) {
    expectEqual(
      `${testCase.id}.impactProfiles`,
      selection.impactProfiles,
      testCase.expectedImpactProfiles,
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

for (const testCase of fixture.effectiveProfileCases) {
  const pathSelection = selectChangedValidation(testCase.paths ?? [], policy);
  const resolution = resolveEffectiveProfile({
    ...testCase,
    impactProfiles: testCase.impactProfiles ?? pathSelection.impactProfiles,
  });
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
  if (testCase.expectedEscalation) {
    expectEqual(
      `${testCase.id}.escalation`,
      pathSelection.escalation,
      testCase.expectedEscalation,
    );
  }
}

for (const testCase of fixture.topicSourceCases) {
  const taskRule = selectTaskRule(testCase.taskId, authority.taskRules);
  const sources = selectAuthoritySources({
    paths: testCase.paths,
    taskId: testCase.taskId,
    taskRule,
    topicRules: authority.topicRules,
  });
  expectEqual(
    `${testCase.id}.paths`,
    sources.map(({ path }) => path),
    testCase.expectedPaths,
  );
  const topicSource = sources.find(({ ruleIds }) =>
    ruleIds.includes(testCase.expectedTopicRuleId),
  );
  if (
    !topicSource ||
    !topicSource.triggeredBy.includes(testCase.expectedTrigger)
  ) {
    failures.push(`${testCase.id}: missing topic trigger metadata`);
  }
}

for (const testCase of fixture.taskStateCases) {
  const observations = parseTaskStateObservations(testCase.documents);
  const states = resolveTaskStates(observations);
  expectEqual(
    `${testCase.id}.states`,
    Object.fromEntries(states),
    testCase.expectedStates,
  );
  expectEqual(
    `${testCase.id}.rules`,
    taskStateConflictDiagnostics(observations).map(({ ruleId }) => ruleId),
    testCase.expectedRuleIds,
  );
}

for (const testCase of fixture.validationStatusCases) {
  const statuses = determineValidationStatuses({
    dryRun: testCase.dryRun ?? false,
    failure: testCase.failure,
    noChanges: testCase.noChanges ?? false,
    profileFinalStatus: "PASS",
  });
  expectEqual(
    `${testCase.id}.automated`,
    statuses.automatedStatus,
    testCase.expectedAutomatedStatus,
  );
  expectEqual(
    `${testCase.id}.final`,
    statuses.finalStatus,
    testCase.expectedFinalStatus,
  );
}

for (const testCase of fixture.profileFinalStatusCases) {
  expectEqual(
    testCase.id,
    resolveProfileFinalStatus(testCase.evidenceProfiles, policy),
    testCase.expectedFinalStatus,
  );
}

for (const testCase of fixture.remoteStateCases) {
  expectEqual(
    testCase.id,
    remoteStateDiagnostics(testCase).map(({ ruleId }) => ruleId),
    testCase.expectedRuleIds,
  );
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
  const input =
    testCase.input ??
    Array.from(
      { length: testCase.inputLineCount },
      (_, index) => `line-${String(index).padStart(3, "0")}`,
    ).join("\n");
  const output = boundedDiagnosticOutput(input, {
    lines: testCase.lineLimit,
    maxChars: testCase.maxChars,
  });
  if (testCase.required && !output.includes(testCase.required)) {
    failures.push(`${testCase.id}: missing tail marker`);
  }
  if (testCase.forbidden && output.includes(testCase.forbidden)) {
    failures.push(`${testCase.id}: retained content outside bounded tail`);
  }
  for (const required of testCase.requiredValues ?? []) {
    if (!output.includes(required)) {
      failures.push(`${testCase.id}: missing ${required}`);
    }
  }
}

const cliCases = [
  {
    arguments: ["--mode=task", "--task=E-015", "--profile=docs", "--dry-run"],
    expectedStatus: 1,
    expectedText: "AGENT_PROFILE_DOWNGRADE_BLOCKED",
    id: "cli-profile-downgrade",
  },
  {
    arguments: ["--mode=task", "--task=S-999", "--dry-run"],
    expectedStatus: 1,
    expectedText: "AGENT_VALIDATE_ROUTE_MISSING",
    id: "cli-unknown-route-block",
  },
  {
    arguments: [
      "--mode=task",
      `--task=${currentTaskForFixtures ?? "UNKNOWN"}`,
      "--dry-run",
      "--json",
    ],
    expectedStatus: 0,
    expectedText: '"automatedStatus": "NOT_RUN"',
    additionalText: '"finalStatus": "PLANNED"',
    id: "cli-dry-run-not-pass",
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
    !output.includes(testCase.expectedText) ||
    (testCase.additionalText && !output.includes(testCase.additionalText))
  ) {
    failures.push(
      `${testCase.id}: expected exit ${testCase.expectedStatus} and ${testCase.expectedText}`,
    );
  }
}

function runGit(cwd, arguments_) {
  const execution = spawnSync("git", arguments_, {
    cwd,
    encoding: "utf8",
  });
  if (execution.status !== 0) {
    throw new Error(
      `git ${arguments_.join(" ")} failed: ${execution.stderr ?? ""}`,
    );
  }
}

async function initializeRepository(directory) {
  runGit(directory, ["init", "--initial-branch=main"]);
  runGit(directory, ["config", "user.email", "agent-fixture@example.invalid"]);
  runGit(directory, ["config", "user.name", "Agent Fixture"]);
  await writeFile(join(directory, "tracked.txt"), "base\n", "utf8");
  runGit(directory, ["add", "tracked.txt"]);
  runGit(directory, ["commit", "-m", "base"]);
}

const temporaryDirectories = [];
try {
  const noOriginRepository = await mkdtemp(
    join(tmpdir(), "daily-energy-agent-no-origin-"),
  );
  temporaryDirectories.push(noOriginRepository);
  await initializeRepository(noOriginRepository);
  runGit(noOriginRepository, ["switch", "-c", "agent/change"]);
  await writeFile(join(noOriginRepository, "tracked.txt"), "changed\n", "utf8");
  await writeFile(
    join(noOriginRepository, "space name.txt"),
    "untracked\n",
    "utf8",
  );
  const noOriginScope = discoverGitChangeScope({ cwd: noOriginRepository });
  expectEqual("git-no-origin.paths", noOriginScope.paths, [
    "space name.txt",
    "tracked.txt",
  ]);
  expectEqual("git-no-origin.rules", noOriginScope.diagnostics, []);
  expectEqual(
    "git-no-origin.baseline",
    noOriginScope.baseline?.reference,
    "main",
  );

  await rm(join(noOriginRepository, "space name.txt"));
  runGit(noOriginRepository, ["add", "tracked.txt"]);
  runGit(noOriginRepository, ["commit", "-m", "change"]);
  runGit(noOriginRepository, ["checkout", "--detach", "HEAD"]);
  const detachedScope = discoverGitChangeScope({ cwd: noOriginRepository });
  expectEqual("git-detached.paths", detachedScope.paths, ["tracked.txt"]);
  expectEqual("git-detached.flag", detachedScope.isDetached, true);
  expectEqual("git-detached.rules", detachedScope.diagnostics, []);

  const cleanRepository = await mkdtemp(
    join(tmpdir(), "daily-energy-agent-clean-"),
  );
  temporaryDirectories.push(cleanRepository);
  await initializeRepository(cleanRepository);
  const cleanScope = discoverGitChangeScope({ cwd: cleanRepository });
  expectEqual("git-clean.paths", cleanScope.paths, []);
  expectEqual("git-clean.rules", cleanScope.diagnostics, []);

  const nonRepository = await mkdtemp(
    join(tmpdir(), "daily-energy-agent-non-git-"),
  );
  temporaryDirectories.push(nonRepository);
  const nonRepositoryScope = discoverGitChangeScope({ cwd: nonRepository });
  expectEqual(
    "git-non-repository.rules",
    nonRepositoryScope.diagnostics.map(({ ruleId }) => ruleId),
    ["GIT_REPOSITORY_UNAVAILABLE"],
  );

  const injectedFailureScope = discoverGitChangeScope({
    cwd: cleanRepository,
    runGit(arguments_) {
      if (arguments_[0] === "ls-files") {
        return { ok: false, status: 1, stderr: "denied", stdout: "" };
      }
      const execution = spawnSync("git", arguments_, {
        cwd: cleanRepository,
        encoding: "utf8",
      });
      return {
        ok: execution.status === 0,
        status: execution.status,
        stderr: (execution.stderr ?? "").trim(),
        stdout: (execution.stdout ?? "").trim(),
      };
    },
  });
  expectEqual(
    "git-injected-failure.rules",
    injectedFailureScope.diagnostics.map(({ ruleId }) => ruleId),
    ["GIT_UNTRACKED_SCAN_FAILED"],
  );
} finally {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
}

const statusBeforePrepare = spawnSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all"],
  { cwd: repositoryRoot, encoding: "utf8" },
).stdout;
const prepareExecution = spawnSync(
  process.execPath,
  [
    resolve(repositoryRoot, "tooling/agent-prepare.mjs"),
    currentTaskForFixtures ?? "UNKNOWN",
  ],
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
  ![0, 1].includes(prepareExecution.status) ||
  !prepareExecution.stdout.includes("Agent prepare:") ||
  statusBeforePrepare !== statusAfterPrepare
) {
  failures.push(
    "cli-prepare-read-only: default prepare must report status without changing repository state",
  );
}

const unknownPrepareExecution = spawnSync(
  process.execPath,
  [resolve(repositoryRoot, "tooling/agent-prepare.mjs"), "S-999"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: "1" },
  },
);
if (
  unknownPrepareExecution.status !== 1 ||
  !unknownPrepareExecution.stderr.includes("AGENT_PREPARE_ROUTE_MISSING")
) {
  failures.push(
    "cli-prepare-unknown-route: unknown tasks must fail closed with a stable rule",
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
    fixture.effectiveProfileCases,
    fixture.topicSourceCases,
    fixture.taskStateCases,
    fixture.validationStatusCases,
    fixture.profileFinalStatusCases,
    fixture.remoteStateCases,
    fixture.redactionCases,
    fixture.boundedOutputCases,
  ].reduce((total, cases) => total + cases.length, 0);
  console.log(
    `Agent workflow fixtures passed: ${count} versioned cases and ${cliCases.length + 2} CLI cases.`,
  );
}
