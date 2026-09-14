import { describe, expect, it, vi } from "vitest";

import { MiniappPlatformError } from "../../platform/errors.js";
import {
  MiniappApiError,
  type AI008Api,
  type MatterView,
} from "../../services/miniapp-api.js";
import {
  MatterCoordinator,
  MatterInputError,
  normalizeMatterTitle,
} from "./matter-flow.js";

const matter: MatterView = {
  daily_use_granted: true,
  matter_ref: "matter-ref-one",
  revision: 1,
  status: "ACTIVE",
  target_date: "2026-09-18",
  title: "周五做项目汇报",
  updated_at: "2026-09-14T12:00:00+08:00",
  weekly_use_granted: false,
};

function api(overrides: Partial<AI008Api> = {}): AI008Api {
  return {
    completeMatter: async () => ({ matter, productDate: "2026-09-14" }),
    createMatter: async () => ({ matter, productDate: "2026-09-14" }),
    deleteManagedMatter: async () => Promise.reject(new Error("NOT_USED")),
    listMatters: async () => ({
      matters: { items: [matter], page_info: { has_more: false } },
      productDate: "2026-09-14",
    }),
    pauseMatter: async () => ({ matter, productDate: "2026-09-14" }),
    resumeMatter: async () => ({ matter, productDate: "2026-09-14" }),
    updateMatter: async () => ({ matter, productDate: "2026-09-14" }),
    ...overrides,
  };
}

describe("AI-008 Matter coordinator", () => {
  it("normalizes only the submitted in-memory title", () => {
    expect(normalizeMatterTitle("  周五做项目\n汇报  ")).toBe(
      "周五做项目 汇报",
    );
    expect(() => normalizeMatterTitle("\u0001bad")).toThrowError(
      new MatterInputError("MATTER_TITLE_INVALID"),
    );
  });

  it("uses one command ref across a transient retry", async () => {
    const create = vi
      .fn<AI008Api["createMatter"]>()
      .mockRejectedValueOnce(new MiniappPlatformError("NETWORK_FAILED"))
      .mockResolvedValueOnce({ matter, productDate: "2026-09-14" });
    const coordinator = new MatterCoordinator(
      api({ createMatter: create }),
      () => "matter-command-stable",
    );
    await expect(
      coordinator.save(undefined, {
        dailyUseGranted: true,
        title: "周五做项目汇报",
        weeklyUseGranted: false,
      }),
    ).resolves.toMatchObject({ kind: "offline" });
    await expect(coordinator.retry()).resolves.toMatchObject({
      kind: "matter",
      view: matter,
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([input]) => input.commandRef)).toEqual([
      "matter-command-stable",
      "matter-command-stable",
    ]);
  });

  it("returns the current server projection on CAS conflict", async () => {
    const current = { ...matter, revision: 2, title: "另一台设备的修改" };
    const coordinator = new MatterCoordinator(
      api({
        updateMatter: async () => {
          throw new MiniappApiError(
            "REVISION_CONFLICT",
            409,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            current,
          );
        },
      }),
    );
    await expect(
      coordinator.save(matter, {
        dailyUseGranted: false,
        title: matter.title,
        weeklyUseGranted: false,
      }),
    ).resolves.toMatchObject({
      kind: "matter",
      noticeCode: "MATTER_CONFLICT",
      view: current,
    });
  });

  it("explains when a requested use is saved as private only", async () => {
    const privateMatter = {
      ...matter,
      daily_use_granted: false,
      weekly_use_granted: false,
    };
    const coordinator = new MatterCoordinator(
      api({
        createMatter: async () => ({
          matter: privateMatter,
          productDate: "2026-09-14",
        }),
      }),
    );
    await expect(
      coordinator.save(undefined, {
        dailyUseGranted: true,
        title: matter.title,
        weeklyUseGranted: false,
      }),
    ).resolves.toMatchObject({
      kind: "matter",
      noticeCode: "MATTER_SAVED_PRIVATE",
      view: privateMatter,
    });
  });

  it("clears pending writes and exposes only the Safety route", async () => {
    const safetyView = {
      blocks: [
        {
          block_id: "ack",
          copy: "先停止普通流程。",
          kind: "DIRECT_ACKNOWLEDGEMENT" as const,
          resources: [],
        },
      ],
      response_bundle_version: "safety-v1",
      revision: 1,
      state: "ACTIVE" as const,
      updated_at: "2026-09-14T12:00:00+08:00",
    };
    const create = vi.fn<AI008Api["createMatter"]>(async () => {
      throw new MiniappApiError(
        "SAFETY_OVERLAY",
        409,
        false,
        undefined,
        safetyView,
      );
    });
    const coordinator = new MatterCoordinator(api({ createMatter: create }));
    await expect(
      coordinator.save(undefined, {
        dailyUseGranted: true,
        title: "synthetic high risk",
        weeklyUseGranted: false,
      }),
    ).resolves.toMatchObject({ kind: "safety" });
    expect(coordinator.getSafetyView()).toEqual(safetyView);
    await coordinator.retry();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
