import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  buildContractArtifacts,
  generatedArtifactDiagnostic,
} from "./lib/contract-codegen.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const mode = process.argv[2];

if (!["--check", "--write"].includes(mode)) {
  throw new Error("CONTRACT_CODEGEN_USAGE: expected --check or --write");
}

const build = spawnSync(
  process.execPath,
  [
    resolve(repositoryRoot, "node_modules/typescript/bin/tsc"),
    "-p",
    resolve(repositoryRoot, "packages/shared-schemas/tsconfig.json"),
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
  },
);
if (build.status !== 0) {
  process.stderr.write(`${build.stdout ?? ""}${build.stderr ?? ""}`);
  throw new Error("CONTRACT_CODEGEN_SCHEMA_BUILD_FAILED");
}

const result = await buildContractArtifacts(repositoryRoot);
const diagnostics = [];

for (const [relativePath, expected] of result.artifacts) {
  const path = resolve(repositoryRoot, relativePath);
  if (mode === "--write") {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, expected, "utf8");
    continue;
  }
  try {
    await access(path);
  } catch {
    const diagnostic = generatedArtifactDiagnostic(
      relativePath,
      undefined,
      expected,
    );
    diagnostics.push(
      `${diagnostic.ruleId}: ${diagnostic.path}: ${diagnostic.message}`,
    );
    continue;
  }
  const actual = await readFile(path, "utf8");
  const diagnostic = generatedArtifactDiagnostic(
    relativePath,
    actual,
    expected,
  );
  if (diagnostic) {
    diagnostics.push(
      `${diagnostic.ruleId}: ${diagnostic.path}: ${diagnostic.message}`,
    );
  }
}

if (diagnostics.length > 0) {
  console.error(diagnostics.join("\n"));
  process.exitCode = 1;
} else if (mode === "--write") {
  console.log(
    `Generated ${result.artifacts.size} contract artifacts (${result.contractSourceFingerprint}).`,
  );
} else {
  console.log(
    `Contract codegen drift Gate passed ${result.artifacts.size} generated artifacts (${result.contractSourceFingerprint}).`,
  );
}
