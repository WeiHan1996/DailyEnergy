import {
  STRUCTURED_OUTPUT_VALIDATOR_VERSION,
  createStructuredOutputCandidateValidatorV1,
  type CandidateContentPolicyV1,
} from "@daily-energy/prompt-library";
import {
  createGatewayValidationReceiptV1,
  fingerprintGatewayJson,
  type GatewayJsonObject,
} from "@daily-energy/server-core/ai-gateway";
import type {
  GatewayCandidateValidationResultV1,
  GatewayCandidateValidatorV1,
} from "@daily-energy/server-core/ai-gateway/spi";

export function createGatewayStructuredOutputValidatorV1(input?: {
  readonly contentPolicy?: CandidateContentPolicyV1;
}): GatewayCandidateValidatorV1 {
  const validator = createStructuredOutputCandidateValidatorV1(input);
  return Object.freeze({
    async validate(
      request: Parameters<GatewayCandidateValidatorV1["validate"]>[0],
    ): Promise<GatewayCandidateValidationResultV1> {
      const result = await validator.validate({
        candidate: request.candidate,
        invocation: {
          outputSchemaVersion: request.invocation.outputSchemaVersion,
          planContractVersion: request.invocation.planContractVersion,
          planFingerprint: request.invocation.planFingerprint,
          preparedModelInput: request.invocation.preparedModelInput,
          promptVersion: request.invocation.promptVersion,
          safetyPolicyVersion: request.invocation.safetyPolicyVersion,
          workload: request.invocation.workload,
        },
        source: request.source,
      });
      if (result.status !== "PASS") {
        return result;
      }
      try {
        const payload = result.payload as GatewayJsonObject;
        const payloadFingerprint = fingerprintGatewayJson(payload);
        if (payloadFingerprint !== result.payloadFingerprint) {
          return indeterminate();
        }
        return Object.freeze({
          payload,
          payloadFingerprint,
          receipt: createGatewayValidationReceiptV1({
            outputSchemaVersion: request.invocation.outputSchemaVersion,
            payloadFingerprint,
            planFingerprint: request.invocation.planFingerprint,
            promptVersion: request.invocation.promptVersion,
            routeRole: request.source,
            safetyPolicyVersion: request.invocation.safetyPolicyVersion,
            validatorVersion: STRUCTURED_OUTPUT_VALIDATOR_VERSION,
            workload: request.invocation.workload,
          }),
          status: "PASS" as const,
        });
      } catch {
        return indeterminate();
      }
    },
  });
}

function indeterminate(): Extract<
  GatewayCandidateValidationResultV1,
  { readonly status: "INDETERMINATE" }
> {
  return Object.freeze({
    reasonCode: "OUTPUT_VALIDATOR_UNAVAILABLE" as const,
    status: "INDETERMINATE" as const,
  });
}
