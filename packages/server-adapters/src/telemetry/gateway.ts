import { z } from "zod";

const GatewayControlInputSchema = z.strictObject({
  breakerReadable: z.boolean(),
  budgetState: z.enum(["OK", "TICKET", "PAGE_HIGH", "HARD_STOP", "BLOCKED"]),
  modelMatchesManifest: z.boolean(),
  priceCatalogFresh: z.boolean(),
});

export interface GatewayControlDecision {
  readonly generationMode: "PRIMARY_AI" | "CONTROLLED_TEMPLATE";
  readonly providerCallsAllowed: boolean;
  readonly reasonCode:
    | "NONE"
    | "BREAKER_STATE_UNAVAILABLE"
    | "BUDGET_HARD_LIMIT"
    | "COST_UNKNOWN"
    | "MODEL_MISMATCH"
    | "PRICE_CATALOG_STALE";
  readonly routeActive: boolean;
  readonly safetyAndDeletionContinue: true;
}

export function evaluateGatewayControl(
  input: z.input<typeof GatewayControlInputSchema>,
): GatewayControlDecision {
  const value = GatewayControlInputSchema.parse(input);
  if (!value.modelMatchesManifest) {
    return Object.freeze({
      generationMode: "CONTROLLED_TEMPLATE",
      providerCallsAllowed: false,
      reasonCode: "MODEL_MISMATCH",
      routeActive: false,
      safetyAndDeletionContinue: true,
    });
  }
  if (!value.priceCatalogFresh) {
    return Object.freeze({
      generationMode: "CONTROLLED_TEMPLATE",
      providerCallsAllowed: false,
      reasonCode: "PRICE_CATALOG_STALE",
      routeActive: true,
      safetyAndDeletionContinue: true,
    });
  }
  if (!value.breakerReadable) {
    return Object.freeze({
      generationMode: "CONTROLLED_TEMPLATE",
      providerCallsAllowed: false,
      reasonCode: "BREAKER_STATE_UNAVAILABLE",
      routeActive: true,
      safetyAndDeletionContinue: true,
    });
  }
  if (value.budgetState === "HARD_STOP") {
    return Object.freeze({
      generationMode: "CONTROLLED_TEMPLATE",
      providerCallsAllowed: false,
      reasonCode: "BUDGET_HARD_LIMIT",
      routeActive: true,
      safetyAndDeletionContinue: true,
    });
  }
  if (value.budgetState === "BLOCKED") {
    return Object.freeze({
      generationMode: "CONTROLLED_TEMPLATE",
      providerCallsAllowed: false,
      reasonCode: "COST_UNKNOWN",
      routeActive: true,
      safetyAndDeletionContinue: true,
    });
  }
  return Object.freeze({
    generationMode: "PRIMARY_AI",
    providerCallsAllowed: true,
    reasonCode: "NONE",
    routeActive: true,
    safetyAndDeletionContinue: true,
  });
}
