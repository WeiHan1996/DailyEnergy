import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  protectedCompilerOptions,
  resolveTypeScriptConfig,
  resolvedConfigDiagnostics,
} from "./lib/typescript-config-gate.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const typeScriptCli = resolve(
  repositoryRoot,
  "node_modules/typescript/bin/tsc",
);
const expectedExtends = new Map([
  ["apps/admin", "@daily-energy/typescript-config/next.json"],
  ["apps/api", "@daily-energy/typescript-config/node.json"],
  ["apps/miniapp", "@daily-energy/typescript-config/miniapp.json"],
  ["apps/worker", "@daily-energy/typescript-config/node.json"],
  ["packages/api-client", "@daily-energy/typescript-config/base.json"],
  ["packages/eslint-config", "@daily-energy/typescript-config/tooling.json"],
  ["packages/prompt-library", "@daily-energy/typescript-config/node.json"],
  ["packages/server-adapters", "@daily-energy/typescript-config/node.json"],
  ["packages/server-core", "@daily-energy/typescript-config/node.json"],
  ["packages/shared-schemas", "@daily-energy/typescript-config/node.json"],
  ["packages/typescript-config", "./config.json"],
]);
const errors = [];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const baseConfig = await readJson(
  resolve(repositoryRoot, "packages/typescript-config/base.json"),
);
for (const option of protectedCompilerOptions) {
  if (baseConfig.compilerOptions?.[option] !== true) {
    errors.push(`CONFIG_BASE_STRICT: ${option} must be true in base.json`);
  }
}
if (Object.hasOwn(baseConfig.compilerOptions ?? {}, "paths")) {
  errors.push("CONFIG_BASE_PATHS: base.json must not declare paths");
}

for (const [workspaceDirectory, expectedBase] of expectedExtends) {
  const tsconfigPath = resolve(
    repositoryRoot,
    workspaceDirectory,
    "tsconfig.json",
  );
  let tsconfig;
  try {
    tsconfig = await readJson(tsconfigPath);
  } catch {
    errors.push(`CONFIG_TSCONFIG_MISSING: ${workspaceDirectory}/tsconfig.json`);
    continue;
  }

  if (tsconfig.extends !== expectedBase) {
    errors.push(
      `CONFIG_TSCONFIG_EXTENDS: ${workspaceDirectory} must extend ${expectedBase}`,
    );
  }
  for (const option of protectedCompilerOptions) {
    if (tsconfig.compilerOptions?.[option] === false) {
      errors.push(
        `CONFIG_STRICT_OVERRIDE: ${workspaceDirectory} cannot disable ${option}`,
      );
    }
  }
  if (Object.hasOwn(tsconfig.compilerOptions ?? {}, "paths")) {
    errors.push(
      `CONFIG_PATH_ALIAS: ${workspaceDirectory} cannot declare cross-workspace paths`,
    );
  }
  try {
    const resolvedConfig = await resolveTypeScriptConfig({
      cwd: repositoryRoot,
      tsconfigPath,
      typeScriptCli,
    });
    for (const diagnostic of resolvedConfigDiagnostics(
      workspaceDirectory,
      resolvedConfig,
    )) {
      errors.push(`${diagnostic.ruleId}: ${diagnostic.message}`);
    }
  } catch {
    errors.push(
      `CONFIG_TSCONFIG_RESOLUTION: ${workspaceDirectory}/tsconfig.json is not loadable by TypeScript`,
    );
  }

  const manifest = await readJson(
    resolve(repositoryRoot, workspaceDirectory, "package.json"),
  );
  const expectedTypecheckScript =
    workspaceDirectory === "apps/admin"
      ? "next typegen && node ../../tooling/typecheck-workspace.mjs"
      : ["packages/api-client", "packages/shared-schemas"].includes(
            workspaceDirectory,
          )
        ? "node ../../tooling/typecheck-workspace.mjs tsconfig.check.json"
        : "node ../../tooling/typecheck-workspace.mjs";
  if (manifest.scripts?.typecheck !== expectedTypecheckScript) {
    errors.push(
      `CONFIG_TYPECHECK_SCRIPT: ${manifest.name} must provide deterministic workspace typecheck`,
    );
  }
  if (
    workspaceDirectory !== "packages/typescript-config" &&
    manifest.devDependencies?.["@daily-energy/typescript-config"] !==
      "workspace:*"
  ) {
    errors.push(
      `CONFIG_PACKAGE_DEPENDENCY: ${manifest.name} must depend on the shared config with workspace:*`,
    );
  }
}

const miniappConfig = await readJson(
  resolve(repositoryRoot, "packages/typescript-config/miniapp.json"),
);
if (
  !Array.isArray(miniappConfig.compilerOptions?.types) ||
  miniappConfig.compilerOptions.types.length !== 0
) {
  errors.push(
    "CONFIG_MINIAPP_NODE_TYPES: miniapp config must use an empty types list",
  );
}
if (miniappConfig.compilerOptions?.moduleResolution !== "Bundler") {
  errors.push(
    "CONFIG_MINIAPP_RESOLUTION: miniapp config must use Bundler resolution",
  );
}

const nodeConfig = await readJson(
  resolve(repositoryRoot, "packages/typescript-config/node.json"),
);
if (
  nodeConfig.compilerOptions?.module !== "NodeNext" ||
  nodeConfig.compilerOptions?.moduleResolution !== "NodeNext"
) {
  errors.push(
    "CONFIG_NODE_ESM: node config must use NodeNext module semantics",
  );
}

const configManifest = await readJson(
  resolve(repositoryRoot, "packages/typescript-config/package.json"),
);
for (const configName of [
  "base",
  "config",
  "miniapp",
  "next",
  "node",
  "tooling",
]) {
  const subpath = `./${configName}.json`;
  if (configManifest.exports?.[subpath] !== subpath) {
    errors.push(`CONFIG_EXPORT_MISSING: ${subpath}`);
  }
}
if (Object.hasOwn(configManifest, "dependencies")) {
  errors.push(
    "CONFIG_RUNTIME_DEPENDENCY: typescript-config cannot have runtime dependencies",
  );
}

const eslintManifest = await readJson(
  resolve(repositoryRoot, "packages/eslint-config/package.json"),
);
if (eslintManifest.exports?.["."] !== "./index.js") {
  errors.push(
    "CONFIG_ESLINT_EXPORT: eslint-config must export only its flat config",
  );
}
if (Object.hasOwn(eslintManifest, "dependencies")) {
  errors.push(
    "CONFIG_RUNTIME_DEPENDENCY: eslint-config cannot have runtime dependencies",
  );
}

const rootEntries = await readdir(repositoryRoot);
if (!rootEntries.includes("eslint.config.mjs")) {
  errors.push("CONFIG_ESLINT_ROOT: eslint.config.mjs is required");
}
if (!rootEntries.includes("prettier.config.mjs")) {
  errors.push("CONFIG_PRETTIER_ROOT: prettier.config.mjs is required");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Configuration Gate passed for ${expectedExtends.size} workspaces with TypeScript strict inheritance.`,
  );
}
