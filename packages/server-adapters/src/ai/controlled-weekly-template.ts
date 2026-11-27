import {
  WEEKLY_PROMPT_VERSION,
  WEEKLY_TEMPLATE_RENDERER_VERSION,
  WEEKLY_TEMPLATE_VERSION,
} from "@daily-energy/prompt-library";
import type { GatewayJsonObject } from "@daily-energy/server-core/ai-gateway";
import type { GatewayTemplateRendererV1 } from "@daily-energy/server-core/ai-gateway/spi";
import {
  WeeklyTemplateV2Error,
  renderControlledWeeklyExpressionV2,
} from "@daily-energy/server-core/weekly-reflection";
import {
  WeeklyAggregateFactsSchema,
  WeeklyExpressionPlanSchema,
  type WeeklyAggregateFacts,
  type WeeklyExpressionPayload,
  type WeeklyExpressionPlan,
} from "@daily-energy/shared-schemas";

export const CONTROLLED_WEEKLY_TEMPLATE_RENDERER_ID =
  "controlled-weekly-template";
export const CONTROLLED_WEEKLY_TEMPLATE_LOCALE_CATALOG_VERSION = "zh-cn-v1";

/**
 * The Gateway freezes one JSON object per invocation. For Weekly it carries the
 * deterministic aggregate and the expression plan derived from it, so that the
 * template fallback renders from exactly the facts the prompt was built from.
 */
export interface WeeklyFrozenPlanV1 {
  readonly aggregate: WeeklyAggregateFacts;
  readonly plan: WeeklyExpressionPlan;
}

export class WeeklyTemplateAdapterError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "WeeklyTemplateAdapterError";
  }
}

export function weeklyFrozenPlanToGatewayJson(
  frozen: WeeklyFrozenPlanV1,
): GatewayJsonObject {
  return JSON.parse(
    JSON.stringify({ aggregate: frozen.aggregate, plan: frozen.plan }),
  ) as GatewayJsonObject;
}

export function parseWeeklyFrozenPlanV1(value: unknown): WeeklyFrozenPlanV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "aggregate,plan"
  ) {
    throw new WeeklyTemplateAdapterError("TEMPLATE_PLAN_INVALID");
  }
  const record = value as Record<string, unknown>;
  const aggregate = WeeklyAggregateFactsSchema.safeParse(record.aggregate);
  const plan = WeeklyExpressionPlanSchema.safeParse(record.plan);
  if (!aggregate.success || !plan.success) {
    throw new WeeklyTemplateAdapterError("TEMPLATE_PLAN_INVALID");
  }
  return Object.freeze({ aggregate: aggregate.data, plan: plan.data });
}

export function renderControlledWeeklyTemplate(
  frozen: WeeklyFrozenPlanV1,
): WeeklyExpressionPayload {
  try {
    return renderControlledWeeklyExpressionV2(frozen.aggregate, frozen.plan);
  } catch (error) {
    if (error instanceof WeeklyTemplateV2Error) {
      throw new WeeklyTemplateAdapterError(error.code);
    }
    throw error;
  }
}

export function createGatewayControlledWeeklyTemplateRendererV1(): GatewayTemplateRendererV1 {
  return Object.freeze({
    async render(
      input: Parameters<GatewayTemplateRendererV1["render"]>[0],
    ): Promise<GatewayJsonObject> {
      if (
        input.invocation.workload !== "WEEKLY_EXPRESSION_V1" ||
        input.invocation.promptVersion !== WEEKLY_PROMPT_VERSION ||
        input.invocation.templateVersion !== WEEKLY_TEMPLATE_VERSION ||
        input.route.rendererId !== CONTROLLED_WEEKLY_TEMPLATE_RENDERER_ID ||
        input.route.rendererVersion !== WEEKLY_TEMPLATE_RENDERER_VERSION ||
        input.route.templateCompatibilityVersion !== WEEKLY_TEMPLATE_VERSION ||
        input.route.localeCatalogVersion !==
          CONTROLLED_WEEKLY_TEMPLATE_LOCALE_CATALOG_VERSION
      ) {
        throw new WeeklyTemplateAdapterError("TEMPLATE_ROUTE_MISMATCH");
      }
      const frozen = parseWeeklyFrozenPlanV1(input.frozenPlan);
      return renderControlledWeeklyTemplate(
        frozen,
      ) as unknown as GatewayJsonObject;
    },
  });
}
