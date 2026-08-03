#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  scanArtifactContent,
  validateAiCorpus,
  validateFixtureCatalog,
  validatePendingEvidenceTemplates,
  validateRunnerRegistry,
  validateRunnerPolicy,
} from "./policy-gates.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "dist",
  "node_modules",
  "output",
  "test-results",
]);
const sourceExtension = /\.(?:c|m)?(?:j|t)sx?$/u;
const testFile =
  /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/u;
const focusedOrSkipped = /\b(?:describe|it|test)\.(?:only|skip|todo)\s*\(/gu;
const testHelperImport =
  /(?:from\s+|import\s*)["'][^"']*(?:\/testing|tests\/)[^"']*["']/gu;

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.resolve(repositoryRoot, relativePath), "utf8"),
  );
}

async function walk(directory, visitor) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const entryPath = path.resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath, visitor);
    } else {
      await visitor(entryPath);
    }
  }
}

export function findTestPolicyDiagnostics(files) {
  const diagnostics = [];
  for (const file of files) {
    if (testFile.test(file.path)) {
      for (const match of file.content.matchAll(focusedOrSkipped)) {
        diagnostics.push(
          `TEST_POLICY_FOCUSED_OR_SKIPPED:${file.path}:${match[0].trim()}`,
        );
      }
    } else if (/^(?:apps|packages)\/[^/]+\/src\//u.test(file.path)) {
      for (const match of file.content.matchAll(testHelperImport)) {
        diagnostics.push(
          `TEST_POLICY_PRODUCTION_IMPORT:${file.path}:${match[0]}`,
        );
      }
    }
  }
  return diagnostics.sort((left, right) => left.localeCompare(right));
}

export async function checkTestPolicy() {
  const [
    runnerPolicy,
    runnerRegistry,
    quarantines,
    fixtureCatalog,
    artifactPolicy,
    corpus,
    manualRc,
    aiEvaluation,
  ] = await Promise.all([
    readJson("tests/registry/runner-policy.json"),
    readJson("tests/registry/runners.json"),
    readJson("tests/registry/quarantine.json"),
    readJson("tests/fixtures/catalog.json"),
    readJson("tests/artifacts/policy.json"),
    readJson("docs/ai/evaluation-corpus.json"),
    readJson("tests/manual-rc/evidence-template.json"),
    readJson("tests/ai-evaluation/evidence-template.json"),
  ]);

  validateRunnerPolicy(runnerPolicy, quarantines, new Date().toISOString());
  const runnerResult = validateRunnerRegistry(runnerRegistry);
  validateFixtureCatalog(fixtureCatalog);
  validateAiCorpus(corpus);
  validatePendingEvidenceTemplates(manualRc, aiEvaluation);
  const policyDiagnostics = scanArtifactContent(
    {
      artifact_version: artifactPolicy.policy_version,
      fixture_version: fixtureCatalog.factory_version,
      result: "PASS",
      source_ids: ["S31-TEST-047"],
    },
    artifactPolicy,
  );
  const files = [];
  for (const root of ["apps", "packages", "tests", "tooling"]) {
    await walk(path.resolve(repositoryRoot, root), async (filePath) => {
      if (!sourceExtension.test(filePath)) {
        return;
      }
      files.push({
        content: await readFile(filePath, "utf8"),
        path: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
      });
    });
  }
  const diagnostics = [
    ...policyDiagnostics,
    ...findTestPolicyDiagnostics(files),
  ];
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.join("\n"));
  }
  return Object.freeze({
    files: files.length,
    quarantines: 0,
    runners: runnerResult.runners,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await checkTestPolicy();
  console.log(
    `TEST_POLICY_OK:files=${result.files}:runners=${result.runners}:quarantines=${result.quarantines}`,
  );
}
