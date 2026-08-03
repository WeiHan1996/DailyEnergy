#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parse } from "yaml";

const runtimeProfiles = ["local", "test", "staging-like"];
const hostIngressNetwork = "host_ingress";
const secretAllowlist = Object.freeze({
  admin: [],
  api: ["database_api_url"],
  "database-init": [
    "database_admin_url",
    "database_api_url",
    "database_background_url",
    "database_interactive_url",
    "database_migration_url",
    "database_restricted_url",
  ],
  "dependency-stub": ["fault_control_token"],
  "fault-proxy": ["fault_control_token"],
  "host-ingress": [],
  postgres: ["postgres_password"],
  redis: [],
  "worker-background": ["database_background_url"],
  "worker-interactive": ["database_interactive_url"],
  "worker-restricted": ["database_restricted_url"],
});

const networkAllowlist = Object.freeze({
  admin: ["admin_api"],
  api: ["admin_api", "api_data", "api_external"],
  "database-init": ["migration_data"],
  "dependency-stub": [
    "api_external",
    "background_external",
    "fault_control",
    "interactive_external",
    "restricted_external",
  ],
  "fault-proxy": [
    "api_data",
    "background_data",
    "fault_control",
    "interactive_data",
    "restricted_data",
  ],
  "host-ingress": ["admin_api", "fault_control"],
  postgres: [
    "api_data",
    "background_data",
    "interactive_data",
    "migration_data",
    "restricted_data",
  ],
  redis: ["background_data", "interactive_data", "restricted_data"],
  "worker-background": ["background_data", "background_external"],
  "worker-interactive": ["interactive_data", "interactive_external"],
  "worker-restricted": ["restricted_data", "restricted_external"],
});

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function sorted(value) {
  return [...value].sort((left, right) => left.localeCompare(right));
}

function assertEqual(ruleId, detail, actual, expected) {
  if (JSON.stringify(sorted(actual)) !== JSON.stringify(sorted(expected))) {
    fail(ruleId, detail);
  }
}

export function validateComposeStatic({
  compose,
  dockerfile,
  dockerignore,
  overlays,
  faultSource,
}) {
  const services = compose?.services;
  if (!services || typeof services !== "object") {
    fail("COMPOSE_TOPOLOGY_MISSING", "services");
  }
  assertEqual(
    "COMPOSE_SERVICE_SET",
    "root",
    Object.keys(services),
    Object.keys(secretAllowlist),
  );

  for (const [name, service] of Object.entries(services)) {
    if (service.read_only !== true) {
      fail("COMPOSE_READ_ONLY", name);
    }
    if (!service.cap_drop?.includes("ALL")) {
      fail("COMPOSE_CAPABILITY_DROP", name);
    }
    if (!service.security_opt?.includes("no-new-privileges:true")) {
      fail("COMPOSE_NO_NEW_PRIVILEGES", name);
    }
    if (
      service.user === "root" ||
      service.user === "0" ||
      service.user === "0:0"
    ) {
      fail("COMPOSE_ROOT_USER", name);
    }
    if (Object.hasOwn(service, "ports")) {
      fail("COMPOSE_ROOT_PORT", name);
    }
    const mounts = [...(service.volumes ?? []), ...(service.configs ?? [])];
    if (JSON.stringify(mounts).includes("docker.sock")) {
      fail("COMPOSE_DOCKER_SOCKET", name);
    }
    assertEqual(
      "COMPOSE_SECRET_ALLOWLIST",
      name,
      (service.secrets ?? []).map((secret) =>
        typeof secret === "string" ? secret : secret.source,
      ),
      secretAllowlist[name],
    );
    assertEqual(
      "COMPOSE_NETWORK_ALLOWLIST",
      name,
      Object.keys(service.networks ?? {}),
      networkAllowlist[name],
    );
    const expectedProfiles =
      name === "fault-proxy" ? ["fault"] : runtimeProfiles;
    assertEqual(
      "COMPOSE_PROFILE_SET",
      name,
      service.profiles ?? [],
      expectedProfiles,
    );

    for (const [key, value] of Object.entries(service.environment ?? {})) {
      if (/(?:PASSWORD|SECRET|TOKEN)$/u.test(key) && !key.endsWith("_FILE")) {
        fail("COMPOSE_INLINE_SECRET", `${name}:${key}`);
      }
      if (typeof value === "string" && /:\/\/[^/\s]+:[^/@\s]+@/u.test(value)) {
        fail("COMPOSE_CREDENTIAL_URL", `${name}:${key}`);
      }
    }
  }

  for (const [name, network] of Object.entries(compose.networks ?? {})) {
    if (network.internal !== true) {
      fail("COMPOSE_NETWORK_NOT_INTERNAL", name);
    }
  }
  if (!String(services.postgres.image).includes("@sha256:")) {
    fail("COMPOSE_IMAGE_NOT_PINNED", "postgres");
  }
  if (!String(services.redis.image).includes("@sha256:")) {
    fail("COMPOSE_IMAGE_NOT_PINNED", "redis");
  }
  for (const name of [
    "admin",
    "api",
    "database-init",
    "dependency-stub",
    "fault-proxy",
    "host-ingress",
    "worker-background",
    "worker-interactive",
    "worker-restricted",
  ]) {
    if (!String(services[name].image).includes(":?run pnpm compose:prepare")) {
      fail("COMPOSE_APP_IMAGE_REQUIRED", name);
    }
  }
  if (
    JSON.stringify(services.api.command).includes("migrat") ||
    services.api.environment.DAILYENERGY_DATABASE_URL_FILE !==
      "/run/secrets/database_api_url"
  ) {
    fail("COMPOSE_API_MIGRATION_CAPABILITY", "api");
  }
  if (
    !JSON.stringify(services["database-init"].command).includes(
      "provision-database.mjs",
    ) ||
    services["database-init"].restart !== "no"
  ) {
    fail("COMPOSE_MIGRATION_JOB_INVALID", "database-init");
  }

  for (const [name, overlay] of Object.entries(overlays)) {
    if (runtimeProfiles.includes(name)) {
      const ingress = overlay.networks?.[hostIngressNetwork];
      if (
        ingress?.driver !== "bridge" ||
        ingress.internal === true ||
        ingress.driver_opts?.[
          "com.docker.network.bridge.enable_ip_masquerade"
        ] !== "false"
      ) {
        fail("COMPOSE_HOST_INGRESS_EGRESS", name);
      }
      assertEqual(
        "COMPOSE_HOST_INGRESS_SERVICE",
        name,
        Object.entries(overlay.services ?? {})
          .filter(([, service]) =>
            Object.hasOwn(service.networks ?? {}, hostIngressNetwork),
          )
          .map(([serviceName]) => serviceName),
        ["host-ingress"],
      );
    } else if (Object.hasOwn(overlay.networks ?? {}, hostIngressNetwork)) {
      fail("COMPOSE_HOST_INGRESS_PROFILE", name);
    }
    for (const [serviceName, service] of Object.entries(
      overlay.services ?? {},
    )) {
      for (const port of service.ports ?? []) {
        if (!String(port).startsWith("127.0.0.1:")) {
          fail("COMPOSE_PORT_NOT_LOOPBACK", `${name}:${serviceName}`);
        }
      }
      const allowed = ["host-ingress"];
      if ((service.ports?.length ?? 0) > 0 && !allowed.includes(serviceName)) {
        fail("COMPOSE_PORT_SERVICE_INVALID", `${name}:${serviceName}`);
      }
    }
  }

  const baseImage =
    "node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d";
  if ((dockerfile.match(new RegExp(baseImage, "gu")) ?? []).length !== 5) {
    fail("COMPOSE_NODE_IMAGE_PIN", "Dockerfile");
  }
  if (/(?:latest|node:lts|node:24(?:\s|$))/u.test(dockerfile)) {
    fail("COMPOSE_FLOATING_IMAGE", "Dockerfile");
  }
  if (
    !dockerfile.includes("pnpm install --frozen-lockfile") ||
    /pnpm install[^\n]*--offline/u.test(dockerfile)
  ) {
    fail("COMPOSE_CLEAN_BUILD_INSTALL", "Dockerfile");
  }
  if (
    dockerfile.includes("FROM build AS e009-migration") ||
    !dockerfile.includes(`${baseImage} AS e009-migration`)
  ) {
    fail("COMPOSE_MIGRATION_IMAGE_INHERITS_BUILD", "Dockerfile");
  }
  for (const ignored of [".git", "**/.env*", "**/node_modules", ".artifacts"]) {
    if (!dockerignore.split("\n").includes(ignored)) {
      fail("COMPOSE_BUILD_CONTEXT_EXPOSURE", ignored);
    }
  }
  for (const marker of [
    "postgres",
    "redis",
    "provider",
    "network",
    "clock",
    "telemetry",
  ]) {
    if (!faultSource.includes(marker)) {
      fail("COMPOSE_FAULT_MISSING", marker);
    }
  }
  return Object.freeze({
    networks: Object.keys(compose.networks).length,
    services: Object.keys(services).length,
  });
}

export async function loadAndValidateComposeStatic() {
  const read = (file) => readFile(path.resolve(file), "utf8");
  const [
    composeSource,
    dockerfile,
    dockerignore,
    faultSource,
    ...overlaySources
  ] = await Promise.all([
    read("compose.yaml"),
    read("Dockerfile"),
    read(".dockerignore"),
    Promise.all([
      read("tooling/compose/stub-server.mjs"),
      read("tooling/compose/fault-proxy.mjs"),
    ]).then((values) => values.join("\n")),
    read("docker/compose.local.yaml"),
    read("docker/compose.test.yaml"),
    read("docker/compose.staging-like.yaml"),
    read("docker/compose.fault.yaml"),
  ]);
  return validateComposeStatic({
    compose: parse(composeSource, { merge: true }),
    dockerfile,
    dockerignore,
    faultSource,
    overlays: Object.fromEntries(
      ["local", "test", "staging-like", "fault"].map((name, index) => [
        name,
        parse(overlaySources[index], { merge: true }),
      ]),
    ),
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await loadAndValidateComposeStatic();
  console.log(
    `COMPOSE_STATIC_OK:services=${result.services}:networks=${result.networks}`,
  );
}
