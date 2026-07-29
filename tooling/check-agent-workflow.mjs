import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse } from "yaml";

import { matchesGlob } from "./lib/agent-workflow.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const authorityPath = resolve(
  repositoryRoot,
  "docs/agent/authority-index.yaml",
);
const policyPath = resolve(repositoryRoot, "docs/agent/validation-policy.yaml");
const diagnostics = [];

async function readYaml(path, ruleId) {
  try {
    return parse(await readFile(path, "utf8"));
  } catch {
    diagnostics.push({
      detail: path.slice(repositoryRoot.length + 1),
      ruleId,
    });
    return {};
  }
}

function report(condition, ruleId, detail) {
  if (!condition) {
    diagnostics.push({ detail, ruleId });
  }
}

function validateCommand(command, location) {
  report(
    Array.isArray(command) &&
      command.length > 0 &&
      command.every((part) => typeof part === "string" && part.length > 0),
    "AGENT_POLICY_COMMAND_INVALID",
    location,
  );
}

async function sourceExists(sourcePath) {
  try {
    await access(resolve(repositoryRoot, sourcePath));
    return true;
  } catch {
    return false;
  }
}

const [authority, policy, manifest, agentInstructions, projectContext] =
  await Promise.all([
    readYaml(authorityPath, "AGENT_AUTHORITY_INDEX_INVALID"),
    readYaml(policyPath, "AGENT_VALIDATION_POLICY_INVALID"),
    readFile(resolve(repositoryRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(resolve(repositoryRoot, "AGENTS.md"), "utf8"),
    readFile(resolve(repositoryRoot, "docs/agent/PROJECT_CONTEXT.md"), "utf8"),
  ]);

report(
  authority.version === 1,
  "AGENT_AUTHORITY_VERSION",
  "expected version 1",
);
report(policy.version === 1, "AGENT_POLICY_VERSION", "expected version 1");
report(
  Array.isArray(authority.taskRules) && authority.taskRules.length > 0,
  "AGENT_AUTHORITY_TASK_RULES",
  "taskRules must be a non-empty array",
);
report(
  authority.taskRules?.at(-1)?.match === "*",
  "AGENT_AUTHORITY_FALLBACK",
  "the final task rule must match *",
);

const allowedProfiles = new Set(policy.allowedProfiles ?? []);
for (const [index, rule] of (authority.taskRules ?? []).entries()) {
  report(
    typeof rule.match === "string" && rule.match.length > 0,
    "AGENT_AUTHORITY_MATCH_INVALID",
    `taskRules[${index}]`,
  );
  report(
    allowedProfiles.has(rule.profile),
    "AGENT_AUTHORITY_PROFILE_INVALID",
    `${rule.match}: ${rule.profile}`,
  );
  report(
    Array.isArray(rule.sources) && rule.sources.length > 0,
    "AGENT_AUTHORITY_SOURCES_EMPTY",
    rule.match,
  );

  for (const source of rule.sources ?? []) {
    report(
      typeof source.reason === "string" && source.reason.length > 0,
      "AGENT_AUTHORITY_REASON_MISSING",
      `${rule.match}: ${source.path}`,
    );
    if (source.required) {
      report(
        await sourceExists(source.path),
        "AGENT_AUTHORITY_SOURCE_MISSING",
        `${rule.match}: ${source.path}`,
      );
    }
  }
}

for (const topic of authority.topicRules ?? []) {
  report(
    typeof topic.id === "string" && topic.id.length > 0,
    "AGENT_AUTHORITY_TOPIC_ID_INVALID",
    "topic rule id is required",
  );
  for (const sourcePath of topic.sources ?? []) {
    report(
      await sourceExists(sourcePath),
      "AGENT_AUTHORITY_TOPIC_SOURCE_MISSING",
      `${topic.id}: ${sourcePath}`,
    );
  }
}

for (const profile of allowedProfiles) {
  const configuration = policy.profiles?.[profile];
  report(configuration !== undefined, "AGENT_POLICY_PROFILE_MISSING", profile);
  for (const mode of ["taskCommands", "fullCommands"]) {
    report(
      Array.isArray(configuration?.[mode]) && configuration[mode].length > 0,
      "AGENT_POLICY_COMMANDS_EMPTY",
      `${profile}.${mode}`,
    );
    for (const [index, command] of (configuration?.[mode] ?? []).entries()) {
      validateCommand(command, `${profile}.${mode}[${index}]`);
    }
  }
}

for (const [index, rule] of (policy.pathRules ?? []).entries()) {
  report(
    typeof rule.id === "string" && rule.id.length > 0,
    "AGENT_POLICY_PATH_RULE_ID",
    `pathRules[${index}]`,
  );
  report(
    Array.isArray(rule.patterns) &&
      rule.patterns.length > 0 &&
      rule.patterns.every((pattern) => typeof pattern === "string"),
    "AGENT_POLICY_PATH_PATTERNS",
    rule.id ?? `pathRules[${index}]`,
  );
  for (const [commandIndex, command] of (rule.commands ?? []).entries()) {
    validateCommand(command, `${rule.id}.commands[${commandIndex}]`);
  }
}

const requiredDependencies = {
  "C-003": ["D-004"],
  "C-004": ["D-004"],
  "C-009": ["D-004"],
  "C-012": ["D-005"],
  "C-013": ["D-005"],
  "C-014": ["D-005"],
  "D-002": ["D-001"],
  "D-003": ["D-002"],
  "D-004": ["D-003"],
  "D-005": ["D-004"],
};

for (const [taskId, dependencies] of Object.entries(requiredDependencies)) {
  report(
    JSON.stringify(policy.dependencies?.[taskId]) ===
      JSON.stringify(dependencies),
    "AGENT_POLICY_DEPENDENCY_DRIFT",
    `${taskId} must depend on ${dependencies.join(", ")}`,
  );
}

for (const script of [
  "agent:check",
  "agent:fixtures",
  "agent:prepare",
  "agent:validate",
]) {
  report(
    typeof manifest.scripts?.[script] === "string",
    "AGENT_ENTRYPOINT_MISSING",
    script,
  );
}

report(
  agentInstructions.includes("docs/agent/PROJECT_CONTEXT.md") &&
    agentInstructions.includes("agent:prepare"),
  "AGENT_INSTRUCTIONS_ROUTING_MISSING",
  "AGENTS.md must route through PROJECT_CONTEXT and agent:prepare",
);
report(
  projectContext.includes("不是新的产品、技术或设计权威源"),
  "AGENT_PROJECT_CONTEXT_AUTHORITY",
  "PROJECT_CONTEXT must explicitly remain non-authoritative",
);
report(
  matchesGlob("tooling/agent-prepare.mjs", "tooling/agent-*.mjs"),
  "AGENT_GLOB_ENGINE_REGRESSION",
  "tooling agent glob must match",
);

if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    console.error(`${diagnostic.ruleId}: ${diagnostic.detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Agent workflow Gate passed: ${authority.taskRules.length} task routes, ${allowedProfiles.size} profiles, ${policy.pathRules.length} path rules.`,
  );
}
