import { describe, expect, it } from "vitest";

import * as clientApi from "../src/client.js";
import {
  ClientDailyContentViewSchema,
  EveningReflectionSubmissionSchema,
  WechatSessionRequestSchema,
} from "../src/client.js";
import { clientDailyContentViewFixture, cloneFixture } from "./fixtures.js";

describe("client-safe schema surface", () => {
  it("exports only the reviewed client-safe contract surface", () => {
    expect(clientApi).toHaveProperty("ClientDailyContentViewSchema");
    expect(clientApi).toHaveProperty("EveningReflectionSubmissionSchema");
    expect(clientApi).toHaveProperty("WechatSessionRequestSchema");

    for (const internalExport of [
      "GenerationInputSnapshotSchema",
      "PublishedDailyResultSchema",
      "PublishedWeeklySummarySchema",
      "RuleFactsSchema",
      "WeeklySourceSnapshotSchema",
    ]) {
      expect(clientApi).not.toHaveProperty(internalExport);
    }
  });

  it("fails closed for unknown or server-only fields", () => {
    expect(
      WechatSessionRequestSchema.safeParse({
        code: "synthetic-code",
        openid: "must-not-pass",
      }).success,
    ).toBe(false);

    const view = cloneFixture(clientDailyContentViewFixture);
    (view as Record<string, unknown>).provider = "must-not-pass";
    expect(ClientDailyContentViewSchema.safeParse(view).success).toBe(false);
  });

  it("keeps cross-field submission rules on the Zod authority", () => {
    const submission = {
      contract: "evening-reflection-submission",
      schema_version: "1.0.0",
      submission_id: "submission-synthetic",
      product_date: "2026-07-29",
      expected_feedback_revision: 0,
      expected_helpfulness_revision: 0,
      overall_feeling: "STEADY",
      helpfulness_rating: "HELPFUL",
      client_context: {
        entry_source: "evening-card-v1",
        view_schema_version: "1.0.0",
      },
      note_patch: {
        operation: "CLEAR",
        value: "must-not-exist",
      },
    };
    expect(
      EveningReflectionSubmissionSchema.safeParse(submission).success,
    ).toBe(false);
  });
});
