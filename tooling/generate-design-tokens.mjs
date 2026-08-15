import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  buildDesignTokenArtifacts,
  designTokenArtifactDiagnostic,
} from "./lib/design-token-codegen.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const sourcePath = resolve(repositoryRoot, "apps/miniapp/design-tokens.json");
const mode = process.argv[2];

if (!["--check", "--write"].includes(mode)) {
  throw new Error("DESIGN_TOKEN_CODEGEN_USAGE: expected --check or --write");
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = await buildDesignTokenArtifacts(source);
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
    const diagnostic = designTokenArtifactDiagnostic(
      relativePath,
      undefined,
      expected,
    );
    diagnostics.push(
      `${diagnostic.ruleId}: ${diagnostic.path}: ${diagnostic.message}`,
    );
    continue;
  }
  const diagnostic = designTokenArtifactDiagnostic(
    relativePath,
    await readFile(path, "utf8"),
    expected,
  );
  if (diagnostic !== undefined) {
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
    `Generated ${result.artifacts.size} design-token artifacts (${result.fingerprint}).`,
  );
} else {
  console.log(
    `Design-token drift Gate passed ${result.artifacts.size} artifacts (${result.fingerprint}).`,
  );
}
