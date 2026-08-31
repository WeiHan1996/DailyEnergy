import type { DailyInteractionStore } from "@daily-energy/server-adapters/api";
import type { DailyInteractionState } from "@daily-energy/shared-schemas";
import { describe, expect, it, vi } from "vitest";

import type { SessionPrincipal } from "../auth/contracts.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "../bootstrap/runtime-config.js";
import { ApiException } from "../transport/common/api-exception.js";
import { DailyInteractionService } from "./daily-interaction.service.js";

const now = new Date("2026-08-24T02:00:00.000Z");
const principal: SessionPrincipal = {
  accountId: "11111111-1111-4111-8111-111111111111",
  accountState: "ACTIVE",
  expiresAt: new Date("2026-09-24T02:00:00.000Z"),
  sessionId: "22222222-2222-4222-8222-222222222222",
};
const interaction: DailyInteractionState = {
  contract: "daily-interaction-state",
  schema_version: "1.0.0",
  result_id: "33333333-3333-4333-8333-333333333333",
  product_date: "2026-08-24",
  is_lit: false,
  task: {
    task_id: "task.close-one-distraction.v1",
    revision: 2,
    status: "INTERESTED",
  },
  helpfulness: { rating: "UNRATED", revision: 0 },
  updated_at: now.toISOString(),
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
    DAILYENERGY_RELEASE_ID: "c010-service-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

function unavailable(): Promise<never> {
  return Promise.reject(new Error("UNEXPECTED_STORE_CALL"));
}

function fakeStore(
  overrides: Partial<DailyInteractionStore>,
): DailyInteractionStore {
  return {
    close: async () => undefined,
    get: unavailable,
    openToday: async () => ({ status: "RECORDED" }),
    updateTask: unavailable,
    ...overrides,
  };
}

function service(store: DailyInteractionStore) {
  return new DailyInteractionService(store, { now: () => now }, config());
}

describe("C-010 daily interaction application service", () => {
  it("binds owner/session and the explicit original product date", async () => {
    const updateTask = vi.fn<DailyInteractionStore["updateTask"]>(async () => ({
      status: "ACCEPTED",
      value: interaction,
    }));
    await expect(
      service(fakeStore({ updateTask })).updateTask(principal, {
        command_ref: "task-command-0001",
        expected_revision: 1,
        product_date: "2026-08-24",
        status: "INTERESTED",
        task_ref: "task.close-one-distraction.v1",
      }),
    ).resolves.toMatchObject({ view: interaction });
    expect(updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: principal.accountId,
        productDate: "2026-08-24",
        sessionId: principal.sessionId,
        taskRef: "task.close-one-distraction.v1",
      }),
    );
  });

  it("returns the latest closed view on CAS conflict", async () => {
    let error: unknown;
    try {
      await service(
        fakeStore({
          updateTask: async () => ({
            current: interaction,
            status: "REVISION_CONFLICT",
          }),
        }),
      ).updateTask(principal, {
        command_ref: "task-command-0002",
        expected_revision: 1,
        product_date: "2026-08-24",
        status: "COMPLETED",
        task_ref: "task.close-one-distraction.v1",
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: { current: interaction, current_revision: 2 },
    });
  });

  it.each([
    "SAFETY_BLOCKED",
    "STATE_PRECONDITION_FAILED",
    "VIEW_CONTINUATION_EXPIRED",
    "WRITE_WINDOW_CLOSED",
  ] as const)("maps %s without changing the target date", async (status) => {
    await expect(
      service(fakeStore({ updateTask: async () => ({ status }) })).updateTask(
        principal,
        {
          command_ref: `task-command-${status}`,
          expected_revision: 1,
          product_date: "2026-08-23",
          status: "SKIPPED",
          task_ref: "task.close-one-distraction.v1",
        },
      ),
    ).rejects.toMatchObject({ code: status });
  });

  it("normalizes adapter failures without leaking SQL details", async () => {
    await expect(
      service(
        fakeStore({
          get: async () => {
            throw new Error("synthetic SQL task detail");
          },
        }),
      ).getToday(principal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
  });
});
