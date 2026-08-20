import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  validatePhaseGateContract,
  validatePhaseGateRepository,
  validateSourceInventory,
} from "../../tooling/phase-gate/check.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.resolve(repositoryRoot, relativePath), "utf8"),
  );
}

const [
  contract,
  inventory,
  configuration,
  registry,
  ciPolicy,
  exercise,
  manualRc,
] = await Promise.all([
  readJson("tests/phase-gate/contract.json"),
  readJson("tests/phase-gate/source-inventory.json"),
  readJson("tests/registry/source-sets.json"),
  readJson("tests/registry/coverage-registry.json"),
  readJson("tests/ci/policy.json"),
  readJson("docker/observability/exercise-contract.json"),
  readJson("tests/manual-rc/evidence-template.json"),
]);
const dependencies = { ciPolicy, exercise, manualRc };

test("T-E014-GATE-001 accepts conditional development admission and Production NO-GO", async () => {
  assert.deepEqual(await validatePhaseGateRepository(), {
    development: "CONDITIONAL_GO_FOR_PHASE_2",
    production: "NO_GO",
    conditions: 1,
    deferred: 7,
    total: 736,
    COVERED: 210,
    PLANNED: 526,
    NA_WITH_REASON: 0,
  });
});

test("T-E014-GATE-002 rejects an unconditional or Production PASS decision", () => {
  const unconditional = structuredClone(contract);
  unconditional.decision.phase_2_development = "GO";
  assert.throws(
    () => validatePhaseGateContract(unconditional, dependencies),
    /E014_GATE_DECISION/u,
  );

  const productionPass = structuredClone(contract);
  productionPass.decision.production_release_candidate = "GO";
  productionPass.decision.production_readiness_claim = "ALLOWED";
  assert.throws(
    () => validatePhaseGateContract(productionPass, dependencies),
    /E014_GATE_DECISION/u,
  );

  const pendingOwner = structuredClone(contract);
  pendingOwner.decision.owner_decision = "PENDING_REVIEW";
  assert.throws(
    () => validatePhaseGateContract(pendingOwner, dependencies),
    /E014_GATE_DECISION/u,
  );

  const missingThreatReview = structuredClone(contract);
  missingThreatReview.decision.threat_boundary_review = "PENDING";
  assert.throws(
    () => validatePhaseGateContract(missingThreatReview, dependencies),
    /E014_GATE_DECISION/u,
  );

  const productionAuthorized = structuredClone(contract);
  productionAuthorized.decision.production_authorization = "GRANTED";
  assert.throws(
    () => validatePhaseGateContract(productionAuthorized, dependencies),
    /E014_GATE_DECISION/u,
  );

  const substitutedReceipt = structuredClone(contract);
  substitutedReceipt.baseline.e012.ci_run += 1;
  assert.throws(
    () => validatePhaseGateContract(substitutedReceipt, dependencies),
    /E014_GATE_BASELINE/u,
  );
});

test("T-E014-GATE-003 rejects deferred evidence without an owner and unlock", () => {
  const falsePass = structuredClone(contract);
  const [requirement] = falsePass.deferred_production_requirements;
  requirement.status = "PASS";
  requirement.pass_claim = "ALLOWED";
  requirement.unlock = "";
  assert.throws(
    () => validatePhaseGateContract(falsePass, dependencies),
    /E014_GATE_PRODUCTION_FALSE_PASS/u,
  );
});

test("T-E014-GATE-004 rejects silent PLANNED entries and inventory drift", () => {
  const silent = structuredClone(registry);
  const entry = silent.entries.find(({ status }) => status === "PLANNED");
  assert.ok(entry);
  entry.planned.owner = "";
  assert.throws(
    () => validateSourceInventory(inventory, configuration, silent),
    /E014_SOURCE_INVENTORY_SILENT_PLANNED/u,
  );

  const drift = structuredClone(inventory);
  drift.source_sets[0].counts.PLANNED -= 1;
  assert.throws(
    () => validateSourceInventory(drift, configuration, registry),
    /E014_SOURCE_INVENTORY_SET_DRIFT/u,
  );
});

test("T-E014-GATE-005 keeps platform merge control insufficient for Production or RC", () => {
  const productionControl = structuredClone(contract);
  productionControl.merge_control.production_or_rc_admission =
    "PLATFORM_GATE_SUFFICIENT";
  assert.throws(
    () => validatePhaseGateContract(productionControl, dependencies),
    /E014_GATE_MERGE_CONTROL/u,
  );

  const falseManualPass = structuredClone(manualRc);
  falseManualPass.execution_status = "PASS";
  falseManualPass.pass_claim = "ALLOWED";
  assert.throws(
    () =>
      validatePhaseGateContract(contract, {
        ...dependencies,
        manualRc: falseManualPass,
      }),
    /E014_GATE_MANUAL_RC_FALSE_PASS/u,
  );
});
