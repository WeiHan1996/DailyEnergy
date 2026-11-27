import {
  ControlledTemplateGatewayV1,
  GatewayRouteOrchestratorV1,
} from "@daily-energy/server-core/ai-gateway";
import type {
  ExpressionGatewayV1,
  GatewayBreakerStateStoreV1,
} from "@daily-energy/server-core/ai-gateway/spi";

import { createGatewayControlledWeeklyTemplateRendererV1 } from "../ai/controlled-weekly-template.js";
import { createGatewayStructuredOutputValidatorV1 } from "../ai/gateway-structured-output-validator.js";

/** In-memory breaker for tests; exposed only through the /testing entry. */
export function createMemoryBreakerStore(): GatewayBreakerStateStoreV1 {
  const values = new Map<string, unknown>();
  return {
    async compareAndSet(input) {
      const current = values.get(input.key) as
        { revision: number; routeFingerprint: string } | undefined;
      if (
        (current?.revision ?? null) !== input.expectedRevision ||
        (current?.routeFingerprint ?? null) !== input.expectedRouteFingerprint
      ) {
        return false;
      }
      values.set(input.key, input.next);
      return true;
    },
    async load(key) {
      return (values.get(key) ?? null) as Awaited<
        ReturnType<GatewayBreakerStateStoreV1["load"]>
      >;
    },
  };
}

export function createWeeklyTemplateService(): ControlledTemplateGatewayV1 {
  return new ControlledTemplateGatewayV1({
    candidateValidator: createGatewayStructuredOutputValidatorV1(),
    clock: { now: () => new Date("2026-08-25T01:00:00.100Z") },
    ids: { nextAttemptId: () => "00000000-0000-4000-8000-000000000b13" },
    renderer: createGatewayControlledWeeklyTemplateRendererV1(),
  });
}

export function createWeeklyOrchestrator(
  providerGateway: ExpressionGatewayV1,
  events: unknown[],
): GatewayRouteOrchestratorV1 {
  return new GatewayRouteOrchestratorV1({
    breaker: createMemoryBreakerStore(),
    clock: { now: () => new Date("2026-08-25T01:00:00.100Z") },
    gateway: providerGateway,
    guard: {
      async read() {
        return { status: "ALLOWED" };
      },
    },
    telemetry: {
      record(event) {
        events.push(event);
      },
    },
    template: createWeeklyTemplateService(),
  });
}
