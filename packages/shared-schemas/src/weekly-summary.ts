import * as z from "zod";

import {
  ActionKindSchema,
  EnergySchema,
  EnergyValues,
  GenerationModeSchema,
  HelpfulnessRatingSchema,
  HelpfulnessStateSchema,
  MoodSchema,
  MoodValues,
  OpaqueIdSchema,
  OverallFeelingSchema,
  OverallFeelingValues,
  PersonalizationLevelSchema,
  PositiveRevisionSchema,
  ProductDateSchema,
  Rfc3339TimestampSchema,
  SemverSchema,
  SleepSchema,
  SleepValues,
  TaskStatusSchema,
  VersionTokenSchema,
  addCustomIssue,
  areConsecutiveProductDates,
  countDisplayCharacters,
  generatedTextSchema,
} from "./common.js";

export const CoverageLevelValues = [
  "EMPTY",
  "POINTS_ONLY",
  "PARTIAL",
  "COMPLETE",
] as const;
export const CoverageLevelSchema = z.enum(CoverageLevelValues);
export type CoverageLevel = z.infer<typeof CoverageLevelSchema>;

export const WeeklyDirectionValues = [
  "INSUFFICIENT_DATA",
  "LOWER_LATE",
  "SIMILAR",
  "HIGHER_LATE",
  "VARIABLE",
] as const;
export const WeeklyDirectionSchema = z.enum(WeeklyDirectionValues);
export type WeeklyDirection = z.infer<typeof WeeklyDirectionSchema>;

export const WeeklyMetricIdValues = [
  "MORNING_MOOD",
  "MORNING_ENERGY",
  "MORNING_SLEEP",
  "EVENING_OVERALL",
] as const;
export const WeeklyMetricIdSchema = z.enum(WeeklyMetricIdValues);
export type WeeklyMetricId = z.infer<typeof WeeklyMetricIdSchema>;

const SourceCheckinSchema = z
  .object({
    source_ref: OpaqueIdSchema,
    revision: PositiveRevisionSchema,
    mood: MoodSchema,
    energy: EnergySchema,
    sleep: SleepSchema,
  })
  .strict();

const SourceEveningSchema = z
  .object({
    source_ref: OpaqueIdSchema,
    revision: PositiveRevisionSchema,
    overall_feeling: OverallFeelingSchema,
  })
  .strict();

const SourceLightSchema = z
  .object({
    source_ref: OpaqueIdSchema,
    is_lit: z.boolean(),
  })
  .strict();

const SourceHelpfulnessSchema = z
  .object({
    source_ref: OpaqueIdSchema,
    revision: PositiveRevisionSchema,
    rating: HelpfulnessRatingSchema,
    action_kind: ActionKindSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.rating === "HELPFUL" && !value.action_kind) {
      addCustomIssue(
        context,
        ["action_kind"],
        "is required for a HELPFUL source record",
      );
    }
    if (value.rating !== "HELPFUL" && value.action_kind) {
      addCustomIssue(
        context,
        ["action_kind"],
        "must be omitted unless rating is HELPFUL",
      );
    }
  });

const SourceTaskSchema = z
  .object({
    source_ref: OpaqueIdSchema,
    revision: PositiveRevisionSchema,
    status: TaskStatusSchema,
  })
  .strict();

const WeeklySourceDaySchema = z
  .object({
    product_date: ProductDateSchema,
    source_state: z.enum(["RECORDED", "PARTIAL", "MISSING"]),
    checkin: SourceCheckinSchema.optional(),
    evening: SourceEveningSchema.optional(),
    light: SourceLightSchema.optional(),
    helpfulness: SourceHelpfulnessSchema.optional(),
    task: SourceTaskSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasRealState =
      value.checkin !== undefined || value.evening !== undefined;
    if (value.source_state === "MISSING" && hasRealState) {
      addCustomIssue(
        context,
        ["source_state"],
        "cannot be MISSING when a real state record exists",
      );
    }
    if (value.source_state !== "MISSING" && !hasRealState) {
      addCustomIssue(
        context,
        ["source_state"],
        "requires a checkin or evening record",
      );
    }
  });

function expectedCoverageLevel(
  realDays: number,
): z.infer<typeof CoverageLevelSchema> {
  if (realDays === 0) {
    return "EMPTY";
  }
  if (realDays <= 2) {
    return "POINTS_ONLY";
  }
  if (realDays <= 6) {
    return "PARTIAL";
  }
  return "COMPLETE";
}

function addWindowIssues(
  value: {
    window_start_date: string;
    window_end_date: string;
    days: ReadonlyArray<{ product_date: string }>;
  },
  context: z.RefinementCtx,
): void {
  const dates = value.days.map((day) => day.product_date);
  if (!areConsecutiveProductDates(dates)) {
    addCustomIssue(
      context,
      ["days"],
      "must contain seven unique, ascending, consecutive product dates",
    );
  }
  if (dates[0] !== value.window_start_date) {
    addCustomIssue(
      context,
      ["window_start_date"],
      "must match the first day slot",
    );
  }
  if (dates.at(-1) !== value.window_end_date) {
    addCustomIssue(
      context,
      ["window_end_date"],
      "must match the final day slot",
    );
  }
}

export const WeeklySourceSnapshotSchema = z
  .object({
    contract: z.literal("weekly-source-snapshot"),
    schema_version: SemverSchema,
    window_id: OpaqueIdSchema,
    window_start_date: ProductDateSchema,
    window_end_date: ProductDateSchema,
    window_rule_version: VersionTokenSchema,
    days: z.array(WeeklySourceDaySchema).length(7),
    source_fingerprint: OpaqueIdSchema,
  })
  .strict()
  .superRefine(addWindowIssues);
export type WeeklySourceSnapshot = z.infer<typeof WeeklySourceSnapshotSchema>;

const CoverageFactsSchema = z
  .object({
    window_day_count: z.literal(7),
    real_state_day_count: z.number().int().min(0).max(7),
    checkin_day_count: z.number().int().min(0).max(7),
    evening_feedback_day_count: z.number().int().min(0).max(7),
    lit_day_count: z.number().int().min(0).max(7),
    missing_dates: z.array(ProductDateSchema).max(7),
    coverage_level: CoverageLevelSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.coverage_level !== expectedCoverageLevel(value.real_state_day_count)
    ) {
      addCustomIssue(
        context,
        ["coverage_level"],
        `must be ${expectedCoverageLevel(value.real_state_day_count)} for the real-state count`,
      );
    }
    if (new Set(value.missing_dates).size !== value.missing_dates.length) {
      addCustomIssue(context, ["missing_dates"], "dates must be unique");
    }
  });

const AggregateDaySlotSchema = z
  .object({
    product_date: ProductDateSchema,
    state: z.enum(["RECORDED", "MISSING"]),
    morning: z
      .object({ mood: MoodSchema, energy: EnergySchema, sleep: SleepSchema })
      .strict()
      .optional(),
    evening: z
      .object({ overall_feeling: OverallFeelingSchema })
      .strict()
      .optional(),
    is_lit: z.boolean(),
    helpfulness: HelpfulnessStateSchema,
    helpful_action_kind: ActionKindSchema.optional(),
    task_status: TaskStatusSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasRealState =
      value.morning !== undefined || value.evening !== undefined;
    if ((value.state === "RECORDED") !== hasRealState) {
      addCustomIssue(
        context,
        ["state"],
        "must be RECORDED exactly when morning or evening state exists",
      );
    }
    if (value.helpfulness === "HELPFUL" && !value.helpful_action_kind) {
      addCustomIssue(
        context,
        ["helpful_action_kind"],
        "is required for HELPFUL",
      );
    }
    if (value.helpfulness !== "HELPFUL" && value.helpful_action_kind) {
      addCustomIssue(
        context,
        ["helpful_action_kind"],
        "must be omitted unless helpfulness is HELPFUL",
      );
    }
  });

const CountSchema = z.number().int().min(0).max(7);

const MoodDistributionSchema = z
  .object({
    VERY_LOW: CountSchema,
    LOW: CountSchema,
    STEADY: CountSchema,
    GOOD: CountSchema,
    LIGHT: CountSchema,
  })
  .strict();
const EnergyDistributionSchema = z
  .object({
    EMPTY: CountSchema,
    LOW: CountSchema,
    STEADY: CountSchema,
    HIGH: CountSchema,
    FULL: CountSchema,
  })
  .strict();
const SleepDistributionSchema = z
  .object({
    POOR: CountSchema,
    LOW: CountSchema,
    OKAY: CountSchema,
    GOOD: CountSchema,
  })
  .strict();
const EveningDistributionSchema = z
  .object({
    VERY_HEAVY: CountSchema,
    SOMEWHAT_HEAVY: CountSchema,
    STEADY: CountSchema,
    PRETTY_GOOD: CountSchema,
    LIGHT: CountSchema,
  })
  .strict();

const MetricBaseShape = {
  observed_count: CountSchema,
  unsure_count: CountSchema,
  missing_count: CountSchema,
  direction: WeeklyDirectionSchema,
  direction_basis_count: CountSchema,
  summary_token: VersionTokenSchema.optional(),
};

const MoodMetricFactsSchema = z
  .object({
    metric_id: z.literal("MORNING_MOOD"),
    ...MetricBaseShape,
    distribution: MoodDistributionSchema,
    mode_value: z
      .enum(MoodValues.slice(0, -1) as [string, ...string[]])
      .optional(),
    mode_count: CountSchema.optional(),
  })
  .strict();
const EnergyMetricFactsSchema = z
  .object({
    metric_id: z.literal("MORNING_ENERGY"),
    ...MetricBaseShape,
    distribution: EnergyDistributionSchema,
    mode_value: z
      .enum(EnergyValues.slice(0, -1) as [string, ...string[]])
      .optional(),
    mode_count: CountSchema.optional(),
  })
  .strict();
const SleepMetricFactsSchema = z
  .object({
    metric_id: z.literal("MORNING_SLEEP"),
    ...MetricBaseShape,
    distribution: SleepDistributionSchema,
    mode_value: z
      .enum(SleepValues.slice(0, -1) as [string, ...string[]])
      .optional(),
    mode_count: CountSchema.optional(),
  })
  .strict();
const EveningMetricFactsSchema = z
  .object({
    metric_id: z.literal("EVENING_OVERALL"),
    ...MetricBaseShape,
    distribution: EveningDistributionSchema,
    mode_value: z
      .enum(OverallFeelingValues.slice(0, -1) as [string, ...string[]])
      .optional(),
    mode_count: CountSchema.optional(),
  })
  .strict();

export const StateMetricFactsSchema = z
  .discriminatedUnion("metric_id", [
    MoodMetricFactsSchema,
    EnergyMetricFactsSchema,
    SleepMetricFactsSchema,
    EveningMetricFactsSchema,
  ])
  .superRefine((value, context) => {
    if (value.observed_count + value.unsure_count + value.missing_count !== 7) {
      addCustomIssue(
        context,
        [],
        "observed_count + unsure_count + missing_count must equal 7",
      );
    }
    const distribution = Object.entries(value.distribution);
    const distributionTotal = distribution.reduce(
      (total, [, count]) => total + count,
      0,
    );
    if (distributionTotal !== value.observed_count) {
      addCustomIssue(
        context,
        ["distribution"],
        "distribution counts must sum to observed_count",
      );
    }
    if (value.direction_basis_count !== value.observed_count) {
      addCustomIssue(
        context,
        ["direction_basis_count"],
        "must equal observed_count",
      );
    }
    if (value.observed_count < 3 && value.direction !== "INSUFFICIENT_DATA") {
      addCustomIssue(
        context,
        ["direction"],
        "must be INSUFFICIENT_DATA with fewer than three observations",
      );
    }
    if (value.observed_count >= 3 && value.direction === "INSUFFICIENT_DATA") {
      addCustomIssue(
        context,
        ["direction"],
        "must contain a computed direction with at least three observations",
      );
    }

    const sorted = [...distribution].sort((a, b) => b[1] - a[1]);
    const highest = sorted[0]?.[1] ?? 0;
    const uniqueHighest =
      sorted.filter(([, count]) => count === highest).length === 1;
    const eligibleMode =
      value.observed_count >= 2 && highest >= 2 && uniqueHighest;
    if (eligibleMode) {
      const expectedMode = sorted[0]?.[0];
      if (value.mode_value !== expectedMode || value.mode_count !== highest) {
        addCustomIssue(
          context,
          ["mode_value"],
          "mode_value and mode_count must describe the unique eligible mode",
        );
      }
    } else if (
      value.mode_value !== undefined ||
      value.mode_count !== undefined
    ) {
      addCustomIssue(
        context,
        ["mode_value"],
        "mode must be omitted when the minimum or uniqueness rule is not met",
      );
    }
  });
export type StateMetricFacts = z.infer<typeof StateMetricFactsSchema>;

const HelpfulnessFactsSchema = z
  .object({
    rated_day_count: CountSchema,
    helpful_count: CountSchema,
    neutral_count: CountSchema,
    not_helpful_count: CountSchema,
    not_used_count: CountSchema,
    unrated_day_count: CountSchema,
    helpful_action_kind_counts: z.partialRecord(ActionKindSchema, CountSchema),
    top_helpful_action_kind: ActionKindSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const ratedTotal =
      value.helpful_count +
      value.neutral_count +
      value.not_helpful_count +
      value.not_used_count;
    if (ratedTotal !== value.rated_day_count) {
      addCustomIssue(
        context,
        ["rated_day_count"],
        "must equal the sum of rating counts",
      );
    }
    if (value.rated_day_count + value.unrated_day_count !== 7) {
      addCustomIssue(
        context,
        ["unrated_day_count"],
        "rated_day_count + unrated_day_count must equal 7",
      );
    }
    const kinds = Object.entries(value.helpful_action_kind_counts);
    const kindTotal = kinds.reduce((total, [, count]) => total + count, 0);
    if (kindTotal !== value.helpful_count) {
      addCustomIssue(
        context,
        ["helpful_action_kind_counts"],
        "kind counts must sum to helpful_count",
      );
    }
    const sorted = [...kinds].sort((a, b) => b[1] - a[1]);
    const highest = sorted[0]?.[1] ?? 0;
    const uniqueHighest =
      sorted.filter(([, count]) => count === highest).length === 1;
    const eligible = value.helpful_count >= 2 && highest > 0 && uniqueHighest;
    if (eligible && value.top_helpful_action_kind !== sorted[0]?.[0]) {
      addCustomIssue(
        context,
        ["top_helpful_action_kind"],
        "must identify the unique highest kind when at least two helpful samples exist",
      );
    }
    if (!eligible && value.top_helpful_action_kind !== undefined) {
      addCustomIssue(
        context,
        ["top_helpful_action_kind"],
        "must be omitted when the minimum or uniqueness rule is not met",
      );
    }
  });

const TaskFactsSchema = z
  .object({
    task_offered_day_count: CountSchema,
    completed_count: CountSchema,
    skipped_count: CountSchema,
    interested_count: CountSchema,
    unmarked_count: CountSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const total =
      value.completed_count +
      value.skipped_count +
      value.interested_count +
      value.unmarked_count;
    if (total !== value.task_offered_day_count) {
      addCustomIssue(
        context,
        ["task_offered_day_count"],
        "must equal the sum of task status counts",
      );
    }
  });

const ClientHelpfulnessFactsSchema = z
  .object({
    rated_day_count: CountSchema,
    helpful_count: CountSchema,
    neutral_count: CountSchema,
    not_helpful_count: CountSchema,
    not_used_count: CountSchema,
    unrated_day_count: CountSchema,
    top_helpful_action_kind: ActionKindSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const ratedTotal =
      value.helpful_count +
      value.neutral_count +
      value.not_helpful_count +
      value.not_used_count;
    if (ratedTotal !== value.rated_day_count) {
      addCustomIssue(
        context,
        ["rated_day_count"],
        "must equal the sum of rating counts",
      );
    }
    if (value.rated_day_count + value.unrated_day_count !== 7) {
      addCustomIssue(
        context,
        ["unrated_day_count"],
        "rated_day_count + unrated_day_count must equal 7",
      );
    }
    if (value.top_helpful_action_kind && value.helpful_count < 2) {
      addCustomIssue(
        context,
        ["top_helpful_action_kind"],
        "requires at least two helpful samples",
      );
    }
  });

export const WeeklyAggregateFactsSchema = z
  .object({
    contract: z.literal("weekly-aggregate-facts"),
    schema_version: SemverSchema,
    window_id: OpaqueIdSchema,
    window_start_date: ProductDateSchema,
    window_end_date: ProductDateSchema,
    coverage: CoverageFactsSchema,
    day_slots: z.array(AggregateDaySlotSchema).length(7),
    state_metrics: z.array(StateMetricFactsSchema).length(4),
    light_facts: z.object({ lit_day_count: CountSchema }).strict(),
    feedback_facts: z
      .object({ evening_feedback_day_count: CountSchema })
      .strict(),
    helpfulness_facts: HelpfulnessFactsSchema,
    task_facts: TaskFactsSchema,
    approved_fact_catalog: z.array(VersionTokenSchema).min(1).max(32),
    source_fingerprint: OpaqueIdSchema,
    aggregate_version: VersionTokenSchema,
  })
  .strict()
  .superRefine((value, context) => {
    addWindowIssues(
      {
        window_start_date: value.window_start_date,
        window_end_date: value.window_end_date,
        days: value.day_slots,
      },
      context,
    );
    const realDays = value.day_slots.filter(
      (day) => day.state === "RECORDED",
    ).length;
    const checkinDays = value.day_slots.filter((day) => day.morning).length;
    const eveningDays = value.day_slots.filter((day) => day.evening).length;
    const litDays = value.day_slots.filter((day) => day.is_lit).length;
    const missingDates = value.day_slots
      .filter((day) => day.state === "MISSING")
      .map((day) => day.product_date);
    const expectedCounts: Array<[string, number, number]> = [
      ["real_state_day_count", value.coverage.real_state_day_count, realDays],
      ["checkin_day_count", value.coverage.checkin_day_count, checkinDays],
      [
        "evening_feedback_day_count",
        value.coverage.evening_feedback_day_count,
        eveningDays,
      ],
      ["lit_day_count", value.coverage.lit_day_count, litDays],
    ];
    expectedCounts.forEach(([field, actual, expected]) => {
      if (actual !== expected) {
        addCustomIssue(context, ["coverage", field], `must equal ${expected}`);
      }
    });
    if (
      JSON.stringify(value.coverage.missing_dates) !==
      JSON.stringify(missingDates)
    ) {
      addCustomIssue(
        context,
        ["coverage", "missing_dates"],
        "must equal the missing day slots in ascending order",
      );
    }
    if (value.light_facts.lit_day_count !== litDays) {
      addCustomIssue(
        context,
        ["light_facts", "lit_day_count"],
        `must equal ${litDays}`,
      );
    }
    if (value.feedback_facts.evening_feedback_day_count !== eveningDays) {
      addCustomIssue(
        context,
        ["feedback_facts", "evening_feedback_day_count"],
        `must equal ${eveningDays}`,
      );
    }
    const metricIds = value.state_metrics.map((metric) => metric.metric_id);
    if (
      new Set(metricIds).size !== 4 ||
      !WeeklyMetricIdValues.every((id) => metricIds.includes(id))
    ) {
      addCustomIssue(
        context,
        ["state_metrics"],
        "must contain each metric exactly once",
      );
    }
    if (
      new Set(value.approved_fact_catalog).size !==
      value.approved_fact_catalog.length
    ) {
      addCustomIssue(
        context,
        ["approved_fact_catalog"],
        "fact IDs must be unique",
      );
    }
  });
export type WeeklyAggregateFacts = z.infer<typeof WeeklyAggregateFactsSchema>;

export const NextObservationPlanValues = [
  "NOTICE_ENERGY_TIMING",
  "NOTICE_MOOD_SHIFTS",
  "NOTICE_SLEEP_AND_ENERGY",
  "NOTICE_HELPFUL_ACTIONS",
  "KEEP_ONE_SMALL_NOTE",
  "CONTINUE_WITHOUT_PRESSURE",
] as const;
export const NextObservationPlanSchema = z.enum(NextObservationPlanValues);
export type NextObservationPlan = z.infer<typeof NextObservationPlanSchema>;

export const WeeklyExpressionPlanSchema = z
  .object({
    coverage_level: z.enum(["PARTIAL", "COMPLETE"]),
    approved_fact_ids: z.array(VersionTokenSchema).min(3).max(12),
    headline_fact_id: VersionTokenSchema,
    observation_fact_ids: z.array(VersionTokenSchema).min(1).max(2),
    helpful_pattern_fact_id: VersionTokenSchema.optional(),
    next_observation_plan: NextObservationPlanSchema,
    next_observation_fact_id: VersionTokenSchema,
    coverage_fact_id: VersionTokenSchema,
    source_disclosure_fact_id: VersionTokenSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const allowed = new Set(value.approved_fact_ids);
    const refs = [
      value.headline_fact_id,
      ...value.observation_fact_ids,
      value.helpful_pattern_fact_id,
      value.next_observation_fact_id,
      value.coverage_fact_id,
      value.source_disclosure_fact_id,
    ].filter((item): item is string => item !== undefined);
    refs.forEach((ref) => {
      if (!allowed.has(ref)) {
        addCustomIssue(
          context,
          ["approved_fact_ids"],
          `must include referenced fact ${ref}`,
        );
      }
    });
    if (
      new Set(value.approved_fact_ids).size !== value.approved_fact_ids.length
    ) {
      addCustomIssue(context, ["approved_fact_ids"], "fact IDs must be unique");
    }
  });
export type WeeklyExpressionPlan = z.infer<typeof WeeklyExpressionPlanSchema>;

function expressionSegmentSchema(
  min: number,
  max: number,
  minRefs: number,
  maxRefs: number,
) {
  return z
    .object({
      text: generatedTextSchema(min, max),
      fact_refs: z.array(VersionTokenSchema).min(minRefs).max(maxRefs),
    })
    .strict()
    .superRefine((value, context) => {
      if (new Set(value.fact_refs).size !== value.fact_refs.length) {
        addCustomIssue(context, ["fact_refs"], "fact refs must be unique");
      }
    });
}

const OpeningSegmentSchema = expressionSegmentSchema(20, 55, 1, 2);
const ObservationSegmentSchema = expressionSegmentSchema(30, 80, 1, 2);
const HelpfulPatternSegmentSchema = expressionSegmentSchema(20, 55, 1, 1);
const NextWeekSegmentSchema = expressionSegmentSchema(20, 55, 1, 1);
const ClosingSegmentSchema = expressionSegmentSchema(10, 30, 1, 1);

export const WeeklyExpressionPayloadSchema = z
  .object({
    title: generatedTextSchema(8, 24),
    opening: OpeningSegmentSchema,
    observations: z.array(ObservationSegmentSchema).min(1).max(2),
    helpful_pattern: HelpfulPatternSegmentSchema.optional(),
    next_week: NextWeekSegmentSchema,
    closing: ClosingSegmentSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const body = [
      value.opening.text,
      ...value.observations.map((item) => item.text),
      value.helpful_pattern?.text,
      value.next_week.text,
      value.closing.text,
    ].filter((item): item is string => item !== undefined);
    const length = body.reduce(
      (total, item) => total + countDisplayCharacters(item),
      0,
    );
    if (length < 120 || length > 260) {
      addCustomIssue(
        context,
        [],
        "body text must contain 120 to 260 display characters in total",
      );
    }
  });
export type WeeklyExpressionPayload = z.infer<
  typeof WeeklyExpressionPayloadSchema
>;

function weeklyExpressionRefs(
  value: z.infer<typeof WeeklyExpressionPayloadSchema>,
) {
  return [
    ...value.opening.fact_refs,
    ...value.observations.flatMap((item) => item.fact_refs),
    ...(value.helpful_pattern?.fact_refs ?? []),
    ...value.next_week.fact_refs,
    ...value.closing.fact_refs,
  ];
}

export const PublishedWeeklySummarySchema = z
  .object({
    contract: z.literal("weekly-summary"),
    schema_version: SemverSchema,
    summary_id: OpaqueIdSchema,
    summary_revision: PositiveRevisionSchema,
    window_id: OpaqueIdSchema,
    window_start_date: ProductDateSchema,
    window_end_date: ProductDateSchema,
    source_fingerprint: OpaqueIdSchema,
    aggregate_facts_ref: OpaqueIdSchema,
    expression_version: VersionTokenSchema,
    expression_plan: WeeklyExpressionPlanSchema,
    expression: WeeklyExpressionPayloadSchema,
    source_dependencies: z
      .array(
        z
          .object({
            source_ref: OpaqueIdSchema,
            source_revision: PositiveRevisionSchema,
            purpose: VersionTokenSchema,
          })
          .strict(),
      )
      .max(24),
    privacy_fallbacks: z.record(
      VersionTokenSchema,
      generatedTextSchema(4, 100),
    ),
    provenance: z
      .object({
        generation_mode: GenerationModeSchema,
        personalization_level: PersonalizationLevelSchema,
        prompt_version: VersionTokenSchema.optional(),
        template_version: VersionTokenSchema.optional(),
        provider: VersionTokenSchema.optional(),
        model: VersionTokenSchema.optional(),
        safety_policy_version: VersionTokenSchema,
      })
      .strict(),
    validation: z
      .object({
        status: z.literal("PASSED"),
        validated_at: Rfc3339TimestampSchema,
      })
      .strict(),
    published_at: Rfc3339TimestampSchema,
    supersedes_summary_id: OpaqueIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const start = Date.parse(`${value.window_start_date}T00:00:00Z`);
    const end = Date.parse(`${value.window_end_date}T00:00:00Z`);
    if (end - start !== 6 * 86_400_000) {
      addCustomIssue(
        context,
        ["window_end_date"],
        "must be six days after window_start_date",
      );
    }
    const allowed = new Set(value.expression_plan.approved_fact_ids);
    weeklyExpressionRefs(value.expression).forEach((ref) => {
      if (!allowed.has(ref)) {
        addCustomIssue(
          context,
          ["expression"],
          `fact ref ${ref} is not approved by the expression plan`,
        );
      }
    });
    if (
      (value.expression.helpful_pattern !== undefined) !==
      (value.expression_plan.helpful_pattern_fact_id !== undefined)
    ) {
      addCustomIssue(
        context,
        ["expression", "helpful_pattern"],
        "presence must match helpful_pattern_fact_id",
      );
    }
  });
export type PublishedWeeklySummary = z.infer<
  typeof PublishedWeeklySummarySchema
>;

export const SummaryStatusValues = [
  "NOT_ELIGIBLE",
  "ELIGIBLE",
  "GENERATING",
  "AVAILABLE",
  "INVALIDATED",
  "FAILED",
] as const;
export const SummaryStatusSchema = z.enum(SummaryStatusValues);
export type SummaryStatus = z.infer<typeof SummaryStatusSchema>;

const ClientCoverageSchema = z
  .object({
    level: CoverageLevelSchema,
    window_day_count: z.literal(7),
    real_state_day_count: CountSchema,
    checkin_day_count: CountSchema,
    evening_feedback_day_count: CountSchema,
    lit_day_count: CountSchema,
    missing_dates: z.array(ProductDateSchema).max(7),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.level !== expectedCoverageLevel(value.real_state_day_count)) {
      addCustomIssue(
        context,
        ["level"],
        `must be ${expectedCoverageLevel(value.real_state_day_count)}`,
      );
    }
  });

const ClientDaySchema = z
  .object({
    product_date: ProductDateSchema,
    state: z.enum(["RECORDED", "MISSING"]),
    morning: z
      .object({ mood: MoodSchema, energy: EnergySchema, sleep: SleepSchema })
      .strict()
      .optional(),
    evening: z
      .object({ overall_feeling: OverallFeelingSchema })
      .strict()
      .optional(),
    is_lit: z.boolean(),
    helpfulness: HelpfulnessStateSchema.optional(),
    task_status: TaskStatusSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasRealState =
      value.morning !== undefined || value.evening !== undefined;
    if ((value.state === "RECORDED") !== hasRealState) {
      addCustomIssue(
        context,
        ["state"],
        "must be RECORDED exactly when morning or evening state exists",
      );
    }
  });

const ClientMetricSchema = z
  .object({
    id: WeeklyMetricIdSchema,
    observed_count: CountSchema,
    unsure_count: CountSchema,
    missing_count: CountSchema,
    direction: WeeklyDirectionSchema,
    direction_label: generatedTextSchema(4, 24),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.observed_count + value.unsure_count + value.missing_count !== 7) {
      addCustomIssue(context, [], "metric counts must sum to 7");
    }
    if (value.observed_count < 3 && value.direction !== "INSUFFICIENT_DATA") {
      addCustomIssue(
        context,
        ["direction"],
        "must be INSUFFICIENT_DATA with fewer than three observations",
      );
    }
  });

const ClientSummarySchema = z
  .object({
    summary_id: OpaqueIdSchema,
    revision: PositiveRevisionSchema,
    kind: z.enum(["PARTIAL_REVIEW", "COMPLETE_REVIEW"]),
    title: generatedTextSchema(8, 24),
    paragraphs: z.array(generatedTextSchema(10, 100)).min(2).max(5),
  })
  .strict()
  .superRefine((value, context) => {
    const length = value.paragraphs.reduce(
      (total, item) => total + countDisplayCharacters(item),
      0,
    );
    if (length < 120 || length > 260) {
      addCustomIssue(
        context,
        ["paragraphs"],
        "must contain 120 to 260 display characters in total",
      );
    }
  });

export const ClientWeeklySummaryViewSchema = z
  .object({
    contract: z.literal("weekly-summary-view"),
    schema_version: SemverSchema,
    window_id: OpaqueIdSchema,
    window_start_date: ProductDateSchema,
    window_end_date: ProductDateSchema,
    projection_version: VersionTokenSchema,
    coverage: ClientCoverageSchema,
    days: z.array(ClientDaySchema).length(7),
    metrics: z.array(ClientMetricSchema).length(4),
    activity: z
      .object({
        lit_day_count: CountSchema,
        helpfulness: ClientHelpfulnessFactsSchema,
        tasks: TaskFactsSchema,
      })
      .strict(),
    summary: ClientSummarySchema.optional(),
    summary_status: SummaryStatusSchema,
    data_disclosure: generatedTextSchema(20, 80),
    relationship_display_token: VersionTokenSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    addWindowIssues(value, context);
    const realDays = value.days.filter(
      (day) => day.state === "RECORDED",
    ).length;
    const checkinDays = value.days.filter((day) => day.morning).length;
    const eveningDays = value.days.filter((day) => day.evening).length;
    const litDays = value.days.filter((day) => day.is_lit).length;
    const missingDates = value.days
      .filter((day) => day.state === "MISSING")
      .map((day) => day.product_date);
    if (value.coverage.real_state_day_count !== realDays) {
      addCustomIssue(
        context,
        ["coverage", "real_state_day_count"],
        `must equal ${realDays}`,
      );
    }
    if (value.coverage.checkin_day_count !== checkinDays) {
      addCustomIssue(
        context,
        ["coverage", "checkin_day_count"],
        `must equal ${checkinDays}`,
      );
    }
    if (value.coverage.evening_feedback_day_count !== eveningDays) {
      addCustomIssue(
        context,
        ["coverage", "evening_feedback_day_count"],
        `must equal ${eveningDays}`,
      );
    }
    if (
      value.coverage.lit_day_count !== litDays ||
      value.activity.lit_day_count !== litDays
    ) {
      addCustomIssue(
        context,
        ["coverage", "lit_day_count"],
        `coverage and activity counts must equal ${litDays}`,
      );
    }
    if (
      JSON.stringify(value.coverage.missing_dates) !==
      JSON.stringify(missingDates)
    ) {
      addCustomIssue(
        context,
        ["coverage", "missing_dates"],
        "must equal missing day slots in ascending order",
      );
    }
    const metricIds = value.metrics.map((metric) => metric.id);
    if (
      new Set(metricIds).size !== 4 ||
      !WeeklyMetricIdValues.every((id) => metricIds.includes(id))
    ) {
      addCustomIssue(
        context,
        ["metrics"],
        "must contain each metric exactly once",
      );
    }
    if (
      (value.summary_status === "AVAILABLE") !==
      (value.summary !== undefined)
    ) {
      addCustomIssue(
        context,
        ["summary"],
        "must be present exactly when summary_status is AVAILABLE",
      );
    }
    if (
      ["EMPTY", "POINTS_ONLY"].includes(value.coverage.level) &&
      value.summary_status !== "NOT_ELIGIBLE"
    ) {
      addCustomIssue(
        context,
        ["summary_status"],
        "insufficient coverage must be NOT_ELIGIBLE",
      );
    }
  });
export type ClientWeeklySummaryView = z.infer<
  typeof ClientWeeklySummaryViewSchema
>;
