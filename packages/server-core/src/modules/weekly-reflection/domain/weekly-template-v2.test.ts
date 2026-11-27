import { describe, expect, it } from "vitest";

import {
  WeeklyExpressionPayloadSchema,
  type WeeklySourceSnapshot,
} from "@daily-energy/shared-schemas";

import { deriveWeeklyAggregate } from "./weekly-aggregate.js";
import {
  WEEKLY_TEMPLATE_V2_VERSION,
  WeeklyTemplateV2Error,
  renderControlledWeeklyExpressionV2,
} from "./weekly-template-v2.js";

const DATES = [
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
] as const;

interface DayOptions {
  readonly helpful?: boolean;
  readonly moodLow?: boolean;
}

function snapshot(
  realDays: number,
  options: DayOptions = {},
): WeeklySourceSnapshot {
  return {
    contract: "weekly-source-snapshot",
    days: DATES.map((productDate, index) =>
      index >= realDays
        ? { product_date: productDate, source_state: "MISSING" as const }
        : {
            checkin: {
              energy: "STEADY" as const,
              mood:
                options.moodLow === true || index < 3
                  ? ("LOW" as const)
                  : ("GOOD" as const),
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
              status: "UNMARKED" as const,
            },
          },
    ),
    schema_version: "1.0.0",
    source_fingerprint: `weekly-source-v2-${realDays}`,
    window_end_date: DATES[6],
    window_id: `weekly-window-v2-${realDays}`,
    window_rule_version: "window-v1",
    window_start_date: DATES[0],
  };
}

function derive(realDays: number, options?: DayOptions) {
  const derivation = deriveWeeklyAggregate(snapshot(realDays, options));
  if (derivation.expressionPlan === undefined) {
    throw new Error("expected a Weekly expression plan");
  }
  return { aggregate: derivation.aggregate, plan: derivation.expressionPlan };
}

describe("AI-011 weekly-template-v2", () => {
  it("is a distinct version from the historical weekly-template-v1", () => {
    expect(WEEKLY_TEMPLATE_V2_VERSION).toBe("weekly-template-v2");
    expect(WEEKLY_TEMPLATE_V2_VERSION).not.toBe("weekly-template-v1");
  });

  it.each([3, 5, 7])(
    "renders a schema-valid payload for %i real days",
    (days) => {
      const { aggregate, plan } = derive(days);
      const payload = renderControlledWeeklyExpressionV2(aggregate, plan);
      expect(WeeklyExpressionPayloadSchema.safeParse(payload).success).toBe(
        true,
      );
    },
  );

  it("binds the opening to the headline and the source disclosure", () => {
    const { aggregate, plan } = derive(5);
    const payload = renderControlledWeeklyExpressionV2(aggregate, plan);
    expect(payload.opening.fact_refs).toEqual([
      plan.headline_fact_id,
      plan.source_disclosure_fact_id,
    ]);
    expect(payload.opening.text).toContain("5 天留下了真实记录");
    expect(payload.opening.text).toContain("2 天没有记录");
    expect(payload.closing.fact_refs).toEqual([plan.coverage_fact_id]);
  });

  it("cites the observed_count companion only when the plan approves it", () => {
    const { aggregate, plan } = derive(7);
    const payload = renderControlledWeeklyExpressionV2(aggregate, plan);
    payload.observations.forEach((segment, index) => {
      const factId = plan.observation_fact_ids[index]!;
      const companion = factId.replace(
        /\.(direction|mode)$/u,
        ".observed_count",
      );
      expect(segment.fact_refs[0]).toBe(factId);
      expect(segment.fact_refs.includes(companion)).toBe(
        plan.approved_fact_ids.includes(companion),
      );
    });
    const trimmed = {
      ...plan,
      approved_fact_ids: plan.approved_fact_ids.filter(
        (id) => !id.endsWith(".observed_count"),
      ),
    };
    if (trimmed.approved_fact_ids.length >= 3) {
      const without = renderControlledWeeklyExpressionV2(aggregate, trimmed);
      expect(
        without.observations.every((segment) => segment.fact_refs.length === 1),
      ).toBe(true);
    }
  });

  it("uses only counts that come from the frozen aggregate, never a date or a derived figure", () => {
    const { aggregate, plan } = derive(5, { helpful: true });
    const payload = renderControlledWeeklyExpressionV2(aggregate, plan);
    const text = JSON.stringify(payload);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/u);
    expect(text).not.toMatch(/(?:%|百分|平均|均值|比例)/u);
    expect(text).not.toContain("source_ref");
    expect(text).not.toContain("note");
    for (const [, number] of text.matchAll(/(\d+) /gu)) {
      expect(Number(number)).toBeLessThanOrEqual(7);
    }
  });

  it("describes the helpful pattern with its real count and no claim of effectiveness", () => {
    const { aggregate, plan } = derive(7, { helpful: true });
    expect(plan.helpful_pattern_fact_id).toBeDefined();
    const payload = renderControlledWeeklyExpressionV2(aggregate, plan);
    expect(payload.helpful_pattern?.fact_refs).toEqual([
      plan.helpful_pattern_fact_id,
    ]);
    expect(payload.helpful_pattern?.text).toContain("减少切换");
    expect(payload.helpful_pattern?.text).toContain("有帮助");
    expect(payload.helpful_pattern?.text).not.toMatch(
      /(?:最有效|已经证明|最适合)/u,
    );
  });

  it("never uses pressure, completeness, causal or trend wording", () => {
    for (const days of [3, 5, 7]) {
      const { aggregate, plan } = derive(days, { helpful: days === 7 });
      const text = JSON.stringify(
        renderControlledWeeklyExpressionV2(aggregate, plan),
      );
      expect(text).not.toMatch(
        /(?:因为|导致|证明|说明你|改善|恶化|越来越|未来会|完美连续|数据完整|连续打卡|必须|不够自律|挑战)/u,
      );
    }
  });

  it("is byte-stable for the same accepted source", () => {
    const first = derive(5, { helpful: true });
    const second = derive(5, { helpful: true });
    expect(
      renderControlledWeeklyExpressionV2(first.aggregate, first.plan),
    ).toEqual(
      renderControlledWeeklyExpressionV2(second.aggregate, second.plan),
    );
  });

  it("rejects a plan that does not bind to its aggregate", () => {
    const { aggregate, plan } = derive(5);
    expect(() =>
      renderControlledWeeklyExpressionV2(aggregate, {
        ...plan,
        coverage_level: "COMPLETE",
      }),
    ).toThrow(WeeklyTemplateV2Error);
    expect(() =>
      renderControlledWeeklyExpressionV2(aggregate, {
        ...plan,
        coverage_level: "COMPLETE",
      }),
    ).toThrow("WEEKLY_V2_PLAN_BINDING_INVALID");
    expect(() =>
      renderControlledWeeklyExpressionV2(aggregate, { not: "a plan" } as never),
    ).toThrow();
  });
});
