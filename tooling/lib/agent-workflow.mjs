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

export function parseTaskStateObservations(documents) {
  const observations = new Map();

  function record(taskId, state, source, location) {
    const taskObservations = observations.get(taskId) ?? [];
    taskObservations.push({ location, source, state });
    observations.set(taskId, taskObservations);
  }

  for (const [documentIndex, documentInput] of documents.entries()) {
    const content =
      typeof documentInput === "string" ? documentInput : documentInput.content;
    const source =
      typeof documentInput === "string"
        ? `document[${documentIndex}]`
        : documentInput.path;
    const currentTask = content.match(
      /\*\*当前任务\*\*：\s*([A-Z]+-\d+)\b/u,
    )?.[1];
    const currentStateValue = content.match(
      /\*\*任务状态\*\*：\s*([^\n]+)/u,
    )?.[1];
    const currentState = currentStateValue
      ? normalizeTaskState(currentStateValue)
      : undefined;

    if (currentTask && currentState) {
      record(currentTask, currentState, source, "current-task");
    }

    for (const [lineIndex, line] of content.split("\n").entries()) {
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
        record(taskId, state, source, `line:${lineIndex + 1}`);
      }
    }
  }

  return observations;
}

export function resolveTaskStates(observations) {
  const states = new Map();
  for (const [taskId, taskObservations] of observations) {
    const uniqueStates = [
      ...new Set(taskObservations.map(({ state }) => state)),
    ];
    if (uniqueStates.length === 1) {
      states.set(taskId, uniqueStates[0]);
    }
  }
  return states;
}

export function parseTaskStates(documents) {
  return resolveTaskStates(parseTaskStateObservations(documents));
}

export function taskStateConflictDiagnostics(observations) {
  const diagnostics = [];

  for (const [taskId, taskObservations] of observations) {
    const uniqueStates = [
      ...new Set(taskObservations.map(({ state }) => state)),
    ];
    if (uniqueStates.length <= 1) {
      continue;
    }
    diagnostics.push({
      detail: `${taskId} has conflicting states: ${taskObservations
        .map(
          ({ location, source, state }) =>
            `${state} (${source}${location ? ` ${location}` : ""})`,
        )
        .join(", ")}`,
      ruleId: "CONTEXT_TASK_STATE_CONFLICT",
    });
  }

  return diagnostics.sort((left, right) =>
    left.detail.localeCompare(right.detail),
  );
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
  design: new Set(["design", "hybrid", "security"]),
  docs: new Set(["code", "design", "docs", "hybrid", "research", "security"]),
  hybrid: new Set(["hybrid", "security"]),
  research: new Set(["research", "security"]),
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

function combineImplicitProfiles(profiles) {
  const uniqueProfiles = new Set(profiles.filter(Boolean));
  if (uniqueProfiles.size > 1) {
    uniqueProfiles.delete("docs");
  }

  if (uniqueProfiles.has("security")) {
    return { profile: "security" };
  }
  if (uniqueProfiles.has("hybrid")) {
    return { profile: "hybrid" };
  }
  if (
    uniqueProfiles.has("research") &&
    (uniqueProfiles.has("code") || uniqueProfiles.has("design"))
  ) {
    return {
      diagnostic: {
        detail: `research impact cannot be safely combined with ${[
          ...uniqueProfiles,
        ].join(", ")}`,
        ruleId: "AGENT_PROFILE_COMBINATION_UNSUPPORTED",
      },
      profile: "research",
    };
  }
  if (uniqueProfiles.has("code") && uniqueProfiles.has("design")) {
    return { profile: "hybrid" };
  }

  return { profile: [...uniqueProfiles][0] ?? "docs" };
}

export function resolveEffectiveProfile({
  impactProfiles = [],
  requestedProfile,
  taskProfile,
}) {
  const implicitProfiles = [...new Set([taskProfile, ...impactProfiles])];
  const implicit = combineImplicitProfiles(implicitProfiles);
  if (implicit.diagnostic) {
    return {
      ...implicit,
      evidenceProfiles: implicitProfiles,
      implicitProfiles,
    };
  }

  const override = resolveProfileOverride(implicit.profile, requestedProfile);
  return {
    diagnostic: override.diagnostic,
    evidenceProfiles: [
      ...new Set([
        ...implicitProfiles,
        ...(requestedProfile ? [requestedProfile] : []),
        override.profile,
      ]),
    ],
    implicitProfiles,
    profile: override.profile,
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
  const impactProfiles = new Set();
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
      if (rule.impactProfile) {
        impactProfiles.add(rule.impactProfile);
      }
      for (const command of rule.commands ?? []) {
        commands.set(commandKey(command), command);
      }
    }
  }

  if (unknownPaths.length > 0) {
    escalation = policy.fallback.escalation;
    if (policy.fallback.impactProfile) {
      impactProfiles.add(policy.fallback.impactProfile);
    }
  }

  return {
    commands: [...commands.values()],
    escalation,
    impactProfiles: [...impactProfiles].sort(),
    matchedRuleIds: [...matchedRuleIds].sort(),
    paths: normalizedPaths,
    unknownPaths,
  };
}

function normalizeAuthoritySource(source, defaults = {}) {
  const normalized =
    typeof source === "string" ? { path: source } : { ...source };
  return {
    path: normalized.path,
    reason: normalized.reason ?? defaults.reason,
    required: normalized.required ?? defaults.required ?? true,
  };
}

export function selectAuthoritySources({
  paths,
  taskId,
  taskRule,
  topicRules,
}) {
  const sources = new Map();

  function addSource(source, metadata) {
    const existing = sources.get(source.path);
    const reasons = new Set([
      ...(existing?.reasons ?? []),
      ...(source.reason ? [source.reason] : []),
    ]);
    const ruleIds = new Set([
      ...(existing?.ruleIds ?? []),
      ...metadata.ruleIds,
    ]);
    const triggeredBy = new Set([
      ...(existing?.triggeredBy ?? []),
      ...metadata.triggeredBy,
    ]);
    sources.set(source.path, {
      path: source.path,
      reason: [...reasons].join("; "),
      reasons: [...reasons],
      required: Boolean(existing?.required || source.required),
      ruleIds: [...ruleIds].sort(),
      triggeredBy: [...triggeredBy].sort(),
    });
  }

  for (const sourceInput of taskRule.sources) {
    const source = normalizeAuthoritySource(sourceInput);
    addSource(source, {
      ruleIds: [`task:${taskRule.match}`],
      triggeredBy: [`task:${taskId}`],
    });
  }

  for (const topicRule of topicRules ?? []) {
    const matchingPaths = paths.filter((path) =>
      topicRule.patterns.some((pattern) => matchesGlob(path, pattern)),
    );
    if (matchingPaths.length === 0) {
      continue;
    }
    for (const sourceInput of topicRule.sources ?? []) {
      const source = normalizeAuthoritySource(sourceInput, {
        reason: `Authority required by topic ${topicRule.id}`,
      });
      addSource(source, {
        ruleIds: [`topic:${topicRule.id}`],
        triggeredBy: matchingPaths.map((path) => `path:${path}`),
      });
    }
  }

  return [...sources.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

export function collectManualEvidence(evidenceProfiles, policy) {
  return [
    ...new Set(
      evidenceProfiles.flatMap(
        (profile) => policy.profiles[profile]?.manualEvidence ?? [],
      ),
    ),
  ].sort();
}

export function resolveProfileFinalStatus(evidenceProfiles, policy) {
  const statuses = new Set(
    evidenceProfiles.map((profile) => policy.profiles[profile]?.finalStatus),
  );
  for (const status of [
    "EXTERNAL_AUTHORIZATION_REQUIRED",
    "MANUAL_EVIDENCE_REQUIRED",
    "PASS",
  ]) {
    if (statuses.has(status)) {
      return status;
    }
  }
  return [...statuses].find(Boolean) ?? "VALIDATION_BLOCKED";
}

export function determineValidationStatuses({
  blockedStatus,
  dryRun,
  failure,
  noChanges,
  profileFinalStatus,
}) {
  if (blockedStatus) {
    return { automatedStatus: "NOT_RUN", finalStatus: blockedStatus };
  }
  if (noChanges) {
    return { automatedStatus: "NOT_RUN", finalStatus: "NO_CHANGES" };
  }
  if (dryRun) {
    return { automatedStatus: "NOT_RUN", finalStatus: "PLANNED" };
  }
  if (failure) {
    return { automatedStatus: "FAIL", finalStatus: "FAIL" };
  }
  return { automatedStatus: "PASS", finalStatus: profileFinalStatus };
}

export function remoteStateDiagnostics({
  gitScope,
  issue,
  localMainSha,
  pullRequest,
  remoteMainSha,
}) {
  if (issue.state !== "OPEN") {
    return [
      {
        detail: `Issue #${issue.number} is ${issue.state}`,
        ruleId: "REMOTE_ISSUE_NOT_OPEN",
      },
    ];
  }
  if (localMainSha !== remoteMainSha) {
    return [
      {
        detail: "local main does not match GitHub main",
        ruleId: "REMOTE_MAIN_STALE",
      },
    ];
  }
  if (pullRequest && pullRequest.state !== "OPEN") {
    return [
      {
        detail: `PR #${pullRequest.number} is ${pullRequest.state}`,
        ruleId: "REMOTE_PR_NOT_OPEN",
      },
    ];
  }
  if (
    pullRequest &&
    ((gitScope.branch && pullRequest.headRefName !== gitScope.branch) ||
      pullRequest.headRefOid !== gitScope.headSha)
  ) {
    return [
      {
        detail: `PR #${pullRequest.number} head does not match local ${gitScope.branch ?? "detached HEAD"}@${gitScope.headSha ?? "UNKNOWN"}`,
        ruleId: "REMOTE_PR_HEAD_MISMATCH",
      },
    ];
  }
  return [];
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
  const outputLines = redacted.split("\n");
  const errorIndex = outputLines.findIndex((line) =>
    /\b(?:[A-Za-z]+Error|error|failed|failure|exception|ELIFECYCLE|ERR_[A-Z0-9_]*|TS\d{4})\b/iu.test(
      line,
    ),
  );
  const neighborhood =
    errorIndex === -1
      ? []
      : outputLines.slice(
          Math.max(0, errorIndex - 4),
          Math.min(outputLines.length, errorIndex + 7),
        );
  const tail = outputLines.slice(-lines);
  const boundedLines =
    neighborhood.length === 0
      ? tail
      : [
          "[ROOT_CAUSE_NEIGHBORHOOD]",
          ...neighborhood,
          "[OUTPUT_TAIL]",
          ...tail,
        ];
  const bounded = [...new Set(boundedLines)].join("\n");

  if (bounded.length <= maxChars) {
    return bounded;
  }

  if (neighborhood.length === 0) {
    return `[OUTPUT_TRUNCATED]\n${bounded.slice(-maxChars)}`;
  }

  const rootCause = neighborhood.join("\n");
  const outputTail = tail.join("\n");
  const sectionBudget = Math.max(1, Math.floor((maxChars - 64) / 2));
  return [
    "[OUTPUT_TRUNCATED]",
    "[ROOT_CAUSE_NEIGHBORHOOD]",
    rootCause.slice(0, sectionBudget),
    "[OUTPUT_TAIL]",
    outputTail.slice(-sectionBudget),
  ].join("\n");
}

export function commandDisplay(command) {
  return command
    .map((part) => (/[\s"'\\]/u.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}
