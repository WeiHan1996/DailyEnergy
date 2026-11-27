import {
  PublishedWeeklySummarySchema,
  WeeklyAggregateFactsSchema,
  WeeklyExpressionPayloadSchema,
  WeeklyExpressionPlanSchema,
  type PublishedWeeklySummary,
} from "@daily-energy/shared-schemas";

import {
  fingerprintGatewayJson,
  validateGatewayInvocationV1,
  verifyGatewayValidationReceiptV1,
  type GatewayCandidateV1,
  type GatewayInvocationV1,
} from "../../ai-gateway/public/index.js";

export const WEEKLY_PUBLICATION_POLICY_VERSION =
  "weekly-publication-policy-v1" as const;

export type WeeklyPublicationErrorCode =
  | "WEEKLY_CANDIDATE_BINDING_INVALID"
  | "WEEKLY_CANDIDATE_RECEIPT_INVALID"
  | "WEEKLY_PLAN_BINDING_INVALID"
  | "WEEKLY_SOURCE_DEPENDENCY_INVALID";

export class WeeklyPublicationError extends Error {
  public constructor(public readonly code: WeeklyPublicationErrorCode) {
    super(code);
    this.name = "WeeklyPublicationError";
  }
}

export interface WeeklyMemoryDependencyV1 {
  readonly purpose: string;
  readonly sourceRef: string;
  readonly sourceRevision: number;
}

export interface AssembleGatewayWeeklySummaryInput {
  readonly aggregate: unknown;
  readonly aggregateFactsRef: string;
  readonly candidate: GatewayCandidateV1;
  readonly generatedAt: Date;
  readonly invocation: GatewayInvocationV1;
  readonly memoryDependencies?: readonly WeeklyMemoryDependencyV1[];
  readonly plan: unknown;
  readonly previousSummaryId?: string;
  readonly summaryId: string;
  readonly summaryRevision: number;
  readonly windowEndDate: string;
  readonly windowId: string;
  readonly windowStartDate: string;
}

/**
 * Turns one validated Gateway candidate into the immutable Weekly summary.
 *
 * The candidate is trusted only after the invocation, plan, workload, version
 * and validation receipt all bind to the exact frozen inputs. Any mismatch
 * discards the whole candidate; nothing is repaired, merged or partially kept.
 * The same assembler serves primary, backup and controlled-template candidates,
 * so a template fallback publishes through exactly the same path as AI.
 */
export function assembleGatewayWeeklySummaryV1(
  input: AssembleGatewayWeeklySummaryInput,
): PublishedWeeklySummary {
  const invocation = parseInvocation(input.invocation);
  const aggregate = WeeklyAggregateFactsSchema.safeParse(input.aggregate);
  const plan = WeeklyExpressionPlanSchema.safeParse(input.plan);
  if (!aggregate.success || !plan.success) {
    throw new WeeklyPublicationError("WEEKLY_PLAN_BINDING_INVALID");
  }
  if (
    plan.data.coverage_level !== aggregate.data.coverage.coverage_level ||
    plan.data.approved_fact_ids.some(
      (factId) => !aggregate.data.approved_fact_catalog.includes(factId),
    ) ||
    aggregate.data.window_id !== input.windowId
  ) {
    throw new WeeklyPublicationError("WEEKLY_PLAN_BINDING_INVALID");
  }
  assertCandidateBinding(input.candidate, invocation);
  const expression = WeeklyExpressionPayloadSchema.safeParse(
    input.candidate.payload,
  );
  if (!expression.success) {
    throw new WeeklyPublicationError("WEEKLY_CANDIDATE_BINDING_INVALID");
  }
  const dependencies = normalizeDependencies(input.memoryDependencies ?? []);
  const generatedAt = input.generatedAt.toISOString();
  const provenance =
    input.candidate.generationMode === "CONTROLLED_TEMPLATE"
      ? {
          generation_mode: "CONTROLLED_TEMPLATE" as const,
          personalization_level: invocation.personalizationLevel,
          safety_policy_version: invocation.safetyPolicyVersion,
          template_version: input.candidate.provenance.templateVersion,
        }
      : {
          generation_mode: input.candidate.generationMode,
          model: input.candidate.provenance.model,
          personalization_level: invocation.personalizationLevel,
          prompt_version: input.candidate.provenance.promptVersion,
          provider: input.candidate.provenance.provider,
          safety_policy_version: invocation.safetyPolicyVersion,
        };
  const parsed = PublishedWeeklySummarySchema.safeParse({
    aggregate_facts_ref: input.aggregateFactsRef,
    contract: "weekly-summary",
    expression: expression.data,
    expression_plan: plan.data,
    expression_version: "weekly-expression-v1",
    privacy_fallbacks: {},
    provenance,
    published_at: generatedAt,
    schema_version: "1.0.0",
    source_dependencies: dependencies.map((dependency) => ({
      purpose: dependency.purpose,
      source_ref: dependency.sourceRef,
      source_revision: dependency.sourceRevision,
    })),
    source_fingerprint: aggregate.data.source_fingerprint,
    summary_id: input.summaryId,
    summary_revision: input.summaryRevision,
    ...(input.previousSummaryId === undefined
      ? {}
      : { supersedes_summary_id: input.previousSummaryId }),
    validation: { status: "PASSED", validated_at: generatedAt },
    window_end_date: input.windowEndDate,
    window_id: input.windowId,
    window_start_date: input.windowStartDate,
  });
  if (!parsed.success) {
    throw new WeeklyPublicationError("WEEKLY_CANDIDATE_BINDING_INVALID");
  }
  return parsed.data;
}

function parseInvocation(value: GatewayInvocationV1): GatewayInvocationV1 {
  try {
    return validateGatewayInvocationV1(value);
  } catch {
    throw new WeeklyPublicationError("WEEKLY_CANDIDATE_BINDING_INVALID");
  }
}

function assertCandidateBinding(
  candidate: GatewayCandidateV1,
  invocation: GatewayInvocationV1,
): void {
  if (
    invocation.workload !== "WEEKLY_EXPRESSION_V1" ||
    candidate.workload !== invocation.workload ||
    fingerprintGatewayJson(candidate.payload) !==
      candidate.payloadFingerprint ||
    (candidate.generationMode === "CONTROLLED_TEMPLATE"
      ? candidate.provenance.templateVersion !== invocation.templateVersion
      : candidate.provenance.promptVersion !== invocation.promptVersion)
  ) {
    throw new WeeklyPublicationError("WEEKLY_CANDIDATE_BINDING_INVALID");
  }
  try {
    verifyGatewayValidationReceiptV1(candidate.validationReceipt, {
      outputSchemaVersion: invocation.outputSchemaVersion,
      payloadFingerprint: candidate.payloadFingerprint,
      planFingerprint: invocation.planFingerprint,
      promptVersion: invocation.promptVersion,
      routeRole: candidate.generationMode,
      safetyPolicyVersion: invocation.safetyPolicyVersion,
      validatorVersion: candidate.validationReceipt.validatorVersion,
      workload: invocation.workload,
    });
  } catch {
    throw new WeeklyPublicationError("WEEKLY_CANDIDATE_RECEIPT_INVALID");
  }
}

function normalizeDependencies(
  dependencies: readonly WeeklyMemoryDependencyV1[],
): readonly WeeklyMemoryDependencyV1[] {
  const seen = new Set<string>();
  for (const dependency of dependencies) {
    const key = `${dependency.sourceRef}|${dependency.purpose}`;
    if (
      seen.has(key) ||
      !Number.isSafeInteger(dependency.sourceRevision) ||
      dependency.sourceRevision < 1
    ) {
      throw new WeeklyPublicationError("WEEKLY_SOURCE_DEPENDENCY_INVALID");
    }
    seen.add(key);
  }
  return [...dependencies].sort((left, right) =>
    `${left.sourceRef}|${left.purpose}` < `${right.sourceRef}|${right.purpose}`
      ? -1
      : 1,
  );
}
