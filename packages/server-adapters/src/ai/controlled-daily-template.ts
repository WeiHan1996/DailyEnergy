import {
  ControlledTemplateError,
  DAILY_TEMPLATE_RENDERER_VERSION,
  DAILY_TEMPLATE_VERSION,
  renderControlledDailyTemplateV1,
} from "@daily-energy/prompt-library";
import {
  ControlledExpressionPlanV1Schema,
  type ControlledExpressionPlanV1,
  type ExpressionPayload,
} from "@daily-energy/shared-schemas";
import type { GatewayJsonObject } from "@daily-energy/server-core/ai-gateway";
import type { GatewayTemplateRendererV1 } from "@daily-energy/server-core/ai-gateway/spi";

export const CONTROLLED_DAILY_TEMPLATE_RENDERER_ID =
  "controlled-daily-template";
export const CONTROLLED_DAILY_TEMPLATE_LOCALE_CATALOG_VERSION = "zh-cn-v1";

export interface RenderedControlledDailyTemplate {
  readonly expression: ExpressionPayload;
  readonly templateVersion: string;
}

export class DailyTemplateAdapterError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "DailyTemplateAdapterError";
  }
}

export function renderControlledDailyTemplate(
  plan: ControlledExpressionPlanV1,
): RenderedControlledDailyTemplate {
  try {
    const candidate = renderControlledDailyTemplateV1(plan);
    return Object.freeze({
      expression: candidate.expression,
      templateVersion: candidate.template_version,
    });
  } catch (error) {
    if (error instanceof ControlledTemplateError) {
      throw new DailyTemplateAdapterError(error.code);
    }
    throw error;
  }
}

export function createGatewayControlledDailyTemplateRendererV1(): GatewayTemplateRendererV1 {
  return Object.freeze({
    async render(
      input: Parameters<GatewayTemplateRendererV1["render"]>[0],
    ): Promise<GatewayJsonObject> {
      if (
        input.invocation.workload !== "DAILY_EXPRESSION_V1" ||
        input.invocation.templateVersion !== DAILY_TEMPLATE_VERSION ||
        input.route.rendererId !== CONTROLLED_DAILY_TEMPLATE_RENDERER_ID ||
        input.route.rendererVersion !== DAILY_TEMPLATE_RENDERER_VERSION ||
        input.route.templateCompatibilityVersion !== DAILY_TEMPLATE_VERSION ||
        input.route.localeCatalogVersion !==
          CONTROLLED_DAILY_TEMPLATE_LOCALE_CATALOG_VERSION
      ) {
        throw new DailyTemplateAdapterError("TEMPLATE_ROUTE_MISMATCH");
      }
      const parsedPlan = ControlledExpressionPlanV1Schema.safeParse(
        input.frozenPlan,
      );
      if (!parsedPlan.success) {
        throw new DailyTemplateAdapterError("TEMPLATE_PLAN_INVALID");
      }
      const candidate = renderControlledDailyTemplate(parsedPlan.data);
      if (candidate.templateVersion !== input.invocation.templateVersion) {
        throw new DailyTemplateAdapterError("TEMPLATE_VERSION_MISMATCH");
      }
      return candidate.expression as unknown as GatewayJsonObject;
    },
  });
}
