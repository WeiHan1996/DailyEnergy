import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  ADMIN_BUNDLE_RULE_IDS,
  scanAdminBrowserBundle,
} from "./lib/admin-bundle-check.mjs";
import { collectAdminSecretCanaries } from "./lib/admin-secret-canaries.mjs";

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

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "daily-energy-admin-secret-canary-"),
);
try {
  const secretFile = join(temporaryDirectory, "admin-session-secret");
  const secretValue = "synthetic-admin-session-secret-from-file-90210";
  await writeFile(secretFile, secretValue, { mode: 0o600 });
  const secretValues = await collectAdminSecretCanaries({
    ADMIN_SESSION_SECRET_FILE: secretFile,
  });

  assert.deepEqual(
    secretValues,
    [secretValue],
    "secret-file configuration must scan the file content, not only its path",
  );
  assert.equal(
    scanAdminBrowserBundle({
      files: [
        {
          content: `const exposed = "${secretValue}";`,
          path: "apps/admin/.next/static/chunks/secret-file-leak.js",
        },
      ],
      secretValues,
      userBodyCanaries: [],
    })[0]?.ruleId,
    "ADMIN_BUNDLE_SECRET_VALUE",
    "the actual synthetic secret-file content must fail the browser Gate",
  );
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

console.log(
  `Admin bundle fixture Gate passed one known-pass fixture, ${fixture.cases.length} stable known-fail rules, and one synthetic secret-file content case (${fixture.fixture_version}).`,
);
