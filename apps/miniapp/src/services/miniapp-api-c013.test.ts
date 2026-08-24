import { describe, expect, it } from "vitest";

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
    request_id: "request-c013",
    server_now: "2026-08-24T12:00:00.000Z",
  };
}

function emptyWeekly() {
  const dates = [
    "2026-08-18",
    "2026-08-19",
    "2026-08-20",
    "2026-08-21",
    "2026-08-22",
    "2026-08-23",
    "2026-08-24",
  ];
  return {
    activity: {
      helpfulness: {
        helpful_count: 0,
        neutral_count: 0,
        not_helpful_count: 0,
        not_used_count: 0,
        rated_day_count: 0,
        unrated_day_count: 7,
      },
      lit_day_count: 0,
      tasks: {
        completed_count: 0,
        interested_count: 0,
        skipped_count: 0,
        task_offered_day_count: 0,
        unmarked_count: 0,
      },
    },
    contract: "weekly-summary-view",
    coverage: {
      checkin_day_count: 0,
      evening_feedback_day_count: 0,
      level: "EMPTY",
      lit_day_count: 0,
      missing_dates: dates,
      real_state_day_count: 0,
      window_day_count: 7,
    },
    data_disclosure: "基于 0 天真实状态；7 个日期没有记录，未做推断或补齐。",
    days: dates.map((product_date) => ({
      is_lit: false,
      product_date,
      state: "MISSING",
    })),
    metrics: [
      "MORNING_MOOD",
      "MORNING_ENERGY",
      "MORNING_SLEEP",
      "EVENING_OVERALL",
    ].map((id) => ({
      direction: "INSUFFICIENT_DATA",
      direction_label: "记录还不够形成方向",
      id,
      missing_count: 7,
      observed_count: 0,
      unsure_count: 0,
    })),
    projection_version: "weekly-view-v1",
    schema_version: "1.0.0",
    summary_status: "NOT_ELIGIBLE",
    window_end_date: dates[6],
    window_id: "weekly-window-example-v1",
    window_start_date: dates[0],
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

describe("C-013 miniapp weekly API bridge", () => {
  it("uses only the two authenticated GET paths", async () => {
    const requests: NetworkRequest[] = [];
    const weekly = emptyWeekly();
    const api = await authenticatedApi(requests, [
      response(success(weekly)),
      response(success(weekly)),
    ]);
    await api.getWeeklyCurrent();
    await api.getWeeklyWindow("2026-08-23");
    expect(requests.slice(1)).toMatchObject([
      { method: "GET", path: "/v1/weekly/current" },
      { method: "GET", path: "/v1/weekly/window/2026-08-23" },
    ]);
    expect(JSON.stringify(requests)).not.toMatch(
      /account_id|guard|epoch|source|note|score/iu,
    );
  });

  it("rejects an internal weekly field instead of rendering it", async () => {
    const requests: NetworkRequest[] = [];
    const api = await authenticatedApi(requests, [
      response(success({ ...emptyWeekly(), source_fingerprint: "forbidden" })),
    ]);
    await expect(api.getWeeklyCurrent()).rejects.toMatchObject({
      code: "CONTRACT_VIOLATION",
    });
  });
});
