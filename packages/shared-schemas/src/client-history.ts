import * as z from "zod";

import { ProductDateSchema, addCustomIssue } from "./common.js";
import {
  ClientDailyContentViewSchema,
  DailyInteractionStateSchema,
} from "./client-daily-content.js";
import { ClientEveningFeedbackViewSchema } from "./client-evening-feedback.js";
import { CheckinViewSchema } from "./public-transport.js";

export const HistoryDayViewSchema = z
  .object({
    product_date: ProductDateSchema,
    checkin: CheckinViewSchema.optional(),
    content: ClientDailyContentViewSchema.optional(),
    interaction: DailyInteractionStateSchema.optional(),
    evening: ClientEveningFeedbackViewSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.checkin === undefined &&
      value.content === undefined &&
      value.interaction === undefined &&
      value.evening === undefined
    ) {
      addCustomIssue(
        context,
        [],
        "must contain at least one recorded day fact",
      );
    }
    for (const [field, productDate] of [
      ["checkin", value.checkin?.product_date],
      ["content", value.content?.product_date],
      ["interaction", value.interaction?.product_date],
      ["evening", value.evening?.product_date],
    ] as const) {
      if (productDate !== undefined && productDate !== value.product_date) {
        addCustomIssue(
          context,
          [field, "product_date"],
          "must match the history product date",
        );
      }
    }
    if (
      value.content !== undefined &&
      value.interaction !== undefined &&
      value.content.result_id !== value.interaction.result_id
    ) {
      addCustomIssue(
        context,
        ["interaction", "result_id"],
        "must match the historical content result",
      );
    }
  });

export type HistoryDayView = z.infer<typeof HistoryDayViewSchema>;

export const HistoryDaySummaryViewSchema = z
  .object({
    product_date: ProductDateSchema,
    state: z.enum(["RECORDED", "MISSING"]),
    is_lit: z.boolean(),
    has_result: z.boolean(),
    has_evening_feedback: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.state === "MISSING" &&
      (value.is_lit || value.has_result || value.has_evening_feedback)
    ) {
      addCustomIssue(
        context,
        ["state"],
        "MISSING days cannot claim recorded facts",
      );
    }
    if (value.is_lit && !value.has_result) {
      addCustomIssue(
        context,
        ["is_lit"],
        "a lit day must have an available result",
      );
    }
  });
export type HistoryDaySummaryView = z.infer<typeof HistoryDaySummaryViewSchema>;

export const HistoryListViewSchema = z
  .object({
    items: z.array(HistoryDaySummaryViewSchema).min(1).max(50),
    next_cursor: z.string().min(1).max(512).optional(),
    page_info: z.object({ has_more: z.boolean() }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const dates = value.items.map((item) => item.product_date);
    if (new Set(dates).size !== dates.length) {
      addCustomIssue(context, ["items"], "product dates must be unique");
    }
    if (
      dates.some((date, index) => index > 0 && date >= (dates[index - 1] ?? ""))
    ) {
      addCustomIssue(context, ["items"], "product dates must be newest first");
    }
    if (value.page_info.has_more !== (value.next_cursor !== undefined)) {
      addCustomIssue(
        context,
        ["page_info", "has_more"],
        "has_more must match next_cursor presence",
      );
    }
  });
export type HistoryListView = z.infer<typeof HistoryListViewSchema>;
