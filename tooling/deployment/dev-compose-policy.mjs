#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parse } from "yaml";

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
const DEV_SECRET_ENVIRONMENTS = Object.freeze({
  dev_cos_config: "DAILYENERGY_DEV_COS_CONFIG",
  dev_cos_secret_id: "DAILYENERGY_DEV_COS_SECRET_ID",
  dev_cos_secret_key: "DAILYENERGY_DEV_COS_SECRET_KEY",
  dev_database_admin_url: "DAILYENERGY_DEV_DATABASE_ADMIN_URL",
  dev_database_api_url: "DAILYENERGY_DEV_DATABASE_API_URL",
  dev_database_background_url: "DAILYENERGY_DEV_DATABASE_BACKGROUND_URL",
  dev_database_interactive_url: "DAILYENERGY_DEV_DATABASE_INTERACTIVE_URL",
  dev_database_migration_url: "DAILYENERGY_DEV_DATABASE_MIGRATION_URL",
  dev_database_restricted_url: "DAILYENERGY_DEV_DATABASE_RESTRICTED_URL",
  dev_fault_control_token: "DAILYENERGY_DEV_FAULT_CONTROL_TOKEN",
  dev_postgres_password: "DAILYENERGY_DEV_POSTGRES_PASSWORD",
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

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameSet(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function validateEnvironmentSecretGrants(overlay) {
  if (
    !sameSet(
      Object.keys(overlay.secrets ?? {}),
      Object.keys(DEV_SECRET_ENVIRONMENTS),
    ) ||
    Object.entries(DEV_SECRET_ENVIRONMENTS).some(
      ([name, environment]) =>
        JSON.stringify(overlay.secrets[name]) !==
        JSON.stringify({ environment }),
    )
  ) {
    fail("DEV_COMPOSE_ENVIRONMENT_SECRET_SET", "top-level");
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
      fail("DEV_COMPOSE_ENVIRONMENT_SECRET_GRANT", serviceName);
    }
  }
}

export function validateMergedDevCompose(value) {
  for (const [serviceName, expected] of Object.entries(DEV_SECRET_GRANTS)) {
    const actual = value.services?.[serviceName]?.secrets;
    if (
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
    !sameSet(devSecretNames, Object.keys(DEV_SECRET_ENVIRONMENTS)) ||
    devSecretNames.some(
      (name) =>
        value.secrets[name]?.environment !== DEV_SECRET_ENVIRONMENTS[name],
    ) ||
    JSON.stringify(value).includes("e012-synthetic-secret-canary")
  ) {
    fail("DEV_COMPOSE_MERGED_SECRET_SET", "environment");
  }
  return Object.freeze({ grants: 10, secret_sources: devSecretNames.length });
}

function mergedComposeModel() {
  const canary = "e012-synthetic-secret-canary";
  const environment = {
    ...process.env,
    DAILYENERGY_ADMIN_IMAGE: "synthetic-admin-image",
    DAILYENERGY_API_CAPABILITY_FINGERPRINT: "a".repeat(64),
    DAILYENERGY_API_DEPLOY_FINGERPRINT: "b".repeat(64),
    DAILYENERGY_CONFIG_DIR: "/srv/dailyenergy/config",
    DAILYENERGY_COS_CONFIG_REF: "dev-cos-config-v1",
    DAILYENERGY_COS_SECRET_DIR:
      "/srv/dailyenergy/secrets/dev-cos-credential-v1",
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
  for (const name of Object.values(DEV_SECRET_ENVIRONMENTS)) {
    environment[name] = canary;
  }
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
  validateEnvironmentSecretGrants(overlay);
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

async function main() {
  const [baseSource, overlaySource, dockerfile, caddyfile, cosSmokeSource] =
    await Promise.all([
      readFile(path.join(repositoryRoot, "compose.yaml"), "utf8"),
      readFile(path.join(repositoryRoot, "docker/compose.dev.yaml"), "utf8"),
      readFile(path.join(repositoryRoot, "Dockerfile"), "utf8"),
      readFile(
        path.join(repositoryRoot, "docker/deployment/Caddyfile"),
        "utf8",
      ),
      readFile(
        path.join(repositoryRoot, "tooling/deployment/cos-smoke.mjs"),
        "utf8",
      ),
    ]);
  const result = validateDevComposePolicy({
    base: parse(baseSource, { merge: true }),
    caddyfile,
    cosSmokeSource,
    dockerfile,
    overlay: parse(overlaySource, { merge: true }),
  });
  const merged = validateMergedDevCompose(mergedComposeModel());
  process.stdout.write(
    `DEV_COMPOSE_POLICY_OK:services=${result.dev_services}:tls=${result.tls_endpoints}:public_ports=${result.public_ports}:object_smoke=${result.object_smoke}:environment_secrets=${merged.secret_sources}\n`,
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
