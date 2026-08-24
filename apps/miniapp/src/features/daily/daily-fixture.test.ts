import { describe, expect, it } from "vitest";

import {
  projectHistoryDayView,
  projectTodayView,
  type HistoryDayView,
  type TodayView,
} from "../../services/miniapp-api.js";

const resultId = "44444444-4444-4444-8444-444444444444";

export const todayFixture: TodayView = {
  content: {
    contract: "daily-content-view",
    schema_version: "1.0.0",
    result_id: resultId,
    product_date: "2026-08-24",
    result_version: "daily-v1",
    generated_at: "2026-08-24T02:00:00.000Z",
    content_label: "娱乐与行动参考",
    greeting: "早上好，我们先把今天放稳一点。",
    state_response: "你今天的精力还算平稳，少一点切换会更省力。",
    overall: {
      band: "STEADY",
      band_label: "适合稳住",
      summary: "今天适合稳住节奏，再推进一小步。",
    },
    focus_dimension_id: "action",
    dimensions: [
      {
        id: "action",
        label: "行动推进",
        band: "LOW",
        band_label: "适合放轻",
        explanation: "行动先从最小的一步开始，别同时推进。",
        is_focus: true,
      },
      {
        id: "pace",
        label: "今日节奏",
        band: "STEADY",
        band_label: "适合稳住",
        explanation: "节奏保持稳定，不必突然加速。",
        is_focus: false,
      },
      {
        id: "connection",
        label: "沟通连接",
        band: "STEADY",
        band_label: "适合稳住",
        explanation: "沟通多确认一次，减少彼此猜测。",
        is_focus: false,
      },
      {
        id: "resources",
        label: "资源安排",
        band: "STEADY",
        band_label: "适合稳住",
        explanation: "时间和注意力够用，先排清顺序。",
        is_focus: false,
      },
      {
        id: "recovery",
        label: "恢复留白",
        band: "HIGH",
        band_label: "余量较多",
        explanation: "今天有一点留白，可以用来恢复。",
        is_focus: false,
      },
    ],
    core_tip: "先保护注意力，再决定真正要推进的那一件事。",
    explanation_paragraphs: [
      "今天的行动余量偏轻，但恢复留白相对充足。把注意力留给一个清楚的小目标。",
    ],
    primary_action: {
      action_id: "act_reduce_switching",
      instruction: "关掉一个不必要的后台，只推进最重要的一件事。",
      rationale: "减少切换，比勉强提高速度更有效。",
    },
    optional_task: {
      task_id: "task_close_one_background",
      instruction: "现在关闭一个会分散注意力的页面。",
    },
    rituals: [],
    closing: "今天先做好这一件就够了。",
    personalization_notice: "NONE",
  },
  interaction: {
    contract: "daily-interaction-state",
    schema_version: "1.0.0",
    result_id: resultId,
    product_date: "2026-08-24",
    is_lit: false,
    task: {
      task_id: "task_close_one_background",
      revision: 1,
      status: "UNMARKED",
    },
    helpfulness: { rating: "UNRATED", revision: 0 },
    updated_at: "2026-08-24T02:00:00.000Z",
  },
  relationship: {
    encounter_day_count: 0,
    stage: "BEFORE_FIRST_MEETING",
  },
};

export const historyFixture: HistoryDayView = {
  product_date: "2026-08-23",
  checkin: {
    checkin_ref: "55555555-5555-4555-8555-555555555555",
    product_date: "2026-08-23",
    revision: 1,
    mood: "STEADY",
    energy: "LOW",
    sleep: "OKAY",
    write_window: "CLOSED",
    updated_at: "2026-08-23T02:00:00.000Z",
  },
  content: {
    ...todayFixture.content,
    product_date: "2026-08-23",
    generated_at: "2026-08-23T02:00:00.000Z",
  },
  interaction: {
    ...todayFixture.interaction,
    product_date: "2026-08-23",
    updated_at: "2026-08-23T02:00:00.000Z",
  },
};

describe("C-009 synthetic daily fixtures", () => {
  it("passes the strict runtime projectors", () => {
    expect(
      projectTodayView(JSON.parse(JSON.stringify(todayFixture)) as TodayView),
    ).toEqual(todayFixture);
    expect(
      projectHistoryDayView(
        JSON.parse(JSON.stringify(historyFixture)) as HistoryDayView,
      ),
    ).toEqual(historyFixture);
  });
});
