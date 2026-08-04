#!/usr/bin/env node
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  collectLockfilePackageCoordinates,
  findArtifactDiagnostics,
  validateSupplyChainDocuments,
  verifyDigestManifest,
} from "./policy.mjs";
import { repositoryRoot } from "./runtime.mjs";

const targetArgument = process.argv[2];
if (!targetArgument) {
  throw new Error("CI_ARTIFACT_SCAN_TARGET_MISSING:argument");
}
const artifactRoot = path.resolve(repositoryRoot, ".artifacts/ci");
const target = path.resolve(repositoryRoot, targetArgument);
const relativeTarget = path.relative(artifactRoot, target);
if (
  relativeTarget.startsWith("..") ||
  path.isAbsolute(relativeTarget) ||
  relativeTarget === ""
) {
  throw new Error("CI_ARTIFACT_SCAN_TARGET_OUTSIDE_ROOT:argument");
}

const policy = JSON.parse(
  await readFile(
    path.resolve(repositoryRoot, "tests/artifacts/policy.json"),
    "utf8",
  ),
);
const [ciPolicy, registry, lockfile] = await Promise.all([
  readFile(path.resolve(repositoryRoot, "tests/ci/policy.json"), "utf8").then(
    JSON.parse,
  ),
  readFile(
    path.resolve(repositoryRoot, "tests/registry/coverage-registry.json"),
    "utf8",
  ).then(JSON.parse),
  readFile(path.resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8"),
]);
const lockfilePackageCoordinates = collectLockfilePackageCoordinates(lockfile);
const targetLaneId = relativeTarget.replaceAll("\\", "/");
const lane = ciPolicy.lanes.find(({ id }) => id === targetLaneId);
if (
  targetLaneId !== "supply-chain" &&
  (!lane || lane.execution !== "AUTOMATED_REQUIRED")
) {
  throw new Error(`CI_ARTIFACT_SCHEMA_TARGET_UNKNOWN:${targetLaneId}`);
}
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.resolve(directory, entry.name);
    if (entry.isSymbolicLink() || (await lstat(entryPath)).isSymbolicLink()) {
      throw new Error(`CI_ARTIFACT_SYMLINK_PROHIBITED:${entry.name}`);
    }
    if (entry.isDirectory()) {
      await walk(entryPath);
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
}
await walk(target);
if (files.length === 0) {
  throw new Error("CI_ARTIFACT_SCAN_EMPTY:target");
}

let totalBytes = 0;
const documents = new Map();
for (const filePath of files) {
  if (path.extname(filePath) !== ".json") {
    throw new Error(
      `CI_ARTIFACT_FORMAT_PROHIBITED:${path.relative(target, filePath)}`,
    );
  }
  const contents = await readFile(filePath, "utf8");
  if (path.dirname(filePath) !== target) {
    throw new Error(
      `CI_ARTIFACT_NESTING_PROHIBITED:${path.relative(target, filePath)}`,
    );
  }
  totalBytes += Buffer.byteLength(contents);
  if (totalBytes > 20 * 1024 * 1024) {
    throw new Error("CI_ARTIFACT_TOTAL_SIZE_EXCEEDED:20MiB");
  }
  let document;
  try {
    document = JSON.parse(contents);
  } catch {
    throw new Error(
      `CI_ARTIFACT_JSON_INVALID:${path.relative(target, filePath)}`,
    );
  }
  const artifactName = path.basename(filePath);
  const diagnostics = findArtifactDiagnostics(document, policy, {
    artifactName,
    ciPolicy,
    lane,
    lockfilePackageCoordinates,
    registryVersion: registry.registry_version,
  });
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.join("\n"));
  }
  documents.set(artifactName, document);
}

const expectedNames =
  targetLaneId === "supply-chain"
    ? new Set([
        "build-output-digests.json",
        "provenance.intoto.json",
        "sbom.spdx.json",
        "vulnerability-summary.json",
      ])
    : new Set(["evidence.json"]);
for (const name of documents.keys()) {
  if (!expectedNames.has(name)) {
    throw new Error(`CI_ARTIFACT_BUNDLE_FILE_PROHIBITED:${name}`);
  }
}
if (targetLaneId !== "supply-chain" && documents.size !== 1) {
  throw new Error(`CI_ARTIFACT_BUNDLE_INCOMPLETE:${targetLaneId}`);
}

const digestManifest = documents.get("build-output-digests.json");
const provenance = documents.get("provenance.intoto.json");
const sbom = documents.get("sbom.spdx.json");
if (digestManifest || provenance || sbom) {
  if (!digestManifest || !provenance || !sbom) {
    throw new Error("CI_SUPPLY_CHAIN_EVIDENCE_INCOMPLETE:bundle");
  }
  validateSupplyChainDocuments({ digestManifest, provenance, sbom });
  await verifyDigestManifest(repositoryRoot, digestManifest);
}
console.log(
  `CI_ARTIFACT_SCAN_OK:files=${files.length}:bytes=${totalBytes}:synthetic_only=true`,
);
