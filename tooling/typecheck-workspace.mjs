import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

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

async function findTypeScriptSources(directory) {
  const sources = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...(await findTypeScriptSources(entryPath)));
    } else if (entry.isFile() && typeScriptSourceExtension.test(entry.name)) {
      sources.push(entryPath);
    }
  }
  return sources.sort();
}

async function main() {
  const workspaceRoot = process.cwd();
  const resolution = spawnSync(
    process.execPath,
    [typeScriptCli, "-p", tsconfigPath, "--showConfig"],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
    },
  );
  if (resolution.status !== 0) {
    process.stderr.write(
      `${resolution.stdout ?? ""}${resolution.stderr ?? ""}`,
    );
    return resolution.status ?? 1;
  }

  let resolvedConfig;
  try {
    resolvedConfig = JSON.parse(resolution.stdout);
  } catch {
    process.stderr.write(resolution.stdout);
    console.error(
      `TYPECHECK_CONFIG_INVALID: ${tsconfigPath} --showConfig did not return JSON`,
    );
    return 1;
  }

  const sources = await findTypeScriptSources(workspaceRoot);
  const configDirectory = dirname(resolve(workspaceRoot, tsconfigPath));
  const resolvedFiles = new Set(
    (resolvedConfig.files ?? []).map((file) => resolve(configDirectory, file)),
  );
  const excludedSources = sources.filter(
    (source) => !resolvedFiles.has(source),
  );
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
      cwd: workspaceRoot,
      encoding: "utf8",
    },
  );
  const output = `${typecheck.stdout ?? ""}${typecheck.stderr ?? ""}`;

  if (excludedSources.length > 0) {
    process.stderr.write(output);
    console.error(
      `TYPECHECK_SOURCE_EXCLUDED: ${tsconfigPath} does not include workspace TypeScript source: ${excludedSources.map((source) => relative(workspaceRoot, source)).join(", ")}`,
    );
    return 1;
  }
  if (typecheck.status === 0) {
    process.stdout.write(output);
    return 0;
  }
  if (
    typecheck.status === 1 &&
    /\berror TS18003:/u.test(output) &&
    sources.length === 0
  ) {
    console.log(
      `Typecheck passed for ${tsconfigPath}: TypeScript resolved the project and the workspace contains no TypeScript source.`,
    );
    return 0;
  }

  process.stderr.write(output);
  return typecheck.status ?? 1;
}

process.exitCode = await main();
