import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { redactSensitiveDiagnosticOutput } from "./lib/sensitive-redaction.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const execution = spawnSync(
  process.execPath,
  [
    resolve(repositoryRoot, "tooling/agent-validate.mjs"),
    ...process.argv.slice(2),
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: undefined,
      NO_COLOR: "1",
    },
    maxBuffer: 16 * 1024 * 1024,
  },
);

const stdout = redactSensitiveDiagnosticOutput(execution.stdout ?? "");
const stderr = redactSensitiveDiagnosticOutput(
  execution.error?.message
    ? `${execution.stderr ?? ""}\n${execution.error.message}`
    : (execution.stderr ?? ""),
);

if (stdout) {
  process.stdout.write(stdout);
}
if (stderr) {
  process.stderr.write(stderr);
}

process.exitCode = execution.status ?? 1;
