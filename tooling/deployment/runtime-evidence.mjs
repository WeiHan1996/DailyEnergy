#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RUNTIME_EVIDENCE_VERSION = "DevRuntimeEvidenceV1";
const SHA256 = /^[a-f0-9]{64}$/u;
const IMAGE_DIGEST = /^sha256:[a-f0-9]{64}$/u;
const GIT_SHA = /^[a-f0-9]{40}$/u;
const RUN_ID = /^\d{1,20}$/u;
const RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/u;

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

function exactKeys(value, expected, code) {
  const actual = Object.keys(value ?? {}).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(code, actual.join(",") || "empty");
  }
}

export function developmentReleaseId({
  commitSha,
  publicationRunAttempt,
  publicationRunId,
}) {
  if (
    !GIT_SHA.test(commitSha ?? "") ||
    !RUN_ID.test(publicationRunId ?? "") ||
    !/^\d{1,6}$/u.test(String(publicationRunAttempt ?? ""))
  ) {
    fail("DEV_RUNTIME_CONTEXT_INVALID", "release-id");
  }
  return `dev-${commitSha.slice(0, 12)}-${publicationRunId}-${publicationRunAttempt}`;
}

export function apiDeployConfigFingerprint(releaseId) {
  if (!RELEASE_ID.test(releaseId ?? "")) {
    fail("DEV_RUNTIME_CONTEXT_INVALID", "api-release-id");
  }
  return createHash("sha256")
    .update(
      JSON.stringify({
        config_schema_version: "api-runtime-config-v1",
        contract_bundle_version: "api-contract-v1",
        database_url_file: "/run/secrets/database_api_url",
        environment: "DEV",
        host: "0.0.0.0",
        log_level: "INFO",
        maintenance_mode: "OFF",
        port: 3000,
        product_date_policy_version: "product-date-v1",
        release_id: releaseId,
        runtime_profile: "API",
        shutdown_grace_ms: 5000,
      }),
    )
    .digest("hex");
}

export function validateDevRuntimeEvidence(value) {
  exactKeys(
    value,
    ["evidence_version", "fingerprints", "release_id", "server_image"],
    "DEV_RUNTIME_EVIDENCE_KEYS",
  );
  if (
    value.evidence_version !== RUNTIME_EVIDENCE_VERSION ||
    !/^dev-[a-f0-9]{12}-\d{1,20}-\d{1,6}$/u.test(value.release_id) ||
    !/^ghcr\.io\/weihan1996\/dailyenergy-server@sha256:[a-f0-9]{64}$/u.test(
      value.server_image,
    )
  ) {
    fail("DEV_RUNTIME_EVIDENCE_IDENTITY", "document");
  }
  exactKeys(
    value.fingerprints,
    [
      "api_capability",
      "api_deploy_config",
      "worker_background",
      "worker_interactive",
      "worker_restricted",
    ],
    "DEV_RUNTIME_FINGERPRINT_KEYS",
  );
  if (Object.values(value.fingerprints).some((entry) => !SHA256.test(entry))) {
    fail("DEV_RUNTIME_FINGERPRINT_INVALID", "value");
  }
  if (
    value.fingerprints.api_deploy_config !==
    apiDeployConfigFingerprint(value.release_id)
  ) {
    fail("DEV_RUNTIME_FINGERPRINT_INVALID", "api-deploy-config");
  }
  return value;
}

export function devRuntimeEvidenceDigest(value) {
  validateDevRuntimeEvidence(value);
  return createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex");
}

function validateRuntimeServerImage(image) {
  if (
    !/^ghcr\.io\/weihan1996\/dailyenergy-server@sha256:[a-f0-9]{64}$/u.test(
      image ?? "",
    )
  ) {
    fail("DEV_RUNTIME_IMAGE_REFERENCE_INVALID", "server");
  }
}

export function pullDevelopmentRuntimeImage(
  image,
  { runner = spawnSync } = {},
) {
  validateRuntimeServerImage(image);
  const result = runner("docker", ["pull", image], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 180_000,
  });
  if (result.status !== 0 || result.error) {
    fail("DEV_RUNTIME_IMAGE_PULL_FAILED", "server");
  }
}

export function runDevelopmentRuntimeImage(
  image,
  arguments_,
  environment = {},
  { runner = spawnSync } = {},
) {
  validateRuntimeServerImage(image);
  const environmentArguments = Object.entries(environment).flatMap(
    ([name, value]) => ["--env", `${name}=${value}`],
  );
  const result = runner(
    "docker",
    [
      "run",
      "--rm",
      "--pull",
      "never",
      "--network",
      "none",
      "--read-only",
      "--tmpfs",
      "/tmp:uid=1000,gid=1000,mode=0700",
      "--entrypoint",
      "node",
      ...environmentArguments,
      image,
      ...arguments_,
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 30_000 },
  );
  if (result.status !== 0 || result.error) {
    fail("DEV_RUNTIME_IMAGE_PROBE_FAILED", "server");
  }
  return result.stdout.trim();
}

export async function collectDevRuntimeEvidence(
  serverMetadataFile,
  context,
  {
    pullImage = pullDevelopmentRuntimeImage,
    runImage = runDevelopmentRuntimeImage,
  } = {},
) {
  let metadata;
  try {
    metadata = JSON.parse(await readFile(serverMetadataFile, "utf8"));
  } catch {
    fail("DEV_RUNTIME_METADATA_READ", "server");
  }
  const digest = metadata?.["containerimage.digest"];
  if (
    !IMAGE_DIGEST.test(digest ?? "") ||
    (metadata?.["containerimage.descriptor"]?.digest !== undefined &&
      metadata["containerimage.descriptor"].digest !== digest)
  ) {
    fail("DEV_RUNTIME_METADATA_DIGEST", "server");
  }
  const releaseId = developmentReleaseId(context);
  const serverImage = `ghcr.io/weihan1996/dailyenergy-server@${digest}`;
  await pullImage(serverImage);
  let api;
  let workers;
  try {
    api = JSON.parse(
      runImage(
        serverImage,
        [
          "--input-type=module",
          "--eval",
          "import('/app/api/dist/bootstrap/runtime-config.js').then(m=>process.stdout.write(JSON.stringify(m.calculateRuntimeFingerprints(process.env))))",
        ],
        {
          DAILYENERGY_CONFIG_SCHEMA_VERSION: "api-runtime-config-v1",
          DAILYENERGY_CONTRACT_BUNDLE_VERSION: "api-contract-v1",
          DAILYENERGY_DATABASE_URL_FILE: "/run/secrets/database_api_url",
          DAILYENERGY_ENVIRONMENT: "DEV",
          DAILYENERGY_HOST: "0.0.0.0",
          DAILYENERGY_LOG_LEVEL: "INFO",
          DAILYENERGY_MAINTENANCE_MODE: "OFF",
          DAILYENERGY_PORT: "3000",
          DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: "product-date-v1",
          DAILYENERGY_REDIS_KEY_PREFIX: "dailyenergy-dev",
          DAILYENERGY_REDIS_URL: "redis://redis:6379",
          DAILYENERGY_RELEASE_ID: releaseId,
          DAILYENERGY_RUNTIME_PROFILE: "API",
          DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
        },
      ),
    );
    workers = JSON.parse(
      runImage(serverImage, [
        "--input-type=module",
        "--eval",
        `Promise.all([
          import('/app/worker/node_modules/@daily-energy/server-adapters/dist/worker-interactive/index.js'),
          import('/app/worker/node_modules/@daily-energy/server-adapters/dist/worker-background/index.js'),
          import('/app/worker/dist/entrypoints/restricted.js')
        ]).then(([i,b,r])=>process.stdout.write(JSON.stringify({
          interactive:i.fingerprintCapabilityManifest(i.workerInteractiveManifest),
          background:b.fingerprintCapabilityManifest(b.workerBackgroundManifest),
          restricted:r.createRestrictedWorkerEntrypoint().capabilityFingerprint
        })))`,
      ]),
    );
  } catch {
    fail("DEV_RUNTIME_IMAGE_PROBE_INVALID", "server");
  }
  if (api.deployConfigFingerprint !== apiDeployConfigFingerprint(releaseId)) {
    fail("DEV_RUNTIME_IMAGE_PROBE_INVALID", "api-deploy-config");
  }
  return validateDevRuntimeEvidence({
    evidence_version: RUNTIME_EVIDENCE_VERSION,
    fingerprints: {
      api_capability: api.capabilityFingerprint,
      api_deploy_config: api.deployConfigFingerprint,
      worker_background: workers.background,
      worker_interactive: workers.interactive,
      worker_restricted: workers.restricted,
    },
    release_id: releaseId,
    server_image: serverImage,
  });
}

async function main() {
  const [mode, source, destination] = process.argv.slice(2);
  if (mode === "--validate" && source && destination === undefined) {
    const value = JSON.parse(await readFile(path.resolve(source), "utf8"));
    validateDevRuntimeEvidence(value);
    process.stdout.write(
      `DEV_RUNTIME_EVIDENCE_OK:release=${value.release_id}:fingerprints=5\n`,
    );
    return;
  }
  if (mode !== "--collect" || !source || !destination) {
    fail(
      "DEV_RUNTIME_EVIDENCE_USAGE",
      "--collect server-metadata output|--validate file",
    );
  }
  const value = await collectDevRuntimeEvidence(path.resolve(source), {
    commitSha: process.env.RELEASE_SHA,
    publicationRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
    publicationRunId: process.env.GITHUB_RUN_ID,
  });
  await writeFile(
    path.resolve(destination),
    `${JSON.stringify(value, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `DEV_RUNTIME_EVIDENCE_OK:release=${value.release_id}:fingerprints=5\n`,
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
