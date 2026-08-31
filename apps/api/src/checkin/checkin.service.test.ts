import type {
  CheckinStore,
  StoredCheckinView,
} from "@daily-energy/server-adapters/api";
import { describe, expect, it, vi } from "vitest";

import type { SessionPrincipal } from "../auth/contracts.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "../bootstrap/runtime-config.js";
import { ApiException } from "../transport/common/api-exception.js";
import { CheckinService } from "./checkin.service.js";

const principal: SessionPrincipal = {
  accountId: "11111111-1111-4111-8111-111111111111",
  accountState: "ACTIVE",
  expiresAt: new Date("2026-09-20T00:00:00.000Z"),
  sessionId: "22222222-2222-4222-8222-222222222222",
};
const now = new Date("2026-08-20T20:00:00.000Z");
const value: StoredCheckinView = {
  checkinRef: "33333333-3333-4333-8333-333333333333",
  energy: "STEADY",
  mood: "GOOD",
  productDate: "2026-08-21",
  revision: 1,
  sleep: "OKAY",
  updatedAt: now,
};

function config() {
  return loadRuntimeConfig({
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_ENVIRONMENT: "CI",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "c004-service-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

function unavailable(): Promise<never> {
  return Promise.reject(new Error("UNEXPECTED_STORE_CALL"));
}

function fakeStore(overrides: Partial<CheckinStore>): CheckinStore {
  return {
    close: async () => undefined,
    correct: unavailable,
    getToday: unavailable,
    submit: unavailable,
    ...overrides,
  };
}

function service(store: CheckinStore) {
  return new CheckinService(store, { now: () => now }, config());
}

describe("C-004 check-in application service", () => {
  it("derives owner and product date on the server", async () => {
    const submit = vi.fn<CheckinStore["submit"]>(async () => ({
      status: "ACCEPTED",
      value,
    }));
    const result = await service(fakeStore({ submit })).submit(principal, {
      command_ref: "checkin-command-0001",
      energy: "STEADY",
      expected_revision: 0,
      mood: "GOOD",
      sleep: "OKAY",
    });

    expect(result.resolution.productDate).toBe("2026-08-21");
    expect(result.view).toMatchObject({
      product_date: "2026-08-21",
      write_window: "OPEN",
    });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: principal.accountId,
        productDate: "2026-08-21",
        productDatePolicyVersion: "product-date-v1",
      }),
    );
    expect(JSON.stringify(submit.mock.calls[0]?.[0])).not.toContain(
      "product_date",
    );
  });

  it("maps duplicate replay and existing-value conflict without changing values", async () => {
    await expect(
      service(
        fakeStore({ submit: async () => ({ status: "DUPLICATE", value }) }),
      ).submit(principal, {
        command_ref: "checkin-command-0002",
        energy: "STEADY",
        expected_revision: 0,
        mood: "GOOD",
        sleep: "OKAY",
      }),
    ).resolves.toMatchObject({ view: { revision: 1 } });

    await expect(
      service(
        fakeStore({
          submit: async () => ({
            current: value,
            status: "CHECKIN_ALREADY_EXISTS",
          }),
        }),
      ).submit(principal, {
        command_ref: "checkin-command-0003",
        energy: "HIGH",
        expected_revision: 0,
        mood: "LIGHT",
        sleep: "GOOD",
      }),
    ).rejects.toMatchObject({ code: "CHECKIN_ALREADY_EXISTS" });
  });

  it("returns only the current CheckinView for a stale correction", async () => {
    const current = { ...value, revision: 2 };
    let error: unknown;
    try {
      await service(
        fakeStore({
          correct: async () => ({ current, status: "REVISION_CONFLICT" }),
        }),
      ).correct(principal, {
        command_ref: "checkin-correct-0001",
        energy: "HIGH",
        expected_revision: 1,
        mood: "LIGHT",
        sleep: "GOOD",
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: {
        current: { revision: 2 },
        current_revision: 2,
      },
    });
    expect(JSON.stringify(error)).not.toMatch(/account|fingerprint|command/iu);
  });

  it.each([
    "SAFETY_BLOCKED",
    "ACCOUNT_DELETING",
    "CONSENT_REQUIRED",
    "ONBOARDING_REQUIRED",
    "STATE_PRECONDITION_FAILED",
  ] as const)(
    "fails closed for %s before exposing a check-in",
    async (status) => {
      await expect(
        service(fakeStore({ getToday: async () => ({ status }) })).getToday(
          principal,
        ),
      ).rejects.toMatchObject({ code: status });
    },
  );

  it("fails closed when the authoritative clock is unavailable", async () => {
    const checkinService = new CheckinService(
      fakeStore({}),
      { now: () => new Date(Number.NaN) },
      config(),
    );
    await expect(checkinService.getToday(principal)).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
    });
  });
});
