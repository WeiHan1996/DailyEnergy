import * as z from "zod";

import {
  ControlledExpressionPlanV1Schema,
  WeeklyAggregateFactsSchema,
  WeeklyExpressionPlanSchema,
  type ControlledExpressionPlanV1,
  type WeeklyAggregateFacts,
  type WeeklyExpressionPlan,
} from "@daily-energy/shared-schemas";

import { DAILY_TEMPLATE_REGISTRY_V1 } from "./daily-template-registry.js";
import {
  projectPreferredNameV1,
  validateDailyPlanCatalogBindingsV1,
} from "./render-daily-template.js";
import {
  DAILY_PROMPT_VERSION,
  WEEKLY_PROMPT_VERSION,
  type PromptWorkloadV1,
} from "./prompt-package-registry.js";

const StableTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u);
const CheckinFieldSchema = z.enum(["mood", "energy", "sleep"]);
const ProhibitedInferenceSchema = z.enum([
  "CAUSE",
  "DERIVED_METRIC",
  "FUTURE_PREDICTION",
  "LONG_TERM_TRAIT",
  "PROFESSIONAL_CONCLUSION",
]);
const WEEKLY_FACT_IDS = [
  "fact.coverage.level",
  "fact.coverage.real_days",
  "fact.coverage.missing_days",
  "fact.coverage.checkin_days",
  "fact.coverage.disclosure",
  "fact.light.count",
  "fact.feedback.count",
  "fact.mood.direction",
  "fact.mood.observed_count",
  "fact.mood.mode",
  "fact.energy.direction",
  "fact.energy.observed_count",
  "fact.energy.mode",
  "fact.sleep.direction",
  "fact.sleep.observed_count",
  "fact.sleep.mode",
  "fact.evening.direction",
  "fact.evening.observed_count",
  "fact.evening.mode",
  "fact.helpfulness.rated_count",
  "fact.helpfulness.helpful_count",
  "fact.helpfulness.top_action_kind",
  "fact.task.offered_count",
  "fact.task.completed_count",
  "plan.notice_energy_timing",
  "plan.notice_mood_shifts",
  "plan.notice_sleep_and_energy",
  "plan.notice_helpful_actions",
  "plan.keep_one_small_note",
  "plan.continue_without_pressure",
] as const;
const WeeklyFactIdSchema = z.enum(WEEKLY_FACT_IDS);

export const PreparedDailyPromptInputV1Schema = z
  .strictObject({
    contract: z.literal("prepared-daily-prompt-input-v1"),
    prompt_version: z.literal(DAILY_PROMPT_VERSION),
    locale: z.literal("zh-CN"),
    output_schema_version: z.literal("1.0.0"),
    personalization_level: z.enum(["FULL", "REDUCED"]),
    assertion_mode: z.enum(["LOW_ASSERTION", "PARTIAL_ASSERTION", "STANDARD"]),
    template_variant_id: StableTokenSchema,
    requested_expression_style: z.enum([
      "BALANCED",
      "GENTLE",
      "LIGHT_HUMOR",
      "CLEAR_DIRECT",
    ]),
    effective_expression_constraints: z.strictObject({
      humor_ceiling: z.enum(["NONE", "LIGHT"]),
      pressure_ceiling: z.enum(["VERY_LOW", "LIGHT"]),
      opening_requirement: z.enum([
        "UNCERTAINTY_FIRST",
        "CARE_FIRST",
        "FACT_FIRST",
      ]),
      dimension_explanation_mode: z.enum([
        "NON_ASSERTIVE",
        "KNOWN_SIGNALS_ONLY",
        "BAND_GUIDANCE",
      ]),
    }),
    opening_requirement: z.enum([
      "UNCERTAINTY_FIRST",
      "CARE_FIRST",
      "FACT_FIRST",
    ]),
    overall: z.strictObject({
      band: z.enum(["LOW", "STEADY", "HIGH"]),
      label_token: StableTokenSchema,
      allowed_meaning: z.string().min(1).max(80),
    }),
    dimensions: z
      .array(
        z.strictObject({
          id: z.enum(["pace", "action", "connection", "resources", "recovery"]),
          band: z.enum(["LOW", "STEADY", "HIGH"]),
          allowed_meaning: z.string().min(1).max(80),
        }),
      )
      .length(5),
    focus_dimension_id: z.enum([
      "pace",
      "action",
      "connection",
      "resources",
      "recovery",
    ]),
    supporting_dimension_id: z
      .enum(["pace", "action", "connection", "resources", "recovery"])
      .optional(),
    care_dimension_id: z
      .enum(["pace", "action", "connection", "resources", "recovery"])
      .optional(),
    state_evidence: z
      .array(
        z.strictObject({
          basis_code: StableTokenSchema,
          field: CheckinFieldSchema,
          value_token: StableTokenSchema,
          allowed_phrase: z.string().min(1).max(40),
        }),
      )
      .max(3),
    uncertain_fields: z.array(CheckinFieldSchema).max(3),
    primary_action: z.strictObject({
      action_id: StableTokenSchema,
      kind: StableTokenSchema,
      target_scope: StableTokenSchema,
      effort: StableTokenSchema,
      timebox_minutes: z.number().int().positive().max(60).optional(),
      constraint_token: StableTokenSchema.optional(),
      allowed_instruction: z.string().min(1).max(100),
      constraint_label: z.string().min(1).max(24).optional(),
    }),
    optional_task: z.strictObject({
      task_id: StableTokenSchema,
      kind: StableTokenSchema,
      effort: StableTokenSchema,
      timebox_minutes: z.number().int().positive().max(60).optional(),
      allowed_instruction: z.string().min(1).max(80),
    }),
    rituals: z
      .array(
        z.strictObject({
          ritual_id: StableTokenSchema,
          kind: z.enum(["COLOR", "NUMBER"]),
          value: z.union([
            z.string().min(1).max(32),
            z.number().int().min(1).max(9),
          ]),
          display_label: z.string().min(1).max(24),
        }),
      )
      .max(2),
    greeting: z.strictObject({
      relationship_mode: z.literal("GENERIC"),
      preferred_name: z.string().min(1).max(20).optional(),
    }),
    segment_rules: z.strictObject({
      required_sections: z.array(StableTokenSchema).length(10),
      state_response_max_evidence: z.literal(1),
      explanation_paragraphs_max: z.literal(2),
      core_display_characters_max: z.literal(320),
      full_display_characters_max: z.literal(480),
    }),
    prohibited_claim_classes: z.array(StableTokenSchema).length(9),
  })
  .superRefine((value, context) => {
    const ids = value.dimensions.map(({ id }) => id);
    if (
      JSON.stringify(ids) !==
      JSON.stringify(["pace", "action", "connection", "resources", "recovery"])
    ) {
      context.addIssue({
        code: "custom",
        message: "dimensions must use canonical order",
        path: ["dimensions"],
      });
    }
    if (
      value.opening_requirement !==
      value.effective_expression_constraints.opening_requirement
    ) {
      context.addIssue({
        code: "custom",
        message: "opening requirement must match effective constraints",
        path: ["opening_requirement"],
      });
    }
  });

const PromptFactV1Schema = z.strictObject({
  fact_id: WeeklyFactIdSchema,
  fact_kind: z.enum([
    "COVERAGE",
    "COUNT",
    "DIRECTION",
    "MODE",
    "HELPFUL_ACTION",
    "NEXT_OBSERVATION",
    "DISCLOSURE",
  ]),
  display_value: z.string().min(1).max(160),
  allowed_claim: z.string().min(1).max(240),
  allowed_numeric_literals: z.array(z.string().regex(/^\d+$/u)).max(4),
  allowed_date_literals: z.tuple([]),
  prohibited_inferences: z.array(ProhibitedInferenceSchema).min(1).max(5),
});

const SegmentRefsSchema = z.strictObject({
  exact_fact_refs: z.array(WeeklyFactIdSchema).min(1).max(2),
});

export const PreparedWeeklyPromptInputV1Schema = z
  .strictObject({
    contract: z.literal("prepared-weekly-prompt-input-v1"),
    prompt_version: z.literal(WEEKLY_PROMPT_VERSION),
    locale: z.literal("zh-CN"),
    output_schema_version: z.literal("1.0.0"),
    personalization_level: z.enum(["FULL", "REDUCED"]),
    coverage_level: z.enum(["PARTIAL", "COMPLETE"]),
    approved_facts: z.array(PromptFactV1Schema).min(3).max(12),
    segment_contracts: z.strictObject({
      opening: SegmentRefsSchema,
      observations: z
        .array(
          z.strictObject({
            ordinal: z.number().int().min(1).max(2),
            exact_fact_refs: z.array(WeeklyFactIdSchema).min(1).max(2),
          }),
        )
        .min(1)
        .max(2),
      helpful_pattern: SegmentRefsSchema.optional(),
      next_week: SegmentRefsSchema,
      closing: SegmentRefsSchema,
    }),
    body_limits: z.strictObject({
      title_characters_min: z.literal(8),
      title_characters_max: z.literal(24),
      body_characters_min: z.literal(120),
      body_characters_max: z.literal(260),
    }),
    prohibited_claim_classes: z.array(StableTokenSchema).min(9).max(16),
  })
  .superRefine((value, context) => {
    const approved = value.approved_facts.map(({ fact_id }) => fact_id);
    const refs = [
      ...value.segment_contracts.opening.exact_fact_refs,
      ...value.segment_contracts.observations.flatMap(
        ({ exact_fact_refs }) => exact_fact_refs,
      ),
      ...(value.segment_contracts.helpful_pattern?.exact_fact_refs ?? []),
      ...value.segment_contracts.next_week.exact_fact_refs,
      ...value.segment_contracts.closing.exact_fact_refs,
    ];
    if (new Set(approved).size !== approved.length) {
      context.addIssue({
        code: "custom",
        message: "approved fact IDs must be unique",
        path: ["approved_facts"],
      });
    }
    if (refs.some((factId) => !approved.includes(factId))) {
      context.addIssue({
        code: "custom",
        message: "segment refs must belong to approved facts",
        path: ["segment_contracts"],
      });
    }
    value.segment_contracts.observations.forEach((observation, index) => {
      if (observation.ordinal !== index + 1) {
        context.addIssue({
          code: "custom",
          message: "observation ordinals must be canonical",
          path: ["segment_contracts", "observations", index, "ordinal"],
        });
      }
    });
  });

export type PreparedDailyPromptInputV1 = z.infer<
  typeof PreparedDailyPromptInputV1Schema
>;
export type PreparedWeeklyPromptInputV1 = z.infer<
  typeof PreparedWeeklyPromptInputV1Schema
>;
export type PreparedPromptInputV1 =
  PreparedDailyPromptInputV1 | PreparedWeeklyPromptInputV1;

const OVERALL_MEANING = Object.freeze({
  LOW: "降低负荷并把行动缩小，不代表坏事",
  STEADY: "保持稳定节奏并推进一个清楚步骤",
  HIGH: "有余量适度推进，不保证结果",
});

const DIMENSION_MEANING = Object.freeze({
  pace: {
    LOW: "放慢一点并减少切换",
    STEADY: "保持稳定节奏",
    HIGH: "有余量适度推进",
  },
  action: {
    LOW: "把动作缩小到第一步",
    STEADY: "按一个清楚步骤推进",
    HIGH: "可以开始一件已选的事",
  },
  connection: {
    LOW: "降低沟通压力并先确认重点",
    STEADY: "清楚表达和确认",
    HIGH: "有余量主动完成一次低风险沟通",
  },
  resources: {
    LOW: "收紧时间和注意力范围",
    STEADY: "保持有限安排",
    HIGH: "可以整理或安排一个有限范围",
  },
  recovery: {
    LOW: "优先停顿和降低负担",
    STEADY: "保留基本留白",
    HIGH: "仍需保留适量停顿",
  },
} as const);

const NEXT_OBSERVATION_CLAIMS = Object.freeze({
  NOTICE_ENERGY_TIMING: "留意一天中什么时候更有精力余量",
  NOTICE_MOOD_SHIFTS: "留意哪些时刻心情变化更明显",
  NOTICE_SLEEP_AND_ENERGY: "轻轻留意休息感受与精力是否同向变化",
  NOTICE_HELPFUL_ACTIONS: "留意哪类小行动更常被自己标为有帮助",
  KEEP_ONE_SMALL_NOTE: "愿意时多留下一次简短回看",
  CONTINUE_WITHOUT_PRESSURE: "按现在的节奏继续记录，不要求每天完成",
});
const NEXT_OBSERVATION_FACT_IDS = Object.freeze({
  NOTICE_ENERGY_TIMING: "plan.notice_energy_timing",
  NOTICE_MOOD_SHIFTS: "plan.notice_mood_shifts",
  NOTICE_SLEEP_AND_ENERGY: "plan.notice_sleep_and_energy",
  NOTICE_HELPFUL_ACTIONS: "plan.notice_helpful_actions",
  KEEP_ONE_SMALL_NOTE: "plan.keep_one_small_note",
  CONTINUE_WITHOUT_PRESSURE: "plan.continue_without_pressure",
});

const METRIC_PREFIX = Object.freeze({
  mood: "MORNING_MOOD",
  energy: "MORNING_ENERGY",
  sleep: "MORNING_SLEEP",
  evening: "EVENING_OVERALL",
} as const);
const METRIC_LABEL = Object.freeze({
  MORNING_MOOD: "晨间心情",
  MORNING_ENERGY: "晨间精力",
  MORNING_SLEEP: "睡眠感受",
  EVENING_OVERALL: "晚间整体感受",
} as const);
const DIRECTION_LABEL = Object.freeze({
  HIGHER_LATE: "后几次相对更高",
  LOWER_LATE: "后几次相对更低",
  VARIABLE: "几次之间有起伏",
  SIMILAR: "几次整体相近",
  INSUFFICIENT_DATA: "记录不足",
} as const);
const MODE_LABEL = Object.freeze({
  MORNING_MOOD: {
    VERY_LOW: "很低",
    LOW: "偏低",
    STEADY: "平稳",
    GOOD: "不错",
    LIGHT: "轻快",
  },
  MORNING_ENERGY: {
    EMPTY: "几乎见底",
    LOW: "偏低",
    STEADY: "平稳",
    HIGH: "较充足",
    FULL: "很充足",
  },
  MORNING_SLEEP: {
    POOR: "较差",
    LOW: "偏低",
    OKAY: "还可以",
    GOOD: "不错",
  },
  EVENING_OVERALL: {
    VERY_HEAVY: "很沉重",
    SOMEWHAT_HEAVY: "有些沉重",
    STEADY: "平稳",
    PRETTY_GOOD: "比较好",
    LIGHT: "轻松",
  },
} as const);
const ACTION_LABEL: Readonly<Record<string, string>> = Object.freeze({
  PRIORITIZE_ONE: "只留一个重点",
  PREPARE_ONE_STEP: "准备第一步",
  COMMUNICATE_CLEARLY: "清楚沟通",
  REDUCE_SWITCHING: "减少切换",
  ORGANIZE_SMALL_SCOPE: "整理小范围",
  PAUSE_AND_RECOVER: "短暂停顿",
  REFLECT_BRIEFLY: "简短回看",
  SEEK_REAL_SUPPORT: "联系现实支持",
});
const PROHIBITED_INFERENCES = [
  "CAUSE",
  "DERIVED_METRIC",
  "FUTURE_PREDICTION",
  "LONG_TERM_TRAIT",
  "PROFESSIONAL_CONCLUSION",
] as const;

export class PreparedPromptInputError extends Error {
  public constructor(
    public readonly code:
      | "PROMPT_DAILY_PLAN_INVALID"
      | "PROMPT_INPUT_CONTRACT_INVALID"
      | "PROMPT_INPUT_TOO_LARGE"
      | "PROMPT_WEEKLY_PLAN_INVALID",
  ) {
    super(code);
    this.name = "PreparedPromptInputError";
  }
}

export function buildPreparedDailyPromptInputV1(input: {
  readonly personalizationLevel: "FULL" | "REDUCED";
  readonly plan: unknown;
}): PreparedDailyPromptInputV1 {
  assertExactKeys(input, ["personalizationLevel", "plan"]);
  const parsed = ControlledExpressionPlanV1Schema.safeParse(input.plan);
  if (!parsed.success) {
    throw new PreparedPromptInputError("PROMPT_DAILY_PLAN_INVALID");
  }
  const plan = parsed.data;
  try {
    validateDailyPlanCatalogBindingsV1(plan);
  } catch {
    throw new PreparedPromptInputError("PROMPT_DAILY_PLAN_INVALID");
  }
  const action = validateDailyAction(plan);
  const safeName = projectPreferredNameV1(plan.greeting_context.preferred_name);
  const candidate = {
    assertion_mode: plan.assertion_mode,
    contract: "prepared-daily-prompt-input-v1",
    dimensions: plan.semantic_slots.dimensions.map(({ id, band }) => ({
      allowed_meaning: DIMENSION_MEANING[id][band],
      band,
      id,
    })),
    effective_expression_constraints: plan.effective_expression_constraints,
    focus_dimension_id: plan.semantic_slots.focus_dimension_id,
    ...(plan.semantic_slots.care_dimension_id === undefined
      ? {}
      : { care_dimension_id: plan.semantic_slots.care_dimension_id }),
    greeting: {
      relationship_mode: "GENERIC",
      ...(safeName === undefined ? {} : { preferred_name: safeName }),
    },
    locale: "zh-CN",
    opening_requirement:
      plan.effective_expression_constraints.opening_requirement,
    optional_task: {
      allowed_instruction: action.taskInstruction,
      effort: plan.semantic_slots.optional_task.effort,
      kind: plan.semantic_slots.optional_task.kind,
      task_id: plan.semantic_slots.optional_task.task_id,
      ...(plan.semantic_slots.optional_task.timebox_minutes === undefined
        ? {}
        : {
            timebox_minutes: plan.semantic_slots.optional_task.timebox_minutes,
          }),
    },
    output_schema_version: "1.0.0",
    overall: {
      allowed_meaning: OVERALL_MEANING[plan.semantic_slots.overall.band],
      band: plan.semantic_slots.overall.band,
      label_token: plan.semantic_slots.overall.label_token,
    },
    personalization_level: input.personalizationLevel,
    primary_action: {
      action_id: action.actionId,
      allowed_instruction: action.instruction,
      constraint_label: action.constraintLabel,
      constraint_token: action.constraintToken,
      effort: action.effort,
      kind: action.kind,
      target_scope: action.targetScope,
      timebox_minutes: action.timeboxMinutes,
    },
    prohibited_claim_classes: [...plan.prohibited_claim_classes],
    prompt_version: DAILY_PROMPT_VERSION,
    requested_expression_style: plan.requested_expression_style,
    rituals: plan.semantic_slots.rituals.map((ritual) => ({
      display_label:
        ritual.kind === "NUMBER"
          ? String(ritual.value)
          : (DAILY_TEMPLATE_REGISTRY_V1.colorLabels[ritual.value] ?? ""),
      kind: ritual.kind,
      ritual_id: ritual.ritual_id,
      value: ritual.value,
    })),
    segment_rules: {
      core_display_characters_max: 320,
      explanation_paragraphs_max: 2,
      full_display_characters_max: 480,
      required_sections: [...plan.required_sections],
      state_response_max_evidence: 1,
    },
    state_evidence: plan.allowed_state_assertion_basis_codes
      .filter((code) => code.startsWith("checkin."))
      .map(stateEvidence),
    ...(plan.semantic_slots.supporting_dimension_id === undefined
      ? {}
      : {
          supporting_dimension_id: plan.semantic_slots.supporting_dimension_id,
        }),
    template_variant_id: plan.template_variant_id,
    uncertain_fields: [...plan.uncertain_checkin_fields],
  };
  return parseDaily(candidate);
}

export function buildPreparedWeeklyPromptInputV1(input: {
  readonly aggregate: unknown;
  readonly personalizationLevel: "FULL" | "REDUCED";
  readonly plan: unknown;
}): PreparedWeeklyPromptInputV1 {
  assertExactKeys(input, ["aggregate", "personalizationLevel", "plan"]);
  const aggregateResult = WeeklyAggregateFactsSchema.safeParse(input.aggregate);
  const planResult = WeeklyExpressionPlanSchema.safeParse(input.plan);
  if (!aggregateResult.success || !planResult.success) {
    throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
  }
  const aggregate = aggregateResult.data;
  const plan = planResult.data;
  if (
    plan.coverage_level !== aggregate.coverage.coverage_level ||
    plan.approved_fact_ids.some(
      (factId) => !aggregate.approved_fact_catalog.includes(factId),
    )
  ) {
    throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
  }
  const observations = plan.observation_fact_ids.map((factId, index) => ({
    exact_fact_refs: observationRefs(factId, plan.approved_fact_ids),
    ordinal: index + 1,
  }));
  return parseWeekly({
    approved_facts: plan.approved_fact_ids.map((factId) =>
      weeklyFact(aggregate, plan, factId),
    ),
    body_limits: {
      body_characters_max: 260,
      body_characters_min: 120,
      title_characters_max: 24,
      title_characters_min: 8,
    },
    contract: "prepared-weekly-prompt-input-v1",
    coverage_level: plan.coverage_level,
    locale: "zh-CN",
    output_schema_version: "1.0.0",
    personalization_level: input.personalizationLevel,
    prohibited_claim_classes: [
      "CAUSE",
      "DERIVED_METRIC",
      "FUTURE_PREDICTION",
      "LONG_TERM_TRAIT",
      "PROFESSIONAL_CONCLUSION",
      "OTHER_USER_COMPARISON",
      "RAW_NOTE_OR_HISTORY",
      "PERFECT_CONTINUITY",
      "TASK_PRESSURE_OR_SHAME",
    ],
    prompt_version: WEEKLY_PROMPT_VERSION,
    segment_contracts: {
      closing: { exact_fact_refs: [plan.coverage_fact_id] },
      ...(plan.helpful_pattern_fact_id === undefined
        ? {}
        : {
            helpful_pattern: {
              exact_fact_refs: [plan.helpful_pattern_fact_id],
            },
          }),
      next_week: { exact_fact_refs: [plan.next_observation_fact_id] },
      observations,
      opening: {
        exact_fact_refs: [
          plan.headline_fact_id,
          plan.source_disclosure_fact_id,
        ],
      },
    },
  });
}

export function parsePreparedPromptInputV1(
  value: unknown,
  workload: PromptWorkloadV1,
): PreparedPromptInputV1 {
  return workload === "DAILY_EXPRESSION_V1"
    ? parseDaily(value)
    : parseWeekly(value);
}

function parseDaily(value: unknown): PreparedDailyPromptInputV1 {
  const parsed = PreparedDailyPromptInputV1Schema.safeParse(value);
  if (!parsed.success) {
    throw new PreparedPromptInputError("PROMPT_INPUT_CONTRACT_INVALID");
  }
  return deepFreeze(parsed.data);
}

function parseWeekly(value: unknown): PreparedWeeklyPromptInputV1 {
  const parsed = PreparedWeeklyPromptInputV1Schema.safeParse(value);
  if (!parsed.success) {
    throw new PreparedPromptInputError("PROMPT_INPUT_CONTRACT_INVALID");
  }
  return deepFreeze(parsed.data);
}

function validateDailyAction(plan: ControlledExpressionPlanV1) {
  const selected = plan.semantic_slots.selected_action;
  const task = plan.semantic_slots.optional_task;
  const action = DAILY_TEMPLATE_REGISTRY_V1.actionCopyById[selected.action_id];
  if (
    action === undefined ||
    selected.kind !== action.kind ||
    selected.target_scope !== action.targetScope ||
    selected.effort !== action.effort ||
    selected.timebox_minutes !== action.timeboxMinutes ||
    selected.constraint_token !== action.constraintToken ||
    task.task_id !== action.taskId ||
    task.kind !== action.kind
  ) {
    throw new PreparedPromptInputError("PROMPT_DAILY_PLAN_INVALID");
  }
  return action;
}

function stateEvidence(code: string) {
  const match = /^checkin\.(mood|energy|sleep)\.([a-z-]+)\.v1$/u.exec(code);
  const allowedPhrase = DAILY_TEMPLATE_REGISTRY_V1.checkinPhrases[code];
  if (match === null || allowedPhrase === undefined) {
    throw new PreparedPromptInputError("PROMPT_DAILY_PLAN_INVALID");
  }
  return {
    allowed_phrase: allowedPhrase,
    basis_code: code,
    field: match[1] as "mood" | "energy" | "sleep",
    value_token: match[2]!.replaceAll("-", "_").toUpperCase(),
  };
}

function observationRefs(
  factId: string,
  approvedFactIds: readonly string[],
): [string] | [string, string] {
  const companion = factId.replace(/\.(direction|mode)$/u, ".observed_count");
  return companion !== factId && approvedFactIds.includes(companion)
    ? [factId, companion]
    : [factId];
}

function weeklyFact(
  aggregate: WeeklyAggregateFacts,
  plan: WeeklyExpressionPlan,
  factId: string,
) {
  const countFact = (display: string, claim: string, ...values: number[]) =>
    fact(factId, "COUNT", display, claim, values.map(String));
  switch (factId) {
    case "fact.coverage.level":
      return fact(
        factId,
        "COVERAGE",
        aggregate.coverage.coverage_level,
        aggregate.coverage.coverage_level === "COMPLETE"
          ? "七天都有至少一项真实状态记录，不代表字段全部完整"
          : "只基于已有真实记录并承认缺失日期",
      );
    case "fact.coverage.real_days":
      return countFact(
        `${aggregate.coverage.real_state_day_count}天`,
        `基于${aggregate.coverage.real_state_day_count}天真实记录`,
        aggregate.coverage.real_state_day_count,
      );
    case "fact.coverage.missing_days":
      return countFact(
        `${aggregate.coverage.missing_dates.length}天缺失`,
        `${aggregate.coverage.missing_dates.length}个日期没有记录且不补齐`,
        aggregate.coverage.missing_dates.length,
      );
    case "fact.coverage.checkin_days":
      return countFact(
        `${aggregate.coverage.checkin_day_count}天晨间记录`,
        `有${aggregate.coverage.checkin_day_count}天晨间记录`,
        aggregate.coverage.checkin_day_count,
      );
    case "fact.coverage.disclosure":
      return fact(
        factId,
        "DISCLOSURE",
        `${aggregate.coverage.real_state_day_count}天真实记录，${aggregate.coverage.missing_dates.length}天缺失`,
        `明确披露真实记录为${aggregate.coverage.real_state_day_count}天并承认${aggregate.coverage.missing_dates.length}天缺失`,
        [
          String(aggregate.coverage.real_state_day_count),
          String(aggregate.coverage.missing_dates.length),
        ],
      );
    case "fact.light.count":
      return countFact(
        `${aggregate.light_facts.lit_day_count}天点亮`,
        `这七天点亮了${aggregate.light_facts.lit_day_count}天`,
        aggregate.light_facts.lit_day_count,
      );
    case "fact.feedback.count":
      return countFact(
        `${aggregate.feedback_facts.evening_feedback_day_count}天晚间反馈`,
        `有${aggregate.feedback_facts.evening_feedback_day_count}天晚间反馈`,
        aggregate.feedback_facts.evening_feedback_day_count,
      );
    case "fact.helpfulness.rated_count":
      return countFact(
        `${aggregate.helpfulness_facts.rated_day_count}次帮助度记录`,
        `有${aggregate.helpfulness_facts.rated_day_count}次帮助度记录`,
        aggregate.helpfulness_facts.rated_day_count,
      );
    case "fact.helpfulness.helpful_count":
      return countFact(
        `${aggregate.helpfulness_facts.helpful_count}次有帮助`,
        `${aggregate.helpfulness_facts.helpful_count}次被标为有帮助`,
        aggregate.helpfulness_facts.helpful_count,
      );
    case "fact.helpfulness.top_action_kind": {
      const kind = aggregate.helpfulness_facts.top_helpful_action_kind;
      const count =
        kind === undefined
          ? 0
          : (aggregate.helpfulness_facts.helpful_action_kind_counts[kind] ?? 0);
      if (kind === undefined || count < 1) {
        throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
      }
      return fact(
        factId,
        "HELPFUL_ACTION",
        `${ACTION_LABEL[kind] ?? kind}，${count}次；总帮助信号${aggregate.helpfulness_facts.helpful_count}次`,
        `有限样本中${ACTION_LABEL[kind] ?? kind}类行动的帮助信号较多，不代表最适合或已证明有效`,
        [String(count), String(aggregate.helpfulness_facts.helpful_count)],
      );
    }
    case "fact.task.offered_count":
      return countFact(
        `${aggregate.task_facts.task_offered_day_count}天提供任务`,
        `有${aggregate.task_facts.task_offered_day_count}天提供可选任务`,
        aggregate.task_facts.task_offered_day_count,
      );
    case "fact.task.completed_count":
      return countFact(
        `${aggregate.task_facts.completed_count}次完成`,
        `可选任务完成记录为${aggregate.task_facts.completed_count}次，不评价自律`,
        aggregate.task_facts.completed_count,
      );
    default:
      break;
  }
  if (factId.startsWith("plan.")) {
    if (
      factId !== plan.next_observation_fact_id ||
      factId !== NEXT_OBSERVATION_FACT_IDS[plan.next_observation_plan]
    ) {
      throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
    }
    return fact(
      factId,
      "NEXT_OBSERVATION",
      plan.next_observation_plan,
      NEXT_OBSERVATION_CLAIMS[plan.next_observation_plan],
    );
  }
  const metricMatch =
    /^fact\.(mood|energy|sleep|evening)\.(direction|observed_count|mode)$/u.exec(
      factId,
    );
  if (metricMatch !== null) {
    const metricId =
      METRIC_PREFIX[metricMatch[1] as keyof typeof METRIC_PREFIX];
    const metric = aggregate.state_metrics.find(
      (candidate) => candidate.metric_id === metricId,
    );
    if (metric === undefined) {
      throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
    }
    if (metricMatch[2] === "direction") {
      if (metric.direction === "INSUFFICIENT_DATA") {
        throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
      }
      return fact(
        factId,
        "DIRECTION",
        `${METRIC_LABEL[metric.metric_id]}${DIRECTION_LABEL[metric.direction]}`,
        `只描述${metric.observed_count}次${METRIC_LABEL[metric.metric_id]}记录为${DIRECTION_LABEL[metric.direction]}，不代表改善、恶化或未来走势`,
      );
    }
    if (metricMatch[2] === "observed_count") {
      return countFact(
        `${metric.observed_count}次${METRIC_LABEL[metric.metric_id]}记录`,
        `仅基于${metric.observed_count}次${METRIC_LABEL[metric.metric_id]}记录`,
        metric.observed_count,
      );
    }
    if (metric.mode_value === undefined || metric.mode_count === undefined) {
      throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
    }
    const label = modeLabel(metric.metric_id, metric.mode_value);
    return fact(
      factId,
      "MODE",
      `${METRIC_LABEL[metric.metric_id]}较常出现${label}，${metric.mode_count}次`,
      `只描述${metric.observed_count}次可用记录中${label}出现${metric.mode_count}次，不代表长期状态`,
      [String(metric.mode_count)],
    );
  }
  throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
}

function modeLabel(
  metricId: WeeklyAggregateFacts["state_metrics"][number]["metric_id"],
  value: string,
): string {
  const labels = MODE_LABEL[metricId] as Readonly<Record<string, string>>;
  const label = labels[value];
  if (label === undefined) {
    throw new PreparedPromptInputError("PROMPT_WEEKLY_PLAN_INVALID");
  }
  return label;
}

function fact(
  factId: string,
  factKind: z.infer<typeof PromptFactV1Schema>["fact_kind"],
  displayValue: string,
  allowedClaim: string,
  allowedNumericLiterals: string[] = [],
) {
  return {
    allowed_claim: allowedClaim,
    allowed_date_literals: [],
    allowed_numeric_literals: [...new Set(allowedNumericLiterals)],
    display_value: displayValue,
    fact_id: factId,
    fact_kind: factKind,
    prohibited_inferences: [...PROHIBITED_INFERENCES],
  };
}

function assertExactKeys(value: unknown, keys: readonly string[]): void {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new PreparedPromptInputError("PROMPT_INPUT_CONTRACT_INVALID");
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
