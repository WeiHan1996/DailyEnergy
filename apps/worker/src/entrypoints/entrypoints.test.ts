import { describe, expect, it, vi } from "vitest";

import type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseProfile,
} from "@daily-energy/server-adapters/testing";

import { createBackgroundWorkerEntrypoint } from "./background.js";
import { createInteractiveWorkerEntrypoint } from "./interactive.js";
import { createMigrationEntrypoint } from "./migration.js";
import { createRestrictedWorkerEntrypoint } from "./restricted.js";

function fakeFactory<Profile extends DatabaseProfile>(profile: Profile) {
  const disconnect = vi.fn(async () => undefined);
  const connection: DatabaseConnection<Profile, unknown> = {
    capability: {},
    disconnect,
    profile,
  };
  const connect = vi.fn(async () => connection);
  return {
    connect,
    disconnect,
    factory: { connect, profile } satisfies DatabaseFactory<Profile, unknown>,
  };
}

const config = {
  connectionString: "postgresql://daily_energy_test:synthetic@db.test/app",
};

describe("worker profile entrypoints", () => {
  it("keeps interactive, background and restricted startup explicit", async () => {
    const interactive = fakeFactory("worker-interactive");
    const background = fakeFactory("worker-background");
    const restricted = fakeFactory("worker-restricted");

    await createInteractiveWorkerEntrypoint(interactive.factory).start(config);
    await createBackgroundWorkerEntrypoint(background.factory).start(config);
    await createRestrictedWorkerEntrypoint(restricted.factory).start(config);

    expect(interactive.connect).toHaveBeenCalledOnce();
    expect(background.connect).toHaveBeenCalledOnce();
    expect(restricted.connect).toHaveBeenCalledOnce();
  });

  it("runs migration once and always disconnects", async () => {
    const setup = fakeFactory("migration");
    const command = { run: vi.fn(async () => undefined) };

    await createMigrationEntrypoint(setup.factory).run(config, command);

    expect(command.run).toHaveBeenCalledOnce();
    expect(setup.disconnect).toHaveBeenCalledOnce();
  });

  it("disconnects when the migration command fails", async () => {
    const setup = fakeFactory("migration");
    const command = {
      run: vi.fn(async () => {
        throw new Error("synthetic migration failure");
      }),
    };

    await expect(
      createMigrationEntrypoint(setup.factory).run(config, command),
    ).rejects.toThrow("synthetic migration failure");
    expect(setup.disconnect).toHaveBeenCalledOnce();
  });
});
