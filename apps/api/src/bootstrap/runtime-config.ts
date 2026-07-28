import { createHash } from "node:crypto";

import { z } from "zod";

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

const RuntimeConfigInputSchema = z
  .strictObject({
    DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED: z
      .string()
      .regex(SHA256_PATTERN)
      .optional(),
    DAILYENERGY_CONFIG_SCHEMA_VERSION: z.literal(
      API_RUNTIME_CONFIG_SCHEMA_VERSION,
    ),
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: z.literal(API_CONTRACT_BUNDLE_VERSION),
    DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED: z
      .string()
      .regex(SHA256_PATTERN)
      .optional(),
    DAILYENERGY_ENVIRONMENT: z.enum([
      "LOCAL",
      "TEST",
      "DEVELOPMENT",
      "STAGING",
      "PRODUCTION",
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
    DAILYENERGY_RELEASE_ID: z.string().regex(RELEASE_ID_PATTERN),
    DAILYENERGY_RUNTIME_PROFILE: z.literal("API"),
    DAILYENERGY_SHUTDOWN_GRACE_MS: PositiveMillisecondsSchema.default(10_000),
  })
  .superRefine((value, context) => {
    if (
      value.DAILYENERGY_PORT === 0 &&
      value.DAILYENERGY_ENVIRONMENT !== "TEST"
    ) {
      context.addIssue({
        code: "custom",
        message: "port zero is allowed only in TEST",
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
      value.DAILYENERGY_ENVIRONMENT === "PRODUCTION" &&
      value.DAILYENERGY_LOG_LEVEL === "DEBUG"
    ) {
      context.addIssue({
        code: "custom",
        message: "debug logging is forbidden in production",
        path: ["DAILYENERGY_LOG_LEVEL"],
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
  readonly deployConfigFingerprint: string;
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly logLevel: RuntimeLogLevel;
  readonly maintenanceMode: MaintenanceMode;
  readonly port: number;
  readonly productDatePolicyVersion: typeof PRODUCT_DATE_POLICY_VERSION;
  readonly releaseId: string;
  readonly runtimeProfile: "API";
  readonly shutdownGraceMs: number;
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

const API_CAPABILITIES = [
  "ADMIN_TRANSPORT",
  "HEALTH_PROBES",
  "PUBLIC_TRANSPORT",
] as const;

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
  const deployConfigFingerprint = fingerprint({
    config_schema_version: input.DAILYENERGY_CONFIG_SCHEMA_VERSION,
    contract_bundle_version: input.DAILYENERGY_CONTRACT_BUNDLE_VERSION,
    environment: input.DAILYENERGY_ENVIRONMENT,
    host: input.DAILYENERGY_HOST,
    log_level: input.DAILYENERGY_LOG_LEVEL,
    maintenance_mode: input.DAILYENERGY_MAINTENANCE_MODE,
    port: input.DAILYENERGY_PORT,
    product_date_policy_version: input.DAILYENERGY_PRODUCT_DATE_POLICY_VERSION,
    release_id: input.DAILYENERGY_RELEASE_ID,
    runtime_profile: input.DAILYENERGY_RUNTIME_PROFILE,
    shutdown_grace_ms: input.DAILYENERGY_SHUTDOWN_GRACE_MS,
  });
  const capabilityFingerprint = fingerprint({
    capabilities: API_CAPABILITIES,
    runtime_profile: input.DAILYENERGY_RUNTIME_PROFILE,
  });

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
    deployConfigFingerprint,
    environment: input.DAILYENERGY_ENVIRONMENT,
    host: input.DAILYENERGY_HOST,
    logLevel: input.DAILYENERGY_LOG_LEVEL,
    maintenanceMode: input.DAILYENERGY_MAINTENANCE_MODE,
    port: input.DAILYENERGY_PORT,
    productDatePolicyVersion: input.DAILYENERGY_PRODUCT_DATE_POLICY_VERSION,
    releaseId: input.DAILYENERGY_RELEASE_ID,
    runtimeProfile: input.DAILYENERGY_RUNTIME_PROFILE,
    shutdownGraceMs: input.DAILYENERGY_SHUTDOWN_GRACE_MS,
  };
}
