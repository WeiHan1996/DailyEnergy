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
