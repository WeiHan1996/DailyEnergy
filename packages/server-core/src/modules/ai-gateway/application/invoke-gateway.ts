import { randomUUID } from "node:crypto";

import {
  GatewayContractError,
  assertGatewayRouteCompatibilityV1,
  canonicalGatewayJson,
  fingerprintGatewayJson,
  fingerprintGatewayRequestV1,
  validateGatewayInvocationV1,
  validateGatewayNormalizedUsageV1,
  verifyGatewayValidationReceiptV1,
  verifyGatewayRouteManifestV1,
  type GatewayCandidateV1,
  type GatewayGatewayFailureCode,
  type GatewayInvocationV1,
  type GatewayJsonObject,
  type GatewayNormalizedUsageV1,
  type GatewayOutcomeV1,
  type GatewayProviderRole,
  type GatewayProviderRouteV1,
  type GatewayRouteManifestV1,
  type GatewayRuntimeProfile,
} from "../domain/contracts.js";
import type {
  ExpressionGatewayV1,
  GatewayAttemptCompletionV1,
  GatewayAttemptStoreV1,
  GatewayAttemptTelemetrySinkV1,
  GatewayCandidateValidationResultV1,
  GatewayCandidateValidatorV1,
  GatewayClockV1,
  GatewayIdFactoryV1,
  GatewayProviderCapabilityProfileV1,
  GatewayProviderAdapterV1,
  GatewayProviderRegistryV1,
  GatewayProviderResultV1,
} from "../spi/index.js";

const ZERO_USAGE: GatewayNormalizedUsageV1 = Object.freeze({
  billedCostMicrounits: null,
  inputUnits: null,
  outputUnits: null,
});

export interface AiGatewayV1Dependencies {
  readonly attempts: GatewayAttemptStoreV1;
  readonly attemptTelemetry?: GatewayAttemptTelemetrySinkV1;
  readonly candidateValidator: GatewayCandidateValidatorV1;
  readonly clock?: GatewayClockV1;
  readonly ids?: GatewayIdFactoryV1;
  readonly providers: GatewayProviderRegistryV1;
}

export class AiGatewayV1 implements ExpressionGatewayV1 {
  readonly #attempts: GatewayAttemptStoreV1;
  readonly #attemptTelemetry: GatewayAttemptTelemetrySinkV1;
  readonly #candidateValidator: GatewayCandidateValidatorV1;
  readonly #clock: GatewayClockV1;
  readonly #ids: GatewayIdFactoryV1;
  readonly #providers: GatewayProviderRegistryV1;

  public constructor(dependencies: AiGatewayV1Dependencies) {
    this.#attempts = dependencies.attempts;
    this.#attemptTelemetry = dependencies.attemptTelemetry ?? { record() {} };
    this.#candidateValidator = dependencies.candidateValidator;
    this.#clock = dependencies.clock ?? { now: () => new Date() };
    this.#ids = dependencies.ids ?? { nextAttemptId: () => randomUUID() };
    this.#providers = dependencies.providers;
  }

  public async invoke(input: {
    readonly admission:
      | { readonly status: "ALLOWED" }
      | {
          readonly reasonCode:
            | "BREAKER_STATE_UNAVAILABLE"
            | "BUDGET_HARD_LIMIT"
            | "COST_UNKNOWN"
            | "ROUTE_DISABLED";
          readonly status: "PROVIDER_CALLS_DISABLED";
        }
      | {
          readonly reasonCode:
            "OWNER_CANCELLED_OR_DELETED" | "SAFETY_OVERLAY_ACTIVE";
          readonly status: "ORDINARY_GATEWAY_BLOCKED";
        };
    readonly invocation: GatewayInvocationV1;
    readonly manifest: GatewayRouteManifestV1;
    readonly role: GatewayProviderRole;
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

      if (input.admission.status === "ORDINARY_GATEWAY_BLOCKED") {
        return Object.freeze({
          reasonCode: input.admission.reasonCode,
          status: "BLOCKED",
        });
      }
      if (input.admission.status === "PROVIDER_CALLS_DISABLED") {
        return fallback(input.role, input.admission.reasonCode);
      }
      if (input.signal?.aborted) {
        return Object.freeze({
          reasonCode: "OWNER_CANCELLED_OR_DELETED",
          status: "BLOCKED",
        });
      }

      const route = routeForRole(manifest, input.role);
      const remainingMs =
        Date.parse(invocation.hardDeadlineAt) - this.#clock.now().getTime();
      if (
        remainingMs <
        route.requestDeadlineMs + manifest.template.minimumReserveMs
      ) {
        return fallback(input.role, "DEADLINE_RESERVE_REQUIRED");
      }
      return this.#invokeProvider({
        invocation,
        manifest,
        role: input.role,
        route,
        runtimeProfile: input.runtimeProfile,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    } catch (error) {
      if (error instanceof GatewayContractError) {
        return terminal(error.code);
      }
      return terminal("ADAPTER_CONTRACT_INVALID");
    }
  }

  async #invokeProvider(input: {
    readonly invocation: GatewayInvocationV1;
    readonly manifest: GatewayRouteManifestV1;
    readonly role: GatewayProviderRole;
    readonly route: GatewayProviderRouteV1;
    readonly runtimeProfile: GatewayRuntimeProfile;
    readonly signal?: AbortSignal;
  }): Promise<GatewayOutcomeV1> {
    const attemptId = this.#ids.nextAttemptId();
    const complete = (
      completion: Omit<GatewayAttemptCompletionV1, "finishedAt">,
      modelRevisionBucket: "CURRENT" | "OTHER" | "UNKNOWN" = "UNKNOWN",
    ) =>
      this.#complete(completion, {
        modelRevisionBucket,
        role: input.role,
        routeManifestVersion: input.manifest.manifestVersion,
        workload: input.invocation.workload,
      });
    const requestFingerprint = fingerprintGatewayRequestV1({
      invocation: input.invocation,
      role: input.role,
      route: input.route,
    });
    const reservation = await this.#attempts.reserveAttempt({
      adapterVersion: input.route.adapterVersion,
      attemptId,
      endpointId: input.route.endpointId,
      invocationId: input.invocation.invocationId,
      modelId: input.route.immutableModelRevision ?? input.route.modelId,
      ordinal: input.role === "PRIMARY_AI" ? 1 : 2,
      providerProfileVersion: input.route.dataHandlingProfileId,
      requestFingerprint,
      routeRole: input.role,
      startedAt: this.#clock.now().toISOString(),
    });
    if (reservation.status === "EXISTING") {
      if (reservation.existingRequestFingerprint !== requestFingerprint) {
        throw new GatewayContractError("ATTEMPT_FINGERPRINT_CONFLICT");
      }
      if (
        reservation.existingOutcome === null ||
        reservation.existingOutcome === "SUCCEEDED"
      ) {
        return Object.freeze({
          reasonCode: "ATTEMPT_ALREADY_EXISTS",
          status: "RECOVER_EXISTING",
        });
      }
      return Object.freeze({
        ...fallback(
          input.role,
          reservation.existingOutcome === "OUTCOME_UNKNOWN"
            ? "OUTCOME_UNKNOWN"
            : "ATTEMPT_ALREADY_COMPLETED_WITHOUT_CANDIDATE",
        ),
        replayedAttempt: true as const,
      });
    }

    let adapter: GatewayProviderAdapterV1 | undefined;
    try {
      adapter = this.#providers.resolve(input.route);
    } catch {
      await complete({
        attemptId,
        failureCode: "PROVIDER_REGISTRY_UNAVAILABLE",
        outcome: "PROVIDER_ERROR",
        usage: ZERO_USAGE,
      });
      return fallback(input.role, "PROVIDER_REGISTRY_UNAVAILABLE");
    }
    if (!adapter) {
      await complete({
        attemptId,
        failureCode: "PROVIDER_UNAVAILABLE",
        outcome: "PROVIDER_ERROR",
        usage: ZERO_USAGE,
      });
      return fallback(input.role, "PROVIDER_UNAVAILABLE");
    }
    if (
      adapter.adapterId !== input.route.adapterId ||
      adapter.adapterVersion !== input.route.adapterVersion
    ) {
      await complete({
        attemptId,
        failureCode: "ADAPTER_CONTRACT_INVALID",
        outcome: "PROVIDER_ERROR",
        usage: ZERO_USAGE,
      });
      return fallback(input.role, "ADAPTER_CONTRACT_INVALID");
    }
    let capabilitiesValid: boolean;
    try {
      capabilitiesValid = validCapabilities(
        adapter.capabilities(),
        input.route,
        input.invocation.workload,
      );
    } catch {
      await complete({
        attemptId,
        failureCode: "ADAPTER_CAPABILITY_INVALID",
        outcome: "PROVIDER_ERROR",
        usage: ZERO_USAGE,
      });
      return fallback(input.role, "ADAPTER_CAPABILITY_INVALID");
    }
    if (!capabilitiesValid) {
      await complete({
        attemptId,
        failureCode: "ADAPTER_CAPABILITY_MISMATCH",
        outcome: "PROVIDER_ERROR",
        usage: ZERO_USAGE,
      });
      return fallback(input.role, "ADAPTER_CAPABILITY_MISMATCH");
    }

    let providerResult: GatewayProviderResultV1;
    try {
      providerResult = await adapter.invoke(
        {
          attemptId,
          outputSchemaVersion: input.invocation.outputSchemaVersion,
          preparedModelInput: input.invocation.preparedModelInput,
          promptVersion: input.invocation.promptVersion,
          requestFingerprint,
          role: input.role,
          route: input.route,
          workload: input.invocation.workload,
        },
        {
          hardDeadlineAt: input.invocation.hardDeadlineAt,
          runtimeProfile: input.runtimeProfile,
          ...(input.signal ? { signal: input.signal } : {}),
        },
      );
    } catch {
      providerResult = {
        reasonCode: "PROVIDER_NETWORK_ERROR",
        status: "FAILURE",
        usage: ZERO_USAGE,
      };
    }

    let usage: GatewayNormalizedUsageV1;
    try {
      usage = validateGatewayNormalizedUsageV1(providerResult.usage);
    } catch {
      await complete({
        attemptId,
        failureCode: "ADAPTER_USAGE_INVALID",
        outcome: "PROVIDER_ERROR",
        usage: ZERO_USAGE,
      });
      return fallback(input.role, "ADAPTER_USAGE_INVALID");
    }
    const modelRevisionBucket = observedModelBucket(
      providerResult,
      input.route,
    );
    const providerRequestRef = safeProviderRequestRef(
      providerResult.providerRequestRef,
    );
    if (input.signal?.aborted) {
      await complete(
        {
          attemptId,
          failureCode: "OWNER_CANCELLED_OR_DELETED",
          outcome: "CANCELLED",
          usage,
        },
        modelRevisionBucket,
      );
      return Object.freeze({
        reasonCode: "OWNER_CANCELLED_OR_DELETED",
        status: "BLOCKED",
      });
    }
    if (
      this.#clock.now().getTime() >= Date.parse(input.invocation.hardDeadlineAt)
    ) {
      await complete(
        {
          attemptId,
          failureCode: "LATE_RESPONSE_DISCARDED",
          outcome: "OUTCOME_UNKNOWN",
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, "OUTCOME_UNKNOWN");
    }
    if (
      (usage.billedCostMicrounits ?? 0) >
      input.manifest.invocationCostLimitMicrounits
    ) {
      await complete(
        {
          attemptId,
          failureCode: "INVOCATION_COST_LIMIT_EXCEEDED",
          outcome: "BUDGET_EXHAUSTED",
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, "INVOCATION_COST_LIMIT_EXCEEDED");
    }

    if (
      !["FAILURE", "OUTCOME_UNKNOWN", "SUCCESS"].includes(providerResult.status)
    ) {
      await complete(
        {
          attemptId,
          failureCode: "ADAPTER_RESULT_INVALID",
          outcome: "PROVIDER_ERROR",
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, "ADAPTER_RESULT_INVALID");
    }
    if (providerResult.status === "OUTCOME_UNKNOWN") {
      const failureCode = stableFailureCode(
        providerResult.reasonCode,
        "PROVIDER_PROTOCOL_INVALID",
      );
      await complete(
        {
          attemptId,
          failureCode,
          outcome: "OUTCOME_UNKNOWN",
          ...(providerRequestRef ? { providerRequestRef } : {}),
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, "OUTCOME_UNKNOWN");
    }
    if (providerResult.status === "FAILURE") {
      const failureCode = stableFailureCode(
        providerResult.reasonCode,
        "PROVIDER_PROTOCOL_INVALID",
      );
      await complete(
        {
          attemptId,
          failureCode,
          outcome:
            providerResult.reasonCode === "PROVIDER_CANCELLED"
              ? "CANCELLED"
              : "PROVIDER_ERROR",
          ...(providerRequestRef ? { providerRequestRef } : {}),
          ...(Number.isSafeInteger(providerResult.retryAfterMs) &&
          Number(providerResult.retryAfterMs) >= 0
            ? { retryAfterMs: providerResult.retryAfterMs }
            : {}),
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, failureCode);
    }

    if (
      typeof providerResult.bodyUtf8 !== "string" ||
      typeof providerResult.observedModelId !== "string" ||
      Buffer.byteLength(providerResult.bodyUtf8, "utf8") >
        input.manifest.inputLimits.providerResponseBytes ||
      providerResult.observedModelId !==
        (input.route.immutableModelRevision ?? input.route.modelId)
    ) {
      await complete(
        {
          attemptId,
          failureCode: "PROVIDER_PROTOCOL_INVALID",
          outcome: "INVALID_SCHEMA",
          ...(providerRequestRef ? { providerRequestRef } : {}),
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, "PROVIDER_PROTOCOL_INVALID");
    }

    let validation: GatewayCandidateValidationResultV1;
    try {
      validation = await this.#candidateValidator.validate({
        candidate: providerResult.bodyUtf8,
        invocation: input.invocation,
        source: input.role,
      });
    } catch {
      await complete(
        {
          attemptId,
          failureCode: "OUTPUT_VALIDATOR_UNAVAILABLE",
          outcome: "INVALID_SCHEMA",
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, "OUTPUT_VALIDATOR_UNAVAILABLE");
    }
    if (validation.status !== "PASS") {
      const failureCode = stableFailureCode(
        validation.reasonCode,
        "OUTPUT_VALIDATOR_INVALID_REASON",
      );
      await complete(
        {
          attemptId,
          failureCode,
          outcome:
            validation.status === "REJECTED" ? "UNSAFE" : "INVALID_SCHEMA",
          ...(providerRequestRef ? { providerRequestRef } : {}),
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, failureCode);
    }
    let validCandidate: Extract<
      GatewayCandidateValidationResultV1,
      { readonly status: "PASS" }
    >;
    try {
      validCandidate = validatePassedCandidate(
        validation,
        input.invocation,
        input.role,
      );
    } catch {
      await complete(
        {
          attemptId,
          failureCode: "OUTPUT_VALIDATOR_CONTRACT_INVALID",
          outcome: "INVALID_SCHEMA",
          usage,
        },
        modelRevisionBucket,
      );
      return fallback(input.role, "OUTPUT_VALIDATOR_CONTRACT_INVALID");
    }

    await complete(
      {
        attemptId,
        candidateFingerprint: validCandidate.payloadFingerprint,
        outcome: "SUCCEEDED",
        ...(providerRequestRef ? { providerRequestRef } : {}),
        usage,
      },
      modelRevisionBucket,
    );
    return candidateOutcome(
      attemptId,
      input.role,
      input.invocation,
      validCandidate,
      input.route.providerId,
      providerResult.observedModelId,
    );
  }

  async #complete(
    input: Omit<GatewayAttemptCompletionV1, "finishedAt">,
    context: {
      readonly modelRevisionBucket: "CURRENT" | "OTHER" | "UNKNOWN";
      readonly role: GatewayProviderRole;
      readonly routeManifestVersion: string;
      readonly workload: GatewayInvocationV1["workload"];
    },
  ): Promise<void> {
    await this.#attempts.completeAttempt({
      ...input,
      finishedAt: this.#clock.now().toISOString(),
    });
    try {
      this.#attemptTelemetry.record({
        costCompleteness:
          input.usage.billedCostMicrounits === null ? "UNKNOWN" : "KNOWN",
        modelRevisionBucket: context.modelRevisionBucket,
        outcomeCode: input.outcome,
        reasonCode: input.failureCode ?? "NONE",
        role: context.role,
        routeManifestVersion: context.routeManifestVersion,
        usage: input.usage,
        usageCompleteness:
          input.usage.inputUnits === null || input.usage.outputUnits === null
            ? "UNKNOWN"
            : "KNOWN",
        workload: context.workload,
      });
    } catch {
      // Telemetry must not alter the provider outcome.
    }
  }
}

function routeForRole(
  manifest: GatewayRouteManifestV1,
  role: GatewayProviderRole,
): GatewayProviderRouteV1 {
  return role === "PRIMARY_AI" ? manifest.primary : manifest.backup;
}

function candidateOutcome(
  attemptId: string,
  generationMode: GatewayProviderRole,
  invocation: GatewayInvocationV1,
  validation: Extract<
    GatewayCandidateValidationResultV1,
    { readonly status: "PASS" }
  >,
  provider: string,
  model: string,
): GatewayOutcomeV1 {
  const payload = freezeJsonObject(validation.payload);
  return Object.freeze({
    candidate: Object.freeze({
      attemptId,
      generationMode,
      payload,
      payloadFingerprint: validation.payloadFingerprint,
      provenance: Object.freeze({
        model,
        promptVersion: invocation.promptVersion,
        provider,
      }),
      validationReceipt: validation.receipt,
      workload: invocation.workload,
    }),
    status: "CANDIDATE_READY",
  });
}

function validatePassedCandidate(
  validation: Extract<
    GatewayCandidateValidationResultV1,
    { readonly status: "PASS" }
  >,
  invocation: GatewayInvocationV1,
  routeRole: GatewayProviderRole,
): Extract<GatewayCandidateValidationResultV1, { readonly status: "PASS" }> {
  if (
    !/^[a-f0-9]{64}$/u.test(validation.payloadFingerprint) ||
    fingerprintGatewayJson(validation.payload) !== validation.payloadFingerprint
  ) {
    throw new GatewayContractError("ADAPTER_CONTRACT_INVALID");
  }
  verifyGatewayValidationReceiptV1(validation.receipt, {
    outputSchemaVersion: invocation.outputSchemaVersion,
    payloadFingerprint: validation.payloadFingerprint,
    planFingerprint: invocation.planFingerprint,
    promptVersion: invocation.promptVersion,
    routeRole,
    safetyPolicyVersion: invocation.safetyPolicyVersion,
    validatorVersion: validation.receipt.validatorVersion,
    workload: invocation.workload,
  });
  return validation;
}

function stableFailureCode(value: string, fallbackCode: string): string {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(value)
    ? value
    : fallbackCode;
}

function safeProviderRequestRef(value: string | undefined): string | undefined {
  return typeof value === "string" &&
    value.length <= 160 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
    ? value
    : undefined;
}

function observedModelBucket(
  result: GatewayProviderResultV1,
  route: GatewayProviderRouteV1,
): "CURRENT" | "OTHER" | "UNKNOWN" {
  if (result.status !== "SUCCESS") {
    return "UNKNOWN";
  }
  if (typeof result.observedModelId !== "string") {
    return "UNKNOWN";
  }
  return result.observedModelId ===
    (route.immutableModelRevision ?? route.modelId)
    ? "CURRENT"
    : "OTHER";
}

function validCapabilities(
  value: GatewayProviderCapabilityProfileV1,
  route: GatewayProviderRouteV1,
  workload: GatewayInvocationV1["workload"],
): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    value.capabilityProfileId === route.capabilityProfileId &&
    Array.isArray(value.supportedWorkloads) &&
    value.supportedWorkloads.includes(workload) &&
    value.supportsCancellation === true &&
    value.toolsEnabled === false &&
    value.streamingEnabled === false
  );
}

function freezeJsonObject(value: GatewayJsonObject): GatewayJsonObject {
  const cloned = JSON.parse(canonicalGatewayJson(value)) as GatewayJsonObject;
  return deepFreeze(cloned);
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

function fallback(
  failedRole: GatewayProviderRole,
  reasonCode: string,
): GatewayOutcomeV1 {
  return Object.freeze({ failedRole, reasonCode, status: "FALLBACK_REQUIRED" });
}

function terminal(reasonCode: GatewayGatewayFailureCode): GatewayOutcomeV1 {
  return Object.freeze({ reasonCode, status: "TERMINAL_GATEWAY_FAILURE" });
}
