import { describe, expect, it, vi } from "vitest";

import type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseProfile,
  WorkerCapabilityManifest,
  WorkerInfrastructureConfig,
  WorkerInfrastructureRuntime,
} from "@daily-energy/server-adapters/testing";
import {
  BACKGROUND_WORKER_MANIFEST,
  fingerprintCapabilityManifest,
  INTERACTIVE_WORKER_MANIFEST,
  RESTRICTED_WORKER_MANIFEST,
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

const migrationConfig = {
  connectionString: "postgresql://daily_energy_test:synthetic@db.test/app",
};

function workerConfig(
  manifest: WorkerCapabilityManifest,
): WorkerInfrastructureConfig {
  return {
    database: migrationConfig,
    queue: {
      concurrency: 1,
      drainTimeoutMs: 1_000,
      egressAllowlist: [...manifest.egressAllowlist],
      expectedCapabilityFingerprint: fingerprintCapabilityManifest(manifest),
      expectedDatabaseRole: manifest.databaseRole,
      expectedProfile: manifest.profile,
      keyPrefix: "daily-energy-test",
      redisUrl: "redis://redis.test:6379",
      restoreReadiness: "NORMAL",
    },
  };
}

function fakeRuntime(manifest: WorkerCapabilityManifest) {
  const drain = vi.fn(async () => undefined);
  const runtime = {
    drain,
    manifest,
    rebuild: vi.fn(async () => ({
      dueRows: 0,
      publishedOutbox: 0,
      skippedReceipts: 0,
      unsupported: 0,
    })),
    relayOnce: vi.fn(async () => ({
      failed: 0,
      published: 0,
      retryable: 0,
      unsupported: 0,
    })),
  } satisfies WorkerInfrastructureRuntime;
  return { drain, runtime };
}

describe("worker profile entrypoints", () => {
  it("keeps interactive, background and restricted startup explicit", async () => {
    const interactive = fakeFactory("worker-interactive");
    const background = fakeFactory("worker-background");
    const restricted = fakeFactory("worker-restricted");
    const interactiveRuntime = fakeRuntime(INTERACTIVE_WORKER_MANIFEST);
    const backgroundRuntime = fakeRuntime(BACKGROUND_WORKER_MANIFEST);
    const restrictedRuntime = fakeRuntime(RESTRICTED_WORKER_MANIFEST);
    const startInteractive = vi.fn(async () => interactiveRuntime.runtime);
    const startBackground = vi.fn(async () => backgroundRuntime.runtime);
    const startRestricted = vi.fn(async () => restrictedRuntime.runtime);

    const interactiveConfig = workerConfig(INTERACTIVE_WORKER_MANIFEST);
    const backgroundConfig = workerConfig(BACKGROUND_WORKER_MANIFEST);
    const restrictedConfig = workerConfig(RESTRICTED_WORKER_MANIFEST);

    const interactiveProcess = await createInteractiveWorkerEntrypoint(
      interactive.factory,
      startInteractive,
    ).start(interactiveConfig);
    const backgroundProcess = await createBackgroundWorkerEntrypoint(
      background.factory,
      startBackground,
    ).start(backgroundConfig);
    const restrictedProcess = await createRestrictedWorkerEntrypoint(
      restricted.factory,
      startRestricted,
    ).start(restrictedConfig);

    expect(interactive.connect).toHaveBeenCalledWith(
      interactiveConfig.database,
    );
    expect(background.connect).toHaveBeenCalledWith(backgroundConfig.database);
    expect(restricted.connect).toHaveBeenCalledWith(restrictedConfig.database);
    expect(startInteractive).toHaveBeenCalledWith(interactiveConfig, []);
    expect(startBackground).toHaveBeenCalledWith(backgroundConfig, []);
    expect(startRestricted).toHaveBeenCalledWith(
      restrictedConfig,
      expect.arrayContaining([
        expect.objectContaining({ eventType: "DataDeletionStarted" }),
        expect.objectContaining({ eventType: "DataTaskDue" }),
        expect.objectContaining({ eventType: "DataRightsRetentionDue" }),
        expect.objectContaining({ eventType: "DeletionGuarded" }),
      ]),
    );

    await Promise.all([
      interactiveProcess.drain(),
      backgroundProcess.drain(),
      restrictedProcess.drain(),
    ]);
    await interactiveProcess.drain();

    expect(interactiveRuntime.drain).toHaveBeenCalledOnce();
    expect(backgroundRuntime.drain).toHaveBeenCalledOnce();
    expect(restrictedRuntime.drain).toHaveBeenCalledOnce();
    expect(interactive.disconnect).toHaveBeenCalledOnce();
    expect(background.disconnect).toHaveBeenCalledOnce();
    expect(restricted.disconnect).toHaveBeenCalledOnce();
  });

  it("disconnects the profile database when infrastructure startup fails", async () => {
    const setup = fakeFactory("worker-background");
    const start = vi.fn(async () => {
      throw new Error("synthetic queue startup failure");
    });

    await expect(
      createBackgroundWorkerEntrypoint(setup.factory, start).start(
        workerConfig(BACKGROUND_WORKER_MANIFEST),
      ),
    ).rejects.toThrow("synthetic queue startup failure");
    expect(setup.disconnect).toHaveBeenCalledOnce();
  });

  it("runs migration once and always disconnects", async () => {
    const setup = fakeFactory("migration");
    const command = { run: vi.fn(async () => undefined) };

    await createMigrationEntrypoint(setup.factory).run(
      migrationConfig,
      command,
    );

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
      createMigrationEntrypoint(setup.factory).run(migrationConfig, command),
    ).rejects.toThrow("synthetic migration failure");
    expect(setup.disconnect).toHaveBeenCalledOnce();
  });
});
