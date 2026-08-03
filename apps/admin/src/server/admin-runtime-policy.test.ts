import { describe, expect, it } from "vitest";

import {
  adminSessionCookiePolicy,
  evaluateAdminRuntime,
  type AdminRuntimeEnvironment,
} from "./admin-runtime-policy";

const completeProductionEnvironment = {
  ADMIN_API_ORIGIN: "https://admin-api.dailyenergy.example",
  ADMIN_IDENTITY_CLIENT_SECRET_FILE:
    "/run/secrets/admin-identity-client-secret",
  ADMIN_PRODUCTION_ENABLED: "true",
  ADMIN_RUNTIME_PROFILE: "production",
  ADMIN_SESSION_COOKIE_NAME: "__Host-daily-energy-admin",
  ADMIN_SESSION_SECRET_FILE: "/run/secrets/admin-session-secret",
  ADMIN_TRUSTED_IDENTITY_AUDIENCE: "daily-energy-admin",
  ADMIN_TRUSTED_IDENTITY_ISSUER: "https://identity.dailyenergy.example/oidc",
} satisfies AdminRuntimeEnvironment;

describe("Admin production availability Gate", () => {
  it("fails closed when trusted identity configuration is missing", () => {
    const runtime = evaluateAdminRuntime({
      ADMIN_API_ORIGIN: "https://admin-api.dailyenergy.example",
      ADMIN_PRODUCTION_ENABLED: "true",
      ADMIN_RUNTIME_PROFILE: "production",
    });

    expect(runtime.availability).toEqual({
      reason: "TRUSTED_IDENTITY_NOT_CONFIGURED",
      status: "disabled",
    });
  });

  it("keeps production disabled when the production switch is off", () => {
    const runtime = evaluateAdminRuntime({
      ...completeProductionEnvironment,
      ADMIN_PRODUCTION_ENABLED: "false",
    });

    expect(runtime.availability).toEqual({
      reason: "PRODUCTION_DISABLED",
      status: "disabled",
    });
  });

  it("fails closed until a real trusted identity adapter is registered", () => {
    const runtime = evaluateAdminRuntime(completeProductionEnvironment);

    expect(runtime.availability).toEqual({
      reason: "TRUSTED_IDENTITY_ADAPTER_UNAVAILABLE",
      status: "disabled",
    });
  });

  it("can become ready only with complete configuration and a registered adapter", () => {
    const runtime = evaluateAdminRuntime(completeProductionEnvironment, {
      trustedIdentityAdapterAvailable: true,
    });

    expect(runtime.availability).toEqual({
      mode: "trusted-identity",
      status: "ready",
    });
    expect(runtime.apiOrigin).toBe("https://admin-api.dailyenergy.example");
  });

  it("rejects a test preview outside the Playwright boundary", () => {
    const runtime = evaluateAdminRuntime({
      ADMIN_API_ORIGIN: "http://127.0.0.1:4310",
      ADMIN_RUNTIME_PROFILE: "test",
      ADMIN_SHELL_PREVIEW: "true",
    });

    expect(runtime.availability).toEqual({
      reason: "TEST_PROFILE_NOT_AUTHORIZED",
      status: "disabled",
    });
  });

  it("allows the internal Compose API only with the explicit non-production flag", () => {
    const runtime = evaluateAdminRuntime({
      ADMIN_API_ORIGIN: "http://api:3000",
      ADMIN_COMPOSE_INTERNAL_API: "true",
      ADMIN_RUNTIME_PROFILE: "development",
      ADMIN_SHELL_PREVIEW: "true",
    });

    expect(runtime.apiOrigin).toBe("http://api:3000");
    expect(runtime.availability).toEqual({
      mode: "shell-preview",
      status: "ready",
    });
  });

  it.each([
    { ADMIN_RUNTIME_PROFILE: "development" },
    {
      ADMIN_COMPOSE_INTERNAL_API: "true",
      ADMIN_PRODUCTION_ENABLED: "true",
      ADMIN_RUNTIME_PROFILE: "production",
    },
  ])("rejects an unapproved internal Compose API origin", (environment) => {
    const runtime = evaluateAdminRuntime({
      ADMIN_API_ORIGIN: "http://api:3000",
      ADMIN_SHELL_PREVIEW: "true",
      ...environment,
    });

    expect(runtime.apiOrigin).toBeUndefined();
    expect(runtime.availability).toEqual({
      reason: "ADMIN_API_ORIGIN_INVALID",
      status: "disabled",
    });
  });

  it("fixes the production session cookie policy", () => {
    expect(adminSessionCookiePolicy).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: true,
    });
  });
});
