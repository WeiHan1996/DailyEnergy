import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { collectAdminSecretCanaries } from "./lib/admin-secret-canaries.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const adminRoot = resolve(repositoryRoot, "apps/admin");
const responseFixtureRoot = resolve(adminRoot, "tests/fixtures/response-leak");

function run(command, arguments_, environment) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      cwd: adminRoot,
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `ADMIN_PLAYWRIGHT_COMMAND_FAILED: ${command} ${arguments_.join(" ")} (${signal ?? code ?? "unknown"})`,
        ),
      );
    });
  });
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "daily-energy-admin-browser-gate-"),
);
try {
  const identitySecretFile = join(
    temporaryDirectory,
    "admin-identity-client-secret",
  );
  const sessionSecretFile = join(temporaryDirectory, "admin-session-secret");
  const identitySecret = "ADMIN_SYNTHETIC_IDENTITY_SECRET_FILE_CANARY_5f71c924";
  const sessionSecret = "ADMIN_SYNTHETIC_SESSION_SECRET_FILE_CANARY_93d82a16";
  const userBody = "Synthetic user note: feeling tired today; fixture 1d24f58e";

  await Promise.all([
    writeFile(identitySecretFile, identitySecret, { mode: 0o600 }),
    writeFile(sessionSecretFile, sessionSecret, { mode: 0o600 }),
  ]);

  const secretEnvironment = {
    ADMIN_IDENTITY_CLIENT_SECRET_FILE: identitySecretFile,
    ADMIN_SESSION_SECRET_FILE: sessionSecretFile,
  };
  const secretCanaries = await collectAdminSecretCanaries(secretEnvironment);
  const environment = {
    ...process.env,
    ...secretEnvironment,
    ADMIN_RESPONSE_SECRET_CANARY: identitySecret,
    ADMIN_RESPONSE_USER_BODY_CANARY: userBody,
    ADMIN_TEST_SECRET_CANARIES: JSON.stringify(secretCanaries),
    ADMIN_TEST_USER_BODY_CANARIES: JSON.stringify([userBody]),
  };

  await run("pnpm", ["run", "build"], environment);
  await run(
    "pnpm",
    ["exec", "playwright", "test", "--config=playwright.config.ts"],
    environment,
  );
  await run(
    "pnpm",
    ["exec", "next", "build", "tests/fixtures/response-leak"],
    environment,
  );
  await run(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "--config=response-fixture.playwright.config.ts",
    ],
    environment,
  );
} finally {
  await Promise.all([
    rm(temporaryDirectory, { force: true, recursive: true }),
    rm(resolve(responseFixtureRoot, ".next"), {
      force: true,
      recursive: true,
    }),
  ]);
}
