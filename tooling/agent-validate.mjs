import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";

import {
  boundedDiagnosticOutput,
  commandDisplay,
  dependencyDiagnostics,
  parseTaskStates,
  resolveProfileOverride,
  selectChangedValidation,
  selectTaskRule,
} from "./lib/agent-workflow.mjs";

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

function gitPaths() {
  const commands = [
    ["git", "diff", "--name-only", "origin/main...HEAD"],
    ["git", "diff", "--name-only"],
    ["git", "diff", "--cached", "--name-only"],
    ["git", "ls-files", "--others", "--exclude-standard"],
  ];
  const paths = new Set();

  for (const command of commands) {
    const result = commandOutput(command);
    if (result.status === 0) {
      for (const path of result.combinedOutput.split("\n").filter(Boolean)) {
        paths.add(path);
      }
    }
  }

  return [...paths].sort();
}

function inferTaskId() {
  const current = readFileSync(
    resolve(repositoryRoot, "tasks/current.md"),
    "utf8",
  );
  return current.match(/\*\*当前任务\*\*：\s*([A-Z]+-\d+)\b/u)?.[1];
}

function readTaskStates() {
  return parseTaskStates(
    ["tasks/current.md", "tasks/backlog.md"].map((path) =>
      readFileSync(resolve(repositoryRoot, path), "utf8"),
    ),
  );
}

function deduplicateCommands(commands) {
  return [
    ...new Map(
      commands.map((command) => [JSON.stringify(command), command]),
    ).values(),
  ];
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const repositoryCurrentTaskId = inferTaskId();
const taskId = options.taskId ?? repositoryCurrentTaskId;
const taskRule = taskId
  ? selectTaskRule(taskId, authority.taskRules)
  : undefined;
const profileResolution = taskRule
  ? resolveProfileOverride(taskRule.profile, options.profile)
  : { profile: options.profile ?? "code" };
if (profileResolution.diagnostic) {
  console.error(
    `${profileResolution.diagnostic.ruleId}: ${profileResolution.diagnostic.detail}`,
  );
  process.exit(1);
}
const profile = profileResolution.profile;
const profilePolicy = policy.profiles[profile];
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
const taskDependencyDiagnostics = taskId
  ? dependencyDiagnostics({
      completedStates: policy.completedStates,
      dependencies: policy.dependencies,
      taskId,
      taskStates: readTaskStates(),
    })
  : [];
let commands;
let selection = {
  escalation: undefined,
  matchedRuleIds: [],
  paths: [],
  unknownPaths: [],
};
let effectiveMode = options.mode;

if (options.mode === "changed") {
  selection = selectChangedValidation(gitPaths(), policy);
  if (selection.escalation === "full") {
    commands = profilePolicy.fullCommands;
    effectiveMode = "full";
  } else {
    commands =
      selection.paths.length === 0
        ? []
        : deduplicateCommands(selection.commands);
  }
} else {
  commands =
    options.mode === "full"
      ? profilePolicy.fullCommands
      : profilePolicy.taskCommands;
}

if (taskDependencyDiagnostics.length > 0 || taskContextDiagnostics.length > 0) {
  commands = [];
}

const startedAt = Date.now();
const completedCommands = [];
let failure;

if (
  !options.dryRun &&
  taskDependencyDiagnostics.length === 0 &&
  taskContextDiagnostics.length === 0
) {
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

const automatedStatus = failure ? "FAIL" : "PASS";
const finalStatus =
  taskContextDiagnostics.length > 0
    ? "CONTEXT_BLOCKED"
    : taskDependencyDiagnostics.length > 0
      ? "DEPENDENCY_BLOCKED"
      : automatedStatus === "PASS"
        ? profilePolicy.finalStatus
        : automatedStatus;
const result = {
  automatedStatus,
  commands: commands.map(commandDisplay),
  contextDiagnostics: taskContextDiagnostics,
  dependencyDiagnostics: taskDependencyDiagnostics,
  durationMs: Date.now() - startedAt,
  effectiveMode,
  failure,
  finalStatus,
  manualEvidence: profilePolicy.manualEvidence ?? [],
  profile,
  selection,
  taskId,
};

if (options.json) {
  console.log(JSON.stringify(result, undefined, 2));
} else {
  const verb = options.dryRun ? "planned" : "completed";
  console.log(
    `Agent validation: ${result.finalStatus} | profile=${profile} | mode=${options.mode}→${effectiveMode} | ${verb}=${failure ? completedCommands.length : commands.length} | ${result.durationMs}ms`,
  );
  if (selection.matchedRuleIds.length > 0) {
    console.log(`Matched rules: ${selection.matchedRuleIds.join(", ")}`);
  }
  if (selection.unknownPaths.length > 0) {
    console.log(
      `Full escalation: unknown paths (${selection.unknownPaths.join(", ")})`,
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
  for (const diagnostic of taskDependencyDiagnostics) {
    console.error(`${diagnostic.ruleId}: ${diagnostic.detail}`);
  }
  for (const diagnostic of taskContextDiagnostics) {
    console.error(`${diagnostic.ruleId}: ${diagnostic.detail}`);
  }
  if (
    result.manualEvidence.length > 0 &&
    !failure &&
    taskDependencyDiagnostics.length === 0 &&
    taskContextDiagnostics.length === 0
  ) {
    console.log(`Required evidence: ${result.manualEvidence.join(", ")}`);
  }
}

if (
  failure ||
  taskDependencyDiagnostics.length > 0 ||
  taskContextDiagnostics.length > 0
) {
  process.exitCode = 1;
} else if (!options.dryRun && !["PASS"].includes(result.finalStatus)) {
  process.exitCode = 2;
}
