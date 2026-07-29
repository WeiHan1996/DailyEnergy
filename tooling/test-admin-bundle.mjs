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

function assertRule({
  content,
  expectedRuleId,
  path,
  secretValues = [],
  userBodyCanaries = [],
}) {
  const diagnostics = scanAdminBrowserBundle({
    files: [{ content, path }],
    secretValues,
    userBodyCanaries,
  });
  assert.ok(
    diagnostics.some(({ ruleId }) => ruleId === expectedRuleId),
    `${path} must produce ${expectedRuleId}`,
  );
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "daily-energy-admin-secret-canary-"),
);
try {
  const secretFile = join(temporaryDirectory, "admin-session-secret");
  const secretValue = `synthetic-admin-session-secret-<&>"'\n-from-file-90210`;
  const userBody = `synthetic user note <tired & "uncertain">\nfixture 1d24f58e`;
  await writeFile(secretFile, secretValue, { mode: 0o600 });
  const secretValues = await collectAdminSecretCanaries({
    ADMIN_SESSION_SECRET_FILE: secretFile,
  });

  assert.deepEqual(
    secretValues,
    [secretValue],
    "secret-file configuration must scan the file content, not only its path",
  );

  const javascriptSafeSecret =
    'synthetic-admin-session-secret-\\u003c\\u0026\\u003e\\"\\u0027\\n-from-file-90210';
  const escapedSecretCases = [
    {
      content: `const exposed = ${JSON.stringify(secretValue)};`,
      path: "apps/admin/.next/static/chunks/json-escaped-secret.js",
    },
    {
      content:
        "synthetic-admin-session-secret-&lt;&amp;&gt;&quot;&#x27;\n-from-file-90210",
      path: "browser-response/html-entity-secret",
    },
    {
      content: javascriptSafeSecret,
      path: "browser-response/javascript-safe-secret",
    },
    {
      content: JSON.stringify(javascriptSafeSecret).slice(1, -1),
      path: "browser-response/double-json-escaped-secret",
    },
  ];

  for (const testCase of escapedSecretCases) {
    assertRule({
      ...testCase,
      expectedRuleId: "ADMIN_BUNDLE_SECRET_VALUE",
      secretValues,
    });
  }

  assertRule({
    content:
      "synthetic user note &lt;tired &amp; &quot;uncertain&quot;&gt;\nfixture 1d24f58e",
    expectedRuleId: "ADMIN_BUNDLE_USER_BODY_FIXTURE",
    path: "browser-response/html-entity-user-body",
    userBodyCanaries: [userBody],
  });
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

console.log(
  `Admin bundle fixture Gate passed one known-pass fixture, ${fixture.cases.length} stable known-fail rules, escaped secret/user-body representations, and one synthetic secret-file content case (${fixture.fixture_version}).`,
);
