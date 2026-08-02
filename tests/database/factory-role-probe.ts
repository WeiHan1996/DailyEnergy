import { createApiRestrictedDatabaseFactory } from "../../packages/server-adapters/src/api-restricted/index.js";
import { createApiDatabaseFactory } from "../../packages/server-adapters/src/api/index.js";
import { createWorkerBackgroundDatabaseFactory } from "../../packages/server-adapters/src/worker-background/index.js";
import { createWorkerRestrictedDatabaseFactory } from "../../packages/server-adapters/src/worker-restricted/index.js";

const profiles = {
  api: {
    factory: createApiDatabaseFactory(),
    url: process.env.DB_FACTORY_PROBE_API_URL,
  },
  background: {
    factory: createWorkerBackgroundDatabaseFactory(),
    url: process.env.DB_FACTORY_PROBE_BACKGROUND_URL,
  },
  deletion: {
    factory: createWorkerRestrictedDatabaseFactory(),
    url: process.env.DB_FACTORY_PROBE_DELETION_URL,
  },
  safety: {
    factory: createApiRestrictedDatabaseFactory(),
    url: process.env.DB_FACTORY_PROBE_SAFETY_URL,
  },
} as const;

const selected = process.env.DB_FACTORY_PROBE_PROFILE ?? "all";
const expected = process.env.DB_FACTORY_PROBE_EXPECT ?? "success";
const entries = Object.entries(profiles).filter(
  ([profile]) => selected === "all" || profile === selected,
);
if (entries.length === 0 || !["success", "mismatch"].includes(expected)) {
  throw new Error("DB_FACTORY_PROBE_CONFIG_INVALID");
}

for (const [profile, definition] of entries) {
  if (!definition.url) {
    throw new Error(`DB_FACTORY_PROBE_URL_REQUIRED:${profile}`);
  }
  try {
    const connection = await definition.factory.connect({
      connectionLimit: 1,
      connectionString: definition.url,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 1_000,
    });
    await connection.disconnect();
    if (expected === "mismatch") {
      throw new Error(`DB_FACTORY_PROBE_EXPECTED_MISMATCH:${profile}`);
    }
  } catch (error) {
    if (
      expected !== "mismatch" ||
      !(error instanceof Error) ||
      !error.message.startsWith("DB_ROLE_MISMATCH:")
    ) {
      throw error;
    }
  }
}

console.log(`DB_FACTORY_ROLE_PROBE_OK:${selected}:${expected}`);
