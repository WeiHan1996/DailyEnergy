export const MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION =
  "miniapp-public-build-config-v1";

export const MINIAPP_ENVIRONMENTS = [
  "LOCAL",
  "CI",
  "DEV",
  "STAGING",
  "PRODUCTION",
  "MINIAPP_RUNNER",
] as const;

export type MiniappEnvironment = (typeof MINIAPP_ENVIRONMENTS)[number];

export interface PublicBuildConfigInput {
  readonly apiOrigin: string;
  readonly appVersion: string;
  readonly environment: string;
  readonly schemaVersion: string;
}

export interface PublicBuildConfig {
  readonly apiOrigin: string;
  readonly appVersion: string;
  readonly environment: MiniappEnvironment;
  readonly schemaVersion: typeof MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION;
}

export class PublicBuildConfigError extends Error {
  public readonly code = "MINIAPP_PUBLIC_CONFIG_INVALID";

  public constructor() {
    super("The miniapp public build configuration is invalid.");
    this.name = "PublicBuildConfigError";
  }
}

const expectedKeys = [
  "apiOrigin",
  "appVersion",
  "environment",
  "schemaVersion",
];
const originPattern = /^(https?):\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?$/iu;
const appVersionPattern = /^\d+\.\d+\.\d+$/u;
const localHostnames = new Set(["127.0.0.1", "localhost"]);
const localEnvironments = new Set<MiniappEnvironment>([
  "LOCAL",
  "MINIAPP_RUNNER",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMiniappEnvironment(value: string): value is MiniappEnvironment {
  return MINIAPP_ENVIRONMENTS.some((environment) => environment === value);
}

function assertClosedObject(value: Record<string, unknown>): void {
  const keys = Object.keys(value).sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new PublicBuildConfigError();
  }
}

function assertApiOrigin(
  apiOrigin: string,
  environment: MiniappEnvironment,
): void {
  if (apiOrigin.length > 200) {
    throw new PublicBuildConfigError();
  }

  const match = originPattern.exec(apiOrigin);
  const scheme = match?.[1];
  const hostname = match?.[2]?.toLowerCase();
  const port = match?.[3];
  if (scheme === undefined || hostname === undefined) {
    throw new PublicBuildConfigError();
  }
  if (port !== undefined && (Number(port) < 1 || Number(port) > 65_535)) {
    throw new PublicBuildConfigError();
  }
  if (scheme === "http") {
    if (!localEnvironments.has(environment) || !localHostnames.has(hostname)) {
      throw new PublicBuildConfigError();
    }
  }
  if (scheme !== "https" && scheme !== "http") {
    throw new PublicBuildConfigError();
  }
}

export function parsePublicBuildConfig(value: unknown): PublicBuildConfig {
  if (!isRecord(value)) {
    throw new PublicBuildConfigError();
  }
  assertClosedObject(value);

  const { apiOrigin, appVersion, environment, schemaVersion } = value;
  if (
    typeof apiOrigin !== "string" ||
    typeof appVersion !== "string" ||
    !appVersionPattern.test(appVersion) ||
    typeof environment !== "string" ||
    typeof schemaVersion !== "string" ||
    schemaVersion !== MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION ||
    !isMiniappEnvironment(environment)
  ) {
    throw new PublicBuildConfigError();
  }

  assertApiOrigin(apiOrigin, environment);
  return Object.freeze({
    apiOrigin,
    appVersion,
    environment,
    schemaVersion,
  });
}
