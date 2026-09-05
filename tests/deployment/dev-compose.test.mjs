import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { cosSmokeTesting } from "../../tooling/deployment/cos-smoke.mjs";
import {
  mergedDevLiteComposeModel,
  validateDevComposePolicy,
  validateDevLiteComposePolicy,
  validateMergedDevLiteCompose,
} from "../../tooling/deployment/dev-compose-policy.mjs";
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
  readFile(path.join(repositoryRoot, "docker/compose.dev-lite.yaml"), "utf8"),
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

function devLitePolicyInput() {
  return {
    base: parse(sources[0], { merge: true }),
    overlay: parse(sources[6], {
      customTags: [
        {
          collection: "map",
          resolve: (value) => value,
          tag: "!override",
        },
        {
          collection: "seq",
          resolve: (value) => value,
          tag: "!override",
        },
      ],
      merge: true,
    }),
    overlaySource: sources[6],
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

test("T-E012-COMPOSE-001 preserves the database smoke executable when adding a phase", () => {
  const commands = developmentDeploymentCommands(
    "/srv/dailyenergy/bundles/synthetic",
    "/srv/dailyenergy/bundles/synthetic/release.env",
  );
  const serviceCommand =
    policyInput().overlay.services["database-smoke"].command;
  const cases = [
    ["smoke-safety", "safety"],
    ["smoke-owner", "owner"],
    ["smoke-delete", "deletion"],
  ];

  for (const [phase, mode] of cases) {
    const arguments_ = commands[phase][0].arguments;
    const serviceIndex = arguments_.lastIndexOf("database-smoke");
    assert.notEqual(serviceIndex, -1, phase);
    assert.deepEqual(
      arguments_.slice(serviceIndex + 1),
      [...serviceCommand, mode],
      `${phase} must execute the Compose service command before its mode`,
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

test("T-E017-COMPOSE-001 accepts the bounded DEV_LITE core and isolated transient profiles", () => {
  assert.deepEqual(validateDevLiteComposePolicy(devLitePolicyInput()), {
    core_memory_mib: 704,
    core_services: 5,
    object_smoke: "LOCAL_ONE_SHOT",
    public_ports: 0,
    transient_profiles: 5,
  });

  const { overlay } = devLitePolicyInput();
  const core = new Set([
    "api",
    "dependency-stub",
    "postgres",
    "redis",
    "tls-proxy",
  ]);
  const transient = Object.entries(overlay.services).filter(
    ([serviceName]) => !core.has(serviceName),
  );
  for (const [serviceName, service] of transient) {
    assert.equal(service.profiles.length, 1, serviceName);
    assert.equal(service.restart, "no", serviceName);
    assert.ok(
      Object.keys(service.depends_on ?? {}).every((dependency) =>
        core.has(dependency),
      ),
      `${serviceName} must not start another transient workload`,
    );
  }

  const merged = mergedDevLiteComposeModel();
  delete merged.services.admin.restart;
  assert.throws(
    () => validateMergedDevLiteCompose(merged),
    /DEV_LITE_COMPOSE_MERGED_TRANSIENT_RESTART:admin/u,
  );

  assert.deepEqual(overlay.services["dependency-stub"].healthcheck, {
    interval: "5s",
    retries: 20,
    start_period: "2s",
    test: [
      "CMD",
      "/bin/bash",
      "-c",
      "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && head -n 1 <&3 | grep -Eq '^HTTP/1\\.[01] 200 '",
    ],
    timeout: "2s",
  });
});

test("T-E017-COMPOSE-001 rejects profile overlap, inherited transient dependencies, and core budget drift", () => {
  const profileOverlap = devLitePolicyInput();
  profileOverlap.overlay.services["worker-interactive"].profiles = [
    "dev-lite-core",
  ];
  assert.throws(
    () => validateDevLiteComposePolicy(profileOverlap),
    /DEV_LITE_COMPOSE_PROFILE:worker-interactive/u,
  );

  const transientDependency = devLitePolicyInput();
  transientDependency.overlay.services["worker-background"].depends_on.admin = {
    condition: "service_healthy",
  };
  assert.throws(
    () => validateDevLiteComposePolicy(transientDependency),
    /DEV_LITE_COMPOSE_TRANSIENT_DEPENDENCY:worker-background/u,
  );

  const transientRestart = devLitePolicyInput();
  delete transientRestart.overlay.services.admin.restart;
  assert.throws(
    () => validateDevLiteComposePolicy(transientRestart),
    /DEV_LITE_COMPOSE_TRANSIENT_RESTART:admin/u,
  );

  const inheritedDependency = devLitePolicyInput();
  inheritedDependency.overlaySource = inheritedDependency.overlaySource.replace(
    "depends_on: !override",
    "depends_on:",
  );
  assert.throws(
    () => validateDevLiteComposePolicy(inheritedDependency),
    /DEV_LITE_COMPOSE_DEPENDENCY_OVERRIDE:api/u,
  );

  const inheritedProfile = devLitePolicyInput();
  inheritedProfile.overlaySource = inheritedProfile.overlaySource.replace(
    "profiles: !override [dev-lite-core]",
    "profiles: [dev-lite-core]",
  );
  assert.throws(
    () => validateDevLiteComposePolicy(inheritedProfile),
    /DEV_LITE_COMPOSE_PROFILE_OVERRIDE:postgres/u,
  );

  const budgetDrift = devLitePolicyInput();
  budgetDrift.overlay.services.api.mem_limit = "225m";
  assert.throws(
    () => validateDevLiteComposePolicy(budgetDrift),
    /DEV_LITE_COMPOSE_CORE_MEMORY:api/u,
  );

  for (const [serviceName, field, value] of [
    ["admin", "mem_limit", "257m"],
    ["worker-interactive", "cpus", 0.5],
    ["database-init", "pids_limit", 129],
  ]) {
    const resourceDrift = devLitePolicyInput();
    resourceDrift.overlay.services[serviceName][field] = value;
    assert.throws(
      () => validateDevLiteComposePolicy(resourceDrift),
      new RegExp(`DEV_LITE_COMPOSE_RESOURCE_LIMIT:${serviceName}`, "u"),
    );
  }
});

test("T-E017-COMPOSE-001 rejects a heavyweight or relaxed DEV_LITE stub healthcheck", () => {
  const heavyweight = devLitePolicyInput();
  heavyweight.overlay.services["dependency-stub"].healthcheck.test = [
    "CMD",
    "node",
    "-e",
    "fetch('http://127.0.0.1:8080/health')",
  ];
  assert.throws(
    () => validateDevLiteComposePolicy(heavyweight),
    /DEV_LITE_COMPOSE_HEALTHCHECK:dependency-stub/u,
  );

  const relaxed = devLitePolicyInput();
  relaxed.overlay.services["dependency-stub"].healthcheck.timeout = "10s";
  assert.throws(
    () => validateDevLiteComposePolicy(relaxed),
    /DEV_LITE_COMPOSE_HEALTHCHECK:dependency-stub/u,
  );
});

test("T-E017-COMPOSE-001 rejects public stateful or TLS ports and release-only semantics", () => {
  const publicDatabase = devLitePolicyInput();
  publicDatabase.overlay.services.postgres.ports = ["0.0.0.0:5432:5432"];
  assert.throws(
    () => validateDevLiteComposePolicy(publicDatabase),
    /DEV_LITE_COMPOSE_STATEFUL_PORT:postgres/u,
  );

  const publicTls = devLitePolicyInput();
  publicTls.overlay.services["tls-proxy"].ports[0] = "0.0.0.0:8443:8443";
  assert.throws(
    () => validateDevLiteComposePolicy(publicTls),
    /DEV_LITE_COMPOSE_TLS_PROXY:runtime-boundary/u,
  );

  const productionFlag = devLitePolicyInput();
  productionFlag.overlay.production_eligible = false;
  assert.throws(
    () => validateDevLiteComposePolicy(productionFlag),
    /DEV_LITE_COMPOSE_RELEASE_SEMANTICS:manifest-only/u,
  );

  const cosConfig = devLitePolicyInput();
  cosConfig.overlay.x_cos_config = "forbidden";
  assert.throws(
    () => validateDevLiteComposePolicy(cosConfig),
    /DEV_LITE_COMPOSE_COS_FORBIDDEN:overlay/u,
  );
});

test("T-E017-OBJECT-001 rejects network, secret, storage, port, and resource expansion", () => {
  for (const [field, value] of [
    ["networks", { object_external: {} }],
    ["ports", ["127.0.0.1:18080:18080"]],
    ["secrets", [{ source: "fault_control_token" }]],
    ["volumes", ["object_data:/data"]],
  ]) {
    const expanded = devLitePolicyInput();
    expanded.overlay.services["object-smoke"][field] = value;
    assert.throws(
      () => validateDevLiteComposePolicy(expanded),
      /DEV_LITE_COMPOSE_(?:FILE_SECRET_GRANT:object-smoke|OBJECT_SMOKE:capability-boundary)/u,
      field,
    );
  }

  const networkMode = devLitePolicyInput();
  networkMode.overlay.services["object-smoke"].network_mode = "bridge";
  assert.throws(
    () => validateDevLiteComposePolicy(networkMode),
    /DEV_LITE_COMPOSE_OBJECT_SMOKE:capability-boundary/u,
  );

  const resourceExpansion = devLitePolicyInput();
  resourceExpansion.overlay.services["object-smoke"].cpus = 0.11;
  assert.throws(
    () => validateDevLiteComposePolicy(resourceExpansion),
    /DEV_LITE_COMPOSE_(?:RESOURCE_LIMIT:object-smoke|OBJECT_SMOKE:capability-boundary)/u,
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
