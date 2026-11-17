import assert from "node:assert/strict";

import {
  resolveCommandInvocation,
  resolvePnpmInvocation,
} from "./lib/pnpm-invocation.mjs";

const execPath = "C:\\node\\node.exe";
const run = ["run", "validate"];
const none = () => false;
const only =
  (...files) =>
  (file) =>
    files.includes(file);

assert.deepEqual(
  resolvePnpmInvocation(run, { platform: "linux", exists: none }),
  { arguments: run, command: "pnpm" },
  "non-Windows keeps the plain pnpm command",
);

assert.deepEqual(
  resolvePnpmInvocation(run, {
    env: { npm_execpath: "C:\\p\\node_modules\\pnpm\\bin\\pnpm.cjs" },
    execPath,
    exists: none,
    platform: "win32",
  }),
  {
    arguments: ["C:\\p\\node_modules\\pnpm\\bin\\pnpm.cjs", ...run],
    command: execPath,
  },
  "Windows prefers the pnpm that launched this process",
);

assert.deepEqual(
  resolvePnpmInvocation(run, {
    env: { npm_execpath: "C:\\npm\\bin\\npm-cli.js" },
    execPath,
    exists: only("C:\\node\\node_modules\\corepack\\dist\\corepack.js"),
    platform: "win32",
  }),
  {
    arguments: [
      "C:\\node\\node_modules\\corepack\\dist\\corepack.js",
      "pnpm",
      ...run,
    ],
    command: execPath,
  },
  "Windows ignores a non-pnpm npm_execpath and falls back to corepack",
);

const shimDirectory = "C:\\tools\\pnpm";
assert.deepEqual(
  resolvePnpmInvocation(run, {
    env: { Path: `C:\\other;${shimDirectory}` },
    execPath,
    exists: only(
      `${shimDirectory}\\pnpm.cmd`,
      `${shimDirectory}\\node_modules\\pnpm\\bin\\pnpm.cjs`,
    ),
    platform: "win32",
  }),
  {
    arguments: [`${shimDirectory}\\node_modules\\pnpm\\bin\\pnpm.cjs`, ...run],
    command: execPath,
  },
  "Windows resolves the JavaScript entry beside the pnpm.cmd shim",
);

assert.throws(
  () =>
    resolvePnpmInvocation(run, {
      env: { PATH: "C:\\other" },
      execPath,
      exists: none,
      platform: "win32",
    }),
  /PNPM_INVOCATION_UNRESOLVED/u,
  "Windows fails closed when pnpm cannot be located",
);

assert.deepEqual(
  resolveCommandInvocation("git", ["status"], { platform: "win32" }),
  { arguments: ["status"], command: "git" },
  "non-pnpm commands pass through unchanged",
);

console.log("PNPM_INVOCATION_FIXTURES_OK");
