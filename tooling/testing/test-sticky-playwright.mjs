import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { resolveCommandInvocation } from "../lib/pnpm-invocation.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");

const result = await new Promise((resolvePromise, reject) => {
  const invocation = resolveCommandInvocation("pnpm", [
    "exec",
    "playwright",
    "test",
    "--config=tests/registry/playwright-known-fail.config.ts",
  ]);
  const child = spawn(invocation.command, invocation.arguments, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    resolvePromise({ code, output, signal });
  });
});

if (result.code === 0 || !result.output.includes("PLAYWRIGHT_FLAKY_FAIL:")) {
  throw new Error(
    `PLAYWRIGHT_STICKY_POLICY_NOT_ENFORCED:${result.signal ?? result.code ?? "unknown"}`,
  );
}

console.log("PLAYWRIGHT_STICKY_POLICY_OK:attempts=2:status=FLAKY_FAIL");
