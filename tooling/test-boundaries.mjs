import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { boundaryGates, runBoundaryGate } from "./lib/boundary-engine.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(
  repositoryRoot,
  "tests/architecture/boundary-cases.json",
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const errors = [];
const coveredGates = new Set();

for (const testCase of fixture.cases ?? []) {
  if (
    typeof testCase.case_id !== "string" ||
    typeof testCase.gate !== "string" ||
    typeof testCase.expected_rule_id !== "string"
  ) {
    errors.push("BOUNDARY_FIXTURE_INVALID: fixture metadata is incomplete");
    continue;
  }
  const diagnostics = runBoundaryGate(testCase.gate, testCase.project ?? {});
  coveredGates.add(testCase.gate);
  if (
    !diagnostics.some(
      (diagnostic) => diagnostic.ruleId === testCase.expected_rule_id,
    )
  ) {
    errors.push(
      `BOUNDARY_FIXTURE_MISSED: ${testCase.case_id} expected ${testCase.expected_rule_id}`,
    );
  }
}

for (const gateName of boundaryGates.keys()) {
  if (!coveredGates.has(gateName)) {
    errors.push(`BOUNDARY_FIXTURE_MISSING: ${gateName}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Boundary fixture Gate passed ${fixture.cases.length} known-fail cases across ${coveredGates.size} gate classes (${fixture.fixture_version}).`,
  );
}
