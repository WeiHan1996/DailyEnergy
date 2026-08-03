import { readFile, rm, writeFile } from "node:fs/promises";

import { z } from "zod";

interface WorkerManifest {
  readonly databaseRole: string;
  readonly egressAllowlist: readonly string[];
  readonly profile:
    "worker-interactive" | "worker-background" | "worker-restricted";
}

interface WorkerRuntime {
  drain(): Promise<void>;
  rebuild(limit?: number): Promise<{
    readonly dueRows: number;
    readonly publishedOutbox: number;
    readonly skippedReceipts: number;
    readonly unsupported: number;
  }>;
  relayOnce(options?: {
    readonly batchSize?: number;
    readonly maxAttempts?: number;
  }): Promise<unknown>;
}

interface WorkerProcess {
  readonly runtime: WorkerRuntime;
  drain(): Promise<void>;
}

interface WorkerEntrypoint {
  start(config: {
    readonly database: {
      readonly applicationName: string;
      readonly connectionString: string;
    };
    readonly queue: {
      readonly concurrency: number;
      readonly drainTimeoutMs: number;
      readonly egressAllowlist: string[];
      readonly expectedCapabilityFingerprint: string;
      readonly expectedDatabaseRole: string;
      readonly expectedProfile: WorkerManifest["profile"];
      readonly keyPrefix: string;
      readonly redisUrl: string;
      readonly restoreReadiness: "NORMAL" | "RESTORE_VERIFIED";
    };
  }): Promise<WorkerProcess>;
}

const secretFilePattern = /^\/run\/secrets\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const WorkerEnvironmentSchema = z
  .object({
    DAILYENERGY_WORKER_CAPABILITY_FINGERPRINT_EXPECTED: z
      .string()
      .regex(/^[a-f0-9]{64}$/u),
    DAILYENERGY_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64),
    DAILYENERGY_WORKER_DATABASE_ROLE_EXPECTED: z.string().min(1).max(96),
    DAILYENERGY_WORKER_DATABASE_URL_FILE: z.string().regex(secretFilePattern),
    DAILYENERGY_WORKER_DRAIN_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(60_000),
    DAILYENERGY_WORKER_EGRESS_ALLOWLIST: z.string().min(1).max(512),
    DAILYENERGY_WORKER_HEARTBEAT_FILE: z
      .string()
      .startsWith("/run/dailyenergy/"),
    DAILYENERGY_WORKER_KEY_PREFIX: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,63}$/u),
    DAILYENERGY_WORKER_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(250)
      .max(60_000),
    DAILYENERGY_WORKER_PROFILE: z.enum([
      "worker-interactive",
      "worker-background",
      "worker-restricted",
    ]),
    DAILYENERGY_WORKER_REDIS_URL: z.url(),
    DAILYENERGY_WORKER_RESTORE_READINESS: z.enum([
      "NORMAL",
      "RESTORE_VERIFIED",
    ]),
  })
  .strict();

type WorkerEnvironment = z.infer<typeof WorkerEnvironmentSchema>;

export async function runWorker(options: {
  readonly capabilityFingerprint: string;
  readonly entrypoint: WorkerEntrypoint;
  readonly manifest: WorkerManifest;
}): Promise<void> {
  let processRuntime: WorkerProcess | undefined;
  let timer: NodeJS.Timeout | undefined;
  let stopping = false;
  let runningCheck = false;

  try {
    const config = parseWorkerEnvironment(process.env);
    assertManifest(config, options);
    const connectionString = (
      await readFile(config.DAILYENERGY_WORKER_DATABASE_URL_FILE, "utf8")
    ).trim();
    if (connectionString.length === 0) {
      throw new Error("WORKER_DATABASE_SECRET_EMPTY");
    }
    processRuntime = await options.entrypoint.start({
      database: {
        applicationName: `daily-energy:${options.manifest.profile}`,
        connectionString,
      },
      queue: {
        concurrency: config.DAILYENERGY_WORKER_CONCURRENCY,
        drainTimeoutMs: config.DAILYENERGY_WORKER_DRAIN_TIMEOUT_MS,
        egressAllowlist: parseEgress(
          config.DAILYENERGY_WORKER_EGRESS_ALLOWLIST,
        ),
        expectedCapabilityFingerprint:
          config.DAILYENERGY_WORKER_CAPABILITY_FINGERPRINT_EXPECTED,
        expectedDatabaseRole: config.DAILYENERGY_WORKER_DATABASE_ROLE_EXPECTED,
        expectedProfile: config.DAILYENERGY_WORKER_PROFILE,
        keyPrefix: config.DAILYENERGY_WORKER_KEY_PREFIX,
        redisUrl: config.DAILYENERGY_WORKER_REDIS_URL,
        restoreReadiness: config.DAILYENERGY_WORKER_RESTORE_READINESS,
      },
    });

    const check = async (): Promise<void> => {
      if (runningCheck || stopping || processRuntime === undefined) {
        return;
      }
      runningCheck = true;
      try {
        if (options.manifest.profile === "worker-background") {
          await processRuntime.runtime.relayOnce();
        }
        await processRuntime.runtime.rebuild(100);
        await writeHeartbeat(
          config.DAILYENERGY_WORKER_HEARTBEAT_FILE,
          options.manifest.profile,
        );
      } catch {
        await rm(config.DAILYENERGY_WORKER_HEARTBEAT_FILE, {
          force: true,
        });
        writeLifecycle(
          "WARN",
          options.manifest.profile,
          "DEPENDENCY_UNAVAILABLE",
        );
      } finally {
        runningCheck = false;
      }
    };

    if (config.DAILYENERGY_WORKER_RESTORE_READINESS === "RESTORE_VERIFIED") {
      await rebuildUntilEmpty(processRuntime.runtime);
    }
    await check();
    timer = setInterval(check, config.DAILYENERGY_WORKER_POLL_INTERVAL_MS);

    const stop = async (): Promise<void> => {
      if (stopping) {
        return;
      }
      stopping = true;
      if (timer !== undefined) {
        clearInterval(timer);
      }
      await rm(config.DAILYENERGY_WORKER_HEARTBEAT_FILE, { force: true });
      await processRuntime?.drain();
      writeLifecycle("INFO", options.manifest.profile, "DRAINED");
    };
    process.once("SIGINT", () => void stop().then(() => process.exit(0)));
    process.once("SIGTERM", () => void stop().then(() => process.exit(0)));
    writeLifecycle("INFO", options.manifest.profile, "STARTED");
  } catch {
    if (timer !== undefined) {
      clearInterval(timer);
    }
    await processRuntime?.drain().catch(() => undefined);
    writeLifecycle("ERROR", options.manifest.profile, "STARTUP_REJECTED");
    process.exitCode = 1;
  }
}

function parseWorkerEnvironment(
  environment: NodeJS.ProcessEnv,
): WorkerEnvironment {
  const projectEnvironment = Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith("DAILYENERGY_WORKER_") && entry[1] !== undefined,
    ),
  );
  const result = WorkerEnvironmentSchema.safeParse(projectEnvironment);
  if (!result.success) {
    throw new Error("WORKER_CONFIG_INVALID");
  }
  return result.data;
}

function assertManifest(
  config: WorkerEnvironment,
  options: {
    readonly capabilityFingerprint: string;
    readonly manifest: WorkerManifest;
  },
): void {
  if (
    config.DAILYENERGY_WORKER_PROFILE !== options.manifest.profile ||
    config.DAILYENERGY_WORKER_DATABASE_ROLE_EXPECTED !==
      options.manifest.databaseRole ||
    config.DAILYENERGY_WORKER_CAPABILITY_FINGERPRINT_EXPECTED !==
      options.capabilityFingerprint ||
    JSON.stringify(parseEgress(config.DAILYENERGY_WORKER_EGRESS_ALLOWLIST)) !==
      JSON.stringify([...options.manifest.egressAllowlist].sort())
  ) {
    throw new Error("WORKER_CAPABILITY_MISMATCH");
  }
}

function parseEgress(value: string): string[] {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
  if (entries.length === 0 || new Set(entries).size !== entries.length) {
    throw new Error("WORKER_EGRESS_INVALID");
  }
  return entries;
}

async function rebuildUntilEmpty(runtime: WorkerRuntime): Promise<void> {
  for (let pass = 0; pass < 20; pass += 1) {
    const result = await runtime.rebuild(100);
    if (result.unsupported > 0) {
      throw new Error("REDIS_REBUILD_UNSUPPORTED");
    }
    if (result.dueRows === 0 && result.publishedOutbox === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("REDIS_REBUILD_BACKLOG_REMAINS");
}

async function writeHeartbeat(file: string, profile: string): Promise<void> {
  await writeFile(
    file,
    `${JSON.stringify({ checked_at: new Date().toISOString(), profile, status: "READY" })}\n`,
    { mode: 0o600 },
  );
}

function writeLifecycle(
  severity: "ERROR" | "INFO" | "WARN",
  profile: string,
  reasonCode: string,
): void {
  process.stdout.write(
    `${JSON.stringify({
      message_code: "WORKER_LIFECYCLE",
      operation_code: "WORKER_LIFECYCLE",
      outcome_code: severity === "INFO" ? "SUCCESS" : "TERMINAL",
      profile,
      reason_code: reasonCode,
      severity,
      timestamp: new Date().toISOString(),
    })}\n`,
  );
}

export const workerRuntimeTesting = Object.freeze({
  assertManifest,
  parseEgress,
  parseWorkerEnvironment,
  rebuildUntilEmpty,
  writeHeartbeat,
});
