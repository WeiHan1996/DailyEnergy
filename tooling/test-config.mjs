import { resolve } from "node:path";

import {
  resolveTypeScriptConfig,
  resolvedConfigDiagnostics,
} from "./lib/typescript-config-gate.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const fixtureRoot = resolve(
  repositoryRoot,
  "tests/config/shared-intermediate-strict-off",
);
const resolvedConfig = await resolveTypeScriptConfig({
  cwd: repositoryRoot,
  tsconfigPath: resolve(fixtureRoot, "tsconfig.json"),
  typeScriptCli: resolve(repositoryRoot, "node_modules/typescript/bin/tsc"),
});
const diagnostics = resolvedConfigDiagnostics(
  "shared-intermediate-strict-off",
  resolvedConfig,
);

if (
  diagnostics.length !== 1 ||
  diagnostics[0]?.ruleId !== "CONFIG_RESOLVED_STRICT" ||
  !diagnostics[0].message.includes("compilerOptions.strict")
) {
  console.error(
    "CONFIG_FIXTURE_MISSED: a shared intermediate config disabling strict must produce exactly CONFIG_RESOLVED_STRICT",
  );
  process.exitCode = 1;
} else {
  console.log(
    "Configuration fixture Gate passed: resolved shared intermediate strict override was rejected.",
  );
}
