import { createHash } from "node:crypto";

import { z } from "zod";

import { API_CAPABILITY_MANIFEST } from "../composition/api-capability-manifest.js";

export const API_RUNTIME_CONFIG_SCHEMA_VERSION = "api-runtime-config-v1";
export const API_CONTRACT_BUNDLE_VERSION = "api-contract-v1";
export const PRODUCT_DATE_POLICY_VERSION = "product-date-v1";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RELEASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/u;

const PortSchema = z
  .string()
  .regex(/^\d{1,5}$/u)
  .transform((value) => Number(value));

const PositiveMillisecondsSchema = z
  .string()
  .regex(/^\d+$/u)
  .transform((value) => Number(value))
  .pipe(z.number().int().min(1_000).max(60_000));

const PortNumberSchema = z.coerce.number().int().min(1).max(65_535);

const RELEASE_ENVIRONMENTS = ["STAGING", "PRODUCTION", "RECOVERY"] as const;
const SECRET_FILE_PATTERN =
  /^\/run\/secrets\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const FINGERPRINT_EXPECTATION_KEYS = new Set([
  "DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED",
  "DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED",
]);

const RuntimeConfigValueShape = {
  DAILYENERGY_CONFIG_SCHEMA_VERSION: z.literal(
    API_RUNTIME_CONFIG_SCHEMA_VERSION,
  ),
  DAILYENERGY_CONTRACT_BUNDLE_VERSION: z.literal(API_CONTRACT_BUNDLE_VERSION),
  DAILYENERGY_DATABASE_URL_FILE: z
    .string()
    .regex(SECRET_FILE_PATTERN)
    .optional(),
  DAILYENERGY_ENVIRONMENT: z.enum([
    "LOCAL",
    "CI",
    "DEV",
    "STAGING",
    "PRODUCTION",
    "RECOVERY",
  ]),
  DAILYENERGY_HOST: z.string().min(1).max(255).default("127.0.0.1"),
  DAILYENERGY_LOG_LEVEL: z
    .enum(["DEBUG", "INFO", "WARN", "ERROR"])
    .default("INFO"),
  DAILYENERGY_MAINTENANCE_MODE: z
    .enum(["OFF", "DEGRADED", "BLOCKING"])
    .default("OFF"),
  DAILYENERGY_PORT: PortSchema,
  DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: z.literal(
    PRODUCT_DATE_POLICY_VERSION,
  ),
  DAILYENERGY_REDIS_KEY_PREFIX: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/u)
    .optional(),
  DAILYENERGY_REDIS_URL: z.url().optional(),
  DAILYENERGY_RELEASE_ID: z.string().regex(RELEASE_ID_PATTERN),
  DAILYENERGY_RUNTIME_PROFILE: z.literal("API"),
  DAILYENERGY_SHUTDOWN_GRACE_MS: PositiveMillisecondsSchema.default(10_000),
  DAILYENERGY_TELEMETRY_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  DAILYENERGY_TELEMETRY_METRICS_HOST: z
    .enum(["127.0.0.1", "0.0.0.0"])
    .default("127.0.0.1"),
  DAILYENERGY_TELEMETRY_METRICS_PORT: PortNumberSchema.default(9464),
  DAILYENERGY_TELEMETRY_OTLP_TRACE_URL: z
    .url()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
    )
    .default("http://127.0.0.1:4318/v1/traces"),
} as const;

const RuntimeConfigValueObjectSchema = z.strictObject(RuntimeConfigValueShape);
type RuntimeConfigValues = z.infer<typeof RuntimeConfigValueObjectSchema>;

function isReleaseEnvironment(environment: string): boolean {
  return RELEASE_ENVIRONMENTS.some((candidate) => candidate === environment);
}

function validateRuntimeValues(
  value: RuntimeConfigValues,
  context: z.RefinementCtx,
): void {
  if (value.DAILYENERGY_PORT === 0 && value.DAILYENERGY_ENVIRONMENT !== "CI") {
    context.addIssue({
      code: "custom",
      message: "port zero is allowed only in CI",
      path: ["DAILYENERGY_PORT"],
    });
  }
  if (
    value.DAILYENERGY_PORT !== 0 &&
    (value.DAILYENERGY_PORT < 1 || value.DAILYENERGY_PORT > 65_535)
  ) {
    context.addIssue({
      code: "custom",
      message: "port must be in the range 1..65535",
      path: ["DAILYENERGY_PORT"],
    });
  }
  if (
    (value.DAILYENERGY_REDIS_URL === undefined) !==
    (value.DAILYENERGY_REDIS_KEY_PREFIX === undefined)
  ) {
    context.addIssue({
      code: "custom",
      message: "Redis URL and key prefix must be configured together",
      path: ["DAILYENERGY_REDIS_URL"],
    });
  }
  if (
    value.DAILYENERGY_ENVIRONMENT === "PRODUCTION" &&
    value.DAILYENERGY_LOG_LEVEL === "DEBUG"
  ) {
    context.addIssue({
      code: "custom",
      message: "debug logging is forbidden in production",
      path: ["DAILYENERGY_LOG_LEVEL"],
    });
  }
}

const RuntimeConfigValueSchema = RuntimeConfigValueObjectSchema.superRefine(
  validateRuntimeValues,
);

const RuntimeConfigInputSchema = z
  .strictObject({
    ...RuntimeConfigValueShape,
    DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED: z
      .string()
      .regex(SHA256_PATTERN)
      .optional(),
    DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED: z
      .string()
      .regex(SHA256_PATTERN)
      .optional(),
  })
  .superRefine((value, context) => {
    validateRuntimeValues(value, context);
    if (
      isReleaseEnvironment(value.DAILYENERGY_ENVIRONMENT) &&
      value.DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "release environments require an expected deploy fingerprint",
        path: ["DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED"],
      });
    }
    if (
      isReleaseEnvironment(value.DAILYENERGY_ENVIRONMENT) &&
      value.DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED === undefined
    ) {
      context.addIssue({
        code: "custom",
        message:
          "release environments require an expected capability fingerprint",
        path: ["DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED"],
      });
    }
    if (
      isReleaseEnvironment(value.DAILYENERGY_ENVIRONMENT) &&
      value.DAILYENERGY_DATABASE_URL_FILE === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "release environments require a database URL secret file",
        path: ["DAILYENERGY_DATABASE_URL_FILE"],
      });
    }
  });

type RuntimeConfigInput = z.infer<typeof RuntimeConfigInputSchema>;

export type RuntimeEnvironment = RuntimeConfigInput["DAILYENERGY_ENVIRONMENT"];
export type MaintenanceMode =
  RuntimeConfigInput["DAILYENERGY_MAINTENANCE_MODE"];
export type RuntimeLogLevel = RuntimeConfigInput["DAILYENERGY_LOG_LEVEL"];

export interface RuntimeConfig {
  readonly capabilityFingerprint: string;
  readonly configSchemaVersion: typeof API_RUNTIME_CONFIG_SCHEMA_VERSION;
  readonly contractBundleVersion: typeof API_CONTRACT_BUNDLE_VERSION;
  readonly databaseUrlFile?: string;
  readonly deployConfigFingerprint: string;
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly logLevel: RuntimeLogLevel;
  readonly maintenanceMode: MaintenanceMode;
  readonly port: number;
  readonly productDatePolicyVersion: typeof PRODUCT_DATE_POLICY_VERSION;
  readonly redisCache?: {
    readonly keyPrefix: string;
    readonly redisUrl: string;
  };
  readonly releaseId: string;
  readonly runtimeProfile: "API";
  readonly shutdownGraceMs: number;
  readonly telemetry: {
    readonly enabled: boolean;
    readonly metricsHost: "127.0.0.1" | "0.0.0.0";
    readonly metricsPort: number;
    readonly otlpTraceUrl: string;
  };
}

export interface RuntimeFingerprints {
  readonly capabilityFingerprint: string;
  readonly deployConfigFingerprint: string;
}

export class RuntimeConfigError extends Error {
  public constructor(
    public readonly reasonCode:
      | "RUNTIME_CONFIG_INVALID"
      | "DEPLOY_CONFIG_FINGERPRINT_MISMATCH"
      | "CAPABILITY_FINGERPRINT_MISMATCH",
  ) {
    super(reasonCode);
    this.name = "RuntimeConfigError";
  }
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function projectEnvironment(
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith("DAILYENERGY_") && entry[1] !== undefined,
    ),
  );
}

function projectFingerprintEnvironment(
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith("DAILYENERGY_") &&
        !FINGERPRINT_EXPECTATION_KEYS.has(entry[0]) &&
        entry[1] !== undefined,
    ),
  );
}

export function calculateRuntimeFingerprints(
  environment: NodeJS.ProcessEnv,
): RuntimeFingerprints {
  const result = RuntimeConfigValueSchema.safeParse(
    projectFingerprintEnvironment(environment),
  );
  if (!result.success) {
    throw new RuntimeConfigError("RUNTIME_CONFIG_INVALID");
  }

  const input = result.data;
  return {
    capabilityFingerprint: fingerprint(API_CAPABILITY_MANIFEST),
    deployConfigFingerprint: fingerprint({
      config_schema_version: input.DAILYENERGY_CONFIG_SCHEMA_VERSION,
      contract_bundle_version: input.DAILYENERGY_CONTRACT_BUNDLE_VERSION,
      database_url_file: input.DAILYENERGY_DATABASE_URL_FILE ?? "ABSENT",
      environment: input.DAILYENERGY_ENVIRONMENT,
      host: input.DAILYENERGY_HOST,
      log_level: input.DAILYENERGY_LOG_LEVEL,
      maintenance_mode: input.DAILYENERGY_MAINTENANCE_MODE,
      port: input.DAILYENERGY_PORT,
      product_date_policy_version:
        input.DAILYENERGY_PRODUCT_DATE_POLICY_VERSION,
      redis_key_prefix: input.DAILYENERGY_REDIS_KEY_PREFIX ?? "ABSENT",
      redis_url: input.DAILYENERGY_REDIS_URL ?? "ABSENT",
      release_id: input.DAILYENERGY_RELEASE_ID,
      runtime_profile: input.DAILYENERGY_RUNTIME_PROFILE,
      shutdown_grace_ms: input.DAILYENERGY_SHUTDOWN_GRACE_MS,
      telemetry_enabled: input.DAILYENERGY_TELEMETRY_ENABLED,
      telemetry_metrics_host: input.DAILYENERGY_TELEMETRY_METRICS_HOST,
      telemetry_metrics_port: input.DAILYENERGY_TELEMETRY_METRICS_PORT,
      telemetry_otlp_trace_url: input.DAILYENERGY_TELEMETRY_OTLP_TRACE_URL,
    }),
  };
}

export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv,
): RuntimeConfig {
  const result = RuntimeConfigInputSchema.safeParse(
    projectEnvironment(environment),
  );
  if (!result.success) {
    throw new RuntimeConfigError("RUNTIME_CONFIG_INVALID");
  }

  const input = result.data;
  const { capabilityFingerprint, deployConfigFingerprint } =
    calculateRuntimeFingerprints(environment);

  if (
    input.DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED !== undefined &&
    input.DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED !==
      deployConfigFingerprint
  ) {
    throw new RuntimeConfigError("DEPLOY_CONFIG_FINGERPRINT_MISMATCH");
  }
  if (
    input.DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED !== undefined &&
    input.DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED !== capabilityFingerprint
  ) {
    throw new RuntimeConfigError("CAPABILITY_FINGERPRINT_MISMATCH");
  }

  return {
    capabilityFingerprint,
    configSchemaVersion: input.DAILYENERGY_CONFIG_SCHEMA_VERSION,
    contractBundleVersion: input.DAILYENERGY_CONTRACT_BUNDLE_VERSION,
    ...(input.DAILYENERGY_DATABASE_URL_FILE === undefined
      ? {}
      : { databaseUrlFile: input.DAILYENERGY_DATABASE_URL_FILE }),
    deployConfigFingerprint,
    environment: input.DAILYENERGY_ENVIRONMENT,
    host: input.DAILYENERGY_HOST,
    logLevel: input.DAILYENERGY_LOG_LEVEL,
    maintenanceMode: input.DAILYENERGY_MAINTENANCE_MODE,
    port: input.DAILYENERGY_PORT,
    productDatePolicyVersion: input.DAILYENERGY_PRODUCT_DATE_POLICY_VERSION,
    ...(input.DAILYENERGY_REDIS_URL === undefined ||
    input.DAILYENERGY_REDIS_KEY_PREFIX === undefined
      ? {}
      : {
          redisCache: {
            keyPrefix: input.DAILYENERGY_REDIS_KEY_PREFIX,
            redisUrl: input.DAILYENERGY_REDIS_URL,
          },
        }),
    releaseId: input.DAILYENERGY_RELEASE_ID,
    runtimeProfile: input.DAILYENERGY_RUNTIME_PROFILE,
    shutdownGraceMs: input.DAILYENERGY_SHUTDOWN_GRACE_MS,
    telemetry: {
      enabled: input.DAILYENERGY_TELEMETRY_ENABLED,
      metricsHost: input.DAILYENERGY_TELEMETRY_METRICS_HOST,
      metricsPort: input.DAILYENERGY_TELEMETRY_METRICS_PORT,
      otlpTraceUrl: input.DAILYENERGY_TELEMETRY_OTLP_TRACE_URL,
    },
  };
}
