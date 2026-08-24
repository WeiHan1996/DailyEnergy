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
