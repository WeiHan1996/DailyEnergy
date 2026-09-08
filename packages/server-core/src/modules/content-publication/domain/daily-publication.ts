import { createHash } from "node:crypto";

import {
  ClientDailyContentViewSchema,
  PublishedDailyResultSchema,
  type ClientDailyContentView,
  type ExpressionPayload,
  type PublishedDailyResult,
  type RuleFacts,
  type StableDimensionId,
} from "@daily-energy/shared-schemas";
import {
  fingerprintGatewayJson,
  validateGatewayInvocationV1,
  verifyGatewayValidationReceiptV1,
  type GatewayCandidateV1,
  type GatewayInvocationV1,
} from "../../ai-gateway/public/index.js";

const DIMENSION_LABELS: Readonly<Record<StableDimensionId, string>> =
  Object.freeze({
    pace: "今日节奏",
    action: "行动推进",
    connection: "沟通连接",
    resources: "资源安排",
    recovery: "恢复留白",
  });
const BAND_LABELS = Object.freeze({
  LOW: "适合放轻",
  STEADY: "适合稳住",
  HIGH: "余量较多",
} as const);
const OVERALL_BAND_LABELS = Object.freeze({
  LOW: "适合放轻",
  STEADY: "适合稳住",
  HIGH: "适合推进",
} as const);
const COLOR_LABELS = Object.freeze({
  MIST_BLUE: "雾蓝",
  WARM_BEIGE: "暖米色",
  SAGE_GREEN: "鼠尾草绿",
  SOFT_LILAC: "柔丁香紫",
  CLOUD_GRAY: "云灰",
} as const);

export function assembleControlledTemplateDailyResultV1(input: {
  readonly expression: ExpressionPayload;
  readonly generatedAt: Date;
  readonly inputSnapshotRef: string;
  readonly productDate: string;
  readonly resultId: string;
  readonly resultVersion: string;
  readonly ruleFacts: RuleFacts;
  readonly safetyPolicyVersion: string;
  readonly templateVersion: string;
  readonly userRef: string;
}): PublishedDailyResult {
  return assembleDailyResultV1({
    ...input,
    provenance: {
      generationMode: "CONTROLLED_TEMPLATE",
      personalizationLevel: "FULL",
      templateVersion: input.templateVersion,
    },
  });
}

export function assembleGatewayDailyResultV1(input: {
  readonly candidate: GatewayCandidateV1;
  readonly generatedAt: Date;
  readonly inputSnapshotRef: string;
  readonly invocation: GatewayInvocationV1;
  readonly productDate: string;
  readonly resultId: string;
  readonly resultVersion: string;
  readonly ruleFacts: RuleFacts;
  readonly userRef: string;
}): PublishedDailyResult {
  let invocation: GatewayInvocationV1;
  try {
    invocation = validateGatewayInvocationV1(input.invocation);
  } catch {
    throw new DailyPublicationError("GATEWAY_CANDIDATE_BINDING_INVALID");
  }
  if (
    invocation.workload !== "DAILY_EXPRESSION_V1" ||
    input.candidate.workload !== invocation.workload ||
    fingerprintGatewayJson(input.candidate.payload) !==
      input.candidate.payloadFingerprint ||
    (input.candidate.generationMode === "CONTROLLED_TEMPLATE"
      ? input.candidate.provenance.templateVersion !==
        invocation.templateVersion
      : input.candidate.provenance.promptVersion !== invocation.promptVersion)
  ) {
    throw new DailyPublicationError("GATEWAY_CANDIDATE_BINDING_INVALID");
  }
  try {
    verifyGatewayValidationReceiptV1(input.candidate.validationReceipt, {
      outputSchemaVersion: invocation.outputSchemaVersion,
      payloadFingerprint: input.candidate.payloadFingerprint,
      planFingerprint: invocation.planFingerprint,
      promptVersion: invocation.promptVersion,
      routeRole: input.candidate.generationMode,
      safetyPolicyVersion: invocation.safetyPolicyVersion,
      validatorVersion: input.candidate.validationReceipt.validatorVersion,
      workload: invocation.workload,
    });
  } catch {
    throw new DailyPublicationError("GATEWAY_CANDIDATE_RECEIPT_INVALID");
  }
  const common = {
    expression: input.candidate.payload as unknown as ExpressionPayload,
    generatedAt: input.generatedAt,
    inputSnapshotRef: input.inputSnapshotRef,
    productDate: input.productDate,
    resultId: input.resultId,
    resultVersion: input.resultVersion,
    ruleFacts: input.ruleFacts,
    safetyPolicyVersion: invocation.safetyPolicyVersion,
    userRef: input.userRef,
  };
  return input.candidate.generationMode === "CONTROLLED_TEMPLATE"
    ? assembleDailyResultV1({
        ...common,
        provenance: {
          generationMode: "CONTROLLED_TEMPLATE",
          personalizationLevel: invocation.personalizationLevel,
          templateVersion: input.candidate.provenance.templateVersion,
        },
      })
    : assembleDailyResultV1({
        ...common,
        provenance: {
          generationMode: input.candidate.generationMode,
          model: input.candidate.provenance.model,
          personalizationLevel: invocation.personalizationLevel,
          promptVersion: input.candidate.provenance.promptVersion,
          provider: input.candidate.provenance.provider,
        },
      });
}

type DailyResultProvenanceV1 =
  | {
      readonly generationMode: "CONTROLLED_TEMPLATE";
      readonly personalizationLevel: "FULL" | "REDUCED";
      readonly templateVersion: string;
    }
  | {
      readonly generationMode: "BACKUP_AI" | "PRIMARY_AI";
      readonly model: string;
      readonly personalizationLevel: "FULL" | "REDUCED";
      readonly promptVersion: string;
      readonly provider: string;
    };

function assembleDailyResultV1(input: {
  readonly expression: ExpressionPayload;
  readonly generatedAt: Date;
  readonly inputSnapshotRef: string;
  readonly productDate: string;
  readonly provenance: DailyResultProvenanceV1;
  readonly resultId: string;
  readonly resultVersion: string;
  readonly ruleFacts: RuleFacts;
  readonly safetyPolicyVersion: string;
  readonly userRef: string;
}): PublishedDailyResult {
  const generatedAt = input.generatedAt.toISOString();
  const provenance =
    input.provenance.generationMode === "CONTROLLED_TEMPLATE"
      ? {
          generation_mode: "CONTROLLED_TEMPLATE" as const,
          personalization_level: input.provenance.personalizationLevel,
          template_version: input.provenance.templateVersion,
        }
      : {
          generation_mode: input.provenance.generationMode,
          model: input.provenance.model,
          personalization_level: input.provenance.personalizationLevel,
          prompt_version: input.provenance.promptVersion,
          provider: input.provenance.provider,
        };
  const parsed = PublishedDailyResultSchema.safeParse({
    contract: "daily-content",
    schema_version: "1.0.0",
    identity: {
      result_id: input.resultId,
      user_ref: input.userRef,
      product_date: input.productDate,
      result_version: input.resultVersion,
      generated_at: generatedAt,
    },
    input_snapshot_ref: input.inputSnapshotRef,
    facts: input.ruleFacts,
    expression: input.expression,
    source_dependencies: [],
    privacy_fallbacks: {},
    provenance: {
      input_snapshot_version: "input-v1",
      rule_version: "daily-rules-v1",
      algorithm_version: "daily-score-v1",
      safety_policy_version: input.safetyPolicyVersion,
      ...provenance,
    },
    validation: { status: "PASSED", validated_at: generatedAt },
  });
  if (!parsed.success) {
    throw new DailyPublicationError("PUBLISHED_RESULT_SCHEMA_INVALID");
  }
  return deepFreeze(parsed.data);
}

export function projectClientDailyContentViewV1(
  result: PublishedDailyResult,
): ClientDailyContentView {
  const parsedResult = PublishedDailyResultSchema.safeParse(result);
  if (!parsedResult.success) {
    throw new DailyPublicationError("PUBLISHED_RESULT_SCHEMA_INVALID");
  }
  const value = parsedResult.data;
  const facts = value.facts;
  const expression = value.expression;
  const dimensionsById = new Map(
    facts.dimensions.map((dimension) => [dimension.id, dimension]),
  );
  const ritualsById = new Map(
    facts.ritual_facts.map((ritual) => [ritual.ritual_id, ritual]),
  );
  const candidate = {
    contract: "daily-content-view",
    schema_version: value.schema_version,
    result_id: value.identity.result_id,
    product_date: value.identity.product_date,
    result_version: value.identity.result_version,
    generated_at: value.identity.generated_at,
    content_label: "娱乐与行动参考",
    greeting: expression.greeting,
    state_response: expression.state_response,
    overall: {
      band: facts.overall.band,
      band_label: OVERALL_BAND_LABELS[facts.overall.band],
      summary: expression.overall_summary,
    },
    focus_dimension_id: facts.focus_dimension_id,
    dimensions: facts.display_order.map((id) => {
      const fact = dimensionsById.get(id);
      if (fact === undefined) {
        throw new DailyPublicationError("CLIENT_PROJECTION_BINDING_INVALID");
      }
      return {
        id,
        label: DIMENSION_LABELS[id],
        band: fact.band,
        band_label: BAND_LABELS[fact.band],
        explanation: expression.dimension_explanations[id],
        is_focus: id === facts.focus_dimension_id,
      };
    }),
    core_tip: expression.core_tip,
    explanation_paragraphs: expression.explanation_paragraphs,
    primary_action: expression.primary_action,
    optional_task: expression.optional_task,
    rituals: Object.entries(expression.ritual_notes).map(([ritualId, note]) => {
      const fact = ritualsById.get(ritualId);
      if (fact === undefined) {
        throw new DailyPublicationError("CLIENT_PROJECTION_BINDING_INVALID");
      }
      return {
        kind: fact.kind,
        display_value:
          fact.kind === "NUMBER" ? String(fact.value) : colorLabel(fact.value),
        note,
      };
    }),
    closing: expression.closing,
    personalization_notice:
      value.provenance.personalization_level === "REDUCED"
        ? "PERSONALIZATION_REDUCED"
        : "NONE",
  };
  const parsed = ClientDailyContentViewSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new DailyPublicationError("CLIENT_PROJECTION_SCHEMA_INVALID");
  }
  return deepFreeze(parsed.data);
}

export function dailyResultFingerprintV1(result: PublishedDailyResult): Buffer {
  const parsed = PublishedDailyResultSchema.safeParse(result);
  if (!parsed.success) {
    throw new DailyPublicationError("PUBLISHED_RESULT_SCHEMA_INVALID");
  }
  return createHash("sha256").update(stableJson(parsed.data), "utf8").digest();
}

export class DailyPublicationError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "DailyPublicationError";
  }
}

function colorLabel(value: string): string {
  const label = COLOR_LABELS[value as keyof typeof COLOR_LABELS];
  if (label === undefined) {
    throw new DailyPublicationError("CLIENT_PROJECTION_BINDING_INVALID");
  }
  return label;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
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
