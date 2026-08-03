import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function run(command, arguments_) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
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
          `VITEST_PROJECT_COMMAND_FAILED:${command}:${signal ?? code ?? "unknown"}`,
        ),
      );
    });
  });
}

await run("node", ["tooling/ensure-server-adapters-build.mjs"]);
await run("pnpm", ["--filter", "@daily-energy/app-api", "run", "build"]);
await run("pnpm", [
  "--filter",
  "@daily-energy/app-api",
  "run",
  "build:test-fixtures",
]);

const vitestArguments = ["run", "--config", "vitest.projects.ts"];
if (process.argv.includes("--coverage")) {
  vitestArguments.push("--coverage");
}
try {
  await run(
    resolve(repositoryRoot, "node_modules/.bin/vitest"),
    vitestArguments,
  );
} finally {
  await rm(resolve(repositoryRoot, "apps/api/dist-fixtures"), {
    force: true,
    recursive: true,
  });
}
