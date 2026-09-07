import type {
  GatewayAttemptTelemetrySinkV1,
  GatewayRoutingTelemetrySinkV1,
} from "@daily-energy/server-core/ai-gateway/spi";

import type {
  TelemetryAttributes,
  TelemetryOutcomeCode,
  TelemetryReasonCode,
} from "../telemetry/contracts.js";
import type { TelemetryRuntime } from "../telemetry/runtime.js";

const DIRECT_REASON_CODES = new Set<TelemetryReasonCode>([
  "BREAKER_STATE_UNAVAILABLE",
  "BUDGET_HARD_LIMIT",
  "COST_UNKNOWN",
  "MODEL_MISMATCH",
  "NONE",
  "PRICE_CATALOG_STALE",
  "RATE_LIMITED",
]);
type GatewayAttemptTelemetryEventV1 = Parameters<
  GatewayAttemptTelemetrySinkV1["record"]
>[0];
type GatewayRoutingTelemetryEventV1 = Parameters<
  GatewayRoutingTelemetrySinkV1["record"]
>[0];

export function createGatewayAttemptTelemetrySinkV1(
  runtime: TelemetryRuntime,
): GatewayAttemptTelemetrySinkV1 {
  return Object.freeze({
    record(event: GatewayAttemptTelemetryEventV1): void {
      const attributes: TelemetryAttributes = {
        modelRevisionBucket: event.modelRevisionBucket,
        operationCode: "GATEWAY_INVOKE",
        outcomeCode: attemptOutcome(event.outcomeCode),
        providerCode: providerCode(event.role),
        reasonCode: reasonCode(event.reasonCode),
        workload: workload(event.workload),
      };
      runtime.record("dailyenergy_gateway_attempts_total", 1, attributes);
      if (
        event.usageCompleteness === "KNOWN" &&
        event.usage.inputUnits !== null &&
        event.usage.outputUnits !== null
      ) {
        runtime.record(
          "dailyenergy_gateway_usage_units_total",
          event.usage.inputUnits + event.usage.outputUnits,
          attributes,
        );
      } else {
        runtime.record(
          "dailyenergy_gateway_usage_unknown_total",
          1,
          attributes,
        );
      }
      if (
        event.costCompleteness === "KNOWN" &&
        event.usage.billedCostMicrounits !== null
      ) {
        runtime.record(
          "dailyenergy_gateway_cost_micros_total",
          event.usage.billedCostMicrounits,
          attributes,
        );
      } else {
        runtime.record("dailyenergy_cost_unknown_total", 1, attributes);
      }
      if (
        event.outcomeCode === "INVALID_SCHEMA" ||
        event.outcomeCode === "UNSAFE"
      ) {
        runtime.record(
          "dailyenergy_gateway_candidate_validation_total",
          1,
          attributes,
        );
      }
    },
  });
}

export function createGatewayRoutingTelemetrySinkV1(
  runtime: TelemetryRuntime,
): GatewayRoutingTelemetrySinkV1 {
  return Object.freeze({
    record(event: GatewayRoutingTelemetryEventV1): void {
      if (event.role !== undefined && event.reasonCode === "CIRCUIT_OPEN") {
        runtime.record("dailyenergy_gateway_breaker_state", 1, {
          operationCode: "GATEWAY_INVOKE",
          outcomeCode: "EXPECTED_REJECT",
          providerCode: providerCode(event.role),
          reasonCode: "DEPENDENCY_UNAVAILABLE",
        });
      }
      if (event.outcomeCode === "FALLBACK" && event.role !== undefined) {
        return;
      }
      const outcomeCode: TelemetryOutcomeCode =
        event.outcomeCode === "CANDIDATE"
          ? "SUCCESS"
          : event.outcomeCode === "BLOCKED"
            ? "EXPECTED_REJECT"
            : "RETRYABLE";
      const generationMode =
        event.outcomeCode === "CANDIDATE" && event.role !== undefined
          ? event.role
          : "NO_RESULT";
      const attributes: TelemetryAttributes = {
        generationMode,
        operationCode: "GATEWAY_INVOKE",
        outcomeCode,
        workload: workload(event.workload),
      };
      runtime.record("dailyenergy_gateway_invocations_total", 1, attributes);
      runtime.record(
        "dailyenergy_gateway_generation_mode_total",
        1,
        attributes,
      );
    },
  });
}

function attemptOutcome(
  value: GatewayAttemptTelemetryEventV1["outcomeCode"],
): TelemetryOutcomeCode {
  if (value === "SUCCEEDED") {
    return "SUCCESS";
  }
  if (value === "OUTCOME_UNKNOWN") {
    return "UNKNOWN";
  }
  if (value === "PROVIDER_ERROR") {
    return "RETRYABLE";
  }
  if (value === "CANCELLED" || value === "BLOCKED") {
    return "EXPECTED_REJECT";
  }
  return "EXPECTED_REJECT";
}

function providerCode(
  role: "PRIMARY_AI" | "BACKUP_AI",
): NonNullable<TelemetryAttributes["providerCode"]> {
  return role === "PRIMARY_AI" ? "PRIMARY" : "BACKUP";
}

function reasonCode(value: string): TelemetryReasonCode {
  if (DIRECT_REASON_CODES.has(value as TelemetryReasonCode)) {
    return value as TelemetryReasonCode;
  }
  if (value === "PROVIDER_RATE_LIMITED") {
    return "RATE_LIMITED";
  }
  if (
    value === "PROVIDER_PATHS_EXHAUSTED" ||
    value === "GATEWAY_EXECUTION_UNAVAILABLE" ||
    value.startsWith("PROVIDER_")
  ) {
    return "DEPENDENCY_UNAVAILABLE";
  }
  return "CONTRACT_FAILURE";
}

function workload(
  value: "DAILY_EXPRESSION_V1" | "WEEKLY_EXPRESSION_V1",
): NonNullable<TelemetryAttributes["workload"]> {
  return value === "DAILY_EXPRESSION_V1" ? "DAILY" : "WEEKLY";
}
