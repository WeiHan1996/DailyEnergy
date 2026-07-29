import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";

import {
  boundedDiagnosticOutput,
  collectManualEvidence,
  commandDisplay,
  dependencyDiagnostics,
  determineValidationStatuses,
  parseTaskStateObservations,
  resolveEffectiveProfile,
  resolveProfileFinalStatus,
  resolveTaskStates,
  selectChangedValidation,
  selectTaskRule,
  taskStateConflictDiagnostics,
} from "./lib/agent-workflow.mjs";
import { discoverGitChangeScope } from "./lib/git-change-scope.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");

function readConfiguration(path, ruleId) {
  try {
    return parse(readFileSync(resolve(repositoryRoot, path), "utf8"));
  } catch {
    console.error(`${ruleId}: unable to parse ${path}`);
    process.exit(1);
  }
}

const policy = readConfiguration(
  "docs/agent/validation-policy.yaml",
  "AGENT_VALIDATION_POLICY_INVALID",
);
const authority = readConfiguration(
  "docs/agent/authority-index.yaml",
  "AGENT_AUTHORITY_INDEX_INVALID",
);

function parseArguments(arguments_) {
  const options = {
    dryRun: false,
    json: false,
    mode: "changed",
    profile: undefined,
    taskId: undefined,
  };

  for (const argument of arguments_) {
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument.startsWith("--mode=")) {
      options.mode = argument.slice("--mode=".length);
    } else if (argument.startsWith("--profile=")) {
      options.profile = argument.slice("--profile=".length);
    } else if (argument.startsWith("--task=")) {
      options.taskId = argument.slice("--task=".length).toUpperCase();
    } else {
      throw new Error(`AGENT_VALIDATE_ARGUMENT_INVALID: ${argument}`);
    }
  }

  if (!["changed", "full", "task"].includes(options.mode)) {
    throw new Error(`AGENT_VALIDATE_MODE_INVALID: ${options.mode}`);
  }
  if (
    options.profile !== undefined &&
    !policy.allowedProfiles.includes(options.profile)
  ) {
    throw new Error(`AGENT_VALIDATE_PROFILE_INVALID: ${options.profile}`);
  }

  return options;
}

function commandOutput(command) {
  const execution = spawnSync(command[0], command.slice(1), {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: undefined,
      NO_COLOR: "1",
    },
    maxBuffer: 16 * 1024 * 1024,
  });

  return {
    combinedOutput: `${execution.stdout ?? ""}\n${execution.stderr ?? ""}`,
    status: execution.status,
  };
}

function inferTaskId(currentDocument) {
  return currentDocument.match(/\*\*当前任务\*\*：\s*([A-Z]+-\d+)\b/u)?.[1];
}

function deduplicateCommands(commands) {
  return [
    ...new Map(
      commands.map((command) => [JSON.stringify(command), command]),
    ).values(),
  ];
}

function boundedList(values, limit = 8) {
  return values.length <= limit
    ? values.join(", ")
    : `${values.slice(0, limit).join(", ")}, … +${values.length - limit}`;
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const stateDocuments = ["tasks/current.md", "tasks/backlog.md"].map((path) => ({
  content: readFileSync(resolve(repositoryRoot, path), "utf8"),
  path,
}));
const repositoryCurrentTaskId = inferTaskId(stateDocuments[0].content);
const taskId = options.taskId ?? repositoryCurrentTaskId;
if (!taskId) {
  console.error("AGENT_VALIDATE_TASK_REQUIRED: no current or requested task");
  process.exit(1);
}
const taskRule = selectTaskRule(taskId, authority.taskRules);
if (!taskRule) {
  console.error(`AGENT_VALIDATE_ROUTE_MISSING: ${taskId}`);
  process.exit(1);
}

const taskStateObservations = parseTaskStateObservations(stateDocuments);
const taskStates = resolveTaskStates(taskStateObservations);
const stateConflictDiagnostics = taskStateConflictDiagnostics(
  taskStateObservations,
);
const taskContextDiagnostics =
  options.taskId &&
  repositoryCurrentTaskId &&
  options.taskId !== repositoryCurrentTaskId
    ? [
        {
          detail: `requested ${options.taskId}, but tasks/current.md names ${repositoryCurrentTaskId}`,
          ruleId: "CONTEXT_TASK_MISMATCH",
        },
      ]
    : [];
taskContextDiagnostics.push(...stateConflictDiagnostics);
const taskDependencyDiagnostics = dependencyDiagnostics({
  completedStates: policy.completedStates,
  dependencies: policy.dependencies,
  taskId,
  taskStates,
});

const gitScope = discoverGitChangeScope({ cwd: repositoryRoot });
const selection = selectChangedValidation(gitScope.paths, policy);

const profileResolution = resolveEffectiveProfile({
  impactProfiles: selection.impactProfiles,
  requestedProfile: options.profile,
  taskProfile: taskRule.profile,
});
if (profileResolution.diagnostic) {
  console.error(
    `${profileResolution.diagnostic.ruleId}: ${profileResolution.diagnostic.detail}`,
  );
  process.exit(1);
}

const profile = profileResolution.profile;
const profilePolicy = policy.profiles[profile];
const manualEvidence = collectManualEvidence(
  profileResolution.evidenceProfiles,
  policy,
);
const profileFinalStatus = resolveProfileFinalStatus(
  profileResolution.evidenceProfiles,
  policy,
);
const gitDiagnostics = gitScope.diagnostics;
let commands;
let effectiveMode = options.mode;
const noChanges =
  options.mode === "changed" &&
  gitDiagnostics.length === 0 &&
  selection.paths.length === 0;

if (options.mode === "changed") {
  if (gitDiagnostics.length > 0 || noChanges) {
    commands = [];
  } else if (selection.escalation === "full") {
    commands = profilePolicy.fullCommands;
    effectiveMode = "full";
  } else {
    commands = deduplicateCommands(selection.commands);
  }
} else {
  commands =
    options.mode === "full"
      ? profilePolicy.fullCommands
      : profilePolicy.taskCommands;
}

const validationPlanDiagnostics = [];
if (
  commands.length === 0 &&
  !noChanges &&
  taskContextDiagnostics.length === 0 &&
  taskDependencyDiagnostics.length === 0 &&
  gitDiagnostics.length === 0
) {
  validationPlanDiagnostics.push({
    detail: "validation selected changes but produced no commands",
    ruleId: "AGENT_VALIDATION_PLAN_EMPTY",
  });
}

const blockedStatus =
  taskContextDiagnostics.length > 0
    ? "CONTEXT_BLOCKED"
    : taskDependencyDiagnostics.length > 0
      ? "DEPENDENCY_BLOCKED"
      : gitDiagnostics.length > 0
        ? "CONTEXT_BLOCKED"
        : validationPlanDiagnostics.length > 0
          ? "VALIDATION_BLOCKED"
          : undefined;
if (blockedStatus) {
  commands = [];
}

const startedAt = Date.now();
const completedCommands = [];
let failure;

if (!options.dryRun && !blockedStatus && !noChanges) {
  for (const command of commands) {
    const commandStartedAt = Date.now();
    const execution = commandOutput(command);
    const durationMs = Date.now() - commandStartedAt;
    completedCommands.push({ command, durationMs });

    if (execution.status !== 0) {
      failure = {
        command,
        output: boundedDiagnosticOutput(execution.combinedOutput),
        ruleId: "AGENT_VALIDATION_COMMAND_FAILED",
        status: execution.status,
      };
      break;
    }
  }
}

const statuses = determineValidationStatuses({
  blockedStatus,
  dryRun: options.dryRun,
  failure,
  noChanges,
  profileFinalStatus,
});
const result = {
  automatedStatus: statuses.automatedStatus,
  commands: commands.map(commandDisplay),
  completedCommands: completedCommands.map(({ command, durationMs }) => ({
    command: commandDisplay(command),
    durationMs,
  })),
  contextDiagnostics: taskContextDiagnostics,
  dependencyDiagnostics: taskDependencyDiagnostics,
  durationMs: Date.now() - startedAt,
  effectiveMode,
  executed: completedCommands.length > 0,
  failure,
  finalStatus: statuses.finalStatus,
  git: {
    baseline: gitScope.baseline,
    diagnostics: gitDiagnostics,
  },
  manualEvidence,
  profile,
  profileInputs: profileResolution.evidenceProfiles,
  selection,
  taskId,
  validationPlanDiagnostics,
};

if (options.json) {
  console.log(JSON.stringify(result, undefined, 2));
} else {
  const activity = options.dryRun
    ? `planned=${commands.length}`
    : `executed=${completedCommands.length}`;
  console.log(
    `Agent validation: ${result.finalStatus} | automated=${result.automatedStatus} | profile=${profile} | mode=${options.mode}→${effectiveMode} | ${activity} | ${result.durationMs}ms`,
  );
  if (selection.matchedRuleIds.length > 0) {
    console.log(`Matched rules: ${selection.matchedRuleIds.join(", ")}`);
  }
  if (selection.impactProfiles.length > 0) {
    console.log(
      `Profile inputs: ${profileResolution.evidenceProfiles.join(" + ")} → ${profile}`,
    );
  }
  if (selection.unknownPaths.length > 0) {
    console.log(
      `Full escalation: unknown paths (${boundedList(selection.unknownPaths)})`,
    );
  }
  if (options.dryRun) {
    for (const command of result.commands) {
      console.log(`- ${command}`);
    }
  }
  if (failure) {
    console.error(
      `${failure.ruleId}: ${commandDisplay(failure.command)} exited ${failure.status}`,
    );
    console.error(failure.output);
  }
  for (const diagnostic of [
    ...taskDependencyDiagnostics,
    ...taskContextDiagnostics,
    ...gitDiagnostics,
    ...validationPlanDiagnostics,
  ]) {
    console.error(`${diagnostic.ruleId}: ${diagnostic.detail}`);
  }
  if (
    result.manualEvidence.length > 0 &&
    !failure &&
    !blockedStatus &&
    !options.dryRun &&
    !noChanges
  ) {
    console.log(`Required evidence: ${result.manualEvidence.join(", ")}`);
  }
}

if (failure || blockedStatus) {
  process.exitCode = 1;
} else if (!options.dryRun && !noChanges && result.finalStatus !== "PASS") {
  process.exitCode = 2;
}
