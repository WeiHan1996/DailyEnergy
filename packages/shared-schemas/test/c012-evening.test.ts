import { describe, expect, it } from "vitest";

import {
  EveningReflectionSubmissionSchema,
  EveningSaveRequestSchema,
  SafetyOverlayViewSchema,
} from "../src/index.js";

const request = {
  command_ref: "evening-command-0001",
  product_date: "2026-08-24",
  expected_feedback_revision: 0,
  expected_helpfulness_revision: 0,
  overall_feeling: "UNSURE",
  helpfulness_rating: "NOT_USED",
  client_context: {
    entry_source: "TODAY_SECONDARY",
    view_schema_version: "1.0.0",
  },
};

describe("C-012 evening executable contracts", () => {
  it("accepts explicit neutral values and rejects open entry/revision maps", () => {
    expect(EveningSaveRequestSchema.safeParse(request).success).toBe(true);
    expect(
      EveningSaveRequestSchema.safeParse({
        ...request,
        client_context: {
          entry_source: "ARBITRARY_TRACKER",
          view_schema_version: "1.0.0",
        },
      }).success,
    ).toBe(false);
    expect(
      EveningSaveRequestSchema.safeParse({
        ...request,
        expected_revisions: { feedback: 0, helpfulness: 0 },
      }).success,
    ).toBe(false);
    expect(
      EveningSaveRequestSchema.safeParse({
        ...request,
        task_patch: {
          task_ref: "task.close-one-distraction.v1",
          expected_revision: 0,
          status: "COMPLETED",
        },
      }).success,
    ).toBe(false);
  });

  it("keeps transport and domain submission identities distinct", () => {
    expect(
      EveningReflectionSubmissionSchema.safeParse({
        contract: "evening-reflection-submission",
        schema_version: "1.0.0",
        submission_id: request.command_ref,
        product_date: request.product_date,
        expected_feedback_revision: request.expected_feedback_revision,
        expected_helpfulness_revision: request.expected_helpfulness_revision,
        overall_feeling: request.overall_feeling,
        helpfulness_rating: request.helpfulness_rating,
        client_context: request.client_context,
      }).success,
    ).toBe(true);
  });

  it("rejects empty Safety overlays and unknown fields", () => {
    const overlay = {
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
    };
    expect(SafetyOverlayViewSchema.safeParse(overlay).success).toBe(true);
    expect(
      SafetyOverlayViewSchema.safeParse({ ...overlay, blocks: [] }).success,
    ).toBe(false);
    expect(
      SafetyOverlayViewSchema.safeParse({ ...overlay, category_codes: [] })
        .success,
    ).toBe(false);
  });
});
