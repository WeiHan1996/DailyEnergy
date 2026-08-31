import { describe, expect, it } from "vitest";

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
    product_date: "2026-08-21",
    request_id: "request-one",
    server_now: "2026-08-21T00:00:00.000Z",
  };
}

describe("C-003 miniapp API bridge", () => {
  it("binds the in-memory session and both idempotency identities", async () => {
    const requests: NetworkRequest[] = [];
    const replies = [
      response(
        success({
          account_id: "must-not-cross-client-projection",
          account_state: "ACTIVE",
          consent_required: true,
          expires_at: "2026-09-20T00:00:00.000Z",
          onboarding_required: true,
          refresh_after: "2026-09-05T00:00:00.000Z",
          session_token: "s".repeat(43),
        }),
      ),
      response(
        success({
          notice_version: "notice-v1",
          state: "MISSING",
        }),
      ),
      response(
        success({
          command_ref: "consent-command-one",
          operation: "CONSENT_ACCEPT",
          outcome: "ACCEPTED",
        }),
      ),
      response(
        success({
          expression_style: "BALANCED",
          onboarding_completed: true,
          revision: 1,
          updated_at: "2026-08-21T00:00:00.000Z",
        }),
      ),
    ];
    const network: NetworkPort = {
      request: async <T>(request: NetworkRequest) => {
        requests.push(request);
        return replies.shift()! as NetworkResponse<T>;
      },
    };
    const api = createMiniappApi(network);
    const created = await api.createSession({ code: "wechat-code" });
    await api.getConsent();
    await api.acceptConsent({
      commandRef: "consent-command-one",
      noticeVersion: "notice-v1",
    });
    await api.completeOnboarding({
      commandRef: "onboarding-command-one",
      expressionStyle: "BALANCED",
    });

    expect(requests[0]?.headers).not.toHaveProperty("Authorization");
    expect(created.session).not.toHaveProperty("account_id");
    expect(requests[1]?.headers?.Authorization).toBe(
      `Bearer ${"s".repeat(43)}`,
    );
    expect(requests[2]).toMatchObject({
      body: {
        command_ref: "consent-command-one",
        notice_version: "notice-v1",
      },
      headers: { "Idempotency-Key": "consent-command-one" },
    });
    expect(requests[3]).toMatchObject({
      body: {
        command_ref: "onboarding-command-one",
        expression_style: "BALANCED",
      },
      headers: { "Idempotency-Key": "onboarding-command-one" },
    });
    expect(requests[3]?.body).not.toHaveProperty("preferred_name");
  });

  it("fails closed on malformed success and preserves a valid Safety view", async () => {
    const malformed = createMiniappApi({
      request: async <T>() =>
        response(success({ onboarding_completed: true })) as NetworkResponse<T>,
    });
    await expect(
      malformed.createSession({ code: "wechat-code" }),
    ).rejects.toEqual(new MiniappApiError("CONTRACT_VIOLATION", 200, false));

    const missingEnvelopeMetadata = createMiniappApi({
      request: async <T>() =>
        response({
          data: {
            account_state: "ACTIVE",
            consent_required: true,
            expires_at: "2026-09-20T00:00:00.000Z",
            onboarding_required: true,
            refresh_after: "2026-09-05T00:00:00.000Z",
            session_token: "s".repeat(43),
          },
          ok: true,
          product_date: "2026-08-21",
        }) as NetworkResponse<T>,
    });
    await expect(
      missingEnvelopeMetadata.createSession({ code: "wechat-code" }),
    ).rejects.toMatchObject({ code: "CONTRACT_VIOLATION" });

    const safety = {
      blocks: [
        {
          block_id: "direct-v1",
          copy: "请先联系现实帮助。",
          kind: "DIRECT_ACKNOWLEDGEMENT",
          resources: [],
        },
      ],
      response_bundle_version: "response-v1",
      revision: 1,
      state: "ACTIVE",
      updated_at: "2026-08-21T00:00:00.000Z",
    } as const;
    const diverted = createMiniappApi({
      request: async <T>() =>
        response(
          {
            error: {
              code: "SAFETY_OVERLAY",
              message: "fixed",
              message_key: "safety.overlay",
              retryable: false,
              safety_view: safety,
            },
            ok: false,
            request_id: "request-one",
          },
          409,
        ) as NetworkResponse<T>,
    });
    await expect(
      diverted.createSession({ code: "wechat-code" }),
    ).rejects.toMatchObject({
      code: "SAFETY_OVERLAY",
      safetyView: safety,
      status: 409,
    });

    const invalidResource = createMiniappApi({
      request: async <T>() =>
        response(
          {
            error: {
              code: "SAFETY_OVERLAY",
              retryable: false,
              safety_view: {
                ...safety,
                blocks: [
                  {
                    ...safety.blocks[0],
                    resources: [
                      {
                        action: "UNREVIEWED_ACTION",
                        label: "invalid",
                        resource_ref: "resource-one",
                        target: "invalid",
                      },
                    ],
                  },
                ],
              },
            },
            ok: false,
            request_id: "request-one",
          },
          409,
        ) as NetworkResponse<T>,
    });
    await expect(
      invalidResource.createSession({ code: "wechat-code" }),
    ).rejects.toMatchObject({
      code: "SAFETY_OVERLAY",
      safetyView: undefined,
    });
  });
});

describe("C-004 miniapp API bridge", () => {
  it("sends only closed check-in fields with the matching idempotency key", async () => {
    const requests: NetworkRequest[] = [];
    const checkin = {
      checkin_ref: "11111111-1111-4111-8111-111111111111",
      energy: "STEADY",
      mood: "GOOD",
      product_date: "2026-08-21",
      revision: 1,
      sleep: "OKAY",
      updated_at: "2026-08-21T00:00:00.000Z",
      write_window: "OPEN",
    };
    const replies = [
      response(
        success({
          account_state: "ACTIVE",
          consent_required: false,
          expires_at: "2026-09-20T00:00:00.000Z",
          onboarding_required: false,
          refresh_after: "2026-09-05T00:00:00.000Z",
          session_token: "s".repeat(43),
        }),
      ),
      response(success(checkin)),
      response(success(checkin)),
      response(success({ ...checkin, revision: 2 })),
    ];
    const api = createMiniappApi({
      request: async <T>(request: NetworkRequest) => {
        requests.push(request);
        return replies.shift()! as NetworkResponse<T>;
      },
    });
    await api.createSession({ code: "wechat-code" });
    await api.getTodayCheckin();
    await api.submitCheckin({
      commandRef: "checkin-command-0001",
      energy: "STEADY",
      mood: "GOOD",
      sleep: "OKAY",
    });
    await api.correctCheckin({
      commandRef: "checkin-correct-0001",
      energy: "HIGH",
      expectedRevision: 1,
      mood: "LIGHT",
      sleep: "GOOD",
    });

    expect(requests[1]).toMatchObject({
      method: "GET",
      path: "/v1/daily/today/checkin",
    });
    expect(requests[2]).toMatchObject({
      body: {
        command_ref: "checkin-command-0001",
        energy: "STEADY",
        expected_revision: 0,
        mood: "GOOD",
        sleep: "OKAY",
      },
      headers: { "Idempotency-Key": "checkin-command-0001" },
      path: "/v1/daily/checkin/submit",
    });
    expect(requests[2]?.body).not.toHaveProperty("product_date");
    expect(requests[2]?.body).not.toHaveProperty("account_id");
    expect(requests[3]).toMatchObject({
      body: {
        command_ref: "checkin-correct-0001",
        expected_revision: 1,
      },
      headers: { "Idempotency-Key": "checkin-correct-0001" },
      path: "/v1/daily/checkin/correct",
    });
  });

  it("preserves the authoritative date on an absent-record error", async () => {
    const api = createMiniappApi({
      request: async <T>() =>
        response(
          {
            error: {
              code: "RESOURCE_NOT_FOUND",
              retryable: false,
            },
            ok: false,
            product_date: "2026-08-21",
            request_id: "request-one",
            server_now: "2026-08-21T00:00:00.000Z",
          },
          404,
        ) as NetworkResponse<T>,
    });
    await expect(api.getTodayCheckin()).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      productDate: "2026-08-21",
    });
  });

  it("rejects malformed or internal check-in response fields", async () => {
    const api = createMiniappApi({
      request: async <T>() =>
        response(
          success({
            account_id: "internal",
            checkin_ref: "not-a-checkin",
            energy: "STEADY",
            mood: "GOOD",
            product_date: "2026-08-21",
            revision: 1,
            sleep: "OKAY",
            updated_at: "2026-08-21T00:00:00.000Z",
            write_window: "OPEN",
          }),
        ) as NetworkResponse<T>,
    });
    await expect(api.getTodayCheckin()).rejects.toMatchObject({
      code: "CONTRACT_VIOLATION",
    });
  });
});
