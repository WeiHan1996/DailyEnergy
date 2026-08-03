import { describe, expect, it } from "vitest";

import { findTestPolicyDiagnostics } from "../../tooling/testing/check-test-policy.mjs";

describe("T-E010-POLICY-002 test source boundary", () => {
  it("rejects focused or silently skipped tests", () => {
    expect(
      findTestPolicyDiagnostics([
        {
          content: ["test", '.skip("synthetic", () => undefined);'].join(""),
          path: "tests/known-fail/sample.test.ts",
        },
      ]),
    ).toEqual([
      [
        "TEST_POLICY_FOCUSED_OR_SKIPPED:tests/known-fail/sample.test.ts:test",
        ".skip(",
      ].join(""),
    ]);
  });

  it("rejects production imports of test helper surfaces", () => {
    expect(
      findTestPolicyDiagnostics([
        {
          content:
            'import { factory } from "@daily-energy/server-adapters/testing";',
          path: "apps/api/src/production.ts",
        },
      ]),
    ).toEqual([
      'TEST_POLICY_PRODUCTION_IMPORT:apps/api/src/production.ts:from "@daily-energy/server-adapters/testing"',
    ]);
  });
});
