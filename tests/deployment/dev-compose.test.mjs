import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { cosSmokeTesting } from "../../tooling/deployment/cos-smoke.mjs";
import { validateDevComposePolicy } from "../../tooling/deployment/dev-compose-policy.mjs";
import { developmentDeploymentCommands } from "../../tooling/deployment/deploy-dev.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const sources = await Promise.all([
  readFile(path.join(repositoryRoot, "compose.yaml"), "utf8"),
  readFile(path.join(repositoryRoot, "docker/compose.dev.yaml"), "utf8"),
  readFile(path.join(repositoryRoot, "Dockerfile"), "utf8"),
  readFile(path.join(repositoryRoot, "docker/deployment/Caddyfile"), "utf8"),
  readFile(
    path.join(repositoryRoot, "tooling/deployment/cos-smoke.mjs"),
    "utf8",
  ),
  readFile(
    path.join(repositoryRoot, "tooling/deployment/bootstrap-host.sh"),
    "utf8",
  ),
]);

function policyInput() {
  return {
    base: parse(sources[0], { merge: true }),
    caddyfile: sources[3],
    cosSmokeSource: sources[4],
    dockerfile: sources[2],
    overlay: parse(sources[1], { merge: true }),
  };
}

test("T-E012-COMPOSE-001 accepts loopback-only TLS and DEV co-location", () => {
  assert.deepEqual(validateDevComposePolicy(policyInput()), {
    dev_services: 11,
    object_smoke: "ONE_SHOT",
    public_ports: 0,
    tls_endpoints: 2,
  });
});

test("T-E012-COMPOSE-001 keeps host health probes aligned with Caddy Host and SNI", () => {
  const caddyOrigins = new Set(
    [...sources[3].matchAll(/^https:\/\/(localhost:\d+) \{/gmu)].map(
      ([, origin]) => origin,
    ),
  );
  const commands = developmentDeploymentCommands(
    "/srv/dailyenergy/bundles/synthetic",
    "/srv/dailyenergy/bundles/synthetic/release.env",
  );
  const healthOrigins = new Set(
    [...commands.health, ...commands["maintenance-off"]].map(
      (command) => new URL(command.arguments.at(-1)).host,
    ),
  );
  assert.deepEqual(healthOrigins, caddyOrigins);
  for (const command of [...commands.health, ...commands["maintenance-off"]]) {
    const url = new URL(command.arguments.at(-1));
    assert.ok(
      command.arguments.includes(`${url.host}:127.0.0.1`),
      `${url.host} must resolve to loopback without changing Host/SNI`,
    );
  }
});

test("T-E012-COMPOSE-001 rejects public ingress and server-side builds", () => {
  const publicIngress = policyInput();
  publicIngress.overlay.services["tls-proxy"].ports[0] = "0.0.0.0:8443:8443";
  assert.throws(
    () => validateDevComposePolicy(publicIngress),
    /DEV_COMPOSE_TLS_PROXY/u,
  );

  const serverBuild = policyInput();
  serverBuild.overlay.services.api.build = ".";
  assert.throws(
    () => validateDevComposePolicy(serverBuild),
    /DEV_COMPOSE_SERVER_BUILD:api/u,
  );

  const worldReadableSecret = policyInput();
  worldReadableSecret.overlay.services.api.secrets[0].mode = 444;
  assert.throws(
    () => validateDevComposePolicy(worldReadableSecret),
    /DEV_COMPOSE_FILE_SECRET_GRANT:api/u,
  );

  const environmentSecret = policyInput();
  environmentSecret.overlay.secrets.dev_database_api_url = {
    environment: "DAILYENERGY_DEV_DATABASE_API_URL",
  };
  assert.throws(
    () => validateDevComposePolicy(environmentSecret),
    /DEV_COMPOSE_FILE_SECRET_SET:top-level/u,
  );

  const privilegedCaddyBinary = policyInput();
  privilegedCaddyBinary.dockerfile = privilegedCaddyBinary.dockerfile.replace(
    "cp /usr/bin/caddy /usr/bin/caddy-unprivileged",
    "cp /usr/bin/caddy /usr/bin/caddy",
  );
  assert.throws(
    () => validateDevComposePolicy(privilegedCaddyBinary),
    /DEV_CADDY_IMAGE:pin-or-user/u,
  );
});

test("T-E012-COMPOSE-001 keeps COS credential and egress on one-shot smoke only", () => {
  const leakedCredential = policyInput();
  leakedCredential.overlay.services.api.secrets = [
    {
      gid: "1000",
      mode: 400,
      source: "dev_cos_secret_key",
      target: "/run/secrets/cos_secret_key",
      uid: "1000",
    },
  ];
  assert.throws(
    () => validateDevComposePolicy(leakedCredential),
    /DEV_COMPOSE_FILE_SECRET_GRANT:api/u,
  );

  const broadEgress = policyInput();
  broadEgress.overlay.services["worker-restricted"].networks = {
    object_external: {},
  };
  assert.throws(
    () => validateDevComposePolicy(broadEgress),
    /DEV_COMPOSE_OBJECT_EGRESS_SCOPE:worker-restricted/u,
  );
});

test("T-E012-COS-001 closes config scope and signing diagnostics", () => {
  const config = [
    "COS_BUCKET=dailyenergy-dev-1250000000",
    "COS_ENDPOINT=dailyenergy-dev-1250000000.cos-internal.ap-shanghai.tencentcos.cn",
    "COS_PREFIX=dev/objects/",
    "COS_REGION=ap-shanghai",
    "",
  ].join("\n");
  assert.deepEqual(cosSmokeTesting.parseConfig(config), {
    COS_BUCKET: "dailyenergy-dev-1250000000",
    COS_ENDPOINT:
      "dailyenergy-dev-1250000000.cos-internal.ap-shanghai.tencentcos.cn",
    COS_PREFIX: "dev/objects/",
    COS_REGION: "ap-shanghai",
  });
  assert.throws(
    () => cosSmokeTesting.parseConfig(`${config}COS_SECRET_KEY=forbidden\n`),
    /COS_SMOKE_CONFIG_KEYS/u,
  );
  assert.equal(cosSmokeTesting.isPrivateAddress("169.254.0.47"), true);
  assert.equal(cosSmokeTesting.isPrivateAddress("10.0.0.10"), true);
  assert.equal(cosSmokeTesting.isPrivateAddress("20.205.243.164"), false);
  const authorization = cosSmokeTesting.authorization(
    "PUT",
    "dev/objects/healthchecks/00000000-0000-4000-8000-000000000000",
    "dailyenergy-dev-1250000000.cos-internal.ap-shanghai.tencentcos.cn",
    "SYNTHETIC_SECRET_ID",
    "SYNTHETIC_SECRET_KEY",
    1_786_000_000_000,
  );
  assert.match(
    authorization,
    /^q-sign-algorithm=sha1&q-ak=SYNTHETIC_SECRET_ID&q-sign-time=\d+;\d+&q-key-time=\d+;\d+&q-header-list=host&q-url-param-list=&q-signature=[a-f0-9]{40}$/u,
  );
  assert.equal(authorization.includes("SYNTHETIC_SECRET_KEY"), false);
});

test("T-E012-HOST-001 pins an isolated checksum-verified deployment runtime", () => {
  const script = sources[5];
  for (const marker of [
    'NODE_VERSION="24.18.0"',
    'NODE_SHA256="55aa7153f9d88f28d765fcdad5ae6945b5c0f98a36881703817e4c450fa76742"',
    'RUNTIME_ROOT="/opt/dailyenergy/runtime"',
    "curl --fail --location --proto '=https' --tlsv1.2",
    "sha256sum --check --status",
    "existing-runtime-drift",
    "E012_HOST_BOOTSTRAP_OK:node=${NODE_VERSION}:runtime=isolated",
  ]) {
    assert.ok(script.includes(marker), marker);
  }
  assert.equal(/curl[^\n]*\|\s*(?:ba)?sh\b/u.test(script), false);
  assert.equal(/(?:apt|npm|pnpm)\s+(?:install|add)\b/u.test(script), false);
  assert.equal(script.includes("/usr/bin/node"), false);
});
