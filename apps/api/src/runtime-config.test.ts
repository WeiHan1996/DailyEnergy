import { describe, expect, it } from "vitest";

import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  calculateRuntimeFingerprints,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
  RuntimeConfigError,
} from "./bootstrap/runtime-config.js";
import { API_CAPABILITY_MANIFEST } from "./composition/api-capability-manifest.js";

const LEGACY_CAPABILITY_FINGERPRINT =
  "6a6e77d776644b31b21596ddc667c7c84ce7918b2e3f810538deeb4b2b59263b";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_DATABASE_URL_FILE: "/run/secrets/api-database-url",
    DAILYENERGY_ENVIRONMENT: "CI",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "synthetic-release-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  };
}

function matchedReleaseEnvironment(
  environmentName: "STAGING" | "PRODUCTION" | "RECOVERY",
): NodeJS.ProcessEnv {
  const environment = {
    ...validEnvironment(),
    DAILYENERGY_ENVIRONMENT: environmentName,
    DAILYENERGY_LOG_LEVEL: "INFO",
    DAILYENERGY_PORT: "3000",
  };
  const fingerprints = calculateRuntimeFingerprints(environment);

  return {
    ...environment,
    DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED:
      fingerprints.capabilityFingerprint,
    DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED:
      fingerprints.deployConfigFingerprint,
  };
}

describe("RuntimeConfig", () => {
  it("loads a closed synthetic API configuration and creates fingerprints", () => {
    const config = loadRuntimeConfig(validEnvironment());

    expect(config.runtimeProfile).toBe("API");
    expect(config.deployConfigFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(config.capabilityFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("includes only the database secret path in the deploy fingerprint", () => {
    const first = calculateRuntimeFingerprints(validEnvironment());
    const second = calculateRuntimeFingerprints({
      ...validEnvironment(),
      DAILYENERGY_DATABASE_URL_FILE: "/run/secrets/api-database-url-v2",
    });

    expect(first.deployConfigFingerprint).not.toBe(
      second.deployConfigFingerprint,
    );
  });

  it("binds the Safety continuation maintenance allowlist into the API capability manifest", () => {
    expect(API_CAPABILITY_MANIFEST.capabilities).toContain(
      "SAFETY_CONTINUATION_MAINTENANCE_ALLOWLIST",
    );
    expect(
      API_CAPABILITY_MANIFEST.privileged_route_allowlists
        .safety_continuation_maintenance,
    ).toContain("GET /v1/bootstrap/launch");
  });

  it("fails closed when a required field is missing", () => {
    const environment = validEnvironment();
    delete environment.DAILYENERGY_RELEASE_ID;

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("RUNTIME_CONFIG_INVALID"),
    );
  });

  it("fails closed for an unknown project configuration field", () => {
    const environment = {
      ...validEnvironment(),
      DAILYENERGY_UNREVIEWED_SWITCH: "enabled",
    };

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("RUNTIME_CONFIG_INVALID"),
    );
  });

  it("rejects a deploy fingerprint mismatch without exposing values", () => {
    const environment = {
      ...validEnvironment(),
      DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED: "0".repeat(64),
    };

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("DEPLOY_CONFIG_FINGERPRINT_MISMATCH"),
    );
  });

  it("rejects a capability fingerprint mismatch without exposing values", () => {
    const environment = {
      ...validEnvironment(),
      DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED: "0".repeat(64),
    };

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("CAPABILITY_FINGERPRINT_MISMATCH"),
    );
  });

  it.each(["TEST", "DEVELOPMENT"])(
    "rejects the unaccepted environment alias %s",
    (environmentName) => {
      const environment = {
        ...validEnvironment(),
        DAILYENERGY_ENVIRONMENT: environmentName,
      };

      expect(() => loadRuntimeConfig(environment)).toThrowError(
        new RuntimeConfigError("RUNTIME_CONFIG_INVALID"),
      );
    },
  );

  it.each(["STAGING", "PRODUCTION", "RECOVERY"])(
    "requires expected deploy and capability fingerprints in %s",
    (environmentName) => {
      const environment = {
        ...validEnvironment(),
        DAILYENERGY_ENVIRONMENT: environmentName,
        DAILYENERGY_LOG_LEVEL: "INFO",
        DAILYENERGY_PORT: "3000",
      };

      expect(() => loadRuntimeConfig(environment)).toThrowError(
        new RuntimeConfigError("RUNTIME_CONFIG_INVALID"),
      );
    },
  );

  it.each(["STAGING", "PRODUCTION", "RECOVERY"] as const)(
    "loads %s when expected fingerprints come from the shared calculator",
    (environmentName) => {
      expect(
        loadRuntimeConfig(matchedReleaseEnvironment(environmentName))
          .environment,
      ).toBe(environmentName);
    },
  );

  it("rejects the legacy capability fingerprint that omitted the Safety allowlist", () => {
    const environment = {
      ...matchedReleaseEnvironment("STAGING"),
      DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED:
        LEGACY_CAPABILITY_FINGERPRINT,
    };

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("CAPABILITY_FINGERPRINT_MISMATCH"),
    );
  });

  it("rejects STAGING when only the expected deploy fingerprint is missing", () => {
    const environment = {
      ...validEnvironment(),
      DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED: "0".repeat(64),
      DAILYENERGY_ENVIRONMENT: "STAGING",
      DAILYENERGY_LOG_LEVEL: "INFO",
      DAILYENERGY_PORT: "3000",
    };

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("RUNTIME_CONFIG_INVALID"),
    );
  });

  it("rejects PRODUCTION when only the expected capability fingerprint is missing", () => {
    const environment = {
      ...validEnvironment(),
      DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED: "0".repeat(64),
      DAILYENERGY_ENVIRONMENT: "PRODUCTION",
      DAILYENERGY_LOG_LEVEL: "INFO",
      DAILYENERGY_PORT: "3000",
    };

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("RUNTIME_CONFIG_INVALID"),
    );
  });

  it("forbids debug logging in production", () => {
    const environment = {
      ...validEnvironment(),
      DAILYENERGY_CAPABILITY_FINGERPRINT_EXPECTED: "0".repeat(64),
      DAILYENERGY_DEPLOY_CONFIG_FINGERPRINT_EXPECTED: "0".repeat(64),
      DAILYENERGY_ENVIRONMENT: "PRODUCTION",
      DAILYENERGY_PORT: "3000",
    };

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("RUNTIME_CONFIG_INVALID"),
    );
  });
});
