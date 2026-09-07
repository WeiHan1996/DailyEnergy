import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  validatePhaseGateContract,
  validatePhaseGateRepository,
  validateSourceInventory,
} from "../../tooling/phase-gate/check.mjs";
import {
  validateC017PhaseGateContract,
  validateC017PhaseGateRepository,
} from "../../tooling/phase-gate/c017-check.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.resolve(repositoryRoot, relativePath), "utf8"),
  );
}

async function readText(relativePath) {
  return readFile(path.resolve(repositoryRoot, relativePath), "utf8");
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

const [c017Contract, c017ManualEvidence, c016Evidence, c017Report, docsIndex] =
  await Promise.all([
    readJson("tests/phase-gate/c017-contract.json"),
    readJson("tests/manual-rc/c017-evidence.json"),
    readJson("tests/manual-rc/c016-evidence.json"),
    readText("docs/reports/phase-2-gate.md"),
    readText("docs/INDEX.md"),
  ]);
const c017Dependencies = {
  c016Evidence,
  index: docsIndex,
  manualEvidence: c017ManualEvidence,
  registry,
  report: c017Report,
};

test("T-E014-GATE-001 accepts conditional development admission and Production NO-GO", async () => {
  assert.deepEqual(await validatePhaseGateRepository(), {
    development: "CONDITIONAL_GO_FOR_PHASE_2",
    production: "NO_GO",
    conditions: 1,
    deferred: 7,
    total: 1004,
    COVERED: 562,
    PLANNED: 442,
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

test("T-C017-GATE-001 accepts the owner-approved Phase 3 development decision", async () => {
  assert.deepEqual(await validateC017PhaseGateRepository(), {
    development: "GO_FOR_PHASE_3_DEVELOPMENT",
    production: "NO_GO",
    review: "OWNER_ACCEPTED",
    exits: 9,
    conditions: 2,
    deferred: 5,
    cachedP95Ms: 42,
    generationP95Ms: 119,
    total: 1004,
    COVERED: 562,
    PLANNED: 442,
    NA_WITH_REASON: 0,
  });
});

test("T-C017-GATE-002 rejects development GO without owner acceptance and threat review", () => {
  const falseGo = structuredClone(c017Contract);
  falseGo.decision.owner_decision = "PENDING_REVIEW";
  falseGo.decision.threat_boundary_review = "AGENT_PREPARED_OWNER_PENDING";
  falseGo.decision.accepted_on = null;
  assert.throws(
    () => validateC017PhaseGateContract(falseGo, c017Dependencies),
    /C017_GATE_DECISION/u,
  );
});

test("T-C017-GATE-003 rejects Production, RC or real-user admission", () => {
  for (const field of [
    "production_release_candidate",
    "alpha_or_real_user_admission",
  ]) {
    const falsePass = structuredClone(c017Contract);
    falsePass.decision[field] = "GO";
    assert.throws(
      () => validateC017PhaseGateContract(falsePass, c017Dependencies),
      /C017_GATE_PRODUCTION_FALSE_PASS/u,
    );
  }
});

test("T-C017-GATE-004 rejects missing Phase 2 exit evidence or performance budget failure", () => {
  const missingExit = structuredClone(c017Contract);
  missingExit.phase_2_exit_requirements[0].status = "MISSING";
  assert.throws(
    () => validateC017PhaseGateContract(missingExit, c017Dependencies),
    /C017_GATE_EXIT_EVIDENCE/u,
  );

  const slow = structuredClone(c017Contract);
  slow.performance_baseline.cached_today.observed_run_p95_ms[2] = 1001;
  slow.performance_baseline.cached_today.observed_worst_run_p95_ms = 1001;
  assert.throws(
    () => validateC017PhaseGateContract(slow, c017Dependencies),
    /C017_GATE_PERFORMANCE/u,
  );
});

test("T-C017-GATE-005 rejects registry false-PASS and manual-evidence drift", () => {
  const registryPass = structuredClone(c017Contract);
  registryPass.source_registry.counts.PLANNED = 0;
  registryPass.source_registry.counts.COVERED = 1004;
  assert.throws(
    () => validateC017PhaseGateContract(registryPass, c017Dependencies),
    /C017_GATE_REGISTRY/u,
  );

  const falseManual = structuredClone(c017ManualEvidence);
  falseManual.execution_status =
    "AUTOMATED_EVIDENCE_COMPLETE_OWNER_REVIEW_PENDING";
  assert.throws(
    () =>
      validateC017PhaseGateContract(c017Contract, {
        ...c017Dependencies,
        manualEvidence: falseManual,
      }),
    /C017_GATE_MANUAL_EVIDENCE/u,
  );
});

test("T-C017-GATE-006 rejects a stale C-016 review or merge receipt", () => {
  const stale = structuredClone(c016Evidence);
  stale.review_status = "OWNER_REVIEW_PENDING";
  assert.throws(
    () =>
      validateC017PhaseGateContract(c017Contract, {
        ...c017Dependencies,
        c016Evidence: stale,
      }),
    /C017_GATE_C016_RECEIPT/u,
  );
});

test("T-C017-GATE-007 accepts only a correlated pre-review Draft state", () => {
  const pendingContract = structuredClone(c017Contract);
  pendingContract.decision.phase_3_development =
    "RECOMMEND_GO_FOR_PHASE_3_DEVELOPMENT_PENDING_OWNER_REVIEW";
  pendingContract.decision.owner_decision = "PENDING_REVIEW";
  pendingContract.decision.threat_boundary_review =
    "AGENT_PREPARED_OWNER_PENDING";
  pendingContract.decision.accepted_on = null;

  const pendingManual = structuredClone(c017ManualEvidence);
  pendingManual.execution_status =
    "AUTOMATED_EVIDENCE_COMPLETE_OWNER_REVIEW_PENDING";
  pendingManual.decision.phase_3_development =
    "RECOMMEND_GO_FOR_PHASE_3_DEVELOPMENT_PENDING_OWNER_REVIEW";
  pendingManual.decision.owner_decision = "PENDING_REVIEW";
  pendingManual.decision.threat_boundary_review =
    "AGENT_PREPARED_OWNER_PENDING";
  pendingManual.decision.accepted_on = null;
  delete pendingManual.owner_statement;
  delete pendingManual.automated_evidence.accepted_changed_full_security_gate;
  delete pendingManual.automated_evidence.accepted_task_security_gate;
  pendingManual.reviewer = null;
  pendingManual.reviewed_at_utc = null;

  const pendingReport = c017Report
    .replace("- **文档状态**：Accepted", "- **文档状态**：Draft")
    .replaceAll(
      "GO_FOR_PHASE_3_DEVELOPMENT",
      "RECOMMEND_GO_FOR_PHASE_3_DEVELOPMENT_PENDING_OWNER_REVIEW",
    );
  const pendingIndex = docsIndex.replace(
    /(phase-2-gate\.md\)\s+\|) Accepted(\s+\|)/u,
    "$1 Draft$2",
  );
  assert.equal(
    validateC017PhaseGateContract(pendingContract, {
      ...c017Dependencies,
      index: pendingIndex,
      manualEvidence: pendingManual,
      report: pendingReport,
    }).review,
    "PENDING_OWNER_REVIEW",
  );
});
