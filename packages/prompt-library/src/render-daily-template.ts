import * as z from "zod";

import {
  ControlledExpressionPlanV1Schema,
  ExpressionPayloadSchema,
  countDisplayCharacters,
  type ControlledExpressionPlanV1,
  type ExpressionPayload,
  type ExpressionStyle,
  type StableDimensionId,
} from "@daily-energy/shared-schemas";

import {
  DAILY_TEMPLATE_REGISTRY_FINGERPRINT_V1,
  DAILY_TEMPLATE_REGISTRY_V1,
  DAILY_TEMPLATE_RENDERER_VERSION,
  DAILY_TEMPLATE_VERSION,
  type DailyTemplateActionCopyV1,
} from "./daily-template-registry.js";

export const CONTROLLED_DAILY_TEMPLATE_CANDIDATE_CONTRACT =
  "controlled-daily-template-candidate-v1";

export type ControlledTemplateErrorCode =
  | "TEMPLATE_PLAN_INVALID"
  | "TEMPLATE_CATALOG_MISMATCH"
  | "TEMPLATE_OUTPUT_SCHEMA_INVALID"
  | "TEMPLATE_OUTPUT_BINDING_INVALID"
  | "TEMPLATE_OUTPUT_SAFETY_REJECTED";

export const DailyCandidateSafetyViolationCodeValues = [
  "CERTAIN_FUTURE_HARM_OR_REWARD",
  "FEAR_SHAME_OR_COERCION",
  "MEDICAL_OR_PSYCHOLOGICAL_CONCLUSION",
  "INVESTMENT_TRANSACTION_OR_GUARANTEE",
  "LEGAL_CONCLUSION_OR_EVASION",
  "SELF_HARM_OR_VIOLENCE_FACILITATION",
  "DANGEROUS_OR_ILLEGAL_INSTRUCTION",
  "DEPENDENCY_ROMANCE_OR_POSSESSION",
  "HARASSMENT_HATE_OR_STEREOTYPE",
  "PRIVACY_OR_INTERNAL_DISCLOSURE",
  "UNSUPPORTED_FACT_OR_DIAGNOSIS",
  "UNREVIEWED_RESOURCE_OR_CRISIS_COPY",
] as const;

export type DailyCandidateSafetyViolationCode =
  (typeof DailyCandidateSafetyViolationCodeValues)[number];

export type DailyCandidateSafetyVerdictV1 =
  | { readonly status: "PASS" }
  | {
      readonly status: "REJECT";
      readonly violationCodes: readonly DailyCandidateSafetyViolationCode[];
    };

export class ControlledTemplateError extends Error {
  readonly code: ControlledTemplateErrorCode;
  readonly violationCodes: readonly DailyCandidateSafetyViolationCode[];

  constructor(
    code: ControlledTemplateErrorCode,
    violationCodes: readonly DailyCandidateSafetyViolationCode[] = [],
  ) {
    super(code);
    this.name = "ControlledTemplateError";
    this.code = code;
    this.violationCodes = Object.freeze([...violationCodes]);
  }
}

export const ControlledDailyTemplateCandidateV1Schema = z
  .object({
    contract: z.literal(CONTROLLED_DAILY_TEMPLATE_CANDIDATE_CONTRACT),
    template_version: z.literal(DAILY_TEMPLATE_VERSION),
    renderer_version: z.literal(DAILY_TEMPLATE_RENDERER_VERSION),
    registry_fingerprint: z.literal(DAILY_TEMPLATE_REGISTRY_FINGERPRINT_V1),
    generation_mode: z.literal("CONTROLLED_TEMPLATE"),
    personalization_level: z.literal("FULL"),
    attribution: z
      .object({
        plan_contract_version: z.literal("daily-expression-v1"),
        output_schema_version: z.literal("1.0.0"),
        authority_paths: z.tuple([
          z.literal("docs/ai/daily-content-schema.md"),
          z.literal("docs/ai/personality.md"),
          z.literal("docs/ai/prompt-spec.md"),
          z.literal("docs/ai/safety.md"),
        ]),
      })
      .strict(),
    expression: ExpressionPayloadSchema,
    source_dependencies: z.tuple([]),
    privacy_fallbacks: z.object({}).strict(),
  })
  .strict();
export type ControlledDailyTemplateCandidateV1 = z.infer<
  typeof ControlledDailyTemplateCandidateV1Schema
>;

const DIMENSION_LABELS: Readonly<Record<StableDimensionId, string>> =
  Object.freeze({
    pace: "今日节奏",
    action: "行动推进",
    connection: "沟通连接",
    resources: "资源安排",
    recovery: "恢复留白",
  });

const SEVERE_EVIDENCE_ORDER = Object.freeze([
  "checkin.mood.very-low.v1",
  "checkin.energy.empty.v1",
  "checkin.sleep.poor.v1",
  "checkin.mood.low.v1",
  "checkin.energy.low.v1",
  "checkin.sleep.low.v1",
]);

const COLOR_ID_BY_VALUE = Object.freeze({
  MIST_BLUE: "ritual.color.mist-blue.v1",
  WARM_BEIGE: "ritual.color.warm-beige.v1",
  SAGE_GREEN: "ritual.color.sage-green.v1",
  SOFT_LILAC: "ritual.color.soft-lilac.v1",
  CLOUD_GRAY: "ritual.color.cloud-gray.v1",
} as const);

const HUMOR_MARKERS = Object.freeze(["后台", "电量", "启动键", "排成长队"]);
const LOW_PRESSURE_FORBIDDEN = Object.freeze([
  "冲",
  "挑战",
  "抓住机会",
  "坚持一下",
  "别浪费状态",
]);
const UNSAFE_NAME_TOKENS = Object.freeze([
  "system",
  "assistant",
  "developer",
  "user",
  "prompt",
  "json",
  "忽略",
  "覆盖",
  "输出",
  "执行",
  "指令",
  "系统",
  "助手",
  "模型",
  "宝贝",
  "亲爱的",
  "主人",
  "小可怜",
  "姐妹",
  "女王",
  "老婆",
  "我的女孩",
]);
const HARD_SAFETY_RULES: readonly {
  readonly code: DailyCandidateSafetyViolationCode;
  readonly patterns: readonly RegExp[];
}[] = Object.freeze([
  {
    code: "CERTAIN_FUTURE_HARM_OR_REWARD",
    patterns: [
      /(?:一定|必然|注定|百分之百|肯定会).{0,24}(?:成功|失败|升职|发财|中奖|好运|坏事|灾祸|死亡|生病|疾病|破财|背叛|横财)/u,
      /(?:成功|失败|升职|发财|中奖|好运|坏事|灾祸|死亡|生病|疾病|破财|背叛|横财).{0,12}(?:一定|必然|注定|百分之百)/u,
      /(?:转运|招财|避祸|疾病预兆)/u,
    ],
  },
  {
    code: "FEAR_SHAME_OR_COERCION",
    patterns: [
      /(?:不做|不完成|错过).{0,20}(?:失去|倒霉|坏事|惩罚|后悔)/u,
      /(?:废柴|没用|自律不够|必须完成|别浪费状态)/u,
    ],
  },
  {
    code: "MEDICAL_OR_PSYCHOLOGICAL_CONCLUSION",
    patterns: [
      /(?:诊断为|抑郁症|焦虑症|停药|换药|治疗方案|病因是|患有|得了抑郁|得了焦虑)/u,
    ],
  },
  {
    code: "INVESTMENT_TRANSACTION_OR_GUARANTEE",
    patterns: [
      /(?:买入|卖出|加仓|减仓|仓位|收益保证|稳赚|止盈|止损|赌博号码)/u,
    ],
  },
  {
    code: "LEGAL_CONCLUSION_OR_EVASION",
    patterns: [/(?:胜诉|败诉|规避执法|销毁证据|隐瞒证据|法律上一定|肯定违法)/u],
  },
  {
    code: "SELF_HARM_OR_VIOLENCE_FACILITATION",
    patterns: [
      /(?:伤害自己|伤害他人|自杀方法|暴力方法|如何自杀|如何杀人|自残步骤)/u,
    ],
  },
  {
    code: "DANGEROUS_OR_ILLEGAL_INSTRUCTION",
    patterns: [
      /(?:制作炸弹|制造武器|购买毒品|吸毒方法|犯罪步骤|过量服药|危险挑战)/u,
    ],
  },
  {
    code: "DEPENDENCY_ROMANCE_OR_POSSESSION",
    patterns: [
      /(?:为了我|只需要我|永远陪着你|属于我|你只能依赖我|我是你唯一|做我的恋人)/u,
    ],
  },
  {
    code: "HARASSMENT_HATE_OR_STEREOTYPE",
    patterns: [/(?:小可怜|女人都|男人都|你们这种人|低状态很好笑|活该|蠢货)/u],
  },
  {
    code: "PRIVACY_OR_INTERNAL_DISCLOSURE",
    patterns: [
      /(?:https?:\/\/|www\.|action\.|task\.|ritual\.|checkin\.|PRIMARY_AI|BACKUP_AI|\.v1)/iu,
      /(?:系统提示|提示词|内部规则|其他用户|访问令牌|密钥|api[_ -]?key|secret|token)/iu,
    ],
  },
  {
    code: "UNSUPPORTED_FACT_OR_DIAGNOSIS",
    patterns: [
      /(?:因为你|说明你|这证明你).{0,20}(?:性格|人格|长期|总是|天生|有病)/u,
      /(?:对方|伴侣|上司).{0,12}(?:一定|肯定|正在).{0,12}(?:想|恨|针对|背叛)/u,
      /(?:恶意针对|背叛你)/u,
    ],
  },
  {
    code: "UNREVIEWED_RESOURCE_OR_CRISIS_COPY",
    patterns: [
      /(?:SAFE-001|危机热线|心理援助热线|拨打110|拨打120|拨打12356)/iu,
    ],
  },
]);

export function evaluateDailyCandidateSafetyV1(
  text: string,
): DailyCandidateSafetyVerdictV1 {
  const violationCodes = HARD_SAFETY_RULES.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(text)),
  ).map(({ code }) => code);
  return violationCodes.length === 0
    ? Object.freeze({ status: "PASS" as const })
    : Object.freeze({
        status: "REJECT" as const,
        violationCodes: Object.freeze(violationCodes),
      });
}

export function renderControlledDailyTemplateV1(
  input: unknown,
): ControlledDailyTemplateCandidateV1 {
  const parsed = ControlledExpressionPlanV1Schema.safeParse(input);
  if (!parsed.success) {
    throw new ControlledTemplateError("TEMPLATE_PLAN_INVALID");
  }
  const plan = parsed.data;
  validatePlanCatalogBindings(plan);

  const expressionCandidate = renderExpectedExpression(plan);
  const expression = ExpressionPayloadSchema.safeParse(expressionCandidate);
  if (!expression.success) {
    throw new ControlledTemplateError("TEMPLATE_OUTPUT_SCHEMA_INVALID");
  }
  const candidate: ControlledDailyTemplateCandidateV1 = {
    contract: CONTROLLED_DAILY_TEMPLATE_CANDIDATE_CONTRACT,
    template_version: DAILY_TEMPLATE_VERSION,
    renderer_version: DAILY_TEMPLATE_RENDERER_VERSION,
    registry_fingerprint: DAILY_TEMPLATE_REGISTRY_FINGERPRINT_V1,
    generation_mode: "CONTROLLED_TEMPLATE",
    personalization_level: "FULL",
    attribution: {
      plan_contract_version: "daily-expression-v1",
      output_schema_version: "1.0.0",
      authority_paths: [
        "docs/ai/daily-content-schema.md",
        "docs/ai/personality.md",
        "docs/ai/prompt-spec.md",
        "docs/ai/safety.md",
      ],
    },
    expression: expression.data,
    source_dependencies: [],
    privacy_fallbacks: {},
  };
  return deepFreeze(
    validateControlledDailyTemplateCandidateV1(candidate, plan),
  );
}

export function validateControlledDailyTemplateCandidateV1(
  candidate: unknown,
  planInput: unknown,
): ControlledDailyTemplateCandidateV1 {
  const parsedCandidate =
    ControlledDailyTemplateCandidateV1Schema.safeParse(candidate);
  if (!parsedCandidate.success) {
    throw new ControlledTemplateError("TEMPLATE_OUTPUT_SCHEMA_INVALID");
  }
  const parsedPlan = ControlledExpressionPlanV1Schema.safeParse(planInput);
  if (!parsedPlan.success) {
    throw new ControlledTemplateError("TEMPLATE_PLAN_INVALID");
  }
  const plan = parsedPlan.data;
  const value = parsedCandidate.data;
  const expression = value.expression;
  const action = plan.semantic_slots.selected_action;
  const task = plan.semantic_slots.optional_task;
  const expectedRitualIds = plan.semantic_slots.rituals
    .map(({ ritual_id }) => ritual_id)
    .sort();
  const actualRitualIds = Object.keys(expression.ritual_notes).sort();
  if (
    expression.primary_action.action_id !== action.action_id ||
    expression.optional_task.task_id !== task.task_id ||
    JSON.stringify(expectedRitualIds) !== JSON.stringify(actualRitualIds)
  ) {
    throw new ControlledTemplateError("TEMPLATE_OUTPUT_BINDING_INVALID");
  }

  const coreText = [
    expression.greeting,
    expression.state_response,
    expression.overall_summary,
    expression.core_tip,
    ...expression.explanation_paragraphs,
    expression.dimension_explanations[plan.semantic_slots.focus_dimension_id],
    expression.primary_action.instruction,
    expression.primary_action.rationale,
    expression.primary_action.constraint_label,
    expression.optional_task.instruction,
    expression.closing,
  ].filter((item): item is string => item !== undefined);
  if (displayLength(coreText) > 320) {
    throw new ControlledTemplateError("TEMPLATE_OUTPUT_SCHEMA_INVALID");
  }

  const text = expressionText(expression);
  const safetyVerdict = evaluateDailyCandidateSafetyV1(text);
  if (safetyVerdict.status === "REJECT") {
    throw new ControlledTemplateError(
      "TEMPLATE_OUTPUT_SAFETY_REJECTED",
      safetyVerdict.violationCodes,
    );
  }
  const humorCount = HUMOR_MARKERS.reduce(
    (count, marker) => count + occurrences(text, marker),
    0,
  );
  if (
    humorCount > 1 ||
    (plan.effective_expression_constraints.humor_ceiling === "NONE" &&
      humorCount !== 0)
  ) {
    throw new ControlledTemplateError("TEMPLATE_OUTPUT_SAFETY_REJECTED");
  }
  if (
    plan.effective_expression_constraints.pressure_ceiling === "VERY_LOW" &&
    LOW_PRESSURE_FORBIDDEN.some((item) => text.includes(item))
  ) {
    throw new ControlledTemplateError("TEMPLATE_OUTPUT_SAFETY_REJECTED");
  }
  const expectedExpression = ExpressionPayloadSchema.parse(
    renderExpectedExpression(plan),
  );
  if (JSON.stringify(expression) !== JSON.stringify(expectedExpression)) {
    throw new ControlledTemplateError("TEMPLATE_OUTPUT_BINDING_INVALID");
  }
  const safeName = projectPreferredName(plan.greeting_context.preferred_name);
  const expectedGreeting = greetingWithOptionalName(
    DAILY_TEMPLATE_REGISTRY_V1.styles[effectiveStyle(plan)].greeting,
    safeName,
  );
  if (expression.greeting !== expectedGreeting) {
    throw new ControlledTemplateError("TEMPLATE_OUTPUT_BINDING_INVALID");
  }
  return deepFreeze(value);
}

function renderExpectedExpression(
  plan: ControlledExpressionPlanV1,
): ExpressionPayload {
  const style = effectiveStyle(plan);
  const styleCopy = DAILY_TEMPLATE_REGISTRY_V1.styles[style];
  const actionCopy =
    DAILY_TEMPLATE_REGISTRY_V1.actionCopyById[
      plan.semantic_slots.selected_action.action_id
    ];
  if (actionCopy === undefined) {
    throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
  }
  const safeName = projectPreferredName(plan.greeting_context.preferred_name);
  return {
    greeting: greetingWithOptionalName(styleCopy.greeting, safeName),
    state_response: renderStateResponse(plan, style),
    overall_summary:
      plan.semantic_slots.care_dimension_id === undefined
        ? DAILY_TEMPLATE_REGISTRY_V1.overallSummary[
            plan.semantic_slots.overall.band
          ]
        : DAILY_TEMPLATE_REGISTRY_V1.careOverallSummary,
    core_tip: actionCopy.coreTip,
    explanation_paragraphs: renderExplanationParagraphs(plan, style),
    dimension_explanations: Object.fromEntries(
      plan.semantic_slots.dimensions.map(({ id, band }) => [
        id,
        DAILY_TEMPLATE_REGISTRY_V1.dimensionGuidance[id][band],
      ]),
    ) as ExpressionPayload["dimension_explanations"],
    primary_action: {
      action_id: actionCopy.actionId,
      instruction: actionCopy.instruction,
      rationale: actionCopy.rationale,
      constraint_label: actionCopy.constraintLabel,
    },
    optional_task: {
      task_id: actionCopy.taskId,
      instruction: actionCopy.taskInstruction,
    },
    ritual_notes: renderRitualNotes(plan),
    closing: styleCopy.closing,
  };
}

function validatePlanCatalogBindings(plan: ControlledExpressionPlanV1): void {
  const slots = plan.semantic_slots;
  const action = slots.selected_action;
  const copy = DAILY_TEMPLATE_REGISTRY_V1.actionCopyById[action.action_id];
  if (
    copy === undefined ||
    !matchesAction(copy, action) ||
    slots.optional_task.task_id !== copy.taskId ||
    slots.optional_task.kind !== copy.kind ||
    slots.optional_task.effort !== "VERY_LIGHT" ||
    slots.optional_task.timebox_minutes !== 5
  ) {
    throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
  }
  for (const ritual of slots.rituals) {
    if (ritual.kind === "COLOR") {
      const expectedId =
        COLOR_ID_BY_VALUE[ritual.value as keyof typeof COLOR_ID_BY_VALUE];
      if (
        expectedId !== ritual.ritual_id ||
        DAILY_TEMPLATE_REGISTRY_V1.colorLabels[ritual.value] === undefined
      ) {
        throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
      }
    } else if (ritual.ritual_id !== `ritual.number.${ritual.value}.v1`) {
      throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
    }
  }
  const explanationCodes = new Set(slots.explanation_basis_codes);
  if (
    plan.allowed_state_assertion_basis_codes.some(
      (code) => !explanationCodes.has(code),
    )
  ) {
    throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
  }
  for (const field of plan.known_checkin_fields) {
    if (
      !slots.explanation_basis_codes.some(
        (code) =>
          code.startsWith(`checkin.${field}.`) &&
          DAILY_TEMPLATE_REGISTRY_V1.checkinPhrases[code] !== undefined,
      )
    ) {
      throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
    }
  }
  for (const field of plan.uncertain_checkin_fields) {
    if (!explanationCodes.has(`checkin.${field}.unsure.v1`)) {
      throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
    }
  }
  for (const { id, band } of slots.dimensions) {
    if (
      !explanationCodes.has(`dimension.${id}.${band.toLowerCase()}.v1`) &&
      id === slots.focus_dimension_id &&
      plan.assertion_mode !== "LOW_ASSERTION"
    ) {
      throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
    }
  }
}

function matchesAction(
  copy: DailyTemplateActionCopyV1,
  action: ControlledExpressionPlanV1["semantic_slots"]["selected_action"],
): boolean {
  return (
    copy.actionId === action.action_id &&
    copy.kind === action.kind &&
    copy.targetScope === action.target_scope &&
    copy.effort === action.effort &&
    copy.timeboxMinutes === action.timebox_minutes &&
    copy.constraintToken === action.constraint_token
  );
}

function effectiveStyle(plan: ControlledExpressionPlanV1): ExpressionStyle {
  return plan.requested_expression_style === "LIGHT_HUMOR" &&
    plan.effective_expression_constraints.humor_ceiling === "NONE"
    ? "BALANCED"
    : plan.requested_expression_style;
}

function renderStateResponse(
  plan: ControlledExpressionPlanV1,
  style: ExpressionStyle,
): string {
  const copy = DAILY_TEMPLATE_REGISTRY_V1.styles[style];
  if (plan.assertion_mode === "LOW_ASSERTION") {
    return copy.lowAssertion;
  }
  const evidenceCode = selectEvidenceCode(plan);
  const phrase = DAILY_TEMPLATE_REGISTRY_V1.checkinPhrases[evidenceCode];
  if (phrase === undefined) {
    throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
  }
  if (plan.assertion_mode === "PARTIAL_ASSERTION") {
    return `${phrase}，还有些状态你选择了说不准。${copy.partialSuffix}`;
  }
  return `${phrase}。${
    plan.semantic_slots.care_dimension_id === undefined
      ? copy.knownSuffix
      : copy.careSuffix
  }`;
}

function selectEvidenceCode(plan: ControlledExpressionPlanV1): string {
  const available = plan.allowed_state_assertion_basis_codes.filter(
    (code) => DAILY_TEMPLATE_REGISTRY_V1.checkinPhrases[code] !== undefined,
  );
  if (plan.semantic_slots.care_dimension_id !== undefined) {
    const severe = SEVERE_EVIDENCE_ORDER.find((code) =>
      available.includes(code),
    );
    if (severe !== undefined) {
      return severe;
    }
  }
  const first = available[0];
  if (first === undefined) {
    throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
  }
  return first;
}

function renderExplanationParagraphs(
  plan: ControlledExpressionPlanV1,
  style: ExpressionStyle,
): [string, string] {
  const slots = plan.semantic_slots;
  const focus = slots.focus_dimension_id;
  let opening: string;
  if (plan.template_variant_id === "template.care-then-step.v1") {
    opening = `先把负担放轻，不急着证明今天能做多少。${DAILY_TEMPLATE_REGISTRY_V1.focusGuidance[focus]}，这份提示只作行动参考。`;
  } else if (plan.template_variant_id === "template.support-then-focus.v1") {
    const supporting = slots.supporting_dimension_id;
    if (supporting === undefined) {
      throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
    }
    opening = `${DIMENSION_LABELS[supporting]}有一点余量，可以先照顾${DIMENSION_LABELS[focus]}。这份余量只作行动参考，不代表现实结果。`;
  } else {
    opening = `${DAILY_TEMPLATE_REGISTRY_V1.focusGuidance[focus]}。今天只把这份提示当作行动参考，不把它写成现实结果，也不替你推断原因。`;
  }
  return [opening, DAILY_TEMPLATE_REGISTRY_V1.styles[style].explanationTail];
}

function renderRitualNotes(
  plan: ControlledExpressionPlanV1,
): Record<string, string> {
  return Object.fromEntries(
    plan.semantic_slots.rituals.map((ritual) => {
      if (ritual.kind === "NUMBER") {
        return [
          ritual.ritual_id,
          `数字${ritual.value}只是一点轻松的娱乐参考。`,
        ];
      }
      const label = DAILY_TEMPLATE_REGISTRY_V1.colorLabels[ritual.value];
      if (label === undefined) {
        throw new ControlledTemplateError("TEMPLATE_CATALOG_MISMATCH");
      }
      return [ritual.ritual_id, `把${label}当作今天的小小仪式感。`];
    }),
  );
}

function projectPreferredName(value: string | undefined): string | undefined {
  if (value === undefined || countDisplayCharacters(value) > 20) {
    return undefined;
  }
  if (
    !/^[\p{L}\p{N}]+(?:[ ·•._-][\p{L}\p{N}]+)*$/u.test(value) ||
    UNSAFE_NAME_TOKENS.some((token) =>
      value.toLocaleLowerCase("zh-CN").includes(token),
    ) ||
    evaluateDailyCandidateSafetyV1(value).status === "REJECT"
  ) {
    return undefined;
  }
  return value;
}

function greetingWithOptionalName(
  baseGreeting: string,
  name: string | undefined,
): string {
  if (name === undefined) {
    return baseGreeting;
  }
  const candidate = `${name}，${baseGreeting}`;
  return countDisplayCharacters(candidate) <= 24 ? candidate : baseGreeting;
}

function expressionText(value: ExpressionPayload): string {
  return [value.greeting, expressionTextExceptGreeting(value)].join("\n");
}

function expressionTextExceptGreeting(value: ExpressionPayload): string {
  return [
    value.state_response,
    value.overall_summary,
    value.core_tip,
    ...value.explanation_paragraphs,
    ...Object.values(value.dimension_explanations),
    value.primary_action.instruction,
    value.primary_action.rationale,
    value.primary_action.constraint_label,
    value.optional_task.instruction,
    ...Object.values(value.ritual_notes),
    value.closing,
  ]
    .filter((item): item is string => item !== undefined)
    .join("\n");
}

function displayLength(values: readonly string[]): number {
  return values.reduce(
    (total, value) => total + countDisplayCharacters(value),
    0,
  );
}

function occurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }
  return value;
}
