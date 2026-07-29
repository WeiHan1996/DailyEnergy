import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { redactSensitiveDiagnosticOutput } from "./lib/sensitive-redaction.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const failures = [];
const cases = [
  {
    id: "structured-sensitive-fields",
    input: [
      "API_KEY=api-canary",
      "AWS_ACCESS_KEY_ID=access-canary",
      "clientSecret=client-canary",
      "DATABASE_URL=postgres://db-user:db-pass@db.example/app",
      'connectionString="Server=db;User Id=admin;Password=connection-pass"',
      "prompt=user-private-canary",
      "userContent=user-content-canary",
      "providerBody=provider-private-canary",
      "requestBody=request-private-canary",
      "responseBody=response-private-canary",
    ].join("\n"),
    forbidden: [
      "api-canary",
      "access-canary",
      "client-canary",
      "db-user",
      "db-pass",
      "connection-pass",
      "user-private-canary",
      "user-content-canary",
      "provider-private-canary",
      "request-private-canary",
      "response-private-canary",
    ],
  },
  {
    id: "credential-bearing-url",
    input: "database failure at postgres://url-user:url-pass@host.example/db",
    forbidden: ["url-user", "url-pass"],
    required: ["postgres://[REDACTED]@host.example/db"],
  },
  {
    id: "existing-secret-shapes",
    input: [
      "Authorization: Bearer bearer-canary",
      "SESSION_SECRET=session-canary",
      "-----BEGIN TEST PRIVATE KEY-----",
      "private-key-canary",
      "-----END TEST PRIVATE KEY-----",
    ].join("\n"),
    forbidden: ["bearer-canary", "session-canary", "private-key-canary"],
  },
];

for (const testCase of cases) {
  const output = redactSensitiveDiagnosticOutput(testCase.input);
  for (const forbidden of testCase.forbidden) {
    if (output.includes(forbidden)) {
      failures.push(`${testCase.id}: leaked ${forbidden}`);
    }
  }
  for (const required of testCase.required ?? ["[REDACTED]"]) {
    if (!output.includes(required)) {
      failures.push(`${testCase.id}: missing ${required}`);
    }
  }
}

const cliCanary = "cli-api-canary";
const execution = spawnSync(
  process.execPath,
  [
    resolve(repositoryRoot, "tooling/agent-validate-entry.mjs"),
    `--invalid=API_KEY=${cliCanary}`,
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: "1" },
  },
);
const cliOutput = `${execution.stdout ?? ""}\n${execution.stderr ?? ""}`;
if (
  execution.status !== 1 ||
  cliOutput.includes(cliCanary) ||
  !cliOutput.includes("[REDACTED]")
) {
  failures.push(
    "agent-validate-entry: wrapper must preserve failure status and redact arguments",
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`SENSITIVE_REDACTION_FIXTURE_FAILED: ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Sensitive redaction fixtures passed: ${cases.length} direct cases and 1 CLI canary.`,
  );
}
