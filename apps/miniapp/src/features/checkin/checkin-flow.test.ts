import { describe, expect, it, vi } from "vitest";

import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C004Api,
  type CheckinEnergy,
  type CheckinEnvelope,
  type CheckinMood,
  type CheckinSleep,
  type CheckinView,
} from "../../services/miniapp-api.js";
import { CheckinCoordinator } from "./checkin-flow.js";

function memoryStorage(): StoragePort {
  const values = new Map<string, StorageValue>();
  return {
    get: async (key) => values.get(key),
    remove: async (key) => {
      values.delete(key);
    },
    set: async (key, value) => {
      values.set(key, value);
    },
  };
}

function view(
  revision = 1,
  values: {
    readonly energy: CheckinEnergy;
    readonly mood: CheckinMood;
    readonly sleep: CheckinSleep;
  } = {
    energy: "STEADY" as const,
    mood: "GOOD" as const,
    sleep: "OKAY" as const,
  },
  productDate = "2026-08-21",
): CheckinView {
  return {
    checkin_ref: "11111111-1111-4111-8111-111111111111",
    product_date: productDate,
    revision,
    updated_at: "2026-08-21T01:00:00.000Z",
    write_window: "OPEN",
    ...values,
  };
}

function envelope(checkin: CheckinView): CheckinEnvelope {
  return { checkin, productDate: checkin.product_date };
}

function absent(productDate = "2026-08-21") {
  return new MiniappApiError(
    "RESOURCE_NOT_FOUND",
    404,
    false,
    undefined,
    undefined,
    productDate,
  );
}

function fakeApi(overrides: Partial<C004Api>): C004Api {
  return {
    correctCheckin: async () => {
      throw new Error("UNEXPECTED_CORRECT");
    },
    getTodayCheckin: async () => {
      throw absent();
    },
    submitCheckin: async () => {
      throw new Error("UNEXPECTED_SUBMIT");
    },
    ...overrides,
  };
}

const selections = {
  energy: "STEADY" as const,
  mood: "GOOD" as const,
  sleep: "OKAY" as const,
};

describe("C-004 check-in coordinator", () => {
  it("restores a same-date draft and never uses device time as product date", async () => {
    const storage = memoryStorage();
    const coordinator = new CheckinCoordinator(
      storage,
      fakeApi({}),
      "scope-one",
    );
    await expect(coordinator.load()).resolves.toMatchObject({
      draft: {},
      kind: "ready",
      productDate: "2026-08-21",
    });
    await coordinator.saveDraft(selections);

    const resumed = new CheckinCoordinator(storage, fakeApi({}), "scope-one");
    await expect(resumed.load()).resolves.toMatchObject({
      draft: selections,
      kind: "ready",
      productDate: "2026-08-21",
    });
  });

  it("clears a prior-date draft before allowing a new submit", async () => {
    let productDate = "2026-08-21";
    const api = fakeApi({
      getTodayCheckin: async () => {
        throw absent(productDate);
      },
    });
    const coordinator = new CheckinCoordinator(
      memoryStorage(),
      api,
      "scope-one",
    );
    await coordinator.load();
    await coordinator.saveDraft(selections);
    productDate = "2026-08-22";

    await expect(coordinator.save(selections)).resolves.toMatchObject({
      dateChanged: true,
      draft: {},
      kind: "ready",
      productDate: "2026-08-22",
      reasonCode: "PRODUCT_DATE_CHANGED",
    });
  });

  it("recovers a timeout by reading the authoritative record before replay", async () => {
    let current: CheckinView | undefined;
    const submitCheckin = vi.fn<C004Api["submitCheckin"]>(async () => {
      current = view();
      throw new MiniappPlatformError("NETWORK_FAILED");
    });
    const api = fakeApi({
      getTodayCheckin: async () => {
        if (current === undefined) {
          throw absent();
        }
        return envelope(current);
      },
      submitCheckin,
    });
    const coordinator = new CheckinCoordinator(
      memoryStorage(),
      api,
      "scope-one",
      Date.now,
      () => "checkin-command-0001",
    );
    await coordinator.load();
    await expect(coordinator.save(selections)).resolves.toEqual({
      kind: "recovery",
      reasonCode: "NETWORK_FAILED",
    });
    await expect(coordinator.save(selections)).resolves.toMatchObject({
      kind: "saved",
      view: { revision: 1 },
    });
    expect(submitCheckin).toHaveBeenCalledTimes(1);
  });

  it("reads a multi-device CAS conflict and preserves the explicit draft", async () => {
    let current = view();
    const desired = {
      energy: "HIGH" as const,
      mood: "LIGHT" as const,
      sleep: "GOOD" as const,
    };
    const correctCheckin = vi.fn<C004Api["correctCheckin"]>(async () => {
      current = view(2, {
        energy: "LOW",
        mood: "LOW",
        sleep: "LOW",
      });
      throw new MiniappApiError("REVISION_CONFLICT", 409, false);
    });
    const coordinator = new CheckinCoordinator(
      memoryStorage(),
      fakeApi({
        correctCheckin,
        getTodayCheckin: async () => envelope(current),
      }),
      "scope-one",
      Date.now,
      () => "checkin-correct-0001",
    );
    await coordinator.load();
    const result = await coordinator.save(desired);
    expect(result).toMatchObject({
      current: { revision: 2 },
      draft: desired,
      kind: "ready",
      reasonCode: "REVISION_CONFLICT",
    });
    expect(correctCheckin).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 1 }),
    );
  });

  it("accepts UNSURE as a complete formal selection", async () => {
    const unsure = {
      energy: "UNSURE" as const,
      mood: "UNSURE" as const,
      sleep: "UNSURE" as const,
    };
    const submitCheckin = vi.fn<C004Api["submitCheckin"]>(async () =>
      envelope(view(1, unsure)),
    );
    const coordinator = new CheckinCoordinator(
      memoryStorage(),
      fakeApi({ submitCheckin }),
      "scope-one",
      Date.now,
      () => "checkin-command-unsure",
    );
    await coordinator.load();
    await expect(coordinator.save(unsure)).resolves.toMatchObject({
      kind: "saved",
      view: unsure,
    });
  });
});
