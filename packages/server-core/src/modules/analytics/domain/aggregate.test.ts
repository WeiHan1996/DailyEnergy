import { describe, expect, it } from "vitest";

import {
  assertNoForbiddenAnalyticsContent,
  publishAnonymousDailyAggregates,
  type TransientAnalyticsObservation,
} from "./aggregate.js";

function authorityObservation(
  subjectKey: string,
  generationMode: "AI" | "CONTROLLED_TEMPLATE" | "NO_GENERATION",
  appVersion = "1.4",
): TransientAnalyticsObservation {
  return {
    projection: {
      app_version_bucket: appVersion,
      environment: "PROD",
      event_name: "daily_result_available",
      event_properties: {
        cache_outcome: "MISS",
        generation_mode: generationMode,
        latency_bucket: "1_2_99S",
      },
      event_schema_version: 1,
      locale_bucket: "ZH_CN",
      plane: "PRODUCT",
      product_date: "2026-08-30",
      product_date_policy_version: "product-date-v1",
      server_received_at: "2026-08-30T08:00:00.000Z",
    },
    subjectKey,
  };
}

const publish = (
  observations: readonly TransientAnalyticsObservation[],
  dimensions: readonly {
    readonly name: string;
    readonly rareValueParent?: "OTHER";
  }[] = [],
) =>
  publishAnonymousDailyAggregates({
    aggregationRevision: 4,
    dimensions,
    generatedAt: new Date("2026-08-30T10:00:00.000Z"),
    observations,
    sourceContractVersion: "s24-events-v1",
  });

describe("C-015 T0 to T4 anonymous aggregation", () => {
  it("publishes one identity-free overall cell at k=10", () => {
    const output = publish(
      Array.from({ length: 10 }, (_, index) =>
        authorityObservation(`transient-owner-${index}`, "AI"),
      ),
    );
    expect(output).toEqual([
      expect.objectContaining({
        aggregation_revision: 4,
        dimensions: [],
        event_count: 10,
        expires_at: "2027-09-30T00:00:00.000Z",
        unique_owner_count: 10,
      }),
    ]);
    expect(JSON.stringify(output)).not.toMatch(/transient-owner/u);
  });

  it("merges rare enum values to OTHER before suppressing a partition", () => {
    const output = publish(
      [
        ...Array.from({ length: 10 }, (_, index) =>
          authorityObservation(`ai-${index}`, "AI"),
        ),
        ...Array.from({ length: 5 }, (_, index) =>
          authorityObservation(`template-${index}`, "CONTROLLED_TEMPLATE"),
        ),
        ...Array.from({ length: 5 }, (_, index) =>
          authorityObservation(`no-generation-${index}`, "NO_GENERATION"),
        ),
      ],
      [{ name: "generation_mode", rareValueParent: "OTHER" }],
    );
    expect(output.map(({ dimensions }) => dimensions)).toEqual([
      [{ code: "AI", name: "generation_mode" }],
      [{ code: "OTHER", name: "generation_mode" }],
    ]);
  });

  it("drops the second dimension globally when it would expose sparse cells", () => {
    const observations = Array.from({ length: 20 }, (_, index) =>
      authorityObservation(
        `owner-${index}`,
        index < 10 ? "AI" : "CONTROLLED_TEMPLATE",
        index % 2 === 0 ? "1.4" : "1.5",
      ),
    );
    const output = publish(observations, [
      { name: "generation_mode" },
      { name: "app_version_bucket" },
    ]);
    expect(output).toHaveLength(2);
    expect(output.every(({ dimensions }) => dimensions.length === 1)).toBe(
      true,
    );
  });

  it("suppresses an overall cell below k without persisting a partial count", () => {
    expect(
      publish(
        Array.from({ length: 9 }, (_, index) =>
          authorityObservation(`owner-${index}`, "AI"),
        ),
      ),
    ).toEqual([]);
  });

  it("allows client event counts but never invents unique owners", () => {
    const observation = authorityObservation("unused", "AI");
    const clientObservation = {
      projection: {
        ...observation.projection,
        event_name: "main_action_reached" as const,
        event_properties: undefined,
      },
    };
    const output = publish(Array.from({ length: 10 }, () => clientObservation));
    expect(output[0]).toMatchObject({ event_count: 10 });
    expect(output[0]).not.toHaveProperty("unique_owner_count");
  });

  it("rejects mixed identity modes, a third dimension and forbidden output fields", () => {
    const authority = authorityObservation("owner", "AI");
    expect(() =>
      publish([authority, { projection: authority.projection }]),
    ).toThrow("ANALYTICS_IDENTITY_MODE_MIXED");
    expect(() =>
      publish(
        Array.from({ length: 10 }, () => authority),
        [
          { name: "generation_mode" },
          { name: "cache_outcome" },
          { name: "latency_bucket" },
        ],
      ),
    ).toThrow("ANALYTICS_DIMENSION_LIMIT");
    expect(() =>
      assertNoForbiddenAnalyticsContent({ account_ref: "forbidden" }),
    ).toThrow("ANALYTICS_FORBIDDEN_FIELD");
  });
});
