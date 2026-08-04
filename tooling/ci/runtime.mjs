import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import { redactSensitiveDiagnosticOutput } from "../lib/sensitive-redaction.mjs";

export const repositoryRoot = path.resolve(import.meta.dirname, "../..");

function appendBounded(current, chunk, maximumBytes) {
  const combined = `${current}${chunk}`;
  return combined.length <= maximumBytes
    ? combined
    : combined.slice(combined.length - maximumBytes);
}

async function pnpmInvocation(arguments_) {
  if (process.platform !== "win32") {
    return { arguments: ["pnpm", ...arguments_], command: "corepack" };
  }
  const corepackModule = path.resolve(
    path.dirname(process.execPath),
    "node_modules/corepack/dist/corepack.js",
  );
  await access(corepackModule);
  return {
    arguments: [corepackModule, "pnpm", ...arguments_],
    command: process.execPath,
  };
}

export async function resolveInvocation(command, arguments_) {
  return command === "pnpm"
    ? pnpmInvocation(arguments_)
    : { arguments: arguments_, command };
}

export async function runBounded(command, arguments_, options = {}) {
  const invocation = await resolveInvocation(command, arguments_);
  const maximumBytes = options.maximumBytes ?? 64 * 1024;
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(invocation.command, invocation.arguments, {
      cwd: options.cwd ?? repositoryRoot,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk.toString("utf8"), maximumBytes);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk.toString("utf8"), maximumBytes);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolvePromise({
        code: code ?? 1,
        signal,
        stderr: redactSensitiveDiagnosticOutput(stderr),
        stdout: redactSensitiveDiagnosticOutput(stdout),
      });
    });
  });
}

export function boundedFailureSummary(result, maximumLines = 30) {
  return `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .slice(-maximumLines)
    .join("\n");
}
