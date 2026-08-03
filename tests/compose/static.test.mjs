#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parse } from "yaml";

import {
  loadAndValidateComposeStatic,
  validateComposeStatic,
} from "../../tooling/compose/check-static.mjs";
import { validateComposeImageInventory } from "../../tooling/compose/check-image-content.mjs";
import { parseArguments } from "../../tooling/compose/control.mjs";

async function fixture() {
  const read = (file) => readFile(file, "utf8");
  const compose = parse(await read("compose.yaml"), { merge: true });
  const overlays = {};
  for (const name of ["local", "test", "staging-like", "fault"]) {
    overlays[name] = parse(
      await read(
        name === "fault"
          ? "docker/compose.fault.yaml"
          : `docker/compose.${name}.yaml`,
      ),
      { merge: true },
    );
  }
  return {
    compose,
    dockerfile: await read("Dockerfile"),
    dockerignore: await read(".dockerignore"),
    faultSource: `${await read("tooling/compose/stub-server.mjs")}\n${await read("tooling/compose/fault-proxy.mjs")}`,
    overlays,
  };
}

test("T-COMPOSE-STATIC-001 accepts the bounded E-009 topology", async () => {
  await assert.doesNotReject(loadAndValidateComposeStatic());
  assert.deepEqual(await loadAndValidateComposeStatic(), {
    networks: 11,
    services: 11,
  });
});

test("T-COMPOSE-STATIC-002 rejects privileged mounts and public data ports", async () => {
  const socket = await fixture();
  socket.compose.services.api.volumes = [
    "/var/run/docker.sock:/var/run/docker.sock",
  ];
  assert.throws(
    () => validateComposeStatic(socket),
    /COMPOSE_DOCKER_SOCKET:api/u,
  );

  const port = await fixture();
  port.overlays.local.services.postgres = { ports: ["0.0.0.0:5432:5432"] };
  assert.throws(
    () => validateComposeStatic(port),
    /COMPOSE_PORT_NOT_LOOPBACK:local:postgres/u,
  );
});

test("T-COMPOSE-STATIC-003 rejects cross-profile secrets and external networks", async () => {
  const secret = await fixture();
  secret.compose.services.api.secrets.push("database_migration_url");
  assert.throws(
    () => validateComposeStatic(secret),
    /COMPOSE_SECRET_ALLOWLIST:api/u,
  );

  const network = await fixture();
  network.compose.networks.api_external.internal = false;
  assert.throws(
    () => validateComposeStatic(network),
    /COMPOSE_NETWORK_NOT_INTERNAL:api_external/u,
  );

  const ingress = await fixture();
  ingress.overlays.test.networks.host_ingress.driver_opts[
    "com.docker.network.bridge.enable_ip_masquerade"
  ] = "true";
  assert.throws(
    () => validateComposeStatic(ingress),
    /COMPOSE_HOST_INGRESS_EGRESS:test/u,
  );

  const ingressScope = await fixture();
  ingressScope.overlays.test.services.api = {
    networks: {
      host_ingress: null,
    },
  };
  assert.throws(
    () => validateComposeStatic(ingressScope),
    /COMPOSE_HOST_INGRESS_SERVICE:test/u,
  );
});

test("T-COMPOSE-STATIC-004 rejects floating images and inline credentials", async () => {
  const image = await fixture();
  image.compose.services.redis.image = "redis:latest";
  assert.throws(
    () => validateComposeStatic(image),
    /COMPOSE_IMAGE_NOT_PINNED:redis/u,
  );

  const offlineBuild = await fixture();
  offlineBuild.dockerfile = offlineBuild.dockerfile.replace(
    "pnpm install --frozen-lockfile",
    "pnpm install --offline --frozen-lockfile",
  );
  assert.throws(
    () => validateComposeStatic(offlineBuild),
    /COMPOSE_CLEAN_BUILD_INSTALL:Dockerfile/u,
  );

  const secret = await fixture();
  secret.compose.services.api.environment.PROVIDER_TOKEN = "synthetic-inline";
  assert.throws(
    () => validateComposeStatic(secret),
    /COMPOSE_INLINE_SECRET:api:PROVIDER_TOKEN/u,
  );
});

test("T-COMPOSE-STATIC-005 rejects non-test fault profiles", () => {
  assert.throws(
    () => parseArguments(["up", "--mode=local", "--fault"]),
    /COMPOSE_FAULT_MODE_INVALID/u,
  );
  assert.throws(
    () => parseArguments(["up", "--mode=staging-like", "--fault"]),
    /COMPOSE_FAULT_MODE_INVALID/u,
  );
  assert.equal(
    parseArguments(["up", "--mode=test", "--fault"]).options.fault,
    true,
  );
});

test("T-COMPOSE-STATIC-006 rejects repository fixtures and secret values in images", () => {
  const valid = {
    admin: { environment: ["NODE_ENV=production"], paths: ["/app/server.js"] },
    migration: {
      environment: ["NODE_VERSION=24.18.0"],
      paths: ["/workspace/prisma/seed/synthetic-v1.json"],
    },
    server: {
      environment: ["NODE_ENV=production"],
      paths: ["/app/api/dist/main.js"],
    },
    stub: {
      environment: ["NODE_VERSION=24.18.0"],
      paths: ["/app/stub-server.mjs"],
    },
  };
  assert.deepEqual(validateComposeImageInventory(valid), { images: 4 });

  const fixture = structuredClone(valid);
  fixture.server.paths.push("/app/api/test-fixtures/slow-shutdown.ts");
  assert.throws(
    () => validateComposeImageInventory(fixture),
    /COMPOSE_IMAGE_CONTENT:server/u,
  );

  const secret = structuredClone(valid);
  secret.admin.environment.push("ADMIN_SESSION_SECRET=synthetic-canary");
  assert.throws(
    () => validateComposeImageInventory(secret),
    /COMPOSE_IMAGE_INLINE_SECRET:admin/u,
  );
});
