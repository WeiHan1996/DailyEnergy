#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { repositoryRoot, runBounded } from "./runtime.mjs";

const policy = JSON.parse(
  await readFile(
    path.resolve(repositoryRoot, "tests/ci/security-policy.json"),
    "utf8",
  ),
);
if (
  policy.policy_version !== "e-011-vulnerability-policy-v1" ||
  policy.scope !== "production" ||
  policy.maximum_vulnerabilities?.critical !== 0 ||
  policy.maximum_vulnerabilities?.high !== 0 ||
  !Array.isArray(policy.exceptions) ||
  policy.exceptions.length !== 0
) {
  throw new Error("CI_VULNERABILITY_POLICY_INVALID:e-011");
}

const outputDirectory = path.resolve(
  repositoryRoot,
  ".artifacts/ci/supply-chain",
);
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
const execution = await runBounded(
  "pnpm",
  ["audit", "--prod", "--audit-level", "high", "--json"],
  { maximumBytes: 16 * 1024 * 1024 },
);

let audit;
try {
  audit = JSON.parse(execution.stdout);
} catch {
  throw new Error("CI_AUDIT_INFRA_BLOCKED:invalid-registry-response");
}
const counts = audit.metadata?.vulnerabilities;
if (
  !counts ||
  !Number.isSafeInteger(counts.high) ||
  !Number.isSafeInteger(counts.critical)
) {
  throw new Error("CI_AUDIT_RESULT_INVALID:metadata");
}
const advisories = Object.values(audit.advisories ?? {})
  .filter(({ severity }) => severity === "critical" || severity === "high")
  .map(
    ({
      github_advisory_id: advisoryId,
      module_name: moduleName,
      severity,
    }) => ({
      advisory_id: advisoryId,
      module_name: moduleName,
      severity,
    }),
  )
  .sort((left, right) => left.advisory_id.localeCompare(right.advisory_id));
const summary = {
  artifact_version: "e-011-vulnerability-summary-v1",
  policy_version: policy.policy_version,
  scope: policy.scope,
  result: counts.critical === 0 && counts.high === 0 ? "PASS" : "FAIL",
  counts: {
    critical: counts.critical,
    high: counts.high,
  },
  advisories,
};
await writeFile(
  path.resolve(outputDirectory, "vulnerability-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
if (summary.result !== "PASS") {
  const ids = advisories.map(({ advisory_id: id }) => id).join(",");
  throw new Error(
    `CI_AUDIT_THRESHOLD_EXCEEDED:critical=${counts.critical}:high=${counts.high}:ids=${ids}`,
  );
}
console.log("CI_AUDIT_OK:critical=0:high=0");
