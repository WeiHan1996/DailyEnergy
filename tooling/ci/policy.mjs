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
    policy?.policy_version !== "e-011-ci-policy-v1" ||
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
    policy.artifacts?.supply_chain_evidence?.retention_days !== 365 ||
    policy.artifacts.supply_chain_evidence.synthetic_only !== true
  ) {
    fail("CI_POLICY_ARTIFACT_RETENTION_INVALID", "14/365");
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
  }
  return Object.freeze({
    automated: lanes.length - expectedExternalLanes.size,
    external: expectedExternalLanes.size,
    lanes: lanes.length,
  });
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
  if (/\$\{\{\s*secrets\./u.test(source)) {
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

    for (const [index, step] of (job.steps ?? []).entries()) {
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
      if (step.uses?.startsWith("actions/upload-artifact@")) {
        const expectedRetention =
          jobId === "supply-chain"
            ? policy.artifacts.supply_chain_evidence.retention_days
            : policy.artifacts.synthetic_reports.retention_days;
        if (step.with?.["retention-days"] !== expectedRetention) {
          diagnostics.push(`CI_WORKFLOW_ARTIFACT_TTL_INVALID:${location}`);
        }
        if (
          step.if !== "always()" ||
          step.with?.["if-no-files-found"] !== "error"
        ) {
          diagnostics.push(`CI_WORKFLOW_ARTIFACT_UPLOAD_UNBOUNDED:${location}`);
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

export function findArtifactDiagnostics(value, policy) {
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
  return diagnostics;
}

export function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export async function verifyDigestManifest(root, manifest) {
  if (
    manifest?.manifest_version !== "e-011-build-digest-v1" ||
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
  if (
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
    provenance.predicate?.buildDefinition?.externalParameters
      ?.lockfile_sha256 !== digestManifest.lockfile_sha256
  ) {
    fail("CI_PROVENANCE_INVALID", provenance?.predicateType ?? "missing");
  }
  return Object.freeze({ packages: sbom.packages.length });
}
