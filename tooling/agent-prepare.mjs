import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { parse } from "yaml";

import {
  contextDiagnostics,
  dependencyDiagnostics,
  findActiveTasks,
  parseTaskStates,
  selectTaskRule,
} from "./lib/agent-workflow.mjs";

const executeFile = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "..");

function parseConfiguration(text, ruleId) {
  try {
    return parse(text);
  } catch {
    console.error(`${ruleId}: unable to parse configuration`);
    process.exit(1);
  }
}

function parseArguments(arguments_) {
  const options = {
    deep: false,
    json: false,
    remote: false,
    taskId: undefined,
  };

  for (const argument of arguments_) {
    if (argument === "--deep") {
      options.deep = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--remote") {
      options.remote = true;
    } else if (!argument.startsWith("--") && options.taskId === undefined) {
      options.taskId = argument.toUpperCase();
    } else {
      throw new Error(`AGENT_PREPARE_ARGUMENT_INVALID: ${argument}`);
    }
  }

  if (!options.taskId) {
    throw new Error(
      "AGENT_PREPARE_TASK_REQUIRED: usage pnpm agent:prepare <TASK_ID>",
    );
  }

  return options;
}

async function run(command, arguments_) {
  try {
    const result = await executeFile(command, arguments_, {
      cwd: repositoryRoot,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { ok: true, stdout: result.stdout.trim() };
  } catch {
    return { ok: false, stdout: "" };
  }
}

async function gitOutput(arguments_) {
  return (await run("git", arguments_)).stdout;
}

async function changedPaths() {
  const comparisons = [
    ["diff", "--name-only", "origin/main...HEAD"],
    ["diff", "--name-only", "main...HEAD"],
    ["diff", "--name-only"],
  ];
  const paths = new Set();

  for (const comparison of comparisons) {
    const output = await gitOutput(comparison);
    if (output) {
      for (const path of output.split("\n")) {
        paths.add(path);
      }
      break;
    }
  }

  const workingTree = await gitOutput(["diff", "--name-only"]);
  const staged = await gitOutput(["diff", "--cached", "--name-only"]);
  const untracked = await gitOutput([
    "ls-files",
    "--others",
    "--exclude-standard",
  ]);
  for (const output of [workingTree, staged, untracked]) {
    for (const path of output.split("\n").filter(Boolean)) {
      paths.add(path);
    }
  }

  return [...paths].sort();
}

async function mainIsCurrent() {
  const [localMain, remoteMain] = await Promise.all([
    gitOutput(["rev-parse", "main"]),
    gitOutput(["rev-parse", "origin/main"]),
  ]);

  return localMain !== "" && localMain === remoteMain;
}

function currentTaskId(currentDocument) {
  return currentDocument.match(/\*\*当前任务\*\*：\s*([A-Z]+-\d+)\b/u)?.[1];
}

function issueNumberForTask(taskId, documents) {
  for (const document of documents) {
    for (const line of document
      .split("\n")
      .filter((candidate) => candidate.includes(taskId))) {
      const issue = line.match(
        /github\.com\/WeiHan1996\/DailyEnergy\/issues\/(\d+)/u,
      )?.[1];
      if (issue) {
        return issue;
      }
    }
  }
  return undefined;
}

async function remoteCheck(taskId, documents) {
  const issueNumber = issueNumberForTask(taskId, documents);
  if (!issueNumber) {
    return {
      detail: `no local GitHub Issue mapping for ${taskId}`,
      ruleId: "REMOTE_ISSUE_MAPPING_MISSING",
      status: "BLOCKED",
    };
  }

  const [issueResult, mainResult, localMain] = await Promise.all([
    run("gh", [
      "issue",
      "view",
      issueNumber,
      "--json",
      "number,state,title,url",
    ]),
    run("gh", [
      "api",
      "repos/WeiHan1996/DailyEnergy/commits/main",
      "--jq",
      ".sha",
    ]),
    gitOutput(["rev-parse", "main"]),
  ]);

  if (!issueResult.ok || !mainResult.ok) {
    return {
      detail: `unable to read Issue #${issueNumber} or remote main`,
      ruleId: "REMOTE_STATE_UNAVAILABLE",
      status: "INFRA_BLOCKED",
    };
  }

  let issue;
  try {
    issue = JSON.parse(issueResult.stdout);
  } catch {
    return {
      detail: `Issue #${issueNumber} returned invalid JSON`,
      ruleId: "REMOTE_ISSUE_INVALID",
      status: "INFRA_BLOCKED",
    };
  }

  if (issue.state !== "OPEN") {
    return {
      detail: `Issue #${issueNumber} is ${issue.state}`,
      ruleId: "REMOTE_ISSUE_NOT_OPEN",
      status: "BLOCKED",
    };
  }

  if (!localMain || localMain !== mainResult.stdout) {
    return {
      detail: "local main does not match GitHub main",
      ruleId: "REMOTE_MAIN_STALE",
      status: "BLOCKED",
    };
  }

  return {
    detail: {
      issue: { number: issue.number, state: issue.state, url: issue.url },
      mainSha: mainResult.stdout,
    },
    ruleId: "REMOTE_STATE_READ",
    status: "PASS",
  };
}

async function deepChecks() {
  const checks = [];
  for (const [id, command, arguments_] of [
    ["node", "node", ["--version"]],
    ["pnpm", "pnpm", ["--version"]],
    ["dependencies", "pnpm", ["list", "--depth", "-1", "--json"]],
    ["github", "gh", ["auth", "status"]],
  ]) {
    const result = await run(command, arguments_);
    checks.push({
      detail: result.ok ? result.stdout.split("\n")[0] : "unavailable",
      id,
      status: result.ok ? "PASS" : "INFRA_BLOCKED",
    });
  }
  return checks;
}

async function missingSourceDiagnostics(sources) {
  const diagnostics = [];

  for (const source of sources.filter((candidate) => candidate.required)) {
    try {
      await access(resolve(repositoryRoot, source.path));
    } catch {
      diagnostics.push({
        detail: source.path,
        ruleId: "SOURCE_MISSING",
      });
    }
  }

  return diagnostics;
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const [currentDocument, backlogDocument, authorityText, policyText] =
  await Promise.all([
    readFile(resolve(repositoryRoot, "tasks/current.md"), "utf8"),
    readFile(resolve(repositoryRoot, "tasks/backlog.md"), "utf8"),
    readFile(
      resolve(repositoryRoot, "docs/agent/authority-index.yaml"),
      "utf8",
    ),
    readFile(
      resolve(repositoryRoot, "docs/agent/validation-policy.yaml"),
      "utf8",
    ),
  ]);
const authority = parseConfiguration(
  authorityText,
  "AGENT_AUTHORITY_INDEX_INVALID",
);
const policy = parseConfiguration(
  policyText,
  "AGENT_VALIDATION_POLICY_INVALID",
);
const documents = [currentDocument, backlogDocument];
const taskStates = parseTaskStates(documents);
const taskRule = selectTaskRule(options.taskId, authority.taskRules);
if (!taskRule) {
  console.error(`AGENT_PREPARE_ROUTE_MISSING: ${options.taskId}`);
  process.exit(1);
}
const activeTasks = findActiveTasks(taskStates);
const diagnostics = [
  ...contextDiagnostics({
    activeTasks,
    currentTaskId: currentTaskId(currentDocument),
    mainIsCurrent: await mainIsCurrent(),
    requestedTaskId: options.taskId,
  }),
  ...dependencyDiagnostics({
    completedStates: policy.completedStates,
    dependencies: policy.dependencies,
    taskId: options.taskId,
    taskStates,
  }),
  ...(await missingSourceDiagnostics(taskRule.sources)),
];
const paths = await changedPaths();
const remote = options.remote
  ? await remoteCheck(options.taskId, documents)
  : { status: "NOT_REQUESTED" };
const environmentChecks = options.deep ? await deepChecks() : [];
const externalBlocked = options.remote && remote.status === "BLOCKED";
const infrastructureBlocked =
  (options.remote && remote.status === "INFRA_BLOCKED") ||
  environmentChecks.some((check) => check.status !== "PASS");
const result = {
  changedPaths: paths,
  deepChecks: environmentChecks,
  diagnostics,
  manualEvidence: policy.profiles[taskRule.profile].manualEvidence ?? [],
  profile: taskRule.profile,
  remote,
  sources: taskRule.sources,
  status:
    diagnostics.length > 0
      ? "BLOCKED"
      : externalBlocked
        ? "BLOCKED"
        : infrastructureBlocked
          ? "INFRA_BLOCKED"
          : "READY",
  taskId: options.taskId,
};

if (options.json) {
  console.log(JSON.stringify(result, undefined, 2));
} else {
  console.log(
    `Agent prepare: ${result.status} | ${result.taskId} | profile=${result.profile}`,
  );
  console.log(
    `Required sources (${result.sources.filter((source) => source.required).length}):`,
  );
  for (const source of result.sources) {
    console.log(
      `- ${source.required ? "required" : "optional"} ${source.path} — ${source.reason}`,
    );
  }
  console.log(
    `Changed paths: ${paths.length}${paths.length > 0 ? ` (${paths.slice(0, 8).join(", ")}${paths.length > 8 ? ", …" : ""})` : ""}`,
  );
  for (const diagnostic of diagnostics) {
    console.error(`${diagnostic.ruleId}: ${diagnostic.detail}`);
  }
  if (options.remote) {
    console.log(`Remote check: ${result.remote.status}`);
    if (result.remote.status !== "PASS") {
      console.error(`${result.remote.ruleId}: ${result.remote.detail}`);
    }
  }
  if (options.deep) {
    console.log(
      `Deep checks: ${result.deepChecks
        .map((check) => `${check.id}=${check.status}`)
        .join(", ")}`,
    );
  }
  if (result.manualEvidence.length > 0) {
    console.log(`Required evidence: ${result.manualEvidence.join(", ")}`);
  }
  console.log(
    `Next validation: pnpm agent:validate --mode=task --task=${result.taskId}`,
  );
}

if (result.status !== "READY") {
  process.exitCode = 1;
}
