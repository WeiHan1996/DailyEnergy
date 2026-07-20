import { describe, expect, it } from "vitest";

import {
  ClientWeeklySummaryViewSchema,
  PublishedWeeklySummarySchema,
  StateMetricFactsSchema,
  WeeklyAggregateFactsSchema,
  WeeklyExpressionPayloadSchema,
  WeeklyExpressionPlanSchema,
  WeeklySourceSnapshotSchema,
} from "../src/index.js";
import {
  clientWeeklySummaryViewFixture,
  cloneFixture,
  publishedWeeklySummaryFixture,
  weeklyAggregateFactsFixture,
  weeklyExpressionFixture,
  weeklyExpressionPlanFixture,
  weeklySourceSnapshotFixture,
} from "./fixtures.js";

describe("weekly summary contracts", () => {
  it("accepts all Accepted weekly examples and executable layers", () => {
    expect(
      WeeklySourceSnapshotSchema.safeParse(weeklySourceSnapshotFixture).success,
    ).toBe(true);
    expect(
      WeeklyAggregateFactsSchema.safeParse(weeklyAggregateFactsFixture).success,
    ).toBe(true);
    expect(
      WeeklyExpressionPlanSchema.safeParse(weeklyExpressionPlanFixture).success,
    ).toBe(true);
    expect(
      WeeklyExpressionPayloadSchema.safeParse(weeklyExpressionFixture).success,
    ).toBe(true);
    expect(
      PublishedWeeklySummarySchema.safeParse(publishedWeeklySummaryFixture)
        .success,
    ).toBe(true);
    expect(
      ClientWeeklySummaryViewSchema.safeParse(clientWeeklySummaryViewFixture)
        .success,
    ).toBe(true);
  });

  it("rejects a non-consecutive or mismatched seven-day window", () => {
    const source = cloneFixture(weeklySourceSnapshotFixture);
    source.days[3]!.product_date = "2026-07-18";
    expect(WeeklySourceSnapshotSchema.safeParse(source).success).toBe(false);

    const client = cloneFixture(clientWeeklySummaryViewFixture);
    client.window_end_date = "2026-07-21";
    expect(ClientWeeklySummaryViewSchema.safeParse(client).success).toBe(false);
  });

  it("keeps coverage, missing dates, and day-derived counts equal", () => {
    const aggregate = cloneFixture(weeklyAggregateFactsFixture);
    aggregate.coverage.real_state_day_count = 6;
    expect(WeeklyAggregateFactsSchema.safeParse(aggregate).success).toBe(false);

    const missing = cloneFixture(clientWeeklySummaryViewFixture);
    missing.coverage.missing_dates = ["2026-07-15"];
    expect(ClientWeeklySummaryViewSchema.safeParse(missing).success).toBe(
      false,
    );
  });

  it("requires metric counts and distributions to reconcile", () => {
    const metric = cloneFixture(weeklyAggregateFactsFixture.state_metrics[0]!);
    metric.distribution.STEADY = 3;
    expect(StateMetricFactsSchema.safeParse(metric).success).toBe(false);

    const client = cloneFixture(clientWeeklySummaryViewFixture);
    client.metrics[0]!.missing_count = 1;
    expect(ClientWeeklySummaryViewSchema.safeParse(client).success).toBe(false);
  });

  it("enforces the three-observation direction threshold", () => {
    const metric = {
      metric_id: "MORNING_SLEEP",
      observed_count: 2,
      unsure_count: 0,
      missing_count: 5,
      distribution: { POOR: 0, LOW: 1, OKAY: 1, GOOD: 0 },
      direction: "LOWER_LATE",
      direction_basis_count: 2,
    };
    expect(StateMetricFactsSchema.safeParse(metric).success).toBe(false);
    expect(
      StateMetricFactsSchema.safeParse({
        ...metric,
        direction: "INSUFFICIENT_DATA",
      }).success,
    ).toBe(true);
  });

  it("enforces mode eligibility and tie handling", () => {
    const eligible = cloneFixture(
      weeklyAggregateFactsFixture.state_metrics[0]!,
    );
    delete (eligible as Record<string, unknown>).mode_value;
    delete (eligible as Record<string, unknown>).mode_count;
    expect(StateMetricFactsSchema.safeParse(eligible).success).toBe(false);

    const tie = cloneFixture(weeklyAggregateFactsFixture.state_metrics[2]!);
    tie.mode_value = "LOW";
    tie.mode_count = 2;
    expect(StateMetricFactsSchema.safeParse(tie).success).toBe(false);
  });

  it("enforces helpful-kind and task-count thresholds", () => {
    const helpful = cloneFixture(weeklyAggregateFactsFixture);
    helpful.helpfulness_facts.helpful_count = 1;
    helpful.helpfulness_facts.neutral_count = 2;
    helpful.helpfulness_facts.helpful_action_kind_counts.REDUCE_SWITCHING = 1;
    expect(WeeklyAggregateFactsSchema.safeParse(helpful).success).toBe(false);

    const task = cloneFixture(weeklyAggregateFactsFixture);
    task.task_facts.completed_count = 2;
    expect(WeeklyAggregateFactsSchema.safeParse(task).success).toBe(false);
  });

  it("rejects expression facts not approved by the deterministic plan", () => {
    const published = cloneFixture(publishedWeeklySummaryFixture);
    published.expression.observations[0]!.fact_refs = ["fact.unapproved.claim"];
    expect(PublishedWeeklySummarySchema.safeParse(published).success).toBe(
      false,
    );
  });

  it("enforces weekly expression body character budgets", () => {
    const expression = cloneFixture(weeklyExpressionFixture);
    expression.closing.text = "短句刚好十个字";
    expression.observations = [
      { text: "稳".repeat(30), fact_refs: ["fact.energy.direction"] },
    ];
    expression.opening.text = "稳".repeat(20);
    expression.next_week.text = "稳".repeat(20);
    delete (expression as Record<string, unknown>).helpful_pattern;
    expect(WeeklyExpressionPayloadSchema.safeParse(expression).success).toBe(
      false,
    );
  });

  it("keeps scores, provenance, source IDs, and raw notes out of client views", () => {
    for (const [field, value] of [
      ["daily_score", 88],
      ["source_fingerprint", "hidden-source"],
      ["raw_notes", ["private note"]],
      ["model", "hidden-model"],
    ] as const) {
      const client = cloneFixture(clientWeeklySummaryViewFixture);
      (client as Record<string, unknown>)[field] = value;
      expect(ClientWeeklySummaryViewSchema.safeParse(client).success).toBe(
        false,
      );
    }
  });

  it("requires summary presence to match availability and coverage", () => {
    const missing = cloneFixture(clientWeeklySummaryViewFixture);
    delete (missing as Record<string, unknown>).summary;
    expect(ClientWeeklySummaryViewSchema.safeParse(missing).success).toBe(
      false,
    );

    const insufficient = cloneFixture(clientWeeklySummaryViewFixture);
    insufficient.coverage.level = "POINTS_ONLY";
    expect(ClientWeeklySummaryViewSchema.safeParse(insufficient).success).toBe(
      false,
    );
  });
});
