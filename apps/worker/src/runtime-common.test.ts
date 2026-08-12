import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { workerRuntimeTesting } from "./runtime-common.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("worker Compose runtime", () => {
  it("rejects a capability or profile mismatch without exposing configuration", () => {
    const manifest = {
      databaseRole: "daily_energy_interactive",
      egressAllowlist: ["ai.daily", "postgresql", "redis"],
      profile: "worker-interactive" as const,
    };
    const config = workerRuntimeTesting.parseWorkerEnvironment({
      DAILYENERGY_WORKER_CAPABILITY_FINGERPRINT_EXPECTED: "0".repeat(64),
      DAILYENERGY_WORKER_CONCURRENCY: "1",
      DAILYENERGY_WORKER_DATABASE_ROLE_EXPECTED: "daily_energy_interactive",
      DAILYENERGY_WORKER_DATABASE_URL_FILE:
        "/run/secrets/worker-interactive-database-url",
      DAILYENERGY_WORKER_DRAIN_TIMEOUT_MS: "1000",
      DAILYENERGY_WORKER_EGRESS_ALLOWLIST: "ai.daily,postgresql,redis",
      DAILYENERGY_WORKER_HEARTBEAT_FILE:
        "/run/dailyenergy/worker-interactive.json",
      DAILYENERGY_WORKER_KEY_PREFIX: "daily-energy-local",
      DAILYENERGY_WORKER_POLL_INTERVAL_MS: "1000",
      DAILYENERGY_WORKER_PROFILE: "worker-interactive",
      DAILYENERGY_WORKER_REDIS_URL: "redis://redis:6379",
      DAILYENERGY_WORKER_RESTORE_READINESS: "NORMAL",
      DAILYENERGY_WORKER_TELEMETRY_ENVIRONMENT: "CI",
      DAILYENERGY_WORKER_TELEMETRY_RELEASE_ID: "synthetic-worker-v1",
    });

    expect(() =>
      workerRuntimeTesting.assertManifest(config, {
        capabilityFingerprint: "1".repeat(64),
        manifest,
      }),
    ).toThrowError("WORKER_CAPABILITY_MISMATCH");
  });

  it("writes a content-free heartbeat atomically enough for health checks", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "daily-energy-worker-"),
    );
    temporaryDirectories.push(directory);
    const file = path.join(directory, "heartbeat.json");

    await workerRuntimeTesting.writeHeartbeat(file, "worker-background");

    const heartbeat = JSON.parse(await readFile(file, "utf8")) as Record<
      string,
      string
    >;
    expect(heartbeat).toMatchObject({
      profile: "worker-background",
      status: "READY",
    });
    expect(heartbeat.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    expect(Object.keys(heartbeat).sort()).toEqual([
      "checked_at",
      "profile",
      "status",
    ]);
  });

  it("writes only the closed content-free Worker lifecycle contract", () => {
    const output: string[] = [];
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        output.push(String(chunk));
        return true;
      });
    const config = workerRuntimeTesting.parseWorkerEnvironment({
      DAILYENERGY_WORKER_CAPABILITY_FINGERPRINT_EXPECTED: "0".repeat(64),
      DAILYENERGY_WORKER_CONCURRENCY: "1",
      DAILYENERGY_WORKER_DATABASE_ROLE_EXPECTED: "daily_energy_background",
      DAILYENERGY_WORKER_DATABASE_URL_FILE:
        "/run/secrets/worker-background-database-url",
      DAILYENERGY_WORKER_DRAIN_TIMEOUT_MS: "1000",
      DAILYENERGY_WORKER_EGRESS_ALLOWLIST:
        "ai.weekly,postgresql,redis,wechat.notification",
      DAILYENERGY_WORKER_HEARTBEAT_FILE:
        "/run/dailyenergy/worker-background.json",
      DAILYENERGY_WORKER_KEY_PREFIX: "daily-energy-ci",
      DAILYENERGY_WORKER_POLL_INTERVAL_MS: "1000",
      DAILYENERGY_WORKER_PROFILE: "worker-background",
      DAILYENERGY_WORKER_REDIS_URL: "redis://redis:6379",
      DAILYENERGY_WORKER_RESTORE_READINESS: "NORMAL",
      DAILYENERGY_WORKER_TELEMETRY_ENVIRONMENT: "CI",
      DAILYENERGY_WORKER_TELEMETRY_RELEASE_ID: "synthetic-worker-v1",
    });

    workerRuntimeTesting.writeLifecycle(
      "WARN",
      config,
      "DEPENDENCY_UNAVAILABLE",
    );

    write.mockRestore();
    const event = JSON.parse(output.join("")) as Record<string, unknown>;
    expect(event).toEqual({
      contract_version: "ordinary-log-v1",
      environment: "CI",
      message_code: "WORKER_LIFECYCLE",
      operation_code: "WORKER_LIFECYCLE",
      outcome_code: "TERMINAL",
      reason_code: "DEPENDENCY_UNAVAILABLE",
      release_id: "synthetic-worker-v1",
      runtime_profile: "BACKGROUND",
      service: "background",
      severity: "WARN",
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(event)).not.toMatch(
      /payload|job_ref|account|prompt|provider_response/iu,
    );
  });

  it("keeps Worker startup available when telemetry initialization fails", async () => {
    const telemetry = workerRuntimeTesting.startWorkerTelemetrySafely(
      () => {
        throw new Error("synthetic exporter initialization failure");
      },
      {
        configSchemaVersion: "worker-runtime-config-v1",
        contractBundleVersion: "worker-contract-v1",
        enabled: true,
        environment: "CI",
        metricsHost: "127.0.0.1",
        metricsPort: 9464,
        otlpTraceUrl: "http://127.0.0.1:4318/v1/traces",
        releaseId: "synthetic-worker-v1",
        serviceVersion: "0.1.0",
      },
    );
    const startBusinessRuntime = vi.fn(
      async (_sink: unknown) => "business-started",
    );

    await expect(startBusinessRuntime(telemetry?.sink)).resolves.toBe(
      "business-started",
    );
    expect(telemetry).toBeUndefined();
    expect(startBusinessRuntime).toHaveBeenCalledWith(undefined);
  });

  it("rebuilds bounded batches until the eligible PostgreSQL backlog is empty", async () => {
    vi.useFakeTimers();
    const rebuild = vi
      .fn()
      .mockResolvedValueOnce({
        dueRows: 100,
        publishedOutbox: 0,
        skippedReceipts: 0,
        unsupported: 0,
      })
      .mockResolvedValueOnce({
        dueRows: 1,
        publishedOutbox: 1,
        skippedReceipts: 0,
        unsupported: 0,
      })
      .mockResolvedValueOnce({
        dueRows: 0,
        publishedOutbox: 0,
        skippedReceipts: 0,
        unsupported: 0,
      });
    const completion = workerRuntimeTesting.rebuildUntilEmpty({
      drain: vi.fn(),
      rebuild,
      relayOnce: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(500);
    await expect(completion).resolves.toBeUndefined();
    expect(rebuild).toHaveBeenCalledTimes(3);
    expect(rebuild).toHaveBeenCalledWith(100);
  });

  it("fails after twenty bounded rebuild passes", async () => {
    vi.useFakeTimers();
    const rebuild = vi.fn(async () => ({
      dueRows: 1,
      publishedOutbox: 0,
      skippedReceipts: 0,
      unsupported: 0,
    }));
    const completion = workerRuntimeTesting.rebuildUntilEmpty({
      drain: vi.fn(),
      rebuild,
      relayOnce: vi.fn(),
    });
    const rejection = expect(completion).rejects.toThrowError(
      "REDIS_REBUILD_BACKLOG_REMAINS",
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
    expect(rebuild).toHaveBeenCalledTimes(20);
  });
});
