import { describe, expect, it } from "vitest";

import {
  AccountDeletionAcceptedViewSchema,
  DataExportDocumentSchema,
  DataRightsSummaryViewSchema,
  DataTaskViewSchema,
  DeleteAccountConfirmRequestSchema,
  DeleteDayRequestSchema,
  DeleteRelationshipPrepareRequestSchema,
  DeletionConfirmationViewSchema,
  ExportRequestSchema,
} from "../src/index.js";

describe("C-014 data-rights contracts", () => {
  it("accepts strict export and one-confirmation DAY commands", () => {
    expect(
      ExportRequestSchema.safeParse({
        command_ref: "export-command-0001",
        export_format: "JSON",
        confirmation_version: "data-export-v1",
      }).success,
    ).toBe(true);
    const day = {
      command_ref: "delete-day-command-0001",
      scope: "DAY",
      target: { product_date: "2026-08-25" },
      confirmation_version: "data-rights-day-v1",
      confirmed: true,
      expected_revision: 2,
    };
    expect(DeleteDayRequestSchema.safeParse(day).success).toBe(true);
    expect(
      DeleteDayRequestSchema.safeParse({ ...day, deletion_epoch: 9 }).success,
    ).toBe(false);
  });

  it("binds relationship dates to the exact revision vector", () => {
    const request = {
      command_ref: "delete-relationship-0001",
      scope: "RELATIONSHIP_DATA",
      target: {
        relationship_scope: "CURRENT_CYCLE_AND_HISTORY",
        included_day_product_dates: ["2026-08-24", "2026-08-25"],
      },
      expected_relationship_revision: 3,
      included_day_expected_revisions: [
        { product_date: "2026-08-24", expected_revision: 2 },
        { product_date: "2026-08-25", expected_revision: 1 },
      ],
      confirmation_version: "data-rights-relationship-v1",
    };
    expect(
      DeleteRelationshipPrepareRequestSchema.safeParse(request).success,
    ).toBe(true);
    expect(
      DeleteRelationshipPrepareRequestSchema.safeParse({
        ...request,
        included_day_expected_revisions: request.included_day_expected_revisions
          .slice()
          .reverse(),
      }).success,
    ).toBe(false);
  });

  it("requires challenge-scoped identity verification for ACCOUNT confirm", () => {
    const request = {
      command_ref: "delete-account-confirm-0001",
      confirmation_challenge_ref: "challenge-account-0001",
      scope: "ACCOUNT",
      target: { subject: "SELF" },
      expected_account_revision: 4,
      confirmation_version: "data-rights-account-v1",
      confirmed: true,
      identity_verification_ref: "identity-verification-0001",
    };
    expect(DeleteAccountConfirmRequestSchema.safeParse(request).success).toBe(
      true,
    );
    const { identity_verification_ref: _removed, ...missing } = request;
    expect(DeleteAccountConfirmRequestSchema.safeParse(missing).success).toBe(
      false,
    );
  });

  it("keeps task completion, failure and cancellation semantics closed", () => {
    const base = {
      task_ref: "task-data-rights-0001",
      revision: 2,
      kind: "DELETE",
      scope: "DAY",
      target_summary: "删除 2026-08-25 的日记录",
      status: "SUCCEEDED",
      online_erased_at: "2026-08-25T02:00:00.000Z",
      backup_purge_deadline: "2026-09-29T02:00:00.000Z",
      can_cancel: false,
      created_at: "2026-08-25T01:00:00.000Z",
      updated_at: "2026-08-25T02:00:00.000Z",
    };
    expect(DataTaskViewSchema.safeParse(base).success).toBe(true);
    expect(
      DataTaskViewSchema.safeParse({
        ...base,
        kind: "EXPORT",
        online_erased_at: undefined,
        backup_purge_deadline: undefined,
        export_artifact: {
          state: "READY",
          format: "JSON",
          download_ref: "download-data-rights-0001",
          ready_at: "2026-08-25T02:00:00.000Z",
          expires_at: "2026-08-26T02:00:00.000Z",
        },
      }).success,
    ).toBe(true);
    expect(
      DataTaskViewSchema.safeParse({
        ...base,
        online_erased_at: undefined,
      }).success,
    ).toBe(false);
    expect(
      DataTaskViewSchema.safeParse({
        ...base,
        status: "FAILED",
        online_erased_at: undefined,
        backup_purge_deadline: undefined,
      }).success,
    ).toBe(false);
  });

  it("keeps confirmation effects and fixed SLA explicit", () => {
    expect(
      DeletionConfirmationViewSchema.safeParse({
        confirmation_challenge_ref: "challenge-account-0001",
        scope: "ACCOUNT",
        target: { subject: "SELF" },
        confirmation_version: "data-rights-account-v1",
        expected_revision: 4,
        immediate_effects: ["确认后普通产品访问立即停止。"],
        derived_effects: ["在线产品数据异步清理。"],
        online_erasure_sla_hours: 72,
        backup_max_days: 35,
        identity_reverification_required: true,
        expires_at: "2026-08-25T01:10:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("discovers only public revisions and fixed data-rights capabilities", () => {
    const summary = {
      account: { expected_revision: 4, state: "ACTIVE" },
      relationship: { expected_revision: 2, state: "PRESENT" },
      capabilities: {
        export_account: true,
        delete_day: true,
        delete_matter: true,
        delete_relationship_data: true,
        delete_account: true,
      },
      confirmation_versions: {
        export_account: "data-export-v1",
        delete_day: "data-rights-day-v1",
        delete_matter: "data-rights-matter-v1",
        delete_relationship_data: "data-rights-relationship-v1",
        delete_account: "data-rights-account-v1",
      },
      online_erasure_sla_hours: 72,
      backup_max_days: 35,
    };
    expect(DataRightsSummaryViewSchema.safeParse(summary).success).toBe(true);
    expect(
      DataRightsSummaryViewSchema.safeParse({
        ...summary,
        account_ref: "forbidden-internal-ref",
      }).success,
    ).toBe(false);
  });

  it("binds the one-time deletion status token to the accepted account task", () => {
    const task = {
      task_ref: "task-account-delete-0001",
      revision: 1,
      kind: "DELETE",
      scope: "ACCOUNT",
      target_summary: "账户数据",
      status: "PENDING",
      can_cancel: false,
      created_at: "2026-08-25T01:00:00.000Z",
      updated_at: "2026-08-25T01:00:00.000Z",
    };
    const accepted = {
      task,
      status_grant: {
        task_ref: task.task_ref,
        status_token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
        expires_at: "2026-09-01T01:00:00.000Z",
      },
    };
    expect(AccountDeletionAcceptedViewSchema.safeParse(accepted).success).toBe(
      true,
    );
    expect(
      AccountDeletionAcceptedViewSchema.safeParse({
        ...accepted,
        status_grant: {
          ...accepted.status_grant,
          task_ref: "another-task-account-delete-0002",
        },
      }).success,
    ).toBe(false);
  });

  it("keeps the generated export document strict and free of transport internals", () => {
    const document = {
      schema_version: "data-export-v1",
      generated_at: "2026-08-25T02:00:00.000Z",
      consent_summary: {
        state: "ACCEPTED",
        notice_version: "necessary-consent-v1",
        accepted_at: "2026-08-20T02:00:00.000Z",
      },
      days: [],
      matters: [],
      notification_preferences: { items: [] },
      data_task_summaries: [],
    };
    expect(DataExportDocumentSchema.safeParse(document).success).toBe(true);
    expect(
      DataExportDocumentSchema.safeParse({
        ...document,
        source_fingerprint: "forbidden",
      }).success,
    ).toBe(false);
  });
});
