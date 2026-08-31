import { describe, expect, it, vi } from "vitest";

import { MiniappPlatformError } from "../../platform/errors.js";
import type {
  LoginPort,
  StoragePort,
  StorageValue,
} from "../../platform/ports.js";
import type { C014Api, DataTaskView } from "../../services/miniapp-api.js";
import { DataRightsCoordinator } from "./data-rights-flow.js";

const pendingTask: DataTaskView = {
  can_cancel: false,
  created_at: "2026-08-25T12:00:00.000Z",
  kind: "DELETE",
  revision: 1,
  scope: "DAY",
  status: "PENDING",
  target_summary: "2026-08-24 日记录",
  task_ref: "10000000-0000-4000-8000-000000000001",
  updated_at: "2026-08-25T12:00:00.000Z",
};
const summary = {
  account: { expected_revision: 4, state: "ACTIVE" as const },
  backup_max_days: 35 as const,
  capabilities: {
    delete_account: true,
    delete_day: true,
    delete_matter: true,
    delete_relationship_data: false,
    export_account: true,
  },
  confirmation_versions: {
    delete_account: "data-rights-account-v1" as const,
    delete_day: "data-rights-day-v1" as const,
    delete_matter: "data-rights-matter-v1" as const,
    delete_relationship_data: "data-rights-relationship-v1" as const,
    export_account: "data-export-v1" as const,
  },
  online_erasure_sla_hours: 72 as const,
};

function fixtures() {
  const values = new Map<string, StorageValue>();
  const storage: StoragePort = {
    get: vi.fn(async (key) => values.get(key)),
    remove: vi.fn(async (key) => {
      values.delete(key);
    }),
    set: vi.fn(async (key, value) => {
      values.set(key, value);
    }),
  };
  const login: LoginPort = { login: vi.fn(async () => ({ code: "wx-code" })) };
  const api = {
    deleteDay: vi.fn(async () => ({
      productDate: "2026-08-25",
      task: pendingTask,
    })),
    listDataTasks: vi.fn(async () => ({
      productDate: "2026-08-25",
      tasks: { items: [], page_info: { has_more: false } },
    })),
    getDataRightsSummary: vi.fn(async () => ({
      productDate: "2026-08-25",
      summary,
    })),
  } as unknown as C014Api;
  return { api, login, storage, values };
}

describe("C-014 data-rights flow", () => {
  it("clears DAY-derived local caches after the synchronous guard response", async () => {
    const state = fixtures();
    for (const key of ["daily:views", "evening:view", "weekly:view"]) {
      state.values.set(key, { cached: true });
    }
    const coordinator = new DataRightsCoordinator(
      state.login,
      state.storage,
      state.api,
    );
    await expect(
      coordinator.deleteDay({
        expectedRevision: 2,
        productDate: "2026-08-24",
      }),
    ).resolves.toMatchObject({ kind: "task", task: pendingTask });
    expect(state.values.has("daily:views")).toBe(false);
    expect(state.values.has("evening:view")).toBe(false);
    expect(state.values.has("weekly:view")).toBe(false);
  });

  it("does not queue a data-rights operation while offline", async () => {
    const state = fixtures();
    state.api.listDataTasks = vi.fn(async () =>
      Promise.reject(new MiniappPlatformError("NETWORK_FAILED")),
    );
    const coordinator = new DataRightsCoordinator(
      state.login,
      state.storage,
      state.api,
    );
    await expect(coordinator.load()).resolves.toEqual({
      kind: "offline",
      reasonCode: "NETWORK_FAILED",
    });
    expect(state.values.size).toBe(0);
  });

  it("stores only the account status grant and clears it after terminal read", async () => {
    const state = fixtures();
    const accountTask: DataTaskView = {
      ...pendingTask,
      scope: "ACCOUNT",
      target_summary: "账户数据",
    };
    const statusToken = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    state.api.confirmAccountDeletion = vi.fn(async () => ({
      accepted: {
        task: accountTask,
        status_grant: {
          expires_at: "2099-09-01T12:00:00.000Z",
          status_token: statusToken,
          task_ref: accountTask.task_ref,
        },
      },
      productDate: "2026-08-25",
    }));
    state.api.getDeletionStatus = vi.fn(async () => ({
      productDate: "2026-08-25",
      task: {
        ...accountTask,
        backup_purge_deadline: "2099-10-01T12:00:00.000Z",
        online_erased_at: "2099-08-25T13:00:00.000Z",
        revision: 3,
        status: "SUCCEEDED" as const,
      },
    }));
    const coordinator = new DataRightsCoordinator(
      state.login,
      state.storage,
      state.api,
    );
    await expect(
      coordinator.confirmAccountDeletion({
        confirmation: {
          backup_max_days: 35,
          confirmation_challenge_ref: "20000000-0000-4000-8000-000000000001",
          confirmation_version: "data-rights-account-v1",
          derived_effects: [],
          expected_revision: 4,
          expires_at: "2099-08-25T12:10:00.000Z",
          identity_reverification_required: true,
          immediate_effects: ["普通访问立即停止。"],
          online_erasure_sla_hours: 72,
          scope: "ACCOUNT",
          target: { subject: "SELF" },
        },
        identityVerificationRef: "20000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toMatchObject({ kind: "task", task: accountTask });
    expect(state.values.get("data-rights:deletion-status-v1")).toEqual({
      expiresAt: "2099-09-01T12:00:00.000Z",
      statusToken,
      taskRef: accountTask.task_ref,
    });
    await expect(coordinator.loadDeletionStatus()).resolves.toMatchObject({
      kind: "task",
      task: { status: "SUCCEEDED" },
    });
    expect(state.values.has("data-rights:deletion-status-v1")).toBe(false);
    expect(state.api.getDeletionStatus).toHaveBeenCalledWith({
      statusToken,
      taskRef: accountTask.task_ref,
    });
  });
});
