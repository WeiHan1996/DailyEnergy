import { describe, expect, it } from "vitest";

import { parseQueueRuntimeConfig } from "./config.js";
import { fingerprintCapabilityManifest } from "./contracts.js";
import { BACKGROUND_WORKER_MANIFEST } from "./manifests.js";

function config() {
  return {
    concurrency: 4,
    drainTimeoutMs: 5_000,
    egressAllowlist: [...BACKGROUND_WORKER_MANIFEST.egressAllowlist],
    expectedCapabilityFingerprint: fingerprintCapabilityManifest(
      BACKGROUND_WORKER_MANIFEST,
    ),
    expectedDatabaseRole: BACKGROUND_WORKER_MANIFEST.databaseRole,
    expectedProfile: BACKGROUND_WORKER_MANIFEST.profile,
    keyPrefix: "daily-energy-test",
    redisUrl: "redis://redis.test:6379",
    restoreReadiness: "NORMAL",
  } as const;
}

describe("queue runtime config attestation", () => {
  it("accepts the exact profile capability", () => {
    expect(
      parseQueueRuntimeConfig(config(), BACKGROUND_WORKER_MANIFEST),
    ).toMatchObject(config());
  });

  it.each([
    ["profile", { expectedProfile: "worker-interactive" }],
    ["database role", { expectedDatabaseRole: "daily_energy_interactive" }],
    ["egress", { egressAllowlist: ["postgresql", "redis"] }],
    ["fingerprint", { expectedCapabilityFingerprint: "0".repeat(64) }],
  ])("fails closed on %s mismatch", (_label, mutation) => {
    expect(() =>
      parseQueueRuntimeConfig(
        { ...config(), ...mutation },
        BACKGROUND_WORKER_MANIFEST,
      ),
    ).toThrow("QUEUE_CAPABILITY_MISMATCH");
  });

  it("rejects unknown config and non-Redis endpoints", () => {
    expect(() =>
      parseQueueRuntimeConfig(
        { ...config(), extraSecret: "not-allowed" },
        BACKGROUND_WORKER_MANIFEST,
      ),
    ).toThrow("QUEUE_CONFIG_INVALID");
    expect(() =>
      parseQueueRuntimeConfig(
        { ...config(), redisUrl: "https://redis.test" },
        BACKGROUND_WORKER_MANIFEST,
      ),
    ).toThrow("QUEUE_CONFIG_INVALID");
  });
});
