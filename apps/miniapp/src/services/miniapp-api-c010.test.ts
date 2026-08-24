import { describe, expect, it } from "vitest";

import { todayFixture } from "../features/daily/daily-fixture.test.js";
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
    product_date: "2026-08-24",
    request_id: "request-c010",
    server_now: "2026-08-24T02:00:00.000Z",
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
        expires_at: "2026-09-24T02:00:00.000Z",
        onboarding_required: false,
        refresh_after: "2026-09-08T02:00:00.000Z",
        session_token: "s".repeat(43),
      }),
    ),
  );
  await api.createSession({ code: "wechat-code" });
  return api;
}

describe("C-010 miniapp task API bridge", () => {
  it("reads and updates only the strict task projection", async () => {
    const requests: NetworkRequest[] = [];
    const interested = {
      ...todayFixture.interaction,
      task: {
        ...todayFixture.interaction.task,
        revision: 2,
        status: "INTERESTED",
      },
    };
    const api = await authenticatedApi(requests, [
      response(success(todayFixture.interaction)),
      response(success(interested)),
    ]);
    await expect(api.getInteraction()).resolves.toMatchObject({
      interaction: todayFixture.interaction,
    });
    await expect(
      api.updateTask({
        commandRef: "task-command-one",
        expectedRevision: 1,
        productDate: "2026-08-24",
        status: "INTERESTED",
        taskRef: todayFixture.interaction.task.task_id,
      }),
    ).resolves.toMatchObject({ interaction: interested });
    expect(requests[2]).toMatchObject({
      body: {
        command_ref: "task-command-one",
        expected_revision: 1,
        product_date: "2026-08-24",
        status: "INTERESTED",
        task_ref: todayFixture.interaction.task.task_id,
      },
      headers: { "Idempotency-Key": "task-command-one" },
      method: "POST",
      path: "/v1/daily/interaction/task",
    });
    expect(JSON.stringify(requests)).not.toMatch(
      /account_id|session_id|continuation|epoch/iu,
    );
  });

  it("rejects invalid targets and preserves a strict current view on conflict", async () => {
    const requests: NetworkRequest[] = [];
    const current = {
      ...todayFixture.interaction,
      task: {
        ...todayFixture.interaction.task,
        revision: 2,
        status: "COMPLETED",
      },
    };
    const api = await authenticatedApi(requests, [
      response(
        {
          error: {
            category: "CONFLICT",
            code: "REVISION_CONFLICT",
            details: { current, current_revision: 2 },
            message: "内容已更新",
            message_key: "error.revision_conflict",
            retryable: false,
          },
          ok: false,
          product_date: "2026-08-24",
          request_id: "request-c010",
          server_now: "2026-08-24T02:00:00.000Z",
        },
        409,
      ),
    ]);
    await expect(
      api.updateTask({
        commandRef: "task-command-conflict",
        expectedRevision: 1,
        productDate: "2026-08-24",
        status: "COMPLETED",
        taskRef: todayFixture.interaction.task.task_id,
      }),
    ).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
      currentInteraction: current,
    });
    await expect(
      api.updateTask({
        commandRef: "task-command-invalid",
        expectedRevision: 1,
        productDate: "2026-02-30",
        status: "COMPLETED",
        taskRef: todayFixture.interaction.task.task_id,
      }),
    ).rejects.toMatchObject({ code: "CONTRACT_VIOLATION" });
    expect(requests).toHaveLength(2);
  });
});
