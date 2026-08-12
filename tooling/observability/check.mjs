#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parse as parseYaml } from "yaml";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const observabilityRoot = path.join(repositoryRoot, "docker/observability");
const dashboardRoot = path.join(observabilityRoot, "grafana/dashboards");
const runbookRoot = path.join(
  repositoryRoot,
  "docs/operations/observability-runbooks",
);
const composeControl = await readFile(
  path.join(repositoryRoot, "tooling/compose/control.mjs"),
  "utf8",
);

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function readYaml(file) {
  return parseYaml(await readFile(file, "utf8"));
}

function exactSet(actual, expected, ruleId) {
  const normalizedActual = [...actual].sort();
  const normalizedExpected = [...expected].sort();
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    fail(ruleId, normalizedActual.join(",") || "empty");
  }
}

export function validateContract(contract) {
  if (
    contract?.contract_version !== "dailyenergy-observability-v1" ||
    contract?.telemetry_schema_version !== "dailyenergy-telemetry-v1"
  ) {
    fail("E013_CONTRACT_VERSION", "contract");
  }
  exactSet(
    contract.reference_environments ?? [],
    ["LOCAL", "CI", "STAGING"],
    "E013_REFERENCE_ENVIRONMENT",
  );
  exactSet(
    contract.resource_attributes ?? [],
    [
      "service.namespace",
      "service.name",
      "service.version",
      "deployment.environment.name",
      "dailyenergy.runtime_profile",
      "dailyenergy.release_id",
      "dailyenergy.config_schema_version",
      "dailyenergy.contract_bundle_version",
    ],
    "E013_RESOURCE_ATTRIBUTE",
  );
  if (
    contract.production_backend?.status !== "BLOCKED" ||
    contract.alert_delivery?.production_status !== "BLOCKED"
  ) {
    fail("E013_PRODUCTION_GATE", "backend-or-delivery");
  }
  const forbidden = new Set(contract.forbidden_attributes ?? []);
  for (const required of [
    "account_ref",
    "body",
    "prompt",
    "provider_response",
    "sql",
    "bind_values",
    "trace_id",
    "request_id",
  ]) {
    if (!forbidden.has(required)) {
      fail("E013_ATTRIBUTE_FORBIDDEN", required);
    }
  }
  if (
    (contract.loki_index_labels ?? []).some((label) =>
      ["trace_id", "request_id"].includes(label),
    )
  ) {
    fail("E013_LOKI_INDEX_FORBIDDEN", "correlation-id");
  }
  if (
    Object.keys(contract.signal_attributes ?? {}).length !== 10 ||
    Object.values(contract.signal_attributes ?? {}).some(
      (maximum) => !Number.isInteger(maximum) || maximum < 1,
    ) ||
    !Number.isInteger(contract.cardinality?.per_metric_active_series_limit) ||
    !Array.isArray(contract.cardinality?.new_label_requires) ||
    !contract.cardinality.new_label_requires.includes("MAXIMUM_CARDINALITY")
  ) {
    fail("E013_CARDINALITY_DECLARATION", "signal-attributes");
  }
  if (
    contract.planes?.PRODUCT_ANALYTICS?.runtime_derivation !== "FORBIDDEN" ||
    contract.planes?.ORDINARY_RUNTIME?.forbidden_details?.length < 4
  ) {
    fail("E013_PLANE_ISOLATION", "ordinary-product");
  }
  if (contract.cost_unknown_policy !== "NULL_AND_BLOCKED") {
    fail("E013_COST_UNKNOWN", "unknown-policy");
  }
  if (
    contract.retention?.ordinary_logs_days !== 30 ||
    contract.retention?.raw_traces_days !== 7 ||
    contract.retention?.detailed_metrics_days !== 35 ||
    contract.retention?.t4_daily_aggregate_months !== 13 ||
    contract.retention?.security_logs_months !== 6
  ) {
    fail("E013_RETENTION", "contract");
  }
  return contract;
}

export function validateExerciseContract(exercise) {
  if (
    exercise?.contract_version !== "dailyenergy-observability-exercise-v2" ||
    exercise.development_gate?.status !== "CONDITIONAL_GO_FOR_PHASE_2" ||
    exercise.development_gate?.evidence_status !==
      "ACCEPTED_FOR_DEVELOPMENT_MERGE" ||
    exercise.development_gate?.owner_decision !==
      "ACCEPTED_FOR_THIS_DEVELOPMENT_MERGE_ONLY" ||
    exercise.development_gate?.accepted_on !== "2026-08-12" ||
    exercise.development_gate?.threat_boundary_review !== "COMPLETED" ||
    exercise.development_gate?.production_authorization !== "NOT_GRANTED" ||
    exercise.development_gate?.production_readiness_claim !== "PROHIBITED" ||
    exercise.production_rc_gate?.status !== "NO_GO" ||
    exercise.production_rc_gate?.completed !== false ||
    exercise.production_rc_gate?.pass_claim !== "PROHIBITED" ||
    exercise.production_business_facts_allowed !== false ||
    !exercise.production_rc_gate?.required_evidence?.includes(
      "ALERT_DELIVERY_CANARY",
    ) ||
    !exercise.production_rc_gate?.required_evidence?.includes(
      "RETENTION_TTL_DELETION",
    ) ||
    !exercise.production_rc_gate?.blocked_evidence?.includes(
      "REAL_ALERT_DELIVERY",
    ) ||
    !exercise.production_rc_gate?.blocked_evidence?.includes(
      "REAL_BACKEND_TTL_DELETION",
    )
  ) {
    fail("E014_PRODUCTION_RC_PENDING", "exercise-contract");
  }
  return exercise;
}

function allRules(document) {
  return (document?.groups ?? []).flatMap((group) => group.rules ?? []);
}

function validateCompose(compose) {
  exactSet(
    Object.keys(compose?.services ?? {}),
    [
      "alertmanager",
      "api",
      "collector",
      "grafana",
      "loki",
      "prometheus",
      "tempo",
      "worker-background",
      "worker-interactive",
      "worker-restricted",
    ],
    "E013_COMPOSE_SERVICES",
  );
  for (const [name, service] of Object.entries(compose.services)) {
    for (const port of service.ports ?? []) {
      if (!String(port).startsWith("127.0.0.1:")) {
        fail("E013_COMPOSE_PUBLIC_PORT", name);
      }
    }
    if (
      service.image !== undefined &&
      (!String(service.image).includes(":?") ||
        !String(service.image).includes("digest required"))
    ) {
      fail("E013_COMPOSE_IMAGE", name);
    }
    if (
      service.image !== undefined &&
      (!service.cap_drop?.includes("ALL") ||
        !service.security_opt?.includes("no-new-privileges:true") ||
        service.read_only !== true ||
        !/^\d+[kmg]$/iu.test(String(service.mem_limit)) ||
        !Number.isFinite(service.cpus))
    ) {
      fail("E013_COMPOSE_RUNTIME_SECURITY", name);
    }
  }
  for (const environmentKey of [
    "DAILYENERGY_ALERTMANAGER_IMAGE",
    "DAILYENERGY_GRAFANA_IMAGE",
    "DAILYENERGY_LOKI_IMAGE",
    "DAILYENERGY_OTEL_COLLECTOR_IMAGE",
    "DAILYENERGY_PROMETHEUS_IMAGE",
    "DAILYENERGY_TEMPO_IMAGE",
  ]) {
    const pattern = new RegExp(
      `${environmentKey}:\\s*\\n?\\s*"[^"]+@sha256:[a-f0-9]{64}"`,
      "u",
    );
    if (!pattern.test(composeControl)) {
      fail("E013_COMPOSE_IMAGE_DEFAULT", environmentKey);
    }
  }
  if (
    compose.networks?.observability_ingest?.internal !== true ||
    compose.networks?.observability_backend?.internal !== true
  ) {
    fail("E013_COMPOSE_NETWORK", "internal");
  }
  for (const runtime of [
    "api",
    "worker-interactive",
    "worker-background",
    "worker-restricted",
  ]) {
    if (
      compose.services[runtime]?.logging?.driver !== "fluentd" ||
      !Object.hasOwn(
        compose.services[runtime]?.networks ?? {},
        "observability_ingest",
      )
    ) {
      fail("E013_LOG_INGEST", runtime);
    }
  }
}

function validateCollector(collector) {
  const pipelines = collector?.service?.pipelines;
  if (
    !pipelines?.logs ||
    !pipelines?.traces ||
    !collector.processors?.["transform/closed-spans"] ||
    !collector.processors?.["filter/raw-content"] ||
    !collector.processors?.tail_sampling ||
    collector.processors.tail_sampling.policies?.find(
      ({ name }) => name === "normal-success-10-percent",
    )?.probabilistic?.sampling_percentage !== 10
  ) {
    fail("E013_COLLECTOR_PIPELINE", "required-stage");
  }
  if (
    Object.hasOwn(
      collector.exporters?.["prometheus/raw-content"] ?? {},
      "without_scope_info",
    )
  ) {
    fail("E013_COLLECTOR_EXPORTER_VERSION", "without_scope_info");
  }
  const collectorText = JSON.stringify(collector);
  for (const token of [
    "keep_keys(attributes",
    "keep_keys(resource.attributes",
    "set(resource.attributes",
    "operation_code",
    "outcome_code",
    "model_revision_bucket",
  ]) {
    if (!collectorText.includes(token)) {
      fail("E013_COLLECTOR_ALLOWLIST", token);
    }
  }
  for (const forbidden of [
    "http.request.body",
    "http.response.body",
    "url.full",
    "url.query",
    "db.query.text",
    "exception.message",
    "exception.stacktrace",
    "enduser.id",
  ]) {
    if (collectorText.includes(`keep_keys(attributes, ["${forbidden}`)) {
      fail("E013_COLLECTOR_ALLOWLIST", forbidden);
    }
  }
}

function validateRules(recording, alerts) {
  const recordingText = JSON.stringify(recording);
  for (const token of [
    "S33-SLO-01",
    "S33-SLO-02",
    "S33-SLO-03",
    "S33-SLO-04",
    "S33-SLO-05",
    "S33-SLO-06",
    "S33-SLO-07",
    "[28d]",
    "[1h]",
    "[5m]",
    "[6h]",
    "[30m]",
    "[24h]",
    "[2h]",
    "[3d]",
  ]) {
    if (!recordingText.includes(token)) {
      fail("E013_SLO_RULE_SET", token);
    }
  }
  const alertRules = allRules(alerts).filter((rule) => rule.alert);
  if (alertRules.length < 15) {
    fail("E013_ALERT_SET", String(alertRules.length));
  }
  for (const rule of alertRules) {
    for (const label of [
      "alert_id",
      "cause_family",
      "condition",
      "incident_category_candidate",
      "owner_role",
      "runtime_profile",
      "service",
      "severity",
    ]) {
      if (!rule.labels?.[label]) {
        fail("E013_ALERT_CONTRACT", `${rule.alert}:${label}`);
      }
    }
    for (const annotation of [
      "config_catalog_version",
      "current_value",
      "dashboard_url",
      "dedupe_key",
      "runbook_url",
      "summary_code",
      "window",
    ]) {
      if (!rule.annotations?.[annotation]) {
        fail("E013_ALERT_CONTRACT", `${rule.alert}:${annotation}`);
      }
    }
    if (
      /(?:request_ref|account_ref|user_id|job_ref|task_ref|prompt|sql|secret)/iu.test(
        rule.expr,
      )
    ) {
      fail("E013_ALERT_CONTENT", rule.alert);
    }
  }
  const expressions = alertRules.map(({ expr }) => expr).join("\n");
  for (const token of [
    "> 14.4",
    "> 6",
    ">= 20",
    ">= 5",
    "synthetic_probe_success",
    "absent(dailyenergy_synthetic_probe_success)",
    "absent(dailyenergy_telemetry_heartbeat_timestamp_seconds)",
    "raw_content_matches_total",
    "SCHEMA_GRANT_DRIFT",
    ">= 0.70",
    ">= 0.85",
    ">= 1",
  ]) {
    if (!expressions.includes(token)) {
      fail("E013_ALERT_POLICY", token);
    }
  }
  const recordingExpressions = allRules(recording)
    .filter((rule) => rule.record)
    .map(({ expr }) => expr)
    .join("\n");
  if (
    !recordingExpressions.includes(
      'label_replace(max(dailyenergy_budget_forecast_micros), "__dailyenergy_budget_source", "forecast", "", ".*")',
    ) ||
    !recordingExpressions.includes(
      'label_replace(sum(dailyenergy_cost_micros_total), "__dailyenergy_budget_source", "actual", "", ".*")',
    ) ||
    recordingExpressions.includes(" or vector(0)") ||
    recordingExpressions.includes(
      "clamp_min(sum(increase(dailyenergy_cost_terminal_total",
    )
  ) {
    fail("E013_RECORDING_RULE_SEMANTICS", "cost-or-budget");
  }
  return alertRules;
}

async function validateDashboards(contract) {
  const files = (await readdir(dashboardRoot))
    .filter((file) => file.endsWith(".json"))
    .sort();
  exactSet(
    files.map((file) => file.replace(/\.json$/u, "")),
    contract.dashboards,
    "E013_DASHBOARD_SET",
  );
  const dashboards = await Promise.all(
    files.map((file) => readJson(path.join(dashboardRoot, file))),
  );
  for (const dashboard of dashboards) {
    const tags = dashboard.tags ?? [];
    if (
      !dashboard.uid ||
      dashboard.version !== 1 ||
      dashboard.refresh !== "30s" ||
      !dashboard.time?.from ||
      !tags.includes("contract:dailyenergy-telemetry-v1") ||
      !tags.includes("environment:single") ||
      !dashboard.templating?.list?.some(({ name }) => name === "environment") ||
      !dashboard.panels?.some(({ title }) =>
        String(title).includes("PROVISIONAL / BLOCKED"),
      )
    ) {
      fail("E013_DASHBOARD_METADATA", dashboard.uid ?? "unknown");
    }
  }
  return dashboards;
}

async function validateRunbooks(contract, alertRules) {
  const files = (await readdir(runbookRoot))
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort();
  exactSet(
    files.map((file) => file.replace(/\.md$/u, "")),
    contract.runbooks,
    "E013_RUNBOOK_SET",
  );
  const documents = new Map(
    await Promise.all(
      files.map(async (file) => [
        file.replace(/\.md$/u, ""),
        await readFile(path.join(runbookRoot, file), "utf8"),
      ]),
    ),
  );
  for (const [name, content] of documents) {
    for (const heading of [
      "## Impact",
      "## Verify",
      "## Contain",
      "## Incident And Recovery",
      "## Forbidden",
    ]) {
      if (!content.includes(heading)) {
        fail("E013_RUNBOOK_SECTION", `${name}:${heading}`);
      }
    }
    if (
      !content.includes("S-23") ||
      !content.toLowerCase().includes("synthetic") ||
      !content.includes("ReleaseManifest") ||
      !content.includes("Do not")
    ) {
      fail("E013_RUNBOOK_CONTENT", name);
    }
  }
  for (const rule of alertRules.filter(({ labels }) =>
    ["PAGE_CRITICAL", "PAGE_HIGH"].includes(labels.severity),
  )) {
    const name = rule.annotations.runbook_url.replace("/runbooks/", "");
    if (!documents.has(name)) {
      fail("E013_ALERT_RUNBOOK_LINK", `${rule.alert}:${name}`);
    }
  }
  return documents;
}

export async function validateObservabilityRepository() {
  const contract = validateContract(
    await readJson(path.join(observabilityRoot, "contract.json")),
  );
  validateExerciseContract(
    await readJson(path.join(observabilityRoot, "exercise-contract.json")),
  );
  validateCompose(
    await readYaml(
      path.join(repositoryRoot, "docker/compose.observability.yaml"),
    ),
  );
  validateCollector(
    await readYaml(path.join(observabilityRoot, "collector.yaml")),
  );
  const recording = await readYaml(
    path.join(observabilityRoot, "rules/slo-recording.yaml"),
  );
  const alerts = await readYaml(
    path.join(observabilityRoot, "rules/alerts.yaml"),
  );
  const alertRules = validateRules(recording, alerts);
  const dashboards = await validateDashboards(contract);
  const runbooks = await validateRunbooks(contract, alertRules);
  const lokiText = await readFile(
    path.join(observabilityRoot, "loki.yaml"),
    "utf8",
  );
  const tempoText = await readFile(
    path.join(observabilityRoot, "tempo.yaml"),
    "utf8",
  );
  const prometheusText = await readFile(
    path.join(observabilityRoot, "prometheus.yaml"),
    "utf8",
  );
  if (
    !lokiText.includes("retention_period: 720h") ||
    !tempoText.includes("block_retention: 168h") ||
    !prometheusText.includes("dailyenergy-runtime") ||
    !prometheusText.includes("config_catalog_version: observability-v1") ||
    !prometheusText.includes("release_id: reference-release-v1")
  ) {
    fail("E013_RETENTION", "backend-config");
  }
  return Object.freeze({
    alerts: alertRules.length,
    dashboards: dashboards.length,
    runbooks: runbooks.size,
  });
}

async function main() {
  const result = await validateObservabilityRepository();
  console.log(
    `E013_OBSERVABILITY_OK:alerts=${result.alerts}:dashboards=${result.dashboards}:runbooks=${result.runbooks}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
