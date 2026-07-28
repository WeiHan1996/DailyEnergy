import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, rm, rmdir } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const sourceDirectory = resolve(repositoryRoot, "apps/api/src");
const typeErrorTarget = resolve(
  sourceDirectory,
  "__e002-typecheck-known-fail.ts",
);
const excludedSourceTarget = resolve(
  repositoryRoot,
  "apps/api/__e002-typecheck-excluded-source.ts",
);
const typeErrorFixture = resolve(
  repositoryRoot,
  "tests/typecheck/fixtures/non-shared-workspace-error.ts",
);
const excludedSourceFixture = resolve(
  repositoryRoot,
  "tests/typecheck/fixtures/excluded-workspace-source.ts",
);
const pnpmCli = process.env.npm_execpath;
let sourceDirectoryExisted = true;

try {
  await access(sourceDirectory);
} catch {
  sourceDirectoryExisted = false;
}

if (!pnpmCli) {
  throw new Error("TYPECHECK_FIXTURE_RUNNER: npm_execpath is required");
}

async function assertTargetDoesNotExist(target) {
  try {
    await access(target);
    throw new Error(`TYPECHECK_FIXTURE_TARGET_EXISTS: ${target}`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function runRootTypecheck() {
  return spawnSync(process.execPath, [pnpmCli, "run", "typecheck"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
  });
}

await assertTargetDoesNotExist(typeErrorTarget);
await assertTargetDoesNotExist(excludedSourceTarget);

try {
  await mkdir(sourceDirectory, { recursive: true });
  await copyFile(typeErrorFixture, typeErrorTarget);
  const result = runRootTypecheck();
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (
    result.status === 0 ||
    !output.includes("__e002-typecheck-known-fail.ts") ||
    !/\berror TS2322:/u.test(output)
  ) {
    process.stderr.write(output);
    console.error(
      "TYPECHECK_FIXTURE_MISSED: root pnpm typecheck must reject a non-shared workspace type error",
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Typecheck fixture Gate passed: root pnpm typecheck rejected a non-shared workspace TS2322 error.",
    );
  }
} finally {
  await rm(typeErrorTarget, { force: true });
}

try {
  await copyFile(excludedSourceFixture, excludedSourceTarget);
  const result = runRootTypecheck();
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (
    result.status === 0 ||
    !output.includes("__e002-typecheck-excluded-source.ts") ||
    !output.includes("TYPECHECK_SOURCE_EXCLUDED")
  ) {
    process.stderr.write(output);
    console.error(
      "TYPECHECK_FIXTURE_MISSED: root pnpm typecheck must reject a workspace whose tsconfig excludes existing TypeScript source",
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Typecheck fixture Gate passed: root pnpm typecheck rejected a workspace whose tsconfig excluded existing TypeScript source.",
    );
  }
} finally {
  await rm(excludedSourceTarget, { force: true });
  if (!sourceDirectoryExisted) {
    try {
      await rmdir(sourceDirectory);
    } catch (error) {
      if (error?.code !== "ENOTEMPTY" && error?.code !== "ENOENT") {
        console.error(
          `TYPECHECK_FIXTURE_CLEANUP: failed to remove ${sourceDirectory}`,
          error,
        );
        process.exitCode = 1;
      }
    }
  }
}
