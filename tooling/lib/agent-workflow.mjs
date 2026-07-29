const knownTaskStates = new Set([
  "Accepted",
  "Blocked",
  "Done",
  "In Progress",
  "In Review",
  "Planned",
  "Ready",
]);

function normalizePath(path) {
  return path.replaceAll("\\", "/").replace(/^\.\/+/u, "");
}

function escapeRegularExpression(character) {
  return /[\\^$.*+?()[\]{}|]/u.test(character) ? `\\${character}` : character;
}

export function globToRegularExpression(pattern) {
  const normalized = normalizePath(pattern);
  let source = "^";

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    const following = normalized[index + 2];

    if (character === "*" && next === "*" && following === "/") {
      source += "(?:.*/)?";
      index += 2;
    } else if (character === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += escapeRegularExpression(character);
    }
  }

  return new RegExp(`${source}$`, "u");
}

export function matchesGlob(path, pattern) {
  return globToRegularExpression(pattern).test(normalizePath(path));
}

export function selectTaskRule(taskId, taskRules) {
  return taskRules.find((rule) => matchesGlob(taskId, rule.match));
}

function normalizeTaskState(value) {
  const trimmed = value.replaceAll("`", "").trim();
  return [...knownTaskStates].find(
    (state) => trimmed === state || trimmed.startsWith(`${state}（`),
  );
}

export function parseTaskStates(documents) {
  const states = new Map();

  for (const document of documents) {
    const currentTask = document.match(
      /\*\*当前任务\*\*：\s*([A-Z]+-\d+)\b/u,
    )?.[1];
    const currentStateValue = document.match(
      /\*\*任务状态\*\*：\s*([^\n]+)/u,
    )?.[1];
    const currentState = currentStateValue
      ? normalizeTaskState(currentStateValue)
      : undefined;

    if (currentTask && currentState) {
      states.set(currentTask, currentState);
    }

    for (const line of document.split("\n")) {
      if (!line.startsWith("|")) {
        continue;
      }

      const columns = line
        .split("|")
        .slice(1, -1)
        .map((column) => column.trim());
      const taskId = columns[0]?.match(/\b([A-Z]+-\d+)\b/u)?.[1];
      const state = columns
        .map((column) => normalizeTaskState(column))
        .find(Boolean);

      if (taskId && state) {
        states.set(taskId, state);
      }
    }
  }

  return states;
}

export function findActiveTasks(taskStates) {
  return [...taskStates]
    .filter(([, state]) => state === "Ready" || state === "In Progress")
    .map(([taskId, state]) => ({ state, taskId }))
    .sort((left, right) => left.taskId.localeCompare(right.taskId));
}

export function dependencyDiagnostics({
  completedStates,
  dependencies,
  taskId,
  taskStates,
}) {
  const acceptedStates = new Set(completedStates);

  return (dependencies[taskId] ?? [])
    .filter((dependency) => !acceptedStates.has(taskStates.get(dependency)))
    .map((dependency) => ({
      detail: `${taskId} requires ${dependency} to be Done or Accepted; current state is ${
        taskStates.get(dependency) ?? "UNKNOWN"
      }`,
      ruleId: "DEPENDENCY_BLOCKED",
    }));
}

const allowedProfileOverrides = {
  code: new Set(["code", "hybrid", "security"]),
  design: new Set(["design", "hybrid"]),
  docs: new Set(["code", "docs", "hybrid", "research", "security"]),
  hybrid: new Set(["hybrid"]),
  research: new Set(["research"]),
  security: new Set(["security"]),
};

export function resolveProfileOverride(inferredProfile, requestedProfile) {
  if (!requestedProfile || requestedProfile === inferredProfile) {
    return { profile: requestedProfile ?? inferredProfile };
  }

  if (allowedProfileOverrides[inferredProfile]?.has(requestedProfile)) {
    return { profile: requestedProfile };
  }

  return {
    diagnostic: {
      detail: `profile ${requestedProfile} cannot replace inferred profile ${inferredProfile}`,
      ruleId: "AGENT_PROFILE_DOWNGRADE_BLOCKED",
    },
    profile: inferredProfile,
  };
}

export function contextDiagnostics({
  activeTasks,
  currentTaskId,
  mainIsCurrent,
  requestedTaskId,
}) {
  const diagnostics = [];

  if (!mainIsCurrent) {
    diagnostics.push({
      detail: "local main is not aligned with origin/main",
      ruleId: "CONTEXT_MAIN_STALE",
    });
  }

  if (activeTasks.length > 1) {
    diagnostics.push({
      detail: `multiple Ready/In Progress tasks: ${activeTasks
        .map(({ taskId, state }) => `${taskId} (${state})`)
        .join(", ")}`,
      ruleId: "CONTEXT_MULTIPLE_ACTIVE_TASKS",
    });
  }

  if (currentTaskId && requestedTaskId !== currentTaskId) {
    diagnostics.push({
      detail: `requested ${requestedTaskId}, but tasks/current.md names ${currentTaskId}`,
      ruleId: "CONTEXT_TASK_MISMATCH",
    });
  }

  return diagnostics;
}

function commandKey(command) {
  return JSON.stringify(command);
}

export function selectChangedValidation(paths, policy) {
  const normalizedPaths = [...new Set(paths.map(normalizePath))].sort();
  const matchedRuleIds = new Set();
  const commands = new Map();
  const unknownPaths = [];
  let escalation;

  for (const path of normalizedPaths) {
    const matchingRules = policy.pathRules.filter((rule) =>
      rule.patterns.some((pattern) => matchesGlob(path, pattern)),
    );

    if (matchingRules.length === 0) {
      unknownPaths.push(path);
      continue;
    }

    for (const rule of matchingRules) {
      matchedRuleIds.add(rule.id);
      if (rule.escalation === "full") {
        escalation = "full";
      }
      for (const command of rule.commands ?? []) {
        commands.set(commandKey(command), command);
      }
    }
  }

  if (unknownPaths.length > 0) {
    escalation = policy.fallback.escalation;
  }

  return {
    commands: [...commands.values()],
    escalation,
    matchedRuleIds: [...matchedRuleIds].sort(),
    paths: normalizedPaths,
    unknownPaths,
  };
}

const redactRules = [
  {
    expression:
      /((?:"|')?[A-Za-z0-9_]*(?:authorization|cookie|password|secret|token)[A-Za-z0-9_]*(?:"|')?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,;]+)/giu,
    replacement: "$1[REDACTED]",
  },
  {
    expression: /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu,
    replacement: "Bearer [REDACTED]",
  },
  {
    expression:
      /-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/gu,
    replacement: "[REDACTED PRIVATE KEY]",
  },
];

export function redactDiagnosticOutput(value) {
  return redactRules.reduce(
    (redacted, { expression, replacement }) =>
      redacted.replace(expression, replacement),
    value,
  );
}

export function boundedDiagnosticOutput(
  value,
  { maxChars = 12_000, lines = 80 } = {},
) {
  const redacted = redactDiagnosticOutput(value);
  const tail = redacted.split("\n").slice(-lines).join("\n");

  if (tail.length <= maxChars) {
    return tail;
  }

  return `[OUTPUT_TRUNCATED]\n${tail.slice(-maxChars)}`;
}

export function commandDisplay(command) {
  return command
    .map((part) => (/[\s"'\\]/u.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}
