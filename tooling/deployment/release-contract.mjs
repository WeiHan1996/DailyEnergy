import { createHash } from "node:crypto";

export const RELEASE_MANIFEST_VERSION = "ReleaseManifestV1";
export const DEVELOPMENT_TOPOLOGY = "DEV_COLOCATED_EXCEPTION";
export const DEVELOPMENT_OBJECT_ENDPOINT = "TENCENT_COS_PRIVATE_INTERNAL";

export const deploymentPhases = Object.freeze([
  "preflight",
  "pull",
  "stateful-ready",
  "maintenance-on",
  "worker-drain",
  "migration",
  "worker-interactive",
  "worker-background",
  "api",
  "admin",
  "worker-restricted",
  "tls-ingress",
  "health",
  "smoke-object",
  "smoke-safety",
  "smoke-owner",
  "smoke-delete",
  "maintenance-off",
]);

export const reconciliationPhases = Object.freeze([
  "preflight",
  "stateful-ready",
  "maintenance-on",
  "worker-drain",
  "drift",
  "worker-interactive",
  "worker-background",
  "api",
  "admin",
  "worker-restricted",
  "tls-ingress",
  "health",
  "smoke-object",
  "smoke-safety",
  "smoke-owner",
  "smoke-delete",
  "maintenance-off",
]);

const IMAGE_NAMES = Object.freeze([
  "admin",
  "migration",
  "proxy",
  "server",
  "stub",
]);
const SECRET_NAMES = Object.freeze([
  "cos_secret_id",
  "cos_secret_key",
  "database_admin_url",
  "database_api_url",
  "database_background_url",
  "database_interactive_url",
  "database_migration_url",
  "database_restricted_url",
  "fault_control_token",
  "postgres_password",
]);
const FINGERPRINT_NAMES = Object.freeze([
  "api_capability",
  "api_deploy_config",
  "object_config",
  "worker_background",
  "worker_interactive",
  "worker_restricted",
]);

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_SHA = /^[a-f0-9]{40}$/u;
const RELEASE_ID = /^[a-z0-9][a-z0-9.-]{2,63}$/u;
const VERSION_REF = /^[a-z0-9][a-z0-9.-]{2,63}$/u;
const IMAGE_REFERENCE =
  /^ghcr\.io\/weihan1996\/dailyenergy-(?:admin|migration|proxy|server|stub)@sha256:[a-f0-9]{64}$/u;

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, ruleId) {
  if (!isObject(value)) {
    fail(ruleId, "not-object");
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(ruleId, actual.join(",") || "empty");
  }
}

function stringMatching(value, pattern, ruleId, detail) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(ruleId, detail);
  }
}

function positiveInteger(value, ruleId, detail) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(ruleId, detail);
  }
}

function sortedUniqueStrings(values, pattern, ruleId, detail) {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== "string" || !pattern.test(value)) ||
    JSON.stringify(values) !== JSON.stringify([...new Set(values)].sort())
  ) {
    fail(ruleId, detail);
  }
}

function sortedUniqueIntegers(values, ruleId, detail) {
  if (
    !Array.isArray(values) ||
    values.some((value) => !Number.isSafeInteger(value) || value < 1) ||
    JSON.stringify(values) !== JSON.stringify([...new Set(values)].sort())
  ) {
    fail(ruleId, detail);
  }
}

function validateSource(source) {
  exactKeys(
    source,
    [
      "ci_run_attempt",
      "ci_run_id",
      "commit_sha",
      "lockfile_sha256",
      "repository",
    ],
    "RELEASE_MANIFEST_SOURCE_KEYS",
  );
  if (source.repository !== "WeiHan1996/DailyEnergy") {
    fail("RELEASE_MANIFEST_REPOSITORY", source.repository ?? "missing");
  }
  stringMatching(
    source.commit_sha,
    GIT_SHA,
    "RELEASE_MANIFEST_COMMIT",
    "commit_sha",
  );
  stringMatching(
    source.lockfile_sha256,
    SHA256,
    "RELEASE_MANIFEST_LOCKFILE",
    "lockfile_sha256",
  );
  stringMatching(
    source.ci_run_id,
    /^\d{1,20}$/u,
    "RELEASE_MANIFEST_CI_RUN",
    "ci_run_id",
  );
  positiveInteger(
    source.ci_run_attempt,
    "RELEASE_MANIFEST_CI_RUN",
    "ci_run_attempt",
  );
}

function validateImages(images) {
  exactKeys(images, IMAGE_NAMES, "RELEASE_MANIFEST_IMAGE_KEYS");
  for (const name of IMAGE_NAMES) {
    stringMatching(
      images[name],
      IMAGE_REFERENCE,
      "RELEASE_MANIFEST_IMAGE_NOT_IMMUTABLE",
      name,
    );
    if (!images[name].includes(`dailyenergy-${name}@`)) {
      fail("RELEASE_MANIFEST_IMAGE_ROLE_MISMATCH", name);
    }
  }
}

function validateSupplyChain(supplyChain) {
  exactKeys(
    supplyChain,
    ["gate_ref", "image_set_sha256", "provenance_sha256", "sbom_sha256"],
    "RELEASE_MANIFEST_SUPPLY_CHAIN_KEYS",
  );
  for (const name of ["image_set_sha256", "provenance_sha256", "sbom_sha256"]) {
    stringMatching(
      supplyChain[name],
      SHA256,
      "RELEASE_MANIFEST_SUPPLY_CHAIN_DIGEST",
      name,
    );
  }
  stringMatching(
    supplyChain.gate_ref,
    /^github-actions:run:\d{1,20}:attempt:\d{1,6}$/u,
    "RELEASE_MANIFEST_GATE_REF",
    "gate_ref",
  );
}

function validateMigrations(migrations, releaseId) {
  exactKeys(
    migrations,
    [
      "catalog_fingerprint",
      "catalog_generation",
      "destructive",
      "migration_head",
      "rollback_compatible_release_ids",
    ],
    "RELEASE_MANIFEST_MIGRATION_KEYS",
  );
  stringMatching(
    migrations.catalog_fingerprint,
    SHA256,
    "RELEASE_MANIFEST_CATALOG_FINGERPRINT",
    "catalog_fingerprint",
  );
  positiveInteger(
    migrations.catalog_generation,
    "RELEASE_MANIFEST_CATALOG_GENERATION",
    "catalog_generation",
  );
  stringMatching(
    migrations.migration_head,
    /^[0-9]{14}_[a-z0-9_]{3,80}$/u,
    "RELEASE_MANIFEST_MIGRATION_HEAD",
    "migration_head",
  );
  if (migrations.destructive !== false) {
    fail("RELEASE_MANIFEST_DESTRUCTIVE_MIGRATION", releaseId);
  }
  sortedUniqueStrings(
    migrations.rollback_compatible_release_ids,
    RELEASE_ID,
    "RELEASE_MANIFEST_ROLLBACK_COMPATIBILITY",
    releaseId,
  );
  if (migrations.rollback_compatible_release_ids.includes(releaseId)) {
    fail("RELEASE_MANIFEST_ROLLBACK_SELF_REFERENCE", releaseId);
  }
}

function validateConfig(config) {
  exactKeys(
    config,
    [
      "config_schema_version",
      "contract_bundle_version",
      "environment",
      "log_level",
      "product_date_policy_version",
      "runtime_fingerprints",
      "secret_ref_versions",
    ],
    "RELEASE_MANIFEST_CONFIG_KEYS",
  );
  if (
    config.environment !== "DEV" ||
    config.config_schema_version !== "api-runtime-config-v1" ||
    config.contract_bundle_version !== "api-contract-v1" ||
    config.product_date_policy_version !== "product-date-v1" ||
    config.log_level !== "INFO"
  ) {
    fail("RELEASE_MANIFEST_DEV_CONFIG_INVALID", "config");
  }
  exactKeys(
    config.runtime_fingerprints,
    FINGERPRINT_NAMES,
    "RELEASE_MANIFEST_RUNTIME_FINGERPRINT_KEYS",
  );
  for (const name of FINGERPRINT_NAMES) {
    stringMatching(
      config.runtime_fingerprints[name],
      SHA256,
      "RELEASE_MANIFEST_RUNTIME_FINGERPRINT",
      name,
    );
  }
  exactKeys(
    config.secret_ref_versions,
    SECRET_NAMES,
    "RELEASE_MANIFEST_SECRET_REF_KEYS",
  );
  for (const name of SECRET_NAMES) {
    stringMatching(
      config.secret_ref_versions[name],
      VERSION_REF,
      "RELEASE_MANIFEST_SECRET_REF_VERSION",
      name,
    );
  }
}

function validateTopology(topology) {
  exactKeys(
    topology,
    [
      "object_config_ref",
      "object_endpoint",
      "object_prefix",
      "object_region",
      "production_enabled",
      "public_ingress",
      "stateful_topology",
    ],
    "RELEASE_MANIFEST_TOPOLOGY_KEYS",
  );
  if (
    topology.stateful_topology !== DEVELOPMENT_TOPOLOGY ||
    topology.object_endpoint !== DEVELOPMENT_OBJECT_ENDPOINT ||
    topology.object_region !== "ap-shanghai" ||
    topology.object_prefix !== "dev/objects/" ||
    topology.production_enabled !== false ||
    topology.public_ingress !== "LOOPBACK_TLS_UNTIL_ICP"
  ) {
    fail("RELEASE_MANIFEST_PRODUCTION_GATE", "dev-topology");
  }
  stringMatching(
    topology.object_config_ref,
    VERSION_REF,
    "RELEASE_MANIFEST_OBJECT_CONFIG_REF",
    "object_config_ref",
  );
}

function validateCompatibility(compatibility) {
  exactKeys(
    compatibility,
    ["accepted_generations", "generation", "manifest_versions"],
    "RELEASE_MANIFEST_COMPATIBILITY_KEYS",
  );
  positiveInteger(
    compatibility.generation,
    "RELEASE_MANIFEST_COMPATIBILITY_GENERATION",
    "generation",
  );
  sortedUniqueIntegers(
    compatibility.accepted_generations,
    "RELEASE_MANIFEST_ACCEPTED_GENERATIONS",
    "accepted_generations",
  );
  if (
    compatibility.accepted_generations.length > 2 ||
    !compatibility.accepted_generations.includes(compatibility.generation) ||
    compatibility.accepted_generations.some(
      (generation) => Math.abs(generation - compatibility.generation) > 1,
    )
  ) {
    fail("RELEASE_MANIFEST_N_MINUS_ONE_WINDOW", "accepted_generations");
  }
  if (
    JSON.stringify(compatibility.manifest_versions) !==
    JSON.stringify([RELEASE_MANIFEST_VERSION])
  ) {
    fail("RELEASE_MANIFEST_VERSION_WINDOW", "manifest_versions");
  }
}

function validateEvidence(evidence) {
  exactKeys(
    evidence,
    ["required_gates", "source_ids", "synthetic_only"],
    "RELEASE_MANIFEST_EVIDENCE_KEYS",
  );
  if (evidence.synthetic_only !== true) {
    fail("RELEASE_MANIFEST_NON_SYNTHETIC_EVIDENCE", "synthetic_only");
  }
  sortedUniqueStrings(
    evidence.source_ids,
    /^S(?:31-TEST|32-DEPLOY|33-OBS)-\d{3}$/u,
    "RELEASE_MANIFEST_SOURCE_IDS",
    "source_ids",
  );
  const requiredGates = [
    "ci-full",
    "deletion",
    "migration",
    "owner",
    "safety",
    "synthetic-smoke",
  ];
  if (
    JSON.stringify(evidence.required_gates) !== JSON.stringify(requiredGates)
  ) {
    fail("RELEASE_MANIFEST_REQUIRED_GATES", "required_gates");
  }
}

export function validateReleaseManifest(value) {
  exactKeys(
    value,
    [
      "compatibility",
      "config",
      "evidence",
      "images",
      "manifest_version",
      "migrations",
      "release_id",
      "source",
      "supply_chain",
      "topology",
    ],
    "RELEASE_MANIFEST_KEYS",
  );
  if (value.manifest_version !== RELEASE_MANIFEST_VERSION) {
    fail("RELEASE_MANIFEST_VERSION", value.manifest_version ?? "missing");
  }
  stringMatching(
    value.release_id,
    RELEASE_ID,
    "RELEASE_MANIFEST_RELEASE_ID",
    "release_id",
  );
  validateSource(value.source);
  validateImages(value.images);
  validateSupplyChain(value.supply_chain);
  validateMigrations(value.migrations, value.release_id);
  validateConfig(value.config);
  validateTopology(value.topology);
  validateCompatibility(value.compatibility);
  validateEvidence(value.evidence);
  return value;
}

function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function canonicalReleaseManifest(value) {
  validateReleaseManifest(value);
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

export function releaseManifestDigest(value) {
  return createHash("sha256")
    .update(canonicalReleaseManifest(value))
    .digest("hex");
}

function assertMutualGenerationSupport(left, right, ruleId) {
  if (
    !left.compatibility.accepted_generations.includes(
      right.compatibility.generation,
    ) ||
    !right.compatibility.accepted_generations.includes(
      left.compatibility.generation,
    )
  ) {
    fail(ruleId, `${left.release_id}->${right.release_id}`);
  }
}

export function validateReleaseTransition(current, candidate) {
  validateReleaseManifest(current);
  validateReleaseManifest(candidate);
  if (current.release_id === candidate.release_id) {
    if (releaseManifestDigest(current) !== releaseManifestDigest(candidate)) {
      fail("RELEASE_ID_CONTENT_DRIFT", current.release_id);
    }
    return { idempotent: true };
  }
  assertMutualGenerationSupport(
    current,
    candidate,
    "RELEASE_N_MINUS_ONE_INCOMPATIBLE",
  );
  const generationDelta =
    candidate.migrations.catalog_generation -
    current.migrations.catalog_generation;
  if (generationDelta < 0 || generationDelta > 1) {
    fail(
      "RELEASE_CATALOG_TRANSITION_INCOMPATIBLE",
      `${current.release_id}->${candidate.release_id}`,
    );
  }
  if (
    generationDelta === 0 &&
    candidate.migrations.catalog_fingerprint !==
      current.migrations.catalog_fingerprint
  ) {
    fail(
      "RELEASE_CATALOG_FINGERPRINT_DRIFT",
      `${current.release_id}->${candidate.release_id}`,
    );
  }
  if (
    !candidate.migrations.rollback_compatible_release_ids.includes(
      current.release_id,
    )
  ) {
    fail("RELEASE_ROLLBACK_TARGET_NOT_DECLARED", current.release_id);
  }
  return { idempotent: false };
}

export function validateRollbackTransition(current, target) {
  validateReleaseManifest(current);
  validateReleaseManifest(target);
  assertMutualGenerationSupport(
    current,
    target,
    "ROLLBACK_N_MINUS_ONE_INCOMPATIBLE",
  );
  const generationDelta =
    current.migrations.catalog_generation -
    target.migrations.catalog_generation;
  if (
    generationDelta < 0 ||
    generationDelta > 1 ||
    !current.migrations.rollback_compatible_release_ids.includes(
      target.release_id,
    )
  ) {
    fail(
      "ROLLBACK_CATALOG_INCOMPATIBLE",
      `${current.release_id}->${target.release_id}`,
    );
  }
  return { compatible: true };
}

export function assertSecretVersionsActive(manifest, revokedVersions) {
  validateReleaseManifest(manifest);
  const revoked = new Set(revokedVersions);
  for (const [name, version] of Object.entries(
    manifest.config.secret_ref_versions,
  )) {
    if (revoked.has(version)) {
      fail("RELEASE_SECRET_VERSION_REVOKED", name);
    }
  }
}

function validatePhaseReceipts(receipts, phases) {
  if (!Array.isArray(receipts) || receipts.length !== phases.length) {
    fail("RELEASE_PHASE_RECEIPT_COUNT", receipts?.length ?? "missing");
  }
  for (const [index, phase] of phases.entries()) {
    const receipt = receipts[index];
    exactKeys(receipt, ["phase", "result"], "RELEASE_PHASE_RECEIPT_KEYS");
    if (receipt.phase !== phase || receipt.result !== "PASS") {
      fail("RELEASE_PHASE_ORDER_OR_RESULT", `${index}:${receipt.phase}`);
    }
  }
  return { phases: receipts.length };
}

export function validateDeploymentReceipts(receipts) {
  return validatePhaseReceipts(receipts, deploymentPhases);
}

export function validateReconciliationReceipts(receipts) {
  return validatePhaseReceipts(receipts, reconciliationPhases);
}
