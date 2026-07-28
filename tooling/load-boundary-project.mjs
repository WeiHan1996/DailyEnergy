import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "prototype",
]);
const sourceExtensions = /\.(?:c|m)?(?:j|t)sx?$/u;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function walk(root, directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(root, path, files);
    } else if (sourceExtensions.test(path)) {
      files.push({
        content: await readFile(path, "utf8"),
        path: relative(root, path).split(sep).join("/"),
      });
    }
  }
}

export async function loadBoundaryProject(repositoryRoot) {
  const workspaces = [];
  for (const area of ["apps", "packages"]) {
    const areaPath = resolve(repositoryRoot, area);
    for (const entry of await readdir(areaPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const directory = `${area}/${entry.name}`;
      try {
        let tsconfig;
        try {
          tsconfig = await readJson(
            resolve(repositoryRoot, directory, "tsconfig.json"),
          );
        } catch (error) {
          if (error?.code !== "ENOENT") {
            throw error;
          }
        }
        workspaces.push({
          directory,
          manifest: await readJson(
            resolve(repositoryRoot, directory, "package.json"),
          ),
          tsconfig,
        });
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }

  const files = [];
  for (const directory of ["apps", "packages", "tooling", "tests"]) {
    await walk(repositoryRoot, resolve(repositoryRoot, directory), files);
  }

  return {
    files,
    rootManifest: await readJson(resolve(repositoryRoot, "package.json")),
    workspaces,
  };
}
