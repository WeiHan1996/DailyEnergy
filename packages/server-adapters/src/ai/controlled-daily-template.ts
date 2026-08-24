import {
  ControlledTemplateError,
  renderControlledDailyTemplateV1,
} from "@daily-energy/prompt-library";
import type {
  ControlledExpressionPlanV1,
  ExpressionPayload,
} from "@daily-energy/shared-schemas";

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
