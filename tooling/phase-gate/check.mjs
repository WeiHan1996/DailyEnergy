#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  discoverExpectedSources,
  loadAndValidateCoverageRegistry,
  loadCoverageRegistryDocument,
  loadRegistryConfiguration,
} from "../testing/source-registry.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

const expectedDevelopmentIds = Array.from(
  { length: 7 },
  (_, index) => `E014-DEV-${String(index + 1).padStart(3, "0")}`,
);
const expectedProductionIds = Array.from(
  { length: 7 },
  (_, index) => `E014-PROD-${String(index + 1).padStart(3, "0")}`,
);
const expectedBaseline = Object.freeze({
  base_commit: "a5d83d5a4fe48988c6618fe53fbc0ab0e8039eae",
  main_ci_run: 31569245433,
  main_ci_checks: 11,
  e012: {
    pull_request: 134,
    final_head: "5c598132787ba14a62de793827e4fb86a6dfb59c",
    ci_run: 31546068208,
    merge_commit: "dd201713a90b9f49e27cf66f6967210db8dc7f36",
    accepted_state_sha256:
      "56433f48fbf743f2ef38dab437647e188d01a40b90e4a3f62f37e9bb9e3d08d6",
  },
  e013: {
    pull_request: 135,
    final_head: "a123b553e55df0fec939211af608694155e804e9",
    ci_run: 31563458000,
    merge_commit: "d7500333eda31d160667a0ae0e49413f600ee0e0",
    merge_main_ci_run: 31568032735,
  },
});
const allowedDevelopmentStatuses = new Set([
  "VERIFIED_REUSED",
  "AUTOMATED_PROOF_AVAILABLE",
  "EXPLICITLY_TRACKED",
  "REQUIRED_BEFORE_MERGE",
]);
const allowedDeferredStatuses = new Set([
  "BLOCKED",
  "INFRA_BLOCKED",
  "MANUAL_EVIDENCE_PENDING",
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

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.resolve(repositoryRoot, relativePath), "utf8"),
  );
}

export function validateSourceInventory(inventory, configuration, registry) {
  if (
    inventory?.inventory_version !== "e-014-source-inventory-v1" ||
    inventory.registry_version !== registry?.registry_version ||
    inventory.snapshot_base_commit !== expectedBaseline.base_commit ||
    inventory.planned_policy?.silent_planned !== "PROHIBITED" ||
    inventory.planned_policy?.development_admission !==
      "TRACKED_WITH_OWNER_AND_REASON" ||
    inventory.planned_policy?.production_admission !== "INSUFFICIENT" ||
    !isNonEmpty(inventory.planned_policy?.statement)
  ) {
    fail("E014_SOURCE_INVENTORY_POLICY", "baseline");
  }

  const registryCounts = {
    total: registry.entries.length,
    COVERED: registry.entries.filter(({ status }) => status === "COVERED")
      .length,
    PLANNED: registry.entries.filter(({ status }) => status === "PLANNED")
      .length,
    NA_WITH_REASON: registry.entries.filter(
      ({ status }) => status === "NA_WITH_REASON",
    ).length,
  };
  if (!sameJson(inventory.counts, registryCounts)) {
    fail("E014_SOURCE_INVENTORY_COUNT", JSON.stringify(registryCounts));
  }

  const configuredSets = configuration.source_sets ?? [];
  if (
    !sameJson(
      inventory.source_sets?.map(({ set_id: setId }) => setId),
      configuredSets.map(({ set_id: setId }) => setId),
    )
  ) {
    fail("E014_SOURCE_INVENTORY_SET", "taxonomy");
  }
  for (const sourceSet of configuredSets) {
    const actual = inventory.source_sets.find(
      ({ set_id: setId }) => setId === sourceSet.set_id,
    );
    const entries = registry.entries.filter(({ source_sets: sourceSets }) =>
      sourceSets.includes(sourceSet.set_id),
    );
    const counts = { COVERED: 0, PLANNED: 0, NA_WITH_REASON: 0 };
    for (const entry of entries) {
      counts[entry.status] += 1;
      if (
        entry.status === "PLANNED" &&
        (!isNonEmpty(entry.planned?.owner) ||
          !isNonEmpty(entry.planned?.reason))
      ) {
        fail("E014_SOURCE_INVENTORY_SILENT_PLANNED", entry.source_id);
      }
    }
    if (
      actual?.authority_path !== sourceSet.authority_path ||
      actual.owner !== sourceSet.planned_owner ||
      !sameJson(actual.counts, counts)
    ) {
      fail("E014_SOURCE_INVENTORY_SET_DRIFT", sourceSet.set_id);
    }
  }
  return Object.freeze(registryCounts);
}

export function validatePhaseGateContract(contract, dependencies) {
  if (
    contract?.contract_version !== "e-014-phase-gate-v1" ||
    contract.task_id !== "E-014" ||
    contract.profile !== "security"
  ) {
    fail("E014_GATE_CONTRACT_VERSION", contract?.contract_version ?? "missing");
  }
  if (
    contract.decision?.phase_2_development !== "CONDITIONAL_GO_FOR_PHASE_2" ||
    contract.decision.production_release_candidate !== "NO_GO" ||
    contract.decision.owner_decision !==
      "ACCEPTED_FOR_THIS_DEVELOPMENT_MERGE_ONLY" ||
    contract.decision.accepted_on !== "2026-08-12" ||
    contract.decision.threat_boundary_review !== "COMPLETED" ||
    contract.decision.production_authorization !== "NOT_GRANTED" ||
    contract.decision.github_free_residual_risk !==
      "ACCEPTED_FOR_THIS_DEVELOPMENT_MERGE_ONLY" ||
    contract.decision.production_readiness_claim !== "PROHIBITED"
  ) {
    fail("E014_GATE_DECISION", "development-or-production");
  }
  if (!sameJson(contract.baseline, expectedBaseline)) {
    fail("E014_GATE_BASELINE", "receipt");
  }

  const development = contract.development_requirements ?? [];
  if (
    !sameJson(
      development.map(({ id }) => id),
      expectedDevelopmentIds,
    )
  ) {
    fail("E014_GATE_DEVELOPMENT_SET", "ids");
  }
  for (const requirement of development) {
    if (
      !allowedDevelopmentStatuses.has(requirement.status) ||
      !isNonEmpty(requirement.claim) ||
      !Array.isArray(requirement.evidence) ||
      requirement.evidence.length === 0 ||
      requirement.evidence.some((item) => !isNonEmpty(item))
    ) {
      fail("E014_GATE_DEVELOPMENT_EVIDENCE", requirement.id ?? "missing");
    }
  }
  if (
    development.at(-1)?.status !== "REQUIRED_BEFORE_MERGE" ||
    !development.some(({ status }) => status === "VERIFIED_REUSED") ||
    !development.some(({ status }) => status === "EXPLICITLY_TRACKED")
  ) {
    fail("E014_GATE_CONDITION_MISSING", "review-gate");
  }

  const deferred = contract.deferred_production_requirements ?? [];
  if (
    !sameJson(
      deferred.map(({ id }) => id),
      expectedProductionIds,
    )
  ) {
    fail("E014_GATE_PRODUCTION_SET", "ids");
  }
  for (const requirement of deferred) {
    if (
      !allowedDeferredStatuses.has(requirement.status) ||
      requirement.pass_claim !== "PROHIBITED" ||
      [requirement.owner, requirement.reason, requirement.unlock].some(
        (item) => !isNonEmpty(item),
      )
    ) {
      fail("E014_GATE_PRODUCTION_FALSE_PASS", requirement.id ?? "missing");
    }
  }

  if (
    contract.merge_control?.scope !== "DEVELOPMENT_BRANCH_MERGES_ONLY" ||
    contract.merge_control?.platform_enforcement !==
      "UNAVAILABLE_ON_PRIVATE_GITHUB_FREE" ||
    contract.merge_control?.required_checks !== 11 ||
    contract.merge_control?.explicit_owner_risk_acceptance_per_merge !== true ||
    contract.merge_control?.production_or_rc_use !== "PROHIBITED" ||
    contract.merge_control?.expires_on !== "2026-11-02"
  ) {
    fail("E014_GATE_MERGE_CONTROL", "scope-or-expiry");
  }

  const { ciPolicy, exercise, manualRc } = dependencies;
  if (
    ciPolicy?.merge_gate?.scope !== contract.merge_control.scope ||
    ciPolicy.merge_gate.required_checks.length !==
      contract.merge_control.required_checks ||
    ciPolicy.merge_gate.explicit_owner_risk_acceptance_per_merge !== true ||
    ciPolicy.merge_gate.production_or_rc_use !== "PROHIBITED"
  ) {
    fail("E014_GATE_CI_POLICY_DRIFT", "merge-control");
  }
  if (
    exercise?.development_gate?.status !==
      contract.decision.phase_2_development ||
    exercise.development_gate?.evidence_status !==
      "ACCEPTED_FOR_DEVELOPMENT_MERGE" ||
    exercise.development_gate?.owner_decision !==
      contract.decision.owner_decision ||
    exercise.development_gate?.accepted_on !== contract.decision.accepted_on ||
    exercise.development_gate?.threat_boundary_review !==
      contract.decision.threat_boundary_review ||
    exercise.development_gate?.production_authorization !==
      contract.decision.production_authorization ||
    exercise.production_rc_gate?.status !== "NO_GO" ||
    exercise.production_rc_gate?.completed !== false ||
    exercise.production_rc_gate?.pass_claim !== "PROHIBITED"
  ) {
    fail("E014_GATE_OBSERVABILITY_FALSE_PASS", "exercise");
  }
  if (
    manualRc?.execution_status !== "MANUAL_EVIDENCE_PENDING" ||
    manualRc.pass_claim !== "PROHIBITED" ||
    manualRc.devtools?.status !== "INFRA_BLOCKED" ||
    manualRc.real_device?.ios !== "MANUAL_EVIDENCE_PENDING" ||
    manualRc.real_device?.android !== "MANUAL_EVIDENCE_PENDING"
  ) {
    fail("E014_GATE_MANUAL_RC_FALSE_PASS", "template");
  }

  return Object.freeze({
    development: contract.decision.phase_2_development,
    production: contract.decision.production_release_candidate,
    deferred: deferred.length,
    conditions: development.filter(
      ({ status }) => status === "REQUIRED_BEFORE_MERGE",
    ).length,
  });
}

export async function validatePhaseGateRepository() {
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
    loadRegistryConfiguration(),
    loadCoverageRegistryDocument(),
    readJson("tests/ci/policy.json"),
    readJson("docker/observability/exercise-contract.json"),
    readJson("tests/manual-rc/evidence-template.json"),
  ]);
  await discoverExpectedSources(configuration);
  await loadAndValidateCoverageRegistry();
  const counts = validateSourceInventory(inventory, configuration, registry);
  const result = validatePhaseGateContract(contract, {
    ciPolicy,
    exercise,
    manualRc,
  });
  await Promise.all(
    contract.development_requirements
      .flatMap(({ evidence }) => evidence)
      .filter((item) => item.includes("/") && !item.startsWith("PR-"))
      .map((item) => access(path.resolve(repositoryRoot, item))),
  );
  return Object.freeze({ ...result, ...counts });
}

async function main() {
  const result = await validatePhaseGateRepository();
  console.log(
    `E014_PHASE_GATE_OK:development=${result.development}:production=${result.production}:conditions=${result.conditions}:deferred=${result.deferred}:registry=${result.COVERED}/${result.total}:planned=${result.PLANNED}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
