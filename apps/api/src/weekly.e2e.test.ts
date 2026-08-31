import type { INestApplication } from "@nestjs/common";
import type { AuthStore, WeeklyStore } from "@daily-energy/server-adapters/api";
import type { ClientWeeklySummaryView } from "@daily-energy/shared-schemas";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "./bootstrap/create-api-application.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "./bootstrap/runtime-config.js";

const accountId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const sessionToken = "c013_public_session_token_000001";
const fixedNow = new Date("2026-08-24T12:00:00.000Z");
const dates = [
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
];

const view: ClientWeeklySummaryView = {
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
    state: "MISSING" as const,
  })),
  metrics: [
    "MORNING_MOOD",
    "MORNING_ENERGY",
    "MORNING_SLEEP",
    "EVENING_OVERALL",
  ].map((id) => ({
    direction: "INSUFFICIENT_DATA" as const,
    direction_label: "记录还不够形成方向",
    id: id as ClientWeeklySummaryView["metrics"][number]["id"],
    missing_count: 7,
    observed_count: 0,
    unsure_count: 0,
  })),
  projection_version: "weekly-view-v1",
  schema_version: "1.0.0",
  summary_status: "NOT_ELIGIBLE",
  window_end_date: dates[6]!,
  window_id: "weekly-window-example-v1",
  window_start_date: dates[0]!,
};

const authStore: AuthStore = {
  close: async () => undefined,
  establishSession: async () => Promise.reject(new Error("NOT_USED")),
  inspectSession: async () => ({
    session: {
      accountId,
      accountState: "ACTIVE",
      consentRequired: false,
      expiresAt: new Date("2026-09-24T00:00:00.000Z"),
      onboardingRequired: false,
      sessionId,
    },
    status: "ACTIVE",
  }),
  revokeSession: async () => "ACCEPTED",
  rotateSession: async () => Promise.reject(new Error("NOT_USED")),
};

const applications: INestApplication[] = [];
afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

function config() {
  return loadRuntimeConfig({
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_ENVIRONMENT: "CI",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "c013-http-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

async function app(store: WeeklyStore) {
  const application = await createApiApplication(config(), {
    authStore,
    ordinaryLogSink: { write() {} },
    productDateClock: { now: () => fixedNow },
    weeklyStore: store,
  });
  await application.listen(0, "127.0.0.1");
  applications.push(application);
  return application;
}

function authenticated(test: request.Test) {
  return test.set("Authorization", `Bearer ${sessionToken}`);
}

describe("C-013 HTTP weekly flow", () => {
  it("reads current and historical seven-day whitelist views", async () => {
    const requested: string[] = [];
    const application = await app({
      async close() {},
      async get(input) {
        requested.push(input.endProductDate);
        return { status: "FOUND", value: view };
      },
    });
    const current = await authenticated(
      request(application.getHttpServer()).get("/v1/weekly/current"),
    ).expect(200);
    await authenticated(
      request(application.getHttpServer()).get("/v1/weekly/window/2026-08-23"),
    ).expect(200);
    expect(requested).toEqual(["2026-08-24", "2026-08-23"]);
    expect(current.body.data).toMatchObject({
      contract: "weekly-summary-view",
      summary_status: "NOT_ELIGIBLE",
    });
    expect(JSON.stringify(current.body)).not.toMatch(
      /source_fingerprint|source_ref|raw_notes|daily_score|provider|model/iu,
    );
  });

  it("rejects malformed/future anchors and applies the Safety guard", async () => {
    const normal = await app({
      async close() {},
      async get() {
        return { status: "FOUND", value: view };
      },
    });
    await authenticated(
      request(normal.getHttpServer()).get("/v1/weekly/window/not-a-date"),
    ).expect(400);
    await authenticated(
      request(normal.getHttpServer()).get("/v1/weekly/window/2026-08-25"),
    ).expect(422);

    const blocked = await app({
      async close() {},
      async get() {
        return { status: "SAFETY_BLOCKED" };
      },
    });
    const response = await authenticated(
      request(blocked.getHttpServer()).get("/v1/weekly/current"),
    ).expect(409);
    expect(response.body.error.code).toBe("SAFETY_BLOCKED");
    expect(response.body.data).toBeUndefined();
  });
});
