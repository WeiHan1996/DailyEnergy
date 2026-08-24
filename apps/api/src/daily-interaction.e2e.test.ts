import type { INestApplication } from "@nestjs/common";
import type {
  AuthStore,
  DailyInteractionStore,
} from "@daily-energy/server-adapters/api";
import type { DailyInteractionState } from "@daily-energy/shared-schemas";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "./bootstrap/create-api-application.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "./bootstrap/runtime-config.js";
import type { OrdinaryLogEvent } from "./observability/ordinary-log.types.js";

const accountId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const sessionToken = "c010_public_session_token_000001";
const fixedNow = new Date("2026-08-24T02:00:00.000Z");
const initial: DailyInteractionState = {
  contract: "daily-interaction-state",
  schema_version: "1.0.0",
  result_id: "33333333-3333-4333-8333-333333333333",
  product_date: "2026-08-24",
  is_lit: false,
  task: {
    task_id: "task.close-one-distraction.v1",
    revision: 1,
    status: "UNMARKED",
  },
  helpfulness: { rating: "UNRATED", revision: 0 },
  updated_at: fixedNow.toISOString(),
};

const authStore: AuthStore = {
  close: async () => undefined,
  establishSession: async () => {
    throw new Error("NOT_USED");
  },
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
  rotateSession: async () => {
    throw new Error("NOT_USED");
  },
};

class HttpDailyInteractionStore implements DailyInteractionStore {
  current = initial;
  nextFailure?:
    "SAFETY_BLOCKED" | "VIEW_CONTINUATION_EXPIRED" | "WRITE_WINDOW_CLOSED";
  readonly receipts = new Map<
    string,
    { fingerprint: Buffer; value?: DailyInteractionState }
  >();

  public async get() {
    return this.nextFailure === "SAFETY_BLOCKED"
      ? ({ status: "SAFETY_BLOCKED" } as const)
      : ({ status: "FOUND", value: this.current } as const);
  }

  public async openToday() {
    return { status: "RECORDED" } as const;
  }

  public async listHistory(): ReturnType<DailyInteractionStore["listHistory"]> {
    return {
      status: "FOUND",
      value: {
        items: [
          {
            product_date: this.current.product_date,
            state: "RECORDED",
            is_lit: this.current.is_lit,
            has_result: true,
            has_evening_feedback: false,
          },
        ],
        page_info: { has_more: false },
      },
    };
  }

  public async lightDay(
    input: Parameters<DailyInteractionStore["lightDay"]>[0],
  ) {
    if (this.nextFailure !== undefined) {
      return { status: this.nextFailure } as const;
    }
    const receipt = this.receipts.get(input.commandRef);
    if (receipt !== undefined) {
      return receipt.fingerprint.equals(input.normalizedPayloadFingerprint)
        ? ({ status: "DUPLICATE", value: receipt.value! } as const)
        : ({ status: "IDEMPOTENCY_CONFLICT" } as const);
    }
    if (
      input.accountId !== accountId ||
      input.sessionId !== sessionId ||
      input.productDate !== this.current.product_date ||
      input.resultRef !== this.current.result_id
    ) {
      return { status: "NOT_FOUND" } as const;
    }
    this.current = {
      ...this.current,
      is_lit: true,
      updated_at: input.now.toISOString(),
    };
    this.receipts.set(input.commandRef, {
      fingerprint: input.normalizedPayloadFingerprint,
      value: this.current,
    });
    return { status: "ACCEPTED", value: this.current } as const;
  }

  public async updateTask(
    input: Parameters<DailyInteractionStore["updateTask"]>[0],
  ) {
    if (this.nextFailure !== undefined) {
      return { status: this.nextFailure } as const;
    }
    const receipt = this.receipts.get(input.commandRef);
    if (receipt !== undefined) {
      return receipt.fingerprint.equals(input.normalizedPayloadFingerprint)
        ? ({ status: "DUPLICATE", value: receipt.value! } as const)
        : ({ status: "IDEMPOTENCY_CONFLICT" } as const);
    }
    if (
      input.accountId !== accountId ||
      input.sessionId !== sessionId ||
      input.productDate !== this.current.product_date ||
      input.taskRef !== this.current.task.task_id
    ) {
      return { status: "NOT_FOUND" } as const;
    }
    if (input.expectedRevision !== this.current.task.revision) {
      return {
        current: this.current,
        status: "REVISION_CONFLICT",
      } as const;
    }
    if (input.status !== this.current.task.status) {
      this.current = {
        ...this.current,
        task: {
          ...this.current.task,
          revision: this.current.task.revision + 1,
          status: input.status,
        },
        updated_at: input.now.toISOString(),
      };
    }
    this.receipts.set(input.commandRef, {
      fingerprint: input.normalizedPayloadFingerprint,
      value: this.current,
    });
    return { status: "ACCEPTED", value: this.current } as const;
  }

  public async close(): Promise<void> {}
}

const applications: INestApplication[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
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
    DAILYENERGY_RELEASE_ID: "c010-http-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

async function testApplication(
  store: DailyInteractionStore,
  events: OrdinaryLogEvent[] = [],
) {
  const application = await createApiApplication(config(), {
    authStore,
    dailyInteractionStore: store,
    ordinaryLogSink: { write: (event) => events.push(event) },
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
  command_ref: "task-command-0001",
  expected_revision: 1,
  product_date: "2026-08-24",
  status: "INTERESTED",
  task_ref: "task.close-one-distraction.v1",
} as const;

describe("C-010 HTTP daily task flow", () => {
  it("reads and updates one owner/session-bound task", async () => {
    const events: OrdinaryLogEvent[] = [];
    const application = await testApplication(
      new HttpDailyInteractionStore(),
      events,
    );
    const before = await authenticated(
      request(application.getHttpServer()).get("/v1/daily/interaction"),
    ).expect(200);
    expect(before.body.data.task).toMatchObject({
      revision: 1,
      status: "UNMARKED",
    });
    const updated = await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/interaction/task")
        .set("Idempotency-Key", payload.command_ref)
        .send(payload),
    ).expect(200);
    expect(updated.body.data.task).toMatchObject({
      revision: 2,
      status: "INTERESTED",
    });
    expect(JSON.stringify(updated.body)).not.toMatch(
      /account|session|continuation|epoch|fingerprint/iu,
    );
    expect(events.map(({ operation_code }) => operation_code)).toEqual([
      "DAILY_INTERACTION_READ",
      "DAILY_TASK_UPDATE",
    ]);
  });

  it("replays one command and rejects changed payload/header/date injection", async () => {
    const store = new HttpDailyInteractionStore();
    const application = await testApplication(store);
    const send = (
      body: Record<string, unknown>,
      key: string = payload.command_ref,
    ) =>
      authenticated(
        request(application.getHttpServer())
          .post("/v1/daily/interaction/task")
          .set("Idempotency-Key", key)
          .send(body),
      );
    const first = await send(payload).expect(200);
    const replay = await send(payload).expect(200);
    expect(replay.body.data).toEqual(first.body.data);
    await send({ ...payload, status: "COMPLETED" }).expect(409);
    await send(payload, "different-command").expect(409);
    await send({ ...payload, product_date: "2026-02-30" }).expect(400);
    await send({ ...payload, account_id: accountId }).expect(400);
  });

  it("returns the latest interaction on a stale task revision", async () => {
    const store = new HttpDailyInteractionStore();
    store.current = {
      ...initial,
      task: { ...initial.task, revision: 2, status: "COMPLETED" },
    };
    const application = await testApplication(store);
    const response = await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/interaction/task")
        .set("Idempotency-Key", payload.command_ref)
        .send(payload),
    ).expect(409);
    expect(response.body.error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: {
        current: { task: { revision: 2, status: "COMPLETED" } },
        current_revision: 2,
      },
    });
  });

  it.each([
    ["WRITE_WINDOW_CLOSED", 403],
    ["VIEW_CONTINUATION_EXPIRED", 403],
    ["SAFETY_BLOCKED", 409],
  ] as const)("maps %s without optimistic success", async (code, status) => {
    const store = new HttpDailyInteractionStore();
    store.nextFailure = code;
    const application = await testApplication(store);
    const response = await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/interaction/task")
        .set("Idempotency-Key", payload.command_ref)
        .send(payload),
    ).expect(status);
    expect(response.body.error.code).toBe(code);
    expect(store.current).toEqual(initial);
  });
});

describe("C-011 HTTP light and records flow", () => {
  it("lights once, replays one command and rejects client reading claims", async () => {
    const events: OrdinaryLogEvent[] = [];
    const store = new HttpDailyInteractionStore();
    const application = await testApplication(store, events);
    const light = {
      command_ref: "light-command-0001",
      product_date: "2026-08-24",
      result_ref: initial.result_id,
    };
    const send = (body: Record<string, unknown>) =>
      authenticated(
        request(application.getHttpServer())
          .post("/v1/daily/interaction/light")
          .set("Idempotency-Key", light.command_ref)
          .send(body),
      );
    await send(light).expect(200);
    const replay = await send(light).expect(200);
    expect(replay.body.data).toMatchObject({ is_lit: true });
    await send({ ...light, result_ref: "another-result" }).expect(409);
    await send({ ...light, main_action_reached: true }).expect(400);
    expect(events.map(({ operation_code }) => operation_code)).toContain(
      "DAILY_LIGHT_CREATE",
    );
  });

  it("returns the recent list with explicit fact-free missing dates", async () => {
    const application = await testApplication(new HttpDailyInteractionStore());
    const response = await authenticated(
      request(application.getHttpServer()).get("/v1/history/days"),
    ).expect(200);
    expect(response.body.data).toEqual({
      items: [
        {
          product_date: "2026-08-24",
          state: "RECORDED",
          is_lit: false,
          has_result: true,
          has_evening_feedback: false,
        },
      ],
      page_info: { has_more: false },
    });
  });
});
