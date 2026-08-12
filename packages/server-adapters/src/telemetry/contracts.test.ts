import { describe, expect, it } from "vitest";

import {
  GATEWAY_DURATION_BUCKETS_SECONDS,
  HTTP_DURATION_BUCKETS_SECONDS,
  FORBIDDEN_TELEMETRY_KEYS,
  MAXIMUM_SERIES_BUDGET,
  METRIC_DEFINITIONS,
  metricActiveSeriesLimit,
  metricMaximumSeries,
  TelemetryAttributesSchema,
  TelemetryResourceSchema,
} from "./contracts.js";

const REQUIRED_METRICS = [
  "dailyenergy_http_server_requests_total",
  "dailyenergy_http_server_request_duration_seconds",
  "dailyenergy_http_in_flight_requests",
  "dailyenergy_http_response_contract_failures_total",
  "dailyenergy_command_receipts_total",
  "dailyenergy_command_conflicts_total",
  "dailyenergy_guard_rejections_total",
  "dailyenergy_rate_limit_decisions_total",
  "dailyenergy_client_poll_outcomes_total",
  "dailyenergy_outbox_events_total",
  "dailyenergy_outbox_oldest_unpublished_age_seconds",
  "dailyenergy_outbox_relay_batch_duration_seconds",
  "dailyenergy_queue_jobs_total",
  "dailyenergy_queue_oldest_eligible_age_seconds",
  "dailyenergy_queue_active_jobs",
  "dailyenergy_queue_retry_total",
  "dailyenergy_queue_terminal_failures_total",
  "dailyenergy_worker_handler_duration_seconds",
  "dailyenergy_worker_inbox_duplicate_total",
  "dailyenergy_worker_guard_rejection_total",
  "dailyenergy_worker_profile_rejection_total",
  "dailyenergy_worker_graceful_shutdown_seconds",
  "dailyenergy_gateway_invocations_total",
  "dailyenergy_gateway_attempts_total",
  "dailyenergy_gateway_end_to_end_duration_seconds",
  "dailyenergy_gateway_attempt_duration_seconds",
  "dailyenergy_gateway_candidate_validation_total",
  "dailyenergy_gateway_generation_mode_total",
  "dailyenergy_gateway_breaker_state",
  "dailyenergy_gateway_semaphore_wait_seconds",
  "dailyenergy_gateway_usage_units_total",
  "dailyenergy_gateway_cost_micros_total",
  "dailyenergy_gateway_usage_unknown_total",
  "dailyenergy_gateway_observed_model_mismatch_total",
  "dailyenergy_data_task_state_total",
  "dailyenergy_data_task_oldest_age_seconds",
  "dailyenergy_data_task_deadline_seconds",
  "dailyenergy_deletion_guard_failures_total",
  "dailyenergy_provider_deletion_request_age_seconds",
  "dailyenergy_restore_deny_replay_total",
  "dailyenergy_deleted_data_detector_total",
  "dailyenergy_backup_last_success_timestamp_seconds",
  "dailyenergy_wal_archive_gap_seconds",
  "dailyenergy_backup_expiry_violations_total",
  "dailyenergy_restore_drill_duration_seconds",
  "dailyenergy_recovery_copy_destroy_age_seconds",
] as const;

describe("telemetry contracts", () => {
  it("keeps resources and signal attributes closed and content-free", () => {
    const attributes = {
      httpMethod: "GET",
      operationCode: "HEALTH_READY",
      outcomeCode: "SUCCESS",
      statusClass: "2xx",
    } as const;

    expect(TelemetryAttributesSchema.parse(attributes)).toEqual(attributes);
    for (const forbidden of FORBIDDEN_TELEMETRY_KEYS) {
      expect(
        TelemetryAttributesSchema.safeParse({
          ...attributes,
          [forbidden]: "synthetic-sensitive-value",
        }).success,
      ).toBe(false);
    }
    expect(
      TelemetryResourceSchema.safeParse({
        configSchemaVersion: "config-v1",
        contractBundleVersion: "contract-v1",
        environment: "CI",
        releaseId: "synthetic-v1",
        runtimeProfile: "API",
        service: "api",
        serviceInstanceId: "unbounded-instance",
        serviceVersion: "0.1.0",
      }).success,
    ).toBe(false);
  });

  it("defines every minimum metric with a bounded low-cardinality contract", () => {
    expect(Object.keys(METRIC_DEFINITIONS)).toEqual(
      expect.arrayContaining([...REQUIRED_METRICS]),
    );

    let activeSeriesBudget = 0;
    for (const [name, definition] of Object.entries(METRIC_DEFINITIONS)) {
      expect(name).toMatch(/^dailyenergy_[a-z0-9_]+$/u);
      expect(definition.labels).not.toContain("traceId");
      expect(definition.labels).not.toContain("requestId");
      expect(definition.labels).not.toContain("accountRef");
      if (definition.kind === "counter") {
        expect(name).toMatch(/_total$/u);
      } else if (definition.kind === "histogram") {
        expect(definition.buckets).toEqual(
          [...definition.buckets].sort((left, right) => left - right),
        );
        expect(new Set(definition.buckets).size).toBe(
          definition.buckets.length,
        );
      }
      const maximum = metricMaximumSeries(
        name as keyof typeof METRIC_DEFINITIONS,
      );
      expect(maximum).toBeGreaterThan(0);
      const activeLimit = metricActiveSeriesLimit(
        name as keyof typeof METRIC_DEFINITIONS,
      );
      expect(activeLimit).toBeGreaterThan(0);
      expect(activeLimit).toBeLessThanOrEqual(maximum);
      activeSeriesBudget += activeLimit;
    }
    expect(activeSeriesBudget).toBeLessThanOrEqual(MAXIMUM_SERIES_BUDGET);
    expect(HTTP_DURATION_BUCKETS_SECONDS).toEqual(
      expect.arrayContaining([0.5, 0.75]),
    );
    expect(GATEWAY_DURATION_BUCKETS_SECONDS).toEqual(
      expect.arrayContaining([8, 10, 30]),
    );
  });
});
