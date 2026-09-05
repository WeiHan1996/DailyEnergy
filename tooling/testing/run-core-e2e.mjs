#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const repeatText = process.env.CORE_E2E_REPEAT ?? "1";
const repeat = Number(repeatText);

if (!Number.isInteger(repeat) || repeat < 1 || repeat > 3) {
  throw new Error("CORE_E2E_REPEAT_INVALID");
}

function run(command, arguments_, environment = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: { ...process.env, ...environment },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `CORE_E2E_COMMAND_FAILED:${command}:${signal ?? code ?? "unknown"}`,
        ),
      );
    });
  });
}

await run("pnpm", ["--filter", "@daily-energy/server-core", "run", "build"]);
await run("node", ["tooling/ensure-server-adapters-build.mjs"]);
await run("pnpm", ["--filter", "@daily-energy/app-api", "run", "build"]);

for (let ordinal = 1; ordinal <= repeat; ordinal += 1) {
  await run(
    process.execPath,
    ["--test", "--test-concurrency=1", "tests/e2e/core/core-journey.test.mjs"],
    {
      CORE_E2E_ENABLED: "1",
      CORE_E2E_RUN_ORDINAL: String(ordinal),
    },
  );
  console.log(`CORE_E2E_CLEAN_RUN_OK:${ordinal}/${repeat}`);
}
