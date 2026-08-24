import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ClientEveningFeedbackViewSchema,
  EveningSaveRequestSchema,
  SafetyOverlayViewSchema,
} from "@daily-energy/shared-schemas";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { API_ERROR_CATALOG } from "../transport/common/api-exception.js";

describe("C-012 evening transport contract", () => {
  it("binds closed component revisions and rejects owner/guard injection", () => {
    const valid = {
      command_ref: "evening-command-0001",
      product_date: "2026-08-24",
      expected_feedback_revision: 0,
      expected_helpfulness_revision: 0,
      overall_feeling: "UNSURE",
      helpfulness_rating: "NOT_USED",
      task_patch: {
        task_ref: "task.close-one-distraction.v1",
        expected_revision: 1,
        status: "SKIPPED",
      },
      note_patch: { operation: "CLEAR" },
      client_context: {
        entry_source: "TODAY_EVENING_CARD",
        view_schema_version: "1.0.0",
      },
    };
    expect(EveningSaveRequestSchema.safeParse(valid).success).toBe(true);
    for (const field of [
      "account_id",
      "session_id",
      "result_ref",
      "safety_epoch",
      "deletion_epoch",
      "write_window",
      "relationship_stage",
    ]) {
      expect(
        EveningSaveRequestSchema.safeParse({ ...valid, [field]: "forged" })
          .success,
      ).toBe(false);
    }
    expect(
      EveningSaveRequestSchema.safeParse({
        ...valid,
        note_patch: { operation: "CLEAR", value: "forbidden" },
      }).success,
    ).toBe(false);
  });

  it("keeps strict client and Safety overlay projections", () => {
    expect(
      ClientEveningFeedbackViewSchema.safeParse({
        contract: "evening-feedback-view",
        schema_version: "1.0.0",
        product_date: "2026-08-24",
        availability: "EDITABLE_EMPTY",
        write_window: "OPEN",
        helpfulness: { revision: 0, rating: "UNRATED" },
        task: {
          task_id: "task.close-one-distraction.v1",
          instruction: "现在关闭一个会分散注意力的页面。",
          revision: 1,
          status: "UNMARKED",
        },
        options: {
          overall_feeling: [
            "VERY_HEAVY",
            "SOMEWHAT_HEAVY",
            "STEADY",
            "PRETTY_GOOD",
            "LIGHT",
            "UNSURE",
          ],
          helpfulness: ["HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
          task_status: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
        },
        note_max_characters: 80,
        primary_action: "SAVE",
        completion_message: "今天先到这里，这些记录已经留下了。",
      }).success,
    ).toBe(true);
    expect(
      SafetyOverlayViewSchema.safeParse({
        state: "ACTIVE",
        revision: 1,
        response_bundle_version: "safety-response-v1",
        blocks: [
          {
            block_id: "DIRECT_ACKNOWLEDGEMENT_V1",
            kind: "DIRECT_ACKNOWLEDGEMENT",
            copy: "这里先停止普通流程，请优先联系现实中的帮助。",
            resources: [],
          },
        ],
        updated_at: "2026-08-24T12:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(API_ERROR_CATALOG.SAFETY_OVERLAY).toMatchObject({
      category: "SAFETY",
      status: 409,
    });
  });

  it("maps authenticated OpenAPI paths to executable schemas", async () => {
    const document = parse(
      await readFile(
        resolve(import.meta.dirname, "../../../../openapi/openapi.yaml"),
        "utf8",
      ),
    ) as {
      paths: Record<string, Record<string, { security?: unknown[] }>>;
      components: {
        schemas: Record<string, { "x-source-contract"?: string }>;
      };
    };
    expect(document.paths["/evening/today"]?.get?.security).toEqual([
      { userBearerAuth: [] },
    ]);
    expect(document.paths["/evening/save"]?.post?.security).toEqual([
      { userBearerAuth: [] },
    ]);
    expect(document.components.schemas.EveningSaveRequest).toMatchObject({
      "x-source-contract": "EveningSaveRequestSchema",
    });
    expect(document.components.schemas.EveningView).toEqual({
      "x-source-contract": "ClientEveningFeedbackViewSchema",
    });
  });
});
