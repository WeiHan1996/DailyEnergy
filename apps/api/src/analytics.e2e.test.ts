import type { INestApplication } from "@nestjs/common";
import type {
  AnalyticsAggregateStore,
  ClientAggregateDelta,
} from "@daily-energy/server-adapters/api";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "./bootstrap/create-api-application.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "./bootstrap/runtime-config.js";

const fixedNow = new Date("2026-08-30T08:00:00.000Z");

class RecordingAnalyticsStore implements AnalyticsAggregateStore {
  readonly deltas: ClientAggregateDelta[] = [];
  fail = false;

  public async publishClientSignalDelta(
    input: ClientAggregateDelta,
  ): Promise<void> {
    if (this.fail) {
      throw new Error("synthetic unavailable");
    }
    this.deltas.push(input);
  }

  public async close(): Promise<void> {}
}

const applications: INestApplication[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
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
    DAILYENERGY_RELEASE_ID: "c015-http-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

async function app(store: AnalyticsAggregateStore) {
  const application = await createApiApplication(config(), {
    analyticsAggregateStore: store,
    productDateClock: { now: () => fixedNow },
  });
  await application.listen(0, "127.0.0.1");
  applications.push(application);
  return application;
}

const signal = {
  app_version: "1.4.2",
  event_name: "landing_viewed",
  event_schema_version: 1,
  locale: "zh-CN",
  scene_code: "CHANNEL_LANDING",
  surface_version_bucket: "LANDING_V1",
} as const;

describe("C-015 first-party analytics signal endpoint", () => {
  it("keeps sub-k counts in memory and publishes only after the tenth signal", async () => {
    const store = new RecordingAnalyticsStore();
    const application = await app(store);
    for (let index = 0; index < 9; index += 1) {
      await request(application.getHttpServer())
        .post("/v1/analytics/signals")
        .send(signal)
        .expect(202);
    }
    expect(store.deltas).toEqual([]);
    const accepted = await request(application.getHttpServer())
      .post("/v1/analytics/signals")
      .send(signal)
      .expect(202);
    expect(accepted.body).toMatchObject({
      data: { accepted: true },
      ok: true,
      product_date: "2026-08-30",
      product_date_policy_version: "product-date-v1",
      server_now: fixedNow.toISOString(),
    });
    expect(store.deltas).toEqual([
      expect.objectContaining({
        dimensions: [
          { code: "CHANNEL_LANDING", name: "scene_code" },
          { code: "LANDING_V1", name: "surface_version_bucket" },
        ],
        environment: "TEST",
        eventCountDelta: 10,
        eventName: "landing_viewed",
        productDate: "2026-08-30",
      }),
    ]);
    await request(application.getHttpServer())
      .post("/v1/analytics/signals")
      .send(signal)
      .expect(202);
    expect(store.deltas[1]).toMatchObject({ eventCountDelta: 1 });
  });

  it("rejects identity, client date, arbitrary properties and authority facts", async () => {
    const application = await app(new RecordingAnalyticsStore());
    for (const body of [
      { ...signal, account_ref: "forbidden" },
      { ...signal, product_date: "2020-01-01" },
      { ...signal, properties: { anything: "forbidden" } },
      {
        app_version: "1.4.2",
        event_name: "day_lit",
        event_schema_version: 1,
        locale: "zh-CN",
      },
    ]) {
      const response = await request(application.getHttpServer())
        .post("/v1/analytics/signals")
        .send(body)
        .expect(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(JSON.stringify(response.body)).not.toMatch(
        /account_ref|anything|2020-01-01/iu,
      );
    }
  });

  it("drops a failed best-effort publish and does not ask the client to replay", async () => {
    const store = new RecordingAnalyticsStore();
    store.fail = true;
    const application = await app(store);
    for (let index = 0; index < 10; index += 1) {
      const response = await request(application.getHttpServer())
        .post("/v1/analytics/signals")
        .send({
          app_version: "1.4.2",
          event_name: "main_action_reached",
          event_schema_version: 1,
          locale: "zh-CN",
        })
        .expect(202);
      expect(response.body.data).toEqual({ accepted: true });
    }
    expect(store.deltas).toEqual([]);
  });
});
