export const adminSessionCookiePolicy = {
  httpOnly: true,
  path: "/",
  sameSite: "strict",
  secure: true,
} as const;

export type AdminRuntimeProfile = "development" | "production" | "test";

export type AdminDisabledReason =
  | "ADMIN_API_ORIGIN_INVALID"
  | "PREVIEW_DISABLED"
  | "PRODUCTION_DISABLED"
  | "RUNTIME_PROFILE_INVALID"
  | "TEST_PROFILE_NOT_AUTHORIZED"
  | "TRUSTED_IDENTITY_ADAPTER_UNAVAILABLE"
  | "TRUSTED_IDENTITY_NOT_CONFIGURED";

export type AdminRuntimeAvailability =
  | {
      readonly status: "disabled";
      readonly reason: AdminDisabledReason;
    }
  | {
      readonly status: "ready";
      readonly mode: "shell-preview" | "trusted-identity";
    };

export interface AdminRuntimeEnvironment {
  readonly [key: string]: string | undefined;
}

export interface AdminRuntimeConfig {
  readonly apiOrigin?: string;
  readonly availability: AdminRuntimeAvailability;
  readonly identity: {
    readonly audience?: string;
    readonly clientSecretFile?: string;
    readonly issuer?: string;
  };
  readonly productionEnabled: boolean;
  readonly profile: AdminRuntimeProfile;
  readonly session: {
    readonly cookieName: string;
    readonly secretFile?: string;
  };
}

export interface AdminRuntimeCapabilities {
  readonly trustedIdentityAdapterAvailable?: boolean;
}

const runtimeProfiles = new Set<AdminRuntimeProfile>([
  "development",
  "production",
  "test",
]);

function parseProfile(
  environment: AdminRuntimeEnvironment,
): AdminRuntimeProfile | undefined {
  const configured = environment.ADMIN_RUNTIME_PROFILE;
  if (configured !== undefined) {
    return runtimeProfiles.has(configured as AdminRuntimeProfile)
      ? (configured as AdminRuntimeProfile)
      : undefined;
  }
  return environment.NODE_ENV === "production" ? "production" : "development";
}

function parseOrigin(
  value: string | undefined,
  profile: AdminRuntimeProfile,
  composeInternalApi: boolean,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const isComposeApi =
      composeInternalApi && profile !== "production" && url.hostname === "api";
    const protocolAllowed =
      url.protocol === "https:" ||
      (profile !== "production" &&
        url.protocol === "http:" &&
        (isLoopback || isComposeApi));
    if (
      !protocolAllowed ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function isTrustedHttpsIssuer(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function isSecretFile(value: string | undefined): boolean {
  return (
    value !== undefined &&
    value.startsWith("/run/secrets/") &&
    !value.includes("..")
  );
}

function hasTrustedIdentityConfiguration(
  environment: AdminRuntimeEnvironment,
): boolean {
  return (
    isTrustedHttpsIssuer(environment.ADMIN_TRUSTED_IDENTITY_ISSUER) &&
    (environment.ADMIN_TRUSTED_IDENTITY_AUDIENCE?.trim().length ?? 0) > 0 &&
    isSecretFile(environment.ADMIN_IDENTITY_CLIENT_SECRET_FILE) &&
    isSecretFile(environment.ADMIN_SESSION_SECRET_FILE) &&
    (environment.ADMIN_SESSION_COOKIE_NAME?.startsWith("__Host-") ?? false)
  );
}

export function evaluateAdminRuntime(
  environment: AdminRuntimeEnvironment,
  capabilities: AdminRuntimeCapabilities = {},
): AdminRuntimeConfig {
  const profile = parseProfile(environment);
  const cookieName =
    environment.ADMIN_SESSION_COOKIE_NAME ?? "__Host-daily-energy-admin";
  const sharedConfig = {
    identity: {
      ...(environment.ADMIN_TRUSTED_IDENTITY_AUDIENCE === undefined
        ? {}
        : { audience: environment.ADMIN_TRUSTED_IDENTITY_AUDIENCE }),
      ...(environment.ADMIN_IDENTITY_CLIENT_SECRET_FILE === undefined
        ? {}
        : {
            clientSecretFile: environment.ADMIN_IDENTITY_CLIENT_SECRET_FILE,
          }),
      ...(environment.ADMIN_TRUSTED_IDENTITY_ISSUER === undefined
        ? {}
        : { issuer: environment.ADMIN_TRUSTED_IDENTITY_ISSUER }),
    },
    productionEnabled: environment.ADMIN_PRODUCTION_ENABLED === "true",
    session: {
      cookieName,
      ...(environment.ADMIN_SESSION_SECRET_FILE === undefined
        ? {}
        : { secretFile: environment.ADMIN_SESSION_SECRET_FILE }),
    },
  } as const;

  if (profile === undefined) {
    return {
      ...sharedConfig,
      availability: {
        reason: "RUNTIME_PROFILE_INVALID",
        status: "disabled",
      },
      profile: "production",
    };
  }

  const apiOrigin = parseOrigin(
    environment.ADMIN_API_ORIGIN,
    profile,
    environment.ADMIN_COMPOSE_INTERNAL_API === "true",
  );
  const config = {
    ...sharedConfig,
    ...(apiOrigin === undefined ? {} : { apiOrigin }),
    profile,
  } as const;

  if (profile === "production") {
    if (!config.productionEnabled) {
      return {
        ...config,
        availability: {
          reason: "PRODUCTION_DISABLED",
          status: "disabled",
        },
      };
    }
    if (apiOrigin === undefined) {
      return {
        ...config,
        availability: {
          reason: "ADMIN_API_ORIGIN_INVALID",
          status: "disabled",
        },
      };
    }
    if (!hasTrustedIdentityConfiguration(environment)) {
      return {
        ...config,
        availability: {
          reason: "TRUSTED_IDENTITY_NOT_CONFIGURED",
          status: "disabled",
        },
      };
    }
    if (capabilities.trustedIdentityAdapterAvailable !== true) {
      return {
        ...config,
        availability: {
          reason: "TRUSTED_IDENTITY_ADAPTER_UNAVAILABLE",
          status: "disabled",
        },
      };
    }
    return {
      ...config,
      availability: {
        mode: "trusted-identity",
        status: "ready",
      },
    };
  }

  if (profile === "test" && environment.PLAYWRIGHT_TEST !== "1") {
    return {
      ...config,
      availability: {
        reason: "TEST_PROFILE_NOT_AUTHORIZED",
        status: "disabled",
      },
    };
  }

  if (environment.ADMIN_SHELL_PREVIEW !== "true" || apiOrigin === undefined) {
    return {
      ...config,
      availability: {
        reason:
          apiOrigin === undefined
            ? "ADMIN_API_ORIGIN_INVALID"
            : "PREVIEW_DISABLED",
        status: "disabled",
      },
    };
  }

  return {
    ...config,
    availability: {
      mode: "shell-preview",
      status: "ready",
    },
  };
}
