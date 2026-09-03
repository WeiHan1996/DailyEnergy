#!/usr/bin/env node
import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { deploymentPhases, reconciliationPhases } from "./release-contract.mjs";

const execFileAsync = promisify(execFile);
const DEVELOPMENT_ROOT = "/srv/dailyenergy";
const MINIMUM_DISK_FREE_BYTES = 20 * 1024 ** 3;
const PROJECT = "dailyenergy-dev-lite";
const PROTECTED_PORTS = new Set([80, 443, 5432, 6379, 8443, 8444]);
const PHASES = new Set([...deploymentPhases, ...reconciliationPhases]);
const CORE_STATEFUL_SERVICES = Object.freeze([
  "dependency-stub",
  "postgres",
  "redis",
]);
const FINAL_CORE_SERVICES = Object.freeze([
  ...CORE_STATEFUL_SERVICES,
  "api",
  "tls-proxy",
]);
const TRANSIENT_SERVICES = Object.freeze([
  "admin",
  "database-init",
  "database-smoke",
  "database-verify",
  "object-smoke",
  "worker-background",
  "worker-interactive",
  "worker-restricted",
]);
const KNOWN_SERVICES = new Set([...FINAL_CORE_SERVICES, ...TRANSIENT_SERVICES]);
const HEALTH_REQUIRED_SERVICES = new Set([
  ...FINAL_CORE_SERVICES,
  "admin",
  "worker-background",
  "worker-interactive",
  "worker-restricted",
]);
const EXPECTED_RUNNING_SERVICES = Object.freeze({
  admin: [...CORE_STATEFUL_SERVICES, "admin", "api"],
  api: [...CORE_STATEFUL_SERVICES, "api"],
  drift: CORE_STATEFUL_SERVICES,
  health: FINAL_CORE_SERVICES,
  "maintenance-off": FINAL_CORE_SERVICES,
  "maintenance-on": CORE_STATEFUL_SERVICES,
  migration: CORE_STATEFUL_SERVICES,
  "smoke-delete": FINAL_CORE_SERVICES,
  "smoke-object": FINAL_CORE_SERVICES,
  "smoke-owner": FINAL_CORE_SERVICES,
  "smoke-safety": FINAL_CORE_SERVICES,
  "stateful-ready": CORE_STATEFUL_SERVICES,
  "tls-ingress": FINAL_CORE_SERVICES,
  "worker-background": [...CORE_STATEFUL_SERVICES, "worker-background"],
  "worker-drain": CORE_STATEFUL_SERVICES,
  "worker-interactive": [...CORE_STATEFUL_SERVICES, "worker-interactive"],
  "worker-restricted": [...CORE_STATEFUL_SERVICES, "api", "worker-restricted"],
});

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function parseListeningPorts(source) {
  const ports = [];
  for (const line of source.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    const fields = line.trim().split(/\s+/u);
    const local = fields.at(-2) ?? "";
    const match = /^(.*):(\d+)$/u.exec(local);
    if (match === null) {
      fail("DEV_LITE_RUNTIME_SOCKET_INVALID", "format");
    }
    const address = match[1].replace(/^\[|\]$/gu, "");
    const port = Number(match[2]);
    const loopback =
      address === "127.0.0.1" ||
      address === "::1" ||
      address.startsWith("127.");
    if (!loopback && PROTECTED_PORTS.has(port)) {
      ports.push(port);
    }
  }
  return [...new Set(ports)].sort((left, right) => left - right);
}

export function validateDevelopmentLiteRuntimeEvidence(value) {
  if (
    !PHASES.has(value?.phase) ||
    !Number.isSafeInteger(value.disk_free_bytes) ||
    !Array.isArray(value.containers) ||
    !Array.isArray(value.non_loopback_protected_ports)
  ) {
    fail("DEV_LITE_RUNTIME_EVIDENCE_INVALID", "shape");
  }
  if (value.disk_free_bytes < MINIMUM_DISK_FREE_BYTES) {
    fail("DEV_LITE_RUNTIME_DISK_LOW", "20-gib");
  }
  if (value.non_loopback_protected_ports.length !== 0) {
    fail("DEV_LITE_RUNTIME_PUBLIC_PORT", "protected");
  }
  for (const container of value.containers) {
    if (
      typeof container?.name !== "string" ||
      !container.name.startsWith(`${PROJECT}-`) ||
      typeof container.service !== "string" ||
      !KNOWN_SERVICES.has(container.service) ||
      container.oom_killed !== false ||
      container.paused !== false ||
      container.restarting !== false ||
      !Number.isSafeInteger(container.restart_count) ||
      container.restart_count !== 0 ||
      !["created", "exited", "running"].includes(container.status) ||
      (container.status === "running" &&
        HEALTH_REQUIRED_SERVICES.has(container.service) &&
        container.health !== "healthy")
    ) {
      fail("DEV_LITE_RUNTIME_CONTAINER_UNHEALTHY", "state");
    }
  }
  const runningServices = value.containers
    .filter(({ status }) => status === "running")
    .map(({ service }) => service)
    .sort();
  const expected = EXPECTED_RUNNING_SERVICES[value.phase];
  if (
    value.phase === "preflight"
      ? runningServices.some(
          (service) => !FINAL_CORE_SERVICES.includes(service),
        )
      : value.phase === "pull"
        ? runningServices.some(
            (service) => !CORE_STATEFUL_SERVICES.includes(service),
          )
        : JSON.stringify(runningServices) !==
          JSON.stringify([...expected].sort())
  ) {
    fail("DEV_LITE_RUNTIME_PHASE_SERVICE_SET", value.phase);
  }
  return Object.freeze({
    containers: value.containers.length,
    disk_free_gib_floor: 20,
    oom_killed: 0,
    phase: value.phase,
    public_ports: 0,
    restarts: 0,
    running_services: runningServices.length,
    transient_workloads: runningServices.filter((service) =>
      TRANSIENT_SERVICES.includes(service),
    ).length,
  });
}

async function commandOutput(command, arguments_, label) {
  try {
    const result = await execFileAsync(command, arguments_, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 15_000,
    });
    return result.stdout.trim();
  } catch {
    fail("DEV_LITE_RUNTIME_PROBE_FAILED", label);
  }
}

export async function collectDevelopmentLiteRuntimeEvidence(
  phase,
  { root = DEVELOPMENT_ROOT } = {},
) {
  if (!PHASES.has(phase) || path.resolve(root) !== DEVELOPMENT_ROOT) {
    fail("DEV_LITE_RUNTIME_PHASE_INVALID", "phase-or-root");
  }
  const [containerIdsSource, sockets, filesystem] = await Promise.all([
    commandOutput(
      "docker",
      ["ps", "-aq", "--filter", `label=com.docker.compose.project=${PROJECT}`],
      "container-list",
    ),
    commandOutput("ss", ["-H", "-ltn"], "network"),
    statfs(root, { bigint: true }),
  ]);
  const containerIds = containerIdsSource
    .split("\n")
    .filter((value) => value !== "");
  let containers = [];
  if (containerIds.length > 0) {
    const source = await commandOutput(
      "docker",
      ["inspect", ...containerIds],
      "container-inspect",
    );
    let documents;
    try {
      documents = JSON.parse(source);
    } catch {
      fail("DEV_LITE_RUNTIME_PROBE_FAILED", "container-json");
    }
    containers = documents.map((container) => ({
      health: container.State?.Health?.Status ?? null,
      name: String(container.Name ?? "").replace(/^\//u, ""),
      oom_killed: container.State?.OOMKilled,
      paused: container.State?.Paused,
      restart_count: container.RestartCount,
      restarting: container.State?.Restarting,
      service: container.Config?.Labels?.["com.docker.compose.service"],
      status: container.State?.Status,
    }));
  }
  return {
    containers,
    disk_free_bytes: Number(filesystem.bavail * filesystem.bsize),
    non_loopback_protected_ports: parseListeningPorts(sockets),
    phase,
  };
}

async function main() {
  const [phase] = process.argv.slice(2);
  const result = validateDevelopmentLiteRuntimeEvidence(
    await collectDevelopmentLiteRuntimeEvidence(phase),
  );
  process.stdout.write(
    `DEV_LITE_RUNTIME_OK:phase=${result.phase}:containers=${result.containers}:running=${result.running_services}:transient=${result.transient_workloads}:disk_free_gib_floor=${result.disk_free_gib_floor}:oom=0:restarts=0:public_ports=0\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const message =
      error instanceof Error &&
      /^DEV_LITE_RUNTIME_[A-Z0-9_]+:[A-Za-z0-9._-]+$/u.test(error.message)
        ? error.message
        : "DEV_LITE_RUNTIME_FAILED:unexpected";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

export const developmentLiteRuntimeTesting = Object.freeze({
  parseListeningPorts,
});
