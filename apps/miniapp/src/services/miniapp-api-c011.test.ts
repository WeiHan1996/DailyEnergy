import { describe, expect, it } from "vitest";

import { todayFixture } from "../features/daily/daily-fixture.test.js";
import type {
  NetworkPort,
  NetworkRequest,
  NetworkResponse,
} from "../platform/ports.js";
import { createMiniappApi } from "./miniapp-api.js";

function response(data: unknown): NetworkResponse {
  return { data, headers: {}, statusCode: 200 };
}

function success(data: Record<string, unknown>) {
  return {
    data,
    ok: true,
    product_date: "2026-08-24",
    request_id: "request-c011",
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

describe("C-011 miniapp light and history bridge", () => {
  it("sends only the command, original date and result identity", async () => {
    const requests: NetworkRequest[] = [];
    const lit = { ...todayFixture.interaction, is_lit: true };
    const api = await authenticatedApi(requests, [response(success(lit))]);
    await expect(
      api.lightDay({
        commandRef: "light-command-one",
        productDate: "2026-08-24",
        resultRef: todayFixture.interaction.result_id,
      }),
    ).resolves.toMatchObject({ interaction: { is_lit: true } });
    expect(requests[1]).toMatchObject({
      body: {
        command_ref: "light-command-one",
        product_date: "2026-08-24",
        result_ref: todayFixture.interaction.result_id,
      },
      headers: { "Idempotency-Key": "light-command-one" },
      method: "POST",
      path: "/v1/daily/interaction/light",
    });
    expect(JSON.stringify(requests)).not.toMatch(
      /main_action|scroll|account_id|session_id|epoch/iu,
    );
  });

  it("projects explicit recorded and missing dates", async () => {
    const requests: NetworkRequest[] = [];
    const history = {
      items: [
        {
          product_date: "2026-08-24",
          state: "RECORDED",
          is_lit: true,
          has_result: true,
          has_evening_feedback: false,
        },
        {
          product_date: "2026-08-23",
          state: "MISSING",
          is_lit: false,
          has_result: false,
          has_evening_feedback: false,
        },
      ],
      page_info: { has_more: false },
    };
    const api = await authenticatedApi(requests, [response(success(history))]);
    await expect(api.listHistory()).resolves.toMatchObject({ history });
    expect(requests[1]).toMatchObject({
      method: "GET",
      path: "/v1/history/days",
    });
  });
});
