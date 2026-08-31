import { describe, expect, it } from "vitest";

import * as publicApi from "../src/index.js";
import { JSON_SCHEMA_IDS, jsonSchemas } from "../src/json-schema.js";
import { WechatSessionRequestSchema } from "../src/public-transport.js";

function matchesSimpleObjectSchema(
  schema: {
    readonly additionalProperties?: boolean;
    readonly properties?: Readonly<
      Record<
        string,
        {
          readonly maxLength?: number;
          readonly minLength?: number;
          readonly type?: string;
        }
      >
    >;
    readonly required?: readonly string[];
    readonly type?: string;
  },
  value: unknown,
): boolean {
  if (
    schema.type !== "object" ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const properties = schema.properties ?? {};
  if (
    schema.additionalProperties === false &&
    Object.keys(record).some((key) => !Object.hasOwn(properties, key))
  ) {
    return false;
  }
  if ((schema.required ?? []).some((key) => !Object.hasOwn(record, key))) {
    return false;
  }
  return Object.entries(record).every(([key, entry]) => {
    const property = properties[key];
    return (
      property !== undefined &&
      property.type === typeof entry &&
      (typeof entry !== "string" ||
        ((property.minLength === undefined ||
          entry.length >= property.minLength) &&
          (property.maxLength === undefined ||
            entry.length <= property.maxLength)))
    );
  });
}

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
      "WechatSessionRequestSchema",
      "TaskStateUpdateRequestSchema",
    ]) {
      expect(publicApi).toHaveProperty(name);
    }
  });

  it("exports 29 stable, unique JSON Schema IDs", () => {
    expect(Object.keys(jsonSchemas)).toHaveLength(29);
    expect(Object.keys(JSON_SCHEMA_IDS)).toHaveLength(29);
    expect(new Set(Object.values(JSON_SCHEMA_IDS)).size).toBe(29);
    expect(JSON_SCHEMA_IDS.taskStateUpdateRequest).toBe(
      "urn:dailyenergy:schema:task-state-update-request:1.0.0",
    );
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

  it("keeps representative JSON Schema and Zod samples consistent", () => {
    const schema = jsonSchemas.wechatSessionRequest;
    for (const sample of [
      { code: "synthetic-code" },
      { code: "synthetic-code", channel: "douyin" },
      {},
      { code: "" },
      { code: "synthetic-code", openid: "internal-field" },
    ]) {
      expect(matchesSimpleObjectSchema(schema, sample)).toBe(
        WechatSessionRequestSchema.safeParse(sample).success,
      );
    }
  });
});
