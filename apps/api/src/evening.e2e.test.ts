import type { INestApplication } from "@nestjs/common";
import type {
  AuthStore,
  EveningStore,
  StoredEveningView,
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
const sessionToken = "c012_public_session_token_000001";
const fixedNow = new Date("2026-08-24T12:00:00.000Z");
const base = {
  helpfulness: { rating: "UNRATED" as const, revision: 0 },
  productDate: "2026-08-24",
  resultId: "33333333-3333-4333-8333-333333333333",
  task: {
    instruction: "现在关闭一个会分散注意力的页面。",
    revision: 1,
    status: "UNMARKED" as const,
    taskId: "task.close-one-distraction.v1",
  },
  writeWindow: "OPEN" as const,
};

const authStore: AuthStore = {
  close: async () => undefined,
  establishSession: async () => Promise.reject(new Error("NOT_USED")),
  inspectSession: async () => ({
    session: {
      accountId,
      accountState: "ACTIVE",
      consentRequired: false,
      expiresAt: new Date("2026-09-24T00:00:00.000Z"),
      onboardingRequired: false,
      sessionId,
    },
    status: "ACTIVE",
  }),
  revokeSession: async () => "ACCEPTED",
  rotateSession: async () => Promise.reject(new Error("NOT_USED")),
};

class HttpEveningStore implements EveningStore {
  current: StoredEveningView = base;
  readonly receipts = new Map<string, Buffer>();

  async get() {
    return { status: "FOUND", value: this.current } as const;
  }

  async save(input: Parameters<EveningStore["save"]>[0]) {
    const prior = this.receipts.get(input.request.command_ref);
    if (prior !== undefined) {
      return prior.equals(input.normalizedPayloadFingerprint)
        ? ({ status: "DUPLICATE", value: this.current } as const)
        : ({ status: "IDEMPOTENCY_CONFLICT" } as const);
    }
    if (
      input.request.expected_feedback_revision !== 0 ||
      input.request.expected_helpfulness_revision !== 0
    ) {
      return { current: this.current, status: "REVISION_CONFLICT" } as const;
    }
    this.current = {
      ...base,
      feedback: {
        feedbackId: "44444444-4444-4444-8444-444444444444",
        firstSubmittedAt: input.now,
        ...(input.note === undefined ? {} : { note: input.note }),
        overallFeeling: input.request.overall_feeling,
        revision: 1,
        updatedAt: input.now,
      },
      helpfulness: {
        rating: input.request.helpfulness_rating,
        revision: 1,
      },
    };
    this.receipts.set(
      input.request.command_ref,
      input.normalizedPayloadFingerprint,
    );
    return { status: "ACCEPTED", value: this.current } as const;
  }

  async close() {}
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
    DAILYENERGY_RELEASE_ID: "c012-http-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

async function app(input: {
  readonly gate?: EveningSafetyInputGate;
  readonly safetyStore?: EveningSafetyStore;
  readonly store: EveningStore;
}) {
  const application = await createApiApplication(config(), {
    authStore,
    ...(input.gate === undefined ? {} : { eveningSafetyGate: input.gate }),
    ...(input.safetyStore === undefined
      ? {}
      : { eveningSafetyStore: input.safetyStore }),
    eveningStore: input.store,
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

const payload = {
  command_ref: "evening-command-0001",
  product_date: "2026-08-24",
  expected_feedback_revision: 0,
  expected_helpfulness_revision: 0,
  overall_feeling: "STEADY",
  helpfulness_rating: "HELPFUL",
  client_context: {
    entry_source: "TODAY_EVENING_CARD",
    view_schema_version: "1.0.0",
  },
} as const;

describe("C-012 HTTP evening flow", () => {
  it("reads, atomically saves and replays one strict command", async () => {
    const application = await app({ store: new HttpEveningStore() });
    const before = await authenticated(
      request(application.getHttpServer()).get("/v1/evening/today"),
    ).expect(200);
    expect(before.body.data).toMatchObject({ availability: "EDITABLE_EMPTY" });
    const send = (body: Record<string, unknown>) =>
      authenticated(
        request(application.getHttpServer())
          .post("/v1/evening/save")
          .set("Idempotency-Key", payload.command_ref)
          .send(body),
      );
    const saved = await send(payload).expect(200);
    expect(saved.body.data).toMatchObject({
      availability: "EDITABLE_SUBMITTED",
      feedback: { overall_feeling: "STEADY", revision: 1 },
      helpfulness: { rating: "HELPFUL", revision: 1 },
    });
    await send(payload).expect(200);
    await send({ ...payload, helpfulness_rating: "NEUTRAL" }).expect(409);
    await send({ ...payload, account_id: accountId }).expect(400);
    expect(JSON.stringify(saved.body)).not.toMatch(
      /account|cipher|fingerprint|noteKey/iu,
    );
  });

  it("diverts high-risk note without calling the ordinary store", async () => {
    const store = new HttpEveningStore();
    const save = vi.spyOn(store, "save");
    const application = await app({
      gate: {
        decide: async () => ({
          categoryCodes: ["SELF_HARM"],
          classifierVersion: "synthetic-classifier-v1",
          irreversibleFingerprint: Buffer.alloc(32, 2),
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
        .post("/v1/evening/save")
        .set("Idempotency-Key", payload.command_ref)
        .send({
          ...payload,
          note_patch: { operation: "SET", value: "synthetic high risk" },
        }),
    ).expect(409);
    expect(response.body.error).toMatchObject({
      code: "SAFETY_OVERLAY",
      safety_view: { state: "ACTIVE" },
    });
    expect(JSON.stringify(response.body)).not.toContain("synthetic high risk");
    expect(save).not.toHaveBeenCalled();
  });
});
