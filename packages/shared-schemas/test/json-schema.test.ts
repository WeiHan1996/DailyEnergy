import { describe, expect, it } from "vitest";

import * as publicApi from "../src/index.js";
import { JSON_SCHEMA_IDS, jsonSchemas } from "../src/json-schema.js";

describe("public and JSON Schema exports", () => {
  it("exports every root runtime schema from the public entrypoint", () => {
    for (const name of [
      "GenerationInputSnapshotSchema",
      "RuleFactsSchema",
      "ExpressionPayloadSchema",
      "PublishedDailyResultSchema",
      "ClientDailyContentViewSchema",
      "DailyInteractionStateSchema",
      "EveningReflectionSubmissionSchema",
      "EveningFeedbackRecordSchema",
      "ClientEveningFeedbackViewSchema",
      "WeeklySourceSnapshotSchema",
      "WeeklyAggregateFactsSchema",
      "WeeklyExpressionPlanSchema",
      "WeeklyExpressionPayloadSchema",
      "PublishedWeeklySummarySchema",
      "ClientWeeklySummaryViewSchema",
    ]) {
      expect(publicApi).toHaveProperty(name);
    }
  });

  it("exports 19 stable, unique JSON Schema IDs", () => {
    expect(Object.keys(jsonSchemas)).toHaveLength(19);
    expect(Object.keys(JSON_SCHEMA_IDS)).toHaveLength(19);
    expect(new Set(Object.values(JSON_SCHEMA_IDS)).size).toBe(19);
    for (const name of Object.keys(jsonSchemas) as Array<
      keyof typeof jsonSchemas
    >) {
      expect(jsonSchemas[name].$id).toBe(JSON_SCHEMA_IDS[name]);
      expect(jsonSchemas[name].$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
    }
  });

  it("preserves strict root-object behavior in JSON Schema", () => {
    expect(jsonSchemas.publishedDailyResult.type).toBe("object");
    expect(jsonSchemas.publishedDailyResult.additionalProperties).toBe(false);
    expect(jsonSchemas.clientWeeklySummaryView.type).toBe("object");
    expect(jsonSchemas.clientWeeklySummaryView.additionalProperties).toBe(
      false,
    );
  });
});
