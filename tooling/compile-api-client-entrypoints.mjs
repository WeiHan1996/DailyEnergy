import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const typeScriptCli = resolve(
  repositoryRoot,
  "node_modules/typescript/bin/tsc",
);
const failures = [];

for (const audience of ["miniapp", "admin", "testing"]) {
  const result = spawnSync(
    process.execPath,
    [
      typeScriptCli,
      "-p",
      resolve(repositoryRoot, `packages/api-client/tsconfig.${audience}.json`),
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (result.status !== 0) {
    failures.push(
      `API_CLIENT_COMPILE_${audience.toUpperCase()}: ${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "API client compile Gate passed independent miniapp, Admin, and testing entrypoints.",
  );
}
