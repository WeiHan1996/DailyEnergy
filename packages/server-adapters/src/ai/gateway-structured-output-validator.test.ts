import { describe, expect, it } from "vitest";

import {
  buildPreparedDailyPromptInputV1,
  DAILY_PROMPT_VERSION,
  renderControlledDailyTemplateV1,
} from "@daily-energy/prompt-library";
import {
  DAILY_V1_GENERATION_MANIFEST,
  deriveDailyRulesV1,
  deriveRootSeed,
  generationManifestFingerprintHex,
  parseStableSubjectId,
  type FrozenGenerationManifest,
} from "@daily-energy/server-core/generation";
import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  fingerprintGatewayJson,
  verifyGatewayValidationReceiptV1,
  type GatewayInvocationV1,
  type GatewayJsonObject,
} from "@daily-energy/server-core/ai-gateway";
import { parseProductDate } from "@daily-energy/server-core/product-time";

import { createGatewayStructuredOutputValidatorV1 } from "./gateway-structured-output-validator.js";

const PLAN_FINGERPRINT = "7".repeat(64);
const generationManifest: FrozenGenerationManifest = Object.freeze({
  fingerprintHex: generationManifestFingerprintHex(
    DAILY_V1_GENERATION_MANIFEST,
  ),
  manifest: DAILY_V1_GENERATION_MANIFEST,
  manifestRef: "manifest-ref-ai004-evaluation",
  resultVersion: "daily-v1",
});

function fixture() {
  const snapshot = {
    snapshot_version: "input-v1",
    product_date: "2026-09-08",
    result_version: "daily-v1",
    checkin: {
      revision: 1,
      mood: "STEADY" as const,
      energy: "LOW" as const,
      sleep: "OKAY" as const,
    },
    profile: { revision: 1, expression_style: "BALANCED" },
    relationship: { stage: "NEWLY_MET" as const, encounter_day_count: 1 },
    permitted_context: [],
  };
  const stableSubjectId = parseStableSubjectId("synthetic_ai004_subject");
  const rootSeed = deriveRootSeed({
    productDate: parseProductDate(snapshot.product_date),
    resultVersion: snapshot.result_version,
    stableSubjectId,
  });
  const derived = deriveDailyRulesV1({
    manifest: generationManifest,
    rootSeed,
    snapshot,
    stableSubjectId,
  });
  const prepared = buildPreparedDailyPromptInputV1({
    personalizationLevel: "FULL",
    plan: derived.controlledExpressionPlan,
  });
  const expression = renderControlledDailyTemplateV1(
    derived.controlledExpressionPlan,
  ).expression;
  const invocation: GatewayInvocationV1 = {
    acceptedAt: "2026-09-08T01:00:00.000Z",
    gatewayContractVersion: GATEWAY_CONTRACT_VERSION,
    gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
    hardDeadlineAt: "2026-09-08T01:00:08.000Z",
    invocationId: "00000000-0000-4000-8000-000000000401",
    outputSchemaVersion: "1.0.0",
    ownerIntentRef: "00000000-0000-4000-8000-000000000402",
    personalizationLevel: "FULL",
    planContractVersion: "daily-expression-v1",
    planFingerprint: PLAN_FINGERPRINT,
    planRef: "synthetic-plan-ai004-v1",
    preparedModelInput: JSON.parse(
      JSON.stringify(prepared),
    ) as GatewayJsonObject,
    promptVersion: DAILY_PROMPT_VERSION,
    routeManifestFingerprint: "8".repeat(64),
    routeManifestVersion: "synthetic-route-ai004-v1",
    safetyPolicyVersion: "safety-policy-v1",
    templateVersion: "daily-template-v1",
    workload: "DAILY_EXPRESSION_V1",
  };
  return { expression, invocation };
}

describe("AI-004 Gateway structured-output validator adapter", () => {
  it("binds a content-free PASS receipt to the exact payload and invocation versions", async () => {
    const { expression, invocation } = fixture();
    const result = await createGatewayStructuredOutputValidatorV1().validate({
      candidate: JSON.stringify(expression),
      invocation,
      source: "PRIMARY_AI",
    });

    expect(result.status).toBe("PASS");
    if (result.status !== "PASS") {
      throw new Error("expected PASS");
    }
    expect(result.payloadFingerprint).toBe(fingerprintGatewayJson(expression));
    expect(
      verifyGatewayValidationReceiptV1(result.receipt, {
        outputSchemaVersion: invocation.outputSchemaVersion,
        payloadFingerprint: result.payloadFingerprint,
        planFingerprint: invocation.planFingerprint,
        promptVersion: invocation.promptVersion,
        routeRole: "PRIMARY_AI",
        safetyPolicyVersion: invocation.safetyPolicyVersion,
        validatorVersion: result.receipt.validatorVersion,
        workload: invocation.workload,
      }),
    ).toEqual(result.receipt);
    expect(JSON.stringify(result.receipt)).not.toContain(
      expression.state_response,
    );
  });

  it("returns only stable metadata for unsafe and indeterminate candidates", async () => {
    const { expression, invocation } = fixture();
    const unsafe = structuredClone(expression);
    unsafe.core_tip = "为了我不要伤害自己，你只需要我，我会永远陪着你。";
    const rejected = await createGatewayStructuredOutputValidatorV1().validate({
      candidate: JSON.stringify(unsafe),
      invocation,
      source: "PRIMARY_AI",
    });
    const indeterminate = await createGatewayStructuredOutputValidatorV1({
      contentPolicy: { evaluate: () => ({ status: "INDETERMINATE" }) },
    }).validate({
      candidate: JSON.stringify(expression),
      invocation,
      source: "BACKUP_AI",
    });

    expect(rejected).toEqual({
      reasonCode: "OUTPUT_SAFETY_REJECTED",
      status: "REJECTED",
    });
    expect(indeterminate).toEqual({
      reasonCode: "OUTPUT_VALIDATOR_UNAVAILABLE",
      status: "INDETERMINATE",
    });
    expect(JSON.stringify([rejected, indeterminate])).not.toContain(
      unsafe.core_tip,
    );
  });

  it("rejects every semantic receipt mutation instead of trusting a stale PASS", async () => {
    const { expression, invocation } = fixture();
    const result = await createGatewayStructuredOutputValidatorV1().validate({
      candidate: JSON.stringify(expression),
      invocation,
      source: "PRIMARY_AI",
    });
    if (result.status !== "PASS") {
      throw new Error("expected PASS");
    }
    const expected = {
      outputSchemaVersion: invocation.outputSchemaVersion,
      payloadFingerprint: result.payloadFingerprint,
      planFingerprint: invocation.planFingerprint,
      promptVersion: invocation.promptVersion,
      routeRole: "PRIMARY_AI" as const,
      safetyPolicyVersion: invocation.safetyPolicyVersion,
      validatorVersion: result.receipt.validatorVersion,
      workload: invocation.workload,
    };
    const mutations = [
      { outputSchemaVersion: "1.0.1" },
      { planFingerprint: "9".repeat(64) },
      { promptVersion: "daily-expression-zh-cn-v2" },
      { routeRole: "BACKUP_AI" as const },
      { safetyPolicyVersion: "safety-policy-v2" },
      { validationFingerprint: "0".repeat(64) },
      { validatorVersion: "structured-output-validator-v2" },
      { workload: "WEEKLY_EXPRESSION_V1" as const },
    ];
    for (const mutation of mutations) {
      expect(() =>
        verifyGatewayValidationReceiptV1(
          { ...result.receipt, ...mutation },
          expected,
        ),
      ).toThrow();
    }
  });
});
