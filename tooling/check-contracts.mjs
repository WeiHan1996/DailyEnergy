import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import {
  loadContractGateState,
  runContractGates,
} from "./lib/contract-gate.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");

const build = spawnSync(
  process.execPath,
  [
    resolve(repositoryRoot, "node_modules/typescript/bin/tsc"),
    "-p",
    resolve(repositoryRoot, "packages/shared-schemas/tsconfig.json"),
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
  },
);
if (build.status !== 0) {
  process.stderr.write(`${build.stdout ?? ""}${build.stderr ?? ""}`);
  throw new Error("CONTRACT_GATE_SCHEMA_BUILD_FAILED");
}

const state = await loadContractGateState(repositoryRoot);
const diagnostics = runContractGates(state);

if (diagnostics.length > 0) {
  console.error(
    diagnostics
      .map(({ message, path, ruleId }) => `${ruleId}: ${path}: ${message}`)
      .join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Contract Gate passed ${state.errorContract.length} error codes and ${Object.keys(state.document.paths).length} paths (${state.contractSourceFingerprint}).`,
  );
}
