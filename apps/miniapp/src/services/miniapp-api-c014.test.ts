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
    product_date: "2026-08-25",
    request_id: "request-c014",
    server_now: "2026-08-25T12:00:00.000Z",
  };
}

function task() {
  return {
    can_cancel: true,
    created_at: "2026-08-25T12:00:00.000Z",
    kind: "EXPORT",
    revision: 1,
    scope: "ACCOUNT",
    status: "PENDING",
    target_summary: "账户数据导出",
    task_ref: "10000000-0000-4000-8000-000000000001",
    updated_at: "2026-08-25T12:00:00.000Z",
    export_artifact: { format: "JSON", state: "PREPARING" },
  };
}

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
        expires_at: "2026-09-24T12:00:00.000Z",
        onboarding_required: false,
        refresh_after: "2026-09-08T12:00:00.000Z",
        session_token: "s".repeat(43),
      }),
    ),
  );
  await api.createSession({ code: "wechat-code" });
  return api;
}

describe("C-014 miniapp data-rights API bridge", () => {
  it("uses strict task list, export and DAY deletion transports", async () => {
    const requests: NetworkRequest[] = [];
    const api = await authenticatedApi(requests, [
      response(success({ items: [task()], page_info: { has_more: false } })),
      response(success(task()), 202),
      response(
        success({
          ...task(),
          can_cancel: false,
          export_artifact: undefined,
          kind: "DELETE",
          scope: "DAY",
          target_summary: "2026-08-24 日记录",
        }),
        202,
      ),
    ]);
    await api.listDataTasks();
    await api.createDataExport({
      commandRef: "export-command-0001",
      confirmationVersion: "data-export-v1",
    });
    await api.deleteDay({
      commandRef: "delete-day-command-0001",
      confirmationVersion: "data-rights-day-v1",
      expectedRevision: 2,
      productDate: "2026-08-24",
    });
    expect(requests.slice(1)).toMatchObject([
      { method: "GET", path: "/v1/data-rights/tasks" },
      {
        body: {
          command_ref: "export-command-0001",
          export_format: "JSON",
        },
        method: "POST",
        path: "/v1/data-rights/export",
      },
      {
        body: {
          confirmed: true,
          expected_revision: 2,
          scope: "DAY",
          target: { product_date: "2026-08-24" },
        },
        method: "POST",
        path: "/v1/data-rights/delete/day",
      },
    ]);
    expect(JSON.stringify(requests)).not.toMatch(
      /account_id|deletion_epoch|guard_epoch|checkpoint|receipt/iu,
    );
  });

  it("rejects restricted task details instead of rendering them", async () => {
    const requests: NetworkRequest[] = [];
    const api = await authenticatedApi(requests, [
      response(
        success({
          items: [{ ...task(), deletion_epoch: "3" }],
          page_info: { has_more: false },
        }),
      ),
    ]);
    await expect(api.listDataTasks()).rejects.toMatchObject({
      code: "CONTRACT_VIOLATION",
    });
  });

  it("uses summary revisions, raw export download and status-only authorization", async () => {
    const requests: NetworkRequest[] = [];
    const accountTask = {
      ...task(),
      can_cancel: false,
      export_artifact: undefined,
      kind: "DELETE",
      scope: "ACCOUNT",
      target_summary: "账户数据",
    };
    const summary = {
      account: { expected_revision: 4, state: "ACTIVE" },
      capabilities: {
        delete_account: true,
        delete_day: true,
        delete_matter: true,
        delete_relationship_data: false,
        export_account: true,
      },
      confirmation_versions: {
        delete_account: "data-rights-account-v1",
        delete_day: "data-rights-day-v1",
        delete_matter: "data-rights-matter-v1",
        delete_relationship_data: "data-rights-relationship-v1",
        export_account: "data-export-v1",
      },
      online_erasure_sla_hours: 72,
      backup_max_days: 35,
    };
    const statusToken = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    const document = {
      schema_version: "data-export-v1",
      generated_at: "2026-08-25T12:00:00.000Z",
      consent_summary: {
        notice_version: "necessary-consent-v1",
        state: "MISSING",
      },
      days: [],
      matters: [],
      notification_preferences: { items: [] },
      data_task_summaries: [],
    };
    const api = await authenticatedApi(requests, [
      response(success(summary)),
      response(
        success({
          task: accountTask,
          status_grant: {
            task_ref: accountTask.task_ref,
            status_token: statusToken,
            expires_at: "2026-09-01T12:00:00.000Z",
          },
        }),
        202,
      ),
      response(success(accountTask)),
      response(document),
    ]);
    await expect(api.getDataRightsSummary()).resolves.toMatchObject({
      summary,
    });
    await expect(
      api.confirmAccountDeletion({
        challengeRef: "20000000-0000-4000-8000-000000000001",
        commandRef: "confirm-account-command-0001",
        confirmationVersion: "data-rights-account-v1",
        expectedAccountRevision: 4,
        identityVerificationRef: "20000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toMatchObject({ accepted: { task: accountTask } });
    await api.getDeletionStatus({
      statusToken,
      taskRef: accountTask.task_ref,
    });
    await expect(
      api.downloadDataExport({
        downloadRef: "30000000-0000-4000-8000-000000000001",
        taskRef: task().task_ref,
      }),
    ).resolves.toEqual(document);
    expect(requests.slice(1)).toMatchObject([
      { method: "GET", path: "/v1/data-rights/summary" },
      {
        method: "POST",
        path: "/v1/data-rights/delete/account/confirm",
      },
      {
        headers: { Authorization: `DeletionStatus ${statusToken}` },
        method: "GET",
        path: `/v1/data-rights/deletion-status/${accountTask.task_ref}`,
      },
      {
        headers: { Authorization: expect.stringMatching(/^Bearer /u) },
        method: "GET",
        path: `/v1/data-rights/exports/${task().task_ref}/artifacts/30000000-0000-4000-8000-000000000001`,
      },
    ]);
    expect(requests[3]?.headers?.Authorization).not.toMatch(/^Bearer /u);
  });
});
