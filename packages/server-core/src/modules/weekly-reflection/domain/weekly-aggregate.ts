import {
  ClientWeeklySummaryViewSchema,
  PublishedWeeklySummarySchema,
  WeeklyAggregateFactsSchema,
  WeeklyExpressionPayloadSchema,
  WeeklyExpressionPlanSchema,
  WeeklySourceSnapshotSchema,
  type ClientWeeklySummaryView,
  type PublishedWeeklySummary,
  type WeeklyAggregateFacts,
  type WeeklyExpressionPayload,
  type WeeklyExpressionPlan,
  type WeeklySourceSnapshot,
} from "@daily-energy/shared-schemas";

const METRIC_ORDER = [
  "MORNING_MOOD",
  "MORNING_ENERGY",
  "MORNING_SLEEP",
  "EVENING_OVERALL",
] as const;

const FACT_REGISTRY = [
  "fact.coverage.level",
  "fact.coverage.real_days",
  "fact.coverage.missing_days",
  "fact.coverage.checkin_days",
  "fact.coverage.disclosure",
  "fact.light.count",
  "fact.feedback.count",
  "fact.mood.direction",
  "fact.mood.observed_count",
  "fact.mood.mode",
  "fact.energy.direction",
  "fact.energy.observed_count",
  "fact.energy.mode",
  "fact.sleep.direction",
  "fact.sleep.observed_count",
  "fact.sleep.mode",
  "fact.evening.direction",
  "fact.evening.observed_count",
  "fact.evening.mode",
  "fact.helpfulness.rated_count",
  "fact.helpfulness.helpful_count",
  "fact.helpfulness.top_action_kind",
  "fact.task.offered_count",
  "fact.task.completed_count",
  "plan.notice_energy_timing",
  "plan.notice_mood_shifts",
  "plan.notice_sleep_and_energy",
  "plan.notice_helpful_actions",
  "plan.keep_one_small_note",
  "plan.continue_without_pressure",
] as const;

const METRIC_FACT_PREFIX = {
  EVENING_OVERALL: "evening",
  MORNING_ENERGY: "energy",
  MORNING_MOOD: "mood",
  MORNING_SLEEP: "sleep",
} as const;

const ORDINALS = {
  EVENING_OVERALL: {
    LIGHT: 4,
    PRETTY_GOOD: 3,
    SOMEWHAT_HEAVY: 1,
    STEADY: 2,
    VERY_HEAVY: 0,
  },
  MORNING_ENERGY: { EMPTY: 0, FULL: 4, HIGH: 3, LOW: 1, STEADY: 2 },
  MORNING_MOOD: { GOOD: 3, LIGHT: 4, LOW: 1, STEADY: 2, VERY_LOW: 0 },
  MORNING_SLEEP: { GOOD: 3, LOW: 1, OKAY: 2, POOR: 0 },
} as const;

const DISTRIBUTION_KEYS = {
  EVENING_OVERALL: [
    "VERY_HEAVY",
    "SOMEWHAT_HEAVY",
    "STEADY",
    "PRETTY_GOOD",
    "LIGHT",
  ],
  MORNING_ENERGY: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL"],
  MORNING_MOOD: ["VERY_LOW", "LOW", "STEADY", "GOOD", "LIGHT"],
  MORNING_SLEEP: ["POOR", "LOW", "OKAY", "GOOD"],
} as const;

const DIRECTION_LABELS = {
  HIGHER_LATE: "后几次记录相对偏高",
  INSUFFICIENT_DATA: "记录还不够形成方向",
  LOWER_LATE: "后几次记录相对偏低",
  SIMILAR: "这几次大致相近",
  VARIABLE: "这几次有些起伏",
} as const;

const METRIC_LABELS = {
  EVENING_OVERALL: "晚间整体感受",
  MORNING_ENERGY: "精力",
  MORNING_MOOD: "情绪",
  MORNING_SLEEP: "睡眠",
} as const;

const MODE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  EMPTY: "快没电",
  FULL: "很充足",
  GOOD: "还不错",
  HIGH: "充足",
  LIGHT: "轻松",
  LOW: "偏低",
  OKAY: "还可以",
  POOR: "不太好",
  PRETTY_GOOD: "挺不错",
  SOMEWHAT_HEAVY: "有点沉",
  STEADY: "平稳",
  VERY_HEAVY: "很沉",
  VERY_LOW: "很低落",
});

const ACTION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  COMMUNICATE_CLEARLY: "清楚沟通",
  ORGANIZE_SMALL_SCOPE: "整理小范围",
  PAUSE_AND_RECOVER: "短暂停一下",
  PREPARE_ONE_STEP: "准备第一步",
  PRIORITIZE_ONE: "只留一个重点",
  REDUCE_SWITCHING: "减少切换",
  REFLECT_BRIEFLY: "简短回看",
  SEEK_REAL_SUPPORT: "联系现实支持",
});

type MetricId = (typeof METRIC_ORDER)[number];
type Direction = keyof typeof DIRECTION_LABELS;

interface MetricDescriptor {
  readonly id: MetricId;
  readonly values: readonly (string | undefined)[];
}

interface ObservationCandidate {
  readonly factId: string;
  readonly metricId: MetricId;
  readonly observedFactId: string;
  readonly salience: number;
}

export interface WeeklyDerivation {
  readonly aggregate: WeeklyAggregateFacts;
  readonly expressionPlan?: WeeklyExpressionPlan;
}

export interface ClientWeeklyProjectionInput {
  readonly aggregate: WeeklyAggregateFacts;
  readonly published?: PublishedWeeklySummary;
  readonly relationshipDisplayToken?: string;
  readonly summaryStatus: ClientWeeklySummaryView["summary_status"];
}

export class WeeklyDeterministicError extends Error {
  public constructor(readonly code: string) {
    super(code);
    this.name = "WeeklyDeterministicError";
  }
}

export function deriveWeeklyAggregate(
  sourceInput: WeeklySourceSnapshot,
): WeeklyDerivation {
  const parsedSource = WeeklySourceSnapshotSchema.safeParse(sourceInput);
  if (!parsedSource.success) {
    throw new WeeklyDeterministicError("WEEKLY_SOURCE_INVALID");
  }
  const source = parsedSource.data;
  const daySlots = source.days.map((day) => ({
    product_date: day.product_date,
    state:
      day.checkin !== undefined || day.evening !== undefined
        ? ("RECORDED" as const)
        : ("MISSING" as const),
    ...(day.checkin === undefined
      ? {}
      : {
          morning: {
            energy: day.checkin.energy,
            mood: day.checkin.mood,
            sleep: day.checkin.sleep,
          },
        }),
    ...(day.evening === undefined
      ? {}
      : { evening: { overall_feeling: day.evening.overall_feeling } }),
    is_lit: day.light?.is_lit ?? false,
    helpfulness: day.helpfulness?.rating ?? "UNRATED",
    ...(day.helpfulness?.rating === "HELPFUL" &&
    day.helpfulness.action_kind !== undefined
      ? { helpful_action_kind: day.helpfulness.action_kind }
      : {}),
    ...(day.task === undefined ? {} : { task_status: day.task.status }),
  }));

  const metricDescriptors: readonly MetricDescriptor[] = [
    {
      id: "MORNING_MOOD",
      values: daySlots.map((day) => day.morning?.mood),
    },
    {
      id: "MORNING_ENERGY",
      values: daySlots.map((day) => day.morning?.energy),
    },
    {
      id: "MORNING_SLEEP",
      values: daySlots.map((day) => day.morning?.sleep),
    },
    {
      id: "EVENING_OVERALL",
      values: daySlots.map((day) => day.evening?.overall_feeling),
    },
  ];
  const stateMetrics = metricDescriptors.map(deriveMetric);
  const realDays = daySlots.filter((day) => day.state === "RECORDED").length;
  const checkinDays = daySlots.filter(
    (day) => day.morning !== undefined,
  ).length;
  const eveningDays = daySlots.filter(
    (day) => day.evening !== undefined,
  ).length;
  const litDays = daySlots.filter((day) => day.is_lit).length;
  const missingDates = daySlots
    .filter((day) => day.state === "MISSING")
    .map((day) => day.product_date);
  const helpfulness = deriveHelpfulness(daySlots);
  const tasks = deriveTasks(daySlots);
  const coverageLevel = coverageLevelFor(realDays);

  const catalog = new Set<string>([
    "fact.coverage.level",
    "fact.coverage.real_days",
    "fact.coverage.missing_days",
    "fact.coverage.checkin_days",
    "fact.coverage.disclosure",
    "fact.light.count",
    "fact.feedback.count",
    "fact.helpfulness.rated_count",
    "fact.helpfulness.helpful_count",
    "fact.task.offered_count",
    "fact.task.completed_count",
    "plan.continue_without_pressure",
  ]);
  for (const metric of stateMetrics) {
    const prefix = METRIC_FACT_PREFIX[metric.metric_id];
    catalog.add(`fact.${prefix}.observed_count`);
    if (metric.direction !== "INSUFFICIENT_DATA") {
      catalog.add(`fact.${prefix}.direction`);
    }
    if (metric.mode_value !== undefined) {
      catalog.add(`fact.${prefix}.mode`);
    }
  }
  if (helpfulness.top_helpful_action_kind !== undefined) {
    catalog.add("fact.helpfulness.top_action_kind");
  }

  const aggregateWithoutCatalog = {
    aggregate_version: "weekly-aggregate-v1",
    contract: "weekly-aggregate-facts",
    coverage: {
      checkin_day_count: checkinDays,
      coverage_level: coverageLevel,
      evening_feedback_day_count: eveningDays,
      lit_day_count: litDays,
      missing_dates: missingDates,
      real_state_day_count: realDays,
      window_day_count: 7,
    },
    day_slots: daySlots,
    feedback_facts: { evening_feedback_day_count: eveningDays },
    helpfulness_facts: helpfulness,
    light_facts: { lit_day_count: litDays },
    schema_version: "1.0.0",
    source_fingerprint: source.source_fingerprint,
    state_metrics: stateMetrics,
    task_facts: tasks,
    window_end_date: source.window_end_date,
    window_id: source.window_id,
    window_start_date: source.window_start_date,
  };

  const planChoice = choosePlanFacts(
    aggregateWithoutCatalog as Omit<
      WeeklyAggregateFacts,
      "approved_fact_catalog"
    >,
  );
  if (planChoice !== undefined) {
    catalog.add(planChoice.nextObservationFactId);
  }
  const aggregate = WeeklyAggregateFactsSchema.parse({
    ...aggregateWithoutCatalog,
    approved_fact_catalog: FACT_REGISTRY.filter((fact) => catalog.has(fact)),
  });
  const expressionPlan = deriveExpressionPlan(aggregate, planChoice);
  return Object.freeze({
    aggregate,
    ...(expressionPlan === undefined ? {} : { expressionPlan }),
  });
}

export function renderControlledWeeklyExpression(
  aggregateInput: WeeklyAggregateFacts,
  planInput: WeeklyExpressionPlan,
): WeeklyExpressionPayload {
  const aggregate = WeeklyAggregateFactsSchema.parse(aggregateInput);
  const plan = WeeklyExpressionPlanSchema.parse(planInput);
  assertPlanBinding(aggregate, plan);
  const coverage = aggregate.coverage;
  const opening = `这七天里，你留下了 ${coverage.real_state_day_count} 天真实状态，也点亮了 ${coverage.lit_day_count} 天；缺失日期会继续留空。`;
  const observations = plan.observation_fact_ids.map((factId) => ({
    fact_refs: [factId],
    text: observationText(aggregate, factId),
  }));
  const helpfulPattern =
    plan.helpful_pattern_fact_id === undefined
      ? undefined
      : {
          fact_refs: [plan.helpful_pattern_fact_id],
          text: helpfulPatternText(aggregate),
        };
  return WeeklyExpressionPayloadSchema.parse({
    closing: {
      fact_refs: [plan.coverage_fact_id],
      text: "已经留下的这些，就足够成为下一次回看的起点。",
    },
    ...(helpfulPattern === undefined
      ? {}
      : { helpful_pattern: helpfulPattern }),
    next_week: {
      fact_refs: [plan.next_observation_fact_id],
      text: nextObservationText(plan.next_observation_plan),
    },
    observations,
    opening: {
      fact_refs: [plan.headline_fact_id, "fact.light.count"],
      text: opening,
    },
    title:
      coverage.coverage_level === "COMPLETE"
        ? "完整七天，先看见真实变化"
        : "这七天，先看见留下的记录",
  });
}

export function createClientWeeklySummaryView(
  input: ClientWeeklyProjectionInput,
): ClientWeeklySummaryView {
  const aggregate = WeeklyAggregateFactsSchema.parse(input.aggregate);
  const published =
    input.published === undefined
      ? undefined
      : PublishedWeeklySummarySchema.parse(input.published);
  if (
    published !== undefined &&
    (published.window_id !== aggregate.window_id ||
      published.source_fingerprint !== aggregate.source_fingerprint)
  ) {
    throw new WeeklyDeterministicError("WEEKLY_PUBLISHED_SOURCE_MISMATCH");
  }
  const summary =
    published === undefined
      ? undefined
      : {
          kind:
            aggregate.coverage.coverage_level === "COMPLETE"
              ? ("COMPLETE_REVIEW" as const)
              : ("PARTIAL_REVIEW" as const),
          paragraphs: [
            published.expression.opening.text,
            ...published.expression.observations.map((item) => item.text),
            ...(published.expression.helpful_pattern === undefined
              ? []
              : [published.expression.helpful_pattern.text]),
            published.expression.next_week.text,
            published.expression.closing.text,
          ],
          revision: published.summary_revision,
          summary_id: published.summary_id,
          title: published.expression.title,
        };
  return ClientWeeklySummaryViewSchema.parse({
    activity: {
      helpfulness: {
        helpful_count: aggregate.helpfulness_facts.helpful_count,
        neutral_count: aggregate.helpfulness_facts.neutral_count,
        not_helpful_count: aggregate.helpfulness_facts.not_helpful_count,
        not_used_count: aggregate.helpfulness_facts.not_used_count,
        rated_day_count: aggregate.helpfulness_facts.rated_day_count,
        ...(aggregate.helpfulness_facts.top_helpful_action_kind === undefined
          ? {}
          : {
              top_helpful_action_kind:
                aggregate.helpfulness_facts.top_helpful_action_kind,
            }),
        unrated_day_count: aggregate.helpfulness_facts.unrated_day_count,
      },
      lit_day_count: aggregate.light_facts.lit_day_count,
      tasks: aggregate.task_facts,
    },
    contract: "weekly-summary-view",
    coverage: {
      checkin_day_count: aggregate.coverage.checkin_day_count,
      evening_feedback_day_count: aggregate.coverage.evening_feedback_day_count,
      level: aggregate.coverage.coverage_level,
      lit_day_count: aggregate.coverage.lit_day_count,
      missing_dates: aggregate.coverage.missing_dates,
      real_state_day_count: aggregate.coverage.real_state_day_count,
      window_day_count: 7,
    },
    data_disclosure: disclosureText(aggregate),
    days: aggregate.day_slots.map((day) => ({
      product_date: day.product_date,
      state: day.state,
      ...(day.morning === undefined ? {} : { morning: day.morning }),
      ...(day.evening === undefined ? {} : { evening: day.evening }),
      is_lit: day.is_lit,
      helpfulness: day.helpfulness,
      ...(day.task_status === undefined
        ? {}
        : { task_status: day.task_status }),
    })),
    metrics: aggregate.state_metrics.map((metric) => ({
      direction: metric.direction,
      direction_label: DIRECTION_LABELS[metric.direction],
      id: metric.metric_id,
      missing_count: metric.missing_count,
      observed_count: metric.observed_count,
      unsure_count: metric.unsure_count,
    })),
    projection_version: "weekly-view-v1",
    ...(input.relationshipDisplayToken === undefined
      ? {}
      : { relationship_display_token: input.relationshipDisplayToken }),
    schema_version: "1.0.0",
    ...(summary === undefined ? {} : { summary }),
    summary_status: input.summaryStatus,
    window_end_date: aggregate.window_end_date,
    window_id: aggregate.window_id,
    window_start_date: aggregate.window_start_date,
  });
}

function deriveMetric(descriptor: MetricDescriptor) {
  const observedValues = descriptor.values.filter(
    (value): value is string => value !== undefined && value !== "UNSURE",
  );
  const unsureCount = descriptor.values.filter(
    (value) => value === "UNSURE",
  ).length;
  const missingCount = descriptor.values.filter(
    (value) => value === undefined,
  ).length;
  const distribution = Object.fromEntries(
    DISTRIBUTION_KEYS[descriptor.id].map((key) => [
      key,
      observedValues.filter((value) => value === key).length,
    ]),
  );
  const mode = deriveMode(distribution);
  const ordinalMap = ORDINALS[descriptor.id] as Readonly<
    Record<string, number>
  >;
  const direction = deriveDirection(
    observedValues.map((value) => {
      const ordinal = ordinalMap[value];
      if (ordinal === undefined) {
        throw new WeeklyDeterministicError("WEEKLY_ORDINAL_UNKNOWN");
      }
      return ordinal;
    }),
  );
  return {
    direction,
    direction_basis_count: observedValues.length,
    distribution,
    metric_id: descriptor.id,
    missing_count: missingCount,
    ...(mode === undefined
      ? {}
      : { mode_count: mode.count, mode_value: mode.value }),
    observed_count: observedValues.length,
    unsure_count: unsureCount,
  };
}

function deriveDirection(values: readonly number[]): Direction {
  if (values.length < 3) {
    return "INSUFFICIENT_DATA";
  }
  const half = Math.floor(values.length / 2);
  const early = values.slice(0, half).reduce((sum, value) => sum + value, 0);
  const late = values.slice(-half).reduce((sum, value) => sum + value, 0);
  const edgeDelta = late - early;
  let rankScore = 0;
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      rankScore += Math.sign(values[right]! - values[left]!);
    }
  }
  const rankThreshold = Math.max(2, values.length - 2);
  if (edgeDelta >= half && rankScore >= rankThreshold) {
    return "HIGHER_LATE";
  }
  if (edgeDelta <= -half && rankScore <= -rankThreshold) {
    return "LOWER_LATE";
  }
  let increases = 0;
  let decreases = 0;
  let variation = 0;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    variation += Math.abs(delta);
    increases += delta > 0 ? 1 : 0;
    decreases += delta < 0 ? 1 : 0;
  }
  const range = Math.max(...values) - Math.min(...values);
  return increases > 0 && decreases > 0 && (range >= 2 || variation >= 3)
    ? "VARIABLE"
    : "SIMILAR";
}

function deriveMode(distribution: Readonly<Record<string, number>>) {
  const sorted = Object.entries(distribution).sort((left, right) => {
    const byCount = right[1] - left[1];
    return byCount === 0 ? left[0].localeCompare(right[0]) : byCount;
  });
  const highest = sorted[0]?.[1] ?? 0;
  const winners = sorted.filter(([, count]) => count === highest);
  return highest >= 2 && winners.length === 1
    ? { count: highest, value: winners[0]![0] }
    : undefined;
}

function deriveHelpfulness(
  daySlots: ReadonlyArray<{
    readonly helpful_action_kind?: string;
    readonly helpfulness: string;
  }>,
) {
  const count = (rating: string) =>
    daySlots.filter((day) => day.helpfulness === rating).length;
  const helpfulCount = count("HELPFUL");
  const kindCounts = new Map<string, number>();
  for (const day of daySlots) {
    if (
      day.helpfulness === "HELPFUL" &&
      day.helpful_action_kind !== undefined
    ) {
      kindCounts.set(
        day.helpful_action_kind,
        (kindCounts.get(day.helpful_action_kind) ?? 0) + 1,
      );
    }
  }
  const sortedKinds = [...kindCounts.entries()].sort((left, right) => {
    const byCount = right[1] - left[1];
    return byCount === 0 ? left[0].localeCompare(right[0]) : byCount;
  });
  const highest = sortedKinds[0]?.[1] ?? 0;
  const eligibleTop =
    helpfulCount >= 2 &&
    highest > 0 &&
    sortedKinds.filter(([, value]) => value === highest).length === 1;
  const ratedDayCount = daySlots.filter(
    (day) => day.helpfulness !== "UNRATED",
  ).length;
  return {
    helpful_action_kind_counts: Object.fromEntries(sortedKinds),
    helpful_count: helpfulCount,
    neutral_count: count("NEUTRAL"),
    not_helpful_count: count("NOT_HELPFUL"),
    not_used_count: count("NOT_USED"),
    rated_day_count: ratedDayCount,
    ...(eligibleTop ? { top_helpful_action_kind: sortedKinds[0]![0] } : {}),
    unrated_day_count: 7 - ratedDayCount,
  };
}

function deriveTasks(
  daySlots: ReadonlyArray<{ readonly task_status?: string }>,
) {
  const count = (status: string) =>
    daySlots.filter((day) => day.task_status === status).length;
  return {
    completed_count: count("COMPLETED"),
    interested_count: count("INTERESTED"),
    skipped_count: count("SKIPPED"),
    task_offered_day_count: daySlots.filter(
      (day) => day.task_status !== undefined,
    ).length,
    unmarked_count: count("UNMARKED"),
  };
}

function coverageLevelFor(realDays: number) {
  return realDays === 0
    ? ("EMPTY" as const)
    : realDays <= 2
      ? ("POINTS_ONLY" as const)
      : realDays <= 6
        ? ("PARTIAL" as const)
        : ("COMPLETE" as const);
}

function choosePlanFacts(
  aggregate: Omit<WeeklyAggregateFacts, "approved_fact_catalog">,
):
  | {
      readonly nextObservationFactId: string;
      readonly nextObservationPlan: WeeklyExpressionPlan["next_observation_plan"];
      readonly observations: readonly ObservationCandidate[];
    }
  | undefined {
  if (
    aggregate.coverage.coverage_level === "EMPTY" ||
    aggregate.coverage.coverage_level === "POINTS_ONLY"
  ) {
    return undefined;
  }
  const candidates = aggregate.state_metrics.map(metricCandidate);
  const morning = candidates
    .filter(
      (candidate): candidate is ObservationCandidate =>
        candidate !== undefined && candidate.metricId !== "EVENING_OVERALL",
    )
    .sort((left, right) => {
      const bySalience = left.salience - right.salience;
      if (bySalience !== 0) {
        return bySalience;
      }
      return (
        ["MORNING_ENERGY", "MORNING_MOOD", "MORNING_SLEEP"].indexOf(
          left.metricId,
        ) -
        ["MORNING_ENERGY", "MORNING_MOOD", "MORNING_SLEEP"].indexOf(
          right.metricId,
        )
      );
    });
  const evening = candidates.find(
    (candidate) => candidate?.metricId === "EVENING_OVERALL",
  );
  const observations: ObservationCandidate[] = [];
  if (morning[0] !== undefined) {
    observations.push(morning[0]);
  }
  if (evening !== undefined && observations.length < 2) {
    observations.push(evening);
  }
  for (const candidate of morning.slice(1)) {
    if (observations.length >= 2) {
      break;
    }
    observations.push(candidate);
  }
  if (observations.length === 0) {
    observations.push({
      factId: "fact.light.count",
      metricId: "MORNING_ENERGY",
      observedFactId: "fact.light.count",
      salience: 4,
    });
  }
  const energy = aggregate.state_metrics.find(
    (metric) => metric.metric_id === "MORNING_ENERGY",
  )!;
  const mood = aggregate.state_metrics.find(
    (metric) => metric.metric_id === "MORNING_MOOD",
  )!;
  const sleep = aggregate.state_metrics.find(
    (metric) => metric.metric_id === "MORNING_SLEEP",
  )!;
  const directional = (direction: Direction) =>
    ["HIGHER_LATE", "LOWER_LATE", "VARIABLE"].includes(direction);
  const next = directional(energy.direction)
    ? (["NOTICE_ENERGY_TIMING", "plan.notice_energy_timing"] as const)
    : directional(mood.direction)
      ? (["NOTICE_MOOD_SHIFTS", "plan.notice_mood_shifts"] as const)
      : directional(sleep.direction) && energy.observed_count >= 3
        ? (["NOTICE_SLEEP_AND_ENERGY", "plan.notice_sleep_and_energy"] as const)
        : aggregate.helpfulness_facts.top_helpful_action_kind !== undefined
          ? (["NOTICE_HELPFUL_ACTIONS", "plan.notice_helpful_actions"] as const)
          : aggregate.coverage.evening_feedback_day_count <
              aggregate.coverage.real_state_day_count
            ? (["KEEP_ONE_SMALL_NOTE", "plan.keep_one_small_note"] as const)
            : ([
                "CONTINUE_WITHOUT_PRESSURE",
                "plan.continue_without_pressure",
              ] as const);
  return {
    nextObservationFactId: next[1],
    nextObservationPlan: next[0],
    observations,
  };
}

function metricCandidate(
  metric: WeeklyAggregateFacts["state_metrics"][number],
): ObservationCandidate | undefined {
  const prefix = METRIC_FACT_PREFIX[metric.metric_id];
  if (metric.direction !== "INSUFFICIENT_DATA") {
    return {
      factId: `fact.${prefix}.direction`,
      metricId: metric.metric_id,
      observedFactId: `fact.${prefix}.observed_count`,
      salience: metric.direction === "SIMILAR" ? 2 : 1,
    };
  }
  return metric.mode_value === undefined
    ? undefined
    : {
        factId: `fact.${prefix}.mode`,
        metricId: metric.metric_id,
        observedFactId: `fact.${prefix}.observed_count`,
        salience: 3,
      };
}

function deriveExpressionPlan(
  aggregate: WeeklyAggregateFacts,
  choice: ReturnType<typeof choosePlanFacts>,
): WeeklyExpressionPlan | undefined {
  if (choice === undefined) {
    return undefined;
  }
  const approved = new Set<string>([
    "fact.coverage.level",
    "fact.coverage.real_days",
    "fact.coverage.missing_days",
    "fact.coverage.disclosure",
    "fact.light.count",
    "fact.feedback.count",
    ...choice.observations.flatMap((candidate) => [
      candidate.factId,
      candidate.observedFactId,
    ]),
    choice.nextObservationFactId,
  ]);
  if (aggregate.helpfulness_facts.top_helpful_action_kind !== undefined) {
    approved.add("fact.helpfulness.top_action_kind");
  }
  return WeeklyExpressionPlanSchema.parse({
    approved_fact_ids: FACT_REGISTRY.filter((fact) => approved.has(fact)),
    coverage_fact_id: "fact.coverage.level",
    coverage_level: aggregate.coverage.coverage_level,
    headline_fact_id: "fact.coverage.real_days",
    ...(aggregate.helpfulness_facts.top_helpful_action_kind === undefined
      ? {}
      : { helpful_pattern_fact_id: "fact.helpfulness.top_action_kind" }),
    next_observation_fact_id: choice.nextObservationFactId,
    next_observation_plan: choice.nextObservationPlan,
    observation_fact_ids: choice.observations.map(
      (candidate) => candidate.factId,
    ),
    source_disclosure_fact_id: "fact.coverage.disclosure",
  });
}

function assertPlanBinding(
  aggregate: WeeklyAggregateFacts,
  plan: WeeklyExpressionPlan,
): void {
  if (
    plan.coverage_level !== aggregate.coverage.coverage_level ||
    plan.approved_fact_ids.some(
      (fact) => !aggregate.approved_fact_catalog.includes(fact),
    )
  ) {
    throw new WeeklyDeterministicError("WEEKLY_PLAN_BINDING_INVALID");
  }
}

function observationText(
  aggregate: WeeklyAggregateFacts,
  factId: string,
): string {
  if (factId === "fact.light.count") {
    return `这七天里，你点亮了 ${aggregate.light_facts.lit_day_count} 天；没有点亮的日期只是如实留空，不代表失败或中断。`;
  }
  const metric = aggregate.state_metrics.find((candidate) =>
    factId.startsWith(`fact.${METRIC_FACT_PREFIX[candidate.metric_id]}.`),
  );
  if (metric === undefined) {
    throw new WeeklyDeterministicError("WEEKLY_OBSERVATION_FACT_UNKNOWN");
  }
  if (factId.endsWith(".direction")) {
    return `基于 ${metric.observed_count} 次可用的${METRIC_LABELS[metric.metric_id]}记录，${DIRECTION_LABELS[metric.direction]}；这只是记录方向，不代表固定状态。`;
  }
  if (factId.endsWith(".mode") && metric.mode_value !== undefined) {
    return `在 ${metric.observed_count} 次可用的${METRIC_LABELS[metric.metric_id]}记录里，较常出现的是“${MODE_LABELS[metric.mode_value] ?? metric.mode_value}”；它只描述这些记录，不代表长期状态。`;
  }
  throw new WeeklyDeterministicError("WEEKLY_OBSERVATION_FACT_UNKNOWN");
}

function helpfulPatternText(aggregate: WeeklyAggregateFacts): string {
  const kind = aggregate.helpfulness_facts.top_helpful_action_kind;
  if (kind === undefined) {
    throw new WeeklyDeterministicError("WEEKLY_HELPFUL_PATTERN_MISSING");
  }
  const count =
    aggregate.helpfulness_facts.helpful_action_kind_counts[kind] ?? 0;
  return `有 ${count} 天明确觉得“${ACTION_LABELS[kind] ?? kind}”类建议有帮助；样本仍有限，不把它当作固定答案。`;
}

function nextObservationText(
  plan: WeeklyExpressionPlan["next_observation_plan"],
): string {
  switch (plan) {
    case "NOTICE_ENERGY_TIMING":
      return "下一周可以轻轻留意一天里什么时候更有余量，不需要每天都记，也不用追求连续。";
    case "NOTICE_MOOD_SHIFTS":
      return "下一周可以轻轻留意心情有变化的时刻，不急着找原因，也不用每天都留下记录。";
    case "NOTICE_SLEEP_AND_ENERGY":
      return "下一周可以分别看看睡眠和精力的记录，不把两者直接连成原因，只保留真实观察。";
    case "NOTICE_HELPFUL_ACTIONS":
      return "下一周可以继续留意哪些小行动确实有帮助，不必照单全做，也不用追求完成数量。";
    case "KEEP_ONE_SMALL_NOTE":
      return "下一周有空时多留下一次晚间整体感受就好，不必补记缺失日期，也不用写长句。";
    case "CONTINUE_WITHOUT_PRESSURE":
      return "下一周照自己的节奏继续记录就好，不必每天出现，也不需要维持一条完美连续线。";
  }
}

function disclosureText(aggregate: WeeklyAggregateFacts): string {
  return `基于 ${aggregate.coverage.real_state_day_count} 天真实状态；${aggregate.coverage.missing_dates.length} 个日期没有记录，未做推断或补齐。`;
}
