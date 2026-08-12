import { describe, expect, it, vi } from "vitest";

import { validateAlert } from "./alert.js";
import {
  aggregateCosts,
  BudgetEnvelopeV1Schema,
  CostEntryV1Schema,
  evaluateBudget,
} from "./cost.js";
import { evaluateGatewayControl } from "./gateway.js";
import { createQueueTelemetrySink } from "./queue-sink.js";
import {
  classifySloEvent,
  errorBudgetReleaseDecision,
  errorBudgetState,
  evaluateBurn,
} from "./slo.js";
import type { TelemetryRuntime } from "./runtime.js";

const envelope = BudgetEnvelopeV1Schema.parse({
  ai_cost_per_core_active_user_day_cap_micros: 100_000,
  approved_by_role: "FINANCE_OWNER",
  approved_total_micros: 1_000_000,
  category_caps: [{ category: "AI_PROVIDER", cap_micros: 800_000 }],
  currency: "CNY",
  effective_at: "2026-08-01T00:00:00+08:00",
  environment: "CI",
  expires_at: "2026-09-01T00:00:00+08:00",
  forecast_model_version: "forecast-v1",
  hard_limit_ratio: 1,
  high_limit_ratio: 0.85,
  owner_role: "AI_OWNER",
  period: "2026-08",
  soft_limit_ratio: 0.7,
});

describe("SLO and cost policy", () => {
  it("does not let expected rejects or fast failures corrupt SLOs", () => {
    expect(
      classifySloEvent({
        available: false,
        elapsedSeconds: 0.001,
        expectedReject: true,
        operationGroup: "CORE_WRITE",
        outcome: "EXPECTED_REJECT",
      }),
    ).toEqual({ availability: "GOOD", latency: "EXCLUDED" });
    expect(
      classifySloEvent({
        available: false,
        elapsedSeconds: 0.001,
        expectedReject: false,
        operationGroup: "CORE_READ",
        outcome: "SERVICE_FAILURE",
      }),
    ).toEqual({ availability: "BAD", latency: "EXCLUDED" });
    expect(
      classifySloEvent({
        available: false,
        elapsedSeconds: null,
        expectedReject: false,
        operationGroup: "GENERATION",
        outcome: "USER_CANCEL",
      }),
    ).toEqual({ availability: "EXCLUDED", latency: "EXCLUDED" });
  });

  it("requires both burn windows and low-traffic corroboration", () => {
    const base = {
      absoluteFailures: 1,
      long: { bad: 8, total: 100 },
      minimumRequests: 20,
      short: { bad: 1, total: 10 },
      syntheticFailed: false,
      target: 0.995,
      threshold: 14.4 as const,
    };
    expect(evaluateBurn(base)).toBe("NONE");
    expect(evaluateBurn({ ...base, syntheticFailed: true })).toBe("PAGE_14_4");
    expect(
      evaluateBurn({
        ...base,
        long: { bad: 8, total: 100 },
        short: { bad: 0, total: 10 },
        syntheticFailed: true,
      }),
    ).toBe("NONE");
    expect(
      errorBudgetState({
        allowedBad: 10,
        consumedBad: 1,
        telemetryCompleteness: 0.98,
      }),
    ).toBe("BLOCKED");
    expect(
      errorBudgetReleaseDecision({
        approved: false,
        changeClass: "ORDINARY_FEATURE",
        state: "EXHAUSTED",
      }),
    ).toBe("DENY");
    expect(
      errorBudgetReleaseDecision({
        approved: false,
        changeClass: "ROLLBACK",
        state: "EXHAUSTED",
      }),
    ).toBe("ALLOW");
  });

  it("preserves UNKNOWN and enforces 70/85/100 percent decisions", () => {
    const unknown = {
      aggregation_revision: 1,
      amount_micros: null,
      cost_category: "AI_PROVIDER",
      cost_date: "2026-08-12",
      currency: "CNY",
      environment: "CI",
      outcome: "UNKNOWN",
      price_catalog_version: "catalog-v1",
      provider_code: "PRIMARY",
      service_or_workload: "DAILY",
      source_invoice_or_usage_ref: "a".repeat(64),
      unit_price_micros: null,
      usage_quantity: null,
      usage_unit: "TOKEN",
    } as const;
    expect(CostEntryV1Schema.parse(unknown).amount_micros).toBeNull();
    expect(
      CostEntryV1Schema.safeParse({ ...unknown, amount_micros: 0 }).success,
    ).toBe(false);
    expect(aggregateCosts([unknown]).state).toBe("BLOCKED");

    const decision = (ratio: number) =>
      evaluateBudget({
        actualMicros: envelope.approved_total_micros * ratio,
        envelope,
        forecastMicros: 0,
        priceCoverageRatio: 1,
        unknownRatio: 0,
      });
    expect(decision(0.7).state).toBe("TICKET");
    expect(decision(0.85).state).toBe("PAGE_HIGH");
    expect(decision(1)).toEqual({
      providerCallsAllowed: false,
      state: "HARD_STOP",
      templateAllowed: true,
    });
    expect(
      evaluateBudget({
        actualMicros: 0,
        envelope,
        forecastMicros: 0,
        priceCoverageRatio: 0.98,
        unknownRatio: 0.02,
      }).state,
    ).toBe("BLOCKED");
    expect(
      CostEntryV1Schema.safeParse({ ...unknown, account_ref: "forbidden" })
        .success,
    ).toBe(false);
  });

  it("fails provider calls closed while templates and hard controls continue", () => {
    const normal = {
      breakerReadable: true,
      budgetState: "OK" as const,
      modelMatchesManifest: true,
      priceCatalogFresh: true,
    };
    expect(evaluateGatewayControl(normal).providerCallsAllowed).toBe(true);
    expect(
      evaluateGatewayControl({ ...normal, breakerReadable: false }),
    ).toMatchObject({
      generationMode: "CONTROLLED_TEMPLATE",
      providerCallsAllowed: false,
      reasonCode: "BREAKER_STATE_UNAVAILABLE",
      safetyAndDeletionContinue: true,
    });
    expect(
      evaluateGatewayControl({ ...normal, priceCatalogFresh: false }),
    ).toMatchObject({
      providerCallsAllowed: false,
      reasonCode: "PRICE_CATALOG_STALE",
    });
    expect(
      evaluateGatewayControl({ ...normal, budgetState: "HARD_STOP" }),
    ).toMatchObject({
      providerCallsAllowed: false,
      reasonCode: "BUDGET_HARD_LIMIT",
      safetyAndDeletionContinue: true,
    });
    expect(
      evaluateGatewayControl({ ...normal, modelMatchesManifest: false }),
    ).toMatchObject({
      providerCallsAllowed: false,
      reasonCode: "MODEL_MISMATCH",
      routeActive: false,
    });
  });

  it("keeps alert payloads closed and content-free", () => {
    const alert = {
      alert_id: "S33-CORE-API-BURN",
      condition: "SLO_BURN",
      config_catalog_version: "observability-v1",
      current_value: 14.5,
      dashboard_url: "/d/executive-reliability",
      dedupe_key: "CI:API:CORE_API_BURN",
      environment: "CI",
      incident_category_candidate: "INC-RELIABILITY",
      owner_role: "ENGINEERING_PRIMARY",
      release_id: "synthetic-release-v1",
      runbook_url: "/runbooks/core-api-burn",
      runtime_profile: "API",
      service: "api",
      severity: "PAGE_HIGH",
      slo_id: "S33-SLO-01",
      started_at: "2026-08-12T09:00:00+08:00",
      window: "5m",
    } as const;
    expect(validateAlert(alert)).toEqual(alert);
    expect(validateAlert({ ...alert, window: "1h+5m" })).toMatchObject({
      window: "1h+5m",
    });
    expect(() =>
      validateAlert({ ...alert, request_ref: "synthetic-request" } as never),
    ).toThrow();
  });
});

describe("queue telemetry adapter", () => {
  it("maps retries, duplicates and profile rejection without job refs", () => {
    const record = vi.fn<TelemetryRuntime["record"]>();
    const runtime = {
      beginSpan: vi.fn(),
      record,
      shutdown: vi.fn(async () => undefined),
      startSpan: vi.fn(),
    } as unknown as TelemetryRuntime;
    const sink = createQueueTelemetrySink(runtime);

    sink.record({
      operationCode: "QUEUE_HANDLE",
      outcomeCode: "DUPLICATE",
      profile: "worker-interactive",
      queueFamily: "interactive",
    });
    sink.record({
      operationCode: "QUEUE_HANDLE",
      outcomeCode: "EXPECTED_REJECT",
      profile: "worker-interactive",
      queueFamily: "interactive",
      reasonCode: "PROFILE_JOB_TYPE_REJECTED",
    });
    sink.record({
      operationCode: "OUTBOX_RELAY",
      outcomeCode: "RETRYABLE",
      profile: "worker-background",
      queueFamily: "background",
      reasonCode: "OUTBOX_RELAY_RETRYABLE",
      retryOrdinal: 1,
    });

    expect(record).toHaveBeenCalledWith(
      "dailyenergy_worker_inbox_duplicate_total",
      1,
      expect.not.objectContaining({ jobRef: expect.anything() }),
    );
    expect(record).toHaveBeenCalledWith(
      "dailyenergy_worker_profile_rejection_total",
      1,
      expect.objectContaining({ reasonCode: "CAPABILITY_REJECTED" }),
    );
    expect(record).toHaveBeenCalledWith(
      "dailyenergy_queue_retry_total",
      1,
      expect.objectContaining({ queueFamily: "BACKGROUND" }),
    );
  });
});
