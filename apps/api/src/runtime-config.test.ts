import { describe, expect, it } from "vitest";

import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
  RuntimeConfigError,
} from "./bootstrap/runtime-config.js";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_ENVIRONMENT: "TEST",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "synthetic-release-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  };
}

describe("RuntimeConfig", () => {
  it("loads a closed synthetic API configuration and creates fingerprints", () => {
    const config = loadRuntimeConfig(validEnvironment());

    expect(config.runtimeProfile).toBe("API");
    expect(config.deployConfigFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(config.capabilityFingerprint).toMatch(/^[a-f0-9]{64}$/u);
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

  it("forbids debug logging in production", () => {
    const environment = {
      ...validEnvironment(),
      DAILYENERGY_ENVIRONMENT: "PRODUCTION",
      DAILYENERGY_PORT: "3000",
    };

    expect(() => loadRuntimeConfig(environment)).toThrowError(
      new RuntimeConfigError("RUNTIME_CONFIG_INVALID"),
    );
  });
});
