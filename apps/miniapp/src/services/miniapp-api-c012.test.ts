import { describe, expect, it } from "vitest";

import { emptyView } from "../features/evening/evening-fixture.js";
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
    request_id: "request-c012",
    server_now: "2026-08-24T12:00:00.000Z",
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

describe("C-012 miniapp evening API bridge", () => {
  it("sends the closed coordinated request without owner or guard fields", async () => {
    const requests: NetworkRequest[] = [];
    const api = await authenticatedApi(requests, [
      response(success(emptyView)),
      response(success(emptyView)),
    ]);
    await expect(api.getEvening()).resolves.toMatchObject({
      evening: emptyView,
    });
    await api.saveEvening({
      commandRef: "evening-command-one",
      expectedFeedbackRevision: 0,
      expectedHelpfulnessRevision: 0,
      helpfulnessRating: "HELPFUL",
      notePatch: { operation: "SET", value: "今天把最难的一步拆小了。" },
      overallFeeling: "STEADY",
      productDate: "2026-08-24",
      taskPatch: {
        expectedRevision: 1,
        status: "COMPLETED",
        taskRef: "task.close-one-distraction.v1",
      },
    });
    expect(requests[2]).toMatchObject({
      headers: { "Idempotency-Key": "evening-command-one" },
      method: "POST",
      path: "/v1/evening/save",
      body: {
        command_ref: "evening-command-one",
        product_date: "2026-08-24",
        expected_feedback_revision: 0,
        expected_helpfulness_revision: 0,
        overall_feeling: "STEADY",
        helpfulness_rating: "HELPFUL",
      },
    });
    expect(JSON.stringify(requests)).not.toMatch(
      /account_id|session_id|guard|epoch|safety|relationship/iu,
    );
  });
});
