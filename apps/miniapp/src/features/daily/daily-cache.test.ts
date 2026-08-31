import { describe, expect, it } from "vitest";

import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  DAILY_VIEW_CACHE_TTL_MS,
  DailyViewCache,
  PendingGenerationStore,
  PendingTaskUpdateStore,
} from "./daily-cache.js";
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

describe("C-009 daily view cache", () => {
  it("keeps only validated session-scoped views and seven history days", async () => {
    const state = storage();
    const cache = new DailyViewCache(state.port, "scope-one", () => 1_000);
    await cache.saveToday(todayFixture);
    await cache.saveHistory(historyFixture);

    await expect(cache.loadToday()).resolves.toEqual(todayFixture);
    await expect(cache.loadHistory("2026-08-23")).resolves.toEqual(
      historyFixture,
    );
    await expect(
      new DailyViewCache(state.port, "scope-two", () => 1_000).loadToday(),
    ).resolves.toBeUndefined();
  });

  it("does not retain notes and evicts details for authoritative missing days", async () => {
    const state = storage();
    const cache = new DailyViewCache(state.port, "scope", () => 1_000);
    await cache.saveHistory({
      ...historyFixture,
      evening: {
        availability: "READ_ONLY_SUBMITTED",
        completion_message: "今天先到这里，这些记录已经留下了。",
        contract: "evening-feedback-view",
        feedback: {
          first_submitted_at: "2026-08-23T12:00:00.000Z",
          note: "不应进入本地历史缓存",
          overall_feeling: "STEADY",
          revision: 1,
          updated_at: "2026-08-23T12:00:00.000Z",
        },
        helpfulness: { rating: "HELPFUL", revision: 1 },
        note_max_characters: 80,
        options: {
          helpfulness: ["HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
          overall_feeling: [
            "VERY_HEAVY",
            "SOMEWHAT_HEAVY",
            "STEADY",
            "PRETTY_GOOD",
            "LIGHT",
            "UNSURE",
          ],
          task_status: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
        },
        primary_action: "READ_ONLY",
        product_date: historyFixture.product_date,
        schema_version: "1.0.0",
        task: {
          instruction: "现在关闭一个会分散注意力的页面。",
          revision: 1,
          status: "UNMARKED",
          task_id: "task.close-one-distraction.v1",
        },
        write_window: "CLOSED",
      },
    });

    expect(JSON.stringify(state.values.get("daily:views"))).not.toContain(
      "不应进入本地历史缓存",
    );
    expect(
      (await cache.loadHistory(historyFixture.product_date))?.evening?.feedback,
    ).not.toHaveProperty("note");

    await cache.saveHistoryList({
      items: [
        {
          has_evening_feedback: false,
          has_result: false,
          is_lit: false,
          product_date: historyFixture.product_date,
          state: "MISSING",
        },
      ],
      page_info: { has_more: false },
    });
    await expect(
      cache.loadHistory(historyFixture.product_date),
    ).resolves.toBeUndefined();
  });

  it("does not extend the 24-hour retention anchor when views change", async () => {
    const state = storage();
    let now = 1_000;
    const cache = new DailyViewCache(state.port, "scope", () => now);
    await cache.saveHistory(historyFixture);
    const initial = state.values.get("daily:views") as Record<
      string,
      StorageValue
    >;
    const initialExpiry = initial.expiresAt;

    now += 60_000;
    await cache.saveToday(todayFixture);
    const updated = state.values.get("daily:views") as Record<
      string,
      StorageValue
    >;
    expect(updated.expiresAt).toBe(initialExpiry);
  });

  it("expires and removes malformed cache instead of rendering it", async () => {
    const expired = storage();
    const cache = new DailyViewCache(expired.port, "scope", () => 1_000);
    await cache.saveToday(todayFixture);
    await expect(
      new DailyViewCache(
        expired.port,
        "scope",
        () => 1_000 + DAILY_VIEW_CACHE_TTL_MS,
      ).loadToday(),
    ).resolves.toBeUndefined();

    await expired.port.set("daily:views", {
      expiresAt: 9_999,
      histories: {},
      scope: "scope",
      today: { ...todayFixture, seed: "forbidden" } as unknown as StorageValue,
      version: 1,
    });
    await expect(cache.loadToday()).resolves.toBeUndefined();

    await expired.port.set("daily:views", {
      expiresAt: 9_999,
      histories: {
        "2026-02-30": historyFixture as unknown as StorageValue,
      },
      scope: "scope",
      version: 1,
    });
    await expect(cache.loadHistory("2026-02-30")).resolves.toBeUndefined();
  });

  it("persists one recoverable generation identity and rejects another scope", async () => {
    const state = storage();
    const pending = new PendingGenerationStore(
      state.port,
      "scope-one",
      () => 1_000,
    );
    await pending.save({
      commandRef: "generation-command-one",
      expectedCheckinRevision: 1,
      intentRef: "33333333-3333-4333-8333-333333333333",
      productDate: "2026-08-24",
    });
    await expect(pending.load()).resolves.toMatchObject({
      commandRef: "generation-command-one",
      intentRef: "33333333-3333-4333-8333-333333333333",
    });
    await expect(
      new PendingGenerationStore(state.port, "scope-two", () => 1_000).load(),
    ).resolves.toBeUndefined();
  });

  it("keeps one session-scoped task command only for unknown-outcome recovery", async () => {
    const state = storage();
    const pending = new PendingTaskUpdateStore(
      state.port,
      "scope-one",
      () => 1_000,
    );
    await pending.save({
      commandRef: "task-command-one",
      expectedRevision: 1,
      productDate: "2026-08-24",
      status: "INTERESTED",
      taskRef: "task.close-one-distraction.v1",
    });
    await expect(pending.load()).resolves.toMatchObject({
      commandRef: "task-command-one",
      status: "INTERESTED",
    });
    await expect(
      new PendingTaskUpdateStore(state.port, "scope-two", () => 1_000).load(),
    ).resolves.toBeUndefined();
  });
});
