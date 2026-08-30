import { describe, expect, it } from "vitest";

import {
  AnalyticsEventNameValues,
  AnalyticsEventRegistry,
  AnalyticsProjectionV1Schema,
  ClientAnalyticsSignalRequestSchema,
  MetricGateIdValues,
  MetricIdValues,
  MetricReportV1Schema,
  ResearchMetricIdValues,
} from "../src/index.js";

const baseProjection = {
  environment: "PROD",
  event_schema_version: 1,
  product_date: "2026-08-30",
  product_date_policy_version: "product-date-v1",
  server_received_at: "2026-08-30T08:00:00.000Z",
} as const;

describe("C-015 analytics executable contracts", () => {
  it("registers exactly 58 unique events across the four isolated planes", () => {
    expect(AnalyticsEventNameValues).toHaveLength(58);
    expect(new Set(AnalyticsEventNameValues)).toHaveLength(58);
    expect(Object.keys(AnalyticsEventRegistry)).toEqual(
      expect.arrayContaining([...AnalyticsEventNameValues]),
    );
    expect(
      new Set(Object.values(AnalyticsEventRegistry).map(({ id }) => id)),
    ).toHaveLength(58);
    expect(
      new Set(Object.values(AnalyticsEventRegistry).map(({ plane }) => plane)),
    ).toEqual(new Set(["PRODUCT", "RUNTIME", "GOVERNANCE", "SAFETY_CONTROL"]));
    expect(
      Object.values(AnalyticsEventRegistry).filter(
        ({ kind }) => kind === "CLIENT_SIGNAL",
      ),
    ).toHaveLength(8);
  });

  it("rejects unknown fields, wrong planes, unknown properties and enum drift", () => {
    expect(() =>
      AnalyticsProjectionV1Schema.parse({
        ...baseProjection,
        event_name: "day_lit",
        extra: "must-not-survive",
        plane: "PRODUCT",
      }),
    ).toThrow();
    expect(() =>
      AnalyticsProjectionV1Schema.parse({
        ...baseProjection,
        event_name: "day_lit",
        plane: "SAFETY_CONTROL",
      }),
    ).toThrow();
    expect(() =>
      AnalyticsProjectionV1Schema.parse({
        ...baseProjection,
        event_name: "day_lit",
        event_properties: { account_ref: "forbidden" },
        plane: "PRODUCT",
      }),
    ).toThrow();
    expect(() =>
      AnalyticsProjectionV1Schema.parse({
        ...baseProjection,
        event_name: "daily_result_available",
        event_properties: { generation_mode: "provider-model-name" },
        plane: "PRODUCT",
      }),
    ).toThrow();
  });

  it("accepts only eight first-party best-effort signals without identity or dates", () => {
    expect(
      ClientAnalyticsSignalRequestSchema.parse({
        app_version: "1.4.2",
        event_name: "landing_viewed",
        event_schema_version: 1,
        locale: "zh-CN",
        scene_code: "CHANNEL_LANDING",
        surface_version_bucket: "LANDING_V1",
      }),
    ).toMatchObject({ event_name: "landing_viewed" });
    for (const forbidden of [
      "account_ref",
      "device_ref",
      "session_ref",
      "product_date",
      "client_timestamp",
      "text",
    ]) {
      expect(() =>
        ClientAnalyticsSignalRequestSchema.parse({
          app_version: "1.4.2",
          event_name: "main_action_reached",
          event_schema_version: 1,
          locale: "zh-CN",
          [forbidden]: "forbidden",
        }),
      ).toThrow();
    }
    expect(() =>
      ClientAnalyticsSignalRequestSchema.parse({
        app_version: "1.4.2",
        event_name: "day_lit",
        event_schema_version: 1,
        locale: "zh-CN",
      }),
    ).toThrow();
  });

  it("registers 23 metrics and four Gates while research metrics stay unavailable", () => {
    expect(MetricIdValues).toHaveLength(23);
    expect(MetricGateIdValues).toEqual([
      "S25-G01",
      "S25-G02",
      "S25-G03",
      "S25-G04",
    ]);
    expect(ResearchMetricIdValues).toEqual(["S25-Q01", "S25-Q02"]);
  });

  it("never exposes exact values for suppressed, blocked or unavailable metrics", () => {
    const base = {
      aggregation_revision: 1,
      dimensions: [],
      expires_at: "2027-09-30T00:00:00.000Z",
      generated_at: "2026-08-30T08:00:00.000Z",
      metric_id: "S25-M07",
      metric_version: 1,
      notes_code: ["POST_AGGREGATION_DELETION_NOT_RESTATED"],
      period_or_cohort: "2026-08-20",
      source_contract_version: "s25-metrics-v1",
    } as const;
    expect(
      MetricReportV1Schema.parse({ ...base, status: "SUPPRESSED" }),
    ).toMatchObject({ status: "SUPPRESSED" });
    expect(() =>
      MetricReportV1Schema.parse({
        ...base,
        denominator: 9,
        numerator: 7,
        status: "SUPPRESSED",
        value: 7 / 9,
      }),
    ).toThrow();
    expect(() =>
      MetricReportV1Schema.parse({
        ...base,
        denominator: 9,
        numerator: 7,
        status: "FINALIZED",
        value: 7 / 9,
      }),
    ).toThrow();
    expect(
      MetricReportV1Schema.parse({
        ...base,
        denominator: 20,
        numerator: 7,
        status: "FINALIZED",
        value: 0.35,
      }),
    ).toMatchObject({ denominator: 20, numerator: 7, value: 0.35 });
  });
});
