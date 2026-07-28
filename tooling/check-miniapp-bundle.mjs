import { resolve } from "node:path";

import { scanMiniappBundle } from "./lib/miniapp-bundle-check.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const distributionRoot = resolve(repositoryRoot, "apps/miniapp/dist");
const diagnostics = await scanMiniappBundle(distributionRoot);

if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    console.error(
      `${diagnostic.ruleId}: ${diagnostic.path}: ${diagnostic.message}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    "Miniapp bundle Gate passed: required files are present and no forbidden client dependency or secret identifier was found.",
  );
}
