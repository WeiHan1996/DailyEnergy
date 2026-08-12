import type {
  QueueTelemetryEvent,
  QueueTelemetrySink,
} from "../queue/contracts.js";
import type { TelemetryAttributes, TelemetryReasonCode } from "./contracts.js";
import type { TelemetryRuntime } from "./runtime.js";

const KNOWN_REASON_CODES = new Set<TelemetryReasonCode>([
  "CAPABILITY_REJECTED",
  "CONTRACT_FAILURE",
  "DEPENDENCY_UNAVAILABLE",
  "OUTBOX_RELAY_EXHAUSTED",
  "OUTBOX_RELAY_RETRYABLE",
  "OUTBOX_ROUTE_UNSUPPORTED",
  "REDIS_REBUILD_UNSUPPORTED",
]);

function reasonCode(value: string | undefined): TelemetryReasonCode {
  return value !== undefined &&
    KNOWN_REASON_CODES.has(value as TelemetryReasonCode)
    ? (value as TelemetryReasonCode)
    : "NONE";
}

function queueFamily(
  value: QueueTelemetryEvent["queueFamily"],
): NonNullable<TelemetryAttributes["queueFamily"]> {
  return value.toUpperCase() as NonNullable<TelemetryAttributes["queueFamily"]>;
}

export function createQueueTelemetrySink(
  runtime: TelemetryRuntime,
): QueueTelemetrySink {
  return Object.freeze({
    record(event: QueueTelemetryEvent): void {
      const attributes: TelemetryAttributes = {
        operationCode: event.operationCode,
        outcomeCode: event.outcomeCode,
        queueFamily: queueFamily(event.queueFamily),
        reasonCode: reasonCode(event.reasonCode),
      };
      if (event.operationCode === "OUTBOX_RELAY") {
        runtime.record("dailyenergy_outbox_events_total", 1, attributes);
      } else {
        runtime.record("dailyenergy_queue_jobs_total", 1, attributes);
      }
      if (event.outcomeCode === "RETRYABLE") {
        runtime.record("dailyenergy_queue_retry_total", 1, attributes);
      }
      if (
        event.operationCode === "QUEUE_HANDLE" &&
        event.outcomeCode === "DUPLICATE"
      ) {
        runtime.record(
          "dailyenergy_worker_inbox_duplicate_total",
          1,
          attributes,
        );
      }
      if (
        event.operationCode === "QUEUE_HANDLE" &&
        event.outcomeCode === "EXPECTED_REJECT"
      ) {
        runtime.record("dailyenergy_worker_profile_rejection_total", 1, {
          ...attributes,
          reasonCode: "CAPABILITY_REJECTED",
        });
      }
    },
  });
}
