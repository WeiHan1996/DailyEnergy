import {
  ClientDailyContentViewSchema,
  ClientEveningFeedbackViewSchema,
  ClientWeeklySummaryViewSchema,
  DailyInteractionStateSchema,
  EveningReflectionSubmissionSchema,
  type ClientDailyContentView,
  type ClientEveningFeedbackView,
  type ClientWeeklySummaryView,
  type DailyInteractionState,
  type EveningReflectionSubmission,
} from "@daily-energy/shared-schemas/client";

import type { components, operations } from "./generated/miniapp.js";

export function mapDailyContentView(
  value: components["schemas"]["ClientDailyContentView"],
): ClientDailyContentView {
  return ClientDailyContentViewSchema.parse(value);
}

export function mapDailyInteractionView(
  value: components["schemas"]["DailyInteractionView"],
): DailyInteractionState {
  return DailyInteractionStateSchema.parse(value);
}

export function mapEveningView(
  value: components["schemas"]["EveningView"],
): ClientEveningFeedbackView {
  return ClientEveningFeedbackViewSchema.parse(value);
}

export function mapWeeklyView(
  value: components["schemas"]["WeeklyView"],
): ClientWeeklySummaryView {
  return ClientWeeklySummaryViewSchema.parse(value);
}

type EveningSaveRequest =
  operations["saveEveningCoordinated"]["requestBody"]["content"]["application/json"];

export function mapEveningSaveRequestToSubmission(
  request: EveningSaveRequest,
): EveningReflectionSubmission {
  return EveningReflectionSubmissionSchema.parse({
    contract: "evening-reflection-submission",
    schema_version: request.client_context.view_schema_version,
    submission_id: request.command_ref,
    product_date: request.product_date,
    expected_feedback_revision: request.expected_feedback_revision,
    expected_helpfulness_revision: request.expected_helpfulness_revision,
    overall_feeling: request.overall_feeling,
    helpfulness_rating: request.helpfulness_rating,
    ...(request.task_patch === undefined
      ? {}
      : {
          task_patch: {
            task_id: request.task_patch.task_ref,
            expected_revision: request.task_patch.expected_revision,
            status: request.task_patch.status,
          },
        }),
    ...(request.note_patch === undefined
      ? {}
      : { note_patch: request.note_patch }),
    client_context: {
      entry_source: request.client_context.entry_source,
      view_schema_version: request.client_context.view_schema_version,
    },
  });
}
