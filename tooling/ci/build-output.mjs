import { lstat, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

function diagnosticPath(root, target) {
  return path.relative(root, target).replaceAll("\\", "/") || ".";
}

function canonicalKey(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

export function isPathWithin(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

export async function canonicalizeRoot(root) {
  return realpath(root);
}

export async function resolveContainedPath(
  canonicalRoot,
  candidate,
  { detail, outsideRule, unresolvedRule },
) {
  let resolved;
  try {
    resolved = await realpath(candidate);
  } catch {
    throw new Error(`${unresolvedRule}:${detail}`);
  }
  if (!isPathWithin(canonicalRoot, resolved)) {
    throw new Error(`${outsideRule}:${detail}`);
  }
  return resolved;
}

export async function collectBuildOutputFiles(repositoryRoot, buildRoots) {
  const canonicalRepositoryRoot = await canonicalizeRoot(repositoryRoot);
  const files = [];

  async function walk(directory, ancestors = new Set()) {
    const detail = diagnosticPath(repositoryRoot, directory);
    const canonicalDirectory = await resolveContainedPath(
      canonicalRepositoryRoot,
      directory,
      {
        detail,
        outsideRule: "CI_BUILD_OUTPUT_LINK_OUTSIDE_REPOSITORY",
        unresolvedRule: "CI_BUILD_OUTPUT_LINK_INVALID",
      },
    );
    const directoryKey = canonicalKey(canonicalDirectory);
    if (ancestors.has(directoryKey)) {
      throw new Error(`CI_BUILD_OUTPUT_LINK_CYCLE:${detail}`);
    }
    const nextAncestors = new Set(ancestors).add(directoryKey);

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === "cache" && path.basename(directory) === ".next") {
        continue;
      }
      const entryPath = path.resolve(directory, entry.name);
      const entryDetail = diagnosticPath(repositoryRoot, entryPath);
      const entryStatus = await lstat(entryPath);
      if (entry.isSymbolicLink() || entryStatus.isSymbolicLink()) {
        await resolveContainedPath(canonicalRepositoryRoot, entryPath, {
          detail: entryDetail,
          outsideRule: "CI_BUILD_OUTPUT_LINK_OUTSIDE_REPOSITORY",
          unresolvedRule: "CI_BUILD_OUTPUT_LINK_INVALID",
        });
        const targetStatus = await stat(entryPath);
        if (targetStatus.isDirectory()) {
          await walk(entryPath, nextAncestors);
        } else if (targetStatus.isFile()) {
          files.push(entryPath);
        } else {
          throw new Error(`CI_BUILD_OUTPUT_TYPE_PROHIBITED:${entryDetail}`);
        }
      } else if (entry.isDirectory()) {
        await walk(entryPath, nextAncestors);
      } else if (entry.isFile()) {
        files.push(entryPath);
      } else {
        throw new Error(`CI_BUILD_OUTPUT_TYPE_PROHIBITED:${entryDetail}`);
      }
    }
  }

  for (const relativeRoot of buildRoots) {
    const root = path.resolve(repositoryRoot, relativeRoot);
    let rootStatus;
    try {
      rootStatus = await lstat(root);
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      throw error;
    }
    const resolvedStatus = rootStatus.isSymbolicLink()
      ? await stat(root)
      : rootStatus;
    if (!resolvedStatus.isDirectory()) {
      throw new Error(
        `CI_BUILD_OUTPUT_ROOT_INVALID:${diagnosticPath(repositoryRoot, root)}`,
      );
    }
    await walk(root);
  }

  return files.sort((left, right) => left.localeCompare(right));
}
