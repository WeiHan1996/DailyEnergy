import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";

const requireFromRoot = createRequire(
  new URL("../../package.json", import.meta.url),
);

export function loadPg() {
  try {
    return requireFromRoot("pg");
  } catch {
    return requireFromRoot("./node_modules/.pnpm/pg@8.22.0/node_modules/pg");
  }
}

export const POSTGRES_IMAGE =
  "postgres:18.0-bookworm@sha256:3f55f8895c4ed50603e2fbdfc72fffeeaba3173321fee5cb825bbbeb30d9d854";

export async function loadTestcontainers() {
  try {
    return requireFromRoot("@testcontainers/postgresql");
  } catch {
    try {
      const { GenericContainer, Wait } = requireFromRoot("testcontainers");
      return {
        PostgreSqlContainer: class PostgreSqlContainer extends GenericContainer {
          constructor(image) {
            super(image);
            this.withEnvironment({
              POSTGRES_USER: "postgres",
              POSTGRES_PASSWORD: "synthetic",
              POSTGRES_DB: "daily_energy",
            });
            this.withExposedPorts(5432);
            this.withWaitStrategy(
              Wait.forLogMessage(
                /database system is ready to accept connections/u,
                2,
              ),
            );
          }
          async start() {
            const container = await super.start();
            const host = container.getHost();
            const port = container.getMappedPort(5432);
            container.getConnectionUri = () =>
              `postgresql://postgres:synthetic@${host}:${port}/daily_energy`;
            return container;
          }
        },
      };
    } catch {
      throw new Error("DB_TESTCONTAINERS_MISSING");
    }
  }
}

export function runNodeResult(script, environment) {
  return runCommandResult(
    process.execPath,
    [path.resolve(script)],
    environment,
  );
}

export function runCommandResult(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.resolve("."),
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

export async function runNode(script, environment) {
  const result = await runNodeResult(script, environment);
  if (result.code !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`DB_CHILD_FAILED:${script}:${result.code}`);
  }
  process.stdout.write(result.stdout);
}

export const TEST_DATABASE_PROFILES = Object.freeze({
  api: {
    groupRole: "daily_energy_api",
    loginRole: "daily_energy_api_test_login",
    password: "synthetic-api",
  },
  interactive: {
    groupRole: "daily_energy_interactive",
    loginRole: "daily_energy_interactive_test_login",
    password: "synthetic-interactive",
  },
  background: {
    groupRole: "daily_energy_background",
    loginRole: "daily_energy_background_test_login",
    password: "synthetic-background",
  },
  restricted: {
    groupRole: "daily_energy_restricted",
    loginRole: "daily_energy_restricted_test_login",
    password: "synthetic-restricted",
  },
  migration: {
    groupRole: "daily_energy_migration",
    loginRole: "daily_energy_migration_test_login",
    password: "synthetic-migration",
  },
  test: {
    groupRole: "daily_energy_test",
    loginRole: "daily_energy_test_login",
    password: "synthetic-test",
  },
});

export async function bootstrapTestDatabase(adminUrl) {
  await runNode("tooling/database/bootstrap.mjs", {
    DATABASE_ADMIN_URL: adminUrl,
  });
  const { Client } = loadPg();
  const administrator = new Client({ connectionString: adminUrl });
  await administrator.connect();
  try {
    for (const profile of Object.values(TEST_DATABASE_PROFILES)) {
      await administrator.query(
        `CREATE ROLE ${profile.loginRole} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${profile.password}'`,
      );
      await administrator.query(
        `GRANT ${profile.groupRole} TO ${profile.loginRole}`,
      );
    }
  } finally {
    await administrator.end();
  }

  return Object.fromEntries(
    Object.entries(TEST_DATABASE_PROFILES).map(([name, profile]) => {
      const url = new URL(adminUrl);
      url.username = profile.loginRole;
      url.password = profile.password;
      return [name, url.toString()];
    }),
  );
}
