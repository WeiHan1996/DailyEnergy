import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { DatabaseFactory } from "@daily-energy/server-adapters/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiDatabaseReadiness } from "./bootstrap/database-readiness.js";

const temporaryDirectories: string[] = [];

async function secretFile(contents: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "daily-energy-api-"));
  temporaryDirectories.push(directory);
  const file = path.join(directory, "database-url");
  await writeFile(file, contents, { mode: 0o600 });
  return file;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("ApiDatabaseReadiness", () => {
  it("connects through the API role factory and disconnects", async () => {
    const disconnect = vi.fn(async () => undefined);
    const connect = vi.fn(async () => ({
      capability: {
        databaseRole: "daily_energy_api" as const,
        profile: "api" as const,
      },
      disconnect,
      profile: "api" as const,
    }));
    const factory = {
      connect,
      profile: "api" as const,
    } satisfies DatabaseFactory<
      "api",
      { readonly databaseRole: "daily_energy_api"; readonly profile: "api" }
    >;
    const file = await secretFile(
      "postgresql://daily_energy_api:synthetic@postgres/daily_energy\n",
    );

    await expect(
      new ApiDatabaseReadiness(file, factory).check(),
    ).resolves.toEqual({ status: "UP" });
    expect(connect).toHaveBeenCalledWith({
      applicationName: "daily-energy:api:readiness",
      connectionLimit: 1,
      connectionString:
        "postgresql://daily_energy_api:synthetic@postgres/daily_energy",
    });
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it.each(["", "missing"])(
    "fails closed for an empty or unavailable secret (%s)",
    async (mode) => {
      const connect = vi.fn();
      const factory = {
        connect,
        profile: "api" as const,
      } as ReturnType<
        typeof import("@daily-energy/server-adapters/api").createApiDatabaseFactory
      >;
      const file =
        mode === "missing"
          ? path.join(tmpdir(), "daily-energy-api-missing-secret")
          : await secretFile("\n");

      await expect(
        new ApiDatabaseReadiness(file, factory).check(),
      ).resolves.toEqual({
        reasonCode: "REQUIRED_DEPENDENCY_UNAVAILABLE",
        status: "DOWN",
      });
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it("fails closed and disconnects when the API role probe fails", async () => {
    const connect = vi.fn(async () => {
      throw new Error("DB_ROLE_MISMATCH");
    });
    const factory = {
      connect,
      profile: "api" as const,
    } as ReturnType<
      typeof import("@daily-energy/server-adapters/api").createApiDatabaseFactory
    >;
    const file = await secretFile(
      "postgresql://daily_energy_api:synthetic@postgres/daily_energy",
    );

    await expect(
      new ApiDatabaseReadiness(file, factory).check(),
    ).resolves.toEqual({
      reasonCode: "REQUIRED_DEPENDENCY_UNAVAILABLE",
      status: "DOWN",
    });
  });
});
