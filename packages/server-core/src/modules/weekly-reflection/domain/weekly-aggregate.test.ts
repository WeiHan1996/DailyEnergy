import { describe, expect, it } from "vitest";

import {
  ClientWeeklySummaryViewSchema,
  PublishedWeeklySummarySchema,
  WeeklyExpressionPayloadSchema,
  type WeeklySourceSnapshot,
} from "@daily-energy/shared-schemas";

import {
  createClientWeeklySummaryView,
  deriveWeeklyAggregate,
  renderControlledWeeklyExpression,
} from "./weekly-aggregate.js";

const DATES = [
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
] as const;

function source(days: WeeklySourceSnapshot["days"]): WeeklySourceSnapshot {
  return {
    contract: "weekly-source-snapshot",
    days,
    schema_version: "1.0.0",
    source_fingerprint: "weekly-source-example-v1",
    window_end_date: DATES[6],
    window_id: "weekly-window-example-v1",
    window_rule_version: "window-v1",
    window_start_date: DATES[0],
  };
}

function missingDay(productDate: string) {
  return { product_date: productDate, source_state: "MISSING" as const };
}

function recordedDay(
  productDate: string,
  index: number,
  options: {
    readonly energy?: "EMPTY" | "LOW" | "STEADY" | "HIGH" | "FULL" | "UNSURE";
    readonly helpful?: boolean;
  } = {},
) {
  return {
    checkin: {
      energy: options.energy ?? "STEADY",
      mood: index < 3 ? ("LOW" as const) : ("GOOD" as const),
      revision: 1,
      sleep: index % 2 === 0 ? ("OKAY" as const) : ("LOW" as const),
      source_ref: `checkin-source-${index}`,
    },
    helpfulness: options.helpful
      ? {
          action_kind: "REDUCE_SWITCHING" as const,
          rating: "HELPFUL" as const,
          revision: 1,
          source_ref: `help-source-${index}`,
        }
      : {
          rating: "NEUTRAL" as const,
          revision: 1,
          source_ref: `help-source-${index}`,
        },
    light: {
      is_lit: index % 2 === 0,
      source_ref: `light-source-${index}`,
    },
    product_date: productDate,
    source_state: "RECORDED" as const,
    task: {
      revision: 1,
      source_ref: `task-source-${index}`,
      status: index === 0 ? ("COMPLETED" as const) : ("UNMARKED" as const),
    },
  };
}

describe("weekly-aggregate-v1", () => {
  it("keeps all seven dates and maps 0/2/5/7 real days to exact coverage", () => {
    for (const [realDays, expected] of [
      [0, "EMPTY"],
      [2, "POINTS_ONLY"],
      [5, "PARTIAL"],
      [7, "COMPLETE"],
    ] as const) {
      const days = DATES.map((date, index) =>
        index < realDays ? recordedDay(date, index) : missingDay(date),
      );
      const result = deriveWeeklyAggregate(source(days));
      expect(result.aggregate.coverage.coverage_level).toBe(expected);
      expect(result.aggregate.day_slots).toHaveLength(7);
      expect(result.aggregate.day_slots.map((day) => day.product_date)).toEqual(
        DATES,
      );
      expect(result.expressionPlan !== undefined).toBe(realDays >= 3);
    }
  });

  it("excludes missing and UNSURE values from direction without filling gaps", () => {
    const days = [
      recordedDay(DATES[0], 0, { energy: "LOW" }),
      missingDay(DATES[1]),
      recordedDay(DATES[2], 2, { energy: "UNSURE" }),
      recordedDay(DATES[3], 3, { energy: "STEADY" }),
      missingDay(DATES[4]),
      recordedDay(DATES[5], 5, { energy: "HIGH" }),
      missingDay(DATES[6]),
    ];
    const metric = deriveWeeklyAggregate(
      source(days),
    ).aggregate.state_metrics.find(
      (item) => item.metric_id === "MORNING_ENERGY",
    );
    expect(metric).toMatchObject({
      direction: "HIGHER_LATE",
      missing_count: 3,
      observed_count: 3,
      unsure_count: 1,
    });
  });

  it("omits tied modes and requires two helpful samples for a top action", () => {
    const result = deriveWeeklyAggregate(
      source([
        recordedDay(DATES[0], 0, { energy: "LOW", helpful: true }),
        recordedDay(DATES[1], 1, { energy: "STEADY", helpful: true }),
        recordedDay(DATES[2], 2, { energy: "LOW" }),
        recordedDay(DATES[3], 3, { energy: "STEADY" }),
        ...DATES.slice(4).map(missingDay),
      ]),
    );
    const energy = result.aggregate.state_metrics.find(
      (metric) => metric.metric_id === "MORNING_ENERGY",
    );
    expect(energy?.mode_value).toBeUndefined();
    expect(result.aggregate.helpfulness_facts.top_helpful_action_kind).toBe(
      "REDUCE_SWITCHING",
    );
    expect(result.expressionPlan?.helpful_pattern_fact_id).toBe(
      "fact.helpfulness.top_action_kind",
    );
  });

  it("renders one complete controlled template bound only to approved facts", () => {
    const derivation = deriveWeeklyAggregate(
      source(
        DATES.map((date, index) =>
          recordedDay(date, index, { helpful: index < 2 }),
        ),
      ),
    );
    const expression = renderControlledWeeklyExpression(
      derivation.aggregate,
      derivation.expressionPlan!,
    );
    expect(WeeklyExpressionPayloadSchema.safeParse(expression).success).toBe(
      true,
    );
    expect(JSON.stringify(expression)).not.toContain("source_ref");
    expect(JSON.stringify(expression)).not.toContain("note");
  });

  it("projects INVALIDATED facts without a ghost summary and AVAILABLE with one", () => {
    const derivation = deriveWeeklyAggregate(
      source(
        DATES.map((date, index) =>
          recordedDay(date, index, { helpful: index < 2 }),
        ),
      ),
    );
    expect(derivation.expressionPlan?.observation_fact_ids).toHaveLength(2);
    expect(derivation.expressionPlan?.helpful_pattern_fact_id).toBe(
      "fact.helpfulness.top_action_kind",
    );
    const invalidated = createClientWeeklySummaryView({
      aggregate: derivation.aggregate,
      summaryStatus: "INVALIDATED",
    });
    expect(invalidated.summary).toBeUndefined();
    expect(ClientWeeklySummaryViewSchema.safeParse(invalidated).success).toBe(
      true,
    );

    const expression = renderControlledWeeklyExpression(
      derivation.aggregate,
      derivation.expressionPlan!,
    );
    const published = PublishedWeeklySummarySchema.parse({
      aggregate_facts_ref: "weekly-aggregate-example-v1",
      contract: "weekly-summary",
      expression,
      expression_plan: derivation.expressionPlan,
      expression_version: "weekly-expression-v1",
      privacy_fallbacks: {},
      provenance: {
        generation_mode: "CONTROLLED_TEMPLATE",
        personalization_level: "REDUCED",
        safety_policy_version: "safety-baseline-v1",
        template_version: "weekly-template-v1",
      },
      published_at: "2026-08-24T12:00:00.000Z",
      schema_version: "1.0.0",
      source_dependencies: [],
      source_fingerprint: derivation.aggregate.source_fingerprint,
      summary_id: "weekly-summary-example-v1",
      summary_revision: 1,
      validation: {
        status: "PASSED",
        validated_at: "2026-08-24T12:00:00.000Z",
      },
      window_end_date: derivation.aggregate.window_end_date,
      window_id: derivation.aggregate.window_id,
      window_start_date: derivation.aggregate.window_start_date,
    });
    const available = createClientWeeklySummaryView({
      aggregate: derivation.aggregate,
      published,
      summaryStatus: "AVAILABLE",
    });
    expect(available.summary?.revision).toBe(1);
    expect(available.summary?.paragraphs).toHaveLength(5);
    expect(JSON.stringify(available)).not.toMatch(
      /source_fingerprint|source_ref|daily_score|raw_notes|model/u,
    );
  });

  it("is byte-stable for the same accepted source", () => {
    const input = source(DATES.map((date, index) => recordedDay(date, index)));
    expect(JSON.stringify(deriveWeeklyAggregate(input))).toBe(
      JSON.stringify(deriveWeeklyAggregate(input)),
    );
  });
});
