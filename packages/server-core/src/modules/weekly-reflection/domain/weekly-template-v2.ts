import {
  WeeklyAggregateFactsSchema,
  WeeklyExpressionPayloadSchema,
  WeeklyExpressionPlanSchema,
  type WeeklyAggregateFacts,
  type WeeklyExpressionPayload,
  type WeeklyExpressionPlan,
} from "@daily-energy/shared-schemas";

export const WEEKLY_TEMPLATE_V2_VERSION = "weekly-template-v2" as const;

/**
 * `weekly-template-v1` published summaries are historical and immutable, so
 * v2 is a separate template that renders the same Accepted plan but binds each
 * segment to exactly the facts the strict output validator expects:
 *
 * - opening   -> headline + source disclosure (real days AND missing days)
 * - closing   -> coverage level
 * - numbers   -> only counts carried by the segment's own facts
 *
 * It never invents a number, date, cause or trend; every figure comes from the
 * frozen aggregate.
 */
export class WeeklyTemplateV2Error extends Error {
  public constructor(
    public readonly code:
      "WEEKLY_V2_PLAN_BINDING_INVALID" | "WEEKLY_V2_FACT_UNSUPPORTED",
  ) {
    super(code);
    this.name = "WeeklyTemplateV2Error";
  }
}

const METRIC_PREFIX = {
  EVENING_OVERALL: "evening",
  MORNING_ENERGY: "energy",
  MORNING_MOOD: "mood",
  MORNING_SLEEP: "sleep",
} as const;

const METRIC_NAME = {
  EVENING_OVERALL: "晚间整体感受",
  MORNING_ENERGY: "晨间精力",
  MORNING_MOOD: "晨间心情",
  MORNING_SLEEP: "睡眠感受",
} as const;

const DIRECTION_TEXT = {
  HIGHER_LATE: "后几次相对更高",
  LOWER_LATE: "后几次相对更低",
  SIMILAR: "几次整体相近",
  VARIABLE: "几次之间有起伏",
} as const;

const MODE_TEXT: Readonly<
  Record<keyof typeof METRIC_PREFIX, Readonly<Record<string, string>>>
> = Object.freeze({
  EVENING_OVERALL: {
    LIGHT: "轻松",
    PRETTY_GOOD: "比较好",
    SOMEWHAT_HEAVY: "有些沉重",
    STEADY: "平稳",
    VERY_HEAVY: "很沉重",
  },
  MORNING_ENERGY: {
    EMPTY: "几乎见底",
    FULL: "很充足",
    HIGH: "较充足",
    LOW: "偏低",
    STEADY: "平稳",
  },
  MORNING_MOOD: {
    GOOD: "不错",
    LIGHT: "轻快",
    LOW: "偏低",
    STEADY: "平稳",
    VERY_LOW: "很低",
  },
  MORNING_SLEEP: { GOOD: "不错", LOW: "偏低", OKAY: "还可以", POOR: "较差" },
});

const ACTION_TEXT: Readonly<Record<string, string>> = Object.freeze({
  COMMUNICATE_CLEARLY: "清楚沟通",
  ORGANIZE_SMALL_SCOPE: "整理小范围",
  PAUSE_AND_RECOVER: "短暂停顿",
  PREPARE_ONE_STEP: "准备第一步",
  PRIORITIZE_ONE: "只留一个重点",
  REDUCE_SWITCHING: "减少切换",
  REFLECT_BRIEFLY: "简短回看",
  SEEK_REAL_SUPPORT: "联系现实支持",
});

const NEXT_WEEK_TEXT = {
  CONTINUE_WITHOUT_PRESSURE:
    "下一周可以按自己的节奏继续记录，不必每天出现，也不用特意补记。",
  KEEP_ONE_SMALL_NOTE:
    "下一周愿意的话，可以多留下一次简短的回看记录，不用写长句。",
  NOTICE_ENERGY_TIMING:
    "下一周可以轻轻留意一天里什么时候精力更有余量，不需要每天都记。",
  NOTICE_HELPFUL_ACTIONS:
    "下一周可以继续留意哪些小事确实有帮助，不必照单全做。",
  NOTICE_MOOD_SHIFTS: "下一周可以轻轻留意心情有变化的时刻，不急着找原因。",
  NOTICE_SLEEP_AND_ENERGY:
    "下一周可以分别看看睡眠和精力的记录，只保留真实的观察。",
} as const;

export function renderControlledWeeklyExpressionV2(
  aggregateInput: WeeklyAggregateFacts,
  planInput: WeeklyExpressionPlan,
): WeeklyExpressionPayload {
  const aggregate = WeeklyAggregateFactsSchema.parse(aggregateInput);
  const plan = WeeklyExpressionPlanSchema.parse(planInput);
  if (
    plan.coverage_level !== aggregate.coverage.coverage_level ||
    plan.approved_fact_ids.some(
      (factId) => !aggregate.approved_fact_catalog.includes(factId),
    )
  ) {
    throw new WeeklyTemplateV2Error("WEEKLY_V2_PLAN_BINDING_INVALID");
  }
  const coverage = aggregate.coverage;
  const real = coverage.real_state_day_count;
  const missing = coverage.missing_dates.length;
  const observations = plan.observation_fact_ids.map((factId) => ({
    fact_refs: observationRefs(factId, plan.approved_fact_ids),
    text: observationText(aggregate, factId),
  }));
  const helpful =
    plan.helpful_pattern_fact_id === undefined
      ? undefined
      : {
          fact_refs: [plan.helpful_pattern_fact_id],
          text: helpfulText(aggregate),
        };
  return WeeklyExpressionPayloadSchema.parse({
    closing: {
      fact_refs: [plan.coverage_fact_id],
      text:
        coverage.coverage_level === "COMPLETE"
          ? "这些记录只代表你留下的那几次，足够作为下一次回看的起点。"
          : "已经留下的这些记录就够用了，缺失的日期继续留空，不用补。",
    },
    ...(helpful === undefined ? {} : { helpful_pattern: helpful }),
    next_week: {
      fact_refs: [plan.next_observation_fact_id],
      text: NEXT_WEEK_TEXT[plan.next_observation_plan],
    },
    observations,
    opening: {
      fact_refs: [plan.headline_fact_id, plan.source_disclosure_fact_id],
      text: `这段时间里有 ${real} 天留下了真实记录，${missing} 天没有记录，缺失的日期会如实留空。`,
    },
    title: "这段时间，先看见留下的记录",
  });
}

/**
 * When the plan also approves the companion observed_count fact, the segment
 * must cite both: the text states that count, so it has to be a bound fact.
 */
function observationRefs(
  factId: string,
  approvedFactIds: readonly string[],
): readonly string[] {
  const companion = factId.replace(/.(direction|mode)$/u, ".observed_count");
  return companion !== factId && approvedFactIds.includes(companion)
    ? [factId, companion]
    : [factId];
}

function observationText(
  aggregate: WeeklyAggregateFacts,
  factId: string,
): string {
  const match = /^fact\.(mood|energy|sleep|evening)\.(direction|mode)$/u.exec(
    factId,
  );
  if (match === null) {
    throw new WeeklyTemplateV2Error("WEEKLY_V2_FACT_UNSUPPORTED");
  }
  const metric = aggregate.state_metrics.find((candidate) =>
    factId.startsWith(`fact.${METRIC_PREFIX[candidate.metric_id]}.`),
  );
  if (metric === undefined) {
    throw new WeeklyTemplateV2Error("WEEKLY_V2_FACT_UNSUPPORTED");
  }
  const name = METRIC_NAME[metric.metric_id];
  if (match[2] === "direction") {
    if (metric.direction === "INSUFFICIENT_DATA") {
      throw new WeeklyTemplateV2Error("WEEKLY_V2_FACT_UNSUPPORTED");
    }
    return `基于 ${metric.observed_count} 次可用的${name}记录，${DIRECTION_TEXT[metric.direction]}；这只是记录方向，不代表固定状态。`;
  }
  const label =
    metric.mode_value === undefined
      ? undefined
      : MODE_TEXT[metric.metric_id][metric.mode_value];
  if (label === undefined || metric.mode_count === undefined) {
    throw new WeeklyTemplateV2Error("WEEKLY_V2_FACT_UNSUPPORTED");
  }
  return `在 ${metric.observed_count} 次可用的${name}记录里，较常出现的是“${label}”，共 ${metric.mode_count} 次；这不代表长期状态。`;
}

function helpfulText(aggregate: WeeklyAggregateFacts): string {
  const kind = aggregate.helpfulness_facts.top_helpful_action_kind;
  const label = kind === undefined ? undefined : ACTION_TEXT[kind];
  const count =
    kind === undefined
      ? 0
      : (aggregate.helpfulness_facts.helpful_action_kind_counts[kind] ?? 0);
  if (label === undefined || count < 1) {
    throw new WeeklyTemplateV2Error("WEEKLY_V2_FACT_UNSUPPORTED");
  }
  return `${count} 次记录里，“${label}”这类小事被你标为有帮助，样本有限，不当作固定答案。`;
}
