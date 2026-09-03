#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  validateDevPublicationEvidence,
  validateManifestImageSet,
  validateManifestRuntimeEvidence,
} from "./image-set.mjs";
import { validateReleaseManifest } from "./release-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
export const DEVELOPMENT_BUNDLE_VERSION = "DevDeploymentBundleV3";
const SUPPORTED_BUNDLE_VERSIONS = new Set([
  "DevDeploymentBundleV2",
  DEVELOPMENT_BUNDLE_VERSION,
]);
const staticFiles = Object.freeze([
  "compose.yaml",
  "docker/compose.dev-lite.yaml",
  "docker/compose.dev.yaml",
  "tooling/deployment/deployment-bundle.mjs",
  "tooling/deployment/deploy-dev.mjs",
  "tooling/deployment/dev-lite-runtime-check.mjs",
  "tooling/deployment/image-set.mjs",
  "tooling/deployment/install-dev-bundle.mjs",
  "tooling/deployment/materialize-dev-release.mjs",
  "tooling/deployment/preflight.mjs",
  "tooling/deployment/provision-dev-secrets.mjs",
  "tooling/deployment/release-contract.mjs",
  "tooling/deployment/release-state.mjs",
  "tooling/deployment/runtime-evidence.mjs",
  "tooling/deployment/supply-evidence.mjs",
]);
const evidenceFiles = Object.freeze({
  "evidence/dev-image-set.json": "dev-image-set.json",
  "evidence/dev-runtime-evidence.json": "dev-runtime-evidence.json",
  "evidence/dev-supply-evidence.json": "dev-supply-evidence.json",
});

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function regularFile(file, code) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    fail(code, path.basename(file));
  }
  return metadata;
}

async function copyBounded(source, destination) {
  await regularFile(source, "DEV_BUNDLE_SOURCE_INVALID");
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await copyFile(source, destination, 0);
  const contents = await readFile(destination);
  await chmod(destination, 0o600);
  return {
    bytes: contents.length,
    path: destination,
    sha256: sha256(contents),
  };
}

async function walkFiles(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(path.join(directory, prefix), {
    withFileTypes: true,
  })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walkFiles(directory, relative)));
    } else if (entry.isFile()) {
      result.push(relative);
    } else {
      fail("DEV_BUNDLE_ENTRY_INVALID", relative);
    }
  }
  return result.sort();
}

export async function verifyDevelopmentBundle(
  directory,
  { materialized = false, requiredBundleVersion = null } = {},
) {
  const manifestFile = path.join(directory, "bundle-manifest.json");
  await regularFile(manifestFile, "DEV_BUNDLE_MANIFEST_INVALID");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch {
    fail("DEV_BUNDLE_MANIFEST_INVALID", "json");
  }
  if (
    !SUPPORTED_BUNDLE_VERSIONS.has(manifest.bundle_version) ||
    manifest.production_eligible !== false ||
    !/^dev-[a-f0-9]{12}-\d{1,20}-\d{1,6}$/u.test(manifest.image_set_id) ||
    !Array.isArray(manifest.files)
  ) {
    fail("DEV_BUNDLE_MANIFEST_INVALID", "document");
  }
  if (
    requiredBundleVersion !== null &&
    manifest.bundle_version !== requiredBundleVersion
  ) {
    fail("DEV_BUNDLE_VERSION_PROFILE_MISMATCH", manifest.bundle_version);
  }
  if (
    manifest.bundle_version === DEVELOPMENT_BUNDLE_VERSION &&
    ![
      "docker/compose.dev-lite.yaml",
      "tooling/deployment/dev-lite-runtime-check.mjs",
    ].every((requiredPath) =>
      manifest.files.some(
        ({ path: relativePath }) => relativePath === requiredPath,
      ),
    )
  ) {
    fail("DEV_BUNDLE_MANIFEST_INVALID", "dev-lite-overlay");
  }
  const actualFiles = await walkFiles(directory);
  const expectedFiles = [
    "bundle-manifest.json",
    ...manifest.files.map((entry) => entry.path),
    ...(materialized ? ["release-manifest.json"] : []),
  ].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail("DEV_BUNDLE_FILE_SET_DRIFT", "paths");
  }
  for (const entry of manifest.files) {
    if (
      !/^[a-f0-9]{64}$/u.test(entry.sha256) ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes < 1 ||
      path.posix.normalize(entry.path) !== entry.path ||
      path.isAbsolute(entry.path) ||
      entry.path.split("/").includes("..")
    ) {
      fail("DEV_BUNDLE_FILE_ENTRY_INVALID", entry.path ?? "missing");
    }
    const file = path.join(directory, entry.path);
    await regularFile(file, "DEV_BUNDLE_FILE_INVALID");
    const contents = await readFile(file);
    if (contents.length !== entry.bytes || sha256(contents) !== entry.sha256) {
      fail("DEV_BUNDLE_FILE_DIGEST_DRIFT", entry.path);
    }
  }
  const [imageSet, runtimeEvidence, supplyEvidence] = await Promise.all(
    [
      "evidence/dev-image-set.json",
      "evidence/dev-runtime-evidence.json",
      "evidence/dev-supply-evidence.json",
    ].map(async (relative) =>
      JSON.parse(await readFile(path.join(directory, relative), "utf8")),
    ),
  );
  validateDevPublicationEvidence(imageSet, supplyEvidence, runtimeEvidence);
  if (manifest.image_set_id !== imageSet.image_set_id) {
    fail("DEV_BUNDLE_IMAGE_SET_BINDING", manifest.image_set_id);
  }
  let releaseId = null;
  if (materialized) {
    let releaseManifest;
    try {
      releaseManifest = JSON.parse(
        await readFile(path.join(directory, "release-manifest.json"), "utf8"),
      );
    } catch {
      fail("DEV_BUNDLE_RELEASE_MANIFEST_INVALID", "json");
    }
    validateReleaseManifest(releaseManifest);
    validateManifestImageSet(releaseManifest, imageSet);
    validateManifestRuntimeEvidence(releaseManifest, imageSet, runtimeEvidence);
    releaseId = releaseManifest.release_id;
  }
  return Object.freeze({
    files: manifest.files.length,
    image_set_id: manifest.image_set_id,
    materialized,
    release_id: releaseId,
  });
}

export async function buildDevelopmentBundle(destination, evidenceDirectory) {
  if (
    path.resolve(destination) === path.parse(path.resolve(destination)).root ||
    path.resolve(destination) === path.resolve(evidenceDirectory)
  ) {
    fail("DEV_BUNDLE_DESTINATION_INVALID", "unsafe");
  }
  await rm(destination, { force: true, recursive: true });
  await mkdir(destination, { mode: 0o700, recursive: true });
  const entries = [];
  for (const relative of staticFiles) {
    const copied = await copyBounded(
      path.join(repositoryRoot, relative),
      path.join(destination, relative),
    );
    entries.push({
      bytes: copied.bytes,
      path: relative,
      sha256: copied.sha256,
    });
  }
  for (const [relative, sourceName] of Object.entries(evidenceFiles)) {
    const copied = await copyBounded(
      path.join(evidenceDirectory, sourceName),
      path.join(destination, relative),
    );
    entries.push({
      bytes: copied.bytes,
      path: relative,
      sha256: copied.sha256,
    });
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  const imageSet = JSON.parse(
    await readFile(
      path.join(destination, "evidence/dev-image-set.json"),
      "utf8",
    ),
  );
  await writeFile(
    path.join(destination, "bundle-manifest.json"),
    `${JSON.stringify(
      {
        bundle_version: DEVELOPMENT_BUNDLE_VERSION,
        files: entries,
        production_eligible: false,
        image_set_id: imageSet.image_set_id,
      },
      null,
      2,
    )}\n`,
    { flag: "wx", mode: 0o600 },
  );
  return verifyDevelopmentBundle(destination);
}

async function main() {
  const [mode, directory, evidenceDirectory] = process.argv.slice(2);
  if (mode === "--verify" && directory && evidenceDirectory === undefined) {
    const result = await verifyDevelopmentBundle(path.resolve(directory));
    process.stdout.write(
      `DEV_DEPLOYMENT_BUNDLE_OK:image_set=${result.image_set_id}:files=${result.files}:production_eligible=false\n`,
    );
    return;
  }
  if (mode === "--build" && directory && evidenceDirectory) {
    const result = await buildDevelopmentBundle(
      path.resolve(directory),
      path.resolve(evidenceDirectory),
    );
    process.stdout.write(
      `DEV_DEPLOYMENT_BUNDLE_OK:image_set=${result.image_set_id}:files=${result.files}:production_eligible=false\n`,
    );
    return;
  }
  fail(
    "DEV_BUNDLE_USAGE",
    "--build destination evidence-directory|--verify directory",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
