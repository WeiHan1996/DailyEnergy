import { describe, expect, it, vi } from "vitest";

import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C013Api,
  type WeeklyView,
} from "../../services/miniapp-api.js";
import { WeeklyCoordinator } from "./weekly-flow.js";

const dates = [
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
];

const emptyView: WeeklyView = {
  activity: {
    helpfulness: {
      helpful_count: 0,
      neutral_count: 0,
      not_helpful_count: 0,
      not_used_count: 0,
      rated_day_count: 0,
      unrated_day_count: 7,
    },
    lit_day_count: 0,
    tasks: {
      completed_count: 0,
      interested_count: 0,
      skipped_count: 0,
      task_offered_day_count: 0,
      unmarked_count: 0,
    },
  },
  contract: "weekly-summary-view",
  coverage: {
    checkin_day_count: 0,
    evening_feedback_day_count: 0,
    level: "EMPTY",
    lit_day_count: 0,
    missing_dates: dates,
    real_state_day_count: 0,
    window_day_count: 7,
  },
  data_disclosure: "基于 0 天真实状态；7 个日期没有记录，未做推断或补齐。",
  days: dates.map((product_date) => ({
    is_lit: false,
    product_date,
    state: "MISSING" as const,
  })),
  metrics: [
    "MORNING_MOOD",
    "MORNING_ENERGY",
    "MORNING_SLEEP",
    "EVENING_OVERALL",
  ].map((id) => ({
    direction: "INSUFFICIENT_DATA" as const,
    direction_label: "记录还不够形成方向",
    id: id as WeeklyView["metrics"][number]["id"],
    missing_count: 7,
    observed_count: 0,
    unsure_count: 0,
  })),
  projection_version: "weekly-view-v1",
  schema_version: "1.0.0",
  summary_status: "NOT_ELIGIBLE",
  window_end_date: dates[6]!,
  window_id: "weekly-window-example-v1",
  window_start_date: dates[0]!,
};

function storage() {
  const values = new Map<string, StorageValue>();
  const port: StoragePort = {
    get: vi.fn(async (key) => values.get(key)),
    remove: vi.fn(async (key) => {
      values.delete(key);
    }),
    set: vi.fn(async (key, value) => {
      values.set(key, value);
    }),
  };
  return { port, values };
}

function api(overrides: Partial<C013Api> = {}): C013Api {
  return {
    getWeeklyCurrent: async () => ({
      productDate: "2026-08-24",
      weekly: emptyView,
    }),
    getWeeklyWindow: async () => ({
      productDate: "2026-08-24",
      weekly: emptyView,
    }),
    ...overrides,
  };
}

describe("C-013 weekly flow", () => {
  it("caches the strict seven-day view and serves it read-only offline", async () => {
    const state = storage();
    const getWeeklyCurrent = vi
      .fn<C013Api["getWeeklyCurrent"]>()
      .mockResolvedValueOnce({ productDate: "2026-08-24", weekly: emptyView })
      .mockRejectedValueOnce(new MiniappPlatformError("NETWORK_FAILED"));
    const coordinator = new WeeklyCoordinator(
      state.port,
      api({ getWeeklyCurrent }),
      "scope",
      () => 1_000,
    );
    await expect(coordinator.load()).resolves.toMatchObject({
      kind: "weekly",
      offline: false,
      view: emptyView,
    });
    await expect(coordinator.load()).resolves.toMatchObject({
      kind: "weekly",
      offline: true,
      view: emptyView,
    });
  });

  it("uses the requested historical window and never substitutes another cache", async () => {
    const state = storage();
    const getWeeklyWindow = vi
      .fn<C013Api["getWeeklyWindow"]>()
      .mockResolvedValueOnce({ productDate: "2026-08-24", weekly: emptyView });
    const coordinator = new WeeklyCoordinator(
      state.port,
      api({ getWeeklyWindow }),
      "scope",
    );
    await coordinator.load("2026-08-24");
    expect(getWeeklyWindow).toHaveBeenCalledWith("2026-08-24");
    await expect(coordinator.load("2026-08-23")).resolves.toEqual({
      kind: "recovery",
      reasonCode: "WEEKLY_RECOVERY_REQUIRED",
    });
  });

  it("clears cached facts when Safety overlays the ordinary journey", async () => {
    const state = storage();
    const coordinator = new WeeklyCoordinator(
      state.port,
      api({
        getWeeklyCurrent: async () =>
          Promise.reject(
            new MiniappApiError("SAFETY_BLOCKED", 409, false, undefined, {
              blocks: [],
              response_bundle_version: "safety-response-v1",
              revision: 2,
              state: "ACTIVE",
              updated_at: "2026-08-24T12:00:00.000Z",
            }),
          ),
      }),
      "scope",
    );
    await expect(coordinator.load()).resolves.toEqual({
      kind: "safety",
      reasonCode: "SAFETY_BLOCKED",
    });
    expect(coordinator.getSafetyView()?.state).toBe("ACTIVE");
  });
});
