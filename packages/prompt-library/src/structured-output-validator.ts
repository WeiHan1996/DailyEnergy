import type * as z from "zod";

import {
  ExpressionPayloadSchema,
  WeeklyExpressionPayloadSchema,
  countDisplayCharacters,
  type ExpressionPayload,
  type WeeklyExpressionPayload,
} from "@daily-energy/shared-schemas";

import {
  evaluateDailyCandidateSafetyV1,
  type DailyCandidateSafetyViolationCode,
} from "./render-daily-template.js";
import {
  PreparedPromptInputError,
  parsePreparedPromptInputV1,
  type PreparedDailyPromptInputV1,
  type PreparedPromptInputV1,
  type PreparedWeeklyPromptInputV1,
} from "./prepared-prompt-input.js";
import {
  DAILY_PROMPT_VERSION,
  WEEKLY_PROMPT_VERSION,
  canonicalPromptJsonV1,
  fingerprintPromptJsonV1,
  type PromptWorkloadV1,
} from "./prompt-package-registry.js";
import { evaluateExpressionLanguageV1 } from "./expression-style-policy.js";

export const STRUCTURED_OUTPUT_VALIDATOR_VERSION =
  "structured-output-validator-v1";

export type CandidateRouteRoleV1 =
  "PRIMARY_AI" | "BACKUP_AI" | "CONTROLLED_TEMPLATE";

export type StructuredOutputCandidateReasonCode =
  | "OUTPUT_BODY_TOO_LARGE"
  | "OUTPUT_FACT_BINDING_INVALID"
  | "OUTPUT_NOT_SINGLE_JSON_OBJECT"
  | "OUTPUT_PERSONALITY_INVALID"
  | "OUTPUT_PRIVACY_DEPENDENCY_INVALID"
  | "OUTPUT_PROJECTION_INVALID"
  | "OUTPUT_SAFETY_REJECTED"
  | "OUTPUT_SCHEMA_INVALID"
  | "OUTPUT_TEXT_FORMAT_INVALID"
  | "OUTPUT_UNAPPROVED_FACT_REF"
  | "OUTPUT_VALIDATOR_UNAVAILABLE";

export interface StructuredOutputInvocationContextV1 {
  readonly outputSchemaVersion: string;
  readonly planContractVersion: string;
  readonly planFingerprint: string;
  readonly preparedModelInput: unknown;
  readonly promptVersion: string;
  readonly safetyPolicyVersion: string;
  readonly workload: PromptWorkloadV1;
}

export type CandidateContentPolicyResultV1 =
  | { readonly status: "PASS" }
  | {
      readonly status: "REJECTED";
      readonly violationCodes: readonly DailyCandidateSafetyViolationCode[];
    }
  | { readonly status: "INDETERMINATE" };

export interface CandidateContentPolicyV1 {
  evaluate(input: {
    readonly text: string;
    readonly workload: PromptWorkloadV1;
  }): CandidateContentPolicyResultV1 | Promise<CandidateContentPolicyResultV1>;
}

export type StructuredOutputCandidateValidationResultV1 =
  | {
      readonly payload: Readonly<Record<string, unknown>>;
      readonly payloadFingerprint: string;
      readonly status: "PASS";
      readonly validatorVersion: typeof STRUCTURED_OUTPUT_VALIDATOR_VERSION;
    }
  | {
      readonly reasonCode: Exclude<
        StructuredOutputCandidateReasonCode,
        "OUTPUT_VALIDATOR_UNAVAILABLE"
      >;
      readonly status: "INVALID" | "REJECTED";
    }
  | {
      readonly reasonCode: "OUTPUT_VALIDATOR_UNAVAILABLE";
      readonly status: "INDETERMINATE";
    };

export interface StructuredOutputCandidateValidatorV1 {
  validate(input: {
    readonly candidate: unknown;
    readonly invocation: StructuredOutputInvocationContextV1;
    readonly source: CandidateRouteRoleV1;
  }): Promise<StructuredOutputCandidateValidationResultV1>;
}

const PROVIDER_RESPONSE_BYTES_MAX = 12 * 1024;
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const VERSION_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const ASCII_NUMBER = /\d+/gu;
const DATE_LITERAL = /(?:\d{4}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?)/u;
const UNCERTAINTY =
  /(?:说不准|信息.{0,6}(?:有限|不算完整)|不补全|不替你.{0,8}下结论|暂时.{0,4}不判断|其余状态.{0,4}不作判断)/u;
const HUMOR_MARKERS = ["后台", "电量", "启动键", "排成长队"] as const;
const LOW_PRESSURE_FORBIDDEN = [
  "冲",
  "挑战",
  "抓住机会",
  "坚持一下",
  "别浪费状态",
  "必须完成",
] as const;
const RELATIONSHIP_OR_FABRICATION =
  /(?:我记得|记得你|终于等到你|一直等你|又见面|欢迎回来|我昨晚|我一直在想你|我也经历过|我完全理解|我能感受到你|共同经历|认识了?\d+天)/u;
const INTERNAL_OR_PRIVATE =
  /(?:PRIMARY_AI|BACKUP_AI|CONTROLLED_TEMPLATE|SAFE-001|system prompt|source[_ .-]?ref|fact[_ .-]?ref|raw[_ .-]?(?:score|note|output)|root[_ .-]?seed|choice[_ .-]?trace|basis[_ .-]?code|validator[_ .-]?code|prompt[_ .-]?version|provider|模型版本|系统提示|提示词|内部规则|晚间原文|历史AI|每日AI|娱乐分数)/iu;
const WEEKLY_DERIVED_OR_CAUSAL =
  /(?:百分比|百分之|平均值|均值|比例|因为|导致|证明|说明你|改善|恶化|越来越|未来会|将会继续|长期性格|人格类型)/u;
const WEEKLY_CONTINUITY_OR_PRESSURE =
  /(?:完美连续|数据完整|毫无缺失|每天都有完整|连续打卡|每天必须|必须坚持|完成挑战|浪费机会|不够自律)/u;
const WEEKLY_STATE_LABELS = [
  "很低",
  "偏低",
  "平稳",
  "不错",
  "轻快",
  "几乎见底",
  "较充足",
  "很充足",
  "较差",
  "还可以",
  "很沉重",
  "有些沉重",
  "比较好",
  "轻松",
  "相对更高",
  "相对更低",
  "有起伏",
  "整体相近",
] as const;
const DAILY_ACTION_ANCHORS: Readonly<
  Record<string, { readonly primary: readonly RegExp[]; readonly task: RegExp }>
> = Object.freeze({
  PRIORITIZE_ONE: {
    primary: [/(?:一件|一个重点|一项)/u],
    task: /(?:最重要|重点|优先)/u,
  },
  PREPARE_ONE_STEP: {
    primary: [/(?:准备|开始)/u, /(?:第一步|最小一步|小步骤)/u],
    task: /(?:第一步|最小一步)/u,
  },
  COMMUNICATE_CLEARLY: {
    primary: [/(?:沟通|表达)/u, /(?:重点|确认|写清|说清)/u],
    task: /(?:沟通|表达).{0,8}(?:重点|确认)|(?:重点|确认).{0,8}(?:沟通|表达)/u,
  },
  REDUCE_SWITCHING: {
    primary: [/(?:干扰|切换|同时处理)/u, /(?:关闭|减少|只处理)/u],
    task: /(?:关闭|减少).{0,8}(?:干扰|切换)|(?:干扰|切换).{0,8}(?:关闭|减少)/u,
  },
  ORGANIZE_SMALL_SCOPE: {
    primary: [/(?:整理|收好)/u, /(?:小范围|眼前|物件|到时间)/u],
    task: /(?:整理|收好).{0,8}(?:物件|眼前|小范围)|(?:物件|眼前).{0,8}(?:整理|收好)/u,
  },
  PAUSE_AND_RECOVER: {
    primary: [/(?:停顿|暂停|留白|休息)/u],
    task: /(?:停顿|暂停|留白|休息)/u,
  },
  REFLECT_BRIEFLY: {
    primary: [/(?:记下|写下|记录)/u, /(?:感受|一个词|一句话|一句)/u],
    task: /(?:记下|写下|记录).{0,8}(?:词|感受|一句)|(?:词|感受).{0,8}(?:记下|写下|记录)/u,
  },
  SEEK_REAL_SUPPORT: {
    primary: [/(?:现实|信任)/u, /(?:请求|联系|求助|提出)/u],
    task: /(?:现实|信任).{0,8}(?:人|对象)|(?:联系|选出).{0,8}(?:人|对象)/u,
  },
});
const NEXT_WEEK_ANCHORS: Readonly<Record<string, RegExp>> = Object.freeze({
  "plan.notice_energy_timing":
    /(?:精力|余量).{0,12}(?:时间|时候|时刻)|(?:时间|时候|时刻).{0,12}(?:精力|余量)/u,
  "plan.notice_mood_shifts":
    /(?:心情|情绪).{0,12}(?:变化|时刻)|(?:变化|时刻).{0,12}(?:心情|情绪)/u,
  "plan.notice_sleep_and_energy":
    /(?:休息|睡眠).{0,12}精力|精力.{0,12}(?:休息|睡眠)/u,
  "plan.notice_helpful_actions":
    /(?:帮助|有用).{0,12}(?:行动|小事)|(?:行动|小事).{0,12}(?:帮助|有用)/u,
  "plan.keep_one_small_note": /(?:记录|回看|写下|留下一次)/u,
  "plan.continue_without_pressure":
    /(?:节奏|继续).{0,12}(?:记录|回看)|(?:记录|回看).{0,12}(?:节奏|继续)/u,
});

const STATE_ASSERTIONS: Readonly<
  Record<"mood" | "energy" | "sleep", readonly RegExp[]>
> = Object.freeze({
  mood: [/(?:心情|情绪).{0,5}(?:很低|偏低|平稳|不错|轻快)/u],
  energy: [
    /(?:精力|电量).{0,5}(?:几乎见底|见底|偏低|平稳|较充足|比较充足|很充足|满格)/u,
  ],
  sleep: [/(?:休息|睡眠).{0,5}(?:很不够|不算充足|不足|还可以|不错|较差|偏低)/u],
});

const DEFAULT_CONTENT_POLICY: CandidateContentPolicyV1 = Object.freeze({
  evaluate({ text }: { readonly text: string }) {
    const verdict = evaluateDailyCandidateSafetyV1(text);
    return verdict.status === "PASS"
      ? Object.freeze({ status: "PASS" as const })
      : Object.freeze({
          status: "REJECTED" as const,
          violationCodes: verdict.violationCodes,
        });
  },
});

export function createStructuredOutputCandidateValidatorV1(input?: {
  readonly contentPolicy?: CandidateContentPolicyV1;
}): StructuredOutputCandidateValidatorV1 {
  const supplementalContentPolicy = input?.contentPolicy;
  return Object.freeze({
    async validate(request: {
      readonly candidate: unknown;
      readonly invocation: StructuredOutputInvocationContextV1;
      readonly source: CandidateRouteRoleV1;
    }) {
      try {
        return await validateCandidate(request, supplementalContentPolicy);
      } catch {
        return indeterminate();
      }
    },
  });
}

async function validateCandidate(
  input: {
    readonly candidate: unknown;
    readonly invocation: StructuredOutputInvocationContextV1;
    readonly source: CandidateRouteRoleV1;
  },
  supplementalContentPolicy: CandidateContentPolicyV1 | undefined,
): Promise<StructuredOutputCandidateValidationResultV1> {
  const context = parseContext(input.invocation, input.source);
  if (context === undefined) {
    return invalid("OUTPUT_FACT_BINDING_INVALID");
  }
  const decoded = decodeCandidate(input.candidate);
  if (typeof decoded === "string") {
    return invalid(decoded);
  }
  const schemaResult =
    context.invocation.workload === "DAILY_EXPRESSION_V1"
      ? ExpressionPayloadSchema.safeParse(decoded)
      : WeeklyExpressionPayloadSchema.safeParse(decoded);
  if (!schemaResult.success) {
    return invalid(classifySchemaFailure(schemaResult.error));
  }
  const payload = schemaResult.data;
  const formatFailure =
    context.invocation.workload === "DAILY_EXPRESSION_V1"
      ? dailyFormatFailure(payload as ExpressionPayload, context.prepared)
      : undefined;
  if (formatFailure !== undefined) {
    return invalid(formatFailure);
  }
  const bindingFailure =
    context.invocation.workload === "DAILY_EXPRESSION_V1"
      ? dailyBindingFailure(
          payload as ExpressionPayload,
          context.prepared as PreparedDailyPromptInputV1,
        )
      : weeklyBindingFailure(
          payload as WeeklyExpressionPayload,
          context.prepared as PreparedWeeklyPromptInputV1,
        );
  if (bindingFailure !== undefined) {
    return invalid(bindingFailure);
  }
  const text =
    context.invocation.workload === "DAILY_EXPRESSION_V1"
      ? dailyText(payload as ExpressionPayload)
      : weeklyText(payload as WeeklyExpressionPayload);
  const baselinePolicy = await DEFAULT_CONTENT_POLICY.evaluate({
    text,
    workload: context.invocation.workload,
  });
  if (baselinePolicy.status === "INDETERMINATE") {
    return indeterminate();
  }
  if (baselinePolicy.status === "REJECTED") {
    return rejected("OUTPUT_SAFETY_REJECTED");
  }
  const personalityFailure =
    context.invocation.workload === "DAILY_EXPRESSION_V1"
      ? dailyPersonalityFailure(
          payload as ExpressionPayload,
          context.prepared as PreparedDailyPromptInputV1,
          text,
        )
      : weeklyPersonalityFailure(payload as WeeklyExpressionPayload, text);
  if (personalityFailure !== undefined) {
    return rejected(personalityFailure);
  }
  const privacyFailure = privacyFailureCode(
    payload,
    context.prepared,
    context.invocation.workload,
    text,
  );
  if (privacyFailure !== undefined) {
    return rejected(privacyFailure);
  }
  if (supplementalContentPolicy !== undefined) {
    const supplementalPolicy = await supplementalContentPolicy.evaluate({
      text,
      workload: context.invocation.workload,
    });
    if (supplementalPolicy.status === "INDETERMINATE") {
      return indeterminate();
    }
    if (supplementalPolicy.status === "REJECTED") {
      return rejected("OUTPUT_SAFETY_REJECTED");
    }
  }
  const frozen = deepFreeze(structuredClone(payload)) as Readonly<
    Record<string, unknown>
  >;
  let payloadFingerprint: string;
  try {
    payloadFingerprint = fingerprintPromptJsonV1(frozen);
  } catch {
    return invalid("OUTPUT_PROJECTION_INVALID");
  }
  return Object.freeze({
    payload: frozen,
    payloadFingerprint,
    status: "PASS" as const,
    validatorVersion: STRUCTURED_OUTPUT_VALIDATOR_VERSION,
  });
}

function parseContext(
  invocation: StructuredOutputInvocationContextV1,
  source: CandidateRouteRoleV1,
):
  | {
      readonly invocation: StructuredOutputInvocationContextV1;
      readonly prepared: PreparedPromptInputV1;
    }
  | undefined {
  if (
    !isPlainObject(invocation) ||
    !["PRIMARY_AI", "BACKUP_AI", "CONTROLLED_TEMPLATE"].includes(source) ||
    !["DAILY_EXPRESSION_V1", "WEEKLY_EXPRESSION_V1"].includes(
      invocation.workload,
    ) ||
    invocation.outputSchemaVersion !== "1.0.0" ||
    invocation.safetyPolicyVersion !== "safety-policy-v1" ||
    !SHA256_HEX.test(invocation.planFingerprint) ||
    !VERSION_TOKEN.test(invocation.planContractVersion) ||
    !VERSION_TOKEN.test(invocation.promptVersion) ||
    invocation.planContractVersion.toLowerCase() === "latest" ||
    invocation.promptVersion.toLowerCase() === "latest"
  ) {
    return undefined;
  }
  const daily = invocation.workload === "DAILY_EXPRESSION_V1";
  if (
    invocation.promptVersion !==
      (daily ? DAILY_PROMPT_VERSION : WEEKLY_PROMPT_VERSION) ||
    invocation.planContractVersion !==
      (daily ? "daily-expression-v1" : "weekly-expression-plan-v1")
  ) {
    return undefined;
  }
  try {
    const prepared = parsePreparedPromptInputV1(
      invocation.preparedModelInput,
      invocation.workload,
    );
    return Object.freeze({ invocation, prepared });
  } catch (error) {
    if (error instanceof PreparedPromptInputError) {
      return undefined;
    }
    throw error;
  }
}

function decodeCandidate(
  candidate: unknown,
):
  | Record<string, unknown>
  | Exclude<
      StructuredOutputCandidateReasonCode,
      "OUTPUT_VALIDATOR_UNAVAILABLE"
    > {
  let decoded = candidate;
  if (typeof candidate === "string") {
    if (Buffer.byteLength(candidate, "utf8") > PROVIDER_RESPONSE_BYTES_MAX) {
      return "OUTPUT_BODY_TOO_LARGE";
    }
    try {
      decoded = JSON.parse(candidate) as unknown;
    } catch {
      return "OUTPUT_NOT_SINGLE_JSON_OBJECT";
    }
  }
  if (!isPlainObject(decoded)) {
    return "OUTPUT_NOT_SINGLE_JSON_OBJECT";
  }
  try {
    const canonical = canonicalPromptJsonV1(decoded);
    if (Buffer.byteLength(canonical, "utf8") > PROVIDER_RESPONSE_BYTES_MAX) {
      return "OUTPUT_BODY_TOO_LARGE";
    }
  } catch {
    return "OUTPUT_SCHEMA_INVALID";
  }
  if (!allStringsWellFormed(decoded)) {
    return "OUTPUT_TEXT_FORMAT_INVALID";
  }
  return decoded;
}

function classifySchemaFailure(
  error: z.ZodError,
): "OUTPUT_SCHEMA_INVALID" | "OUTPUT_TEXT_FORMAT_INVALID" {
  return error.issues.every(
    ({ code, message }) =>
      code === "custom" &&
      /(?:display characters|outer whitespace|single line|control characters|repeated whitespace|HTML|URL|Markdown|emoji|exclamation|question|body text|default-language content)/iu.test(
        message,
      ),
  )
    ? "OUTPUT_TEXT_FORMAT_INVALID"
    : "OUTPUT_SCHEMA_INVALID";
}

function dailyFormatFailure(
  payload: ExpressionPayload,
  prepared: PreparedPromptInputV1,
): "OUTPUT_TEXT_FORMAT_INVALID" | undefined {
  if (prepared.contract !== "prepared-daily-prompt-input-v1") {
    return "OUTPUT_TEXT_FORMAT_INVALID";
  }
  const coreText = [
    payload.greeting,
    payload.state_response,
    payload.overall_summary,
    payload.core_tip,
    ...payload.explanation_paragraphs,
    payload.dimension_explanations[prepared.focus_dimension_id],
    payload.primary_action.instruction,
    payload.primary_action.rationale,
    payload.primary_action.constraint_label,
    payload.optional_task.instruction,
    payload.closing,
  ].filter((value): value is string => value !== undefined);
  return displayLength(coreText) >
    prepared.segment_rules.core_display_characters_max
    ? "OUTPUT_TEXT_FORMAT_INVALID"
    : undefined;
}

function dailyBindingFailure(
  payload: ExpressionPayload,
  prepared: PreparedDailyPromptInputV1,
): "OUTPUT_FACT_BINDING_INVALID" | "OUTPUT_UNAPPROVED_FACT_REF" | undefined {
  if (
    payload.primary_action.action_id !== prepared.primary_action.action_id ||
    payload.optional_task.task_id !== prepared.optional_task.task_id ||
    (payload.primary_action.constraint_label !== undefined &&
      payload.primary_action.constraint_label !==
        prepared.primary_action.constraint_label)
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  const actionAnchors = DAILY_ACTION_ANCHORS[prepared.primary_action.kind];
  if (
    actionAnchors === undefined ||
    actionAnchors.primary.some(
      (pattern) => !pattern.test(payload.primary_action.instruction),
    ) ||
    !actionAnchors.task.test(payload.optional_task.instruction)
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  const expectedRitualIds = prepared.rituals
    .map(({ ritual_id: ritualId }) => ritualId)
    .sort();
  const actualRitualIds = Object.keys(payload.ritual_notes).sort();
  if (!sameStrings(expectedRitualIds, actualRitualIds)) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  for (const ritual of prepared.rituals) {
    const note = payload.ritual_notes[ritual.ritual_id];
    if (note === undefined || !note.includes(ritual.display_label)) {
      return "OUTPUT_FACT_BINDING_INVALID";
    }
    const allowedNumbers =
      ritual.kind === "NUMBER" ? [String(ritual.value)] : [];
    if (!numbersAllowed(note, allowedNumbers)) {
      return "OUTPUT_FACT_BINDING_INVALID";
    }
  }
  const safeNameNumbers = extractNumbers(
    prepared.greeting.preferred_name ?? "",
  );
  if (!numbersAllowed(payload.greeting, safeNameNumbers)) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  const primaryNumbers =
    prepared.primary_action.timebox_minutes === undefined
      ? []
      : [String(prepared.primary_action.timebox_minutes)];
  if (
    !numbersAllowed(
      [
        payload.primary_action.instruction,
        payload.primary_action.rationale,
        payload.primary_action.constraint_label,
      ]
        .filter((value): value is string => value !== undefined)
        .join(" "),
      primaryNumbers,
      "DURATION",
    )
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  const taskNumbers =
    prepared.optional_task.timebox_minutes === undefined
      ? []
      : [String(prepared.optional_task.timebox_minutes)];
  if (
    !numbersAllowed(payload.optional_task.instruction, taskNumbers, "DURATION")
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  const otherText = [
    payload.state_response,
    payload.overall_summary,
    payload.core_tip,
    ...payload.explanation_paragraphs,
    ...Object.values(payload.dimension_explanations),
    payload.closing,
  ].join(" ");
  if (!numbersAllowed(otherText, [], "DURATION")) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  const assertedFields = (
    Object.keys(STATE_ASSERTIONS) as (keyof typeof STATE_ASSERTIONS)[]
  ).filter((field) =>
    STATE_ASSERTIONS[field].some((pattern) =>
      pattern.test(payload.state_response),
    ),
  );
  const approvedFields = new Set(
    prepared.state_evidence.map(({ field }) => field),
  );
  if (
    assertedFields.length >
      prepared.segment_rules.state_response_max_evidence ||
    assertedFields.some((field) => !approvedFields.has(field)) ||
    (["LOW_ASSERTION", "PARTIAL_ASSERTION"].includes(prepared.assertion_mode) &&
      !UNCERTAINTY.test(payload.state_response))
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  return undefined;
}

function weeklyBindingFailure(
  payload: WeeklyExpressionPayload,
  prepared: PreparedWeeklyPromptInputV1,
): "OUTPUT_FACT_BINDING_INVALID" | "OUTPUT_UNAPPROVED_FACT_REF" | undefined {
  const approved: ReadonlyMap<
    string,
    PreparedWeeklyPromptInputV1["approved_facts"][number]
  > = new Map(
    prepared.approved_facts.map((fact) => [fact.fact_id, fact] as const),
  );
  const actualRefs = weeklySegments(payload).flatMap(({ refs }) => refs);
  if (actualRefs.some((ref) => !approved.has(ref))) {
    return "OUTPUT_UNAPPROVED_FACT_REF";
  }
  if (
    payload.observations.length !==
      prepared.segment_contracts.observations.length ||
    (payload.helpful_pattern !== undefined) !==
      (prepared.segment_contracts.helpful_pattern !== undefined)
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  const expectedSegments = [
    prepared.segment_contracts.opening.exact_fact_refs,
    ...prepared.segment_contracts.observations.map(
      ({ exact_fact_refs: refs }) => refs,
    ),
    ...(prepared.segment_contracts.helpful_pattern === undefined
      ? []
      : [prepared.segment_contracts.helpful_pattern.exact_fact_refs]),
    prepared.segment_contracts.next_week.exact_fact_refs,
    prepared.segment_contracts.closing.exact_fact_refs,
  ];
  const segments = weeklySegments(payload);
  if (
    segments.length !== expectedSegments.length ||
    segments.some(
      ({ refs }, index) => !sameStrings(refs, expectedSegments[index] ?? []),
    )
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  if (
    containsTitleNumber(payload.title) ||
    DATE_LITERAL.test(weeklyText(payload)) ||
    /(?:%|百分|平均|均值|比例)/u.test(weeklyText(payload))
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  for (const { refs, text } of segments) {
    const facts = refs
      .map((ref) => approved.get(ref))
      .filter((fact): fact is NonNullable<typeof fact> => fact !== undefined);
    const allowedNumbers = facts.flatMap(
      ({ allowed_numeric_literals: values }) => values,
    );
    if (!numbersAllowed(text, allowedNumbers, "WEEKLY")) {
      return "OUTPUT_FACT_BINDING_INVALID";
    }
    const supportedText = facts
      .flatMap(({ allowed_claim: claim, display_value: display }) => [
        claim,
        display,
      ])
      .join(" ");
    if (
      WEEKLY_STATE_LABELS.some(
        (label) =>
          weeklyStateLabelUsed(text, label) && !supportedText.includes(label),
      )
    ) {
      return "OUTPUT_FACT_BINDING_INVALID";
    }
    for (const fact of facts) {
      if (fact.fact_kind === "DIRECTION" || fact.fact_kind === "MODE") {
        const supportedLabels = WEEKLY_STATE_LABELS.filter((label) =>
          `${fact.display_value} ${fact.allowed_claim}`.includes(label),
        );
        if (
          supportedLabels.length === 0 ||
          !supportedLabels.some((label) => text.includes(label))
        ) {
          return "OUTPUT_FACT_BINDING_INVALID";
        }
      }
      if (
        fact.fact_kind === "HELPFUL_ACTION" &&
        !/(?:帮助|有帮助|有用)/u.test(text)
      ) {
        return "OUTPUT_FACT_BINDING_INVALID";
      }
      if (
        fact.fact_kind === "NEXT_OBSERVATION" &&
        !NEXT_WEEK_ANCHORS[fact.fact_id]?.test(text)
      ) {
        return "OUTPUT_FACT_BINDING_INVALID";
      }
    }
  }
  if (
    !extractNumbers(payload.opening.text, "WEEKLY").some((value) =>
      prepared.segment_contracts.opening.exact_fact_refs.some((ref) =>
        approved.get(ref)?.allowed_numeric_literals.includes(value),
      ),
    ) ||
    !/(?:缺失|留空|没有记录|不完整)/u.test(payload.opening.text)
  ) {
    return "OUTPUT_FACT_BINDING_INVALID";
  }
  return undefined;
}

function dailyPersonalityFailure(
  payload: ExpressionPayload,
  prepared: PreparedDailyPromptInputV1,
  text: string,
): "OUTPUT_PERSONALITY_INVALID" | undefined {
  const humorCount = HUMOR_MARKERS.reduce(
    (total, marker) => total + occurrences(text, marker),
    0,
  );
  if (
    evaluateExpressionLanguageV1(text).status === "REJECT" ||
    RELATIONSHIP_OR_FABRICATION.test(text) ||
    /[?？]$/u.test(payload.closing) ||
    humorCount > 1 ||
    (prepared.effective_expression_constraints.humor_ceiling === "NONE" &&
      humorCount > 0) ||
    (prepared.effective_expression_constraints.pressure_ceiling ===
      "VERY_LOW" &&
      LOW_PRESSURE_FORBIDDEN.some((marker) => text.includes(marker)))
  ) {
    return "OUTPUT_PERSONALITY_INVALID";
  }
  return undefined;
}

function weeklyPersonalityFailure(
  payload: WeeklyExpressionPayload,
  text: string,
): "OUTPUT_PERSONALITY_INVALID" | undefined {
  if (
    evaluateExpressionLanguageV1(text).status === "REJECT" ||
    RELATIONSHIP_OR_FABRICATION.test(text) ||
    WEEKLY_DERIVED_OR_CAUSAL.test(text) ||
    WEEKLY_CONTINUITY_OR_PRESSURE.test(text) ||
    /(?:最适合你|最有效|已经证明有效|比其他人|比别人|排名)/u.test(text) ||
    /(?:必须|连续|挑战|打卡)/u.test(payload.next_week.text)
  ) {
    return "OUTPUT_PERSONALITY_INVALID";
  }
  return undefined;
}

function privacyFailureCode(
  payload: ExpressionPayload | WeeklyExpressionPayload,
  prepared: PreparedPromptInputV1,
  workload: PromptWorkloadV1,
  text: string,
): "OUTPUT_PRIVACY_DEPENDENCY_INVALID" | undefined {
  if (INTERNAL_OR_PRIVATE.test(text)) {
    return "OUTPUT_PRIVACY_DEPENDENCY_INVALID";
  }
  if (workload === "DAILY_EXPRESSION_V1") {
    const dailyPayload = payload as ExpressionPayload;
    const dailyPrepared = prepared as PreparedDailyPromptInputV1;
    const name = dailyPrepared.greeting.preferred_name;
    if (
      name !== undefined &&
      (occurrences(dailyPayload.greeting, name) > 1 ||
        occurrences(dailyTextWithoutGreeting(dailyPayload), name) > 0)
    ) {
      return "OUTPUT_PRIVACY_DEPENDENCY_INVALID";
    }
  }
  return undefined;
}

function dailyText(payload: ExpressionPayload): string {
  return [payload.greeting, dailyTextWithoutGreeting(payload)].join(" ");
}

function dailyTextWithoutGreeting(payload: ExpressionPayload): string {
  return [
    payload.state_response,
    payload.overall_summary,
    payload.core_tip,
    ...payload.explanation_paragraphs,
    ...Object.values(payload.dimension_explanations),
    payload.primary_action.instruction,
    payload.primary_action.rationale,
    payload.primary_action.constraint_label,
    payload.optional_task.instruction,
    ...Object.values(payload.ritual_notes),
    payload.closing,
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ");
}

function weeklyText(payload: WeeklyExpressionPayload): string {
  return [
    payload.title,
    ...weeklySegments(payload).map(({ text }) => text),
  ].join(" ");
}

function weeklySegments(payload: WeeklyExpressionPayload): readonly {
  readonly refs: readonly string[];
  readonly text: string;
}[] {
  return [
    { refs: payload.opening.fact_refs, text: payload.opening.text },
    ...payload.observations.map(({ fact_refs: refs, text }) => ({
      refs,
      text,
    })),
    ...(payload.helpful_pattern === undefined
      ? []
      : [
          {
            refs: payload.helpful_pattern.fact_refs,
            text: payload.helpful_pattern.text,
          },
        ]),
    { refs: payload.next_week.fact_refs, text: payload.next_week.text },
    { refs: payload.closing.fact_refs, text: payload.closing.text },
  ];
}

function displayLength(values: readonly string[]): number {
  return values.reduce(
    (total, value) => total + countDisplayCharacters(value),
    0,
  );
}

type NumericLiteralMode = "ASCII" | "DURATION" | "WEEKLY";

function extractNumbers(
  value: string,
  mode: NumericLiteralMode = "ASCII",
): readonly string[] {
  const values = [...value.matchAll(ASCII_NUMBER)].map(([match]) => match);
  const pattern =
    mode === "DURATION"
      ? /([零〇一二两三四五六七八九十]+)(?=分钟|天)/gu
      : mode === "WEEKLY"
        ? /(?<![上下每再第])([零〇一二两三四五六七八九十]+)(?=天|次)/gu
        : undefined;
  if (pattern !== undefined) {
    for (const match of value.matchAll(pattern)) {
      values.push(parseChineseInteger(match[1] ?? ""));
    }
  }
  return values;
}

function numbersAllowed(
  value: string,
  allowed: readonly string[],
  mode: NumericLiteralMode = "ASCII",
): boolean {
  return extractNumbers(value, mode).every((entry) => allowed.includes(entry));
}

function containsTitleNumber(value: string): boolean {
  return /\d|[零〇一二两三四五六七八九十百千万]+(?=天|次|周|月|年)/u.test(
    value,
  );
}

function parseChineseInteger(value: string): string {
  const digits: Readonly<Record<string, number>> = Object.freeze({
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  });
  if (!value.includes("十")) {
    const digit = digits[value];
    return digit === undefined ? value : String(digit);
  }
  const [tensText = "", onesText = ""] = value.split("十", 2);
  const tens = tensText === "" ? 1 : digits[tensText];
  const ones = onesText === "" ? 0 : digits[onesText];
  return tens === undefined || ones === undefined
    ? value
    : String(tens * 10 + ones);
}

function weeklyStateLabelUsed(text: string, label: string): boolean {
  if (["相对更高", "相对更低", "有起伏", "整体相近"].includes(label)) {
    return text.includes(label);
  }
  return (
    text.includes(`${label}状态`) ||
    text.includes(`${label}记录`) ||
    new RegExp(`(?:心情|精力|睡眠|休息|晚间|状态).{0,6}${label}`, "u").test(
      text,
    )
  );
}

function occurrences(value: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(needle, offset)) >= 0) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function allStringsWellFormed(value: unknown): boolean {
  if (typeof value === "string") {
    return value.isWellFormed();
  }
  if (Array.isArray(value)) {
    return value.every(allStringsWellFormed);
  }
  if (isPlainObject(value)) {
    return Object.entries(value).every(
      ([key, entry]) => key.isWellFormed() && allStringsWellFormed(entry),
    );
  }
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function invalid(
  reasonCode: Exclude<
    StructuredOutputCandidateReasonCode,
    "OUTPUT_VALIDATOR_UNAVAILABLE"
  >,
): StructuredOutputCandidateValidationResultV1 {
  return Object.freeze({ reasonCode, status: "INVALID" as const });
}

function rejected(
  reasonCode: Exclude<
    StructuredOutputCandidateReasonCode,
    "OUTPUT_VALIDATOR_UNAVAILABLE"
  >,
): StructuredOutputCandidateValidationResultV1 {
  return Object.freeze({ reasonCode, status: "REJECTED" as const });
}

function indeterminate(): StructuredOutputCandidateValidationResultV1 {
  return Object.freeze({
    reasonCode: "OUTPUT_VALIDATOR_UNAVAILABLE" as const,
    status: "INDETERMINATE" as const,
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
