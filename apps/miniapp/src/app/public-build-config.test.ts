import { describe, expect, it } from "vitest";

import {
  MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
  parsePublicBuildConfig,
  PublicBuildConfigError,
} from "./public-build-config.js";

describe("public build configuration", () => {
  it("accepts the closed LOCAL configuration", () => {
    expect(
      parsePublicBuildConfig({
        apiOrigin: "http://127.0.0.1:3000",
        environment: "LOCAL",
        schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
      }),
    ).toEqual({
      apiOrigin: "http://127.0.0.1:3000",
      environment: "LOCAL",
      schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
    });
  });

  it("requires HTTPS outside local runner environments", () => {
    expect(() =>
      parsePublicBuildConfig({
        apiOrigin: "http://dev.daily-energy.example",
        environment: "DEV",
        schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
      }),
    ).toThrow(PublicBuildConfigError);
  });

  it("rejects unknown environments, credentials, paths, and extra keys", () => {
    const invalidValues = [
      {
        apiOrigin: "https://api.daily-energy.example",
        environment: "TEST",
        schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
      },
      {
        apiOrigin: "https://name:password@api.daily-energy.example",
        environment: "STAGING",
        schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
      },
      {
        apiOrigin: "https://api.daily-energy.example/v1",
        environment: "PRODUCTION",
        schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
      },
      {
        apiOrigin: "https://api.daily-energy.example/",
        environment: "PRODUCTION",
        schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
      },
      {
        apiOrigin: "https://api.daily-energy.example",
        environment: "PRODUCTION",
        extra: true,
        schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
      },
    ];

    for (const value of invalidValues) {
      expect(() => parsePublicBuildConfig(value)).toThrow(
        PublicBuildConfigError,
      );
    }
  });
});
