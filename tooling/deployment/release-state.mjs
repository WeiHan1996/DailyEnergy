import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  canonicalReleaseManifest,
  deploymentPhases,
  releaseManifestDigest,
  validateReleaseManifest,
  validateReleaseTransition,
  validateRollbackTransition,
} from "./release-contract.mjs";

const STATE_VERSION = "e012-release-state-v2";
const OPERATION_VERSION = "e012-release-operation-v1";

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function paths(root) {
  const absolute = path.resolve(root);
  return {
    lock: path.join(absolute, "release.lock"),
    releases: path.join(absolute, "releases"),
    root: absolute,
    operation: path.join(absolute, "release-operation.json"),
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

function catalogReference(manifest) {
  return {
    catalog_fingerprint: manifest.migrations.catalog_fingerprint,
    catalog_generation: manifest.migrations.catalog_generation,
    manifest_sha256: releaseManifestDigest(manifest),
    migration_head: manifest.migrations.migration_head,
    release_id: manifest.release_id,
  };
}

function validateCatalogReference(reference, detail) {
  const keys = Object.keys(reference ?? {}).sort();
  if (
    JSON.stringify(keys) !==
      JSON.stringify([
        "catalog_fingerprint",
        "catalog_generation",
        "manifest_sha256",
        "migration_head",
        "release_id",
      ]) ||
    !/^[a-f0-9]{64}$/u.test(reference.catalog_fingerprint) ||
    !Number.isSafeInteger(reference.catalog_generation) ||
    reference.catalog_generation < 1 ||
    !/^[a-f0-9]{64}$/u.test(reference.manifest_sha256) ||
    !/^\d{14}_[a-z0-9_]{3,96}$/u.test(reference.migration_head) ||
    !/^[a-z0-9][a-z0-9.-]{2,63}$/u.test(reference.release_id)
  ) {
    fail("RELEASE_STATE_CATALOG_REFERENCE_INVALID", detail);
  }
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
        "catalog",
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
  validateCatalogReference(value.catalog, "catalog");
  if (value.rollback_target !== null) {
    validateReference(value.rollback_target, "rollback_target");
    if (value.rollback_target.release_id === value.current.release_id) {
      fail("RELEASE_STATE_TARGET_DUPLICATE", value.current.release_id);
    }
  }
  return value;
}

function validateOperationReference(reference, detail) {
  const keys = Object.keys(reference ?? {}).sort();
  if (
    JSON.stringify(keys) !==
      JSON.stringify(["manifest_sha256", "release_id"]) ||
    !/^[a-f0-9]{64}$/u.test(reference.manifest_sha256) ||
    !/^[a-z0-9][a-z0-9.-]{2,63}$/u.test(reference.release_id)
  ) {
    fail("RELEASE_OPERATION_REFERENCE_INVALID", detail);
  }
}

function validateOperation(value) {
  const keys = Object.keys(value ?? {}).sort();
  if (
    JSON.stringify(keys) !==
      JSON.stringify([
        "active_phase",
        "completed_phases",
        "failure_code",
        "from_current",
        "kind",
        "migration_started",
        "operation_version",
        "recovery_catalog",
        "started_at_utc",
        "status",
        "target",
        "updated_at_utc",
      ]) ||
    value.operation_version !== OPERATION_VERSION ||
    !["DEPLOY", "RECOVER_CURRENT", "ROLLBACK"].includes(value.kind) ||
    !["FAILED", "PENDING", "RECOVERING"].includes(value.status) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(
      value.started_at_utc,
    ) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(
      value.updated_at_utc,
    ) ||
    typeof value.migration_started !== "boolean" ||
    (value.failure_code !== null &&
      !/^[A-Z][A-Z0-9_]{2,127}$/u.test(value.failure_code)) ||
    (value.active_phase !== null &&
      !deploymentPhases.includes(value.active_phase)) ||
    !Array.isArray(value.completed_phases) ||
    value.completed_phases.some(
      (phase, index) => phase !== deploymentPhases[index],
    )
  ) {
    fail("RELEASE_OPERATION_INVALID", "document");
  }
  validateOperationReference(value.target, "target");
  if (value.recovery_catalog !== null) {
    validateOperationReference(value.recovery_catalog, "recovery-catalog");
  }
  if (value.from_current !== null) {
    validateReference(value.from_current, "operation-from-current");
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

export async function readReleaseOperation(root) {
  try {
    return validateOperation(
      JSON.parse(await readFile(paths(root).operation, "utf8")),
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      fail("RELEASE_OPERATION_INVALID", "json");
    }
    throw error;
  }
}

export async function persistReleaseManifest(root, manifest) {
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

async function loadManifestByReference(root, reference) {
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

export async function loadReleaseManifest(root, reference) {
  validateReference(reference, "load");
  return loadManifestByReference(root, reference);
}

export async function loadCatalogManifest(root, reference) {
  validateCatalogReference(reference, "load");
  const manifest = await loadManifestByReference(root, reference);
  if (
    manifest.migrations.catalog_fingerprint !== reference.catalog_fingerprint ||
    manifest.migrations.catalog_generation !== reference.catalog_generation ||
    manifest.migrations.migration_head !== reference.migration_head
  ) {
    fail("RELEASE_STATE_CATALOG_MANIFEST_DRIFT", reference.release_id);
  }
  return manifest;
}

export async function beginReleaseOperation(
  root,
  kind,
  manifest,
  fromCurrent,
  { startedAtUtc = new Date().toISOString() } = {},
) {
  const existing = await readReleaseOperation(root);
  if (existing !== null) {
    fail("RELEASE_RECOVERY_REQUIRED", existing.target.release_id);
  }
  await persistReleaseManifest(root, manifest);
  const operation = {
    active_phase: null,
    completed_phases: [],
    failure_code: null,
    from_current: fromCurrent,
    kind,
    migration_started: false,
    operation_version: OPERATION_VERSION,
    recovery_catalog: null,
    started_at_utc: startedAtUtc,
    status: "PENDING",
    target: {
      manifest_sha256: releaseManifestDigest(manifest),
      release_id: manifest.release_id,
    },
    updated_at_utc: startedAtUtc,
  };
  validateOperation(operation);
  await atomicWrite(
    paths(root).operation,
    `${JSON.stringify(operation, null, 2)}\n`,
  );
  return operation;
}

export async function updateReleaseOperationPhase(root, phase, passed) {
  const operation = await readReleaseOperation(root);
  if (operation === null || !deploymentPhases.includes(phase)) {
    fail("RELEASE_OPERATION_MISSING", phase);
  }
  const next = {
    ...operation,
    active_phase: passed ? null : phase,
    completed_phases: passed
      ? [...operation.completed_phases, phase]
      : operation.completed_phases,
    migration_started: operation.migration_started || phase === "migration",
    updated_at_utc: new Date().toISOString(),
  };
  validateOperation(next);
  await atomicWrite(
    paths(root).operation,
    `${JSON.stringify(next, null, 2)}\n`,
  );
  return next;
}

export async function markReleaseOperationFailed(root, error) {
  const operation = await readReleaseOperation(root);
  if (operation === null) {
    fail("RELEASE_OPERATION_MISSING", "failure");
  }
  const failureCode = String(error?.message ?? error).split(":", 1)[0];
  const next = {
    ...operation,
    failure_code: /^[A-Z][A-Z0-9_]{2,127}$/u.test(failureCode)
      ? failureCode
      : "E012_DEPLOY_UNCLASSIFIED_FAILURE",
    status: "FAILED",
    updated_at_utc: new Date().toISOString(),
  };
  validateOperation(next);
  await atomicWrite(
    paths(root).operation,
    `${JSON.stringify(next, null, 2)}\n`,
  );
  return next;
}

export async function markReleaseOperationRecovering(root, recoveryCatalog) {
  const operation = await readReleaseOperation(root);
  if (operation === null) {
    fail("RELEASE_OPERATION_MISSING", "recover-current");
  }
  validateOperationReference(recoveryCatalog, "recovery-catalog");
  const next = {
    ...operation,
    active_phase: null,
    completed_phases: [],
    failure_code: null,
    kind: "RECOVER_CURRENT",
    recovery_catalog: operation.recovery_catalog ?? recoveryCatalog,
    status: "RECOVERING",
    updated_at_utc: new Date().toISOString(),
  };
  validateOperation(next);
  await atomicWrite(
    paths(root).operation,
    `${JSON.stringify(next, null, 2)}\n`,
  );
  return next;
}

export async function restartInitialReleaseOperation(root, manifest) {
  const operation = await readReleaseOperation(root);
  if (
    operation === null ||
    operation.from_current !== null ||
    operation.target.release_id !== manifest.release_id ||
    operation.target.manifest_sha256 !== releaseManifestDigest(manifest)
  ) {
    fail("RELEASE_INITIAL_RETRY_INVALID", manifest.release_id);
  }
  const next = {
    ...operation,
    active_phase: null,
    completed_phases: [],
    failure_code: null,
    kind: "DEPLOY",
    migration_started: false,
    recovery_catalog: null,
    status: "PENDING",
    updated_at_utc: new Date().toISOString(),
  };
  validateOperation(next);
  await atomicWrite(
    paths(root).operation,
    `${JSON.stringify(next, null, 2)}\n`,
  );
  return next;
}

export async function loadOperationManifest(root, reference) {
  validateOperationReference(reference, "load-operation");
  return loadManifestByReference(root, reference);
}

export async function clearReleaseOperation(root) {
  await rm(paths(root).operation, { force: true });
}

export async function commitRecoveredCurrent(
  root,
  catalogManifest,
  { recoveredAtUtc = new Date().toISOString() } = {},
) {
  const selected = paths(root);
  const state = await readReleaseState(root);
  if (state === null) {
    fail("RECOVER_CURRENT_MISSING", "release-state");
  }
  validateReleaseManifest(catalogManifest);
  const current = await loadReleaseManifest(root, state.current);
  if (
    !current.compatibility.accepted_generations.includes(
      catalogManifest.migrations.catalog_generation,
    )
  ) {
    fail(
      "RECOVER_CURRENT_CATALOG_INCOMPATIBLE",
      `${current.release_id}->${catalogManifest.release_id}`,
    );
  }
  await persistReleaseManifest(root, catalogManifest);
  const next = {
    ...state,
    catalog: catalogReference(catalogManifest),
    updated_at_utc: recoveredAtUtc,
  };
  validateState(next);
  await atomicWrite(selected.state, `${JSON.stringify(next, null, 2)}\n`);
  return next;
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
  await persistReleaseManifest(root, manifest);
  const next = {
    catalog: catalogReference(manifest),
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
  if (
    !target.compatibility.accepted_generations.includes(
      state.catalog.catalog_generation,
    )
  ) {
    fail(
      "ROLLBACK_EFFECTIVE_CATALOG_INCOMPATIBLE",
      `${current.release_id}->${target.release_id}`,
    );
  }
  const next = {
    catalog: state.catalog,
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
