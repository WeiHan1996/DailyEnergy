import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedWorkspaceDirectories = [
  "apps/admin",
  "apps/api",
  "apps/miniapp",
  "apps/worker",
  "packages/api-client",
  "packages/eslint-config",
  "packages/prompt-library",
  "packages/server-adapters",
  "packages/server-core",
  "packages/shared-schemas",
  "packages/typescript-config",
];
const allowedRuntimes = new Set([
  "client-safe",
  "server-core",
  "server-adapter",
  "server-asset",
  "tooling",
]);
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const sourceExtensions = /\.(?:c|m)?(?:j|t)sx?$/u;
const ignoredDirectories = new Set([
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);
const errors = [];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function walk(directory, visitor) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath, visitor);
    } else {
      await visitor(entryPath);
    }
  }
}

const rootManifest = await readJson(resolve(repositoryRoot, "package.json"));
if (rootManifest.private !== true) {
  errors.push("WORKSPACE_ROOT_PRIVATE: root package must be private");
}
if (rootManifest.packageManager !== "pnpm@11.17.0") {
  errors.push("WORKSPACE_PACKAGE_MANAGER: packageManager must be pnpm@11.17.0");
}
if (rootManifest.engines?.node !== ">=24 <25") {
  errors.push("WORKSPACE_NODE_ENGINE: Node engine must be >=24 <25");
}
if (rootManifest.engines?.pnpm !== "11.17.0") {
  errors.push("WORKSPACE_PNPM_ENGINE: pnpm engine must be 11.17.0");
}
if (rootManifest.devDependencies?.turbo !== "2.10.7") {
  errors.push("WORKSPACE_TURBO_VERSION: turbo must be exactly 2.10.7");
}
for (const versionFile of [".node-version", ".nvmrc"]) {
  if (
    (await readFile(resolve(repositoryRoot, versionFile), "utf8")).trim() !==
    "24.18.0"
  ) {
    errors.push(`WORKSPACE_NODE_VERSION: ${versionFile} must contain 24.18.0`);
  }
}

const manifests = new Map();
for (const workspaceDirectory of expectedWorkspaceDirectories) {
  const manifestPath = resolve(
    repositoryRoot,
    workspaceDirectory,
    "package.json",
  );
  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch {
    errors.push(
      `WORKSPACE_MANIFEST_MISSING: ${workspaceDirectory}/package.json`,
    );
    continue;
  }

  if (
    typeof manifest.name !== "string" ||
    !manifest.name.startsWith("@daily-energy/")
  ) {
    errors.push(
      `WORKSPACE_NAME: ${workspaceDirectory} must use @daily-energy/*`,
    );
    continue;
  }
  if (manifests.has(manifest.name)) {
    errors.push(`WORKSPACE_NAME_DUPLICATE: ${manifest.name}`);
  }
  if (manifest.private !== true) {
    errors.push(`WORKSPACE_PRIVATE: ${manifest.name} must be private`);
  }
  if (!allowedRuntimes.has(manifest.dailyEnergy?.runtime)) {
    errors.push(
      `WORKSPACE_RUNTIME: ${manifest.name} has invalid dailyEnergy.runtime`,
    );
  }
  if (
    manifest.dailyEnergy?.kind === "package" &&
    !Object.hasOwn(manifest, "exports")
  ) {
    errors.push(
      `WORKSPACE_EXPORTS: ${manifest.name} must declare explicit exports`,
    );
  }
  for (const exportPath of Object.keys(manifest.exports ?? {})) {
    if (
      exportPath.includes("*") ||
      exportPath.includes("/internal") ||
      exportPath.includes("/src")
    ) {
      errors.push(
        `WORKSPACE_EXPORTS_DEEP: ${manifest.name} exposes ${exportPath}`,
      );
    }
  }

  manifests.set(manifest.name, {
    directory: workspaceDirectory,
    manifest,
  });
}

const workspaceGraph = new Map();
for (const [name, workspace] of manifests) {
  const edges = new Set();
  for (const field of dependencyFields) {
    for (const [dependencyName, specifier] of Object.entries(
      workspace.manifest[field] ?? {},
    )) {
      if (!dependencyName.startsWith("@daily-energy/")) {
        continue;
      }
      if (
        typeof specifier !== "string" ||
        !specifier.startsWith("workspace:")
      ) {
        errors.push(
          `WORKSPACE_PROTOCOL: ${name} -> ${dependencyName} must use workspace:`,
        );
      }
      if (dependencyName.startsWith("@daily-energy/app-")) {
        errors.push(
          `WORKSPACE_APP_DEPENDENCY: ${name} cannot depend on ${dependencyName}`,
        );
      }
      if (manifests.has(dependencyName)) {
        edges.add(dependencyName);
      }
    }
  }
  workspaceGraph.set(name, edges);
}

const visiting = new Set();
const visited = new Set();
function visit(name, path = []) {
  if (visiting.has(name)) {
    errors.push(`WORKSPACE_CYCLE: ${[...path, name].join(" -> ")}`);
    return;
  }
  if (visited.has(name)) {
    return;
  }

  visiting.add(name);
  for (const dependency of workspaceGraph.get(name) ?? []) {
    visit(dependency, [...path, name]);
  }
  visiting.delete(name);
  visited.add(name);
}
for (const name of workspaceGraph.keys()) {
  visit(name);
}

const lockfiles = [];
await walk(repositoryRoot, async (path) => {
  const filename = path.split(sep).at(-1);
  if (
    filename === "pnpm-lock.yaml" ||
    filename === "package-lock.json" ||
    filename === "yarn.lock"
  ) {
    lockfiles.push(relative(repositoryRoot, path));
  }
});
if (lockfiles.length !== 1 || lockfiles[0] !== "pnpm-lock.yaml") {
  errors.push(
    `WORKSPACE_LOCKFILE: expected only pnpm-lock.yaml, found ${
      lockfiles.join(", ") || "none"
    }`,
  );
}

const importPattern =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/gu;
for (const sourceRoot of ["apps", "packages"]) {
  await walk(resolve(repositoryRoot, sourceRoot), async (path) => {
    if (!sourceExtensions.test(path)) {
      return;
    }

    const source = await readFile(path, "utf8");
    const sourcePath = relative(repositoryRoot, path);
    const [sourceArea, sourceApp] = sourcePath.split(sep);
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (
        specifier.startsWith("@daily-energy/") &&
        specifier.includes("/src/")
      ) {
        errors.push(
          `WORKSPACE_DEEP_IMPORT: ${relative(repositoryRoot, path)} -> ${specifier}`,
        );
      }

      if (sourceArea === "apps" && specifier.startsWith(".")) {
        const targetPath = relative(
          repositoryRoot,
          resolve(dirname(path), specifier),
        );
        const [targetArea, targetApp] = targetPath.split(sep);
        if (
          targetArea === "apps" &&
          sourceApp !== undefined &&
          targetApp !== sourceApp
        ) {
          errors.push(`WORKSPACE_APP_IMPORT: ${sourcePath} -> ${specifier}`);
        }
      }

      if (
        sourcePath.startsWith(`apps${sep}miniapp${sep}`) &&
        (specifier.startsWith("node:") ||
          specifier.startsWith("@daily-energy/server-") ||
          specifier === "@daily-energy/prompt-library" ||
          specifier.startsWith("@nestjs/") ||
          specifier === "@prisma/client" ||
          specifier === "bullmq" ||
          specifier === "ioredis")
      ) {
        errors.push(
          `WORKSPACE_CLIENT_IMPORT: ${relative(repositoryRoot, path)} -> ${specifier}`,
        );
      }

      if (
        sourcePath.startsWith(`apps${sep}admin${sep}`) &&
        (specifier.startsWith("@daily-energy/server-") ||
          specifier === "@daily-energy/prompt-library" ||
          specifier === "@prisma/client" ||
          specifier === "bullmq" ||
          specifier === "ioredis")
      ) {
        errors.push(
          `WORKSPACE_ADMIN_IMPORT: ${relative(repositoryRoot, path)} -> ${specifier}`,
        );
      }
    }
  });
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Workspace Gate passed for ${manifests.size} packages with one root lockfile.`,
  );
}
