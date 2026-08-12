import { describe, expect, it } from "vitest";

import { createActiveSeriesRegistry } from "./active-series.js";
import { metricActiveSeriesLimit } from "./contracts.js";

describe("active telemetry series registry", () => {
  it("accepts duplicate observations without consuming another series slot", () => {
    const registry = createActiveSeriesRegistry();

    expect(
      registry.accept("dailyenergy_http_server_requests_total", "series-a"),
    ).toBe(true);
    expect(
      registry.accept("dailyenergy_http_server_requests_total", "series-a"),
    ).toBe(true);
  });

  it("rejects a new series after the per-metric active limit", () => {
    const registry = createActiveSeriesRegistry();
    const metric = "dailyenergy_http_server_requests_total" as const;
    const limit = metricActiveSeriesLimit(metric);

    for (let index = 0; index < limit; index += 1) {
      expect(registry.accept(metric, `series-${index}`)).toBe(true);
    }

    expect(registry.accept(metric, "series-over-limit")).toBe(false);
    expect(registry.accept(metric, "series-0")).toBe(true);
  });

  it("keeps series limits independent for different metrics", () => {
    const registry = createActiveSeriesRegistry();
    const first = "dailyenergy_http_server_requests_total" as const;

    for (let index = 0; index < metricActiveSeriesLimit(first); index += 1) {
      expect(registry.accept(first, `series-${index}`)).toBe(true);
    }

    expect(
      registry.accept("dailyenergy_queue_jobs_total", "independent-series"),
    ).toBe(true);
  });
});
