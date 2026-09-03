#!/usr/bin/env node
import { constants } from "node:fs";
import {
  chmod,
  chown,
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

import {
  DEVELOPMENT_BUNDLE_VERSION,
  verifyDevelopmentBundle,
} from "./deployment-bundle.mjs";
import {
  validateManifestImageSet,
  validateManifestRuntimeEvidence,
} from "./image-set.mjs";
import {
  developmentReleaseId,
  materializeDevelopmentRelease,
  validateDevelopmentReleaseSelection,
} from "./materialize-dev-release.mjs";
import { createCosConfigEvidence } from "./preflight.mjs";
import {
  canonicalReleaseManifest,
  DEVELOPMENT_LITE_OBJECT_FINGERPRINT,
  RELEASE_MANIFEST_VERSION_V2,
  releaseManifestDigest,
  validateReleaseManifest,
} from "./release-contract.mjs";
import {
  loadCatalogManifest,
  loadReleaseManifest,
  readReleaseState,
  withReleaseLock,
} from "./release-state.mjs";

const DEVELOPMENT_ROOT = "/srv/dailyenergy";

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

async function copyProtectedFile(
  source,
  destination,
  { expectedGid, expectedUid },
) {
  await mkdir(path.dirname(destination), { mode: 0o700, recursive: true });
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  await chown(destination, expectedUid, expectedGid);
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
  { imageSet, objectConfigSource, runtimeEvidence, selection },
) {
  validateReleaseManifest(manifest);
  validateManifestImageSet(manifest, imageSet);
  validateManifestRuntimeEvidence(manifest, imageSet, runtimeEvidence);
  const developmentLite =
    manifest.manifest_version === RELEASE_MANIFEST_VERSION_V2;
  const objectConfigFingerprint = developmentLite
    ? DEVELOPMENT_LITE_OBJECT_FINGERPRINT
    : createCosConfigEvidence(objectConfigSource).config_sha256;
  if (
    manifest.config.runtime_fingerprints.object_config !==
    objectConfigFingerprint
  ) {
    fail("DEV_BUNDLE_INSTALL_OBJECT_CONFIG_DRIFT", manifest.release_id);
  }
  const selectionDrift = developmentLite
    ? selection.deployment_profile !== "DEV_LITE" ||
      objectConfigSource !== undefined ||
      Object.hasOwn(manifest.topology, "object_config_ref") ||
      Object.hasOwn(manifest.config.secret_ref_versions, "cos_secret_id") ||
      Object.hasOwn(manifest.config.secret_ref_versions, "cos_secret_key") ||
      Object.values(manifest.config.secret_ref_versions).some(
        (version) => version !== selection.database_secret_version,
      )
    : manifest.topology.object_config_ref !== selection.object_config_ref ||
      manifest.config.secret_ref_versions.cos_secret_id !==
        selection.cos_secret_version ||
      manifest.config.secret_ref_versions.cos_secret_key !==
        selection.cos_secret_version ||
      Object.entries(manifest.config.secret_ref_versions).some(
        ([name, version]) =>
          !["cos_secret_id", "cos_secret_key"].includes(name) &&
          version !== selection.database_secret_version,
      );
  if (selectionDrift) {
    fail("DEV_BUNDLE_INSTALL_SELECTION_DRIFT", manifest.release_id);
  }
  return manifest;
}

async function validateInstalledBundle(
  directory,
  { expectedGid, expectedUid, objectConfigSource, selection },
) {
  const verified = await verifyDevelopmentBundle(directory, {
    materialized: true,
    requiredBundleVersion:
      selection.deployment_profile === "DEV_LITE"
        ? DEVELOPMENT_BUNDLE_VERSION
        : null,
  });
  const files = [...(await bundleFileList(directory)), "release-manifest.json"];
  await assertInstalledTree(directory, files, { expectedGid, expectedUid });
  const [imageSet, runtimeEvidence] = await publicationEvidence(directory);
  const manifest = validateInstalledManifest(
    await parseJson(
      path.join(directory, "release-manifest.json"),
      "DEV_BUNDLE_INSTALL_RELEASE_MANIFEST_INVALID",
    ),
    { imageSet, objectConfigSource, runtimeEvidence, selection },
  );
  return Object.freeze({
    generation: manifest.compatibility.generation,
    manifest_sha256: releaseManifestDigest(manifest),
    release_id: verified.release_id,
  });
}

export async function installDevelopmentBundle(
  sourceDirectory,
  {
    developmentRoot = DEVELOPMENT_ROOT,
    expectedGid = 0,
    expectedUid = 0,
    selection,
  } = {},
) {
  const selected = validateDevelopmentReleaseSelection(selection);
  const developmentLite = selected.deployment_profile === "DEV_LITE";
  const source = path.resolve(sourceDirectory);
  const root = path.resolve(developmentRoot);
  if (root === path.parse(root).root) {
    fail("DEV_BUNDLE_INSTALL_ROOT_INVALID", "filesystem-root");
  }
  await verifyDevelopmentBundle(source, {
    requiredBundleVersion: developmentLite ? DEVELOPMENT_BUNDLE_VERSION : null,
  });
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

  let objectConfigSource;
  if (!developmentLite) {
    const objectConfigFile = path.join(
      root,
      "config",
      `${selected.object_config_ref}.env`,
    );
    await assertProtectedFile(objectConfigFile, { expectedGid, expectedUid });
    objectConfigSource = await readFile(objectConfigFile, "utf8");
  }
  const [imageSet, runtimeEvidence, supplyEvidence] =
    await publicationEvidence(source);
  const releaseId = developmentReleaseId({
    imageSet,
    ...(developmentLite
      ? {}
      : {
          objectConfigSha256:
            createCosConfigEvidence(objectConfigSource).config_sha256,
        }),
    selection: selected,
  });
  const destination = path.join(bundlesRoot, releaseId);
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

  return withReleaseLock(stateRoot, `install:${releaseId}`, async () => {
    try {
      await lstat(destination);
      const installed = await validateInstalledBundle(destination, {
        expectedGid,
        expectedUid,
        objectConfigSource,
        selection: selected,
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
    const catalogManifest =
      state === null
        ? null
        : await loadCatalogManifest(stateRoot, state.catalog);
    let releaseManifest;
    if (currentManifest?.release_id === releaseId) {
      releaseManifest = validateInstalledManifest(currentManifest, {
        imageSet,
        objectConfigSource,
        runtimeEvidence,
        selection: selected,
      });
    } else {
      releaseManifest = materializeDevelopmentRelease({
        catalogManifest,
        currentManifest,
        imageSet,
        ...(developmentLite ? {} : { objectConfigSource }),
        runtimeEvidence,
        selection: selected,
        supplyEvidence,
      });
    }
    const sourceFiles = await bundleFileList(source);
    const stage = path.join(
      bundlesRoot,
      `.install-${releaseId}-${randomUUID()}`,
    );
    await mkdir(stage, { mode: 0o700 });
    let renamed = false;
    try {
      for (const file of sourceFiles) {
        await copyProtectedFile(
          path.join(source, file),
          path.join(stage, file),
          { expectedGid, expectedUid },
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
      selection: selected,
    });
    return Object.freeze({
      ...installed,
      installed: renamed,
      path: destination,
    });
  });
}

async function main() {
  if (process.argv[2] === "--dev-lite") {
    const [sourceDirectory, databaseSecretVersion] = process.argv.slice(3);
    if (
      !sourceDirectory ||
      !databaseSecretVersion ||
      process.argv.length !== 5
    ) {
      fail(
        "DEV_LITE_BUNDLE_INSTALL_USAGE",
        "--dev-lite source-bundle-directory database-secret-version",
      );
    }
    if (typeof process.getuid !== "function" || process.getuid() !== 0) {
      fail("DEV_BUNDLE_INSTALL_OWNER", "root-required");
    }
    const result = await installDevelopmentBundle(sourceDirectory, {
      selection: {
        database_secret_version: databaseSecretVersion,
        deployment_profile: "DEV_LITE",
      },
    });
    process.stdout.write(
      `DEV_BUNDLE_INSTALL_OK:id=${result.release_id}:generation=${result.generation}:deployment_profile=DEV_LITE:installed=${result.installed}\n`,
    );
    return;
  }
  const [
    sourceDirectory,
    databaseSecretVersion,
    cosSecretVersion,
    objectConfigRef,
  ] = process.argv.slice(2);
  if (!sourceDirectory || process.argv.length !== 6) {
    fail(
      "DEV_BUNDLE_INSTALL_USAGE",
      "source-bundle-directory database-secret-version cos-secret-version object-config-ref",
    );
  }
  if (typeof process.getuid !== "function" || process.getuid() !== 0) {
    fail("DEV_BUNDLE_INSTALL_OWNER", "root-required");
  }
  const result = await installDevelopmentBundle(sourceDirectory, {
    selection: {
      cos_secret_version: cosSecretVersion,
      database_secret_version: databaseSecretVersion,
      object_config_ref: objectConfigRef,
    },
  });
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
