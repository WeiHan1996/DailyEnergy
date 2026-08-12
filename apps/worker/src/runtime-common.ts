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

interface WorkerTelemetryEvent {
  readonly operationCode:
    | "QUEUE_CONNECT"
    | "QUEUE_ENQUEUE"
    | "QUEUE_HANDLE"
    | "QUEUE_DRAIN"
    | "OUTBOX_RELAY"
    | "REDIS_REBUILD";
  readonly outcomeCode:
    "SUCCESS" | "DUPLICATE" | "EXPECTED_REJECT" | "RETRYABLE" | "TERMINAL";
  readonly profile:
    "worker-interactive" | "worker-background" | "worker-restricted";
  readonly queueFamily: "interactive" | "background" | "restricted";
  readonly reasonCode?: string;
  readonly retryOrdinal?: number;
}

interface WorkerTelemetrySink {
  record(event: WorkerTelemetryEvent): void;
}

interface WorkerProcess {
  readonly runtime: WorkerRuntime;
  drain(): Promise<void>;
}

interface WorkerEntrypoint {
  start(
    config: {
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
    },
    telemetry?: WorkerTelemetrySink,
  ): Promise<WorkerProcess>;
}

interface WorkerTelemetryRuntime {
  readonly runtime: { shutdown(): Promise<void> };
  readonly sink: WorkerTelemetrySink;
}

interface WorkerTelemetryFactory {
  (config: {
    readonly configSchemaVersion: string;
    readonly contractBundleVersion: string;
    readonly enabled: boolean;
    readonly environment:
      "LOCAL" | "CI" | "DEV" | "STAGING" | "PRODUCTION" | "RECOVERY";
    readonly metricsHost: "127.0.0.1" | "0.0.0.0";
    readonly metricsPort: number;
    readonly otlpTraceUrl: string;
    readonly releaseId: string;
    readonly serviceVersion: string;
  }): WorkerTelemetryRuntime;
}

type WorkerTelemetryConfig = Parameters<WorkerTelemetryFactory>[0];

const secretFilePattern = /^\/run\/secrets\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const WORKER_RUNTIME_CONFIG_SCHEMA_VERSION = "worker-runtime-config-v1";
const WORKER_CONTRACT_BUNDLE_VERSION = "worker-contract-v1";

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
    DAILYENERGY_WORKER_TELEMETRY_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
    DAILYENERGY_WORKER_TELEMETRY_ENVIRONMENT: z.enum([
      "LOCAL",
      "CI",
      "DEV",
      "STAGING",
      "PRODUCTION",
      "RECOVERY",
    ]),
    DAILYENERGY_WORKER_TELEMETRY_METRICS_HOST: z
      .enum(["127.0.0.1", "0.0.0.0"])
      .default("127.0.0.1"),
    DAILYENERGY_WORKER_TELEMETRY_METRICS_PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65_535)
      .default(9464),
    DAILYENERGY_WORKER_TELEMETRY_OTLP_TRACE_URL: z
      .url()
      .default("http://127.0.0.1:4318/v1/traces"),
    DAILYENERGY_WORKER_TELEMETRY_RELEASE_ID: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/u),
  })
  .strict();

type WorkerEnvironment = z.infer<typeof WorkerEnvironmentSchema>;

export async function runWorker(options: {
  readonly capabilityFingerprint: string;
  readonly entrypoint: WorkerEntrypoint;
  readonly manifest: WorkerManifest;
  readonly telemetryFactory?: WorkerTelemetryFactory;
}): Promise<void> {
  let processRuntime: WorkerProcess | undefined;
  let timer: NodeJS.Timeout | undefined;
  let stopping = false;
  let runningCheck = false;
  let telemetry: WorkerTelemetryRuntime | undefined;
  let config: WorkerEnvironment | undefined;

  try {
    const runtimeConfig = parseWorkerEnvironment(process.env);
    config = runtimeConfig;
    assertManifest(runtimeConfig, options);
    telemetry = startWorkerTelemetrySafely(options.telemetryFactory, {
      configSchemaVersion: WORKER_RUNTIME_CONFIG_SCHEMA_VERSION,
      contractBundleVersion: WORKER_CONTRACT_BUNDLE_VERSION,
      enabled: runtimeConfig.DAILYENERGY_WORKER_TELEMETRY_ENABLED,
      environment: runtimeConfig.DAILYENERGY_WORKER_TELEMETRY_ENVIRONMENT,
      metricsHost: runtimeConfig.DAILYENERGY_WORKER_TELEMETRY_METRICS_HOST,
      metricsPort: runtimeConfig.DAILYENERGY_WORKER_TELEMETRY_METRICS_PORT,
      otlpTraceUrl: runtimeConfig.DAILYENERGY_WORKER_TELEMETRY_OTLP_TRACE_URL,
      releaseId: runtimeConfig.DAILYENERGY_WORKER_TELEMETRY_RELEASE_ID,
      serviceVersion: "0.1.0",
    });
    const connectionString = (
      await readFile(runtimeConfig.DAILYENERGY_WORKER_DATABASE_URL_FILE, "utf8")
    ).trim();
    if (connectionString.length === 0) {
      throw new Error("WORKER_DATABASE_SECRET_EMPTY");
    }
    processRuntime = await options.entrypoint.start(
      {
        database: {
          applicationName: `daily-energy:${options.manifest.profile}`,
          connectionString,
        },
        queue: {
          concurrency: runtimeConfig.DAILYENERGY_WORKER_CONCURRENCY,
          drainTimeoutMs: runtimeConfig.DAILYENERGY_WORKER_DRAIN_TIMEOUT_MS,
          egressAllowlist: parseEgress(
            runtimeConfig.DAILYENERGY_WORKER_EGRESS_ALLOWLIST,
          ),
          expectedCapabilityFingerprint:
            runtimeConfig.DAILYENERGY_WORKER_CAPABILITY_FINGERPRINT_EXPECTED,
          expectedDatabaseRole:
            runtimeConfig.DAILYENERGY_WORKER_DATABASE_ROLE_EXPECTED,
          expectedProfile: runtimeConfig.DAILYENERGY_WORKER_PROFILE,
          keyPrefix: runtimeConfig.DAILYENERGY_WORKER_KEY_PREFIX,
          redisUrl: runtimeConfig.DAILYENERGY_WORKER_REDIS_URL,
          restoreReadiness: runtimeConfig.DAILYENERGY_WORKER_RESTORE_READINESS,
        },
      },
      telemetry?.sink,
    );

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
          runtimeConfig.DAILYENERGY_WORKER_HEARTBEAT_FILE,
          options.manifest.profile,
        );
      } catch {
        await rm(runtimeConfig.DAILYENERGY_WORKER_HEARTBEAT_FILE, {
          force: true,
        });
        writeLifecycle("WARN", runtimeConfig, "DEPENDENCY_UNAVAILABLE");
      } finally {
        runningCheck = false;
      }
    };

    if (
      runtimeConfig.DAILYENERGY_WORKER_RESTORE_READINESS === "RESTORE_VERIFIED"
    ) {
      await rebuildUntilEmpty(processRuntime.runtime);
    }
    await check();
    timer = setInterval(
      check,
      runtimeConfig.DAILYENERGY_WORKER_POLL_INTERVAL_MS,
    );

    const stop = async (): Promise<void> => {
      if (stopping) {
        return;
      }
      stopping = true;
      if (timer !== undefined) {
        clearInterval(timer);
      }
      await rm(runtimeConfig.DAILYENERGY_WORKER_HEARTBEAT_FILE, {
        force: true,
      });
      await processRuntime?.drain();
      await telemetry?.runtime.shutdown().catch(() => undefined);
      writeLifecycle("INFO", runtimeConfig, "DRAINED");
    };
    process.once("SIGINT", () => void stop().then(() => process.exit(0)));
    process.once("SIGTERM", () => void stop().then(() => process.exit(0)));
    writeLifecycle("INFO", runtimeConfig, "STARTED");
  } catch {
    if (timer !== undefined) {
      clearInterval(timer);
    }
    await processRuntime?.drain().catch(() => undefined);
    await telemetry?.runtime.shutdown().catch(() => undefined);
    writeLifecycle(
      "ERROR",
      config,
      "STARTUP_REJECTED",
      options.manifest.profile,
    );
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

function startWorkerTelemetrySafely(
  factory: WorkerTelemetryFactory | undefined,
  config: WorkerTelemetryConfig,
): WorkerTelemetryRuntime | undefined {
  try {
    return factory?.(config);
  } catch {
    return undefined;
  }
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
  config: WorkerEnvironment | undefined,
  reasonCode: string,
  fallbackProfile?: WorkerManifest["profile"],
): void {
  const profile = config?.DAILYENERGY_WORKER_PROFILE ?? fallbackProfile;
  const runtimeProfile =
    profile === "worker-interactive"
      ? "INTERACTIVE"
      : profile === "worker-background"
        ? "BACKGROUND"
        : "RESTRICTED";
  const service =
    profile === "worker-interactive"
      ? "interactive"
      : profile === "worker-background"
        ? "background"
        : "restricted";
  process.stdout.write(
    `${JSON.stringify({
      contract_version: "ordinary-log-v1",
      environment: config?.DAILYENERGY_WORKER_TELEMETRY_ENVIRONMENT ?? "LOCAL",
      message_code: "WORKER_LIFECYCLE",
      operation_code: "WORKER_LIFECYCLE",
      outcome_code: severity === "INFO" ? "SUCCESS" : "TERMINAL",
      release_id:
        config?.DAILYENERGY_WORKER_TELEMETRY_RELEASE_ID ?? "startup-rejected",
      reason_code: reasonCode,
      runtime_profile: runtimeProfile,
      service,
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
  startWorkerTelemetrySafely,
  writeHeartbeat,
  writeLifecycle,
});
