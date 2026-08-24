import { describe, expect, it } from "vitest";

import { HistoryListViewSchema, LightDayRequestSchema } from "../src/index.js";

describe("C-011 light and history contracts", () => {
  it("binds a light command to the original product date and result", () => {
    const valid = {
      command_ref: "light-command-0001",
      product_date: "2026-08-24",
      result_ref: "33333333-3333-4333-8333-333333333333",
    };
    expect(LightDayRequestSchema.safeParse(valid).success).toBe(true);
    for (const field of [
      "account_id",
      "session_id",
      "main_action_reached",
      "scroll_percent",
      "deletion_epoch",
    ]) {
      expect(
        LightDayRequestSchema.safeParse({ ...valid, [field]: "forged" })
          .success,
      ).toBe(false);
    }
  });

  it("keeps missing dates explicit and rejects invented facts", () => {
    const valid = {
      items: [
        {
          product_date: "2026-08-24",
          state: "RECORDED",
          is_lit: true,
          has_result: true,
          has_evening_feedback: false,
        },
        {
          product_date: "2026-08-23",
          state: "MISSING",
          is_lit: false,
          has_result: false,
          has_evening_feedback: false,
        },
      ],
      page_info: { has_more: false },
    };
    expect(HistoryListViewSchema.safeParse(valid).success).toBe(true);
    expect(
      HistoryListViewSchema.safeParse({
        ...valid,
        items: [
          valid.items[0],
          { ...valid.items[1], is_lit: true, has_result: true },
        ],
      }).success,
    ).toBe(false);
    expect(
      HistoryListViewSchema.safeParse({
        ...valid,
        next_cursor: "cursor",
      }).success,
    ).toBe(false);
  });
});
