#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { scanComposeImages } from "./check-image-content.mjs";
import { ensureSyntheticSecrets, readFaultToken } from "./generate-secrets.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const modes = Object.freeze({
  local: {
    adminPort: 3301,
    apiPort: 3300,
    environment: "LOCAL",
    logLevel: "DEBUG",
    overlay: "docker/compose.local.yaml",
  },
  test: {
    adminPort: 13_301,
    apiPort: 13_300,
    environment: "CI",
    logLevel: "INFO",
    overlay: "docker/compose.test.yaml",
  },
  "staging-like": {
    adminPort: 23_301,
    apiPort: 23_300,
    environment: "STAGING",
    logLevel: "INFO",
    overlay: "docker/compose.staging-like.yaml",
  },
});
export const observabilityImageDefaults = Object.freeze({
  DAILYENERGY_ALERTMANAGER_IMAGE:
    "prom/alertmanager:v0.28.1@sha256:27c475db5fb156cab31d5c18a4251ac7ed567746a2483ff264516437a39b15ba",
  DAILYENERGY_GRAFANA_IMAGE:
    "grafana/grafana:11.6.0@sha256:62d2b9d20a19714ebfe48d1bb405086081bc602aa053e28cf6d73c7537640dfb",
  DAILYENERGY_LOKI_IMAGE:
    "grafana/loki:3.4.2@sha256:58a6c186ce78ba04d58bfe2a927eff296ba733a430df09645d56cdc158f3ba08",
  DAILYENERGY_OTEL_COLLECTOR_IMAGE:
    "otel/opentelemetry-collector-contrib:0.121.0@sha256:789689988e379c58ac12b07718dbcf4b23c2214bd804173c1c77af346d381c15",
  DAILYENERGY_PROMETHEUS_IMAGE:
    "prom/prometheus:v3.2.1@sha256:6927e0919a144aa7616fd0137d4816816d42f6b816de3af269ab065250859a62",
  DAILYENERGY_TEMPO_IMAGE:
    "grafana/tempo:2.7.1@sha256:4443be217c396b065ee34845534199c36fdba4dc619cb96550e228d73fba6e69",
});

export function parseArguments(argv) {
  const command = argv[0] ?? "up";
  const options = {
    fault: false,
    mode: "local",
    observability: false,
    values: [],
  };
  for (const argument of argv.slice(1)) {
    if (argument === "--fault") {
      options.fault = true;
    } else if (argument === "--observability") {
      options.observability = true;
    } else if (argument.startsWith("--mode=")) {
      options.mode = argument.slice("--mode=".length);
    } else {
      options.values.push(argument);
    }
  }
  if (!Object.hasOwn(modes, options.mode)) {
    throw new Error("COMPOSE_MODE_INVALID");
  }
  if (
    !new Set([
      "clean",
      "config",
      "down",
      "fault",
      "prepare",
      "smoke",
      "up",
    ]).has(command)
  ) {
    throw new Error("COMPOSE_COMMAND_INVALID");
  }
  if (["fault", "smoke"].includes(command) && options.fault !== true) {
    options.fault = command === "fault";
  }
  if (options.fault && options.mode !== "test") {
    throw new Error("COMPOSE_FAULT_MODE_INVALID");
  }
  return { command, options };
}

function execute(command, args, { capture = false, environment } = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...environment },
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`COMPOSE_COMMAND_FAILED:${path.basename(command)}`);
  }
  return (result.stdout ?? "").trim();
}

export async function sourceFingerprint() {
  const hash = createHash("sha256");
  hash.update(execute("git", ["rev-parse", "HEAD"], { capture: true }));
  hash.update(
    execute("git", ["diff", "--binary", "HEAD", "--", ".", ":(exclude)tasks"], {
      capture: true,
    }),
  );
  const untracked = execute(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { capture: true },
  )
    .split("\0")
    .filter((file) => file !== "" && !file.startsWith("tasks/"))
    .sort();
  for (const file of untracked) {
    hash.update(file);
    hash.update(await readFile(path.join(repositoryRoot, file)));
  }
  return hash.digest("hex").slice(0, 16);
}

function imageId(tag) {
  return execute("docker", ["image", "inspect", tag, "--format", "{{.Id}}"], {
    capture: true,
  });
}

async function buildImages() {
  const source = await sourceFingerprint();
  const definitions = {
    admin: "e009-admin",
    migration: "e009-migration",
    server: "e009-server",
    stub: "e009-stub",
  };
  const images = {};
  for (const [name, target] of Object.entries(definitions)) {
    const tag = `daily-energy/e009-${name}:${source}`;
    execute("docker", [
      "build",
      "--label",
      `com.dailyenergy.source=${source}`,
      "--tag",
      tag,
      "--target",
      target,
      ".",
    ]);
    images[name] = imageId(tag);
  }
  const scan = scanComposeImages(images);
  console.log(`COMPOSE_IMAGE_CONTENT_OK:images=${scan.images}`);
  return images;
}

function runImage(image, arguments_, environment = {}) {
  const envArguments = Object.entries(environment).flatMap(([key, value]) => [
    "--env",
    `${key}=${value}`,
  ]);
  return execute(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--tmpfs",
      "/tmp:uid=1000,gid=1000,mode=0700",
      "--entrypoint",
      "node",
      ...envArguments,
      image,
      ...arguments_,
    ],
    { capture: true },
  );
}

function apiRuntimeEnvironment(mode, observability = false, fault = false) {
  const selected = modes[mode];
  return {
    DAILYENERGY_CONFIG_SCHEMA_VERSION: "api-runtime-config-v1",
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: "api-contract-v1",
    DAILYENERGY_DATABASE_URL_FILE: "/run/secrets/database_api_url",
    DAILYENERGY_ENVIRONMENT: selected.environment,
    DAILYENERGY_HOST: "0.0.0.0",
    DAILYENERGY_LOG_LEVEL: selected.logLevel,
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "3000",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: "product-date-v1",
    DAILYENERGY_REDIS_KEY_PREFIX: `daily-energy-e009-${mode}`,
    DAILYENERGY_REDIS_URL: fault
      ? "redis://fault-proxy:16379"
      : "redis://redis:6379",
    DAILYENERGY_RELEASE_ID: `e009-${mode}-v1`,
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
    DAILYENERGY_TELEMETRY_ENABLED: String(observability),
    DAILYENERGY_TELEMETRY_METRICS_HOST: "0.0.0.0",
    DAILYENERGY_TELEMETRY_METRICS_PORT: "9464",
    DAILYENERGY_TELEMETRY_OTLP_TRACE_URL: "http://collector:4318/v1/traces",
  };
}

function calculateFingerprints(serverImage, mode, observability, fault) {
  const api = JSON.parse(
    runImage(
      serverImage,
      [
        "--input-type=module",
        "--eval",
        "import('/app/api/dist/bootstrap/runtime-config.js').then(m=>process.stdout.write(JSON.stringify(m.calculateRuntimeFingerprints(process.env))))",
      ],
      apiRuntimeEnvironment(mode, observability, fault),
    ),
  );
  const workers = JSON.parse(
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
  return { api, workers };
}

function variant(options) {
  return `${options.mode}${options.fault ? "-fault" : ""}${
    options.observability ? "-observability" : ""
  }`;
}

function paths(options) {
  const artifactDirectory = path.join(
    repositoryRoot,
    ".artifacts/compose",
    variant(options),
  );
  return {
    artifactDirectory,
    envFile: path.join(artifactDirectory, "compose.env"),
    secretDirectory: path.join(artifactDirectory, "secrets"),
  };
}

async function prepare(options) {
  const selected = modes[options.mode];
  const output = paths(options);
  await mkdir(output.artifactDirectory, { recursive: true, mode: 0o700 });
  await ensureSyntheticSecrets(output.secretDirectory, {
    fault: options.fault,
  });
  const images = await buildImages();
  const fingerprints = calculateFingerprints(
    images.server,
    options.mode,
    options.observability,
    options.fault,
  );
  const values = {
    DAILYENERGY_ADMIN_HOST_PORT: selected.adminPort,
    DAILYENERGY_ADMIN_IMAGE: images.admin,
    ...(options.observability ? observabilityImageDefaults : {}),
    DAILYENERGY_API_CAPABILITY_FINGERPRINT:
      fingerprints.api.capabilityFingerprint,
    DAILYENERGY_API_DEPLOY_FINGERPRINT:
      fingerprints.api.deployConfigFingerprint,
    DAILYENERGY_API_HOST_PORT: selected.apiPort,
    DAILYENERGY_API_REDIS_URL: options.fault
      ? "redis://fault-proxy:16379"
      : "redis://redis:6379",
    DAILYENERGY_LOG_LEVEL: selected.logLevel,
    DAILYENERGY_MIGRATION_IMAGE: images.migration,
    DAILYENERGY_PROXY_CONTROL_HOST_PORT: 19_091,
    DAILYENERGY_REDIS_KEY_PREFIX: `daily-energy-e009-${options.mode}`,
    DAILYENERGY_RELEASE_ID: `e009-${options.mode}-v1`,
    DAILYENERGY_RUNTIME_ENVIRONMENT: selected.environment,
    DAILYENERGY_SECRET_DIR: output.secretDirectory,
    DAILYENERGY_SERVER_IMAGE: images.server,
    DAILYENERGY_SOURCE_FINGERPRINT: await sourceFingerprint(),
    DAILYENERGY_STUB_CONTROL_HOST_PORT: 19_090,
    DAILYENERGY_STUB_IMAGE: images.stub,
    DAILYENERGY_TELEMETRY_ENABLED: String(options.observability),
    DAILYENERGY_TELEMETRY_OTLP_TRACE_URL: "http://collector:4318/v1/traces",
    DAILYENERGY_WORKER_BACKGROUND_FINGERPRINT: fingerprints.workers.background,
    DAILYENERGY_WORKER_INTERACTIVE_FINGERPRINT:
      fingerprints.workers.interactive,
    DAILYENERGY_WORKER_REDIS_URL: options.fault
      ? "redis://fault-proxy:16379"
      : "redis://redis:6379",
    DAILYENERGY_WORKER_RESTORE_READINESS: options.fault
      ? "RESTORE_VERIFIED"
      : "NORMAL",
    DAILYENERGY_WORKER_RESTRICTED_FINGERPRINT: fingerprints.workers.restricted,
  };
  await writeFile(
    output.envFile,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
    { mode: 0o600 },
  );
  return output;
}

function composeArguments(options, envFile) {
  const selected = modes[options.mode];
  const args = [
    "compose",
    "--project-name",
    `dailyenergy-e009-${variant(options)}`,
    "--env-file",
    envFile,
    "--file",
    "compose.yaml",
    "--file",
    selected.overlay,
  ];
  if (options.fault) {
    args.push("--file", "docker/compose.fault.yaml");
  }
  if (options.observability) {
    args.push("--file", "docker/compose.observability.yaml");
  }
  args.push("--profile", options.mode);
  if (options.fault) {
    args.push("--profile", "fault");
  }
  return args;
}

function compose(options, envFile, args, settings) {
  return execute(
    "docker",
    [...composeArguments(options, envFile), ...args],
    settings,
  );
}

async function ensurePrepared(options) {
  const output = paths(options);
  try {
    const source = await readFile(output.envFile, "utf8");
    const expectedSource = await sourceFingerprint();
    if (
      source
        .split("\n")
        .includes(`DAILYENERGY_SOURCE_FINGERPRINT=${expectedSource}`)
    ) {
      await ensureSyntheticSecrets(output.secretDirectory, {
        fault: options.fault,
      });
      const values = Object.fromEntries(
        source
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const separator = line.indexOf("=");
            return [line.slice(0, separator), line.slice(separator + 1)];
          }),
      );
      for (const key of [
        "DAILYENERGY_ADMIN_IMAGE",
        "DAILYENERGY_MIGRATION_IMAGE",
        "DAILYENERGY_SERVER_IMAGE",
        "DAILYENERGY_STUB_IMAGE",
      ]) {
        imageId(values[key]);
      }
      return output;
    }
  } catch {
    // Missing or stale artifacts are regenerated from the current source.
  }
  return prepare(options);
}

async function waitFor(url, expectedStatus = 200, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status === expectedStatus) {
        return response;
      }
    } catch {
      // Dependency startup and recovery are polled within a fixed deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("COMPOSE_HTTP_WAIT_FAILED");
}

function expectComposeCommand(
  options,
  envFile,
  service,
  code,
  expectedSuccess,
) {
  const result = spawnSync(
    "docker",
    [
      ...composeArguments(options, envFile),
      "exec",
      "--no-TTY",
      service,
      "node",
      "--eval",
      code,
    ],
    { cwd: repositoryRoot, encoding: "utf8", stdio: "pipe" },
  );
  if ((result.status === 0) !== expectedSuccess) {
    throw new Error(`COMPOSE_SMOKE_ASSERTION_FAILED:${service}`);
  }
}

async function controlRequest(output, port, target, mode) {
  const token = await readFaultToken(output.secretDirectory);
  return fetch(`http://127.0.0.1:${port}/control`, {
    body: JSON.stringify({ mode, target }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(3_000),
  });
}

async function ordinarySmoke(options, output) {
  const selected = modes[options.mode];
  await waitFor(`http://127.0.0.1:${selected.apiPort}/health/ready`);
  await waitFor(`http://127.0.0.1:${selected.adminPort}/login`);
  expectComposeCommand(
    options,
    output.envFile,
    "api",
    "fetch('http://example.com',{signal:AbortSignal.timeout(1500)}).then(()=>process.exit(1)).catch(()=>process.exit(0))",
    true,
  );
  expectComposeCommand(
    options,
    output.envFile,
    "api",
    "fetch('http://169.254.169.254',{signal:AbortSignal.timeout(1500)}).then(()=>process.exit(1)).catch(()=>process.exit(0))",
    true,
  );
  expectComposeCommand(
    options,
    output.envFile,
    "admin",
    "require('node:dns').promises.lookup('postgres').then(()=>process.exit(1)).catch(()=>process.exit(0))",
    true,
  );
  expectComposeCommand(
    options,
    output.envFile,
    "worker-interactive",
    "fetch('http://ai.daily:8080/v1/provider').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
    true,
  );
  expectComposeCommand(
    options,
    output.envFile,
    "worker-restricted",
    "require('node:dns').promises.lookup('ai.daily').then(()=>process.exit(1)).catch(()=>process.exit(0))",
    true,
  );
}

async function faultSmoke(options, output) {
  const selected = modes[options.mode];
  await controlRequest(output, 19_091, "postgres", "drop");
  await waitFor(`http://127.0.0.1:${selected.apiPort}/health/ready`, 503);
  await controlRequest(output, 19_091, "postgres", "pass");
  await waitFor(`http://127.0.0.1:${selected.apiPort}/health/ready`);

  await controlRequest(output, 19_091, "redis", "drop");
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  expectComposeCommand(
    options,
    output.envFile,
    "worker-interactive",
    "process.exit(require('node:fs').existsSync('/run/dailyenergy/worker-interactive.json')?1:0)",
    true,
  );
  await controlRequest(output, 19_091, "redis", "pass");

  await controlRequest(output, 19_090, "provider", "failure");
  await waitFor("http://127.0.0.1:19090/v1/provider", 503);
  await controlRequest(output, 19_090, "provider", "pass");
  await controlRequest(output, 19_090, "clock", "skew");
  const clock = await (await waitFor("http://127.0.0.1:19090/v1/clock")).json();
  if (clock.offset_ms !== 86_400_000) {
    throw new Error("COMPOSE_CLOCK_FAULT_FAILED");
  }
  await controlRequest(output, 19_090, "clock", "pass");
  await controlRequest(output, 19_090, "telemetry", "failure");
  await waitFor("http://127.0.0.1:19090/v1/telemetry", 503);
  await controlRequest(output, 19_090, "telemetry", "pass");
  await controlRequest(output, 19_090, "network", "reset");
  let resetObserved;
  try {
    const response = await fetch("http://127.0.0.1:19090/v1/provider", {
      signal: AbortSignal.timeout(2_000),
    });
    resetObserved = response.status === 502;
  } catch {
    resetObserved = true;
  }
  if (!resetObserved) {
    throw new Error("COMPOSE_NETWORK_FAULT_FAILED");
  }
  await controlRequest(output, 19_090, "network", "pass");
}

export async function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArguments(argv);
  const existing = paths(options);

  if (command === "prepare") {
    await prepare(options);
    console.log(`COMPOSE_PREPARE_OK:${variant(options)}`);
  } else if (command === "clean") {
    try {
      await readFile(existing.envFile, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      await rm(existing.artifactDirectory, { force: true, recursive: true });
      console.log(`COMPOSE_CLEAN_OK:${variant(options)}`);
      return;
    }
    compose(options, existing.envFile, [
      "down",
      "--volumes",
      "--remove-orphans",
    ]);
    await rm(existing.artifactDirectory, { force: true, recursive: true });
    console.log(`COMPOSE_CLEAN_OK:${variant(options)}`);
  } else {
    const output = await ensurePrepared(options);
    if (command === "config") {
      compose(options, output.envFile, ["config"]);
    } else if (command === "up") {
      compose(options, output.envFile, [
        "up",
        "--detach",
        "--wait",
        "--wait-timeout",
        "240",
      ]);
      console.log(`COMPOSE_UP_OK:${variant(options)}`);
    } else if (command === "down") {
      compose(options, output.envFile, [
        "down",
        "--remove-orphans",
        "--timeout",
        "10",
      ]);
      console.log(`COMPOSE_DOWN_OK:${variant(options)}`);
    } else if (command === "smoke") {
      await ordinarySmoke(options, output);
      if (options.fault) {
        await faultSmoke(options, output);
      }
      console.log(`COMPOSE_SMOKE_OK:${variant(options)}`);
    } else if (command === "fault") {
      const [target, mode] = options.values;
      const proxy = ["postgres", "redis"].includes(target);
      const response = await controlRequest(
        output,
        proxy ? 19_091 : 19_090,
        target,
        mode,
      );
      if (!response.ok) {
        throw new Error("COMPOSE_FAULT_CONTROL_FAILED");
      }
      console.log(`COMPOSE_FAULT_OK:${target}:${mode}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
