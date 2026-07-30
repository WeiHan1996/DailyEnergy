import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executeFile = promisify(execFile);
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
  ".claude",
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);
const clientWorkspaceImportAllowlist = new Map([
  [
    "admin",
    new Set([
      "@daily-energy/api-client/admin",
      "@daily-energy/shared-schemas/client",
    ]),
  ],
  [
    "miniapp",
    new Set([
      "@daily-energy/api-client/miniapp",
      "@daily-energy/shared-schemas/client",
    ]),
  ],
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

async function enumerateWorkspaceDirectories() {
  let projects;
  try {
    const { stdout } = await executeFile(
      "pnpm",
      ["list", "--recursive", "--depth", "-1", "--json"],
      {
        cwd: repositoryRoot,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    projects = JSON.parse(stdout);
  } catch {
    errors.push(
      "WORKSPACE_ENUMERATION: pnpm could not enumerate workspace projects",
    );
    return [];
  }

  if (!Array.isArray(projects)) {
    errors.push("WORKSPACE_ENUMERATION: pnpm returned an invalid project list");
    return [];
  }

  const directories = new Set();
  for (const project of projects) {
    if (typeof project?.path !== "string") {
      errors.push("WORKSPACE_ENUMERATION: project path is missing");
      continue;
    }

    const workspaceDirectory = relative(repositoryRoot, project.path);
    if (workspaceDirectory === "") {
      continue;
    }
    if (
      workspaceDirectory === ".." ||
      workspaceDirectory.startsWith(`..${sep}`)
    ) {
      errors.push(`WORKSPACE_OUTSIDE_ROOT: ${project.path}`);
      continue;
    }

    directories.add(workspaceDirectory.split(sep).join("/"));
  }

  return [...directories].sort((left, right) => left.localeCompare(right));
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

const actualWorkspaceDirectories = await enumerateWorkspaceDirectories();
const actualWorkspaceDirectorySet = new Set(actualWorkspaceDirectories);
const expectedWorkspaceDirectorySet = new Set(expectedWorkspaceDirectories);

for (const workspaceDirectory of expectedWorkspaceDirectories) {
  if (!actualWorkspaceDirectorySet.has(workspaceDirectory)) {
    errors.push(
      `WORKSPACE_MANIFEST_MISSING: ${workspaceDirectory}/package.json`,
    );
  }
}
for (const workspaceDirectory of actualWorkspaceDirectories) {
  if (!expectedWorkspaceDirectorySet.has(workspaceDirectory)) {
    errors.push(`WORKSPACE_PACKAGE_UNEXPECTED: ${workspaceDirectory}`);
  }
}

const manifests = new Map();
for (const workspaceDirectory of actualWorkspaceDirectories) {
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
      `WORKSPACE_MANIFEST_INVALID: ${workspaceDirectory}/package.json`,
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
  /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/gu;
for (const sourceRoot of ["apps", "packages"]) {
  await walk(resolve(repositoryRoot, sourceRoot), async (path) => {
    if (!sourceExtensions.test(path)) {
      return;
    }

    const source = await readFile(path, "utf8");
    const sourcePath = relative(repositoryRoot, path);
    const [sourceArea, sourceApp] = sourcePath.split(sep);
    const clientImportAllowlist =
      sourceArea === "apps"
        ? clientWorkspaceImportAllowlist.get(sourceApp)
        : undefined;
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
        sourceArea === "apps" &&
        sourceApp === "miniapp" &&
        (specifier === "@daily-energy/api-client/admin" ||
          specifier.startsWith("@daily-energy/api-client/admin/"))
      ) {
        errors.push(
          `WORKSPACE_MINIAPP_ADMIN_IMPORT: ${sourcePath} -> ${specifier}`,
        );
      } else if (
        clientImportAllowlist !== undefined &&
        specifier.startsWith("@daily-energy/") &&
        !clientImportAllowlist.has(specifier)
      ) {
        errors.push(
          `${
            sourceApp === "miniapp"
              ? "WORKSPACE_CLIENT_IMPORT"
              : "WORKSPACE_ADMIN_IMPORT"
          }: ${sourcePath} -> ${specifier}`,
        );
      }

      if (
        sourcePath.startsWith(`apps${sep}miniapp${sep}`) &&
        (specifier.startsWith("node:") ||
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
        (specifier === "@prisma/client" ||
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
