import * as z from "zod";

import {
  ClientDailyContentViewSchema,
  DailyInteractionStateSchema,
  ExpressionPayloadSchema,
  GenerationInputSnapshotSchema,
  PublishedDailyResultSchema,
  RuleFactsSchema,
} from "./daily-content.js";
import {
  ClientEveningFeedbackViewSchema,
  DailyHelpfulnessRecordSchema,
  DailyTaskStateSchema,
  EveningFeedbackDraftSchema,
  EveningFeedbackRecordSchema,
  EveningFeedbackRevisionSchema,
  EveningReflectionSubmissionSchema,
} from "./evening-feedback.js";
import {
  ClientWeeklySummaryViewSchema,
  PublishedWeeklySummarySchema,
  WeeklyAggregateFactsSchema,
  WeeklyExpressionPayloadSchema,
  WeeklyExpressionPlanSchema,
  WeeklySourceSnapshotSchema,
} from "./weekly-summary.js";

export const JSON_SCHEMA_IDS = {
  generationInputSnapshot:
    "urn:dailyenergy:schema:generation-input-snapshot:1.0.0",
  ruleFacts: "urn:dailyenergy:schema:rule-facts:1.0.0",
  expressionPayload: "urn:dailyenergy:schema:expression-payload:1.0.0",
  publishedDailyResult: "urn:dailyenergy:schema:published-daily-result:1.0.0",
  clientDailyContentView:
    "urn:dailyenergy:schema:client-daily-content-view:1.0.0",
  dailyInteractionState: "urn:dailyenergy:schema:daily-interaction-state:1.0.0",
  eveningFeedbackDraft: "urn:dailyenergy:schema:evening-feedback-draft:1.0.0",
  eveningReflectionSubmission:
    "urn:dailyenergy:schema:evening-reflection-submission:1.0.0",
  eveningFeedbackRecord: "urn:dailyenergy:schema:evening-feedback-record:1.0.0",
  eveningFeedbackRevision:
    "urn:dailyenergy:schema:evening-feedback-revision:1.0.0",
  dailyHelpfulnessRecord:
    "urn:dailyenergy:schema:daily-helpfulness-record:1.0.0",
  dailyTaskState: "urn:dailyenergy:schema:daily-task-state:1.0.0",
  clientEveningFeedbackView:
    "urn:dailyenergy:schema:client-evening-feedback-view:1.0.0",
  weeklySourceSnapshot: "urn:dailyenergy:schema:weekly-source-snapshot:1.0.0",
  weeklyAggregateFacts: "urn:dailyenergy:schema:weekly-aggregate-facts:1.0.0",
  weeklyExpressionPlan: "urn:dailyenergy:schema:weekly-expression-plan:1.0.0",
  weeklyExpressionPayload:
    "urn:dailyenergy:schema:weekly-expression-payload:1.0.0",
  publishedWeeklySummary:
    "urn:dailyenergy:schema:published-weekly-summary:1.0.0",
  clientWeeklySummaryView:
    "urn:dailyenergy:schema:client-weekly-summary-view:1.0.0",
} as const;

function exportJsonSchema(
  schema: z.ZodType,
  id: string,
): Record<string, unknown> {
  return {
    ...z.toJSONSchema(schema, {
      target: "draft-2020-12",
      unrepresentable: "any",
      io: "input",
    }),
    $id: id,
  };
}

export const jsonSchemas = {
  generationInputSnapshot: exportJsonSchema(
    GenerationInputSnapshotSchema,
    JSON_SCHEMA_IDS.generationInputSnapshot,
  ),
  ruleFacts: exportJsonSchema(RuleFactsSchema, JSON_SCHEMA_IDS.ruleFacts),
  expressionPayload: exportJsonSchema(
    ExpressionPayloadSchema,
    JSON_SCHEMA_IDS.expressionPayload,
  ),
  publishedDailyResult: exportJsonSchema(
    PublishedDailyResultSchema,
    JSON_SCHEMA_IDS.publishedDailyResult,
  ),
  clientDailyContentView: exportJsonSchema(
    ClientDailyContentViewSchema,
    JSON_SCHEMA_IDS.clientDailyContentView,
  ),
  dailyInteractionState: exportJsonSchema(
    DailyInteractionStateSchema,
    JSON_SCHEMA_IDS.dailyInteractionState,
  ),
  eveningFeedbackDraft: exportJsonSchema(
    EveningFeedbackDraftSchema,
    JSON_SCHEMA_IDS.eveningFeedbackDraft,
  ),
  eveningReflectionSubmission: exportJsonSchema(
    EveningReflectionSubmissionSchema,
    JSON_SCHEMA_IDS.eveningReflectionSubmission,
  ),
  eveningFeedbackRecord: exportJsonSchema(
    EveningFeedbackRecordSchema,
    JSON_SCHEMA_IDS.eveningFeedbackRecord,
  ),
  eveningFeedbackRevision: exportJsonSchema(
    EveningFeedbackRevisionSchema,
    JSON_SCHEMA_IDS.eveningFeedbackRevision,
  ),
  dailyHelpfulnessRecord: exportJsonSchema(
    DailyHelpfulnessRecordSchema,
    JSON_SCHEMA_IDS.dailyHelpfulnessRecord,
  ),
  dailyTaskState: exportJsonSchema(
    DailyTaskStateSchema,
    JSON_SCHEMA_IDS.dailyTaskState,
  ),
  clientEveningFeedbackView: exportJsonSchema(
    ClientEveningFeedbackViewSchema,
    JSON_SCHEMA_IDS.clientEveningFeedbackView,
  ),
  weeklySourceSnapshot: exportJsonSchema(
    WeeklySourceSnapshotSchema,
    JSON_SCHEMA_IDS.weeklySourceSnapshot,
  ),
  weeklyAggregateFacts: exportJsonSchema(
    WeeklyAggregateFactsSchema,
    JSON_SCHEMA_IDS.weeklyAggregateFacts,
  ),
  weeklyExpressionPlan: exportJsonSchema(
    WeeklyExpressionPlanSchema,
    JSON_SCHEMA_IDS.weeklyExpressionPlan,
  ),
  weeklyExpressionPayload: exportJsonSchema(
    WeeklyExpressionPayloadSchema,
    JSON_SCHEMA_IDS.weeklyExpressionPayload,
  ),
  publishedWeeklySummary: exportJsonSchema(
    PublishedWeeklySummarySchema,
    JSON_SCHEMA_IDS.publishedWeeklySummary,
  ),
  clientWeeklySummaryView: exportJsonSchema(
    ClientWeeklySummaryViewSchema,
    JSON_SCHEMA_IDS.clientWeeklySummaryView,
  ),
} as const;

export type JsonSchemaName = keyof typeof jsonSchemas;
