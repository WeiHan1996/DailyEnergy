import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

import { canonicalizeRoot, resolveContainedPath } from "./build-output.mjs";

const expectedLaneIds = [
  "docs",
  "static",
  "unit-contract",
  "db-integration",
  "queue-integration",
  "api-e2e",
  "admin-e2e",
  "miniapp-conformance",
  "resilience",
  "ai-deterministic",
  "ai-model-load-human",
  "manual-rc",
];

const expectedExternalLanes = new Map([
  ["miniapp-conformance", "INFRA_BLOCKED"],
  ["ai-model-load-human", "PENDING_EXPLICIT_AUTHORIZATION"],
  ["manual-rc", "MANUAL_EVIDENCE_PENDING"],
]);

const expectedRequiredMergeChecks = [
  "automated (docs)",
  "automated (static)",
  "automated (unit-contract)",
  "automated (db-integration)",
  "automated (queue-integration)",
  "automated (api-e2e)",
  "automated (admin-e2e)",
  "automated (resilience)",
  "automated (ai-deterministic)",
  "supply-chain",
  "E-011 automated full Gate",
];

const expectedMergeGate = {
  control_type: "GITHUB_RULESET_PLATFORM_ENFORCED",
  scope: "MAIN_BRANCH_MERGES",
  repository: "WeiHan1996/DailyEnergy",
  target_branch: "main",
  required_checks: expectedRequiredMergeChecks,
  strict_required_checks: true,
  status_check_integration_id: 15368,
  same_workflow_run_required: true,
  head_change_guard: "GH_MATCH_HEAD_COMMIT",
  merge_method: "SQUASH",
  pull_request: "REQUIRED",
  required_approving_review_count: 0,
  review_thread_resolution: "REQUIRED",
  linear_history: "REQUIRED",
  direct_push: "PROHIBITED",
  force_push: "PROHIBITED",
  branch_deletion: "PROHIBITED",
  bypass_actors: [],
  auto_merge: "PROHIBITED",
  receipt: "PR_COMMENT_AND_POST_MERGE_HANDOFF",
  owner_approval_evidence_per_merge: true,
  platform_enforcement: "ACTIVE",
  effective_on: "2026-08-20",
  production_or_rc_admission: "ADDITIONAL_GATES_REQUIRED",
};

const expectedRepositoryControls = {
  visibility: "PUBLIC",
  license: "ABSENT",
  ruleset_name: "DailyEnergy main protection",
  merge_methods: {
    squash: true,
    merge_commit: false,
    rebase: false,
    auto_merge: false,
  },
  actions: {
    enabled: true,
    fork_pull_request_approval_policy: "all_external_contributors",
  },
  security_and_analysis: {
    secret_scanning: "enabled",
    secret_scanning_push_protection: "enabled",
    vulnerability_alerts: "enabled",
    automated_security_fixes: "enabled",
  },
};

const expectedMinimumLaneCommands = new Map([
  [
    "docs",
    [
      ["pnpm", "run", "agent:check"],
      ["pnpm", "run", "registry:check"],
    ],
  ],
  [
    "static",
    [
      ["pnpm", "run", "format:check"],
      ["pnpm", "run", "lint"],
      ["pnpm", "run", "typecheck"],
      ["pnpm", "run", "ci:test"],
    ],
  ],
  [
    "unit-contract",
    [
      ["pnpm", "run", "config:fixtures"],
      ["pnpm", "run", "typecheck:fixtures"],
      ["pnpm", "run", "lint:fixtures"],
      ["pnpm", "run", "architecture:fixtures"],
      ["pnpm", "run", "contract:fixtures"],
      ["pnpm", "run", "admin:bundle:fixtures"],
      ["pnpm", "run", "agent:fixtures"],
      ["pnpm", "run", "registry:test"],
      ["pnpm", "run", "deployment:test"],
      ["pnpm", "run", "observability:validate"],
      ["pnpm", "run", "observability:runtime"],
      ["pnpm", "run", "phase-gate:validate"],
      ["pnpm", "run", "testing:playwright-policy"],
      ["pnpm", "run", "test:projects"],
      ["pnpm", "--filter", "@daily-energy/app-miniapp", "run", "test"],
    ],
  ],
  ["db-integration", [["pnpm", "run", "database:validate"]]],
  ["queue-integration", [["pnpm", "run", "queue:validate"]]],
  ["api-e2e", [["pnpm", "run", "test:api:e2e"]]],
  [
    "admin-e2e",
    [["pnpm", "--filter", "@daily-energy/app-admin", "run", "test:e2e"]],
  ],
  [
    "resilience",
    [
      ["pnpm", "run", "queue:test"],
      ["pnpm", "run", "compose:evidence"],
    ],
  ],
  [
    "ai-deterministic",
    [
      ["pnpm", "run", "testing:policy"],
      ["pnpm", "run", "test:harness"],
    ],
  ],
]);

const expectedLaneSourceIds = new Map([
  ["docs", ["S31-TEST-008"]],
  [
    "static",
    ["S31-TEST-047", "S32-DEPLOY-041", "S32-DEPLOY-042", "S32-DEPLOY-043"],
  ],
  [
    "unit-contract",
    [
      "S31-TEST-001",
      "S31-TEST-002",
      "S31-TEST-003",
      "S31-TEST-004",
      "S31-TEST-005",
      "S31-TEST-006",
      "S31-TEST-007",
      "S31-TEST-008",
      "S31-TEST-041",
      "S31-TEST-045",
      "S31-TEST-046",
      "S31-TEST-047",
      "S32-DEPLOY-001",
      "S32-DEPLOY-002",
      "S32-DEPLOY-007",
      "S32-DEPLOY-009",
      "S32-DEPLOY-010",
      "S32-DEPLOY-014",
      "S32-DEPLOY-018",
      "S32-DEPLOY-019",
      "S32-DEPLOY-023",
      "S32-DEPLOY-024",
      "S32-DEPLOY-025",
      "S32-DEPLOY-030",
      "S32-DEPLOY-031",
      "S32-DEPLOY-032",
      "S32-DEPLOY-047",
      "S33-OBS-001",
      "S33-OBS-002",
      "S33-OBS-003",
      "S33-OBS-004",
      "S33-OBS-005",
      "S33-OBS-006",
      "S33-OBS-007",
      "S33-OBS-008",
      "S33-OBS-009",
      "S33-OBS-010",
      "S33-OBS-011",
      "S33-OBS-012",
      "S33-OBS-013",
      "S33-OBS-014",
      "S33-OBS-015",
      "S33-OBS-016",
      "S33-OBS-017",
      "S33-OBS-018",
      "S33-OBS-019",
      "S33-OBS-020",
      "S33-OBS-021",
      "S33-OBS-022",
      "S33-OBS-023",
      "S33-OBS-024",
      "S33-OBS-025",
      "S33-OBS-026",
      "S33-OBS-027",
      "S33-OBS-028",
      "S33-OBS-029",
      "S33-OBS-030",
      "S33-OBS-031",
      "S33-OBS-032",
      "S33-OBS-033",
      "S33-OBS-034",
      "S33-OBS-035",
      "S33-OBS-036",
      "S33-OBS-037",
      "S33-OBS-038",
      "S33-OBS-039",
      "S33-OBS-040",
      "S33-OBS-041",
      "S33-OBS-042",
      "S33-OBS-043",
      "S33-OBS-044",
      "S33-OBS-045",
      "S33-OBS-046",
      "S33-OBS-047",
      "S33-OBS-048",
    ],
  ],
  [
    "db-integration",
    ["S31-TEST-017", "S31-TEST-018", "S31-TEST-020", "S31-TEST-023"],
  ],
  [
    "queue-integration",
    [
      "S31-TEST-025",
      "S31-TEST-026",
      "S31-TEST-027",
      "S31-TEST-028",
      "S31-TEST-029",
      "S31-TEST-030",
      "S31-TEST-032",
    ],
  ],
  ["api-e2e", ["S20-C02", "S31-TEST-035"]],
  ["admin-e2e", ["S32-DEPLOY-041"]],
  [
    "resilience",
    ["S31-TEST-027", "S31-TEST-047", "S32-DEPLOY-044", "S32-DEPLOY-045"],
  ],
  [
    "ai-deterministic",
    [
      "S31-TEST-003",
      "S31-TEST-004",
      "S31-TEST-005",
      "S31-TEST-041",
      "S31-TEST-045",
      "S31-TEST-046",
      "S31-TEST-047",
    ],
  ],
]);

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isSha(value) {
  return /^[a-f0-9]{40}$/u.test(value ?? "");
}

export function validateCiPolicy(policy) {
  if (
    policy?.policy_version !== "e-016-ci-policy-v5" ||
    policy.runner !== "ubuntu-24.04" ||
    policy.node_version !== "24.18.0" ||
    policy.pnpm_version !== "11.17.0" ||
    policy.remote_cache !== "DISABLED" ||
    policy.production_secrets !== "PROHIBITED" ||
    policy.oidc_deployment_permission !== "PROHIBITED" ||
    !sameJson(policy.default_permissions, { contents: "read" })
  ) {
    fail("CI_POLICY_BASELINE_INVALID", policy?.policy_version ?? "missing");
  }

  if (!sameJson(policy.merge_gate, expectedMergeGate)) {
    fail("CI_POLICY_MERGE_GATE_INVALID", "platform-control");
  }
  if (!sameJson(policy.repository_controls, expectedRepositoryControls)) {
    fail("CI_POLICY_REPOSITORY_CONTROLS_INVALID", "public-repository");
  }

  for (const [action, sha] of Object.entries(policy.actions ?? {})) {
    if (!isNonEmpty(action) || !isSha(sha)) {
      fail("CI_POLICY_ACTION_PIN_INVALID", action || "missing");
    }
  }
  for (const action of [
    "actions/checkout",
    "actions/setup-node",
    "actions/upload-artifact",
  ]) {
    if (!isSha(policy.actions?.[action])) {
      fail("CI_POLICY_ACTION_REQUIRED", action);
    }
  }

  if (
    policy.artifacts?.synthetic_reports?.retention_days !== 14 ||
    policy.artifacts.synthetic_reports.synthetic_only !== true ||
    policy.artifacts?.supply_chain_evidence?.retention_days !== 90 ||
    policy.artifacts.supply_chain_evidence.scope !== "PUBLIC_DEVELOPMENT_CI" ||
    policy.artifacts.supply_chain_evidence.synthetic_only !== true ||
    policy.artifacts?.rc_release_evidence?.retention_days !== 365 ||
    policy.artifacts.rc_release_evidence.storage_status !==
      "PENDING_APPROVED_ARCHIVAL" ||
    policy.artifacts.rc_release_evidence.pass_claim !== "PROHIBITED"
  ) {
    fail("CI_POLICY_ARTIFACT_RETENTION_INVALID", "14/90/365-pending");
  }

  const lanes = policy.lanes ?? [];
  if (
    !sameJson(
      lanes.map(({ id }) => id),
      expectedLaneIds,
    )
  ) {
    fail("CI_POLICY_LANE_TAXONOMY_DRIFT", lanes.map(({ id }) => id).join(","));
  }
  const laneIds = new Set();
  for (const lane of lanes) {
    if (!isNonEmpty(lane.id) || laneIds.has(lane.id)) {
      fail("CI_POLICY_LANE_DUPLICATE", lane?.id ?? "missing");
    }
    laneIds.add(lane.id);
    const externalStatus = expectedExternalLanes.get(lane.id);
    if (externalStatus) {
      if (
        lane.execution !== externalStatus ||
        lane.pass_claim !== "PROHIBITED" ||
        !isNonEmpty(lane.unlock) ||
        lane.commands !== undefined
      ) {
        fail("CI_POLICY_EXTERNAL_LANE_FALSE_PASS", lane.id);
      }
      continue;
    }
    if (
      lane.execution !== "AUTOMATED_REQUIRED" ||
      !Array.isArray(lane.commands) ||
      lane.commands.length === 0 ||
      lane.commands.some(
        (command) =>
          !Array.isArray(command) ||
          command.length === 0 ||
          command.some((argument) => !isNonEmpty(argument)),
      )
    ) {
      fail("CI_POLICY_AUTOMATED_LANE_INVALID", lane.id);
    }
    const commandKeys = new Set(
      lane.commands.map((command) => JSON.stringify(command)),
    );
    const missingCommand = expectedMinimumLaneCommands
      .get(lane.id)
      ?.find((command) => !commandKeys.has(JSON.stringify(command)));
    if (missingCommand) {
      fail(
        "CI_POLICY_REQUIRED_COMMAND_MISSING",
        `${lane.id}:${missingCommand.join(" ")}`,
      );
    }
    if (!sameJson(lane.source_ids, expectedLaneSourceIds.get(lane.id))) {
      fail("CI_POLICY_LANE_SOURCE_IDS_DRIFT", lane.id);
    }
  }
  return Object.freeze({
    automated: lanes.length - expectedExternalLanes.size,
    external: expectedExternalLanes.size,
    lanes: lanes.length,
  });
}

export function validatePrMergeGate(pullRequest, policy, expectedHeadSha) {
  validateCiPolicy(policy);
  if (!isSha(expectedHeadSha)) {
    fail("CI_PR_MERGE_GATE_HEAD_INVALID", expectedHeadSha ?? "missing");
  }
  if (
    pullRequest?.state !== "OPEN" ||
    pullRequest.isDraft !== false ||
    pullRequest.mergeable !== "MERGEABLE" ||
    pullRequest.mergeStateStatus !== "CLEAN" ||
    pullRequest.baseRefName !== policy.merge_gate.target_branch
  ) {
    fail("CI_PR_MERGE_GATE_PR_NOT_READY", pullRequest?.number ?? "missing");
  }
  if (pullRequest.headRefOid !== expectedHeadSha) {
    fail("CI_PR_MERGE_GATE_HEAD_CHANGED", pullRequest.headRefOid ?? "missing");
  }

  const checks = pullRequest.statusCheckRollup ?? [];
  const runIds = new Set();
  for (const requiredCheck of policy.merge_gate.required_checks) {
    const matches = checks.filter(({ name }) => name === requiredCheck);
    if (matches.length !== 1) {
      fail("CI_PR_MERGE_GATE_CHECK_COUNT_INVALID", requiredCheck);
    }
    const [check] = matches;
    if (check.status !== "COMPLETED" || check.conclusion !== "SUCCESS") {
      fail("CI_PR_MERGE_GATE_CHECK_NOT_SUCCESSFUL", requiredCheck);
    }
    if (check.workflowName !== "CI") {
      fail("CI_PR_MERGE_GATE_WORKFLOW_INVALID", requiredCheck);
    }
    const runId = /\/actions\/runs\/(\d+)(?:\/|$)/u.exec(
      check.detailsUrl ?? "",
    )?.[1];
    if (!runId) {
      fail("CI_PR_MERGE_GATE_RUN_ID_MISSING", requiredCheck);
    }
    runIds.add(runId);
  }
  if (policy.merge_gate.same_workflow_run_required && runIds.size !== 1) {
    fail("CI_PR_MERGE_GATE_RUN_MISMATCH", [...runIds].join(","));
  }

  return Object.freeze({
    checks: policy.merge_gate.required_checks.length,
    headSha: expectedHeadSha,
    pullRequest: pullRequest.number,
    runId: [...runIds][0],
  });
}

function findRule(ruleset, type) {
  return (ruleset?.rules ?? []).filter((rule) => rule.type === type);
}

export function validateRepositoryControls(snapshot, policy) {
  validateCiPolicy(policy);
  const repository = snapshot?.repository;
  const controls = policy.repository_controls;
  if (
    repository?.full_name !== policy.merge_gate.repository ||
    repository.visibility !== controls.visibility.toLowerCase() ||
    repository.private !== false ||
    repository.default_branch !== policy.merge_gate.target_branch ||
    repository.license !== null
  ) {
    fail(
      "CI_REPOSITORY_PUBLIC_BASELINE_INVALID",
      repository?.full_name ?? "missing",
    );
  }
  if (
    repository.allow_squash_merge !== controls.merge_methods.squash ||
    repository.allow_merge_commit !== controls.merge_methods.merge_commit ||
    repository.allow_rebase_merge !== controls.merge_methods.rebase ||
    repository.allow_auto_merge !== controls.merge_methods.auto_merge
  ) {
    fail("CI_REPOSITORY_MERGE_METHOD_INVALID", repository.full_name);
  }
  if (
    repository.security_and_analysis?.secret_scanning?.status !==
      controls.security_and_analysis.secret_scanning ||
    repository.security_and_analysis?.secret_scanning_push_protection
      ?.status !==
      controls.security_and_analysis.secret_scanning_push_protection ||
    snapshot.vulnerabilityAlertsEnabled !== true ||
    snapshot.automatedSecurityFixesEnabled !== true
  ) {
    fail("CI_REPOSITORY_SECURITY_CONTROL_INVALID", repository.full_name);
  }
  if (
    snapshot.actionsPermissions?.enabled !== controls.actions.enabled ||
    snapshot.forkPullRequestApproval?.approval_policy !==
      controls.actions.fork_pull_request_approval_policy
  ) {
    fail("CI_REPOSITORY_ACTIONS_CONTROL_INVALID", repository.full_name);
  }

  const ruleset = snapshot.mainRuleset;
  if (
    ruleset?.name !== controls.ruleset_name ||
    ruleset.target !== "branch" ||
    ruleset.enforcement !== "active" ||
    ruleset.source_type !== "Repository" ||
    !sameJson(ruleset.bypass_actors, []) ||
    !sameJson(ruleset.conditions?.ref_name, {
      exclude: [],
      include: ["~DEFAULT_BRANCH"],
    })
  ) {
    fail("CI_REPOSITORY_RULESET_BASELINE_INVALID", ruleset?.name ?? "missing");
  }
  for (const requiredRule of [
    "deletion",
    "non_fast_forward",
    "required_linear_history",
    "pull_request",
    "required_status_checks",
  ]) {
    if (findRule(ruleset, requiredRule).length !== 1) {
      fail("CI_REPOSITORY_RULESET_RULE_COUNT_INVALID", requiredRule);
    }
  }
  if ((ruleset.rules ?? []).length !== 5) {
    fail("CI_REPOSITORY_RULESET_RULE_COUNT_INVALID", "total");
  }

  const [pullRequestRule] = findRule(ruleset, "pull_request");
  const pullRequestParameters = pullRequestRule.parameters ?? {};
  if (
    pullRequestParameters.required_approving_review_count !==
      policy.merge_gate.required_approving_review_count ||
    pullRequestParameters.required_review_thread_resolution !== true ||
    pullRequestParameters.dismiss_stale_reviews_on_push !== false ||
    pullRequestParameters.require_code_owner_review !== false ||
    pullRequestParameters.require_last_push_approval !== false
  ) {
    fail("CI_REPOSITORY_PULL_REQUEST_RULE_INVALID", controls.ruleset_name);
  }

  const [statusRule] = findRule(ruleset, "required_status_checks");
  const statusParameters = statusRule.parameters ?? {};
  const actualChecks = (statusParameters.required_status_checks ?? [])
    .map(({ context, integration_id: integrationId }) => ({
      context,
      integration_id: integrationId,
    }))
    .sort((left, right) => left.context.localeCompare(right.context));
  const expectedChecks = policy.merge_gate.required_checks
    .map((context) => ({
      context,
      integration_id: policy.merge_gate.status_check_integration_id,
    }))
    .sort((left, right) => left.context.localeCompare(right.context));
  if (
    statusParameters.strict_required_status_checks_policy !== true ||
    statusParameters.do_not_enforce_on_create !== false ||
    !sameJson(actualChecks, expectedChecks)
  ) {
    fail("CI_REPOSITORY_REQUIRED_CHECKS_INVALID", controls.ruleset_name);
  }

  return Object.freeze({
    checks: actualChecks.length,
    repository: repository.full_name,
    ruleset: ruleset.name,
    visibility: repository.visibility,
  });
}

export function validateRepositoryLicenseFiles(rootFileNames, policy) {
  validateCiPolicy(policy);
  const licenseFiles = (rootFileNames ?? []).filter((fileName) =>
    /^(?:licen[cs]e|copying)(?:\.|$)/iu.test(fileName),
  );
  if (
    policy.repository_controls.license !== "ABSENT" ||
    licenseFiles.length !== 0
  ) {
    fail(
      "CI_REPOSITORY_LICENSE_FILE_PROHIBITED",
      licenseFiles.join(",") || "policy",
    );
  }
  return Object.freeze({ licenseFiles: 0 });
}

function triggerExists(triggers, trigger) {
  if (typeof triggers === "string") {
    return triggers === trigger;
  }
  if (Array.isArray(triggers)) {
    return triggers.includes(trigger);
  }
  return Object.hasOwn(triggers ?? {}, trigger);
}

function permissionDiagnostics(permissions, location) {
  const diagnostics = [];
  if (!sameJson(permissions, { contents: "read" })) {
    diagnostics.push(`CI_WORKFLOW_PERMISSION_NOT_MINIMAL:${location}`);
  }
  for (const [scope, access] of Object.entries(permissions ?? {})) {
    if (access === "write" || scope === "id-token") {
      diagnostics.push(
        `CI_WORKFLOW_PERMISSION_PROHIBITED:${location}:${scope}`,
      );
    }
  }
  return diagnostics;
}

function actionDiagnostic(uses, policy, location) {
  if (!isNonEmpty(uses) || uses.startsWith("./")) {
    return [];
  }
  const separator = uses.lastIndexOf("@");
  const action = separator >= 0 ? uses.slice(0, separator) : uses;
  const reference = separator >= 0 ? uses.slice(separator + 1) : "";
  if (!isSha(reference)) {
    return [`CI_WORKFLOW_ACTION_MUTABLE:${location}:${action}`];
  }
  if (policy.actions?.[action] !== reference) {
    return [`CI_WORKFLOW_ACTION_UNREVIEWED:${location}:${action}`];
  }
  return [];
}

function containsSecretsExpression(value) {
  if (typeof value === "string") {
    return /\$\{\{[\s\S]*?\bsecrets\b[\s\S]*?\}\}/iu.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsSecretsExpression);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) =>
        containsSecretsExpression(key) || containsSecretsExpression(entry),
    );
  }
  return false;
}

export function findWorkflowDiagnostics(source, policy, options = {}) {
  const diagnostics = [];
  let workflow;
  try {
    workflow = parse(source);
  } catch {
    return ["CI_WORKFLOW_YAML_INVALID:parse"];
  }
  if (!workflow || typeof workflow !== "object") {
    return ["CI_WORKFLOW_YAML_INVALID:document"];
  }

  if (/\bpull_request_target\b/u.test(source)) {
    diagnostics.push("CI_WORKFLOW_UNTRUSTED_TRIGGER:pull_request_target");
  }
  if (containsSecretsExpression(workflow)) {
    diagnostics.push("CI_WORKFLOW_SECRET_REFERENCE:untrusted-workflow");
  }
  if (/\bTURBO_(?:TOKEN|TEAM|REMOTE_ONLY)\b/u.test(source)) {
    diagnostics.push("CI_WORKFLOW_REMOTE_CACHE_ENABLED:turbo");
  }
  diagnostics.push(...permissionDiagnostics(workflow.permissions, "workflow"));

  const jobs = workflow.jobs ?? {};
  for (const [jobId, job] of Object.entries(jobs)) {
    if (job?.["runs-on"] !== policy.runner) {
      diagnostics.push(`CI_WORKFLOW_RUNNER_DRIFT:${jobId}`);
    }
    if (
      !Number.isSafeInteger(job?.["timeout-minutes"]) ||
      job["timeout-minutes"] <= 0 ||
      job["timeout-minutes"] > policy.default_timeout_minutes
    ) {
      diagnostics.push(`CI_WORKFLOW_TIMEOUT_INVALID:${jobId}`);
    }
    if (job.permissions !== undefined) {
      diagnostics.push(...permissionDiagnostics(job.permissions, jobId));
    }
    if (job.environment !== undefined) {
      diagnostics.push(`CI_WORKFLOW_ENVIRONMENT_PROHIBITED:${jobId}`);
    }

    const steps = job.steps ?? [];
    for (const [index, step] of steps.entries()) {
      const location = `${jobId}:${index + 1}`;
      if (step.uses) {
        diagnostics.push(...actionDiagnostic(step.uses, policy, location));
      }
      if (
        step.uses?.startsWith("actions/checkout@") &&
        step.with?.["fetch-depth"] !== 0
      ) {
        diagnostics.push(`CI_WORKFLOW_CHECKOUT_DEPTH_INVALID:${location}`);
      }
      if (
        step.uses?.startsWith("actions/checkout@") &&
        step.with?.["persist-credentials"] !== false
      ) {
        diagnostics.push(
          `CI_WORKFLOW_CHECKOUT_CREDENTIALS_PERSISTED:${location}`,
        );
      }
      if (step.uses?.startsWith("actions/upload-artifact@")) {
        const expectedRetention =
          jobId === "supply-chain"
            ? policy.artifacts.supply_chain_evidence.retention_days
            : policy.artifacts.synthetic_reports.retention_days;
        const expectedScanRun =
          jobId === "supply-chain"
            ? "node tooling/ci/scan-artifacts.mjs .artifacts/ci/supply-chain"
            : "node tooling/ci/scan-artifacts.mjs .artifacts/ci/${{ matrix.lane }}";
        const scanStep = steps
          .slice(0, index)
          .find(({ id }) => id === "artifact_scan");
        if (step.with?.["retention-days"] !== expectedRetention) {
          diagnostics.push(`CI_WORKFLOW_ARTIFACT_TTL_INVALID:${location}`);
        }
        if (
          step.if !== "always() && steps.artifact_scan.outcome == 'success'" ||
          step.with?.["if-no-files-found"] !== "error" ||
          scanStep?.if !== "always()" ||
          scanStep?.run !== expectedScanRun
        ) {
          diagnostics.push(
            `CI_WORKFLOW_ARTIFACT_UPLOAD_WITHOUT_SCAN_PASS:${location}`,
          );
        }
      }
    }
  }

  if (options.complete === true) {
    for (const trigger of ["pull_request", "push", "workflow_dispatch"]) {
      if (!triggerExists(workflow.on, trigger)) {
        diagnostics.push(`CI_WORKFLOW_TRIGGER_MISSING:${trigger}`);
      }
    }
    if (
      !isNonEmpty(workflow.concurrency?.group) ||
      workflow.concurrency?.["cancel-in-progress"] !== true
    ) {
      diagnostics.push("CI_WORKFLOW_CONCURRENCY_INVALID:workflow");
    }
    if (workflow.env?.NEXT_TELEMETRY_DISABLED !== "1") {
      diagnostics.push("CI_WORKFLOW_UNBOUNDED_TELEMETRY:next");
    }
    const requiredEvidenceEnvironment = {
      CI_BASE_SHA:
        "${{ github.event.pull_request.base.sha || github.event.before || github.sha }}",
      CI_BRANCH: "${{ github.head_ref || github.ref_name }}",
      CI_EVENT_NAME: "${{ github.event_name }}",
      CI_HEAD_SHA: "${{ github.event.pull_request.head.sha || github.sha }}",
      CI_PULL_REQUEST_NUMBER: "${{ github.event.pull_request.number || '' }}",
      CI_TESTED_SHA: "${{ github.sha }}",
    };
    for (const [name, expression] of Object.entries(
      requiredEvidenceEnvironment,
    )) {
      if (workflow.env?.[name] !== expression) {
        diagnostics.push(`CI_WORKFLOW_EVIDENCE_BINDING_INVALID:${name}`);
      }
    }
    const automated = policy.lanes
      .filter(({ execution }) => execution === "AUTOMATED_REQUIRED")
      .map(({ id }) => id);
    const matrix = jobs.automated?.strategy?.matrix?.lane;
    if (!sameJson(matrix, automated)) {
      diagnostics.push("CI_WORKFLOW_AUTOMATED_MATRIX_DRIFT:automated");
    }
    for (const jobId of ["automated", "supply-chain"]) {
      const runs = (jobs[jobId]?.steps ?? [])
        .map((step) => step.run)
        .filter(isNonEmpty)
        .join("\n");
      if (!runs.includes("corepack pnpm install --frozen-lockfile")) {
        diagnostics.push(`CI_WORKFLOW_FROZEN_INSTALL_MISSING:${jobId}`);
      }
      if (
        !runs.includes(
          `corepack prepare pnpm@${policy.pnpm_version} --activate`,
        )
      ) {
        diagnostics.push(`CI_WORKFLOW_PNPM_PIN_MISSING:${jobId}`);
      }
    }
    if (
      !(jobs.automated?.steps ?? []).some(
        ({ run }) => run === "node tooling/ci/run-lane.mjs ${{ matrix.lane }}",
      )
    ) {
      diagnostics.push("CI_WORKFLOW_LANE_RUNNER_MISSING:automated");
    }
    const fullGate = jobs["e011-full-gate"];
    if (
      !sameJson(fullGate?.needs, ["automated", "supply-chain"]) ||
      fullGate?.if !== "always()" ||
      !(fullGate?.steps ?? []).some(
        ({ run }) =>
          isNonEmpty(run) &&
          run.includes("needs.automated.result") &&
          run.includes("needs.supply-chain.result"),
      )
    ) {
      diagnostics.push("CI_WORKFLOW_FULL_GATE_INVALID:e011-full-gate");
    }
    const supplyRuns = (jobs["supply-chain"]?.steps ?? [])
      .map(({ run }) => run)
      .filter(isNonEmpty)
      .join("\n");
    for (const required of [
      "corepack pnpm run build",
      "node tooling/ci/run-audit.mjs",
      "node tooling/ci/generate-supply-chain.mjs",
      "node tooling/ci/scan-artifacts.mjs .artifacts/ci/supply-chain",
    ]) {
      if (!supplyRuns.includes(required)) {
        diagnostics.push(`CI_WORKFLOW_SUPPLY_CHAIN_STEP_MISSING:${required}`);
      }
    }
  }
  return [...new Set(diagnostics)].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function validateWorkflow(source, policy) {
  const diagnostics = findWorkflowDiagnostics(source, policy, {
    complete: true,
  });
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.join("\n"));
  }
}

export function validateTelemetryPolicy(policy) {
  if (
    policy?.policy_version !== "e-011-ci-telemetry-policy-v1" ||
    !Number.isSafeInteger(policy.maximum_total_series) ||
    policy.maximum_total_series <= 0 ||
    !Array.isArray(policy.metrics) ||
    policy.metrics.length === 0
  ) {
    fail("CI_TELEMETRY_POLICY_INVALID", policy?.policy_version ?? "missing");
  }
  const forbidden = new Set(policy.forbidden_labels ?? []);
  let totalSeries = 0;
  for (const [label, descriptor] of Object.entries(policy.labels ?? {})) {
    if (forbidden.has(label)) {
      fail("CI_TELEMETRY_FORBIDDEN_LABEL", label);
    }
    if (
      !isNonEmpty(descriptor.owner) ||
      !isNonEmpty(descriptor.purpose) ||
      !isNonEmpty(descriptor.query_owner) ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(descriptor.expires_on ?? "") ||
      !Array.isArray(descriptor.allowed_values) ||
      descriptor.allowed_values.length === 0 ||
      new Set(descriptor.allowed_values).size !==
        descriptor.allowed_values.length ||
      !Number.isSafeInteger(descriptor.maximum_cardinality) ||
      descriptor.maximum_cardinality < descriptor.allowed_values.length
    ) {
      fail("CI_TELEMETRY_LABEL_CONTRACT_INVALID", label);
    }
  }
  for (const metric of policy.metrics) {
    let maximum = 1;
    for (const label of metric.labels ?? []) {
      const descriptor = policy.labels?.[label];
      if (!descriptor) {
        fail("CI_TELEMETRY_LABEL_UNDECLARED", `${metric.name}:${label}`);
      }
      maximum *= descriptor.maximum_cardinality;
    }
    if (
      !isNonEmpty(metric.name) ||
      !Number.isSafeInteger(metric.maximum_series) ||
      maximum > metric.maximum_series
    ) {
      fail("CI_TELEMETRY_CARDINALITY_EXCEEDED", metric.name ?? "missing");
    }
    totalSeries += metric.maximum_series;
  }
  if (totalSeries > policy.maximum_total_series) {
    fail("CI_TELEMETRY_TOTAL_CARDINALITY_EXCEEDED", `${totalSeries}`);
  }
  for (const forbiddenField of [
    "raw_url",
    "query",
    "exception_message",
    "prompt",
    "safety_raw_text",
  ]) {
    if (policy.allowed_event_fields?.includes(forbiddenField)) {
      fail("CI_TELEMETRY_RAW_FIELD_ALLOWED", forbiddenField);
    }
  }
  return Object.freeze({ metrics: policy.metrics.length, totalSeries });
}

export function validateTurboPolicy(configuration) {
  const tasks = configuration?.tasks ?? {};
  const buildInputs = tasks.build?.inputs ?? [];
  const buildOutputs = tasks.build?.outputs ?? [];
  if (
    !buildInputs.includes("!**/.env*") ||
    buildOutputs.some((output) => /(?:\.env|secret|credential)/iu.test(output))
  ) {
    fail("CI_CACHE_SENSITIVE_INPUT", "build");
  }
  if (tasks.test?.cache !== false) {
    fail("CI_CACHE_TEST_RESULT_PROHIBITED", "test");
  }
  for (const [task, descriptor] of Object.entries(tasks)) {
    if (
      /(?:migrat|restore|release|deploy)/iu.test(task) &&
      descriptor.cache !== false
    ) {
      fail("CI_CACHE_CRITICAL_TASK_PROHIBITED", task);
    }
  }
  const serialized = JSON.stringify(configuration);
  if (/TURBO_(?:TOKEN|TEAM|REMOTE_ONLY)/u.test(serialized)) {
    fail("CI_CACHE_REMOTE_UNREVIEWED", "turbo");
  }
  return Object.freeze({ tasks: Object.keys(tasks).length });
}

export function validateLicenseInventory(inventory, policy) {
  if (
    policy?.policy_version !== "e-011-license-policy-v1" ||
    policy.unknown_license !== "FAIL_CLOSED" ||
    !Array.isArray(policy.allowed_expressions) ||
    !Array.isArray(policy.denied_patterns)
  ) {
    fail("CI_LICENSE_POLICY_INVALID", policy?.policy_version ?? "missing");
  }
  const packages = [];
  for (const [expression, entries] of Object.entries(inventory ?? {})) {
    const conditionalPackages = policy.conditional_packages?.[expression];
    if (
      (!policy.allowed_expressions.includes(expression) &&
        !Array.isArray(conditionalPackages)) ||
      policy.denied_patterns.some((pattern) =>
        new RegExp(pattern, "iu").test(expression),
      )
    ) {
      fail("CI_LICENSE_EXPRESSION_DENIED", expression);
    }
    for (const entry of entries ?? []) {
      for (const version of entry.versions ?? []) {
        if (!isNonEmpty(entry.name) || !isNonEmpty(version)) {
          fail("CI_LICENSE_PACKAGE_INVALID", expression);
        }
        const conditionallyAllowed = (conditionalPackages ?? []).some(
          (candidate) =>
            candidate?.name === entry.name && candidate.version === version,
        );
        if (
          !policy.allowed_expressions.includes(expression) &&
          !conditionallyAllowed
        ) {
          fail(
            "CI_LICENSE_PACKAGE_DENIED",
            `${expression}:${entry.name}@${version}`,
          );
        }
        packages.push({
          license: expression,
          name: entry.name,
          version,
        });
      }
    }
  }
  if (packages.length === 0) {
    fail("CI_LICENSE_INVENTORY_EMPTY", "pnpm");
  }
  const unique = new Map(
    packages.map((entry) => [`${entry.name}@${entry.version}`, entry]),
  );
  return [...unique.values()].sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(
      `${right.name}@${right.version}`,
    ),
  );
}

function artifactObjectDiagnostics(
  value,
  { allowed, location, required = allowed },
) {
  const diagnostics = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`CI_ARTIFACT_SCHEMA_TYPE_INVALID:${location}`];
  }
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      diagnostics.push(`CI_ARTIFACT_METADATA_NOT_ALLOWED:${location}.${key}`);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      diagnostics.push(
        `CI_ARTIFACT_REQUIRED_METADATA_MISSING:${location}.${key}`,
      );
    }
  }
  return diagnostics;
}

function isIsoUtc(value) {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function collectLockfilePackageCoordinates(source) {
  let lockfile;
  try {
    lockfile = parse(source);
  } catch {
    fail("CI_LOCKFILE_INVALID", "parse");
  }
  if (
    lockfile?.lockfileVersion !== "9.0" ||
    !lockfile.packages ||
    typeof lockfile.packages !== "object" ||
    Array.isArray(lockfile.packages)
  ) {
    fail("CI_LOCKFILE_INVALID", "packages");
  }
  const coordinates = new Set();
  for (const key of Object.keys(lockfile.packages)) {
    const separator = key.lastIndexOf("@");
    const name = key.slice(0, separator);
    const version = key.slice(separator + 1);
    if (
      separator <= 0 ||
      !/^@?[a-z0-9][a-z0-9._/@-]{0,214}$/u.test(name) ||
      !/^[A-Za-z0-9.+_-]{1,128}$/u.test(version)
    ) {
      fail("CI_LOCKFILE_PACKAGE_INVALID", key);
    }
    coordinates.add(`${name}@${version}`);
  }
  if (coordinates.size === 0) {
    fail("CI_LOCKFILE_INVALID", "empty-packages");
  }
  return coordinates;
}

function validateLaneEvidence(value, policy, options) {
  const diagnostics = artifactObjectDiagnostics(value, {
    allowed: policy.allowed_metadata ?? [],
    location: "$",
  });
  const lane = options.lane;
  const ciPolicy = options.ciPolicy;
  const toolVersions = value?.tool_versions;
  diagnostics.push(
    ...artifactObjectDiagnostics(toolVersions, {
      allowed: [
        "artifact_scanner",
        "ci_policy",
        "ci_runner",
        "node",
        "pnpm",
        "source_registry",
      ],
      location: "$.tool_versions",
    }),
  );
  if (
    value?.artifact_version !== "e-011-ci-lane-evidence-v2" ||
    value.repository !== "WeiHan1996/DailyEnergy" ||
    !["local", "pull_request", "push", "workflow_dispatch"].includes(
      value.event_name,
    ) ||
    !/^[A-Za-z0-9._/-]{1,255}$/u.test(value.branch ?? "") ||
    (value.pull_request !== null &&
      (!Number.isSafeInteger(value.pull_request) || value.pull_request <= 0)) ||
    !isSha(value.head_sha) ||
    !isSha(value.base_sha) ||
    !isSha(value.tested_sha) ||
    !isIsoUtc(value.started_at_utc) ||
    !isIsoUtc(value.ended_at_utc) ||
    !isNonNegativeInteger(value.duration_ms) ||
    !["PASS", "FAIL"].includes(value.result) ||
    !["NONE", "COMMAND_FAILED"].includes(value.failure_code) ||
    !["NONE", "INSPECT_REDACTED_FAILURE_AND_RERUN"].includes(
      value.next_action,
    ) ||
    value.runner_version !== ciPolicy?.runner ||
    value.fixture_version !== "synthetic-factory-v1" ||
    value.registry_version !== options.registryVersion ||
    value.lane_id !== lane?.id ||
    !sameJson(value.source_ids, lane?.source_ids) ||
    !/^[a-f0-9]{64}$/u.test(value.lockfile_sha256 ?? "") ||
    !/^[a-f0-9]{64}$/u.test(value.toolchain_fingerprint ?? "") ||
    !isNonNegativeInteger(value.command_count) ||
    !isNonNegativeInteger(value.completed_command_count) ||
    value.command_count !== lane?.commands?.length ||
    value.completed_command_count > value.command_count ||
    (value.failed_command_ordinal !== null &&
      (!Number.isSafeInteger(value.failed_command_ordinal) ||
        value.failed_command_ordinal <= 0 ||
        value.failed_command_ordinal > value.command_count)) ||
    toolVersions?.node !== ciPolicy?.node_version ||
    toolVersions?.pnpm !== ciPolicy?.pnpm_version ||
    toolVersions?.ci_policy !== ciPolicy?.policy_version ||
    toolVersions?.ci_runner !== "e-011-ci-runner-v2" ||
    toolVersions?.artifact_scanner !== "e-011-artifact-scanner-v2" ||
    toolVersions?.source_registry !== options.registryVersion
  ) {
    diagnostics.push("CI_ARTIFACT_LANE_EVIDENCE_INVALID:$");
  }
  if (
    (value?.result === "PASS" &&
      (value.failure_code !== "NONE" ||
        value.next_action !== "NONE" ||
        value.failed_command_ordinal !== null ||
        value.completed_command_count !== value.command_count)) ||
    (value?.result === "FAIL" &&
      (value.failure_code !== "COMMAND_FAILED" ||
        value.next_action !== "INSPECT_REDACTED_FAILURE_AND_RERUN" ||
        value.failed_command_ordinal === null))
  ) {
    diagnostics.push("CI_ARTIFACT_LANE_OUTCOME_INCONSISTENT:$");
  }
  return diagnostics;
}

function validateVulnerabilitySummary(value) {
  const diagnostics = artifactObjectDiagnostics(value, {
    allowed: [
      "advisories",
      "artifact_version",
      "counts",
      "policy_version",
      "result",
      "scope",
    ],
    location: "$",
  });
  diagnostics.push(
    ...artifactObjectDiagnostics(value?.counts, {
      allowed: ["critical", "high"],
      location: "$.counts",
    }),
  );
  if (
    value?.artifact_version !== "e-011-vulnerability-summary-v1" ||
    value.policy_version !== "e-011-vulnerability-policy-v1" ||
    value.scope !== "production" ||
    !["PASS", "FAIL"].includes(value.result) ||
    !isNonNegativeInteger(value.counts?.critical) ||
    !isNonNegativeInteger(value.counts?.high) ||
    !Array.isArray(value.advisories)
  ) {
    diagnostics.push("CI_ARTIFACT_VULNERABILITY_SUMMARY_INVALID:$");
    return diagnostics;
  }
  for (const [index, advisory] of value.advisories.entries()) {
    const location = `$.advisories[${index}]`;
    diagnostics.push(
      ...artifactObjectDiagnostics(advisory, {
        allowed: ["advisory_id", "module_name", "severity"],
        location,
      }),
    );
    if (
      !/^GHSA-[a-z0-9-]+$/u.test(advisory.advisory_id ?? "") ||
      !/^@?[A-Za-z0-9][A-Za-z0-9._/@-]{0,214}$/u.test(
        advisory.module_name ?? "",
      ) ||
      !["critical", "high"].includes(advisory.severity)
    ) {
      diagnostics.push(`CI_ARTIFACT_VULNERABILITY_ENTRY_INVALID:${location}`);
    }
  }
  return diagnostics;
}

function validateDigestDocument(value) {
  const diagnostics = artifactObjectDiagnostics(value, {
    allowed: [
      "base_sha",
      "entries",
      "head_sha",
      "lockfile_sha256",
      "manifest_version",
      "tested_sha",
    ],
    location: "$",
  });
  if (
    value?.manifest_version !== "e-011-build-digest-v2" ||
    !isSha(value.head_sha) ||
    !isSha(value.base_sha) ||
    !isSha(value.tested_sha) ||
    !/^[a-f0-9]{64}$/u.test(value.lockfile_sha256 ?? "") ||
    !Array.isArray(value.entries) ||
    value.entries.length === 0
  ) {
    diagnostics.push("CI_ARTIFACT_DIGEST_DOCUMENT_INVALID:$");
    return diagnostics;
  }
  for (const [index, entry] of value.entries.entries()) {
    const location = `$.entries[${index}]`;
    diagnostics.push(
      ...artifactObjectDiagnostics(entry, {
        allowed: ["path", "sha256"],
        location,
      }),
    );
    if (
      !/^[!-~]+$/u.test(entry.path ?? "") ||
      entry.path.includes("\\") ||
      !/^[a-f0-9]{64}$/u.test(entry.sha256 ?? "")
    ) {
      diagnostics.push(`CI_ARTIFACT_DIGEST_ENTRY_INVALID:${location}`);
    }
  }
  return diagnostics;
}

function validateSpdxDocument(value, options) {
  const diagnostics = artifactObjectDiagnostics(value, {
    allowed: [
      "SPDXID",
      "creationInfo",
      "dataLicense",
      "documentNamespace",
      "name",
      "packages",
      "relationships",
      "spdxVersion",
    ],
    location: "$",
  });
  diagnostics.push(
    ...artifactObjectDiagnostics(value?.creationInfo, {
      allowed: ["created", "creators"],
      location: "$.creationInfo",
    }),
  );
  if (
    value?.spdxVersion !== "SPDX-2.3" ||
    value.dataLicense !== "CC0-1.0" ||
    value.SPDXID !== "SPDXRef-DOCUMENT" ||
    !/^dailyenergy-[a-f0-9]{12}$/u.test(value.name ?? "") ||
    !/^https:\/\/dailyenergy\.invalid\/spdx\/[a-f0-9]{40}\/[a-f0-9]{40}\/[a-f0-9]{64}$/u.test(
      value.documentNamespace ?? "",
    ) ||
    !isIsoUtc(value.creationInfo?.created) ||
    !sameJson(value.creationInfo?.creators, [
      "Tool: DailyEnergy-E011-SBOM-v1",
    ]) ||
    !Array.isArray(value.packages) ||
    value.packages.length === 0 ||
    !Array.isArray(value.relationships)
  ) {
    diagnostics.push("CI_ARTIFACT_SPDX_DOCUMENT_INVALID:$");
    return diagnostics;
  }
  if (!(options.lockfilePackageCoordinates instanceof Set)) {
    diagnostics.push("CI_ARTIFACT_SPDX_LOCKFILE_CONTEXT_MISSING:$");
  }
  for (const [index, packageEntry] of value.packages.entries()) {
    const location = `$.packages[${index}]`;
    diagnostics.push(
      ...artifactObjectDiagnostics(packageEntry, {
        allowed: [
          "SPDXID",
          "copyrightText",
          "downloadLocation",
          "externalRefs",
          "filesAnalyzed",
          "licenseConcluded",
          "licenseDeclared",
          "name",
          "versionInfo",
        ],
        location,
        required: [
          "SPDXID",
          "copyrightText",
          "downloadLocation",
          "filesAnalyzed",
          "licenseConcluded",
          "licenseDeclared",
          "name",
          "versionInfo",
        ],
      }),
    );
    if (
      !/^SPDXRef-[A-Za-z0-9.-]+$/u.test(packageEntry.SPDXID ?? "") ||
      !/^@?[A-Za-z0-9][A-Za-z0-9._/@-]{0,214}$/u.test(
        packageEntry.name ?? "",
      ) ||
      !/^[A-Za-z0-9.+_-]{1,128}$/u.test(packageEntry.versionInfo ?? "") ||
      packageEntry.downloadLocation !== "NOASSERTION" ||
      packageEntry.filesAnalyzed !== false ||
      !/^[A-Za-z0-9 .()+-]{1,128}$/u.test(
        packageEntry.licenseConcluded ?? "",
      ) ||
      packageEntry.licenseDeclared !== packageEntry.licenseConcluded ||
      packageEntry.copyrightText !== "NOASSERTION"
    ) {
      diagnostics.push(`CI_ARTIFACT_SPDX_PACKAGE_INVALID:${location}`);
    }
    const isRootPackage = packageEntry.SPDXID === "SPDXRef-DailyEnergy";
    const coordinate = `${packageEntry.name}@${packageEntry.versionInfo}`;
    if (
      (isRootPackage && coordinate !== "daily-energy@0.1.0") ||
      (!isRootPackage && !options.lockfilePackageCoordinates?.has(coordinate))
    ) {
      diagnostics.push(`CI_ARTIFACT_SPDX_PACKAGE_NOT_IN_LOCKFILE:${location}`);
    }
    if (
      packageEntry.externalRefs !== undefined &&
      !Array.isArray(packageEntry.externalRefs)
    ) {
      diagnostics.push(`CI_ARTIFACT_SPDX_REFERENCE_INVALID:${location}`);
    }
    const externalReferences = Array.isArray(packageEntry.externalRefs)
      ? packageEntry.externalRefs
      : [];
    for (const [referenceIndex, reference] of externalReferences.entries()) {
      const referenceLocation = `${location}.externalRefs[${referenceIndex}]`;
      diagnostics.push(
        ...artifactObjectDiagnostics(reference, {
          allowed: ["referenceCategory", "referenceLocator", "referenceType"],
          location: referenceLocation,
        }),
      );
      if (
        reference.referenceCategory !== "OTHER" ||
        reference.referenceType !== "pnpm-lock-sha256" ||
        !/^[a-f0-9]{64}$/u.test(reference.referenceLocator ?? "")
      ) {
        diagnostics.push(
          `CI_ARTIFACT_SPDX_REFERENCE_INVALID:${referenceLocation}`,
        );
      }
    }
  }
  for (const [index, relationship] of value.relationships.entries()) {
    const location = `$.relationships[${index}]`;
    diagnostics.push(
      ...artifactObjectDiagnostics(relationship, {
        allowed: ["relatedSpdxElement", "relationshipType", "spdxElementId"],
        location,
      }),
    );
    if (
      relationship.spdxElementId !== "SPDXRef-DailyEnergy" ||
      relationship.relationshipType !== "DEPENDS_ON" ||
      !/^SPDXRef-[A-Za-z0-9.-]+$/u.test(relationship.relatedSpdxElement ?? "")
    ) {
      diagnostics.push(`CI_ARTIFACT_SPDX_RELATIONSHIP_INVALID:${location}`);
    }
  }
  return diagnostics;
}

function validateProvenanceDocument(value, options) {
  const diagnostics = [];
  const objects = [
    [
      value,
      [
        "_type",
        "attestation_status",
        "predicate",
        "predicateType",
        "promotion_status",
        "signature_status",
        "subject",
      ],
      "$",
    ],
    [value?.subject?.[0], ["digest", "name"], "$.subject[0]"],
    [value?.subject?.[0]?.digest, ["sha256"], "$.subject[0].digest"],
    [value?.predicate, ["buildDefinition", "runDetails"], "$.predicate"],
    [
      value?.predicate?.buildDefinition,
      [
        "buildType",
        "externalParameters",
        "internalParameters",
        "resolvedDependencies",
      ],
      "$.predicate.buildDefinition",
    ],
    [
      value?.predicate?.buildDefinition?.externalParameters,
      [
        "base_sha",
        "branch",
        "event_name",
        "head_sha",
        "lockfile_sha256",
        "pull_request",
        "tested_sha",
        "workflow",
      ],
      "$.predicate.buildDefinition.externalParameters",
    ],
    [
      value?.predicate?.buildDefinition?.internalParameters,
      ["node_version", "pnpm_version", "runner"],
      "$.predicate.buildDefinition.internalParameters",
    ],
    [
      value?.predicate?.runDetails,
      ["builder", "byproducts", "metadata"],
      "$.predicate.runDetails",
    ],
    [
      value?.predicate?.runDetails?.builder,
      ["id"],
      "$.predicate.runDetails.builder",
    ],
    [
      value?.predicate?.runDetails?.metadata,
      ["finishedOn", "invocationId", "startedOn"],
      "$.predicate.runDetails.metadata",
    ],
  ];
  for (const [object, allowed, location] of objects) {
    diagnostics.push(
      ...artifactObjectDiagnostics(object, { allowed, location }),
    );
  }
  const dependencies =
    value?.predicate?.buildDefinition?.resolvedDependencies ?? [];
  if (Array.isArray(dependencies)) {
    for (const [index, dependency] of dependencies.entries()) {
      diagnostics.push(
        ...artifactObjectDiagnostics(dependency, {
          allowed: ["digest", "uri"],
          location: `$.predicate.buildDefinition.resolvedDependencies[${index}]`,
        }),
        ...artifactObjectDiagnostics(dependency?.digest, {
          allowed:
            dependency?.uri === "file:pnpm-lock.yaml"
              ? ["sha256"]
              : ["gitCommit"],
          location: `$.predicate.buildDefinition.resolvedDependencies[${index}].digest`,
        }),
      );
    }
  }
  if (
    value?._type !== "https://in-toto.io/Statement/v1" ||
    !Array.isArray(value.subject) ||
    value.subject.length !== 1 ||
    value.subject[0]?.name !== "build-output-digests.json" ||
    !/^[a-f0-9]{64}$/u.test(value.subject[0]?.digest?.sha256 ?? "") ||
    value.predicateType !== "https://slsa.dev/provenance/v1" ||
    value.predicate?.buildDefinition?.buildType !==
      "https://dailyenergy.invalid/build-types/pnpm-turbo/v1" ||
    !isSha(value.predicate?.buildDefinition?.externalParameters?.head_sha) ||
    !isSha(value.predicate?.buildDefinition?.externalParameters?.base_sha) ||
    !isSha(value.predicate?.buildDefinition?.externalParameters?.tested_sha) ||
    !/^[A-Za-z0-9._/-]{1,255}$/u.test(
      value.predicate?.buildDefinition?.externalParameters?.branch ?? "",
    ) ||
    !["local", "pull_request", "push", "workflow_dispatch"].includes(
      value.predicate?.buildDefinition?.externalParameters?.event_name,
    ) ||
    (value.predicate?.buildDefinition?.externalParameters?.pull_request !==
      null &&
      (!Number.isSafeInteger(
        value.predicate?.buildDefinition?.externalParameters?.pull_request,
      ) ||
        value.predicate?.buildDefinition?.externalParameters?.pull_request <=
          0)) ||
    !/^[a-f0-9]{64}$/u.test(
      value.predicate?.buildDefinition?.externalParameters?.lockfile_sha256 ??
        "",
    ) ||
    value.predicate?.buildDefinition?.externalParameters?.workflow !==
      ".github/workflows/ci.yml" ||
    value.predicate?.buildDefinition?.internalParameters?.node_version !==
      options.ciPolicy?.node_version ||
    value.predicate?.buildDefinition?.internalParameters?.pnpm_version !==
      options.ciPolicy?.pnpm_version ||
    !["local-untrusted", "ubuntu-24.04"].includes(
      value.predicate?.buildDefinition?.internalParameters?.runner,
    ) ||
    !Array.isArray(dependencies) ||
    dependencies.length !== 2 ||
    value.predicate?.runDetails?.builder?.id !==
      "https://github.com/WeiHan1996/DailyEnergy/actions" ||
    !/^(?:local-untrusted|[0-9]+)$/u.test(
      value.predicate?.runDetails?.metadata?.invocationId ?? "",
    ) ||
    !isIsoUtc(value.predicate?.runDetails?.metadata?.startedOn) ||
    !isIsoUtc(value.predicate?.runDetails?.metadata?.finishedOn) ||
    !sameJson(value.predicate?.runDetails?.byproducts, []) ||
    value.attestation_status !==
      "PENDING_REPOSITORY_CAPABILITY_AND_EXPLICIT_RELEASE_AUTHORIZATION" ||
    value.signature_status !== "UNSIGNED" ||
    value.promotion_status !==
      "PROHIBITED_UNTIL_ATTESTED_AND_RELEASE_GATES_PASS"
  ) {
    diagnostics.push("CI_ARTIFACT_PROVENANCE_DOCUMENT_INVALID:$");
  }
  return diagnostics;
}

export function findArtifactDiagnostics(value, policy, options = {}) {
  const diagnostics = [];
  const forbiddenKeys = new Set(policy.forbidden_keys ?? []);
  const patterns = (policy.forbidden_value_patterns ?? []).map(
    (pattern) => new RegExp(pattern, "iu"),
  );
  function visit(current, location) {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${location}[${index}]`));
      return;
    }
    if (current && typeof current === "object") {
      for (const [key, entry] of Object.entries(current)) {
        if (forbiddenKeys.has(key.toLowerCase())) {
          diagnostics.push(`CI_ARTIFACT_FORBIDDEN_KEY:${location}.${key}`);
        }
        visit(entry, `${location}.${key}`);
      }
      return;
    }
    if (typeof current === "string") {
      if (
        /^(?:[a-f0-9]{40}|[a-f0-9]{64}|sha256:[a-f0-9]{64})$/u.test(current)
      ) {
        return;
      }
      if (patterns.some((pattern) => pattern.test(current))) {
        diagnostics.push(`CI_ARTIFACT_FORBIDDEN_VALUE:${location}`);
      }
    }
  }
  visit(value, "$");

  const schemaDiagnostics =
    options.artifactName === "evidence.json"
      ? validateLaneEvidence(value, policy, options)
      : options.artifactName === "vulnerability-summary.json"
        ? validateVulnerabilitySummary(value)
        : options.artifactName === "build-output-digests.json"
          ? validateDigestDocument(value)
          : options.artifactName === "sbom.spdx.json"
            ? validateSpdxDocument(value, options)
            : options.artifactName === "provenance.intoto.json"
              ? validateProvenanceDocument(value, options)
              : options.artifactName
                ? [`CI_ARTIFACT_SCHEMA_UNKNOWN:${options.artifactName}`]
                : artifactObjectDiagnostics(value, {
                    allowed: policy.allowed_metadata ?? [],
                    location: "$",
                    required: [],
                  });
  diagnostics.push(...schemaDiagnostics);
  return [...new Set(diagnostics)].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export async function verifyDigestManifest(root, manifest) {
  if (
    manifest?.manifest_version !== "e-011-build-digest-v2" ||
    !Array.isArray(manifest.entries) ||
    manifest.entries.length === 0
  ) {
    fail("CI_DIGEST_MANIFEST_INVALID", manifest?.manifest_version ?? "missing");
  }
  const canonicalRoot = await canonicalizeRoot(root);
  const paths = new Set();
  for (const entry of manifest.entries) {
    const segments = entry?.path?.split("/") ?? [];
    if (
      !isNonEmpty(entry.path) ||
      path.isAbsolute(entry.path) ||
      path.win32.isAbsolute(entry.path) ||
      entry.path.includes("\\") ||
      segments.some(
        (segment) => segment === "" || segment === "." || segment === "..",
      ) ||
      path.posix.normalize(entry.path) !== entry.path ||
      !/^[a-f0-9]{64}$/u.test(entry.sha256 ?? "")
    ) {
      fail("CI_DIGEST_ENTRY_INVALID", entry?.path ?? "missing");
    }
    if (paths.has(entry.path)) {
      fail("CI_DIGEST_ENTRY_DUPLICATE", entry.path);
    }
    paths.add(entry.path);
    const artifactPath = path.resolve(root, ...segments);
    const canonicalArtifactPath = await resolveContainedPath(
      canonicalRoot,
      artifactPath,
      {
        detail: entry.path,
        outsideRule: "CI_DIGEST_ARTIFACT_OUTSIDE_ROOT",
        unresolvedRule: "CI_DIGEST_ARTIFACT_MISSING",
      },
    );
    let contents;
    try {
      contents = await readFile(canonicalArtifactPath);
    } catch {
      fail("CI_DIGEST_ARTIFACT_MISSING", entry.path);
    }
    if (sha256(contents) !== entry.sha256) {
      fail("CI_DIGEST_MISMATCH", entry.path);
    }
  }
  return Object.freeze({ entries: manifest.entries.length });
}

export function validateSupplyChainDocuments({
  digestManifest,
  provenance,
  sbom,
}) {
  const headSha = digestManifest?.head_sha;
  const baseSha = digestManifest?.base_sha;
  const testedSha = digestManifest?.tested_sha;
  const lockfileSha256 = digestManifest?.lockfile_sha256;
  const digestManifestSha256 = sha256(
    `${JSON.stringify(digestManifest, null, 2)}\n`,
  );
  if (
    digestManifest?.manifest_version !== "e-011-build-digest-v2" ||
    !/^[a-f0-9]{40}$/u.test(headSha ?? "") ||
    !/^[a-f0-9]{40}$/u.test(baseSha ?? "") ||
    !/^[a-f0-9]{40}$/u.test(testedSha ?? "") ||
    !/^[a-f0-9]{64}$/u.test(lockfileSha256 ?? "") ||
    sbom?.spdxVersion !== "SPDX-2.3" ||
    !Array.isArray(sbom.packages) ||
    sbom.packages.length === 0
  ) {
    fail("CI_SBOM_INVALID", sbom?.spdxVersion ?? "missing");
  }
  if (
    provenance?._type !== "https://in-toto.io/Statement/v1" ||
    provenance.predicateType !== "https://slsa.dev/provenance/v1" ||
    provenance.attestation_status !==
      "PENDING_REPOSITORY_CAPABILITY_AND_EXPLICIT_RELEASE_AUTHORIZATION" ||
    provenance.signature_status !== "UNSIGNED" ||
    provenance.subject?.length !== 1 ||
    provenance.subject[0]?.name !== "build-output-digests.json" ||
    provenance.subject[0]?.digest?.sha256 !== digestManifestSha256 ||
    provenance.predicate?.buildDefinition?.externalParameters?.head_sha !==
      headSha ||
    provenance.predicate?.buildDefinition?.externalParameters?.base_sha !==
      baseSha ||
    provenance.predicate?.buildDefinition?.externalParameters?.tested_sha !==
      testedSha ||
    provenance.predicate?.buildDefinition?.externalParameters
      ?.lockfile_sha256 !== lockfileSha256
  ) {
    fail("CI_PROVENANCE_INVALID", provenance?.predicateType ?? "missing");
  }
  const resolvedDependencies =
    provenance.predicate?.buildDefinition?.resolvedDependencies ?? [];
  const gitDependency = resolvedDependencies.find(
    ({ uri }) => uri === "git+https://github.com/WeiHan1996/DailyEnergy",
  );
  const lockfileDependency = resolvedDependencies.find(
    ({ uri }) => uri === "file:pnpm-lock.yaml",
  );
  const rootPackage = sbom.packages.find(
    ({ SPDXID }) => SPDXID === "SPDXRef-DailyEnergy",
  );
  const lockfileReference = rootPackage?.externalRefs?.find(
    ({ referenceType }) => referenceType === "pnpm-lock-sha256",
  );
  if (
    gitDependency?.digest?.gitCommit !== testedSha ||
    lockfileDependency?.digest?.sha256 !== lockfileSha256 ||
    lockfileReference?.referenceLocator !== lockfileSha256 ||
    sbom.name !== `dailyenergy-${headSha.slice(0, 12)}` ||
    sbom.documentNamespace !==
      `https://dailyenergy.invalid/spdx/${headSha}/${testedSha}/${lockfileSha256}`
  ) {
    fail("CI_SUPPLY_CHAIN_BINDING_MISMATCH", "source-or-lockfile");
  }
  return Object.freeze({ packages: sbom.packages.length });
}
