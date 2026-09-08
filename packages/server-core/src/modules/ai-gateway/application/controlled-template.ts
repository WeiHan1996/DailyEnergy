import { randomUUID } from "node:crypto";

import {
  GatewayContractError,
  assertGatewayRouteCompatibilityV1,
  canonicalGatewayJson,
  fingerprintGatewayJson,
  validateGatewayInvocationV1,
  verifyGatewayValidationReceiptV1,
  verifyGatewayRouteManifestV1,
  type GatewayInvocationV1,
  type GatewayJsonObject,
  type GatewayOutcomeV1,
  type GatewayRouteManifestV1,
  type GatewayRuntimeProfile,
} from "../domain/contracts.js";
import type {
  GatewayCandidateValidationResultV1,
  GatewayCandidateValidatorV1,
  GatewayClockV1,
  GatewayIdFactoryV1,
  GatewayTemplatePreflightV1,
  GatewayTemplateRendererV1,
} from "../spi/index.js";

export class ControlledTemplateGatewayV1 implements GatewayTemplatePreflightV1 {
  readonly #candidateValidator: GatewayCandidateValidatorV1;
  readonly #clock: GatewayClockV1;
  readonly #ids: GatewayIdFactoryV1;
  readonly #renderer: GatewayTemplateRendererV1;

  public constructor(input: {
    readonly candidateValidator: GatewayCandidateValidatorV1;
    readonly clock?: GatewayClockV1;
    readonly ids?: GatewayIdFactoryV1;
    readonly renderer: GatewayTemplateRendererV1;
  }) {
    this.#candidateValidator = input.candidateValidator;
    this.#clock = input.clock ?? { now: () => new Date() };
    this.#ids = input.ids ?? { nextAttemptId: () => randomUUID() };
    this.#renderer = input.renderer;
  }

  public async preflight(input: {
    readonly frozenPlan: GatewayJsonObject;
    readonly invocation: GatewayInvocationV1;
    readonly manifest: GatewayRouteManifestV1;
    readonly runtimeProfile: GatewayRuntimeProfile;
    readonly signal?: AbortSignal;
  }): Promise<GatewayOutcomeV1> {
    try {
      const invocation = validateGatewayInvocationV1(input.invocation);
      const manifest = verifyGatewayRouteManifestV1(input.manifest);
      assertGatewayRouteCompatibilityV1({
        invocation,
        manifest,
        runtimeProfile: input.runtimeProfile,
      });
      if (
        fingerprintGatewayJson(input.frozenPlan) !== invocation.planFingerprint
      ) {
        return terminal("PLAN_BINDING_INVALID");
      }
      if (input.signal?.aborted) {
        return blocked();
      }
      const startedAt = this.#clock.now().getTime();
      if (startedAt >= Date.parse(invocation.hardDeadlineAt)) {
        return terminal("TEMPLATE_PREFLIGHT_FAILED");
      }

      let rendered: GatewayJsonObject | string;
      try {
        rendered = await this.#renderer.render({
          frozenPlan: input.frozenPlan,
          invocation,
          route: manifest.template,
        });
      } catch {
        return terminal("TEMPLATE_PREFLIGHT_FAILED");
      }
      const finishedAt = this.#clock.now().getTime();
      if (
        input.signal?.aborted ||
        finishedAt >= Date.parse(invocation.hardDeadlineAt) ||
        finishedAt - startedAt > manifest.template.maxExecutionMs
      ) {
        return input.signal?.aborted
          ? blocked()
          : terminal("TEMPLATE_PREFLIGHT_FAILED");
      }

      let validation: GatewayCandidateValidationResultV1;
      try {
        validation = await this.#candidateValidator.validate({
          candidate: rendered,
          invocation,
          source: "CONTROLLED_TEMPLATE",
        });
      } catch {
        return terminal("TEMPLATE_PREFLIGHT_FAILED");
      }
      if (validation.status !== "PASS") {
        return terminal("TEMPLATE_PREFLIGHT_FAILED");
      }
      const validatedAt = this.#clock.now().getTime();
      if (
        input.signal?.aborted ||
        validatedAt >= Date.parse(invocation.hardDeadlineAt) ||
        validatedAt - startedAt > manifest.template.maxExecutionMs
      ) {
        return input.signal?.aborted
          ? blocked()
          : terminal("TEMPLATE_PREFLIGHT_FAILED");
      }
      validatePassedCandidate(validation, invocation);
      const payload = freezeJsonObject(validation.payload);
      return Object.freeze({
        candidate: Object.freeze({
          attemptId: this.#ids.nextAttemptId(),
          generationMode: "CONTROLLED_TEMPLATE" as const,
          payload,
          payloadFingerprint: validation.payloadFingerprint,
          provenance: Object.freeze({
            templateVersion: invocation.templateVersion,
          }),
          validationReceipt: validation.receipt,
          workload: invocation.workload,
        }),
        status: "CANDIDATE_READY" as const,
      });
    } catch (error) {
      return error instanceof GatewayContractError
        ? terminal(error.code)
        : terminal("TEMPLATE_PREFLIGHT_FAILED");
    }
  }
}

function validatePassedCandidate(
  validation: Extract<
    GatewayCandidateValidationResultV1,
    { readonly status: "PASS" }
  >,
  invocation: GatewayInvocationV1,
): void {
  if (
    !/^[a-f0-9]{64}$/u.test(validation.payloadFingerprint) ||
    fingerprintGatewayJson(validation.payload) !== validation.payloadFingerprint
  ) {
    throw new GatewayContractError("TEMPLATE_PREFLIGHT_FAILED");
  }
  verifyGatewayValidationReceiptV1(validation.receipt, {
    outputSchemaVersion: invocation.outputSchemaVersion,
    payloadFingerprint: validation.payloadFingerprint,
    planFingerprint: invocation.planFingerprint,
    promptVersion: invocation.promptVersion,
    routeRole: "CONTROLLED_TEMPLATE",
    safetyPolicyVersion: invocation.safetyPolicyVersion,
    validatorVersion: validation.receipt.validatorVersion,
    workload: invocation.workload,
  });
}

function freezeJsonObject(value: GatewayJsonObject): GatewayJsonObject {
  return deepFreeze(
    JSON.parse(canonicalGatewayJson(value)) as GatewayJsonObject,
  );
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

function blocked(): GatewayOutcomeV1 {
  return Object.freeze({
    reasonCode: "OWNER_CANCELLED_OR_DELETED",
    status: "BLOCKED",
  });
}

function terminal(
  reasonCode: Extract<
    GatewayOutcomeV1,
    { readonly status: "TERMINAL_GATEWAY_FAILURE" }
  >["reasonCode"],
): GatewayOutcomeV1 {
  return Object.freeze({ reasonCode, status: "TERMINAL_GATEWAY_FAILURE" });
}
