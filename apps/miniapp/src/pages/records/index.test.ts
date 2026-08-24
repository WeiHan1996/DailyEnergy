import { beforeAll, describe, expect, it, vi } from "vitest";

import type { WeeklyView } from "../../services/miniapp-api.js";

vi.stubGlobal("Page", vi.fn());

let createRecordsViewModel: (
  view: WeeklyView,
) => import("./index.js").RecordsViewModel;

beforeAll(async () => {
  ({ createRecordsViewModel } = await import("./index.js"));
});

function pointsOnlyView(): WeeklyView {
  const dates = [
    "2026-08-18",
    "2026-08-19",
    "2026-08-20",
    "2026-08-21",
    "2026-08-22",
    "2026-08-23",
    "2026-08-24",
  ];
  const days: WeeklyView["days"] = dates.map((product_date, index) =>
    index === 1 || index === 5
      ? {
          is_lit: index === 5,
          morning: { energy: "LOW", mood: "STEADY", sleep: "OKAY" },
          product_date,
          state: "RECORDED",
        }
      : { is_lit: false, product_date, state: "MISSING" },
  );
  return {
    activity: {
      helpfulness: {
        helpful_count: 0,
        neutral_count: 0,
        not_helpful_count: 0,
        not_used_count: 0,
        rated_day_count: 0,
        unrated_day_count: 7,
      },
      lit_day_count: 1,
      tasks: {
        completed_count: 0,
        interested_count: 0,
        skipped_count: 0,
        task_offered_day_count: 0,
        unmarked_count: 0,
      },
    },
    contract: "weekly-summary-view",
    coverage: {
      checkin_day_count: 2,
      evening_feedback_day_count: 0,
      level: "POINTS_ONLY",
      lit_day_count: 1,
      missing_dates: dates.filter((_date, index) => index !== 1 && index !== 5),
      real_state_day_count: 2,
      window_day_count: 7,
    },
    data_disclosure: "基于 2 天真实状态；5 个日期没有记录，未做推断或补齐。",
    days,
    metrics: [
      "MORNING_MOOD",
      "MORNING_ENERGY",
      "MORNING_SLEEP",
      "EVENING_OVERALL",
    ].map((id) => ({
      direction: "INSUFFICIENT_DATA" as const,
      direction_label: "记录还不够形成方向",
      id: id as WeeklyView["metrics"][number]["id"],
      missing_count: id === "EVENING_OVERALL" ? 7 : 5,
      observed_count: id === "EVENING_OVERALL" ? 0 : 2,
      unsure_count: 0,
    })),
    projection_version: "weekly-view-v1",
    schema_version: "1.0.0",
    summary_status: "NOT_ELIGIBLE",
    window_end_date: dates[6]!,
    window_id: "weekly-window-example-v1",
    window_start_date: dates[0]!,
  };
}

describe("REC-001 view model", () => {
  it("keeps five explicit chart gaps and avoids trend conclusions", () => {
    const model = createRecordsViewModel(pointsOnlyView());
    expect(model.coverage_text).toContain("只展示离散观察");
    expect(model.charts[0]?.days.filter((day) => day.missing)).toHaveLength(5);
    expect(model.charts[0]?.summary).toContain("记录还不够形成方向");
    expect(model.summary_message).toContain("暂时不下趋势结论");
  });

  it("shows rebuilding copy without carrying a stale summary", () => {
    const model = createRecordsViewModel({
      ...pointsOnlyView(),
      coverage: {
        ...pointsOnlyView().coverage,
        level: "PARTIAL",
        real_state_day_count: 4,
      },
      summary_status: "INVALIDATED",
    });
    expect(model.show_state_notice).toBe(true);
    expect(model.state_message).toContain("旧总结已失效");
    expect(model.summary_paragraphs).toEqual([]);
  });
});
