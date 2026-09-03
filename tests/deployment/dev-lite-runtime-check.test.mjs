import assert from "node:assert/strict";
import test from "node:test";

import {
  developmentLiteRuntimeTesting,
  validateDevelopmentLiteRuntimeEvidence,
} from "../../tooling/deployment/dev-lite-runtime-check.mjs";

function evidence(mutate = () => undefined) {
  const value = {
    containers: [
      "api",
      "dependency-stub",
      "postgres",
      "redis",
      "tls-proxy",
    ].map((service) => ({
      health: "healthy",
      name: `dailyenergy-dev-lite-${service}-1`,
      oom_killed: false,
      paused: false,
      restart_count: 0,
      restarting: false,
      service,
      status: "running",
    })),
    disk_free_bytes: 21 * 1024 ** 3,
    non_loopback_protected_ports: [],
    phase: "health",
  };
  mutate(value);
  return value;
}

test("T-E017-RUNTIME-001 accepts content-free DEV_LITE runtime evidence", () => {
  assert.deepEqual(validateDevelopmentLiteRuntimeEvidence(evidence()), {
    containers: 5,
    disk_free_gib_floor: 20,
    oom_killed: 0,
    phase: "health",
    public_ports: 0,
    restarts: 0,
    running_services: 5,
    transient_workloads: 0,
  });
});

test("T-E017-RUNTIME-001 rejects OOM, restart, pause, dead, disk and public-port drift", () => {
  for (const mutate of [
    (value) => {
      value.containers[0].oom_killed = true;
    },
    (value) => {
      value.containers[0].restart_count = 1;
    },
    (value) => {
      value.containers[0].restarting = true;
    },
    (value) => {
      value.containers[0].paused = true;
    },
    (value) => {
      value.containers[0].status = "dead";
    },
    (value) => {
      value.containers[0].health = "unhealthy";
    },
    (value) => {
      value.disk_free_bytes = 20 * 1024 ** 3 - 1;
    },
    (value) => {
      value.non_loopback_protected_ports = [443];
    },
  ]) {
    assert.throws(
      () => validateDevelopmentLiteRuntimeEvidence(evidence(mutate)),
      /DEV_LITE_RUNTIME_(?:CONTAINER_UNHEALTHY|DISK_LOW|PUBLIC_PORT)/u,
    );
  }
});

test("T-E017-RUNTIME-001 enforces the phase service set and one transient window", () => {
  for (const mutate of [
    (value) => {
      value.containers = [];
    },
    (value) => {
      value.containers[0].status = "exited";
    },
    (value) => {
      value.containers.push({
        ...value.containers[0],
        name: "dailyenergy-dev-lite-unexpected-1",
        service: "unexpected",
      });
    },
  ]) {
    assert.throws(
      () => validateDevelopmentLiteRuntimeEvidence(evidence(mutate)),
      /DEV_LITE_RUNTIME_(?:CONTAINER_UNHEALTHY|PHASE_SERVICE_SET)/u,
    );
  }

  const worker = evidence((value) => {
    value.phase = "worker-interactive";
    value.containers = value.containers
      .filter(({ service }) => !["api", "tls-proxy"].includes(service))
      .concat({
        health: "healthy",
        name: "dailyenergy-dev-lite-worker-interactive-1",
        oom_killed: false,
        paused: false,
        restart_count: 0,
        restarting: false,
        service: "worker-interactive",
        status: "running",
      });
  });
  assert.equal(
    validateDevelopmentLiteRuntimeEvidence(worker).transient_workloads,
    1,
  );
  worker.containers.push({
    ...worker.containers.at(-1),
    name: "dailyenergy-dev-lite-worker-background-1",
    service: "worker-background",
  });
  assert.throws(
    () => validateDevelopmentLiteRuntimeEvidence(worker),
    /DEV_LITE_RUNTIME_PHASE_SERVICE_SET:worker-interactive/u,
  );
});

test("T-E017-RUNTIME-001 parses only non-loopback protected listeners", () => {
  const source = [
    "LISTEN 0 4096 127.0.0.1:8443 0.0.0.0:*",
    "LISTEN 0 4096 0.0.0.0:22 0.0.0.0:*",
    "LISTEN 0 4096 0.0.0.0:443 0.0.0.0:*",
    "LISTEN 0 4096 [::1]:5432 [::]:*",
    "",
  ].join("\n");
  assert.deepEqual(
    developmentLiteRuntimeTesting.parseListeningPorts(source),
    [443],
  );
});
