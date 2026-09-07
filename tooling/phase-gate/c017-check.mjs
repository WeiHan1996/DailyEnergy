#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadAndValidateCoverageRegistry,
  loadCoverageRegistryDocument,
} from "../testing/source-registry.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const expectedBaseline = Object.freeze({
  main_commit: "57529035071348e322d77c0e9b99237973da45a7",
  main_ci_run: 34008347462,
  main_ci_checks: 11,
  c016: {
    pull_request: 183,
    final_head: "6636360a94b90c06072c073b9e030113da82e027",
    ci_run: 34002759447,
    merge_commit: "299e3e8082aae38063aaec7332749a407b7c4f54",
    merged_main_ci_run: 34007506687,
  },
});
const expectedExitIds = Array.from(
  { length: 9 },
  (_, index) => `C017-EXIT-${String(index + 1).padStart(3, "0")}`,
);
const expectedConditionIds = ["C017-COND-001", "C017-COND-002"];
const expectedProductionIds = Array.from(
  { length: 5 },
  (_, index) => `C017-PROD-${String(index + 1).padStart(3, "0")}`,
);

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

async function readText(relativePath) {
  return readFile(path.resolve(repositoryRoot, relativePath), "utf8");
}

function validateDecision(decision, manualEvidence, report, index) {
  const pending =
    decision.phase_3_development ===
      "RECOMMEND_GO_FOR_PHASE_3_DEVELOPMENT_PENDING_OWNER_REVIEW" &&
    decision.owner_decision === "PENDING_REVIEW" &&
    decision.threat_boundary_review === "AGENT_PREPARED_OWNER_PENDING" &&
    decision.accepted_on === null;
  const accepted =
    decision.phase_3_development === "GO_FOR_PHASE_3_DEVELOPMENT" &&
    decision.owner_decision === "ACCEPTED" &&
    decision.threat_boundary_review === "COMPLETED" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(decision.accepted_on ?? "");
  if (!pending && !accepted) {
    fail("C017_GATE_DECISION", "development-review-state");
  }
  if (
    decision.production_release_candidate !== "NO_GO" ||
    decision.alpha_or_real_user_admission !== "NO_GO" ||
    decision.production_authorization !== "NOT_GRANTED" ||
    decision.production_readiness_claim !== "PROHIBITED"
  ) {
    fail("C017_GATE_PRODUCTION_FALSE_PASS", "decision");
  }

  const expectedExecution = pending
    ? "AUTOMATED_EVIDENCE_COMPLETE_OWNER_REVIEW_PENDING"
    : "OWNER_ACCEPTED_FOR_PHASE_3_DEVELOPMENT";
  if (
    manualEvidence?.task_id !== "C-017" ||
    manualEvidence.draft_pr !==
      "https://github.com/WeiHan1996/DailyEnergy/pull/185" ||
    manualEvidence.execution_status !== expectedExecution ||
    manualEvidence.pass_claim !== "PROHIBITED" ||
    manualEvidence.decision?.phase_3_development !==
      decision.phase_3_development ||
    manualEvidence.decision.owner_decision !== decision.owner_decision ||
    manualEvidence.decision.threat_boundary_review !==
      decision.threat_boundary_review ||
    manualEvidence.decision.production_authorization !== "NOT_GRANTED" ||
    manualEvidence.decision.production_release_candidate !== "NO_GO"
  ) {
    fail("C017_GATE_MANUAL_EVIDENCE", "decision-drift");
  }
  if (
    pending &&
    (manualEvidence.reviewer !== null ||
      manualEvidence.reviewed_at_utc !== null)
  ) {
    fail("C017_GATE_MANUAL_EVIDENCE", "premature-reviewer");
  }
  if (
    accepted &&
    (!isNonEmpty(manualEvidence.reviewer) ||
      !/^\d{4}-\d{2}-\d{2}T/u.test(manualEvidence.reviewed_at_utc ?? ""))
  ) {
    fail("C017_GATE_MANUAL_EVIDENCE", "accepted-reviewer-missing");
  }

  const expectedDocumentStatus = pending ? "Draft" : "Accepted";
  const indexStatusPattern = new RegExp(
    `\\| \\[docs/reports/phase-2-gate\\.md\\]\\(\\./reports/phase-2-gate\\.md\\)\\s+\\| ${expectedDocumentStatus}\\s+\\|`,
    "u",
  );
  if (
    !report.includes(`- **文档状态**：${expectedDocumentStatus}`) ||
    !report.includes(decision.phase_3_development) ||
    !report.includes("Production / Release Candidate: NO_GO") ||
    !indexStatusPattern.test(index)
  ) {
    fail("C017_GATE_REPORT_DRIFT", expectedDocumentStatus);
  }
  return pending ? "PENDING_OWNER_REVIEW" : "OWNER_ACCEPTED";
}

function validateExitRequirements(requirements) {
  if (
    !sameJson(
      requirements?.map(({ id }) => id),
      expectedExitIds,
    )
  ) {
    fail("C017_GATE_EXIT_SET", "ids");
  }
  for (const requirement of requirements) {
    if (
      ![
        "ACCEPTED_EVIDENCE_REUSED",
        "AUTOMATED_PROOF_AVAILABLE",
        "MANUAL_EVIDENCE_REUSED",
      ].includes(requirement.status) ||
      !isNonEmpty(requirement.claim) ||
      !Array.isArray(requirement.evidence) ||
      requirement.evidence.length === 0 ||
      requirement.evidence.some((item) => !isNonEmpty(item))
    ) {
      fail("C017_GATE_EXIT_EVIDENCE", requirement.id ?? "missing");
    }
  }
}

function validatePerformance(performance, manualEvidence) {
  const cached = performance?.cached_today;
  const generation = performance?.controlled_template_generation;
  const cachedRuns = cached?.observed_run_p95_ms;
  const generationRuns = generation?.observed_run_p95_ms;
  if (
    performance?.environment !==
      "LOCAL_SYNTHETIC_POSTGRESQL_18_REDIS_8_BULLMQ_5_NEST_HTTP" ||
    performance.clean_runs !== 3 ||
    performance.retry_count !== 0 ||
    cached?.target_p95_ms !== 1000 ||
    cached.samples_per_run !== 7 ||
    !Array.isArray(cachedRuns) ||
    cachedRuns.length !== 3 ||
    cachedRuns.some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isFinite(cached.observed_worst_run_p95_ms) ||
    Math.max(...cachedRuns) !== cached.observed_worst_run_p95_ms ||
    cached.observed_worst_run_p95_ms > cached.target_p95_ms ||
    generation?.target_p95_ms !== 8000 ||
    generation.samples_per_run !== 6 ||
    generation.excluded_fault_recovery_days_per_run !== 1 ||
    !Array.isArray(generationRuns) ||
    generationRuns.length !== 3 ||
    generationRuns.some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isFinite(generation.observed_worst_run_p95_ms) ||
    Math.max(...generationRuns) !== generation.observed_worst_run_p95_ms ||
    generation.observed_worst_run_p95_ms > generation.target_p95_ms ||
    !sameJson(manualEvidence.performance_baseline, performance)
  ) {
    fail("C017_GATE_PERFORMANCE", "budget-or-evidence");
  }
  return Object.freeze({
    cachedP95Ms: cached.observed_worst_run_p95_ms,
    generationP95Ms: generation.observed_worst_run_p95_ms,
  });
}

function validateRegistry(snapshot, registry) {
  const counts = {
    total: registry.entries.length,
    COVERED: registry.entries.filter(({ status }) => status === "COVERED")
      .length,
    PLANNED: registry.entries.filter(({ status }) => status === "PLANNED")
      .length,
    NA_WITH_REASON: registry.entries.filter(
      ({ status }) => status === "NA_WITH_REASON",
    ).length,
  };
  if (
    !sameJson(snapshot?.counts, counts) ||
    snapshot.unmapped !== 0 ||
    snapshot.silent_planned !== 0 ||
    snapshot.planned_admission !== "EXPLICITLY_TRACKED_NOT_PASS" ||
    snapshot.production_admission !== "INSUFFICIENT"
  ) {
    fail("C017_GATE_REGISTRY", JSON.stringify(counts));
  }
  for (const entry of registry.entries.filter(
    ({ status }) => status === "PLANNED",
  )) {
    if (
      !isNonEmpty(entry.planned?.owner) ||
      !isNonEmpty(entry.planned?.reason)
    ) {
      fail("C017_GATE_REGISTRY", entry.source_id);
    }
  }
  return counts;
}

function validateConditions(conditions) {
  if (
    !sameJson(
      conditions?.map(({ id }) => id),
      expectedConditionIds,
    )
  ) {
    fail("C017_GATE_CONDITION_SET", "ids");
  }
  for (const condition of conditions) {
    if (
      condition.status !== "REQUIRED_BEFORE_ACCEPTANCE_OR_MERGE" ||
      !isNonEmpty(condition.owner) ||
      !isNonEmpty(condition.unlock)
    ) {
      fail("C017_GATE_CONDITION", condition.id ?? "missing");
    }
  }
}

function validateProductionRequirements(requirements) {
  if (
    !sameJson(
      requirements?.map(({ id }) => id),
      expectedProductionIds,
    )
  ) {
    fail("C017_GATE_PRODUCTION_SET", "ids");
  }
  for (const requirement of requirements) {
    if (
      ![
        "BLOCKED",
        "EXTERNAL_EVIDENCE_PENDING",
        "MANUAL_EVIDENCE_PENDING",
      ].includes(requirement.status) ||
      requirement.pass_claim !== "PROHIBITED" ||
      [requirement.owner, requirement.reason, requirement.unlock].some(
        (item) => !isNonEmpty(item),
      )
    ) {
      fail("C017_GATE_PRODUCTION_FALSE_PASS", requirement.id ?? "missing");
    }
  }
}

export function validateC017PhaseGateContract(
  contract,
  { c016Evidence, index, manualEvidence, registry, report },
) {
  if (
    contract?.contract_version !== "c-017-phase-gate-v1" ||
    contract.task_id !== "C-017" ||
    contract.profile !== "security" ||
    contract.report_path !== "docs/reports/phase-2-gate.md" ||
    !sameJson(contract.baseline, expectedBaseline)
  ) {
    fail("C017_GATE_CONTRACT", "version-or-baseline");
  }
  if (
    c016Evidence?.task_id !== "C-016" ||
    c016Evidence.review_status !==
      "OWNER_ACCEPTED / EXACT_HEAD_VERIFIED / SQUASH_MERGED / MERGED_MAIN_CI_PASS / ISSUE_CLOSED" ||
    !c016Evidence.automated_core?.final_exact_head_ci?.includes(
      "HEAD_6636360A94B90C06072C073B9E030113DA82E027 / RUN_34002759447",
    ) ||
    !c016Evidence.automated_core?.merge_receipt?.includes(
      "SQUASH_MERGED_299E3E8082AAE38063AAEC7332749A407B7C4F54 / MERGED_MAIN_RUN_34007506687",
    )
  ) {
    fail("C017_GATE_C016_RECEIPT", "evidence-drift");
  }
  const review = validateDecision(
    contract.decision,
    manualEvidence,
    report,
    index,
  );
  validateExitRequirements(contract.phase_2_exit_requirements);
  const performance = validatePerformance(
    contract.performance_baseline,
    manualEvidence,
  );
  const counts = validateRegistry(contract.source_registry, registry);
  if (
    contract.data_quality?.s25_hard_gates !== "G01_G02_G03_G04_PASS" ||
    contract.data_quality.metric_fixtures !== "10_OF_10_PASS" ||
    contract.data_quality.phase_gate_tests !== "12_OF_12_PASS" ||
    contract.data_quality.research_metrics !== "Q01_Q02_UNAVAILABLE" ||
    contract.reliability?.core_e2e_clean_runs !== 3 ||
    contract.reliability.retry_count !== 0 ||
    contract.reliability.first_flaky_failure_preserved !== true ||
    contract.reliability.first_failure_run !== 34001276671 ||
    contract.reliability.fixed_final_head_run !== 34002759447 ||
    contract.reliability.merged_main_run !== 34007506687 ||
    contract.reliability.outbox_inbox_settlement !==
      "FAILED_PENDING_TERMINAL_ZERO_AND_EVERY_PUBLISHED_EVENT_CONSUMED"
  ) {
    fail("C017_GATE_QUALITY", "data-or-reliability");
  }
  if (
    manualEvidence.automated_evidence?.phase_gate !==
      "12_OF_12_PASS / C017_7_OF_7_PASS" ||
    manualEvidence.automated_evidence.phase_2_exit_requirements !==
      "9_OF_9_AUTOMATED_OR_ACCEPTED_EVIDENCE_AVAILABLE" ||
    manualEvidence.automated_evidence.core_e2e_stability !==
      "3_OF_3_PASS / RETRY_ZERO / PROVIDER_CALLS_ZERO" ||
    manualEvidence.automated_evidence.source_registry !==
      "562_OF_1004_COVERED / 442_PLANNED / ZERO_NA / ZERO_UNMAPPED" ||
    manualEvidence.automated_evidence.s25_hard_gates !==
      "G01_G02_G03_G04_PASS" ||
    manualEvidence.automated_evidence.changed_full_security_gate !==
      "AUTOMATED_PASS / MANUAL_EVIDENCE_REQUIRED / 171650MS" ||
    manualEvidence.automated_evidence.task_security_gate !==
      "AUTOMATED_PASS / MANUAL_EVIDENCE_REQUIRED / 83508MS" ||
    manualEvidence.automated_evidence.final_pr_head_ci !== "PENDING"
  ) {
    fail("C017_GATE_AUTOMATED_RECEIPT", "manual-evidence");
  }
  validateConditions(contract.development_conditions);
  validateProductionRequirements(contract.deferred_production_requirements);
  return Object.freeze({
    development: contract.decision.phase_3_development,
    production: contract.decision.production_release_candidate,
    review,
    exits: contract.phase_2_exit_requirements.length,
    conditions: contract.development_conditions.length,
    deferred: contract.deferred_production_requirements.length,
    ...performance,
    ...counts,
  });
}

export async function validateC017PhaseGateRepository() {
  const [contract, manualEvidence, c016Evidence, registry, report, index] =
    await Promise.all([
      readJson("tests/phase-gate/c017-contract.json"),
      readJson("tests/manual-rc/c017-evidence.json"),
      readJson("tests/manual-rc/c016-evidence.json"),
      loadCoverageRegistryDocument(),
      readText("docs/reports/phase-2-gate.md"),
      readText("docs/INDEX.md"),
    ]);
  await loadAndValidateCoverageRegistry();
  await Promise.all(
    contract.phase_2_exit_requirements
      .flatMap(({ evidence }) => evidence)
      .filter((item) => item.includes("/"))
      .map((item) => access(path.resolve(repositoryRoot, item))),
  );
  return validateC017PhaseGateContract(contract, {
    c016Evidence,
    index,
    manualEvidence,
    registry,
    report,
  });
}

async function main() {
  const result = await validateC017PhaseGateRepository();
  console.log(
    `C017_PHASE_GATE_OK:development=${result.development}:production=${result.production}:review=${result.review}:exits=${result.exits}:conditions=${result.conditions}:deferred=${result.deferred}:registry=${result.COVERED}/${result.total}:planned=${result.PLANNED}:cached_p95_ms=${result.cachedP95Ms}:generation_p95_ms=${result.generationP95Ms}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
