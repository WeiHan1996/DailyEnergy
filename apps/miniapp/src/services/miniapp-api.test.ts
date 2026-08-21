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
