import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { scanMiniappBundle } from "./lib/miniapp-bundle-check.mjs";
import {
  miniappPublicConfigFingerprint,
  normalizeGeneratedSourceLineEndings,
  parseMiniappPublicConfig,
  renderMiniappPublicConfigRuntime,
  renderMiniappPublicConfigSource,
} from "./lib/miniapp-public-config.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const miniappRoot = resolve(repositoryRoot, "apps/miniapp");
const sourceRoot = resolve(miniappRoot, "src");
const distributionRoot = resolve(miniappRoot, "dist");
const defaultConfigPath = resolve(miniappRoot, "public-build.config.json");
const generatedSourcePath = resolve(
  sourceRoot,
  "generated/public-build-config.ts",
);
const generatedRuntimePath = resolve(
  distributionRoot,
  "generated/public-build-config.js",
);
const staticExtensions = new Set([".json", ".wxml", ".wxs", ".wxss"]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function environmentConfig(defaultConfig) {
  return parseMiniappPublicConfig({
    ...defaultConfig,
    ...(process.env.DAILYENERGY_MINIAPP_ENVIRONMENT === undefined
      ? {}
      : { environment: process.env.DAILYENERGY_MINIAPP_ENVIRONMENT }),
    ...(process.env.DAILYENERGY_MINIAPP_API_ORIGIN === undefined
      ? {}
      : { apiOrigin: process.env.DAILYENERGY_MINIAPP_API_ORIGIN }),
  });
}

async function validateProjectConfig() {
  const config = await readJson(resolve(miniappRoot, "project.config.json"));
  if (
    config.compileType !== "miniprogram" ||
    config.miniprogramRoot !== "dist/" ||
    config.libVersion !== "3.7.12" ||
    typeof config.appid !== "string" ||
    config.appid.length === 0 ||
    config.setting?.urlCheck !== true
  ) {
    throw new Error("MINIAPP_PROJECT_CONFIG_INVALID");
  }
}

async function copyStaticAssets(directory = sourceRoot) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const sourcePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await copyStaticAssets(sourcePath);
      continue;
    }
    if (!staticExtensions.has(extname(sourcePath))) {
      continue;
    }
    const relativePath = sourcePath.slice(sourceRoot.length + 1);
    const destinationPath = resolve(distributionRoot, relativePath);
    await mkdir(resolve(destinationPath, ".."), { recursive: true });
    await cp(sourcePath, destinationPath);
  }
}

function compileTypeScript() {
  const typeScriptCli = resolve(
    repositoryRoot,
    "node_modules/typescript/bin/tsc",
  );
  const result = spawnSync(
    process.execPath,
    [
      typeScriptCli,
      "-p",
      resolve(miniappRoot, "tsconfig.build.json"),
      "--pretty",
      "false",
    ],
    {
      cwd: miniappRoot,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    process.stderr.write(`${result.stdout ?? ""}${result.stderr ?? ""}`);
    throw new Error("MINIAPP_TYPESCRIPT_BUILD_FAILED");
  }
}

async function assertGeneratedSource(defaultConfig) {
  const expected = renderMiniappPublicConfigSource(defaultConfig);
  const actual = await readFile(generatedSourcePath, "utf8");
  if (normalizeGeneratedSourceLineEndings(actual) !== expected) {
    throw new Error(
      "MINIAPP_GENERATED_SOURCE_DRIFT: run build-miniapp.mjs --write-source",
    );
  }
}

async function writeGeneratedSource(defaultConfig) {
  await mkdir(resolve(generatedSourcePath, ".."), { recursive: true });
  await writeFile(
    generatedSourcePath,
    renderMiniappPublicConfigSource(defaultConfig),
    "utf8",
  );
}

async function main() {
  const defaultConfig = parseMiniappPublicConfig(
    await readJson(defaultConfigPath),
  );
  if (process.argv.includes("--write-source")) {
    await writeGeneratedSource(defaultConfig);
    console.log(
      `Generated miniapp public config source (${miniappPublicConfigFingerprint(defaultConfig)}).`,
    );
    return;
  }

  await assertGeneratedSource(defaultConfig);
  await validateProjectConfig();
  const buildConfig = environmentConfig(defaultConfig);
  await rm(distributionRoot, { force: true, recursive: true });
  compileTypeScript();
  await copyStaticAssets();
  await mkdir(resolve(generatedRuntimePath, ".."), { recursive: true });
  await writeFile(
    generatedRuntimePath,
    renderMiniappPublicConfigRuntime(buildConfig),
    "utf8",
  );

  const diagnostics = await scanMiniappBundle(distributionRoot);
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      console.error(
        `${diagnostic.ruleId}: ${diagnostic.path}: ${diagnostic.message}`,
      );
    }
    throw new Error("MINIAPP_BUNDLE_GATE_FAILED");
  }
  console.log(
    `Miniapp build passed for ${buildConfig.environment} with source fingerprint ${miniappPublicConfigFingerprint(buildConfig)}.`,
  );
}

await main();
