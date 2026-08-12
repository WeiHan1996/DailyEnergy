import { describe, expect, it, vi } from "vitest";

import type { TelemetryTransportConfig } from "@daily-energy/server-adapters/api";

import { NOOP_TELEMETRY_RUNTIME } from "./api-telemetry.js";
import { startApiTelemetrySafely } from "./telemetry-startup.js";

const config: TelemetryTransportConfig = {
  configSchemaVersion: "api-runtime-config-v1",
  contractBundleVersion: "api-contract-v1",
  enabled: true,
  environment: "CI",
  metricsHost: "127.0.0.1",
  metricsPort: 9464,
  otlpTraceUrl: "http://127.0.0.1:4318/v1/traces",
  releaseId: "synthetic-release-v1",
  serviceVersion: "0.1.0",
};

describe("API telemetry startup", () => {
  it("degrades to the no-op runtime when telemetry initialization fails", () => {
    const start = vi.fn(() => {
      throw new Error("synthetic exporter initialization failure");
    });

    const runtime = startApiTelemetrySafely(start, config);

    expect(runtime).toBe(NOOP_TELEMETRY_RUNTIME);
    expect(() =>
      runtime.startSpan(
        "HEALTH_READY",
        {
          operationCode: "HEALTH_READY",
          outcomeCode: "SUCCESS",
        },
        () => "business-outcome",
      ),
    ).not.toThrow();
    expect(start).toHaveBeenCalledOnce();
  });
});
