import { z } from "zod";

import type { WorkerCapabilityManifest } from "./contracts.js";
import { fingerprintCapabilityManifest } from "./contracts.js";

const queueRuntimeConfigSchema = z
  .object({
    concurrency: z.number().int().min(1).max(64).default(1),
    drainTimeoutMs: z.number().int().min(100).max(60_000).default(10_000),
    egressAllowlist: z.array(z.string().min(1).max(96)).max(16),
    expectedCapabilityFingerprint: z.string().length(64),
    expectedDatabaseRole: z.string().min(1).max(96),
    expectedProfile: z.enum([
      "worker-interactive",
      "worker-background",
      "worker-restricted",
    ]),
    keyPrefix: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/u),
    redisUrl: z.url(),
    restoreReadiness: z.enum(["NORMAL", "RESTORE_VERIFIED"]),
  })
  .strict();

export type QueueRuntimeConfig = z.infer<typeof queueRuntimeConfigSchema>;

export function parseQueueRuntimeConfig(
  value: unknown,
  manifest: WorkerCapabilityManifest,
): QueueRuntimeConfig {
  const parsed = queueRuntimeConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("QUEUE_CONFIG_INVALID");
  }
  const config = parsed.data;
  let redisUrl: URL;
  try {
    redisUrl = new URL(config.redisUrl);
  } catch {
    throw new Error("QUEUE_CONFIG_INVALID");
  }
  if (redisUrl.protocol !== "redis:" && redisUrl.protocol !== "rediss:") {
    throw new Error("QUEUE_CONFIG_INVALID");
  }

  const expectedEgress = [...manifest.egressAllowlist].sort();
  const actualEgress = [...config.egressAllowlist].sort();
  const capabilityMatches =
    config.expectedProfile === manifest.profile &&
    config.expectedDatabaseRole === manifest.databaseRole &&
    config.expectedCapabilityFingerprint ===
      fingerprintCapabilityManifest(manifest) &&
    expectedEgress.length === actualEgress.length &&
    expectedEgress.every((value, index) => value === actualEgress[index]);
  if (!capabilityMatches) {
    throw new Error("QUEUE_CAPABILITY_MISMATCH");
  }
  return Object.freeze({ ...config, egressAllowlist: actualEgress });
}
