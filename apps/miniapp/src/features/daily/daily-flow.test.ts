import { describe, expect, it, vi } from "vitest";

import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C004Api,
  type C009Api,
  type C010Api,
  type SafetyView,
} from "../../services/miniapp-api.js";
import { DailyViewCache } from "./daily-cache.js";
import { DailyCoordinator } from "./daily-flow.js";
import { historyFixture, todayFixture } from "./daily-fixture.test.js";

function storage() {
  const values = new Map<string, StorageValue>();
  const port: StoragePort = {
    get: async (key) => values.get(key),
    remove: async (key) => {
      values.delete(key);
    },
    set: async (key, value) => {
      values.set(key, JSON.parse(JSON.stringify(value)) as StorageValue);
    },
  };
  return { port, values };
}

function unavailable(): Promise<never> {
  return Promise.reject(new Error("UNEXPECTED_API_CALL"));
}

function fakeApi(
  overrides: Partial<C004Api & C009Api & C010Api>,
): C004Api & C009Api & C010Api {
  return {
    correctCheckin: unavailable,
    getTodayCheckin: unavailable,
    submitCheckin: unavailable,
    getGeneration: unavailable,
    getHistoryDay: unavailable,
    getToday: unavailable,
    getInteraction: unavailable,
    startGeneration: unavailable,
    updateTask: unavailable,
    ...overrides,
  };
}

const queuedIntent = {
  intent_ref: "33333333-3333-4333-8333-333333333333",
  product_date: "2026-08-24",
  retry_after_seconds: 2,
  status: "QUEUED" as const,
  updated_at: "2026-08-24T02:00:00.000Z",
};

describe("C-009 daily coordinator", () => {
  it("returns and caches the same authoritative Today view", async () => {
    const state = storage();
    const coordinator = new DailyCoordinator(
      state.port,
      fakeApi({
        getToday: async () => ({
          productDate: "2026-08-24",
          today: todayFixture,
        }),
      }),
      "scope",
    );

    await expect(coordinator.loadToday()).resolves.toEqual({
      kind: "today",
      offline: false,
      productDate: "2026-08-24",
      view: todayFixture,
    });
    await expect(
      new DailyViewCache(state.port, "scope").loadToday(),
    ).resolves.toEqual(todayFixture);
  });

  it("persists one command across an unknown start outcome and resumes it", async () => {
    const state = storage();
    const startGeneration = vi
      .fn<C009Api["startGeneration"]>()
      .mockRejectedValueOnce(new MiniappPlatformError("NETWORK_FAILED"))
      .mockResolvedValue({
        intent: queuedIntent,
        productDate: "2026-08-24",
      });
    const coordinator = new DailyCoordinator(
      state.port,
      fakeApi({
        getToday: async () => {
          throw new MiniappApiError(
            "RESOURCE_NOT_FOUND",
            404,
            false,
            undefined,
            undefined,
            "2026-08-24",
          );
        },
        getTodayCheckin: async () => ({
          checkin: {
            checkin_ref: "55555555-5555-4555-8555-555555555555",
            energy: "STEADY",
            mood: "GOOD",
            product_date: "2026-08-24",
            revision: 1,
            sleep: "OKAY",
            updated_at: "2026-08-24T02:00:00.000Z",
            write_window: "OPEN",
          },
          productDate: "2026-08-24",
        }),
        startGeneration,
      }),
      "scope",
      () => 1_000,
      () => "generation-command-one",
    );

    await expect(coordinator.beginGeneration()).resolves.toMatchObject({
      kind: "offline",
    });
    await expect(coordinator.beginGeneration()).resolves.toMatchObject({
      intent: queuedIntent,
      kind: "waiting",
    });
    expect(startGeneration).toHaveBeenCalledTimes(2);
    expect(startGeneration.mock.calls[0]?.[0]).toEqual(
      startGeneration.mock.calls[1]?.[0],
    );
  });

  it("polls one intent and converges to Today without another start", async () => {
    const state = storage();
    let todayReads = 0;
    const getToday = vi.fn<C009Api["getToday"]>(async () => {
      todayReads += 1;
      if (todayReads < 3) {
        throw new MiniappApiError(
          "GENERATION_PENDING",
          503,
          true,
          undefined,
          undefined,
          "2026-08-24",
          2,
        );
      }
      return { productDate: "2026-08-24", today: todayFixture };
    });
    const startGeneration = vi.fn<C009Api["startGeneration"]>(async () => ({
      intent: queuedIntent,
      productDate: "2026-08-24",
    }));
    const { retry_after_seconds: _retryAfter, ...succeededIntent } =
      queuedIntent;
    const coordinator = new DailyCoordinator(
      state.port,
      fakeApi({
        getGeneration: async () => ({
          intent: {
            ...succeededIntent,
            result_ref: todayFixture.content.result_id,
            status: "SUCCEEDED",
          },
          productDate: "2026-08-24",
        }),
        getToday,
        getTodayCheckin: async () => ({
          checkin: {
            checkin_ref: "55555555-5555-4555-8555-555555555555",
            energy: "STEADY",
            mood: "GOOD",
            product_date: "2026-08-24",
            revision: 1,
            sleep: "OKAY",
            updated_at: "2026-08-24T02:00:00.000Z",
            write_window: "OPEN",
          },
          productDate: "2026-08-24",
        }),
        startGeneration,
      }),
      "scope",
      () => 1_000,
      () => "generation-command-one",
    );

    await expect(coordinator.beginGeneration()).resolves.toMatchObject({
      kind: "waiting",
    });
    await expect(coordinator.refreshGeneration()).resolves.toMatchObject({
      kind: "today",
      view: todayFixture,
    });
    expect(startGeneration).toHaveBeenCalledOnce();
  });

  it("uses a validated cache only for network failure and clears it on Safety", async () => {
    const state = storage();
    const cache = new DailyViewCache(state.port, "scope");
    await cache.saveToday(todayFixture);
    const safetyView: SafetyView = {
      blocks: [
        {
          block_id: "direct-v1",
          copy: "请先联系现实帮助。",
          kind: "DIRECT_ACKNOWLEDGEMENT",
          resources: [],
        },
      ],
      response_bundle_version: "response-v1",
      revision: 1,
      state: "ACTIVE",
      updated_at: "2026-08-24T02:00:00.000Z",
    };
    const offline = new DailyCoordinator(
      state.port,
      fakeApi({
        getToday: async () => {
          throw new MiniappPlatformError("NETWORK_FAILED");
        },
      }),
      "scope",
    );
    await expect(offline.loadToday()).resolves.toMatchObject({
      kind: "today",
      offline: true,
    });

    const safety = new DailyCoordinator(
      state.port,
      fakeApi({
        getToday: async () => {
          throw new MiniappApiError(
            "SAFETY_BLOCKED",
            409,
            false,
            undefined,
            safetyView,
          );
        },
      }),
      "scope",
    );
    await expect(safety.loadToday()).resolves.toMatchObject({
      kind: "safety",
    });
    await expect(cache.loadToday()).resolves.toBeUndefined();
  });

  it("reads, caches and removes a historical day on authoritative missing", async () => {
    const state = storage();
    let missing = false;
    const coordinator = new DailyCoordinator(
      state.port,
      fakeApi({
        getHistoryDay: async () => {
          if (missing) {
            throw new MiniappApiError(
              "RESOURCE_NOT_FOUND",
              404,
              false,
              undefined,
              undefined,
              "2026-08-24",
            );
          }
          return { history: historyFixture, productDate: "2026-08-24" };
        },
      }),
      "scope",
    );
    await expect(coordinator.loadHistory("2026-08-23")).resolves.toMatchObject({
      kind: "history",
      offline: false,
    });
    missing = true;
    await expect(coordinator.loadHistory("2026-08-23")).resolves.toEqual({
      kind: "missing",
      productDate: "2026-08-23",
    });
    await expect(
      new DailyViewCache(state.port, "scope").loadHistory("2026-08-23"),
    ).resolves.toBeUndefined();
  });

  it("updates one optional task and keeps it separate from lighting", async () => {
    const state = storage();
    const interested = {
      ...todayFixture.interaction,
      task: {
        ...todayFixture.interaction.task,
        revision: 2,
        status: "INTERESTED" as const,
      },
    };
    const updateTask = vi.fn<C010Api["updateTask"]>(async () => ({
      interaction: interested,
      productDate: "2026-08-24",
    }));
    const coordinator = new DailyCoordinator(
      state.port,
      fakeApi({
        getToday: async () => ({
          productDate: "2026-08-24",
          today: todayFixture,
        }),
        updateTask,
      }),
      "scope",
      () => 1_000,
      () => "task-command-one",
    );
    await coordinator.loadToday();
    await expect(
      coordinator.updateTask({
        expectedRevision: 1,
        productDate: "2026-08-24",
        status: "INTERESTED",
        taskRef: todayFixture.interaction.task.task_id,
      }),
    ).resolves.toMatchObject({
      kind: "today",
      noticeCode: "TASK_UPDATED",
      view: {
        interaction: { is_lit: false, task: { status: "INTERESTED" } },
      },
    });
    expect(updateTask).toHaveBeenCalledWith({
      commandRef: "task-command-one",
      expectedRevision: 1,
      productDate: "2026-08-24",
      status: "INTERESTED",
      taskRef: todayFixture.interaction.task.task_id,
    });
  });

  it("persists and retries the same task command after an unknown outcome", async () => {
    const state = storage();
    const completed = {
      ...todayFixture.interaction,
      task: {
        ...todayFixture.interaction.task,
        revision: 2,
        status: "COMPLETED" as const,
      },
    };
    const updateTask = vi
      .fn<C010Api["updateTask"]>()
      .mockRejectedValueOnce(new MiniappPlatformError("NETWORK_FAILED"))
      .mockResolvedValue({
        interaction: completed,
        productDate: "2026-08-24",
      });
    const coordinator = new DailyCoordinator(
      state.port,
      fakeApi({
        getToday: async () => ({
          productDate: "2026-08-24",
          today: todayFixture,
        }),
        updateTask,
      }),
      "scope",
      () => 1_000,
      () => "task-command-unknown",
    );
    await coordinator.loadToday();
    await expect(
      coordinator.updateTask({
        expectedRevision: 1,
        productDate: "2026-08-24",
        status: "COMPLETED",
        taskRef: todayFixture.interaction.task.task_id,
      }),
    ).resolves.toMatchObject({
      kind: "today",
      noticeCode: "TASK_OUTCOME_PENDING",
      offline: true,
    });
    await expect(coordinator.retryTask()).resolves.toMatchObject({
      kind: "today",
      noticeCode: "TASK_UPDATED",
      view: { interaction: { task: { status: "COMPLETED" } } },
    });
    expect(updateTask).toHaveBeenCalledTimes(2);
    expect(updateTask.mock.calls[0]?.[0]).toEqual(
      updateTask.mock.calls[1]?.[0],
    );
  });

  it("reconciles CAS conflicts and closes an expired old-day task", async () => {
    const state = storage();
    const conflict = {
      ...todayFixture.interaction,
      task: {
        ...todayFixture.interaction.task,
        revision: 2,
        status: "SKIPPED" as const,
      },
    };
    const updateTask = vi
      .fn<C010Api["updateTask"]>()
      .mockRejectedValueOnce(
        new MiniappApiError(
          "REVISION_CONFLICT",
          409,
          false,
          undefined,
          undefined,
          "2026-08-24",
          undefined,
          conflict,
        ),
      )
      .mockRejectedValueOnce(
        new MiniappApiError(
          "VIEW_CONTINUATION_EXPIRED",
          403,
          false,
          undefined,
          undefined,
          "2026-08-25",
        ),
      );
    const coordinator = new DailyCoordinator(
      state.port,
      fakeApi({
        getToday: async () => ({
          productDate: "2026-08-24",
          today: todayFixture,
        }),
        updateTask,
      }),
      "scope",
      () => 1_000,
      (() => {
        let ordinal = 0;
        return () => `task-command-${++ordinal}`;
      })(),
    );
    await coordinator.loadToday();
    await expect(
      coordinator.updateTask({
        expectedRevision: 1,
        productDate: "2026-08-24",
        status: "COMPLETED",
        taskRef: todayFixture.interaction.task.task_id,
      }),
    ).resolves.toMatchObject({
      kind: "today",
      noticeCode: "TASK_CONFLICT",
      view: { interaction: { task: { revision: 2, status: "SKIPPED" } } },
    });
    await expect(
      coordinator.updateTask({
        expectedRevision: 2,
        productDate: "2026-08-24",
        status: "INTERESTED",
        taskRef: todayFixture.interaction.task.task_id,
      }),
    ).resolves.toMatchObject({
      kind: "today",
      noticeCode: "TASK_WINDOW_CLOSED",
    });
  });
});
