import { describe, expect, it } from "vitest";

import {
  historyFixture,
  todayFixture,
} from "../features/daily/daily-fixture.test.js";
import type {
  NetworkPort,
  NetworkRequest,
  NetworkResponse,
} from "../platform/ports.js";
import { createMiniappApi, MiniappApiError } from "./miniapp-api.js";

function response(data: unknown, statusCode = 200): NetworkResponse {
  return { data, headers: {}, statusCode };
}

function success(data: Record<string, unknown>) {
  return {
    data,
    ok: true,
    product_date: "2026-08-24",
    request_id: "request-c009",
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

describe("C-009 miniapp API bridge", () => {
  it("maps start, status, Today and history without client-owned facts", async () => {
    const requests: NetworkRequest[] = [];
    const intent = {
      intent_ref: "33333333-3333-4333-8333-333333333333",
      product_date: "2026-08-24",
      retry_after_seconds: 2,
      status: "QUEUED",
      updated_at: "2026-08-24T02:00:00.000Z",
    };
    const api = await authenticatedApi(requests, [
      response(success(intent)),
      response(success(intent)),
      response(success(todayFixture as unknown as Record<string, unknown>)),
      response(success(historyFixture as unknown as Record<string, unknown>)),
    ]);

    await expect(
      api.startGeneration({
        commandRef: "generation-command-one",
        expectedCheckinRevision: 1,
      }),
    ).resolves.toMatchObject({ intent });
    await api.getGeneration(intent.intent_ref);
    await expect(api.getToday()).resolves.toMatchObject({
      today: todayFixture,
    });
    await expect(api.getHistoryDay("2026-08-23")).resolves.toMatchObject({
      history: historyFixture,
    });

    expect(
      requests.slice(1).map(({ method, path }) => `${method} ${path}`),
    ).toEqual([
      "POST /v1/daily/generation/start",
      `GET /v1/daily/generation/${intent.intent_ref}`,
      "GET /v1/daily/today",
      "GET /v1/daily/by-date/2026-08-23",
    ]);
    expect(requests[1]).toMatchObject({
      body: {
        command_ref: "generation-command-one",
        expected_checkin_revision: 1,
      },
      headers: { "Idempotency-Key": "generation-command-one" },
    });
    expect(JSON.stringify(requests)).not.toMatch(
      /account_id|product_date|root_seed|safety_epoch/iu,
    );
  });

  it("rejects unknown/internal fields and preserves bounded retry guidance", async () => {
    const malformed = await authenticatedApi(
      [],
      [response(success({ ...todayFixture, seed: "forbidden" }))],
    );
    await expect(malformed.getToday()).rejects.toMatchObject({
      code: "CONTRACT_VIOLATION",
    });

    const unsupported = await authenticatedApi(
      [],
      [
        response(
          success({
            ...todayFixture,
            content: { ...todayFixture.content, schema_version: "2.0.0" },
          }),
        ),
      ],
    );
    await expect(unsupported.getToday()).rejects.toMatchObject({
      code: "CONTRACT_VIOLATION",
    });

    const pending = await authenticatedApi(
      [],
      [
        response(
          {
            error: {
              category: "TRANSIENT",
              code: "GENERATION_PENDING",
              details: { retry_after_seconds: 2 },
              message: "正在准备",
              message_key: "error.generation_pending",
              retryable: true,
            },
            ok: false,
            product_date: "2026-08-24",
            request_id: "request-c009",
            server_now: "2026-08-24T02:00:00.000Z",
          },
          503,
        ),
      ],
    );
    await expect(pending.getToday()).rejects.toEqual(
      new MiniappApiError(
        "GENERATION_PENDING",
        503,
        true,
        "request-c009",
        undefined,
        "2026-08-24",
        2,
      ),
    );

    const invalidDateRequests: NetworkRequest[] = [];
    const invalidDate = await authenticatedApi(invalidDateRequests, []);
    await expect(invalidDate.getHistoryDay("2026-02-30")).rejects.toMatchObject(
      { code: "CONTRACT_VIOLATION" },
    );
    expect(invalidDateRequests).toHaveLength(1);
  });
});
