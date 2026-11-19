import { existsSync } from "node:fs";
import path from "node:path";

const javaScriptEntry = /\.(?:c|m)?js$/u;

function pnpmFromRunningProcess(env) {
  const entry = env.npm_execpath;
  return entry &&
    /pnpm/iu.test(path.win32.basename(entry)) &&
    javaScriptEntry.test(entry)
    ? [entry]
    : undefined;
}

function pnpmFromCorepack(execPath, exists) {
  const module = path.win32.resolve(
    path.win32.dirname(execPath),
    "node_modules/corepack/dist/corepack.js",
  );
  return exists(module) ? [module, "pnpm"] : undefined;
}

function pnpmFromPath(env, exists) {
  for (const directory of (env.PATH ?? env.Path ?? "").split(";")) {
    if (directory === "") {
      continue;
    }
    const executable = path.win32.join(directory, "pnpm.exe");
    if (exists(executable)) {
      return { command: executable, prefix: [] };
    }
    const entry = path.win32.join(directory, "node_modules/pnpm/bin/pnpm.cjs");
    if (exists(path.win32.join(directory, "pnpm.cmd")) && exists(entry)) {
      return { command: undefined, prefix: [entry] };
    }
  }
  return undefined;
}

/**
 * Windows cannot spawn the `pnpm.cmd` shim without a shell. Resolve pnpm to a
 * JavaScript entry run by the current Node, or to a real executable.
 */
export function resolvePnpmInvocation(
  arguments_,
  {
    env = process.env,
    execPath = process.execPath,
    exists = existsSync,
    platform = process.platform,
  } = {},
) {
  if (platform !== "win32") {
    return { arguments: arguments_, command: "pnpm" };
  }

  const prefix =
    pnpmFromRunningProcess(env) ?? pnpmFromCorepack(execPath, exists);
  if (prefix) {
    return { arguments: [...prefix, ...arguments_], command: execPath };
  }

  const fromPath = pnpmFromPath(env, exists);
  if (fromPath) {
    return {
      arguments: [...fromPath.prefix, ...arguments_],
      command: fromPath.command ?? execPath,
    };
  }

  throw new Error("PNPM_INVOCATION_UNRESOLVED: pnpm entry not found");
}

export function resolveCommandInvocation(command, arguments_, options) {
  return command === "pnpm"
    ? resolvePnpmInvocation(arguments_, options)
    : { arguments: arguments_, command };
}
