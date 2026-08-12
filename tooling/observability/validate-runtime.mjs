#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

import { observabilityImageDefaults } from "../compose/control.mjs";
import { redactSensitiveDiagnosticOutput } from "../lib/sensitive-redaction.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const observabilityRoot = path.resolve(repositoryRoot, "docker/observability");

function runValidation(id, arguments_) {
  const result = spawnSync("docker", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status === 0) {
    return;
  }
  const diagnostic = redactSensitiveDiagnosticOutput(
    `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  )
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .slice(-20)
    .join("\n");
  throw new Error(
    `E013_RUNTIME_CONFIG_FAILED:${id}${diagnostic ? `\n${diagnostic}` : ""}`,
  );
}

const commonArguments = [
  "run",
  "--rm",
  "--network",
  "none",
  "--read-only",
  "--cap-drop",
  "ALL",
  "--security-opt",
  "no-new-privileges:true",
  "--pids-limit",
  "128",
];

runValidation("collector", [
  ...commonArguments,
  "--user",
  "10001:10001",
  "--mount",
  `type=bind,src=${path.resolve(observabilityRoot, "collector.yaml")},dst=/etc/otelcol/config.yaml,readonly`,
  observabilityImageDefaults.DAILYENERGY_OTEL_COLLECTOR_IMAGE,
  "validate",
  "--config=/etc/otelcol/config.yaml",
]);

runValidation("prometheus", [
  ...commonArguments,
  "--user",
  "65534:65534",
  "--entrypoint",
  "/bin/promtool",
  "--mount",
  `type=bind,src=${observabilityRoot},dst=/etc/prometheus,readonly`,
  observabilityImageDefaults.DAILYENERGY_PROMETHEUS_IMAGE,
  "check",
  "config",
  "/etc/prometheus/prometheus.yaml",
]);

runValidation("alertmanager", [
  ...commonArguments,
  "--user",
  "65534:65534",
  "--entrypoint",
  "/bin/amtool",
  "--mount",
  `type=bind,src=${path.resolve(observabilityRoot, "alertmanager.yaml")},dst=/etc/alertmanager/alertmanager.yaml,readonly`,
  observabilityImageDefaults.DAILYENERGY_ALERTMANAGER_IMAGE,
  "check-config",
  "/etc/alertmanager/alertmanager.yaml",
]);

runValidation("loki", [
  ...commonArguments,
  "--user",
  "10001:10001",
  "--tmpfs",
  "/tmp:uid=10001,gid=10001,mode=0700",
  "--entrypoint",
  "/usr/bin/loki",
  "--mount",
  `type=bind,src=${path.resolve(observabilityRoot, "loki.yaml")},dst=/etc/loki/loki.yaml,readonly`,
  observabilityImageDefaults.DAILYENERGY_LOKI_IMAGE,
  "-verify-config",
  "-config.file=/etc/loki/loki.yaml",
]);

runValidation("tempo", [
  ...commonArguments,
  "--user",
  "10001:10001",
  "--tmpfs",
  "/tmp:uid=10001,gid=10001,mode=0700",
  "--entrypoint",
  "/tempo",
  "--mount",
  `type=bind,src=${path.resolve(observabilityRoot, "tempo.yaml")},dst=/etc/tempo/tempo.yaml,readonly`,
  observabilityImageDefaults.DAILYENERGY_TEMPO_IMAGE,
  "-config.file=/etc/tempo/tempo.yaml",
  "-config.verify=true",
]);

console.log(
  "E013_RUNTIME_CONFIG_OK:collector=1:prometheus=1:alertmanager=1:loki=1:tempo=1",
);
