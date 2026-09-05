#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parse, parseDocument } from "yaml";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const CORE_DEV_SERVICES = Object.freeze([
  "admin",
  "api",
  "database-init",
  "database-verify",
  "dependency-stub",
  "postgres",
  "redis",
  "worker-background",
  "worker-interactive",
  "worker-restricted",
]);
const OVERLAY_SERVICES = Object.freeze(
  [...CORE_DEV_SERVICES, "database-smoke", "object-smoke", "tls-proxy"].sort(),
);
const CADDY_BASE =
  "caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648";
const DEV_SECRET_FILES = Object.freeze({
  dev_cos_config: "cos-config.env",
  dev_cos_secret_id: "cos-secret-id",
  dev_cos_secret_key: "cos-secret-key",
  dev_database_admin_url: "database-admin-url",
  dev_database_api_url: "database-api-url",
  dev_database_background_url: "database-background-url",
  dev_database_interactive_url: "database-interactive-url",
  dev_database_migration_url: "database-migration-url",
  dev_database_restricted_url: "database-restricted-url",
  dev_fault_control_token: "fault-control-token",
  dev_postgres_password: "postgres-password",
});
const DEV_SECRET_GRANTS = Object.freeze({
  api: [["dev_database_api_url", "/run/secrets/database_api_url", "1000"]],
  "database-init": [
    ["dev_database_admin_url", "/run/secrets/database_admin_url", "1000"],
    ["dev_database_api_url", "/run/secrets/database_api_url", "1000"],
    [
      "dev_database_background_url",
      "/run/secrets/database_background_url",
      "1000",
    ],
    [
      "dev_database_interactive_url",
      "/run/secrets/database_interactive_url",
      "1000",
    ],
    [
      "dev_database_migration_url",
      "/run/secrets/database_migration_url",
      "1000",
    ],
    [
      "dev_database_restricted_url",
      "/run/secrets/database_restricted_url",
      "1000",
    ],
  ],
  "database-smoke": [
    ["dev_database_admin_url", "/run/secrets/database_admin_url", "1000"],
  ],
  "database-verify": [
    ["dev_database_admin_url", "/run/secrets/database_admin_url", "1000"],
  ],
  "dependency-stub": [
    ["dev_fault_control_token", "/run/secrets/fault_control_token", "1000"],
  ],
  "object-smoke": [
    ["dev_cos_config", "/run/dailyenergy/cos.env", "1000"],
    ["dev_cos_secret_id", "/run/secrets/cos_secret_id", "1000"],
    ["dev_cos_secret_key", "/run/secrets/cos_secret_key", "1000"],
  ],
  postgres: [
    ["dev_postgres_password", "/run/secrets/postgres_password", "999"],
  ],
  "worker-background": [
    [
      "dev_database_background_url",
      "/run/secrets/database_background_url",
      "1000",
    ],
  ],
  "worker-interactive": [
    [
      "dev_database_interactive_url",
      "/run/secrets/database_interactive_url",
      "1000",
    ],
  ],
  "worker-restricted": [
    [
      "dev_database_restricted_url",
      "/run/secrets/database_restricted_url",
      "1000",
    ],
  ],
});
const DEV_LITE_CORE_SERVICES = Object.freeze([
  "api",
  "dependency-stub",
  "postgres",
  "redis",
  "tls-proxy",
]);
const DEV_LITE_TRANSIENT_PROFILES = Object.freeze({
  admin: "dev-lite-admin",
  "database-init": "dev-lite-one-shot",
  "database-smoke": "dev-lite-one-shot",
  "database-verify": "dev-lite-one-shot",
  "object-smoke": "dev-lite-one-shot",
  "worker-background": "dev-lite-background",
  "worker-interactive": "dev-lite-interactive",
  "worker-restricted": "dev-lite-restricted",
});
const DEV_LITE_SERVICES = Object.freeze(
  [
    ...DEV_LITE_CORE_SERVICES,
    ...Object.keys(DEV_LITE_TRANSIENT_PROFILES),
  ].sort(),
);
const DEV_LITE_DEPENDENCY_OVERRIDES = Object.freeze([
  "admin",
  "api",
  "database-init",
  "worker-background",
  "worker-interactive",
  "worker-restricted",
]);
const DEV_LITE_PROFILE_OVERRIDES = Object.freeze([
  "admin",
  "api",
  "database-init",
  "dependency-stub",
  "postgres",
  "redis",
  "worker-background",
  "worker-interactive",
  "worker-restricted",
]);
const DEV_LITE_CORE_MEMORY_MIB = Object.freeze({
  api: 224,
  "dependency-stub": 64,
  postgres: 256,
  redis: 96,
  "tls-proxy": 64,
});
const DEV_LITE_RESOURCE_LIMITS = Object.freeze({
  admin: { cpus: 0.4, memory_mib: 256 },
  api: { cpus: 0.5, memory_mib: 224 },
  "database-init": { cpus: 0.6, memory_mib: 512 },
  "database-smoke": { cpus: 0.4, memory_mib: 256 },
  "database-verify": { cpus: 0.5, memory_mib: 384 },
  "dependency-stub": { cpus: 0.1, memory_mib: 64 },
  "object-smoke": { cpus: 0.1, memory_mib: 64 },
  postgres: { cpus: 0.5, memory_mib: 256 },
  redis: { cpus: 0.15, memory_mib: 96 },
  "tls-proxy": { cpus: 0.1, memory_mib: 64 },
  "worker-background": { cpus: 0.4, memory_mib: 256 },
  "worker-interactive": { cpus: 0.4, memory_mib: 256 },
  "worker-restricted": { cpus: 0.4, memory_mib: 256 },
});
const DEV_LITE_DEPENDENCY_STUB_HEALTH_COMMAND =
  "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && head -n 1 <&3 | grep -Eq '^HTTP/1\\.[01] 200 '";
const DEV_LITE_DEPENDENCY_STUB_HEALTHCHECK = Object.freeze({
  interval: "5s",
  retries: 20,
  start_period: "2s",
  test: Object.freeze([
    "CMD",
    "/bin/bash",
    "-c",
    DEV_LITE_DEPENDENCY_STUB_HEALTH_COMMAND,
  ]),
  timeout: "2s",
});
const DEV_LITE_SECRET_FILES = Object.freeze({
  database_admin_url: "database-admin-url",
  database_api_url: "database-api-url",
  database_background_url: "database-background-url",
  database_interactive_url: "database-interactive-url",
  database_migration_url: "database-migration-url",
  database_restricted_url: "database-restricted-url",
  fault_control_token: "fault-control-token",
  postgres_password: "postgres-password",
});
const DEV_LITE_SECRET_GRANTS = Object.freeze({
  api: [["database_api_url", "/run/secrets/database_api_url", "1000"]],
  "database-init": [
    ["database_admin_url", "/run/secrets/database_admin_url", "1000"],
    ["database_api_url", "/run/secrets/database_api_url", "1000"],
    ["database_background_url", "/run/secrets/database_background_url", "1000"],
    [
      "database_interactive_url",
      "/run/secrets/database_interactive_url",
      "1000",
    ],
    ["database_migration_url", "/run/secrets/database_migration_url", "1000"],
    ["database_restricted_url", "/run/secrets/database_restricted_url", "1000"],
  ],
  "database-smoke": [
    ["database_admin_url", "/run/secrets/database_admin_url", "1000"],
  ],
  "database-verify": [
    ["database_admin_url", "/run/secrets/database_admin_url", "1000"],
  ],
  "dependency-stub": [
    ["fault_control_token", "/run/secrets/fault_control_token", "1000"],
  ],
  postgres: [["postgres_password", "/run/secrets/postgres_password", "999"]],
  "worker-background": [
    ["database_background_url", "/run/secrets/database_background_url", "1000"],
  ],
  "worker-interactive": [
    [
      "database_interactive_url",
      "/run/secrets/database_interactive_url",
      "1000",
    ],
  ],
  "worker-restricted": [
    ["database_restricted_url", "/run/secrets/database_restricted_url", "1000"],
  ],
});
const COMPOSE_OVERRIDE_TAGS = Object.freeze(
  ["map", "seq"].map((collection) => ({
    collection,
    resolve: (value) => value,
    tag: "!override",
  })),
);

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameSet(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function validateDevLiteDependencyStubHealthcheck(service, ruleId) {
  const healthcheck = service?.healthcheck;
  if (
    JSON.stringify(healthcheck?.test) !==
      JSON.stringify(DEV_LITE_DEPENDENCY_STUB_HEALTHCHECK.test) ||
    String(healthcheck?.interval) !==
      DEV_LITE_DEPENDENCY_STUB_HEALTHCHECK.interval ||
    String(healthcheck?.timeout) !==
      DEV_LITE_DEPENDENCY_STUB_HEALTHCHECK.timeout ||
    String(healthcheck?.start_period) !==
      DEV_LITE_DEPENDENCY_STUB_HEALTHCHECK.start_period ||
    healthcheck?.retries !== DEV_LITE_DEPENDENCY_STUB_HEALTHCHECK.retries
  ) {
    fail(ruleId, "dependency-stub");
  }
}

function parseComposeSource(source) {
  return parse(source, {
    customTags: COMPOSE_OVERRIDE_TAGS,
    merge: true,
  });
}

function hasOverrideTag(source, serviceName, field) {
  const document = parseDocument(source, {
    customTags: COMPOSE_OVERRIDE_TAGS,
    merge: true,
  });
  return (
    document.getIn(["services", serviceName, field], true)?.tag === "!override"
  );
}

function memoryMiB(value, ruleId, serviceName) {
  const match = /^(\d+)m$/u.exec(String(value));
  if (!match) {
    fail(ruleId, serviceName);
  }
  return Number(match[1]);
}

function validateDevLiteFileSecretGrants(overlay) {
  if (
    !sameSet(
      Object.keys(overlay.secrets ?? {}),
      Object.keys(DEV_LITE_SECRET_FILES),
    ) ||
    Object.entries(DEV_LITE_SECRET_FILES).some(
      ([name, fileName]) =>
        JSON.stringify(overlay.secrets[name]) !==
        JSON.stringify({
          file: `${"${DAILYENERGY_DEV_LITE_COMPOSE_SECRET_DIR:?run the E-017 deploy controller}"}/${fileName}`,
        }),
    )
  ) {
    fail("DEV_LITE_COMPOSE_FILE_SECRET_SET", "top-level");
  }
  for (const [serviceName, service] of Object.entries(overlay.services)) {
    const expected = DEV_LITE_SECRET_GRANTS[serviceName] ?? [];
    const grants = service.secrets ?? [];
    if (
      !Array.isArray(grants) ||
      grants.length !== expected.length ||
      grants.some((grant, index) => {
        const [source, target, identity] = expected[index];
        return (
          JSON.stringify(Object.keys(grant).sort()) !==
            JSON.stringify(["gid", "mode", "source", "target", "uid"]) ||
          grant.source !== source ||
          grant.target !== target ||
          grant.uid !== identity ||
          grant.gid !== identity ||
          grant.mode !== 400
        );
      })
    ) {
      fail("DEV_LITE_COMPOSE_FILE_SECRET_GRANT", serviceName);
    }
  }
}

function validateFileSecretGrants(overlay) {
  if (
    !sameSet(
      Object.keys(overlay.secrets ?? {}),
      Object.keys(DEV_SECRET_FILES),
    ) ||
    Object.entries(DEV_SECRET_FILES).some(
      ([name, fileName]) =>
        JSON.stringify(overlay.secrets[name]) !==
        JSON.stringify({
          file: `${"${DAILYENERGY_DEV_COMPOSE_SECRET_DIR:?run the E-012 deploy controller}"}/${fileName}`,
        }),
    )
  ) {
    fail("DEV_COMPOSE_FILE_SECRET_SET", "top-level");
  }
  for (const [serviceName, expected] of Object.entries(DEV_SECRET_GRANTS)) {
    const grants = overlay.services[serviceName]?.secrets;
    if (
      !Array.isArray(grants) ||
      grants.length !== expected.length ||
      grants.some((grant, index) => {
        const [source, target, identity] = expected[index];
        return (
          JSON.stringify(Object.keys(grant).sort()) !==
            JSON.stringify(["gid", "mode", "source", "target", "uid"]) ||
          grant.source !== source ||
          grant.target !== target ||
          grant.uid !== identity ||
          grant.gid !== identity ||
          grant.mode !== 400
        );
      })
    ) {
      fail("DEV_COMPOSE_FILE_SECRET_GRANT", serviceName);
    }
  }
}

export function validateMergedDevCompose(value) {
  for (const [serviceName, expected] of Object.entries(DEV_SECRET_GRANTS)) {
    const actual = value.services?.[serviceName]?.secrets;
    if (
      value.services?.[serviceName]?.read_only !== true ||
      !Array.isArray(actual) ||
      actual.length !== expected.length ||
      actual.some((grant, index) => {
        const [source, target, identity] = expected[index];
        return (
          grant.source !== source ||
          grant.target !== target ||
          grant.uid !== identity ||
          grant.gid !== identity ||
          grant.mode !== "0400"
        );
      })
    ) {
      fail("DEV_COMPOSE_MERGED_SECRET_GRANT", serviceName);
    }
  }
  const devSecretNames = Object.keys(value.secrets ?? {})
    .filter((name) => name.startsWith("dev_"))
    .sort();
  if (
    !sameSet(devSecretNames, Object.keys(DEV_SECRET_FILES)) ||
    devSecretNames.some(
      (name) =>
        path.basename(value.secrets[name]?.file ?? "") !==
          DEV_SECRET_FILES[name] ||
        Object.hasOwn(value.secrets[name] ?? {}, "environment"),
    ) ||
    JSON.stringify(value).includes("e012-synthetic-secret-canary")
  ) {
    fail("DEV_COMPOSE_MERGED_SECRET_SET", "file");
  }
  return Object.freeze({ grants: 10, secret_sources: devSecretNames.length });
}

function mergedComposeModel() {
  const canary = "e012-synthetic-secret-canary";
  const secretDirectory = mkdtempSync(
    path.join(tmpdir(), "dailyenergy-e012-compose-secrets-"),
  );
  for (const fileName of Object.values(DEV_SECRET_FILES)) {
    writeFileSync(path.join(secretDirectory, fileName), canary, {
      mode: 0o400,
    });
  }
  const environment = {
    ...process.env,
    DAILYENERGY_ADMIN_IMAGE: "synthetic-admin-image",
    DAILYENERGY_API_CAPABILITY_FINGERPRINT: "a".repeat(64),
    DAILYENERGY_API_DEPLOY_FINGERPRINT: "b".repeat(64),
    DAILYENERGY_API_REDIS_URL: "redis://redis:6379",
    DAILYENERGY_CONFIG_DIR: "/srv/dailyenergy/config",
    DAILYENERGY_COS_CONFIG_REF: "dev-cos-config-v1",
    DAILYENERGY_COS_SECRET_DIR:
      "/srv/dailyenergy/secrets/dev-cos-credential-v1",
    DAILYENERGY_DEV_COMPOSE_SECRET_DIR: secretDirectory,
    DAILYENERGY_LOG_LEVEL: "INFO",
    DAILYENERGY_MIGRATION_IMAGE: "synthetic-migration-image",
    DAILYENERGY_PROXY_IMAGE: "synthetic-proxy-image",
    DAILYENERGY_REDIS_KEY_PREFIX: "dailyenergy-dev",
    DAILYENERGY_RELEASE_ID: "dev-synthetic-release",
    DAILYENERGY_RUNTIME_ENVIRONMENT: "DEV",
    DAILYENERGY_SECRET_DIR: "/srv/dailyenergy/secrets/dev-secret-v1",
    DAILYENERGY_SERVER_IMAGE: "synthetic-server-image",
    DAILYENERGY_STUB_IMAGE: "synthetic-stub-image",
    DAILYENERGY_WORKER_BACKGROUND_FINGERPRINT: "c".repeat(64),
    DAILYENERGY_WORKER_INTERACTIVE_FINGERPRINT: "d".repeat(64),
    DAILYENERGY_WORKER_REDIS_URL: "redis://redis:6379",
    DAILYENERGY_WORKER_RESTORE_READINESS: "NORMAL",
    DAILYENERGY_WORKER_RESTRICTED_FINGERPRINT: "e".repeat(64),
  };
  try {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "--project-name",
        "dailyenergy-dev-policy",
        "--file",
        path.join(repositoryRoot, "compose.yaml"),
        "--file",
        path.join(repositoryRoot, "docker/compose.dev.yaml"),
        "--profile",
        "dev",
        "--profile",
        "dev-smoke",
        "config",
        "--format",
        "json",
      ],
      {
        encoding: "utf8",
        env: environment,
        maxBuffer: 2 * 1024 * 1024,
        timeout: 15_000,
      },
    );
    if (result.status !== 0 || result.error) {
      fail("DEV_COMPOSE_MERGED_CONFIG", "docker-compose");
    }
    try {
      return JSON.parse(result.stdout);
    } catch {
      fail("DEV_COMPOSE_MERGED_CONFIG", "json");
    }
  } finally {
    rmSync(secretDirectory, { force: true, recursive: true });
  }
}

export function validateMergedDevLiteCompose(value) {
  if (!sameSet(Object.keys(value.services ?? {}), DEV_LITE_SERVICES)) {
    fail("DEV_LITE_COMPOSE_MERGED_SERVICE_SET", "services");
  }
  for (const [serviceName, expected] of Object.entries(
    DEV_LITE_SECRET_GRANTS,
  )) {
    const actual = value.services?.[serviceName]?.secrets;
    if (
      value.services?.[serviceName]?.read_only !== true ||
      !Array.isArray(actual) ||
      actual.length !== expected.length ||
      actual.some((grant, index) => {
        const [source, target, identity] = expected[index];
        return (
          grant.source !== source ||
          grant.target !== target ||
          grant.uid !== identity ||
          grant.gid !== identity ||
          grant.mode !== "0400"
        );
      })
    ) {
      fail("DEV_LITE_COMPOSE_MERGED_SECRET_GRANT", serviceName);
    }
  }
  const secretNames = Object.keys(value.secrets ?? {}).sort();
  if (
    !sameSet(secretNames, Object.keys(DEV_LITE_SECRET_FILES)) ||
    secretNames.some(
      (name) =>
        path.basename(value.secrets[name]?.file ?? "") !==
          DEV_LITE_SECRET_FILES[name] ||
        Object.hasOwn(value.secrets[name] ?? {}, "environment"),
    ) ||
    JSON.stringify(value).includes("e017-synthetic-secret-canary")
  ) {
    fail("DEV_LITE_COMPOSE_MERGED_SECRET_SET", "file");
  }
  for (const [serviceName, expectedMiB] of Object.entries(
    DEV_LITE_CORE_MEMORY_MIB,
  )) {
    if (
      Number(value.services[serviceName]?.mem_limit) !==
      expectedMiB * 1024 * 1024
    ) {
      fail("DEV_LITE_COMPOSE_MERGED_CORE_MEMORY", serviceName);
    }
  }
  for (const [serviceName, limits] of Object.entries(
    DEV_LITE_RESOURCE_LIMITS,
  )) {
    const service = value.services[serviceName];
    if (
      Number(service?.mem_limit) !== limits.memory_mib * 1024 * 1024 ||
      Number(service?.cpus) !== limits.cpus ||
      Number(service?.pids_limit) !== 128
    ) {
      fail("DEV_LITE_COMPOSE_MERGED_RESOURCE_LIMIT", serviceName);
    }
  }
  validateDevLiteDependencyStubHealthcheck(
    value.services["dependency-stub"],
    "DEV_LITE_COMPOSE_MERGED_HEALTHCHECK",
  );
  for (const [serviceName, profile] of Object.entries(
    DEV_LITE_TRANSIENT_PROFILES,
  )) {
    const service = value.services[serviceName];
    if (JSON.stringify(service?.profiles) !== JSON.stringify([profile])) {
      fail("DEV_LITE_COMPOSE_MERGED_TRANSIENT_PROFILE", serviceName);
    }
    if (
      Object.keys(service.depends_on ?? {}).some(
        (dependency) => !DEV_LITE_CORE_SERVICES.includes(dependency),
      )
    ) {
      fail("DEV_LITE_COMPOSE_MERGED_TRANSIENT_DEPENDENCY", serviceName);
    }
  }
  const smoke = value.services["object-smoke"];
  const smokeCpus = Number(smoke.cpus);
  if (
    smoke.network_mode !== "none" ||
    smoke.mem_limit > 64 * 1024 * 1024 ||
    !Number.isFinite(smokeCpus) ||
    smokeCpus <= 0 ||
    smokeCpus > 0.1 ||
    ["configs", "environment", "networks", "ports", "secrets", "volumes"].some(
      (field) => Object.hasOwn(smoke, field),
    )
  ) {
    fail("DEV_LITE_COMPOSE_MERGED_OBJECT_SMOKE", "capability-boundary");
  }
  for (const serviceName of ["postgres", "redis"]) {
    if ((value.services[serviceName]?.ports?.length ?? 0) !== 0) {
      fail("DEV_LITE_COMPOSE_MERGED_STATEFUL_PORT", serviceName);
    }
  }
  const proxyPorts = value.services["tls-proxy"]?.ports ?? [];
  if (
    proxyPorts.length !== 2 ||
    proxyPorts.some(
      (port) =>
        port.host_ip !== "127.0.0.1" ||
        port.published !== String(port.target) ||
        ![8443, 8444].includes(port.target),
    )
  ) {
    fail("DEV_LITE_COMPOSE_MERGED_TLS_PORT", "loopback");
  }
  return Object.freeze({
    core_memory_mib: Object.values(DEV_LITE_CORE_MEMORY_MIB).reduce(
      (total, value_) => total + value_,
      0,
    ),
    secret_sources: secretNames.length,
    services: Object.keys(value.services).length,
  });
}

function mergedDevLiteComposeModel() {
  const canary = "e017-synthetic-secret-canary";
  const secretDirectory = mkdtempSync(
    path.join(tmpdir(), "dailyenergy-e017-compose-secrets-"),
  );
  for (const fileName of Object.values(DEV_LITE_SECRET_FILES)) {
    writeFileSync(path.join(secretDirectory, fileName), canary, {
      mode: 0o400,
    });
  }
  const environment = {
    ...process.env,
    DAILYENERGY_ADMIN_IMAGE: "synthetic-admin-image",
    DAILYENERGY_API_CAPABILITY_FINGERPRINT: "a".repeat(64),
    DAILYENERGY_API_DEPLOY_FINGERPRINT: "b".repeat(64),
    DAILYENERGY_API_REDIS_URL: "redis://redis:6379",
    DAILYENERGY_CONFIG_DIR: "/srv/dailyenergy/config",
    DAILYENERGY_DEV_LITE_COMPOSE_SECRET_DIR: secretDirectory,
    DAILYENERGY_LOG_LEVEL: "INFO",
    DAILYENERGY_MIGRATION_IMAGE: "synthetic-migration-image",
    DAILYENERGY_PROXY_IMAGE: "synthetic-proxy-image",
    DAILYENERGY_REDIS_KEY_PREFIX: "dailyenergy-dev-lite",
    DAILYENERGY_RELEASE_ID: "dev-lite-synthetic-release",
    DAILYENERGY_RUNTIME_ENVIRONMENT: "DEV",
    DAILYENERGY_SECRET_DIR: secretDirectory,
    DAILYENERGY_SERVER_IMAGE: "synthetic-server-image",
    DAILYENERGY_STUB_IMAGE: "synthetic-stub-image",
    DAILYENERGY_WORKER_BACKGROUND_FINGERPRINT: "c".repeat(64),
    DAILYENERGY_WORKER_INTERACTIVE_FINGERPRINT: "d".repeat(64),
    DAILYENERGY_WORKER_REDIS_URL: "redis://redis:6379",
    DAILYENERGY_WORKER_RESTORE_READINESS: "NORMAL",
    DAILYENERGY_WORKER_RESTRICTED_FINGERPRINT: "e".repeat(64),
  };
  try {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "--project-name",
        "dailyenergy-dev-lite-policy",
        "--file",
        path.join(repositoryRoot, "compose.yaml"),
        "--file",
        path.join(repositoryRoot, "docker/compose.dev-lite.yaml"),
        ...[
          "core",
          "admin",
          "interactive",
          "background",
          "restricted",
          "one-shot",
        ].flatMap((profile) => ["--profile", `dev-lite-${profile}`]),
        "config",
        "--format",
        "json",
      ],
      {
        encoding: "utf8",
        env: environment,
        maxBuffer: 2 * 1024 * 1024,
        timeout: 15_000,
      },
    );
    if (result.status !== 0 || result.error) {
      fail("DEV_LITE_COMPOSE_MERGED_CONFIG", "docker-compose");
    }
    try {
      return JSON.parse(result.stdout);
    } catch {
      fail("DEV_LITE_COMPOSE_MERGED_CONFIG", "json");
    }
  } finally {
    rmSync(secretDirectory, { force: true, recursive: true });
  }
}

export function validateDevComposePolicy({
  base,
  caddyfile,
  cosSmokeSource,
  dockerfile,
  overlay,
}) {
  if (
    base?.services === undefined ||
    overlay?.services === undefined ||
    overlay.name !== "dailyenergy-dev"
  ) {
    fail("DEV_COMPOSE_DOCUMENT", "root");
  }
  if (!sameSet(Object.keys(overlay.services), OVERLAY_SERVICES)) {
    fail("DEV_COMPOSE_SERVICE_SET", "overlay");
  }
  validateFileSecretGrants(overlay);
  for (const serviceName of CORE_DEV_SERVICES) {
    if (
      JSON.stringify(overlay.services[serviceName]?.profiles) !==
      JSON.stringify(["dev"])
    ) {
      fail("DEV_COMPOSE_PROFILE", serviceName);
    }
  }
  if (
    base.services["host-ingress"].profiles.includes("dev") ||
    base.services["fault-proxy"].profiles.includes("dev") ||
    ["database-smoke", "object-smoke"].some(
      (serviceName) =>
        JSON.stringify(overlay.services[serviceName].profiles) !==
        JSON.stringify(["dev-smoke"]),
    )
  ) {
    fail("DEV_COMPOSE_PROFILE_BOUNDARY", "non-runtime");
  }
  for (const [serviceName, service] of Object.entries({
    ...base.services,
    ...overlay.services,
  })) {
    if (Object.hasOwn(service, "build")) {
      fail("DEV_COMPOSE_SERVER_BUILD", serviceName);
    }
    if (
      JSON.stringify([...(service.volumes ?? []), ...(service.configs ?? [])])
        .toLowerCase()
        .includes("docker.sock")
    ) {
      fail("DEV_COMPOSE_DOCKER_SOCKET", serviceName);
    }
  }

  const proxy = overlay.services["tls-proxy"];
  if (
    proxy.image !==
      "${DAILYENERGY_PROXY_IMAGE:?ReleaseManifestV1 proxy digest required}" ||
    proxy.user === "root" ||
    proxy.user === "0" ||
    proxy.read_only !== true ||
    !proxy.cap_drop?.includes("ALL") ||
    !proxy.security_opt?.includes("no-new-privileges:true") ||
    !sameSet(Object.keys(proxy.networks ?? {}), ["admin_api", "dev_ingress"]) ||
    !sameSet(proxy.ports ?? [], [
      "127.0.0.1:${DAILYENERGY_DEV_ADMIN_TLS_PORT:-8444}:8444",
      "127.0.0.1:${DAILYENERGY_DEV_API_TLS_PORT:-8443}:8443",
    ]) ||
    (proxy.secrets?.length ?? 0) !== 0
  ) {
    fail("DEV_COMPOSE_TLS_PROXY", "runtime-boundary");
  }
  for (const port of proxy.ports) {
    if (!String(port).startsWith("127.0.0.1:")) {
      fail("DEV_COMPOSE_PUBLIC_PORT", "tls-proxy");
    }
  }
  const smoke = overlay.services["object-smoke"];
  if (
    smoke.image !==
      "${DAILYENERGY_STUB_IMAGE:?ReleaseManifestV1 stub digest required}" ||
    JSON.stringify(smoke.command) !==
      JSON.stringify(["node", "/app/cos-smoke.mjs"]) ||
    !sameSet(
      (smoke.secrets ?? []).map(({ source }) => source),
      ["dev_cos_config", "dev_cos_secret_id", "dev_cos_secret_key"],
    ) ||
    (smoke.configs?.length ?? 0) !== 0 ||
    !sameSet(Object.keys(smoke.networks ?? {}), ["object_external"])
  ) {
    fail("DEV_COMPOSE_COS_SMOKE", "capability-boundary");
  }
  for (const serviceName of ["database-verify", "database-smoke"]) {
    const service = overlay.services[serviceName];
    if (
      service.image !==
        "${DAILYENERGY_MIGRATION_IMAGE:?ReleaseManifestV1 migration digest required}" ||
      !sameSet(
        (service.secrets ?? []).map(({ target }) => target),
        ["/run/secrets/database_admin_url"],
      ) ||
      !sameSet(Object.keys(service.networks ?? {}), ["migration_data"]) ||
      service.environment?.DATABASE_URL_FILE !==
        "/run/secrets/database_admin_url"
    ) {
      fail("DEV_COMPOSE_DATABASE_PROOF", serviceName);
    }
  }
  for (const [serviceName, service] of Object.entries(overlay.services)) {
    if (
      serviceName !== "object-smoke" &&
      JSON.stringify(service).includes("cos_secret")
    ) {
      fail("DEV_COMPOSE_COS_SECRET_SCOPE", serviceName);
    }
    if (
      serviceName !== "object-smoke" &&
      Object.hasOwn(service.networks ?? {}, "object_external")
    ) {
      fail("DEV_COMPOSE_OBJECT_EGRESS_SCOPE", serviceName);
    }
  }
  if (
    Object.keys(overlay.configs ?? {}).length !== 0 ||
    overlay.networks?.dev_ingress?.driver !== "bridge" ||
    overlay.networks.dev_ingress.driver_opts?.[
      "com.docker.network.bridge.enable_ip_masquerade"
    ] !== "false" ||
    overlay.networks?.object_external?.driver !== "bridge" ||
    overlay.networks.object_external.internal === true
  ) {
    fail("DEV_COMPOSE_NETWORK_OR_MOUNT", "overlay");
  }
  if (
    !String(base.services.postgres.image).includes("@sha256:") ||
    !String(base.services.redis.image).includes("@sha256:") ||
    JSON.stringify(overlay).includes("PRODUCTION")
  ) {
    fail("DEV_COMPOSE_STATEFUL_OR_ENVIRONMENT", "dev-only");
  }

  for (const marker of [
    "admin off",
    "auto_https disable_redirects",
    "https://localhost:8443",
    "https://localhost:8444",
    "tls internal",
    "reverse_proxy api:3000",
    "reverse_proxy admin:3000",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ]) {
    if (!caddyfile.includes(marker)) {
      fail("DEV_CADDY_CONFIG", marker.replaceAll(" ", "-"));
    }
  }
  if (/https?:\/\/(?:0\.0\.0\.0|\[?::\]?):(?:80|443)\b/u.test(caddyfile)) {
    fail("DEV_CADDY_PUBLIC_LISTENER", "80-or-443");
  }
  if (
    !dockerfile.includes(`FROM ${CADDY_BASE} AS e012-proxy`) ||
    !dockerfile.includes(
      "COPY --chown=1000:1000 docker/deployment/Caddyfile /etc/caddy/Caddyfile",
    ) ||
    !dockerfile.includes("cp /usr/bin/caddy /usr/bin/caddy-unprivileged") ||
    !dockerfile.includes("mv /usr/bin/caddy-unprivileged /usr/bin/caddy") ||
    !dockerfile.includes('test -z "$(getcap /usr/bin/caddy)"') ||
    !/AS e012-proxy[\s\S]*?USER 1000:1000/u.test(dockerfile) ||
    /caddy:(?:latest|2|2\.11-alpine)(?:\s|@)/u.test(dockerfile)
  ) {
    fail("DEV_CADDY_IMAGE", "pin-or-user");
  }
  for (const marker of [
    "dev/objects/",
    "healthchecks/",
    '"PUT"',
    '"GET"',
    '"DELETE"',
    '"HEAD"',
    "COS_SMOKE_OK:transport=private-internal",
    "COS_SMOKE_ENDPOINT_NOT_PRIVATE",
  ]) {
    if (!cosSmokeSource.includes(marker)) {
      fail("DEV_COS_SMOKE_SOURCE", marker.replaceAll(" ", "-"));
    }
  }
  return Object.freeze({
    dev_services: CORE_DEV_SERVICES.length + 1,
    object_smoke: "ONE_SHOT",
    public_ports: 0,
    tls_endpoints: 2,
  });
}

export function validateDevLiteComposePolicy({ base, overlay, overlaySource }) {
  if (
    base?.services === undefined ||
    overlay?.services === undefined ||
    overlay.name !== "dailyenergy-dev-lite"
  ) {
    fail("DEV_LITE_COMPOSE_DOCUMENT", "root");
  }
  if (!sameSet(Object.keys(overlay.services), DEV_LITE_SERVICES)) {
    fail("DEV_LITE_COMPOSE_SERVICE_SET", "overlay");
  }
  validateDevLiteFileSecretGrants(overlay);

  for (const serviceName of DEV_LITE_CORE_SERVICES) {
    if (
      JSON.stringify(overlay.services[serviceName]?.profiles) !==
      JSON.stringify(["dev-lite-core"])
    ) {
      fail("DEV_LITE_COMPOSE_PROFILE", serviceName);
    }
    if (
      Object.keys(overlay.services[serviceName]?.depends_on ?? {}).some(
        (dependency) => !DEV_LITE_CORE_SERVICES.includes(dependency),
      )
    ) {
      fail("DEV_LITE_COMPOSE_CORE_DEPENDENCY", serviceName);
    }
  }
  for (const [serviceName, profile] of Object.entries(
    DEV_LITE_TRANSIENT_PROFILES,
  )) {
    const service = overlay.services[serviceName];
    if (JSON.stringify(service?.profiles) !== JSON.stringify([profile])) {
      fail("DEV_LITE_COMPOSE_PROFILE", serviceName);
    }
    const dependencies = Object.keys(service.depends_on ?? {});
    if (
      dependencies.some(
        (dependency) => !DEV_LITE_CORE_SERVICES.includes(dependency),
      )
    ) {
      fail("DEV_LITE_COMPOSE_TRANSIENT_DEPENDENCY", serviceName);
    }
  }
  for (const serviceName of DEV_LITE_DEPENDENCY_OVERRIDES) {
    if (!hasOverrideTag(overlaySource, serviceName, "depends_on")) {
      fail("DEV_LITE_COMPOSE_DEPENDENCY_OVERRIDE", serviceName);
    }
  }
  for (const serviceName of DEV_LITE_PROFILE_OVERRIDES) {
    if (!hasOverrideTag(overlaySource, serviceName, "profiles")) {
      fail("DEV_LITE_COMPOSE_PROFILE_OVERRIDE", serviceName);
    }
  }
  for (const serviceName of ["host-ingress", "fault-proxy"]) {
    if (
      (base.services[serviceName]?.profiles ?? []).some((profile) =>
        String(profile).startsWith("dev-lite-"),
      )
    ) {
      fail("DEV_LITE_COMPOSE_PROFILE_BOUNDARY", serviceName);
    }
  }

  let coreMemoryMiB = 0;
  for (const [serviceName, expectedMiB] of Object.entries(
    DEV_LITE_CORE_MEMORY_MIB,
  )) {
    const actualMiB = memoryMiB(
      overlay.services[serviceName]?.mem_limit,
      "DEV_LITE_COMPOSE_CORE_MEMORY",
      serviceName,
    );
    if (actualMiB !== expectedMiB) {
      fail("DEV_LITE_COMPOSE_CORE_MEMORY", serviceName);
    }
    coreMemoryMiB += actualMiB;
  }
  if (coreMemoryMiB > 704) {
    fail("DEV_LITE_COMPOSE_CORE_MEMORY", "total");
  }
  for (const [serviceName, limits] of Object.entries(
    DEV_LITE_RESOURCE_LIMITS,
  )) {
    const service = overlay.services[serviceName];
    if (
      memoryMiB(
        service?.mem_limit,
        "DEV_LITE_COMPOSE_RESOURCE_LIMIT",
        serviceName,
      ) !== limits.memory_mib ||
      Number(service?.cpus) !== limits.cpus ||
      service?.pids_limit !== 128
    ) {
      fail("DEV_LITE_COMPOSE_RESOURCE_LIMIT", serviceName);
    }
  }
  validateDevLiteDependencyStubHealthcheck(
    overlay.services["dependency-stub"],
    "DEV_LITE_COMPOSE_HEALTHCHECK",
  );

  for (const [serviceName, service] of Object.entries({
    ...base.services,
    ...overlay.services,
  })) {
    if (Object.hasOwn(service, "build")) {
      fail("DEV_LITE_COMPOSE_SERVER_BUILD", serviceName);
    }
    if (
      JSON.stringify([...(service.volumes ?? []), ...(service.configs ?? [])])
        .toLowerCase()
        .includes("docker.sock")
    ) {
      fail("DEV_LITE_COMPOSE_DOCKER_SOCKET", serviceName);
    }
  }
  for (const serviceName of ["postgres", "redis"]) {
    if (
      (base.services[serviceName]?.ports?.length ?? 0) !== 0 ||
      (overlay.services[serviceName]?.ports?.length ?? 0) !== 0
    ) {
      fail("DEV_LITE_COMPOSE_STATEFUL_PORT", serviceName);
    }
  }

  const proxy = overlay.services["tls-proxy"];
  if (
    proxy.image !==
      "${DAILYENERGY_PROXY_IMAGE:?ReleaseManifestV2 proxy digest required}" ||
    proxy.user === "root" ||
    proxy.user === "0" ||
    proxy.read_only !== true ||
    !proxy.cap_drop?.includes("ALL") ||
    !proxy.security_opt?.includes("no-new-privileges:true") ||
    !sameSet(Object.keys(proxy.networks ?? {}), [
      "admin_api",
      "dev_lite_ingress",
    ]) ||
    !sameSet(proxy.ports ?? [], [
      "127.0.0.1:${DAILYENERGY_DEV_ADMIN_TLS_PORT:-8444}:8444",
      "127.0.0.1:${DAILYENERGY_DEV_API_TLS_PORT:-8443}:8443",
    ]) ||
    (proxy.secrets?.length ?? 0) !== 0 ||
    Object.hasOwn(proxy.depends_on ?? {}, "admin")
  ) {
    fail("DEV_LITE_COMPOSE_TLS_PROXY", "runtime-boundary");
  }
  for (const port of proxy.ports) {
    if (!String(port).startsWith("127.0.0.1:")) {
      fail("DEV_LITE_COMPOSE_PUBLIC_PORT", "tls-proxy");
    }
  }

  const smoke = overlay.services["object-smoke"];
  const smokeCpus = Number(smoke.cpus);
  if (
    smoke.image !==
      "${DAILYENERGY_STUB_IMAGE:?ReleaseManifestV2 stub digest required}" ||
    JSON.stringify(smoke.command) !==
      JSON.stringify(["node", "/app/local-object-smoke.mjs"]) ||
    smoke.network_mode !== "none" ||
    smoke.user === "root" ||
    smoke.user === "0" ||
    smoke.read_only !== true ||
    smoke.restart !== "no" ||
    memoryMiB(smoke.mem_limit, "DEV_LITE_COMPOSE_OBJECT_SMOKE", "memory") >
      64 ||
    !Number.isFinite(smokeCpus) ||
    smokeCpus <= 0 ||
    smokeCpus > 0.1 ||
    ["configs", "environment", "networks", "ports", "secrets", "volumes"].some(
      (field) => Object.hasOwn(smoke, field),
    )
  ) {
    fail("DEV_LITE_COMPOSE_OBJECT_SMOKE", "capability-boundary");
  }
  for (const serviceName of [
    "database-init",
    "database-smoke",
    "database-verify",
    "object-smoke",
  ]) {
    if (overlay.services[serviceName].restart !== "no") {
      fail("DEV_LITE_COMPOSE_ONE_SHOT", serviceName);
    }
  }

  if (
    Object.keys(overlay.configs ?? {}).length !== 0 ||
    overlay.networks?.dev_lite_ingress?.driver !== "bridge" ||
    overlay.networks.dev_lite_ingress.driver_opts?.[
      "com.docker.network.bridge.enable_ip_masquerade"
    ] !== "false"
  ) {
    fail("DEV_LITE_COMPOSE_NETWORK_OR_MOUNT", "overlay");
  }
  const serializedOverlay = JSON.stringify(overlay).toLowerCase();
  if (serializedOverlay.includes("cos")) {
    fail("DEV_LITE_COMPOSE_COS_FORBIDDEN", "overlay");
  }
  if (
    serializedOverlay.includes("production_eligible") ||
    serializedOverlay.includes("production_enabled")
  ) {
    fail("DEV_LITE_COMPOSE_RELEASE_SEMANTICS", "manifest-only");
  }
  if (
    !String(base.services.postgres.image).includes("@sha256:") ||
    !String(base.services.redis.image).includes("@sha256:")
  ) {
    fail("DEV_LITE_COMPOSE_STATEFUL_IMAGE", "digest");
  }

  return Object.freeze({
    core_memory_mib: coreMemoryMiB,
    core_services: DEV_LITE_CORE_SERVICES.length,
    object_smoke: "LOCAL_ONE_SHOT",
    public_ports: 0,
    transient_profiles: new Set(Object.values(DEV_LITE_TRANSIENT_PROFILES))
      .size,
  });
}

async function main() {
  const [
    baseSource,
    overlaySource,
    devLiteOverlaySource,
    dockerfile,
    caddyfile,
    cosSmokeSource,
  ] = await Promise.all([
    readFile(path.join(repositoryRoot, "compose.yaml"), "utf8"),
    readFile(path.join(repositoryRoot, "docker/compose.dev.yaml"), "utf8"),
    readFile(path.join(repositoryRoot, "docker/compose.dev-lite.yaml"), "utf8"),
    readFile(path.join(repositoryRoot, "Dockerfile"), "utf8"),
    readFile(path.join(repositoryRoot, "docker/deployment/Caddyfile"), "utf8"),
    readFile(
      path.join(repositoryRoot, "tooling/deployment/cos-smoke.mjs"),
      "utf8",
    ),
  ]);
  const base = parse(baseSource, { merge: true });
  const result = validateDevComposePolicy({
    base,
    caddyfile,
    cosSmokeSource,
    dockerfile,
    overlay: parse(overlaySource, { merge: true }),
  });
  const merged = validateMergedDevCompose(mergedComposeModel());
  const devLiteResult = validateDevLiteComposePolicy({
    base,
    overlay: parseComposeSource(devLiteOverlaySource),
    overlaySource: devLiteOverlaySource,
  });
  const devLiteMerged = validateMergedDevLiteCompose(
    mergedDevLiteComposeModel(),
  );
  process.stdout.write(
    `DEV_COMPOSE_POLICY_OK:services=${result.dev_services}:tls=${result.tls_endpoints}:public_ports=${result.public_ports}:object_smoke=${result.object_smoke}:file_secrets=${merged.secret_sources}:dev_lite_services=${devLiteMerged.services}:dev_lite_core_memory_mib=${devLiteResult.core_memory_mib}:dev_lite_file_secrets=${devLiteMerged.secret_sources}\n`,
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
