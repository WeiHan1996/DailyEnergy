import { describe, expect, it } from "vitest";

import {
  ClientEveningFeedbackViewSchema,
  DailyHelpfulnessRecordSchema,
  DailyTaskStateSchema,
  EveningFeedbackDraftSchema,
  EveningFeedbackRecordSchema,
  EveningFeedbackRevisionSchema,
  EveningReflectionSubmissionSchema,
  NotePatchSchema,
} from "../src/index.js";
import {
  clientEveningViewFixture,
  cloneFixture,
  eveningRecordFixture,
  eveningSubmissionFixture,
} from "./fixtures.js";

describe("evening feedback contracts", () => {
  it("accepts the Accepted submission, record, and client examples", () => {
    expect(
      EveningReflectionSubmissionSchema.safeParse(eveningSubmissionFixture)
        .success,
    ).toBe(true);
    expect(
      EveningFeedbackRecordSchema.safeParse(eveningRecordFixture).success,
    ).toBe(true);
    expect(
      ClientEveningFeedbackViewSchema.safeParse(clientEveningViewFixture)
        .success,
    ).toBe(true);
  });

  it("accepts every remaining evening root schema independently", () => {
    expect(
      EveningFeedbackDraftSchema.safeParse({
        product_date: "2026-07-20",
        overall_feeling: "STEADY",
        helpfulness_rating: "HELPFUL",
        note: "今天轻松了一点。",
        last_edited_at: "2026-07-20T12:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      EveningFeedbackRevisionSchema.safeParse({
        contract: "evening-feedback-revision",
        schema_version: "1.0.0",
        feedback_id: "ef_example_20260720",
        revision: 2,
        changed_fields: ["note"],
        source_submission_id: "ers_example_002",
        changed_at: "2026-07-20T12:20:00Z",
        change_source: "USER_SUBMISSION",
        safety_policy_version: "safety-example-v1",
      }).success,
    ).toBe(true);
    expect(
      DailyHelpfulnessRecordSchema.safeParse({
        contract: "daily-helpfulness",
        schema_version: "1.0.0",
        helpfulness_id: "help_example_20",
        user_ref: "user_example",
        product_date: "2026-07-20",
        revision: 1,
        rating: "HELPFUL",
        updated_at: "2026-07-20T12:10:00Z",
        source_submission_id: "ers_example_001",
      }).success,
    ).toBe(true);
    expect(
      DailyTaskStateSchema.safeParse({
        contract: "daily-task-state",
        schema_version: "1.0.0",
        task_id: "task_close_one_background",
        user_ref: "user_example",
        product_date: "2026-07-20",
        revision: 2,
        status: "COMPLETED",
        updated_at: "2026-07-20T12:10:00Z",
        source_submission_id: "ers_example_001",
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported enum values", () => {
    const submission = cloneFixture(eveningSubmissionFixture);
    (submission as Record<string, unknown>).overall_feeling = "PERFECT";
    expect(
      EveningReflectionSubmissionSchema.safeParse(submission).success,
    ).toBe(false);
  });

  it("accepts SET and CLEAR but rejects ambiguous note patches", () => {
    expect(
      NotePatchSchema.safeParse({ operation: "SET", value: "今天轻松了一点。" })
        .success,
    ).toBe(true);
    expect(NotePatchSchema.safeParse({ operation: "CLEAR" }).success).toBe(
      true,
    );
    expect(
      NotePatchSchema.safeParse({ operation: "CLEAR", value: "旧内容" })
        .success,
    ).toBe(false);
    expect(NotePatchSchema.safeParse({ operation: "SET" }).success).toBe(false);
    expect(
      NotePatchSchema.safeParse({ operation: "SET", value: "   " }).success,
    ).toBe(false);
  });

  it("requires nonnegative expected revisions and complete atomic intent", () => {
    const revision = cloneFixture(eveningSubmissionFixture);
    revision.expected_helpfulness_revision = -1;
    expect(EveningReflectionSubmissionSchema.safeParse(revision).success).toBe(
      false,
    );

    const partial = cloneFixture(eveningSubmissionFixture);
    delete (partial as Partial<typeof partial>).overall_feeling;
    expect(EveningReflectionSubmissionSchema.safeParse(partial).success).toBe(
      false,
    );
  });

  it("rejects unknown, null, multiline, and oversized note input", () => {
    const unknown = cloneFixture(eveningSubmissionFixture);
    (unknown as Record<string, unknown>).daily_score = 88;
    expect(EveningReflectionSubmissionSchema.safeParse(unknown).success).toBe(
      false,
    );

    const multiline = cloneFixture(eveningSubmissionFixture);
    multiline.note_patch = { operation: "SET", value: "第一行\n第二行" };
    expect(EveningReflectionSubmissionSchema.safeParse(multiline).success).toBe(
      false,
    );

    const oversized = cloneFixture(eveningSubmissionFixture);
    oversized.note_patch = { operation: "SET", value: "记".repeat(81) };
    expect(EveningReflectionSubmissionSchema.safeParse(oversized).success).toBe(
      false,
    );

    const nullNote = cloneFixture(eveningSubmissionFixture);
    (nullNote as Record<string, unknown>).note_patch = null;
    expect(EveningReflectionSubmissionSchema.safeParse(nullNote).success).toBe(
      false,
    );
  });

  it("enforces authoritative record timestamp order", () => {
    const record = cloneFixture(eveningRecordFixture);
    record.updated_at = "2026-07-20T12:09:59Z";
    expect(EveningFeedbackRecordSchema.safeParse(record).success).toBe(false);
  });

  it("accepts empty and read-only client states with consistent actions", () => {
    const empty = cloneFixture(clientEveningViewFixture);
    empty.availability = "EDITABLE_EMPTY";
    empty.primary_action = "SAVE";
    delete (empty as Record<string, unknown>).feedback;
    empty.helpfulness = { revision: 0, rating: "UNRATED" };
    expect(ClientEveningFeedbackViewSchema.safeParse(empty).success).toBe(true);

    const readOnly = cloneFixture(clientEveningViewFixture);
    readOnly.availability = "READ_ONLY_SUBMITTED";
    readOnly.write_window = "CLOSED";
    readOnly.primary_action = "READ_ONLY";
    expect(ClientEveningFeedbackViewSchema.safeParse(readOnly).success).toBe(
      true,
    );
  });

  it("rejects inconsistent availability, write window, action, and option order", () => {
    const action = cloneFixture(clientEveningViewFixture);
    action.primary_action = "SAVE";
    expect(ClientEveningFeedbackViewSchema.safeParse(action).success).toBe(
      false,
    );

    const missingRecord = cloneFixture(clientEveningViewFixture);
    delete (missingRecord as Record<string, unknown>).feedback;
    expect(
      ClientEveningFeedbackViewSchema.safeParse(missingRecord).success,
    ).toBe(false);

    const closed = cloneFixture(clientEveningViewFixture);
    closed.write_window = "CLOSED";
    expect(ClientEveningFeedbackViewSchema.safeParse(closed).success).toBe(
      false,
    );

    const options = cloneFixture(clientEveningViewFixture);
    [options.options.helpfulness[0], options.options.helpfulness[1]] = [
      options.options.helpfulness[1]!,
      options.options.helpfulness[0]!,
    ];
    expect(ClientEveningFeedbackViewSchema.safeParse(options).success).toBe(
      false,
    );
  });
});
