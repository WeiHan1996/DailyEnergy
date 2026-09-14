import { describe, expect, it } from "vitest";

import type {
  NetworkPort,
  NetworkRequest,
  NetworkResponse,
} from "../platform/ports.js";
import { createMiniappApi } from "./miniapp-api.js";

function response(data: unknown, statusCode = 200): NetworkResponse {
  return { data, headers: {}, statusCode };
}

function success(data: Record<string, unknown>) {
  return {
    data,
    ok: true,
    product_date: "2026-09-14",
    request_id: "request-ai008",
    server_now: "2026-09-14T12:00:00.000Z",
  };
}

const matter = {
  daily_use_granted: true,
  matter_ref: "33333333-3333-4333-8333-333333333333",
  revision: 1,
  status: "ACTIVE",
  target_date: "2026-09-18",
  title: "周五做项目汇报",
  updated_at: "2026-09-14T12:00:00.000Z",
  weekly_use_granted: false,
} as const;

const task = {
  can_cancel: false,
  created_at: "2026-09-14T12:00:00.000Z",
  kind: "DELETE",
  revision: 1,
  scope: "MATTER",
  status: "PENDING",
  target_summary: "事项数据",
  task_ref: "44444444-4444-4444-8444-444444444444",
  updated_at: "2026-09-14T12:00:00.000Z",
} as const;

async function authenticatedApi(
  requests: NetworkRequest[],
  replies: NetworkResponse[],
) {
  const network: NetworkPort = {
    request: async <T>(request: NetworkRequest) => {
      requests.push(request);
      return replies.shift()! as NetworkResponse<T>;
    },
  };
  const api = createMiniappApi(network);
  replies.unshift(
    response(
      success({
        account_state: "ACTIVE",
        consent_required: false,
        expires_at: "2026-10-14T12:00:00.000Z",
        onboarding_required: false,
        refresh_after: "2026-10-01T12:00:00.000Z",
        session_token: "s".repeat(43),
      }),
    ),
  );
  await api.createSession({ code: "wechat-code" });
  return api;
}

describe("AI-008 miniapp Matter API bridge", () => {
  it("uses strict list, create, update, transition, and delete transports", async () => {
    const requests: NetworkRequest[] = [];
    const api = await authenticatedApi(requests, [
      response(success({ items: [matter], page_info: { has_more: false } })),
      response(success(matter)),
      response(success({ ...matter, revision: 2, title: "周五完成项目汇报" })),
      response(success({ ...matter, revision: 3, status: "PAUSED" })),
      response(success(task)),
    ]);
    await api.listMatters();
    await api.createMatter({
      commandRef: "matter-create-command-0001",
      dailyUseGranted: true,
      targetDate: "2026-09-18",
      title: matter.title,
      weeklyUseGranted: false,
    });
    await api.updateMatter({
      commandRef: "matter-update-command-0001",
      dailyUseGranted: false,
      expectedRevision: 1,
      matterRef: matter.matter_ref,
      title: "周五完成项目汇报",
    });
    await api.pauseMatter({
      commandRef: "matter-pause-command-0001",
      expectedRevision: 2,
      matterRef: matter.matter_ref,
    });
    await api.deleteManagedMatter({
      commandRef: "matter-delete-command-0001",
      confirmationVersion: "data-rights-matter-v1",
      expectedRevision: 3,
      matterRef: matter.matter_ref,
    });
    expect(requests.slice(1)).toMatchObject([
      { method: "GET", path: "/v1/matters" },
      {
        body: {
          command_ref: "matter-create-command-0001",
          daily_use_granted: true,
          target_date: "2026-09-18",
          weekly_use_granted: false,
        },
        method: "POST",
        path: "/v1/matters",
      },
      {
        body: {
          command_ref: "matter-update-command-0001",
          daily_use_granted: false,
          expected_revision: 1,
        },
        method: "PATCH",
        path: `/v1/matters/${matter.matter_ref}`,
      },
      {
        body: {
          command_ref: "matter-pause-command-0001",
          expected_revision: 2,
        },
        method: "POST",
        path: `/v1/matters/${matter.matter_ref}/pause`,
      },
      {
        body: {
          command_ref: "matter-delete-command-0001",
          confirmation_version: "data-rights-matter-v1",
          confirmed: true,
          expected_revision: 3,
        },
        method: "POST",
        path: `/v1/matters/${matter.matter_ref}/delete`,
      },
    ]);
    expect(JSON.stringify(requests)).not.toMatch(
      /account_id|owner_id|ciphertext|key_version|grant_ref|deletion_epoch/iu,
    );
  });

  it("rejects a Matter response that contains restricted fields", async () => {
    const requests: NetworkRequest[] = [];
    const api = await authenticatedApi(requests, [
      response(
        success({
          items: [{ ...matter, title_ciphertext: "restricted" }],
          page_info: { has_more: false },
        }),
      ),
    ]);
    await expect(api.listMatters()).rejects.toMatchObject({
      code: "CONTRACT_VIOLATION",
    });
  });
});
