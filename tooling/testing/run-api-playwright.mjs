import { spawn } from "node:child_process";
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
          `API_PLAYWRIGHT_COMMAND_FAILED:${command}:${signal ?? code ?? "unknown"}`,
        ),
      );
    });
  });
}

await run("node", ["tooling/ensure-server-adapters-build.mjs"]);
await run("pnpm", ["--filter", "@daily-energy/app-api", "run", "build"]);
await run("pnpm", [
  "exec",
  "playwright",
  "test",
  "--config=tests/e2e/api/playwright.config.ts",
]);
