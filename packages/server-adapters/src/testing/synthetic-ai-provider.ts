import type {
  GatewayAttemptCompletionV1,
  GatewayAttemptReservationResultV1,
  GatewayAttemptReservationV1,
  GatewayAttemptStoreV1,
  GatewayProviderInvocationContextV1,
  GatewayProviderRequestV1,
  GatewayProviderResultV1,
  GatewayProviderHealthResultV1,
} from "@daily-energy/server-core/ai-gateway/spi";

import type { ProviderTransportV1 } from "../ai/gateway-provider-adapter.js";

export interface SyntheticProviderTransportV1 extends ProviderTransportV1 {
  readonly calls: readonly Readonly<{
    context: GatewayProviderInvocationContextV1;
    request: GatewayProviderRequestV1;
  }>[];
}

export function createSyntheticProviderTransportV1(
  results: readonly GatewayProviderResultV1[],
): SyntheticProviderTransportV1 {
  const queue = [...results];
  const calls: Array<{
    context: GatewayProviderInvocationContextV1;
    request: GatewayProviderRequestV1;
  }> = [];
  return Object.freeze({
    calls,
    async healthProbe(): Promise<GatewayProviderHealthResultV1> {
      return { status: "AVAILABLE" };
    },
    async invoke(
      request: GatewayProviderRequestV1,
      context: GatewayProviderInvocationContextV1,
    ) {
      calls.push({
        context: structuredCloneWithoutSignal(context),
        request: structuredClone(request),
      });
      const result = queue.shift();
      if (!result) {
        throw new Error("SYNTHETIC_PROVIDER_RESULT_MISSING");
      }
      return structuredClone(result);
    },
  });
}

export class SyntheticGatewayAttemptStoreV1 implements GatewayAttemptStoreV1 {
  readonly completions: GatewayAttemptCompletionV1[] = [];
  readonly reservations: GatewayAttemptReservationV1[] = [];
  readonly #attempts = new Map<
    string,
    {
      readonly attemptId: string;
      outcome: GatewayAttemptCompletionV1["outcome"] | null;
      readonly requestFingerprint: string;
    }
  >();

  public async reserveAttempt(
    input: GatewayAttemptReservationV1,
  ): Promise<GatewayAttemptReservationResultV1> {
    const key = `${input.invocationId}:${input.routeRole}:${input.ordinal}`;
    const existing = this.#attempts.get(key);
    if (existing) {
      return Object.freeze({
        existingOutcome: existing.outcome,
        existingRequestFingerprint: existing.requestFingerprint,
        status: "EXISTING",
      });
    }
    const reservation = structuredClone(input);
    this.reservations.push(reservation);
    this.#attempts.set(key, {
      attemptId: input.attemptId,
      outcome: null,
      requestFingerprint: input.requestFingerprint,
    });
    return Object.freeze({ status: "RESERVED" });
  }

  public async completeAttempt(
    input: GatewayAttemptCompletionV1,
  ): Promise<void> {
    const attempt = [...this.#attempts.values()].find(
      ({ attemptId }) => attemptId === input.attemptId,
    );
    if (!attempt) {
      throw new Error("SYNTHETIC_ATTEMPT_NOT_FOUND");
    }
    attempt.outcome = input.outcome;
    this.completions.push(structuredClone(input));
  }
}

function structuredCloneWithoutSignal(
  context: GatewayProviderInvocationContextV1,
): GatewayProviderInvocationContextV1 {
  return Object.freeze({
    hardDeadlineAt: context.hardDeadlineAt,
    runtimeProfile: context.runtimeProfile,
  });
}
