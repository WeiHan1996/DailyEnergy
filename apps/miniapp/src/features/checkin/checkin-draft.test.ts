import { describe, expect, it } from "vitest";

import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  CHECKIN_DRAFT_TTL_MS,
  CheckinDraftStore,
  completeSelections,
} from "./checkin-draft.js";

function memoryStorage(initial?: StorageValue) {
  const values = new Map<string, StorageValue>();
  if (initial !== undefined) {
    values.set("checkin:draft", initial);
  }
  const port: StoragePort = {
    get: async (key) => values.get(key),
    remove: async (key) => {
      values.delete(key);
    },
    set: async (key, value) => {
      values.set(key, value);
    },
  };
  return { port, values };
}

const complete = {
  energy: "UNSURE" as const,
  mood: "UNSURE" as const,
  sleep: "UNSURE" as const,
};

describe("C-004 check-in draft", () => {
  it("keeps only same-scope, same-date structured choices", async () => {
    const storage = memoryStorage();
    const first = new CheckinDraftStore(storage.port, "scope-one");
    await first.activate("2026-08-21");
    await first.update(complete);

    const resumed = new CheckinDraftStore(storage.port, "scope-one");
    await resumed.activate("2026-08-21");
    await expect(resumed.load()).resolves.toEqual(complete);

    const nextScope = new CheckinDraftStore(storage.port, "scope-two");
    await nextScope.activate("2026-08-21");
    await expect(nextScope.load()).resolves.toEqual({});
  });

  it("removes the prior product-date draft instead of copying it", async () => {
    const storage = memoryStorage();
    const store = new CheckinDraftStore(storage.port, "scope-one");
    await store.activate("2026-08-21");
    await store.update(complete);
    await expect(store.activate("2026-08-22")).resolves.toBe(true);
    await expect(store.load()).resolves.toEqual({});
    expect(storage.values.size).toBe(0);
  });

  it("freezes selections while an unknown-outcome command is pending", async () => {
    const storage = memoryStorage();
    const store = new CheckinDraftStore(storage.port, "scope-one");
    await store.activate("2026-08-21");
    await store.beginPending(complete, "checkin-command-0001", 0);
    await expect(
      store.update({ energy: "FULL", mood: "LIGHT", sleep: "GOOD" }),
    ).resolves.toEqual({
      ...complete,
      pendingCommandRef: "checkin-command-0001",
      pendingExpectedRevision: 0,
    });
    await store.clearPending(complete);
    await expect(store.load()).resolves.toEqual(complete);
  });

  it("expires malformed or old local state and treats UNSURE as complete", async () => {
    let now = 1_000;
    const storage = memoryStorage({
      energy: "UNREVIEWED",
      expiresAt: now + 1_000,
      mood: "UNSURE",
      productDate: "2026-08-21",
      scope: "scope-one",
      sleep: "UNSURE",
      version: 1,
    });
    const store = new CheckinDraftStore(storage.port, "scope-one", () => now);
    await store.activate("2026-08-21");
    await expect(store.load()).resolves.toEqual({});

    await store.update(complete);
    expect(completeSelections(complete)).toEqual(complete);
    now += CHECKIN_DRAFT_TTL_MS + 1;
    await expect(store.load()).resolves.toEqual({});
  });
});
