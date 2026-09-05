import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifyRetryAttempts,
  validateAiCorpus,
  validatePendingEvidenceTemplates,
  validateRunnerRegistry,
  validateRunnerPolicy,
} from "../../tooling/testing/policy-gates.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const policy = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/registry/runner-policy.json"),
    "utf8",
  ),
);
const quarantines = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/registry/quarantine.json"),
    "utf8",
  ),
);
const runnerRegistry = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/registry/runners.json"),
    "utf8",
  ),
);
const manualRc = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/manual-rc/evidence-template.json"),
    "utf8",
  ),
);
const aiEvaluation = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/ai-evaluation/evidence-template.json"),
    "utf8",
  ),
);
const corpus = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "docs/ai/evaluation-corpus.json"),
    "utf8",
  ),
);

describe("T-E010-POLICY-001 runner evidence policy", () => {
  it("keeps retry zero by default and rejects critical quarantine", () => {
    expect(() =>
      validateRunnerPolicy(policy, quarantines, "2026-08-03T00:00:00.000Z"),
    ).not.toThrow();
    expect(() =>
      validateRunnerPolicy(
        policy,
        {
          registry_version: "e-010-quarantine-v1",
          entries: [
            {
              expires_on: "2026-08-10",
              issue: "synthetic-issue-49",
              owner: "synthetic-owner",
              source_ids: ["SQL-001"],
              test_id: "T-SYNTHETIC-QUARANTINE",
            },
          ],
        },
        "2026-08-03T00:00:00.000Z",
      ),
    ).toThrow("TEST_QUARANTINE_CRITICAL");
  });

  it("records a retry pass after an initial failure as FLAKY_FAIL", () => {
    expect(
      classifyRetryAttempts([
        { attempt: 0, status: "FAIL" },
        { attempt: 1, status: "PASS" },
      ]),
    ).toBe("FLAKY_FAIL");
    expect(classifyRetryAttempts([{ attempt: 0, status: "PASS" }])).toBe(
      "PASS",
    );
  });

  it("pins every required runner to its real evidence boundary", () => {
    expect(validateRunnerRegistry(runnerRegistry)).toEqual({ runners: 7 });

    const fakeCore = structuredClone(runnerRegistry);
    fakeCore.runners.find(
      ({ runner_id: runnerId }) => runnerId === "core-e2e",
    ).retry = 1;
    expect(() => validateRunnerRegistry(fakeCore)).toThrow(
      "TEST_RUNNER_CORE_E2E_REALITY",
    );

    const browserSubstitute = structuredClone(runnerRegistry);
    browserSubstitute.runners.find(
      ({ runner_id: runnerId }) => runnerId === "miniapp-devtools",
    ).browser_substitute = "ALLOWED";
    expect(() => validateRunnerRegistry(browserSubstitute)).toThrow(
      "TEST_RUNNER_MINIAPP_EVIDENCE_BOUNDARY",
    );
  });

  it("keeps external and manual evidence pending until it actually runs", () => {
    expect(() =>
      validatePendingEvidenceTemplates(manualRc, aiEvaluation),
    ).not.toThrow();

    const falsePass = structuredClone(manualRc);
    falsePass.execution_status = "PASS";
    expect(() =>
      validatePendingEvidenceTemplates(falsePass, aiEvaluation),
    ).toThrow("TEST_MANUAL_RC_TEMPLATE_INVALID");
  });

  it("validates the 269-case corpus fingerprint without model calls", () => {
    expect(validateAiCorpus(corpus)).toEqual({
      fingerprint: corpus.manifest_fingerprint_sha256,
      total: 269,
    });
    const mutation = structuredClone(corpus);
    mutation.cases[0].expected = "synthetic mutation";
    expect(() => validateAiCorpus(mutation)).toThrow(
      "AI_CORPUS_FINGERPRINT_DRIFT",
    );
  });
});
