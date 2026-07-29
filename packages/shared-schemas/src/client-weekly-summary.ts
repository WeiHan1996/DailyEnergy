import * as z from "zod";

import {
  ActionKindSchema,
  EnergySchema,
  HelpfulnessStateSchema,
  MoodSchema,
  OpaqueIdSchema,
  OverallFeelingSchema,
  PositiveRevisionSchema,
  ProductDateSchema,
  SemverSchema,
  SleepSchema,
  TaskStatusSchema,
  VersionTokenSchema,
  addCustomIssue,
  countDisplayCharacters,
  generatedTextSchema,
} from "./common.js";
import {
  CoverageLevelSchema,
  WeeklyCountSchema,
  WeeklyDirectionSchema,
  WeeklyMetricIdSchema,
  WeeklyMetricIdValues,
  addWindowIssues,
  expectedCoverageLevel,
} from "./weekly-contract-common.js";

export const TaskFactsSchema = z
  .object({
    task_offered_day_count: WeeklyCountSchema,
    completed_count: WeeklyCountSchema,
    skipped_count: WeeklyCountSchema,
    interested_count: WeeklyCountSchema,
    unmarked_count: WeeklyCountSchema,
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
    rated_day_count: WeeklyCountSchema,
    helpful_count: WeeklyCountSchema,
    neutral_count: WeeklyCountSchema,
    not_helpful_count: WeeklyCountSchema,
    not_used_count: WeeklyCountSchema,
    unrated_day_count: WeeklyCountSchema,
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
    real_state_day_count: WeeklyCountSchema,
    checkin_day_count: WeeklyCountSchema,
    evening_feedback_day_count: WeeklyCountSchema,
    lit_day_count: WeeklyCountSchema,
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
    observed_count: WeeklyCountSchema,
    unsure_count: WeeklyCountSchema,
    missing_count: WeeklyCountSchema,
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
        lit_day_count: WeeklyCountSchema,
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
