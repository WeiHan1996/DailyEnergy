import { describe, expect, it, vi } from "vitest";

import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C012Api,
  type EveningView,
} from "../../services/miniapp-api.js";
import { EveningCoordinator } from "./evening-flow.js";

const emptyView: EveningView = {
  availability: "EDITABLE_EMPTY",
  completion_message: "今天先到这里，这些记录已经留下了。",
  contract: "evening-feedback-view",
  helpfulness: { rating: "UNRATED", revision: 0 },
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
  primary_action: "SAVE",
  product_date: "2026-08-24",
  schema_version: "1.0.0",
  task: {
    instruction: "现在关闭一个会分散注意力的页面。",
    revision: 1,
    status: "UNMARKED",
    task_id: "task.close-one-distraction.v1",
  },
  write_window: "OPEN",
};

const submittedView: EveningView = {
  ...emptyView,
  availability: "EDITABLE_SUBMITTED",
  feedback: {
    first_submitted_at: "2026-08-24T12:00:00.000Z",
    note: "今天把最难的一步拆小了。",
    overall_feeling: "STEADY",
    revision: 1,
    updated_at: "2026-08-24T12:00:00.000Z",
  },
  helpfulness: { rating: "HELPFUL", revision: 1 },
  primary_action: "SAVE_CHANGES",
};

function storage(): StoragePort {
  const values = new Map<string, StorageValue>();
  return {
    get: async (key) => values.get(key),
    remove: async (key) => {
      values.delete(key);
    },
    set: async (key, value) => {
      values.set(key, JSON.parse(JSON.stringify(value)) as StorageValue);
    },
  };
}

function api(overrides: Partial<C012Api>): C012Api {
  return {
    getEvening: async () => Promise.reject(new Error("UNEXPECTED_GET")),
    saveEvening: async () => Promise.reject(new Error("UNEXPECTED_SAVE")),
    ...overrides,
  };
}

describe("C-012 evening coordinator", () => {
  it("keeps one command through unknown outcome and confirms before retry", async () => {
    const saveEvening = vi
      .fn<C012Api["saveEvening"]>()
      .mockRejectedValueOnce(new MiniappPlatformError("NETWORK_FAILED"));
    const coordinator = new EveningCoordinator(
      storage(),
      api({
        getEvening: async () => ({
          evening: submittedView,
          productDate: "2026-08-24",
        }),
        saveEvening,
      }),
      "scope",
      () => 1_000,
      () => "evening-command-one",
    );
    await coordinator.load();
    await expect(
      coordinator.save(emptyView, {
        helpfulnessRating: "HELPFUL",
        note: "今天把最难的一步拆小了。",
        noteTouched: true,
        overallFeeling: "STEADY",
      }),
    ).resolves.toMatchObject({
      kind: "evening",
      noticeCode: "EVENING_OUTCOME_PENDING",
    });
    await expect(coordinator.retry()).resolves.toMatchObject({
      kind: "evening",
      noticeCode: "EVENING_SAVED",
      view: submittedView,
    });
    expect(saveEvening).toHaveBeenCalledTimes(1);
    expect(saveEvening.mock.calls[0]?.[0].commandRef).toBe(
      "evening-command-one",
    );
  });

  it("replaces stale component revisions with the strict current view", async () => {
    const coordinator = new EveningCoordinator(
      storage(),
      api({
        getEvening: async () => ({
          evening: emptyView,
          productDate: "2026-08-24",
        }),
        saveEvening: async () => {
          throw new MiniappApiError(
            "REVISION_CONFLICT",
            409,
            false,
            undefined,
            undefined,
            "2026-08-24",
            undefined,
            undefined,
            submittedView,
          );
        },
      }),
      "scope",
    );
    await coordinator.load();
    await expect(
      coordinator.save(emptyView, {
        helpfulnessRating: "HELPFUL",
        note: "",
        noteTouched: false,
        overallFeeling: "STEADY",
      }),
    ).resolves.toMatchObject({
      kind: "evening",
      noticeCode: "EVENING_CONFLICT",
      view: submittedView,
    });
  });

  it("routes Safety overlay and never reports ordinary success", async () => {
    const coordinator = new EveningCoordinator(
      storage(),
      api({
        getEvening: async () => ({
          evening: emptyView,
          productDate: "2026-08-24",
        }),
        saveEvening: async () => {
          throw new MiniappApiError("SAFETY_OVERLAY", 409, false, undefined, {
            blocks: [
              {
                block_id: "DIRECT_ACKNOWLEDGEMENT_V1",
                copy: "这里先停止普通流程。",
                kind: "DIRECT_ACKNOWLEDGEMENT",
                resources: [],
              },
            ],
            response_bundle_version: "safety-response-v1",
            revision: 1,
            state: "ACTIVE",
            updated_at: "2026-08-24T12:00:00.000Z",
          });
        },
      }),
      "scope",
    );
    await coordinator.load();
    await expect(
      coordinator.save(emptyView, {
        helpfulnessRating: "HELPFUL",
        note: "synthetic",
        noteTouched: true,
        overallFeeling: "STEADY",
      }),
    ).resolves.toEqual({ kind: "safety", reasonCode: "SAFETY_OVERLAY" });
    expect(coordinator.getSafetyView()).toMatchObject({ state: "ACTIVE" });
  });
});
