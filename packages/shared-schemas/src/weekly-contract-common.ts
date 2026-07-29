import * as z from "zod";

import { addCustomIssue, areConsecutiveProductDates } from "./common.js";

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

export const WeeklyCountSchema = z.number().int().min(0).max(7);

export function expectedCoverageLevel(
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

export function addWindowIssues(
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
