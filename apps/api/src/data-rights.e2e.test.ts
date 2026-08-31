import type { INestApplication } from "@nestjs/common";
import type {
  AuthStore,
  DataRightsStore,
  StoredDataExportSource,
} from "@daily-energy/server-adapters/api";
import type {
  DataTaskView,
  DataRightsSummaryView,
  DeletionConfirmationView,
} from "@daily-energy/shared-schemas";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "./bootstrap/create-api-application.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "./bootstrap/runtime-config.js";

const accountId = "11111111-1111-4111-8111-111111111111";
const sessionToken = "c014_public_session_token_000001";
const fixedNow = new Date("2026-08-25T12:00:00.000Z");
const task: DataTaskView = {
  can_cancel: false,
  created_at: fixedNow.toISOString(),
  kind: "DELETE",
  revision: 1,
  scope: "DAY",
  status: "PENDING",
  target_summary: "2026-08-24 日记录",
  task_ref: "33333333-3333-4333-8333-333333333333",
  updated_at: fixedNow.toISOString(),
};
const accountConfirmation: DeletionConfirmationView = {
  backup_max_days: 35,
  confirmation_challenge_ref: "44444444-4444-4444-8444-444444444444",
  confirmation_version: "data-rights-account-v1",
  derived_effects: ["在线产品数据异步清理。"],
  expected_revision: 1,
  expires_at: "2026-08-25T12:10:00.000Z",
  identity_reverification_required: true,
  immediate_effects: ["普通产品访问立即停止。"],
  online_erasure_sla_hours: 72,
  scope: "ACCOUNT",
  target: { subject: "SELF" },
};
const exportTask: DataTaskView = {
  ...task,
  can_cancel: true,
  kind: "EXPORT",
  scope: "ACCOUNT",
  target_summary: "账户数据导出",
  export_artifact: { format: "JSON", state: "PREPARING" },
};
const exportDownloadRef = "77777777-7777-4777-8777-777777777777";
const readyExportTask: DataTaskView = {
  ...exportTask,
  can_cancel: false,
  revision: 3,
  status: "SUCCEEDED",
  export_artifact: {
    download_ref: exportDownloadRef,
    expires_at: "2026-08-26T12:00:00.000Z",
    format: "JSON",
    ready_at: fixedNow.toISOString(),
    state: "READY",
  },
};
const accountTask: DataTaskView = {
  ...task,
  scope: "ACCOUNT",
  target_summary: "账户数据",
  task_ref: "88888888-8888-4888-8888-888888888888",
};
const summary: DataRightsSummaryView = {
  account: { expected_revision: 1, state: "ACTIVE" },
  relationship: { expected_revision: 3, state: "PRESENT" },
  backup_max_days: 35,
  capabilities: {
    delete_account: true,
    delete_day: true,
    delete_matter: true,
    delete_relationship_data: true,
    export_account: true,
  },
  confirmation_versions: {
    delete_account: "data-rights-account-v1",
    delete_day: "data-rights-day-v1",
    delete_matter: "data-rights-matter-v1",
    delete_relationship_data: "data-rights-relationship-v1",
    export_account: "data-export-v1",
  },
  online_erasure_sla_hours: 72,
};
const emptyExportSource: StoredDataExportSource = {
  consentSummary: {
    notice_version: "necessary-consent-v1",
    state: "MISSING",
  },
  dataTaskSummaries: [],
  days: [],
  matters: [],
  notificationPreferences: { items: [] },
};
const relationshipConfirmation: DeletionConfirmationView = {
  backup_max_days: 35,
  confirmation_challenge_ref: "66666666-6666-4666-8666-666666666666",
  confirmation_version: "data-rights-relationship-v1",
  derived_effects: ["关系表达会失效。"],
  expected_day_revisions: [],
  expected_revision: 3,
  expires_at: "2026-08-25T12:10:00.000Z",
  identity_reverification_required: false,
  immediate_effects: ["关系记录立即停止使用。"],
  online_erasure_sla_hours: 72,
  scope: "RELATIONSHIP_DATA",
  target: {
    included_day_product_dates: [],
    relationship_scope: "CURRENT_CYCLE_AND_HISTORY",
  },
};

const authStore: AuthStore = {
  close: async () => undefined,
  establishSession: async () => Promise.reject(new Error("NOT_USED")),
  inspectSession: async () => ({
    session: {
      accountId,
      accountState: "ACTIVE",
      consentRequired: false,
      expiresAt: new Date("2026-09-25T00:00:00.000Z"),
      onboardingRequired: false,
      sessionId: "22222222-2222-4222-8222-222222222222",
    },
    status: "ACTIVE",
  }),
  revokeSession: async () => "ACCEPTED",
  rotateSession: async () => Promise.reject(new Error("NOT_USED")),
};

const applications: INestApplication[] = [];
afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

function config() {
  return loadRuntimeConfig({
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_ENVIRONMENT: "CI",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "c014-http-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

async function app(overrides: Partial<DataRightsStore> = {}) {
  const dataRightsStore = {
    close: async () => undefined,
    confirmAccountDeletion: vi.fn(async () => ({
      statusGrant: {
        expiresAt: new Date("2026-09-01T12:00:00.000Z"),
        taskRef: accountTask.task_ref,
      },
      task: accountTask,
    })),
    confirmRelationshipDeletion: vi.fn(async () => ({
      ...task,
      scope: "RELATIONSHIP_DATA" as const,
      target_summary: "关系数据",
    })),
    createExport: vi.fn(async () => exportTask),
    deleteDay: vi.fn(async () => task),
    getDeletionStatus: vi.fn(async () => accountTask),
    getSummary: vi.fn(async () => summary),
    listTasks: vi.fn(async () => ({
      items: [task],
      page_info: { has_more: false },
    })),
    prepareAccountDeletion: vi.fn(async () => accountConfirmation),
    prepareRelationshipDeletion: vi.fn(async () => relationshipConfirmation),
    readExportArtifact: vi.fn(async () => ({
      readyAt: fixedNow,
      source: emptyExportSource,
      status: "READY" as const,
    })),
    verifyIdentity: vi.fn(async () => ({
      confirmation_challenge_ref:
        accountConfirmation.confirmation_challenge_ref,
      expires_at: "2026-08-25T12:05:00.000Z",
      identity_verification_ref: "55555555-5555-4555-8555-555555555555",
    })),
    ...overrides,
  } as unknown as DataRightsStore;
  const application = await createApiApplication(config(), {
    authStore,
    dataRightsStore,
    ordinaryLogSink: { write() {} },
    productDateClock: { now: () => fixedNow },
  });
  await application.listen(0, "127.0.0.1");
  applications.push(application);
  return { application, dataRightsStore };
}

function authenticated(test: request.Test) {
  return test.set("Authorization", `Bearer ${sessionToken}`);
}

describe("C-014 HTTP data-rights flow", () => {
  it("lists only owner task views and accepts one strict DAY deletion", async () => {
    const fixture = await app();
    const discovered = await authenticated(
      request(fixture.application.getHttpServer()).get(
        "/v1/data-rights/summary",
      ),
    ).expect(200);
    expect(discovered.body.data).toEqual(summary);
    expect(JSON.stringify(discovered.body)).not.toMatch(
      /account_ref|deletion_epoch|source_fingerprint/iu,
    );
    const listed = await authenticated(
      request(fixture.application.getHttpServer()).get("/v1/data-rights/tasks"),
    ).expect(200);
    expect(listed.body.data.items).toEqual([task]);
    expect(JSON.stringify(listed.body)).not.toMatch(
      /accountId|deletionEpoch|checkpoint|receipt|ownerScope/iu,
    );

    const body = {
      command_ref: "delete-day-command-0001",
      confirmation_version: "data-rights-day-v1",
      confirmed: true,
      expected_revision: 2,
      scope: "DAY",
      target: { product_date: "2026-08-24" },
    };
    await authenticated(
      request(fixture.application.getHttpServer())
        .post("/v1/data-rights/delete/day")
        .set("Idempotency-Key", body.command_ref)
        .send({ ...body, deletion_epoch: 9 }),
    ).expect(400);
    const accepted = await authenticated(
      request(fixture.application.getHttpServer())
        .post("/v1/data-rights/delete/day")
        .set("Idempotency-Key", body.command_ref)
        .send(body),
    ).expect(202);
    expect(accepted.body.data).toEqual(task);
    expect(fixture.dataRightsStore.deleteDay).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        expectedRevision: 2,
        productDate: "2026-08-24",
      }),
    );
  });

  it("keeps account prepare, challenge-scoped reauth and confirm distinct", async () => {
    const fixture = await app();
    const prepareCommand = "prepare-account-command-0001";
    const prepared = await authenticated(
      request(fixture.application.getHttpServer())
        .post("/v1/data-rights/delete/account/prepare")
        .set("Idempotency-Key", prepareCommand)
        .send({
          command_ref: prepareCommand,
          confirmation_version: "data-rights-account-v1",
          expected_account_revision: 1,
          scope: "ACCOUNT",
          target: { subject: "SELF" },
        }),
    ).expect(200);
    expect(prepared.body.data).toEqual(accountConfirmation);

    const reauthCommand = "reauth-account-command-0001";
    const verified = await authenticated(
      request(fixture.application.getHttpServer())
        .post("/v1/auth/reauth/verify")
        .set("Idempotency-Key", reauthCommand)
        .send({
          command_ref: reauthCommand,
          confirmation_challenge_ref:
            accountConfirmation.confirmation_challenge_ref,
          wechat_code: "dev:c014-owner:reauth-code",
        }),
    ).expect(200);
    const confirmCommand = "confirm-account-command-0001";
    const accepted = await authenticated(
      request(fixture.application.getHttpServer())
        .post("/v1/data-rights/delete/account/confirm")
        .set("Idempotency-Key", confirmCommand)
        .send({
          command_ref: confirmCommand,
          confirmation_challenge_ref:
            accountConfirmation.confirmation_challenge_ref,
          confirmation_version: accountConfirmation.confirmation_version,
          confirmed: true,
          expected_account_revision: 1,
          identity_verification_ref:
            verified.body.data.identity_verification_ref,
          scope: "ACCOUNT",
          target: { subject: "SELF" },
        }),
    ).expect(202);
    expect(accepted.body.data.task).toEqual(accountTask);
    expect(accepted.body.data.status_grant).toMatchObject({
      task_ref: accountTask.task_ref,
      expires_at: "2026-09-01T12:00:00.000Z",
    });
    expect(accepted.body.data.status_grant.status_token).toMatch(
      /^[A-Za-z0-9_-]{43}$/u,
    );
    expect(fixture.dataRightsStore.verifyIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ accountId }),
    );
    expect(fixture.dataRightsStore.confirmAccountDeletion).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        challengeRef: accountConfirmation.confirmation_challenge_ref,
        statusTokenHash: expect.any(Buffer),
      }),
    );
    await request(fixture.application.getHttpServer())
      .get(`/v1/data-rights/deletion-status/${accountTask.task_ref}`)
      .set("Authorization", `Bearer ${sessionToken}`)
      .expect(401);
    const continued = await request(fixture.application.getHttpServer())
      .get(`/v1/data-rights/deletion-status/${accountTask.task_ref}`)
      .set(
        "Authorization",
        `DeletionStatus ${accepted.body.data.status_grant.status_token}`,
      )
      .expect(200);
    expect(continued.body.data).toEqual(accountTask);
    expect(fixture.dataRightsStore.getDeletionStatus).toHaveBeenCalledWith(
      accountTask.task_ref,
      expect.any(Buffer),
      fixedNow,
    );
  });

  it("creates an export task and freezes an empty relationship DAY selection", async () => {
    const fixture = await app();
    const exportCommand = "export-account-command-0001";
    const exported = await authenticated(
      request(fixture.application.getHttpServer())
        .post("/v1/data-rights/export")
        .set("Idempotency-Key", exportCommand)
        .send({
          command_ref: exportCommand,
          confirmation_version: "data-export-v1",
          export_format: "JSON",
        }),
    ).expect(202);
    expect(exported.body.data).toEqual(exportTask);
    const downloaded = await authenticated(
      request(fixture.application.getHttpServer()).get(
        `/v1/data-rights/exports/${readyExportTask.task_ref}/artifacts/${exportDownloadRef}`,
      ),
    ).expect(200);
    expect(downloaded.headers["cache-control"]).toBe("no-store");
    expect(downloaded.headers["content-disposition"]).toBe(
      'attachment; filename="dailyenergy-export.json"',
    );
    expect(downloaded.headers["x-content-type-options"]).toBe("nosniff");
    expect(downloaded.body).toMatchObject({
      schema_version: "data-export-v1",
      generated_at: fixedNow.toISOString(),
      days: [],
      matters: [],
    });
    expect(JSON.stringify(downloaded.body)).not.toMatch(
      /token|seed|prompt|epoch|source_fingerprint|provider/iu,
    );

    const prepareCommand = "prepare-relationship-command-0001";
    const target = {
      included_day_product_dates: [],
      relationship_scope: "CURRENT_CYCLE_AND_HISTORY",
    };
    const prepared = await authenticated(
      request(fixture.application.getHttpServer())
        .post("/v1/data-rights/delete/relationship/prepare")
        .set("Idempotency-Key", prepareCommand)
        .send({
          command_ref: prepareCommand,
          confirmation_version: "data-rights-relationship-v1",
          expected_relationship_revision: 3,
          included_day_expected_revisions: [],
          scope: "RELATIONSHIP_DATA",
          target,
        }),
    ).expect(200);
    expect(prepared.body.data).toEqual(relationshipConfirmation);
    const confirmCommand = "confirm-relationship-command-0001";
    await authenticated(
      request(fixture.application.getHttpServer())
        .post("/v1/data-rights/delete/relationship/confirm")
        .set("Idempotency-Key", confirmCommand)
        .send({
          command_ref: confirmCommand,
          confirmation_challenge_ref:
            relationshipConfirmation.confirmation_challenge_ref,
          confirmation_version: relationshipConfirmation.confirmation_version,
          confirmed: true,
          expected_relationship_revision: 3,
          included_day_expected_revisions: [],
          scope: "RELATIONSHIP_DATA",
          target,
        }),
    ).expect(202);
    expect(
      fixture.dataRightsStore.confirmRelationshipDeletion,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRelationshipRevision: 3,
        frozenPayload: {
          expected_day_revisions: [],
          target,
        },
      }),
    );
  });
});
