import { createHash } from "node:crypto";

import type { ExpressionStyle } from "@daily-energy/shared-schemas";

export const EXPRESSION_STYLE_POLICY_VERSION = "expression-style-policy-v1";
export const EXPRESSION_STYLE_SAMPLE_SET_VERSION =
  "expression-style-samples-v1";

export const VisibleExpressionStyleValues = Object.freeze([
  "GENTLE",
  "LIGHT_HUMOR",
  "CLEAR_DIRECT",
] as const);
export type VisibleExpressionStyle =
  (typeof VisibleExpressionStyleValues)[number];

export type ExpressionLanguageViolationCode =
  | "EMPTY_OVERPRAISE"
  | "EXCLUSIVITY_OR_POSSESSION"
  | "FABRICATED_INTIMACY"
  | "FEAR_OR_COERCION"
  | "PERSONALITY_FRAGMENTATION"
  | "SHAME_OR_INSULT";

export interface ExpressionStyleParametersV1 {
  readonly directness: number;
  readonly humor: number;
  readonly warmth: number;
}

export interface EffectiveExpressionStyleV1 {
  readonly parameters: ExpressionStyleParametersV1;
  readonly policyVersion: typeof EXPRESSION_STYLE_POLICY_VERSION;
  readonly renderingStyle: ExpressionStyle;
  readonly requestedStyle: ExpressionStyle;
}

export type OptionalExpressionStyleResolutionV1 =
  | {
      readonly reason: "EXPLICIT";
      readonly source: "USER_PREFERENCE";
      readonly style: ExpressionStyle;
    }
  | {
      readonly reason: "MISSING" | "UNRECOGNIZED";
      readonly source: "SYSTEM_DEFAULT";
      readonly style: "BALANCED";
    };

export class AuthoritativeExpressionStyleError extends Error {
  public readonly code = "EXPRESSION_STYLE_AUTHORITATIVE_INVALID";

  public constructor() {
    super("EXPRESSION_STYLE_AUTHORITATIVE_INVALID");
    this.name = "AuthoritativeExpressionStyleError";
  }
}

const EXPRESSION_STYLES = Object.freeze([
  "BALANCED",
  ...VisibleExpressionStyleValues,
] as const satisfies readonly ExpressionStyle[]);

const EXPRESSION_LANGUAGE_RULE_SOURCES = Object.freeze([
  {
    code: "SHAME_OR_INSULT" as const,
    patterns: [
      "(?:废柴|没用|无能|懒惰|蠢货|自律不够|别找借口|活该|连这都做不到)",
    ],
  },
  {
    code: "FEAR_OR_COERCION" as const,
    patterns: [
      "(?:不做|不完成|错过).{0,20}(?:失去|倒霉|惩罚|坏事|后悔)",
      "(?:必须|赶紧).{0,20}(?:否则|不然|才配|才算)",
    ],
  },
  {
    code: "EMPTY_OVERPRAISE" as const,
    patterns: [
      "(?:你是最棒的|你比所有人都优秀|你值得世界上一切美好|你天生拥有强大能量|只要相信自己就能做到任何事|你永远完美)",
    ],
  },
  {
    code: "EXCLUSIVITY_OR_POSSESSION" as const,
    patterns: [
      "(?:只有我懂你|你只需要我|你需要我|别离开我|你只能依赖我|我是你唯一|你属于我)",
    ],
  },
  {
    code: "FABRICATED_INTIMACY" as const,
    patterns: [
      "(?:宝贝|亲爱的|主人|小可怜|姐妹|女王|老婆|我的女孩)",
      "(?:我会一直陪着你|我永远陪着你|我完全理解你的痛苦|我能感受到你|我昨晚一直在想你)",
    ],
  },
  {
    code: "PERSONALITY_FRAGMENTATION" as const,
    patterns: [
      "(?:切换成另一个人格|换一个角色|扮演你的恋人|现在我是你的恋人|清醒直接人格|温柔人格|幽默人格)",
    ],
  },
]);

const EXPRESSION_LANGUAGE_RULES: readonly {
  readonly code: ExpressionLanguageViolationCode;
  readonly patterns: readonly RegExp[];
}[] = EXPRESSION_LANGUAGE_RULE_SOURCES.map(({ code, patterns }) => ({
  code,
  patterns: patterns.map((pattern) => new RegExp(pattern, "u")),
}));

const GENTLE_MARKERS = Object.freeze([
  "慢一点",
  "轻轻",
  "不用急",
  "也没关系",
  "愿意时",
]);
const HUMOR_MARKERS = Object.freeze([
  "后台",
  "电量",
  "启动键",
  "排成长队",
  "小路标",
]);
const DIRECT_MARKERS = Object.freeze([
  "只保留",
  "只推进",
  "只留意",
  "先完成",
  "停止增加",
]);

const EXPRESSION_STYLE_POLICY_SOURCE_V1 = {
  authorityPaths: [
    "docs/ai/personality.md",
    "docs/ai/scoring-rules.md",
    "docs/ai/prompt-spec.md",
    "docs/ai/evaluation.md",
    "docs/ai/safety.md",
  ],
  bindings: {
    daily: {
      promptVersion: "daily-expression-zh-cn-v1",
      templateVersion: "daily-template-v1",
    },
    weekly: {
      promptVersion: "weekly-expression-zh-cn-v1",
      templateVersion: "weekly-template-v1",
    },
  },
  contract: "dailyenergy-expression-style-policy-v1",
  defaultStyle: "BALANCED",
  languageRules: EXPRESSION_LANGUAGE_RULE_SOURCES,
  personalityId: "dailyenergy-digital-friend-v1",
  policyVersion: EXPRESSION_STYLE_POLICY_VERSION,
  sampleSetVersion: EXPRESSION_STYLE_SAMPLE_SET_VERSION,
  sharedParameters: {
    informationDensity: 45,
    intimacy: 25,
    mystery: 15,
    proactivity: 35,
  },
  styleClassifierMarkers: {
    CLEAR_DIRECT: DIRECT_MARKERS,
    GENTLE: GENTLE_MARKERS,
    LIGHT_HUMOR: HUMOR_MARKERS,
  },
  styles: {
    BALANCED: {
      parameters: { directness: 50, humor: 20, warmth: 70 },
      visiblePreference: false,
    },
    GENTLE: {
      parameters: { directness: 40, humor: 5, warmth: 85 },
      visiblePreference: true,
    },
    LIGHT_HUMOR: {
      parameters: { directness: 50, humor: 45, warmth: 70 },
      visiblePreference: true,
    },
    CLEAR_DIRECT: {
      parameters: { directness: 80, humor: 5, warmth: 60 },
      visiblePreference: true,
    },
  },
} as const;

export const EXPRESSION_STYLE_POLICY_FINGERPRINT_V1 =
  fingerprintExpressionStyleJsonV1(EXPRESSION_STYLE_POLICY_SOURCE_V1);

const EXPECTED_EXPRESSION_STYLE_POLICY_FINGERPRINT_V1 =
  "4c2c678baaf68bdd92cb3b769354b451f8122f5c5f5521fdebbb40e4f36ecb10";

if (
  EXPRESSION_STYLE_POLICY_FINGERPRINT_V1 !==
  EXPECTED_EXPRESSION_STYLE_POLICY_FINGERPRINT_V1
) {
  throw new Error("EXPRESSION_STYLE_POLICY_FINGERPRINT_MISMATCH");
}

export const EXPRESSION_STYLE_POLICY_V1 = deepFreeze({
  ...EXPRESSION_STYLE_POLICY_SOURCE_V1,
  policyFingerprint: EXPRESSION_STYLE_POLICY_FINGERPRINT_V1,
});

// Optional preference projection can default; persisted generation snapshots cannot.
export function resolveOptionalExpressionStylePreferenceV1(
  value: unknown,
): OptionalExpressionStyleResolutionV1 {
  if (isExpressionStyle(value)) {
    return Object.freeze({
      reason: "EXPLICIT" as const,
      source: "USER_PREFERENCE" as const,
      style: value,
    });
  }
  return Object.freeze({
    reason: value === undefined || value === null ? "MISSING" : "UNRECOGNIZED",
    source: "SYSTEM_DEFAULT" as const,
    style: "BALANCED" as const,
  });
}

export function assertAuthoritativeExpressionStyleV1(
  value: unknown,
): ExpressionStyle {
  if (!isExpressionStyle(value)) {
    throw new AuthoritativeExpressionStyleError();
  }
  return value;
}

export function resolveEffectiveExpressionStyleV1(input: {
  readonly humorCeiling: "LIGHT" | "NONE";
  readonly requestedStyle: ExpressionStyle;
}): EffectiveExpressionStyleV1 {
  const requestedStyle = assertAuthoritativeExpressionStyleV1(
    input.requestedStyle,
  );
  const renderingStyle =
    requestedStyle === "LIGHT_HUMOR" && input.humorCeiling === "NONE"
      ? "BALANCED"
      : requestedStyle;
  const parameters =
    EXPRESSION_STYLE_POLICY_V1.styles[renderingStyle].parameters;
  return deepFreeze({
    parameters: {
      ...parameters,
      humor: input.humorCeiling === "NONE" ? 0 : parameters.humor,
    },
    policyVersion: EXPRESSION_STYLE_POLICY_VERSION,
    renderingStyle,
    requestedStyle,
  });
}

export function evaluateExpressionLanguageV1(text: string): Readonly<{
  status: "PASS" | "REJECT";
  violationCodes: readonly ExpressionLanguageViolationCode[];
}> {
  const violationCodes = EXPRESSION_LANGUAGE_RULES.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(text)),
  ).map(({ code }) => code);
  return deepFreeze(
    violationCodes.length === 0
      ? { status: "PASS" as const, violationCodes: [] }
      : { status: "REJECT" as const, violationCodes },
  );
}

export function classifySyntheticExpressionStyleV1(
  text: string,
): VisibleExpressionStyle | undefined {
  if (HUMOR_MARKERS.some((marker) => text.includes(marker))) {
    return "LIGHT_HUMOR";
  }
  if (GENTLE_MARKERS.some((marker) => text.includes(marker))) {
    return "GENTLE";
  }
  if (DIRECT_MARKERS.some((marker) => text.includes(marker))) {
    return "CLEAR_DIRECT";
  }
  return undefined;
}

export function fingerprintExpressionStyleJsonV1(value: unknown): string {
  return createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function isExpressionStyle(value: unknown): value is ExpressionStyle {
  return (
    typeof value === "string" &&
    (EXPRESSION_STYLES as readonly string[]).includes(value)
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
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
