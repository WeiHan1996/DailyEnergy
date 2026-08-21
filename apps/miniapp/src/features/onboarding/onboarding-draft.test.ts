import { describe, expect, it } from "vitest";

import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  ONBOARDING_DRAFT_TTL_MS,
  OnboardingDraftStore,
} from "./onboarding-draft.js";

function memoryStorage(initial?: StorageValue): {
  readonly port: StoragePort;
  readonly values: Map<string, StorageValue>;
} {
  const values = new Map<string, StorageValue>();
  if (initial !== undefined) {
    values.set("onboarding:draft", initial);
  }
  return {
    port: {
      get: async (key) => values.get(key),
      remove: async (key) => {
        values.delete(key);
      },
      set: async (key, value) => {
        values.set(key, value);
      },
    },
    values,
  };
}

describe("C-003 onboarding draft", () => {
  it("keeps only the minimum same-run, same-date draft", async () => {
    let now = 1_000;
    const storage = memoryStorage();
    const first = new OnboardingDraftStore(
      storage.port,
      "scope-one",
      () => now,
    );
    await first.activate("2026-08-21");
    await first.update({
      expressionStyle: "GENTLE",
      pendingOnboardingCommandRef: "onboarding-command-one",
      preferredName: "小晨",
    });

    const resumed = new OnboardingDraftStore(
      storage.port,
      "scope-one",
      () => now,
    );
    await resumed.activate("2026-08-21");
    await expect(resumed.load()).resolves.toEqual({
      expressionStyle: "GENTLE",
      pendingOnboardingCommandRef: "onboarding-command-one",
      preferredName: "小晨",
    });

    now += ONBOARDING_DRAFT_TTL_MS + 1;
    await expect(resumed.load()).resolves.toEqual({
      expressionStyle: "BALANCED",
    });
    expect(storage.values.size).toBe(0);
  });

  it("removes a prior run or prior product-date draft", async () => {
    const storage = memoryStorage();
    const first = new OnboardingDraftStore(storage.port, "scope-one");
    await first.activate("2026-08-21");
    await first.update({ preferredName: "不应跨账户出现" });

    const nextRun = new OnboardingDraftStore(storage.port, "scope-two");
    await nextRun.activate("2026-08-21");
    await expect(nextRun.load()).resolves.toEqual({
      expressionStyle: "BALANCED",
    });

    await nextRun.update({ preferredName: "不应跨日出现" });
    await nextRun.activate("2026-08-22");
    await expect(nextRun.load()).resolves.toEqual({
      expressionStyle: "BALANCED",
    });
  });

  it("clears the optional name without losing an unknown-outcome command", async () => {
    const storage = memoryStorage();
    const store = new OnboardingDraftStore(storage.port, "scope-one");
    await store.activate("2026-08-21");
    await store.update({
      pendingConsentCommandRef: "consent-command-one",
      pendingConsentNoticeVersion: "notice-v1",
      pendingOnboardingCommandRef: "onboarding-command-one",
      preferredName: "小晨",
    });

    await expect(store.update({ preferredName: null })).resolves.toEqual({
      expressionStyle: "BALANCED",
      pendingConsentCommandRef: "consent-command-one",
      pendingConsentNoticeVersion: "notice-v1",
      pendingOnboardingCommandRef: "onboarding-command-one",
    });
    await store.clearPending("consent");
    await expect(store.load()).resolves.toEqual({
      expressionStyle: "BALANCED",
      pendingOnboardingCommandRef: "onboarding-command-one",
    });
  });

  it("deletes malformed local data instead of treating it as a fact", async () => {
    const storage = memoryStorage({
      expressionStyle: "UNREVIEWED",
      preferredName: "stale",
      version: 1,
    });
    const store = new OnboardingDraftStore(storage.port, "scope-one");
    await store.activate("2026-08-21");
    await expect(store.load()).resolves.toEqual({
      expressionStyle: "BALANCED",
    });
    expect(storage.values.size).toBe(0);
  });
});
