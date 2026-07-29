import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ADMIN_BUNDLE_RULE_IDS,
  scanAdminBrowserBundle,
} from "./lib/admin-bundle-check.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const fixture = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "tests/architecture/admin-bundle-cases.json"),
    "utf8",
  ),
);

assert.deepEqual(
  scanAdminBrowserBundle({
    files: fixture.known_pass.files,
    secretValues: fixture.known_pass.secret_values,
    userBodyCanaries: fixture.known_pass.user_body_canaries,
  }),
  [],
  "known-pass Admin browser bundle fixture must pass",
);

const coveredRules = new Set();
for (const testCase of fixture.cases) {
  const diagnostics = scanAdminBrowserBundle({
    files: testCase.files,
    secretValues: testCase.secret_values,
    userBodyCanaries: testCase.user_body_canaries,
  });
  assert.ok(
    diagnostics.some(({ ruleId }) => ruleId === testCase.expected_rule_id),
    `${testCase.case_id} must produce ${testCase.expected_rule_id}`,
  );
  coveredRules.add(testCase.expected_rule_id);
}

assert.deepEqual(
  [...coveredRules].sort(),
  [...ADMIN_BUNDLE_RULE_IDS].sort(),
  "every Admin bundle rule must have one minimal known-fail fixture",
);

console.log(
  `Admin bundle fixture Gate passed one known-pass fixture and ${fixture.cases.length} stable known-fail rules (${fixture.fixture_version}).`,
);
