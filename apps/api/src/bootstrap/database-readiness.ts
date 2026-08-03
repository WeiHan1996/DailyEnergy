import { readFile } from "node:fs/promises";

import { createApiDatabaseFactory } from "@daily-energy/server-adapters/api";

import type {
  ReadinessCheck,
  ReadinessCheckResult,
} from "../composition/types.js";

type ApiDatabaseFactory = ReturnType<typeof createApiDatabaseFactory>;

export class ApiDatabaseReadiness implements ReadinessCheck {
  public constructor(
    private readonly databaseUrlFile: string,
    private readonly factory: ApiDatabaseFactory = createApiDatabaseFactory(),
  ) {}

  public async check(): Promise<ReadinessCheckResult> {
    try {
      const connectionString = (
        await readFile(this.databaseUrlFile, "utf8")
      ).trim();
      if (connectionString.length === 0) {
        return unavailable();
      }
      const connection = await this.factory.connect({
        applicationName: "daily-energy:api:readiness",
        connectionLimit: 1,
        connectionString,
      });
      await connection.disconnect();
      return { status: "UP" };
    } catch {
      return unavailable();
    }
  }
}

function unavailable(): ReadinessCheckResult {
  return {
    reasonCode: "REQUIRED_DEPENDENCY_UNAVAILABLE",
    status: "DOWN",
  };
}
