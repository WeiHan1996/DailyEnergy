import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  validateContract,
  validateExerciseContract,
  validateObservabilityRepository,
} from "../../tooling/observability/check.mjs";
import { parse as parseYaml } from "yaml";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const contract = JSON.parse(
  await readFile(
    path.join(repositoryRoot, "docker/observability/contract.json"),
    "utf8",
  ),
);
const exercise = JSON.parse(
  await readFile(
    path.join(repositoryRoot, "docker/observability/exercise-contract.json"),
    "utf8",
  ),
);
const collector = parseYaml(
  await readFile(
    path.join(repositoryRoot, "docker/observability/collector.yaml"),
    "utf8",
  ),
);
const alerts = parseYaml(
  await readFile(
    path.join(repositoryRoot, "docker/observability/rules/alerts.yaml"),
    "utf8",
  ),
);
const recording = parseYaml(
  await readFile(
    path.join(repositoryRoot, "docker/observability/rules/slo-recording.yaml"),
    "utf8",
  ),
);

test("T-E013-STATIC-001 validates the reference telemetry stack", async () => {
  assert.deepEqual(await validateObservabilityRepository(), {
    alerts: 22,
    dashboards: 5,
    runbooks: 6,
  });
});

test("T-E013-KNOWN-FAIL-001 rejects forbidden fields and index labels", () => {
  const missingForbidden = structuredClone(contract);
  missingForbidden.forbidden_attributes =
    missingForbidden.forbidden_attributes.filter(
      (attribute) => attribute !== "prompt",
    );
  assert.throws(
    () => validateContract(missingForbidden),
    /E013_ATTRIBUTE_FORBIDDEN:prompt/u,
  );

  const indexedTrace = structuredClone(contract);
  indexedTrace.loki_index_labels.push("trace_id");
  assert.throws(
    () => validateContract(indexedTrace),
    /E013_LOKI_INDEX_FORBIDDEN/u,
  );
});

test("T-E013-KNOWN-FAIL-001 closes Collector attributes and missing-signal alerts", () => {
  const collectorText = JSON.stringify(collector);
  assert.match(collectorText, /keep_keys\(attributes/u);
  assert.match(collectorText, /keep_keys\(resource\.attributes/u);
  assert.match(collectorText, /set\(resource\.attributes/u);
  assert.doesNotMatch(collectorText, /keep_keys\([^\]]*http\.request\.body/u);

  const alertText = JSON.stringify(alerts);
  assert.match(alertText, /absent\(dailyenergy_synthetic_probe_success\)/u);
  assert.match(
    alertText,
    /absent\(dailyenergy_telemetry_heartbeat_timestamp_seconds\)/u,
  );
  const recordingText = JSON.stringify(recording);
  assert.match(
    recordingText,
    /label_replace\(max\(dailyenergy_budget_forecast_micros\).*forecast/u,
  );
  assert.match(
    recordingText,
    /label_replace\(sum\(dailyenergy_cost_micros_total\).*actual/u,
  );
  assert.doesNotMatch(recordingText, / or vector\(0\)/u);
});

test("T-E013-CI-POLICY-001 binds every observability source ID to Ubuntu CI", async () => {
  const policy = JSON.parse(
    await readFile(path.join(repositoryRoot, "tests/ci/policy.json"), "utf8"),
  );
  const unitContract = policy.lanes.find(({ id }) => id === "unit-contract");
  assert.ok(
    unitContract.commands.some(
      (command) =>
        JSON.stringify(command) ===
        JSON.stringify(["pnpm", "run", "observability:validate"]),
    ),
  );
  assert.ok(
    unitContract.commands.some(
      (command) =>
        JSON.stringify(command) ===
        JSON.stringify(["pnpm", "run", "observability:runtime"]),
    ),
  );
  const expected = Array.from(
    { length: 48 },
    (_, index) => `S33-OBS-${String(index + 1).padStart(3, "0")}`,
  );
  assert.deepEqual(
    unitContract.source_ids.filter((sourceId) =>
      sourceId.startsWith("S33-OBS-"),
    ),
    expected,
  );
});

test("T-E013-KNOWN-FAIL-001 rejects unbounded cardinality and plane joining", () => {
  const unbounded = structuredClone(contract);
  delete unbounded.cardinality.per_metric_active_series_limit;
  assert.throws(
    () => validateContract(unbounded),
    /E013_CARDINALITY_DECLARATION/u,
  );

  const joinedPlane = structuredClone(contract);
  joinedPlane.planes.PRODUCT_ANALYTICS.runtime_derivation = "RUNTIME_LOGS";
  assert.throws(() => validateContract(joinedPlane), /E013_PLANE_ISOLATION/u);
});

test("T-E013-KNOWN-FAIL-001 rejects Production enablement and UNKNOWN zero", () => {
  const production = structuredClone(contract);
  production.production_backend.status = "ENABLED";
  assert.throws(() => validateContract(production), /E013_PRODUCTION_GATE/u);

  const zeroUnknown = structuredClone(contract);
  zeroUnknown.cost_unknown_policy = "ZERO";
  assert.throws(() => validateContract(zeroUnknown), /E013_COST_UNKNOWN/u);
});

test("T-E013-KNOWN-FAIL-001 separates development admission from the full RC exercise", () => {
  const falsePass = structuredClone(exercise);
  falsePass.production_rc_gate.status = "GO";
  falsePass.production_rc_gate.completed = true;
  falsePass.production_rc_gate.pass_claim = "ALLOWED";
  assert.throws(
    () => validateExerciseContract(falsePass),
    /E014_PRODUCTION_RC_PENDING/u,
  );

  const unconditionalDevelopment = structuredClone(exercise);
  unconditionalDevelopment.development_gate.status = "GO";
  unconditionalDevelopment.development_gate.production_readiness_claim =
    "ALLOWED";
  assert.throws(
    () => validateExerciseContract(unconditionalDevelopment),
    /E014_PRODUCTION_RC_PENDING/u,
  );
});
