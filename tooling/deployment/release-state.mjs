import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  canonicalReleaseManifest,
  releaseManifestDigest,
  validateReleaseManifest,
  validateReleaseTransition,
  validateRollbackTransition,
} from "./release-contract.mjs";

const STATE_VERSION = "e012-release-state-v1";

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function paths(root) {
  const absolute = path.resolve(root);
  return {
    lock: path.join(absolute, "release.lock"),
    releases: path.join(absolute, "releases"),
    root: absolute,
    state: path.join(absolute, "release-state.json"),
  };
}

async function atomicWrite(file, contents, mode = 0o600) {
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, contents, { flag: "wx", mode });
  await rename(temporary, file);
}

function stateReference(manifest, acceptedAtUtc) {
  return {
    accepted_at_utc: acceptedAtUtc,
    manifest_sha256: releaseManifestDigest(manifest),
    release_id: manifest.release_id,
    status: "ACCEPTED",
  };
}

function validateReference(reference, detail) {
  const keys = Object.keys(reference ?? {}).sort();
  if (
    JSON.stringify(keys) !==
      JSON.stringify([
        "accepted_at_utc",
        "manifest_sha256",
        "release_id",
        "status",
      ]) ||
    reference.status !== "ACCEPTED" ||
    !/^[a-f0-9]{64}$/u.test(reference.manifest_sha256) ||
    !/^[a-z0-9][a-z0-9.-]{2,63}$/u.test(reference.release_id) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(
      reference.accepted_at_utc,
    )
  ) {
    fail("RELEASE_STATE_REFERENCE_INVALID", detail);
  }
}

function validateState(value) {
  const keys = Object.keys(value ?? {}).sort();
  if (
    JSON.stringify(keys) !==
      JSON.stringify([
        "current",
        "rollback_target",
        "state_version",
        "updated_at_utc",
      ]) ||
    value.state_version !== STATE_VERSION ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value.updated_at_utc)
  ) {
    fail("RELEASE_STATE_INVALID", "document");
  }
  validateReference(value.current, "current");
  if (value.rollback_target !== null) {
    validateReference(value.rollback_target, "rollback_target");
    if (value.rollback_target.release_id === value.current.release_id) {
      fail("RELEASE_STATE_TARGET_DUPLICATE", value.current.release_id);
    }
  }
  return value;
}

export async function withReleaseLock(root, owner, operation) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(owner)) {
    fail("RELEASE_LOCK_OWNER_INVALID", "owner");
  }
  const selected = paths(root);
  await mkdir(selected.root, { recursive: true, mode: 0o700 });
  let handle;
  const token = randomUUID();
  try {
    handle = await open(selected.lock, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      fail("RELEASE_LOCK_HELD", path.basename(selected.lock));
    }
    throw error;
  }
  await handle.writeFile(
    `${JSON.stringify({
      acquired_at_utc: new Date().toISOString(),
      owner,
      token,
    })}\n`,
  );
  try {
    return await operation();
  } finally {
    await handle.close();
    const lock = JSON.parse(await readFile(selected.lock, "utf8"));
    if (lock.token !== token) {
      fail("RELEASE_LOCK_OWNERSHIP_LOST", owner);
    }
    await rm(selected.lock);
  }
}

export async function readReleaseState(root) {
  try {
    return validateState(JSON.parse(await readFile(paths(root).state, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      fail("RELEASE_STATE_INVALID", "json");
    }
    throw error;
  }
}

async function persistManifest(root, manifest) {
  validateReleaseManifest(manifest);
  const selected = paths(root);
  const directory = path.join(selected.releases, manifest.release_id);
  const file = path.join(directory, "release-manifest.json");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const contents = canonicalReleaseManifest(manifest);
  try {
    const existing = await readFile(file, "utf8");
    if (existing !== contents) {
      fail("RELEASE_ID_CONTENT_DRIFT", manifest.release_id);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    await atomicWrite(file, contents);
  }
  return file;
}

export async function loadReleaseManifest(root, reference) {
  validateReference(reference, "load");
  const file = path.join(
    paths(root).releases,
    reference.release_id,
    "release-manifest.json",
  );
  const manifest = JSON.parse(await readFile(file, "utf8"));
  validateReleaseManifest(manifest);
  if (releaseManifestDigest(manifest) !== reference.manifest_sha256) {
    fail("RELEASE_STATE_MANIFEST_DIGEST_MISMATCH", reference.release_id);
  }
  return manifest;
}

export async function commitSuccessfulDeployment(
  root,
  manifest,
  { acceptedAtUtc = new Date().toISOString() } = {},
) {
  validateReleaseManifest(manifest);
  const selected = paths(root);
  await mkdir(selected.root, { recursive: true, mode: 0o700 });
  const state = await readReleaseState(root);
  if (state !== null) {
    const current = await loadReleaseManifest(root, state.current);
    const transition = validateReleaseTransition(current, manifest);
    if (transition.idempotent) {
      return { idempotent: true, state };
    }
  }
  await persistManifest(root, manifest);
  const next = {
    current: stateReference(manifest, acceptedAtUtc),
    rollback_target: state?.current ?? null,
    state_version: STATE_VERSION,
    updated_at_utc: acceptedAtUtc,
  };
  validateState(next);
  await atomicWrite(selected.state, `${JSON.stringify(next, null, 2)}\n`);
  return { idempotent: false, state: next };
}

export async function commitSuccessfulRollback(
  root,
  { acceptedAtUtc = new Date().toISOString() } = {},
) {
  const selected = paths(root);
  const state = await readReleaseState(root);
  if (state?.rollback_target === null || state === null) {
    fail("ROLLBACK_TARGET_MISSING", "release-state");
  }
  const [current, target] = await Promise.all([
    loadReleaseManifest(root, state.current),
    loadReleaseManifest(root, state.rollback_target),
  ]);
  validateRollbackTransition(current, target);
  const next = {
    current: {
      ...state.rollback_target,
      accepted_at_utc: acceptedAtUtc,
    },
    rollback_target: null,
    state_version: STATE_VERSION,
    updated_at_utc: acceptedAtUtc,
  };
  validateState(next);
  await atomicWrite(selected.state, `${JSON.stringify(next, null, 2)}\n`);
  return { rolledBackFrom: current.release_id, state: next };
}
