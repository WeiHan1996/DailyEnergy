import {
  GatewayContractError,
  assertGatewayRouteCompatibilityV1,
  fingerprintGatewayJson,
  validateGatewayInvocationV1,
  verifyGatewayRouteManifestV1,
} from "../domain/contracts.js";
import {
  decideGatewayBreakerClaimV1,
  recordGatewayBreakerOutcomeV1,
  type GatewayBreakerOutcomeClass,
  type GatewayBreakerSnapshotV1,
} from "../domain/breaker.js";
import type {
  GatewayAdmissionV1,
  GatewayCandidateV1,
  GatewayInvocationV1,
  GatewayJsonObject,
  GatewayOutcomeV1,
  GatewayProviderRole,
  GatewayProviderRouteV1,
  GatewayRouteManifestV1,
  GatewayRouteRole,
  GatewayRuntimeProfile,
} from "../domain/contracts.js";
import type {
  ExpressionGatewayV1,
  GatewayBreakerStateStoreV1,
  GatewayClockV1,
  GatewayLiveGuardV1,
  GatewayRoutingTelemetrySinkV1,
  GatewayTemplatePreflightV1,
} from "../spi/index.js";

export type RoutedGatewayOutcomeV1 =
  | {
      readonly candidate: GatewayCandidateV1;
      readonly status: "CANDIDATE_READY";
    }
  | { readonly reasonCode: string; readonly status: "BLOCKED" }
  | {
      readonly reasonCode: string;
      readonly status: "TERMINAL_GATEWAY_FAILURE";
    };

export class GatewayRouteOrchestratorV1 {
  readonly #breaker: GatewayBreakerStateStoreV1;
  readonly #clock: GatewayClockV1;
  readonly #gateway: ExpressionGatewayV1;
  readonly #guard: GatewayLiveGuardV1;
  readonly #template: GatewayTemplatePreflightV1;
  readonly #telemetry: GatewayRoutingTelemetrySinkV1;

  public constructor(input: {
    readonly breaker: GatewayBreakerStateStoreV1;
    readonly clock?: GatewayClockV1;
    readonly gateway: ExpressionGatewayV1;
    readonly guard: GatewayLiveGuardV1;
    readonly template: GatewayTemplatePreflightV1;
    readonly telemetry: GatewayRoutingTelemetrySinkV1;
  }) {
    this.#breaker = input.breaker;
    this.#clock = input.clock ?? { now: () => new Date() };
    this.#gateway = input.gateway;
    this.#guard = input.guard;
    this.#template = input.template;
    this.#telemetry = input.telemetry;
  }

  public async invoke(input: {
    readonly admission: GatewayAdmissionV1;
    readonly frozenPlan: GatewayJsonObject;
    readonly invocation: GatewayInvocationV1;
    readonly manifest: GatewayRouteManifestV1;
    readonly runtimeProfile: GatewayRuntimeProfile;
    readonly signal?: AbortSignal;
  }): Promise<RoutedGatewayOutcomeV1> {
    if (input.admission.status === "ORDINARY_GATEWAY_BLOCKED") {
      return this.#blocked(input, input.admission.reasonCode);
    }
    if (input.signal?.aborted) {
      return this.#blocked(input, "OWNER_CANCELLED_OR_DELETED");
    }
    let invocation: GatewayInvocationV1;
    let manifest: GatewayRouteManifestV1;
    try {
      invocation = validateGatewayInvocationV1(input.invocation);
      manifest = verifyGatewayRouteManifestV1(input.manifest);
      assertGatewayRouteCompatibilityV1({
        invocation,
        manifest,
        runtimeProfile: input.runtimeProfile,
      });
    } catch (error) {
      const reasonCode =
        error instanceof GatewayContractError
          ? error.code
          : "ADAPTER_CONTRACT_INVALID";
      this.#recordTelemetry(input, "BLOCKED", reasonCode);
      return { reasonCode, status: "TERMINAL_GATEWAY_FAILURE" };
    }
    const routedInput = { ...input, invocation, manifest };
    const preflightGuard = await this.#readGuard();
    if (preflightGuard.status === "UNAVAILABLE") {
      return this.#blocked(routedInput, "LIVE_GUARD_UNAVAILABLE");
    }
    if (preflightGuard.status === "BLOCKED") {
      return this.#blocked(routedInput, preflightGuard.reasonCode);
    }
    let template: GatewayOutcomeV1;
    try {
      template = await this.#template.preflight({
        frozenPlan: input.frozenPlan,
        invocation,
        manifest,
        runtimeProfile: input.runtimeProfile,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    } catch {
      return this.#terminal(routedInput, "TEMPLATE_PREFLIGHT_FAILED");
    }
    if (template.status === "BLOCKED") {
      return this.#blocked(routedInput, template.reasonCode);
    }
    if (
      template.status !== "CANDIDATE_READY" ||
      template.candidate.generationMode !== "CONTROLLED_TEMPLATE" ||
      template.candidate.workload !== invocation.workload ||
      template.candidate.provenance.templateVersion !==
        invocation.templateVersion ||
      template.candidate.validationReceipt.routeRole !== "CONTROLLED_TEMPLATE"
    ) {
      return this.#terminal(
        routedInput,
        template.status === "TERMINAL_GATEWAY_FAILURE"
          ? template.reasonCode
          : "TEMPLATE_PREFLIGHT_FAILED",
      );
    }
    if (input.admission.status === "PROVIDER_CALLS_DISABLED") {
      return this.#templateCandidate(
        routedInput,
        template.candidate,
        input.admission.reasonCode,
      );
    }
    for (const role of ["PRIMARY_AI", "BACKUP_AI"] as const) {
      const guard = await this.#readGuard();
      if (guard.status === "UNAVAILABLE") {
        return this.#blocked(routedInput, "LIVE_GUARD_UNAVAILABLE");
      }
      if (guard.status === "BLOCKED") {
        return this.#blocked(routedInput, guard.reasonCode);
      }
      const route = role === "PRIMARY_AI" ? manifest.primary : manifest.backup;
      const breaker = await this.#claimBreaker(route, invocation.workload);
      if (breaker.status === "UNAVAILABLE") {
        return this.#templateCandidate(
          routedInput,
          template.candidate,
          "BREAKER_STATE_UNAVAILABLE",
        );
      }
      if (breaker.status === "OPEN") {
        this.#recordTelemetry(routedInput, "FALLBACK", "CIRCUIT_OPEN", role);
        continue;
      }
      let result: GatewayOutcomeV1;
      try {
        result = await this.#gateway.invoke({
          admission: routedInput.admission,
          invocation,
          manifest,
          role,
          runtimeProfile: routedInput.runtimeProfile,
          ...(routedInput.signal ? { signal: routedInput.signal } : {}),
        });
      } catch {
        await this.#recordBreaker(breaker.key, breaker.snapshot, "NEUTRAL");
        return this.#templateCandidate(
          routedInput,
          template.candidate,
          "GATEWAY_EXECUTION_UNAVAILABLE",
        );
      }
      await this.#recordBreaker(
        breaker.key,
        breaker.snapshot,
        classifyBreakerOutcome(result),
      );
      if (result.status === "CANDIDATE_READY") {
        const publishGuard = await this.#readGuard();
        if (publishGuard.status === "UNAVAILABLE") {
          return this.#blocked(routedInput, "LIVE_GUARD_UNAVAILABLE");
        }
        if (publishGuard.status === "BLOCKED") {
          return this.#blocked(routedInput, publishGuard.reasonCode);
        }
        this.#recordTelemetry(routedInput, "CANDIDATE", "NONE", role);
        return { candidate: result.candidate, status: "CANDIDATE_READY" };
      }
      if (result.status === "BLOCKED") {
        return this.#blocked(routedInput, result.reasonCode);
      }
      if (result.status === "RECOVER_EXISTING") {
        return this.#blocked(routedInput, "RESULT_ALREADY_AVAILABLE");
      }
      if (result.status === "TERMINAL_GATEWAY_FAILURE") {
        this.#recordTelemetry(routedInput, "BLOCKED", result.reasonCode);
        return { reasonCode: result.reasonCode, status: result.status };
      }
      this.#recordTelemetry(routedInput, "FALLBACK", result.reasonCode, role);
    }
    return this.#templateCandidate(
      routedInput,
      template.candidate,
      "PROVIDER_PATHS_EXHAUSTED",
    );
  }

  async #claimBreaker(
    route: GatewayProviderRouteV1,
    workload: GatewayInvocationV1["workload"],
  ): Promise<
    | { readonly status: "OPEN" }
    | { readonly status: "UNAVAILABLE" }
    | {
        readonly key: string;
        readonly snapshot: GatewayBreakerSnapshotV1;
        readonly status: "ALLOWED";
      }
  > {
    const routeFingerprint = fingerprintGatewayJson(route);
    const key = fingerprintGatewayJson({
      endpoint: route.endpointId,
      model: route.immutableModelRevision ?? route.modelId,
      provider: route.providerId,
      provider_account: route.providerAccountRef,
      workload,
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const current = await this.#breaker.load(key);
        const decision = decideGatewayBreakerClaimV1({
          nowMs: this.#clock.now().getTime(),
          routeFingerprint,
          snapshot: current,
        });
        if (!decision.allowed) {
          return { status: "OPEN" };
        }
        if (current && decision.next.revision === current.revision) {
          return { key, snapshot: decision.next, status: "ALLOWED" };
        }
        if (
          await this.#breaker.compareAndSet({
            expectedRevision: current?.revision ?? null,
            expectedRouteFingerprint: current?.routeFingerprint ?? null,
            key,
            next: decision.next,
            ttlMs: 24 * 60 * 60_000,
          })
        ) {
          return { key, snapshot: decision.next, status: "ALLOWED" };
        }
      } catch {
        return { status: "UNAVAILABLE" };
      }
    }
    return { status: "UNAVAILABLE" };
  }

  async #recordBreaker(
    key: string,
    claimed: GatewayBreakerSnapshotV1,
    outcome: GatewayBreakerOutcomeClass,
  ): Promise<void> {
    let expected = claimed;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = recordGatewayBreakerOutcomeV1({
        nowMs: this.#clock.now().getTime(),
        outcome,
        snapshot: expected,
      });
      if (next.revision === expected.revision) {
        return;
      }
      try {
        if (
          await this.#breaker.compareAndSet({
            expectedRevision: expected.revision,
            expectedRouteFingerprint: expected.routeFingerprint,
            key,
            next,
            ttlMs: 24 * 60 * 60_000,
          })
        ) {
          return;
        }
        const latest = await this.#breaker.load(key);
        if (
          latest === null ||
          latest.routeFingerprint !== claimed.routeFingerprint
        ) {
          return;
        }
        expected = latest;
      } catch {
        return;
      }
    }
  }

  async #readGuard(): Promise<
    | { readonly status: "ALLOWED" }
    | {
        readonly reasonCode:
          | "OWNER_CANCELLED_OR_DELETED"
          | "RESULT_ALREADY_AVAILABLE"
          | "SAFETY_OVERLAY_ACTIVE"
          | "STALE_PUBLISH_GUARD";
        readonly status: "BLOCKED";
      }
    | { readonly status: "UNAVAILABLE" }
  > {
    try {
      const guard = await this.#guard.read();
      if (guard.status === "ALLOWED") {
        return { status: "ALLOWED" };
      }
      if (
        guard.status === "BLOCKED" &&
        [
          "OWNER_CANCELLED_OR_DELETED",
          "RESULT_ALREADY_AVAILABLE",
          "SAFETY_OVERLAY_ACTIVE",
          "STALE_PUBLISH_GUARD",
        ].includes(guard.reasonCode)
      ) {
        return guard;
      }
      return { status: "UNAVAILABLE" };
    } catch {
      return { status: "UNAVAILABLE" };
    }
  }

  async #templateCandidate(
    input: {
      invocation: GatewayInvocationV1;
      manifest: GatewayRouteManifestV1;
    },
    candidate: Extract<
      GatewayCandidateV1,
      { readonly generationMode: "CONTROLLED_TEMPLATE" }
    >,
    reasonCode: string,
  ): Promise<RoutedGatewayOutcomeV1> {
    const guard = await this.#readGuard();
    if (guard.status === "UNAVAILABLE") {
      return this.#blocked(input, "LIVE_GUARD_UNAVAILABLE");
    }
    if (guard.status === "BLOCKED") {
      return this.#blocked(input, guard.reasonCode);
    }
    if (
      this.#clock.now().getTime() >= Date.parse(input.invocation.hardDeadlineAt)
    ) {
      return this.#terminal(input, "GATEWAY_DEADLINE_EXCEEDED");
    }
    this.#recordTelemetry(
      input,
      "CANDIDATE",
      reasonCode,
      "CONTROLLED_TEMPLATE",
    );
    return { candidate, status: "CANDIDATE_READY" };
  }

  #terminal(
    input: {
      invocation: GatewayInvocationV1;
      manifest: GatewayRouteManifestV1;
    },
    reasonCode: string,
  ): RoutedGatewayOutcomeV1 {
    this.#recordTelemetry(input, "BLOCKED", reasonCode);
    return { reasonCode, status: "TERMINAL_GATEWAY_FAILURE" };
  }

  #blocked(
    input: {
      invocation: GatewayInvocationV1;
      manifest: GatewayRouteManifestV1;
    },
    reasonCode: string,
  ) {
    this.#recordTelemetry(input, "BLOCKED", reasonCode);
    return { reasonCode, status: "BLOCKED" } as const;
  }

  #recordTelemetry(
    input: {
      invocation: GatewayInvocationV1;
      manifest: GatewayRouteManifestV1;
    },
    outcomeCode: "BLOCKED" | "CANDIDATE" | "FALLBACK",
    reasonCode: string,
    role?: GatewayRouteRole,
  ): void {
    try {
      this.#telemetry.record({
        outcomeCode,
        reasonCode,
        ...(role ? { role } : {}),
        routeManifestVersion: input.manifest.manifestVersion,
        workload: input.invocation.workload,
      });
    } catch {
      // Telemetry must not alter routing or Safety behavior.
    }
  }
}

function classifyBreakerOutcome(
  result: GatewayOutcomeV1,
): GatewayBreakerOutcomeClass {
  if (result.status === "CANDIDATE_READY") {
    return "SUCCESS";
  }
  if (result.status !== "FALLBACK_REQUIRED") {
    return "NEUTRAL";
  }
  if (result.replayedAttempt === true) {
    return "NEUTRAL";
  }
  if (result.reasonCode === "PROVIDER_AUTH_INVALID") {
    return "AUTH_OR_CONFIG_FAILURE";
  }
  if (
    [
      "OUTPUT_BODY_TOO_LARGE",
      "OUTPUT_FACT_BINDING_INVALID",
      "OUTPUT_NOT_SINGLE_JSON_OBJECT",
      "OUTPUT_PERSONALITY_INVALID",
      "OUTPUT_PRIVACY_DEPENDENCY_INVALID",
      "OUTPUT_PROJECTION_INVALID",
      "OUTPUT_SAFETY_REJECTED",
      "OUTPUT_SCHEMA_INVALID",
      "OUTPUT_TEXT_FORMAT_INVALID",
      "OUTPUT_UNAPPROVED_FACT_REF",
    ].includes(result.reasonCode)
  ) {
    return "QUALITY_FAILURE";
  }
  if (
    [
      "OUTCOME_UNKNOWN",
      "PROVIDER_CONNECT_TIMEOUT",
      "PROVIDER_NETWORK_ERROR",
      "PROVIDER_PROTOCOL_INVALID",
      "PROVIDER_RATE_LIMITED",
      "PROVIDER_RESPONSE_TIMEOUT",
      "PROVIDER_UNAVAILABLE",
    ].includes(result.reasonCode)
  ) {
    return "INFRASTRUCTURE_FAILURE";
  }
  return "NEUTRAL";
}
