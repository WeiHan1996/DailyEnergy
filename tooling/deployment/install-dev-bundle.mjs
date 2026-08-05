#!/usr/bin/env node
import { constants } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { verifyDevelopmentBundle } from "./deployment-bundle.mjs";
import {
  validateManifestImageSet,
  validateManifestRuntimeEvidence,
} from "./image-set.mjs";
import { materializeDevelopmentRelease } from "./materialize-dev-release.mjs";
import { createCosConfigEvidence } from "./preflight.mjs";
import {
  canonicalReleaseManifest,
  releaseManifestDigest,
  validateReleaseManifest,
} from "./release-contract.mjs";
import {
  loadReleaseManifest,
  readReleaseState,
  withReleaseLock,
} from "./release-state.mjs";

const DEVELOPMENT_ROOT = "/srv/dailyenergy";
const OBJECT_CONFIG_NAME = "dev-cos-config-v1.env";

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

async function parseJson(file, code) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail(code, path.basename(file));
  }
}

async function metadata(file, code) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(code, path.basename(file));
    }
    throw error;
  }
}

async function assertProtectedDirectory(
  directory,
  { exactMode = null, expectedGid, expectedUid },
) {
  const value = await metadata(
    directory,
    "DEV_BUNDLE_INSTALL_DIRECTORY_MISSING",
  );
  const mode = value.mode & 0o777;
  if (
    !value.isDirectory() ||
    value.isSymbolicLink() ||
    value.uid !== expectedUid ||
    value.gid !== expectedGid ||
    (exactMode === null ? (mode & 0o022) !== 0 : mode !== exactMode)
  ) {
    fail("DEV_BUNDLE_INSTALL_DIRECTORY_PROTECTION", path.basename(directory));
  }
}

async function assertProtectedFile(file, { expectedGid, expectedUid }) {
  const value = await metadata(file, "DEV_BUNDLE_INSTALL_FILE_MISSING");
  if (
    !value.isFile() ||
    value.isSymbolicLink() ||
    value.nlink !== 1 ||
    value.uid !== expectedUid ||
    value.gid !== expectedGid ||
    (value.mode & 0o777) !== 0o600
  ) {
    fail("DEV_BUNDLE_INSTALL_FILE_PROTECTION", path.basename(file));
  }
}

async function bundleFileList(directory) {
  const manifest = await parseJson(
    path.join(directory, "bundle-manifest.json"),
    "DEV_BUNDLE_INSTALL_MANIFEST_INVALID",
  );
  return ["bundle-manifest.json", ...manifest.files.map((entry) => entry.path)];
}

async function copyProtectedFile(source, destination) {
  await mkdir(path.dirname(destination), { mode: 0o700, recursive: true });
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  await chmod(destination, 0o600);
}

async function protectDirectories(root, files) {
  const directories = new Set([root]);
  for (const file of files) {
    let current = path.dirname(path.join(root, file));
    while (current.startsWith(`${root}${path.sep}`)) {
      directories.add(current);
      current = path.dirname(current);
    }
  }
  await Promise.all(
    [...directories].map((directory) => chmod(directory, 0o700)),
  );
}

async function assertInstalledTree(directory, files, protection) {
  const directories = new Set([directory]);
  for (const file of files) {
    await assertProtectedFile(path.join(directory, file), protection);
    let current = path.dirname(path.join(directory, file));
    while (current.startsWith(`${directory}${path.sep}`)) {
      directories.add(current);
      current = path.dirname(current);
    }
  }
  await Promise.all(
    [...directories].map((entry) =>
      assertProtectedDirectory(entry, { ...protection, exactMode: 0o700 }),
    ),
  );
}

async function publicationEvidence(directory) {
  return Promise.all(
    [
      "dev-image-set.json",
      "dev-runtime-evidence.json",
      "dev-supply-evidence.json",
    ].map((file) =>
      parseJson(
        path.join(directory, "evidence", file),
        "DEV_BUNDLE_INSTALL_EVIDENCE_INVALID",
      ),
    ),
  );
}

function validateInstalledManifest(
  manifest,
  { imageSet, objectConfigSource, runtimeEvidence },
) {
  validateReleaseManifest(manifest);
  validateManifestImageSet(manifest, imageSet);
  validateManifestRuntimeEvidence(manifest, imageSet, runtimeEvidence);
  if (
    manifest.config.runtime_fingerprints.object_config !==
    createCosConfigEvidence(objectConfigSource).config_sha256
  ) {
    fail("DEV_BUNDLE_INSTALL_OBJECT_CONFIG_DRIFT", manifest.release_id);
  }
  return manifest;
}

async function validateInstalledBundle(
  directory,
  { expectedGid, expectedUid, objectConfigSource },
) {
  const verified = await verifyDevelopmentBundle(directory, {
    materialized: true,
  });
  const files = [...(await bundleFileList(directory)), "release-manifest.json"];
  await assertInstalledTree(directory, files, { expectedGid, expectedUid });
  const [imageSet, runtimeEvidence] = await publicationEvidence(directory);
  const manifest = validateInstalledManifest(
    await parseJson(
      path.join(directory, "release-manifest.json"),
      "DEV_BUNDLE_INSTALL_RELEASE_MANIFEST_INVALID",
    ),
    { imageSet, objectConfigSource, runtimeEvidence },
  );
  return Object.freeze({
    generation: manifest.compatibility.generation,
    manifest_sha256: releaseManifestDigest(manifest),
    release_id: verified.release_id,
  });
}

export async function installDevelopmentBundle(
  sourceDirectory,
  { developmentRoot = DEVELOPMENT_ROOT, expectedGid = 0, expectedUid = 0 } = {},
) {
  const source = path.resolve(sourceDirectory);
  const root = path.resolve(developmentRoot);
  if (root === path.parse(root).root) {
    fail("DEV_BUNDLE_INSTALL_ROOT_INVALID", "filesystem-root");
  }
  const sourceEvidence = await verifyDevelopmentBundle(source);
  const bundlesRoot = path.join(root, "bundles");
  if (source === root || source.startsWith(`${bundlesRoot}${path.sep}`)) {
    fail("DEV_BUNDLE_INSTALL_SOURCE_INVALID", "managed-root");
  }
  await mkdir(root, { mode: 0o700, recursive: true });
  await assertProtectedDirectory(root, { expectedGid, expectedUid });
  try {
    await mkdir(bundlesRoot, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }
  await assertProtectedDirectory(bundlesRoot, {
    exactMode: 0o700,
    expectedGid,
    expectedUid,
  });

  const objectConfigFile = path.join(root, "config", OBJECT_CONFIG_NAME);
  await assertProtectedFile(objectConfigFile, { expectedGid, expectedUid });
  const objectConfigSource = await readFile(objectConfigFile, "utf8");
  const destination = path.join(bundlesRoot, sourceEvidence.release_id);
  const stateRoot = path.join(root, "deployment");
  try {
    await mkdir(stateRoot, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }
  await assertProtectedDirectory(stateRoot, {
    exactMode: 0o700,
    expectedGid,
    expectedUid,
  });

  return withReleaseLock(
    stateRoot,
    `install:${sourceEvidence.release_id}`,
    async () => {
      try {
        await lstat(destination);
        const installed = await validateInstalledBundle(destination, {
          expectedGid,
          expectedUid,
          objectConfigSource,
        });
        return Object.freeze({
          ...installed,
          installed: false,
          path: destination,
        });
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }

      const state = await readReleaseState(stateRoot);
      const currentManifest =
        state === null
          ? null
          : await loadReleaseManifest(stateRoot, state.current);
      const [imageSet, runtimeEvidence, supplyEvidence] =
        await publicationEvidence(source);
      let releaseManifest;
      if (currentManifest?.release_id === sourceEvidence.release_id) {
        releaseManifest = validateInstalledManifest(currentManifest, {
          imageSet,
          objectConfigSource,
          runtimeEvidence,
        });
      } else {
        releaseManifest = materializeDevelopmentRelease({
          currentManifest,
          imageSet,
          objectConfigSource,
          runtimeEvidence,
          supplyEvidence,
        });
      }
      const sourceFiles = await bundleFileList(source);
      const stage = path.join(
        bundlesRoot,
        `.install-${sourceEvidence.release_id}-${randomUUID()}`,
      );
      await mkdir(stage, { mode: 0o700 });
      let renamed = false;
      try {
        for (const file of sourceFiles) {
          await copyProtectedFile(
            path.join(source, file),
            path.join(stage, file),
          );
        }
        await writeFile(
          path.join(stage, "release-manifest.json"),
          canonicalReleaseManifest(releaseManifest),
          { flag: "wx", mode: 0o600 },
        );
        const installedFiles = [...sourceFiles, "release-manifest.json"];
        await protectDirectories(stage, installedFiles);
        await verifyDevelopmentBundle(stage, { materialized: true });
        await assertInstalledTree(stage, installedFiles, {
          expectedGid,
          expectedUid,
        });
        try {
          await rename(stage, destination);
          renamed = true;
        } catch (error) {
          if (!["EEXIST", "ENOTEMPTY"].includes(error?.code)) {
            throw error;
          }
        }
      } finally {
        if (!renamed) {
          await rm(stage, { force: true, recursive: true });
        }
      }
      const installed = await validateInstalledBundle(destination, {
        expectedGid,
        expectedUid,
        objectConfigSource,
      });
      return Object.freeze({
        ...installed,
        installed: renamed,
        path: destination,
      });
    },
  );
}

async function main() {
  const [sourceDirectory] = process.argv.slice(2);
  if (!sourceDirectory || process.argv.length !== 3) {
    fail("DEV_BUNDLE_INSTALL_USAGE", "source-bundle-directory");
  }
  if (typeof process.getuid !== "function" || process.getuid() !== 0) {
    fail("DEV_BUNDLE_INSTALL_OWNER", "root-required");
  }
  const result = await installDevelopmentBundle(sourceDirectory);
  process.stdout.write(
    `DEV_BUNDLE_INSTALL_OK:id=${result.release_id}:generation=${result.generation}:installed=${result.installed}\n`,
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
