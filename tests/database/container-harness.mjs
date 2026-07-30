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
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(script)], {
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
