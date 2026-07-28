import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const typeScriptCli = resolve(
  repositoryRoot,
  "node_modules/typescript/bin/tsc",
);
const tsconfigPath = process.argv[2] ?? "tsconfig.json";
const ignoredDirectories = new Set([
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);
const typeScriptSourceExtension = /\.(?:cts|mts|tsx?)$/u;

async function findTypeScriptSources(directory, workspaceRoot = directory) {
  const sources = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...(await findTypeScriptSources(entryPath, workspaceRoot)));
    } else if (entry.isFile() && typeScriptSourceExtension.test(entry.name)) {
      sources.push(relative(workspaceRoot, entryPath));
    }
  }
  return sources.sort();
}

const typecheck = spawnSync(
  process.execPath,
  [
    typeScriptCli,
    "-p",
    tsconfigPath,
    "--noEmit",
    "--incremental",
    "false",
    "--pretty",
    "false",
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
  },
);
const output = `${typecheck.stdout ?? ""}${typecheck.stderr ?? ""}`;

if (typecheck.status === 0) {
  process.stdout.write(output);
} else if (typecheck.status === 1 && /\berror TS18003:/u.test(output)) {
  const resolution = spawnSync(
    process.execPath,
    [typeScriptCli, "-p", tsconfigPath, "--showConfig"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  if (resolution.status !== 0) {
    process.stderr.write(
      `${resolution.stdout ?? ""}${resolution.stderr ?? ""}`,
    );
    process.exitCode = resolution.status ?? 1;
  } else {
    try {
      JSON.parse(resolution.stdout);
    } catch {
      process.stderr.write(resolution.stdout);
      console.error(
        `TYPECHECK_CONFIG_INVALID: ${tsconfigPath} --showConfig did not return JSON`,
      );
      process.exitCode = 1;
    }
    if (process.exitCode !== 1) {
      const sources = await findTypeScriptSources(process.cwd());
      if (sources.length > 0) {
        process.stderr.write(output);
        console.error(
          `TYPECHECK_SOURCE_EXCLUDED: ${tsconfigPath} resolved no inputs while the workspace contains TypeScript source: ${sources.join(", ")}`,
        );
        process.exitCode = 1;
      } else {
        console.log(
          `Typecheck passed for ${tsconfigPath}: TypeScript resolved the project and the workspace contains no TypeScript source.`,
        );
      }
    }
  }
} else {
  process.stderr.write(output);
  process.exitCode = typecheck.status ?? 1;
}
