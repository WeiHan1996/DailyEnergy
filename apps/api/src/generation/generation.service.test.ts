import type { DailyGenerationStore } from "@daily-energy/server-adapters/api";
import type { CheckinView } from "@daily-energy/shared-schemas";
import type { HistoryDayView } from "@daily-energy/shared-schemas";
import { describe, expect, it, vi } from "vitest";

import type { SessionPrincipal } from "../auth/contracts.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "../bootstrap/runtime-config.js";
import { ApiException } from "../transport/common/api-exception.js";
import { GenerationService } from "./generation.service.js";

const principal: SessionPrincipal = {
  accountId: "11111111-1111-4111-8111-111111111111",
  accountState: "ACTIVE",
  expiresAt: new Date("2026-09-24T00:00:00.000Z"),
  sessionId: "22222222-2222-4222-8222-222222222222",
};
const now = new Date("2026-08-24T02:00:00.000Z");
const intent = {
  intent_ref: "33333333-3333-4333-8333-333333333333",
  product_date: "2026-08-24",
  status: "QUEUED" as const,
  retry_after_seconds: 2,
  updated_at: now.toISOString(),
};
const currentCheckin: CheckinView = {
  checkin_ref: "44444444-4444-4444-8444-444444444444",
  energy: "STEADY",
  mood: "GOOD",
  product_date: "2026-08-24",
  revision: 2,
  sleep: "OKAY",
  updated_at: now.toISOString(),
  write_window: "OPEN",
};
const history: HistoryDayView = {
  product_date: "2026-08-23",
  checkin: {
    ...currentCheckin,
    product_date: "2026-08-23",
    write_window: "CLOSED",
  },
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
    DAILYENERGY_RELEASE_ID: "c008-service-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

function unavailable(): Promise<never> {
  return Promise.reject(new Error("UNEXPECTED_STORE_CALL"));
}

function fakeStore(
  overrides: Partial<DailyGenerationStore>,
): DailyGenerationStore {
  return {
    close: async () => undefined,
    getByDate: unavailable,
    getIntent: unavailable,
    getToday: unavailable,
    start: unavailable,
    ...overrides,
  };
}

function service(store: DailyGenerationStore) {
  return new GenerationService(store, { now: () => now }, config());
}

describe("C-008 generation application service", () => {
  it("derives owner and product date and returns the unique intent", async () => {
    const start = vi.fn<DailyGenerationStore["start"]>(async () => ({
      status: "ACCEPTED",
      value: intent,
    }));

    await expect(
      service(fakeStore({ start })).start(principal, {
        command_ref: "generation-command-0001",
        expected_checkin_revision: 1,
      }),
    ).resolves.toMatchObject({
      resolution: { productDate: "2026-08-24" },
      view: { intent_ref: intent.intent_ref, status: "QUEUED" },
    });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: principal.accountId,
        expectedCheckinRevision: 1,
        productDate: "2026-08-24",
        productDatePolicyVersion: "product-date-v1",
      }),
    );
    expect(JSON.stringify(start.mock.calls[0]?.[0])).not.toContain("owner_ref");
  });

  it("returns the latest CheckinView for a stale start revision", async () => {
    let error: unknown;
    try {
      await service(
        fakeStore({
          start: async () => ({
            currentCheckin,
            status: "REVISION_CONFLICT",
          }),
        }),
      ).start(principal, {
        command_ref: "generation-command-0002",
        expected_checkin_revision: 1,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: {
        current: currentCheckin,
        current_revision: 2,
      },
    });
  });

  it.each([
    ["GENERATION_PENDING", true],
    ["GENERATION_FAILED_RETRYABLE", true],
    ["GENERATION_FAILED_TERMINAL", false],
  ] as const)(
    "maps today status %s without creating a second intent",
    async (status, retryable) => {
      await expect(
        service(fakeStore({ getToday: async () => ({ status }) })).getToday(
          principal,
        ),
      ).rejects.toMatchObject({ code: status, retryable });
    },
  );

  it("keeps another owner's intent indistinguishable from missing", async () => {
    await expect(
      service(
        fakeStore({ getIntent: async () => ({ status: "NOT_FOUND" }) }),
      ).getIntent(principal, intent.intent_ref),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("reads only a past owner-scoped HistoryDayView", async () => {
    const getByDate = vi.fn<DailyGenerationStore["getByDate"]>(async () => ({
      status: "FOUND",
      value: history,
    }));
    await expect(
      service(fakeStore({ getByDate })).getByDate(principal, "2026-08-23"),
    ).resolves.toMatchObject({ view: history });
    expect(getByDate).toHaveBeenCalledWith({
      accountId: principal.accountId,
      productDate: "2026-08-23",
    });
    await expect(
      service(fakeStore({ getByDate })).getByDate(principal, "2026-08-24"),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(getByDate).toHaveBeenCalledOnce();
  });

  it("normalizes store failures without leaking database details", async () => {
    let error: unknown;
    try {
      await service(
        fakeStore({
          getToday: async () => {
            throw new Error("synthetic SQL detail");
          },
        }),
      ).getToday(principal);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    expect(JSON.stringify(error)).not.toMatch(/synthetic|sql/iu);
  });
});
