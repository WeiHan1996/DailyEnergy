import { describe, expect, it } from "vitest";

import {
  ClientDailyContentViewSchema,
  type ExpressionPayload,
  type RuleFacts,
} from "@daily-energy/shared-schemas";

import {
  assembleControlledTemplateDailyResultV1,
  dailyResultFingerprintV1,
  projectClientDailyContentViewV1,
} from "./daily-publication.js";

const facts: RuleFacts = {
  overall: { score: 50, band: "STEADY", label_token: "KEEP_IT_STEADY" },
  dimensions: [
    { id: "pace", score: 50, band: "STEADY", label_token: "KEEP_IT_STEADY" },
    { id: "action", score: 50, band: "STEADY", label_token: "KEEP_IT_STEADY" },
    {
      id: "connection",
      score: 50,
      band: "STEADY",
      label_token: "KEEP_IT_STEADY",
    },
    {
      id: "resources",
      score: 50,
      band: "STEADY",
      label_token: "KEEP_IT_STEADY",
    },
    {
      id: "recovery",
      score: 50,
      band: "STEADY",
      label_token: "KEEP_IT_STEADY",
    },
  ],
  focus_dimension_id: "pace",
  display_order: ["pace", "resources", "action", "recovery", "connection"],
  explanation_basis: [
    { type: "CHECKIN_SIGNAL", code: "checkin.mood.steady.v1" },
    { type: "CHECKIN_SIGNAL", code: "checkin.energy.steady.v1" },
    { type: "CHECKIN_SIGNAL", code: "checkin.sleep.okay.v1" },
    { type: "DIMENSION_SIGNAL", code: "dimension.pace.steady.v1" },
  ],
  action_candidates: [
    {
      action_id: "action.prioritize-one.v1",
      kind: "PRIORITIZE_ONE",
      target_scope: "ONE_PRIORITY",
      effort: "VERY_LIGHT",
      timebox_minutes: 10,
      constraint_token: "ONE_PRIORITY",
      basis_refs: [
        "checkin.mood.steady.v1",
        "checkin.energy.steady.v1",
        "checkin.sleep.okay.v1",
        "dimension.pace.steady.v1",
      ],
    },
  ],
  selected_action_id: "action.prioritize-one.v1",
  optional_task_plan: {
    task_id: "task.write-one-priority.v1",
    kind: "PRIORITIZE_ONE",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
  ritual_facts: [],
};

const expression: ExpressionPayload = {
  greeting: "你好，我们先用一分钟看看今天。",
  state_response:
    "今天的心情比较平稳。先按做得到的范围，只推进一个清楚的小动作。",
  overall_summary: "今天适合稳住节奏，再推进一小步。",
  core_tip: "把注意力放回一个优先项，今天只推进这一件，不增加第二个目标。",
  explanation_paragraphs: [
    "今日节奏先围绕减少切换来安排。今天只把这份提示当作行动参考，不把它写成现实结果，也不替你推断原因。",
    "主要行动只保留一件低负担的小事，先完成明确的第一步，再决定是否继续；余量不够时停下来也可以。",
  ],
  dimension_explanations: {
    pace: "节奏方面适合保持稳定，不必临时加速。",
    action: "行动方面按一个清楚步骤稳稳推进。",
    connection: "沟通方面适合清楚表达，再确认一次。",
    resources: "安排方面保持有限范围，先排清顺序。",
    recovery: "恢复方面保留基本留白，不把日程排满。",
  },
  primary_action: {
    action_id: "action.prioritize-one.v1",
    instruction: "选一件最重要的事，用10分钟只推进这一件。",
    rationale: "减少并行目标，更容易看清真实余量。",
    constraint_label: "一次只做一件",
  },
  optional_task: {
    task_id: "task.write-one-priority.v1",
    instruction: "写下今天最重要的一件事，写完即可。",
  },
  ritual_notes: {},
  closing: "今天先完成这一小步就够了。",
};

describe("C-008 daily publication and client projection", () => {
  it("assembles one strict controlled-template result and stable fingerprint", () => {
    const result = assembleControlledTemplateDailyResultV1({
      expression,
      generatedAt: new Date("2026-08-24T01:00:00.000Z"),
      inputSnapshotRef: "00000000-0000-4000-8000-000000000002",
      productDate: "2026-08-24",
      resultId: "00000000-0000-4000-8000-000000000003",
      resultVersion: "daily-v1",
      ruleFacts: facts,
      safetyPolicyVersion: "safety-baseline-v1",
      templateVersion: "daily-template-v1",
      userRef: "00000000-0000-4000-8000-000000000001",
    });
    expect(dailyResultFingerprintV1(result).toString("hex")).toBe(
      dailyResultFingerprintV1(structuredClone(result)).toString("hex"),
    );
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("projects only the ordered client allowlist and no score/provenance", () => {
    const result = assembleControlledTemplateDailyResultV1({
      expression,
      generatedAt: new Date("2026-08-24T01:00:00.000Z"),
      inputSnapshotRef: "00000000-0000-4000-8000-000000000002",
      productDate: "2026-08-24",
      resultId: "00000000-0000-4000-8000-000000000003",
      resultVersion: "daily-v1",
      ruleFacts: facts,
      safetyPolicyVersion: "safety-baseline-v1",
      templateVersion: "daily-template-v1",
      userRef: "00000000-0000-4000-8000-000000000001",
    });
    const client = projectClientDailyContentViewV1(result);
    expect(ClientDailyContentViewSchema.safeParse(client).success).toBe(true);
    expect(client.dimensions.map(({ id }) => id)).toEqual(facts.display_order);
    expect(JSON.stringify(client)).not.toMatch(/score|provenance|user_ref/u);
  });
});
