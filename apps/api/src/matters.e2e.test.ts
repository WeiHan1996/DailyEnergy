import type { INestApplication } from "@nestjs/common";
import {
  DataRightsStoreError,
  type AuthStore,
  type DataRightsStore,
  type MatterMutationResult,
  type MatterStore,
  type ProtectedMatterTitle,
  type StoredMatterView,
} from "@daily-energy/server-adapters/api";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "./bootstrap/create-api-application.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "./bootstrap/runtime-config.js";
import type {
  EveningSafetyInputGate,
  EveningSafetyStore,
} from "./evening/evening-safety.js";

const accountId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const sessionToken = "ai008_public_session_token_000001";
const fixedNow = new Date("2026-09-14T04:00:00.000Z");

const authStore: AuthStore = {
  close: async () => undefined,
  establishSession: async () => Promise.reject(new Error("NOT_USED")),
  inspectSession: async () => ({
    session: {
      accountId,
      accountState: "ACTIVE",
      consentRequired: false,
      expiresAt: new Date("2026-10-14T04:00:00.000Z"),
      onboardingRequired: false,
      sessionId,
    },
    status: "ACTIVE",
  }),
  revokeSession: async () => "ACCEPTED",
  rotateSession: async () => Promise.reject(new Error("NOT_USED")),
};

class HttpMatterStore implements MatterStore {
  readonly items = new Map<string, StoredMatterView>();
  readonly receipts = new Map<
    string,
    { readonly fingerprint: Buffer; readonly matterRef: string }
  >();
  nextOrdinal = 3;

  async list() {
    return { status: "FOUND", value: [...this.items.values()] } as const;
  }

  async get(input: Parameters<MatterStore["get"]>[0]) {
    const value = this.items.get(input.matterRef);
    return value === undefined
      ? ({ status: "NOT_FOUND" } as const)
      : ({ status: "FOUND", value } as const);
  }

  async create(input: Parameters<MatterStore["create"]>[0]) {
    const replay = this.replay(
      input.commandRef,
      input.normalizedPayloadFingerprint,
    );
    if (replay !== undefined) {
      return replay;
    }
    const matterRef = `33333333-3333-4333-8333-${String(this.nextOrdinal++).padStart(12, "0")}`;
    const value: StoredMatterView = {
      dailyUseGranted: input.dailyUseGranted,
      matterRef,
      revision: 1,
      state: "ACTIVE",
      ...(input.targetProductDate === undefined
        ? {}
        : { targetProductDate: input.targetProductDate }),
      title: input.title,
      updatedAt: input.now,
      weeklyUseGranted: input.weeklyUseGranted,
    };
    this.items.set(matterRef, value);
    this.receipts.set(input.commandRef, {
      fingerprint: input.normalizedPayloadFingerprint,
      matterRef,
    });
    return { status: "ACCEPTED", value } as const;
  }

  async update(input: Parameters<MatterStore["update"]>[0]) {
    const replay = this.replay(
      input.commandRef,
      input.normalizedPayloadFingerprint,
    );
    if (replay !== undefined) {
      return replay;
    }
    const current = this.items.get(input.matterRef);
    if (current === undefined) {
      return { status: "NOT_FOUND" } as const;
    }
    if (current.revision !== input.expectedRevision) {
      return { current, status: "REVISION_CONFLICT" } as const;
    }
    const value: StoredMatterView = {
      dailyUseGranted: input.dailyUseGranted ?? current.dailyUseGranted,
      matterRef: current.matterRef,
      revision: current.revision + 1,
      state: current.state,
      ...(input.clearTargetDate
        ? {}
        : input.targetProductDate === undefined
          ? current.targetProductDate === undefined
            ? {}
            : { targetProductDate: current.targetProductDate }
          : { targetProductDate: input.targetProductDate }),
      title: input.title ?? current.title,
      updatedAt: input.now,
      weeklyUseGranted: input.weeklyUseGranted ?? current.weeklyUseGranted,
    };
    this.items.set(input.matterRef, value);
    this.receipts.set(input.commandRef, {
      fingerprint: input.normalizedPayloadFingerprint,
      matterRef: input.matterRef,
    });
    return { status: "ACCEPTED", value } as const;
  }

  async transition(input: Parameters<MatterStore["transition"]>[0]) {
    const replay = this.replay(
      input.commandRef,
      input.normalizedPayloadFingerprint,
    );
    if (replay !== undefined) {
      return replay;
    }
    const current = this.items.get(input.matterRef);
    if (current === undefined) {
      return { status: "NOT_FOUND" } as const;
    }
    if (current.revision !== input.expectedRevision) {
      return { current, status: "REVISION_CONFLICT" } as const;
    }
    const state =
      input.transition === "PAUSE"
        ? "PAUSED"
        : input.transition === "COMPLETE"
          ? "COMPLETED"
          : "ACTIVE";
    const value: StoredMatterView = {
      ...current,
      dailyUseGranted: input.revokeUseGrants ? false : current.dailyUseGranted,
      revision: current.revision + 1,
      state,
      updatedAt: input.now,
      weeklyUseGranted: input.revokeUseGrants
        ? false
        : current.weeklyUseGranted,
    };
    this.items.set(input.matterRef, value);
    this.receipts.set(input.commandRef, {
      fingerprint: input.normalizedPayloadFingerprint,
      matterRef: input.matterRef,
    });
    return { status: "ACCEPTED", value } as const;
  }

  async close() {}

  private replay(
    commandRef: string,
    fingerprint: Buffer,
  ): MatterMutationResult | undefined {
    const receipt = this.receipts.get(commandRef);
    if (receipt === undefined) {
      return undefined;
    }
    const current = this.items.get(receipt.matterRef);
    if (!receipt.fingerprint.equals(fingerprint)) {
      return { status: "IDEMPOTENCY_CONFLICT" };
    }
    return current === undefined
      ? { status: "STATE_PRECONDITION_FAILED" }
      : { status: "DUPLICATE", value: current };
  }
}

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
    DAILYENERGY_RELEASE_ID: "ai008-http-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

async function app(input: {
  readonly gate?: EveningSafetyInputGate;
  readonly safetyStore?: EveningSafetyStore;
  readonly store: HttpMatterStore;
}) {
  const dataRightsStore = {
    close: async () => undefined,
    deleteMatter: async (deletion: {
      readonly accountId: string;
      readonly expectedRevision: number;
      readonly matterRef: string;
      readonly now: Date;
    }) => {
      const current = input.store.items.get(deletion.matterRef);
      if (current === undefined) {
        throw new DataRightsStoreError("NOT_FOUND");
      }
      if (
        deletion.accountId !== accountId ||
        deletion.expectedRevision !== current.revision
      ) {
        throw new DataRightsStoreError("REVISION_CONFLICT");
      }
      input.store.items.delete(deletion.matterRef);
      return {
        can_cancel: false,
        created_at: deletion.now.toISOString(),
        kind: "DELETE",
        revision: 1,
        scope: "MATTER",
        status: "PENDING",
        target_summary: "事项数据",
        task_ref: "44444444-4444-4444-8444-444444444444",
        updated_at: deletion.now.toISOString(),
      } as const;
    },
  } as unknown as DataRightsStore;
  const application = await createApiApplication(config(), {
    authStore,
    dataRightsStore,
    ...(input.gate === undefined ? {} : { eveningSafetyGate: input.gate }),
    ...(input.safetyStore === undefined
      ? {}
      : { eveningSafetyStore: input.safetyStore }),
    matterStore: input.store,
    ordinaryLogSink: { write() {} },
    productDateClock: { now: () => fixedNow },
  });
  await application.listen(0, "127.0.0.1");
  applications.push(application);
  return application;
}

function authenticated(test: request.Test) {
  return test.set("Authorization", `Bearer ${sessionToken}`);
}

const clearGate: EveningSafetyInputGate = {
  decide: async () => ({
    classifierVersion: "synthetic-classifier-v1",
    irreversibleFingerprint: Buffer.alloc(32, 8),
    outcome: "CLEAR",
    policyVersion: "safety-v1",
    ruleVersion: "rules-v1",
  }),
};

describe("AI-008 HTTP matter flow", () => {
  it("creates, lists, updates, pauses, resumes, and explicitly deletes one matter", async () => {
    const application = await app({
      gate: clearGate,
      store: new HttpMatterStore(),
    });
    const createBody = {
      command_ref: "matter-http-create-0001",
      daily_use_granted: true,
      target_date: "2026-09-18",
      title: "周五做项目汇报",
      weekly_use_granted: false,
    };
    const created = await authenticated(
      request(application.getHttpServer())
        .post("/v1/matters")
        .set("Idempotency-Key", createBody.command_ref)
        .send(createBody),
    ).expect(200);
    const matterRef = created.body.data.matter_ref as string;
    expect(created.body.data).toMatchObject({
      daily_use_granted: true,
      revision: 1,
      status: "ACTIVE",
      title: createBody.title,
    });
    expect(JSON.stringify(created.body)).not.toMatch(
      /accountId|ciphertext|keyVersion|fingerprint/iu,
    );
    await authenticated(request(application.getHttpServer()).get("/v1/matters"))
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items).toHaveLength(1);
      });

    const updateBody = {
      command_ref: "matter-http-update-0001",
      daily_use_granted: false,
      expected_revision: 1,
      title: "周五完成项目汇报",
    };
    const updated = await authenticated(
      request(application.getHttpServer())
        .patch(`/v1/matters/${matterRef}`)
        .set("Idempotency-Key", updateBody.command_ref)
        .send(updateBody),
    ).expect(200);
    expect(updated.body.data).toMatchObject({
      daily_use_granted: false,
      revision: 2,
      title: "周五完成项目汇报",
    });
    await authenticated(
      request(application.getHttpServer())
        .patch(`/v1/matters/${matterRef}`)
        .set("Idempotency-Key", updateBody.command_ref)
        .send(updateBody),
    )
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({ revision: 2 });
      });

    const pauseBody = {
      command_ref: "matter-http-pause-0001",
      expected_revision: 2,
    };
    const pause = await authenticated(
      request(application.getHttpServer())
        .post(`/v1/matters/${matterRef}/pause`)
        .set("Idempotency-Key", pauseBody.command_ref)
        .send(pauseBody),
    ).expect(200);
    expect(pause.body.data).toMatchObject({ revision: 3, status: "PAUSED" });
    await authenticated(
      request(application.getHttpServer())
        .post(`/v1/matters/${matterRef}/pause`)
        .set("Idempotency-Key", pauseBody.command_ref)
        .send(pauseBody),
    )
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          revision: 3,
          status: "PAUSED",
        });
      });

    const resume = await authenticated(
      request(application.getHttpServer())
        .post(`/v1/matters/${matterRef}/resume`)
        .set("Idempotency-Key", "matter-http-resume-0001")
        .send({
          command_ref: "matter-http-resume-0001",
          expected_revision: 3,
        }),
    ).expect(200);
    expect(resume.body.data).toMatchObject({ revision: 4, status: "ACTIVE" });

    const deleted = await authenticated(
      request(application.getHttpServer())
        .post(`/v1/matters/${matterRef}/delete`)
        .set("Idempotency-Key", "matter-http-delete-0001")
        .send({
          command_ref: "matter-http-delete-0001",
          confirmation_version: "data-rights-matter-v1",
          confirmed: true,
          expected_revision: 4,
        }),
    ).expect(200);
    expect(deleted.body.data).toMatchObject({
      scope: "MATTER",
      status: "PENDING",
    });
    await authenticated(request(application.getHttpServer()).get("/v1/matters"))
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items).toHaveLength(0);
      });
  });

  it("rejects unknown fields and same-key payload changes", async () => {
    const application = await app({
      gate: clearGate,
      store: new HttpMatterStore(),
    });
    const send = (title: string, extra: Record<string, unknown> = {}) =>
      authenticated(
        request(application.getHttpServer())
          .post("/v1/matters")
          .set("Idempotency-Key", "matter-http-idempotent-0001")
          .send({
            command_ref: "matter-http-idempotent-0001",
            daily_use_granted: false,
            title,
            weekly_use_granted: false,
            ...extra,
          }),
      );
    await send("准备周会").expect(200);
    await send("准备周会").expect(200);
    await send("准备另一场周会").expect(409);
    await send("准备周会", { owner_id: accountId }).expect(400);
    await send("多行\n事项", {
      command_ref: "matter-http-invalid-newline",
    }).expect(400);
    await send("🙂".repeat(81), {
      command_ref: "matter-http-invalid-length",
    }).expect(400);
  });

  it("routes high-risk input to Safety without ordinary Matter persistence", async () => {
    const store = new HttpMatterStore();
    const create = vi.spyOn(store, "create");
    const application = await app({
      gate: {
        decide: async () => ({
          categoryCodes: ["SELF_HARM_OR_SUICIDE"],
          classifierVersion: "synthetic-classifier-v1",
          irreversibleFingerprint: Buffer.alloc(32, 9),
          outcome: "HIGH_RISK",
          policyVersion: "safety-v1",
          ruleVersion: "rules-v1",
        }),
      },
      safetyStore: {
        activate: async () => ({
          status: "ACCEPTED",
          view: {
            blocks: [
              {
                block_id: "DIRECT_ACKNOWLEDGEMENT_V1",
                copy: "这里先停止普通流程，请优先联系现实中的帮助。",
                kind: "DIRECT_ACKNOWLEDGEMENT",
                resources: [],
              },
            ],
            response_bundle_version: "safety-response-v1",
            revision: 1,
            state: "ACTIVE",
            updated_at: fixedNow.toISOString(),
          },
        }),
        close: async () => undefined,
      },
      store,
    });
    const response = await authenticated(
      request(application.getHttpServer())
        .post("/v1/matters")
        .set("Idempotency-Key", "matter-http-safety-0001")
        .send({
          command_ref: "matter-http-safety-0001",
          daily_use_granted: true,
          title: "synthetic high risk",
          weekly_use_granted: true,
        }),
    ).expect(409);
    expect(response.body.error).toMatchObject({
      code: "SAFETY_OVERLAY",
      safety_view: { state: "ACTIVE" },
    });
    expect(JSON.stringify(response.body)).not.toContain("synthetic high risk");
    expect(create).not.toHaveBeenCalled();
  });
});
