import { createHash } from "node:crypto";

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function validateFixtureCatalog(catalog) {
  if (
    catalog?.catalog_version !== "e-010-fixture-catalog-v1" ||
    catalog.factory_version !== "synthetic-factory-v1" ||
    catalog.synthetic_only !== true ||
    catalog.golden_policy !== "accepted-contract-only" ||
    !Number.isSafeInteger(catalog.default_random_seed) ||
    Number.isNaN(new Date(catalog.default_clock).valueOf()) ||
    !isNonEmpty(catalog.source_fingerprint)
  ) {
    fail("TEST_FIXTURE_CATALOG_INVALID", catalog?.catalog_version ?? "missing");
  }
  return Object.freeze({ factoryVersion: catalog.factory_version });
}

export function validateGoldenProvenance(provenance) {
  if (provenance?.expected_source !== "ACCEPTED_CONTRACT") {
    fail(
      "TEST_GOLDEN_PROVENANCE_INVALID",
      provenance?.expected_source ?? "missing",
    );
  }
}

export function validateEvidenceRecord(record) {
  if (
    record?.test_kind === "PROPERTY" &&
    record.result === "FAIL" &&
    (!Number.isSafeInteger(record.seed) || !isNonEmpty(record.fixture_version))
  ) {
    fail("TEST_PROPERTY_REPLAY_METADATA_MISSING", record?.test_id ?? "missing");
  }
}

export function scanArtifactContent(value, policy) {
  const diagnostics = [];
  const forbiddenKeys = new Set(policy.forbidden_keys);
  const patterns = policy.forbidden_value_patterns.map(
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
          diagnostics.push(`TEST_ARTIFACT_FORBIDDEN_KEY:${location}.${key}`);
        }
        visit(entry, `${location}.${key}`);
      }
      return;
    }
    if (typeof current === "string") {
      for (const pattern of patterns) {
        if (pattern.test(current)) {
          diagnostics.push(`TEST_ARTIFACT_FORBIDDEN_VALUE:${location}`);
          break;
        }
      }
    }
  }

  visit(value, "$");
  return diagnostics;
}

export function classifyRetryAttempts(attempts) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    fail("TEST_RETRY_ATTEMPTS_INVALID", "empty");
  }
  const firstFailure = attempts.findIndex(({ status }) => status === "FAIL");
  const laterPass = attempts.some(
    ({ status }, index) => index > firstFailure && status === "PASS",
  );
  if (firstFailure >= 0 && laterPass) {
    return "FLAKY_FAIL";
  }
  return attempts.every(({ status }) => status === "PASS") ? "PASS" : "FAIL";
}

export function validateRunnerRegistry(registry) {
  if (
    registry?.registry_version !== "e-010-runner-registry-v1" ||
    !Array.isArray(registry.runners)
  ) {
    fail(
      "TEST_RUNNER_REGISTRY_INVALID",
      registry?.registry_version ?? "missing",
    );
  }

  const runners = new Map();
  for (const runner of registry.runners) {
    if (
      !isNonEmpty(runner?.runner_id) ||
      runners.has(runner.runner_id) ||
      !isNonEmpty(runner.command) ||
      !Array.isArray(runner.levels) ||
      runner.levels.length === 0 ||
      runner.synthetic_only !== true
    ) {
      fail("TEST_RUNNER_DESCRIPTOR_INVALID", runner?.runner_id ?? "missing");
    }
    runners.set(runner.runner_id, runner);
  }

  const requiredRunnerIds = [
    "vitest-projects",
    "postgresql-18",
    "queue-integration",
    "api-http",
    "core-e2e",
    "admin-e2e",
    "miniapp-devtools",
  ];
  for (const runnerId of requiredRunnerIds) {
    if (!runners.has(runnerId)) {
      fail("TEST_RUNNER_REQUIRED_MISSING", runnerId);
    }
  }

  const postgres = runners.get("postgresql-18");
  if (
    postgres.implementation !== "TESTCONTAINERS" ||
    !postgres.levels.includes("DB") ||
    !postgres.real_dependencies?.postgresql?.startsWith(
      "postgres:18.0-bookworm@sha256:",
    ) ||
    postgres.fake_substitution !== "PROHIBITED"
  ) {
    fail("TEST_RUNNER_POSTGRESQL_REALITY", "postgresql-18");
  }

  const queue = runners.get("queue-integration");
  if (
    queue.implementation !== "TESTCONTAINERS" ||
    !queue.levels.includes("INTEGRATION") ||
    !queue.real_dependencies?.postgresql?.startsWith(
      "postgres:18.0-bookworm@sha256:",
    ) ||
    !queue.real_dependencies?.redis?.startsWith(
      "redis:8.2.1-bookworm@sha256:",
    ) ||
    queue.real_dependencies?.bullmq !== "5.81.3" ||
    queue.fake_substitution !== "PROHIBITED"
  ) {
    fail("TEST_RUNNER_QUEUE_REALITY", "queue-integration");
  }

  const api = runners.get("api-http");
  if (
    api.implementation !== "PLAYWRIGHT_API_REQUEST_CONTEXT" ||
    api.application !== "REAL_NEST_TEST_APPLICATION" ||
    api.retry?.maximum !== 1 ||
    api.retry?.sticky_first_failure !== true
  ) {
    fail("TEST_RUNNER_API_HTTP_INVALID", "api-http");
  }

  const core = runners.get("core-e2e");
  if (
    core.implementation !== "NODE_HTTP_AND_TESTCONTAINERS" ||
    core.application !== "REAL_NEST_AND_WORKER_PROFILES" ||
    !core.levels.includes("E2E") ||
    !core.levels.includes("RESILIENCE") ||
    !core.real_dependencies?.postgresql?.startsWith(
      "postgres:18.0-bookworm@sha256:",
    ) ||
    !core.real_dependencies?.redis?.startsWith(
      "redis:8.2.1-bookworm@sha256:",
    ) ||
    core.real_dependencies?.bullmq !== "5.81.3" ||
    core.fake_substitution !== "PROHIBITED" ||
    core.retry !== 0 ||
    core.unavailable_status !== "INFRA_BLOCKED"
  ) {
    fail("TEST_RUNNER_CORE_E2E_REALITY", "core-e2e");
  }

  const admin = runners.get("admin-e2e");
  if (
    admin.implementation !== "PLAYWRIGHT_CHROMIUM" ||
    admin.retry?.maximum !== 1 ||
    admin.retry?.sticky_first_failure !== true ||
    admin.unavailable_status !== "INFRA_BLOCKED"
  ) {
    fail("TEST_RUNNER_ADMIN_INVALID", "admin-e2e");
  }

  const miniapp = runners.get("miniapp-devtools");
  if (
    miniapp.implementation !== "WECHAT_DEVTOOLS_AUTOMATOR" ||
    miniapp.unavailable_status !== "INFRA_BLOCKED" ||
    miniapp.browser_substitute !== "PROHIBITED" ||
    miniapp.real_device_status !== "MANUAL_EVIDENCE_PENDING" ||
    miniapp.retry?.maximum !== 1 ||
    miniapp.retry?.sticky_first_failure !== true
  ) {
    fail("TEST_RUNNER_MINIAPP_EVIDENCE_BOUNDARY", "miniapp-devtools");
  }

  return Object.freeze({ runners: runners.size });
}

export function validatePendingEvidenceTemplates(manualRc, aiEvaluation) {
  if (
    manualRc?.template_version !== "e-010-manual-rc-evidence-v1" ||
    manualRc.execution_status !== "MANUAL_EVIDENCE_PENDING" ||
    manualRc.pass_claim !== "PROHIBITED" ||
    manualRc.synthetic_accounts_only !== true ||
    manualRc.devtools?.status !== "INFRA_BLOCKED" ||
    manualRc.real_device?.ios !== "MANUAL_EVIDENCE_PENDING" ||
    manualRc.real_device?.android !== "MANUAL_EVIDENCE_PENDING"
  ) {
    fail(
      "TEST_MANUAL_RC_TEMPLATE_INVALID",
      manualRc?.template_version ?? "missing",
    );
  }
  if (
    aiEvaluation?.template_version !== "e-010-ai-evaluation-evidence-v1" ||
    aiEvaluation.execution_status !== "EVALUATION_NOT_RUN" ||
    aiEvaluation.pass_claim !== "PROHIBITED" ||
    aiEvaluation.synthetic_only !== true ||
    aiEvaluation.provider_calls !== 0 ||
    aiEvaluation.model_evidence !== "PENDING_EXPLICIT_AUTHORIZATION" ||
    aiEvaluation.load_evidence !== "PENDING_EXPLICIT_AUTHORIZATION" ||
    aiEvaluation.human_evidence !== "PENDING_MANUAL_REVIEW" ||
    aiEvaluation.professional_evidence !== "PENDING_MANUAL_REVIEW"
  ) {
    fail(
      "TEST_AI_EVALUATION_TEMPLATE_INVALID",
      aiEvaluation?.template_version ?? "missing",
    );
  }
}

export function validateRunnerPolicy(policy, quarantines, now) {
  if (
    policy?.policy_version !== "e-010-runner-policy-v1" ||
    policy.default_retry !== 0 ||
    policy.retry_exceptions?.playwright?.maximum_retries !== 1 ||
    policy.retry_exceptions.playwright.sticky_first_failure !== true ||
    policy.retry_exceptions?.["wechat-devtools"]?.maximum_retries !== 1 ||
    policy.retry_exceptions["wechat-devtools"].sticky_first_failure !== true
  ) {
    fail("TEST_RUNNER_POLICY_INVALID", policy?.policy_version ?? "missing");
  }
  const criticalPatterns = policy.critical_source_patterns.map(
    (pattern) => new RegExp(pattern, "u"),
  );
  for (const entry of quarantines.entries ?? []) {
    if (
      !isNonEmpty(entry.test_id) ||
      !isNonEmpty(entry.issue) ||
      !isNonEmpty(entry.owner) ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(entry.expires_on ?? "") ||
      !Array.isArray(entry.source_ids) ||
      entry.source_ids.length === 0
    ) {
      fail("TEST_QUARANTINE_INVALID", entry?.test_id ?? "missing");
    }
    if (
      entry.source_ids.some((sourceId) =>
        criticalPatterns.some((pattern) => pattern.test(sourceId)),
      )
    ) {
      fail("TEST_QUARANTINE_CRITICAL", entry.test_id);
    }
    if (entry.expires_on < now.slice(0, 10)) {
      fail("TEST_QUARANTINE_EXPIRED", entry.test_id);
    }
  }
}

export function validateAiCorpus(corpus) {
  if (
    corpus?.schema_version !== "dailyenergy.ai-evaluation-corpus.v1" ||
    corpus.status !== "ACCEPTED" ||
    corpus.counts?.total !== 269 ||
    !Array.isArray(corpus.cases) ||
    corpus.cases.length !== 269
  ) {
    fail("AI_CORPUS_CONTRACT_INVALID", corpus?.corpus_version ?? "missing");
  }
  const ids = new Set(corpus.cases.map(({ id }) => id));
  if (ids.size !== 269) {
    fail("AI_CORPUS_ID_DUPLICATE", `${ids.size}/269`);
  }
  const fingerprintInput = {
    schema_version: corpus.schema_version,
    corpus_version: corpus.corpus_version,
    counts: corpus.counts,
    sources: corpus.sources,
    cases: corpus.cases,
  };
  const actualFingerprint = createHash("sha256")
    .update(JSON.stringify(canonicalize(fingerprintInput)))
    .digest("hex");
  if (actualFingerprint !== corpus.manifest_fingerprint_sha256) {
    fail("AI_CORPUS_FINGERPRINT_DRIFT", actualFingerprint);
  }
  return Object.freeze({ fingerprint: actualFingerprint, total: ids.size });
}
