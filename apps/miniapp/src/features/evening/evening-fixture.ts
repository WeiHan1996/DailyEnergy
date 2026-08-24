import type { EveningView } from "../../services/miniapp-api.js";

export const emptyView: EveningView = {
  availability: "EDITABLE_EMPTY",
  completion_message: "今天先到这里，这些记录已经留下了。",
  contract: "evening-feedback-view",
  helpfulness: { rating: "UNRATED", revision: 0 },
  note_max_characters: 80,
  options: {
    helpfulness: ["HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
    overall_feeling: [
      "VERY_HEAVY",
      "SOMEWHAT_HEAVY",
      "STEADY",
      "PRETTY_GOOD",
      "LIGHT",
      "UNSURE",
    ],
    task_status: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
  },
  primary_action: "SAVE",
  product_date: "2026-08-24",
  schema_version: "1.0.0",
  task: {
    instruction: "现在关闭一个会分散注意力的页面。",
    revision: 1,
    status: "UNMARKED",
    task_id: "task.close-one-distraction.v1",
  },
  write_window: "OPEN",
};
