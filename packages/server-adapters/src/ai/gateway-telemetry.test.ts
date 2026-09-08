import { describe, expect, it } from "vitest";

import type {
  MetricName,
  TelemetryAttributes,
} from "../telemetry/contracts.js";
import type { TelemetryRuntime } from "../telemetry/runtime.js";
import {
  createGatewayAttemptTelemetrySinkV1,
  createGatewayRoutingTelemetrySinkV1,
} from "./gateway-telemetry.js";

interface RecordedMetric {
  readonly attributes: TelemetryAttributes;
  readonly name: MetricName;
  readonly value: number;
}

function captureRuntime(): {
  readonly metrics: RecordedMetric[];
  readonly runtime: TelemetryRuntime;
} {
  const metrics: RecordedMetric[] = [];
  return {
    metrics,
    runtime: {
      beginSpan: () => ({ end() {} }),
      record: (name, value, attributes) => {
        metrics.push({ attributes, name, value });
      },
      shutdown: async () => undefined,
      startSpan: (_operationCode, _attributes, run) => run(),
    },
  };
}

describe("AI-002 low-cardinality Gateway telemetry", () => {
  it("records normalized known usage and cost without route identifiers", () => {
    const capture = captureRuntime();
    const sink = createGatewayAttemptTelemetrySinkV1(capture.runtime);
    sink.record({
      costCompleteness: "KNOWN",
      modelRevisionBucket: "CURRENT",
      outcomeCode: "SUCCEEDED",
      reasonCode: "NONE",
      role: "PRIMARY_AI",
      routeManifestVersion: "route-sensitive-v99",
      usage: {
        billedCostMicrounits: 41,
        inputUnits: 20,
        outputUnits: 7,
      },
      usageCompleteness: "KNOWN",
      workload: "DAILY_EXPRESSION_V1",
    });

    expect(capture.metrics.map(({ name, value }) => [name, value])).toEqual([
      ["dailyenergy_gateway_attempts_total", 1],
      ["dailyenergy_gateway_usage_units_total", 27],
      ["dailyenergy_gateway_cost_micros_total", 41],
    ]);
    expect(capture.metrics[0]?.attributes).toMatchObject({
      modelRevisionBucket: "CURRENT",
      operationCode: "GATEWAY_INVOKE",
      outcomeCode: "SUCCESS",
      providerCode: "PRIMARY",
      reasonCode: "NONE",
      workload: "DAILY",
    });
    expect(JSON.stringify(capture.metrics)).not.toContain(
      "route-sensitive-v99",
    );
  });

  it("records unknown usage and cost explicitly with stable reason buckets", () => {
    const capture = captureRuntime();
    const sink = createGatewayAttemptTelemetrySinkV1(capture.runtime);
    sink.record({
      costCompleteness: "UNKNOWN",
      modelRevisionBucket: "UNKNOWN",
      outcomeCode: "OUTCOME_UNKNOWN",
      reasonCode: "PROVIDER_RESPONSE_TIMEOUT",
      role: "BACKUP_AI",
      routeManifestVersion: "route-v1",
      usage: {
        billedCostMicrounits: null,
        inputUnits: null,
        outputUnits: null,
      },
      usageCompleteness: "UNKNOWN",
      workload: "WEEKLY_EXPRESSION_V1",
    });

    expect(capture.metrics.map(({ name }) => name)).toEqual([
      "dailyenergy_gateway_attempts_total",
      "dailyenergy_gateway_usage_unknown_total",
      "dailyenergy_cost_unknown_total",
    ]);
    expect(capture.metrics[1]?.attributes).toMatchObject({
      outcomeCode: "UNKNOWN",
      providerCode: "BACKUP",
      reasonCode: "DEPENDENCY_UNAVAILABLE",
      workload: "WEEKLY",
    });
  });

  it("separates a breaker skip from the final no-result routing decision", () => {
    const capture = captureRuntime();
    const sink = createGatewayRoutingTelemetrySinkV1(capture.runtime);
    sink.record({
      outcomeCode: "FALLBACK",
      reasonCode: "CIRCUIT_OPEN",
      role: "PRIMARY_AI",
      routeManifestVersion: "route-v1",
      workload: "DAILY_EXPRESSION_V1",
    });
    sink.record({
      outcomeCode: "FALLBACK",
      reasonCode: "PROVIDER_PATHS_EXHAUSTED",
      routeManifestVersion: "route-v1",
      workload: "DAILY_EXPRESSION_V1",
    });

    expect(capture.metrics.map(({ name }) => name)).toEqual([
      "dailyenergy_gateway_breaker_state",
      "dailyenergy_gateway_invocations_total",
      "dailyenergy_gateway_generation_mode_total",
    ]);
    expect(capture.metrics[1]?.attributes).toMatchObject({
      generationMode: "NO_RESULT",
      outcomeCode: "RETRYABLE",
      workload: "DAILY",
    });
  });

  it("records a validated template as success with one bounded fallback reason", () => {
    const capture = captureRuntime();
    const sink = createGatewayRoutingTelemetrySinkV1(capture.runtime);
    sink.record({
      outcomeCode: "CANDIDATE",
      reasonCode: "BREAKER_STATE_UNAVAILABLE",
      role: "CONTROLLED_TEMPLATE",
      routeManifestVersion: "route-sensitive-v99",
      workload: "DAILY_EXPRESSION_V1",
    });

    expect(capture.metrics.map(({ name }) => name)).toEqual([
      "dailyenergy_gateway_fallbacks_total",
      "dailyenergy_gateway_invocations_total",
      "dailyenergy_gateway_generation_mode_total",
    ]);
    expect(capture.metrics[0]?.attributes).toEqual({
      operationCode: "GATEWAY_INVOKE",
      outcomeCode: "SUCCESS",
      reasonCode: "BREAKER_STATE_UNAVAILABLE",
      workload: "DAILY",
    });
    expect(capture.metrics[1]?.attributes).toMatchObject({
      generationMode: "CONTROLLED_TEMPLATE",
      outcomeCode: "SUCCESS",
      workload: "DAILY",
    });
    expect(JSON.stringify(capture.metrics)).not.toContain(
      "route-sensitive-v99",
    );
  });
});
