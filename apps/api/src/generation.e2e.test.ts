import type { INestApplication } from "@nestjs/common";
import type {
  AuthStore,
  DailyGenerationStore,
} from "@daily-energy/server-adapters/api";
import type { TodayView } from "@daily-energy/shared-schemas";
import type { HistoryDayView } from "@daily-energy/shared-schemas";
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
const sessionToken = "c008_public_session_token_000001";
const fixedNow = new Date("2026-08-24T02:00:00.000Z");
const intentRef = "33333333-3333-4333-8333-333333333333";
const resultRef = "44444444-4444-4444-8444-444444444444";

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
      sessionId: "22222222-2222-4222-8222-222222222222",
    },
    status: "ACTIVE",
  }),
  revokeSession: async () => "ACCEPTED",
  rotateSession: async () => {
    throw new Error("NOT_USED");
  },
};

function todayView(): TodayView {
  return {
    content: {
      contract: "daily-content-view",
      schema_version: "1.0.0",
      result_id: resultRef,
      product_date: "2026-08-24",
      result_version: "daily-v1",
      generated_at: fixedNow.toISOString(),
      content_label: "娱乐与行动参考",
      greeting: "早上好，我们先把今天放稳一点。",
      state_response: "你今天的精力还算平稳，少一点切换会比临时加速更省力。",
      overall: {
        band: "STEADY",
        band_label: "适合稳住",
        summary: "今天适合稳住节奏，再推进一小步。",
      },
      focus_dimension_id: "action",
      dimensions: [
        {
          id: "action",
          label: "行动推进",
          band: "LOW",
          band_label: "适合放轻",
          explanation: "行动先从最小的一步开始，别同时推进。",
          is_focus: true,
        },
        {
          id: "pace",
          label: "今日节奏",
          band: "STEADY",
          band_label: "适合稳住",
          explanation: "节奏适合保持稳定，不必突然加速。",
          is_focus: false,
        },
        {
          id: "connection",
          label: "沟通连接",
          band: "STEADY",
          band_label: "适合稳住",
          explanation: "沟通可以多确认一次，减少彼此猜测。",
          is_focus: false,
        },
        {
          id: "resources",
          label: "资源安排",
          band: "STEADY",
          band_label: "适合稳住",
          explanation: "时间和注意力够用，但需要先排顺序。",
          is_focus: false,
        },
        {
          id: "recovery",
          label: "恢复留白",
          band: "HIGH",
          band_label: "余量较多",
          explanation: "今天有一点留白余量，可以用来恢复。",
          is_focus: false,
        },
      ],
      core_tip: "先保护注意力，再决定今天真正要推进的那一件事。",
      explanation_paragraphs: [
        "今天的行动余量偏轻，但恢复留白相对充足。与其同时开启很多事情，不如把注意力留给一个清楚的小目标。",
        "沟通和资源安排保持平稳，提前确认一次重点，就能减少临场切换。",
      ],
      primary_action: {
        action_id: "act_reduce_switching",
        instruction: "关掉一个不必要的后台，只推进眼前最重要的一件事。",
        rationale: "减少切换，比勉强提高速度更有效。",
        constraint_label: "先做十分钟",
      },
      optional_task: {
        task_id: "task_close_one_background",
        instruction: "现在关闭一个会分散注意力的页面。",
      },
      rituals: [],
      closing: "今天先做好这一件就够了。",
      personalization_notice: "NONE",
    },
    interaction: {
      contract: "daily-interaction-state",
      schema_version: "1.0.0",
      result_id: resultRef,
      product_date: "2026-08-24",
      is_lit: false,
      task: {
        task_id: "task_close_one_background",
        revision: 1,
        status: "UNMARKED",
      },
      helpfulness: { rating: "UNRATED", revision: 0 },
      updated_at: fixedNow.toISOString(),
    },
    relationship: {
      encounter_day_count: 0,
      stage: "BEFORE_FIRST_MEETING",
    },
  };
}

class HttpGenerationStore implements DailyGenerationStore {
  failure?: "GENERATION_FAILED_RETRYABLE" | "GENERATION_FAILED_TERMINAL";
  guard?: "SAFETY_BLOCKED";
  intent?: ReturnType<HttpGenerationStore["intentView"]>;
  published?: TodayView;
  readonly receipts = new Map<string, Buffer>();

  public async getByDate(
    input: Parameters<DailyGenerationStore["getByDate"]>[0],
  ) {
    return input.productDate === "2026-08-23"
      ? ({
          status: "FOUND",
          value: {
            product_date: "2026-08-23",
            checkin: {
              checkin_ref: "55555555-5555-4555-8555-555555555555",
              energy: "STEADY",
              mood: "GOOD",
              product_date: "2026-08-23",
              revision: 1,
              sleep: "OKAY",
              updated_at: "2026-08-23T02:00:00.000Z",
              write_window: "CLOSED",
            },
          } satisfies HistoryDayView,
        } as const)
      : ({ status: "NOT_FOUND" } as const);
  }

  public async start(input: Parameters<DailyGenerationStore["start"]>[0]) {
    if (this.guard !== undefined) {
      return { status: this.guard } as const;
    }
    const receipt = this.receipts.get(input.commandRef);
    if (receipt !== undefined) {
      return receipt.equals(input.normalizedPayloadFingerprint)
        ? ({ status: "DUPLICATE", value: this.intent! } as const)
        : ({ status: "IDEMPOTENCY_CONFLICT" } as const);
    }
    this.receipts.set(input.commandRef, input.normalizedPayloadFingerprint);
    if (this.intent !== undefined) {
      return { status: "DUPLICATE", value: this.intent } as const;
    }
    this.intent = this.intentView(input.productDate, "QUEUED");
    return { status: "ACCEPTED", value: this.intent } as const;
  }

  public async getIntent(
    input: Parameters<DailyGenerationStore["getIntent"]>[0],
  ) {
    if (this.guard !== undefined) {
      return { status: this.guard } as const;
    }
    return this.intent?.intent_ref === input.intentRef
      ? ({ status: "FOUND", value: this.intent } as const)
      : ({ status: "NOT_FOUND" } as const);
  }

  public async getToday() {
    if (this.guard !== undefined) {
      return { status: this.guard } as const;
    }
    if (this.published !== undefined) {
      return { status: "FOUND", value: this.published } as const;
    }
    if (this.failure !== undefined) {
      return { status: this.failure } as const;
    }
    return this.intent === undefined
      ? ({ status: "NOT_FOUND" } as const)
      : ({ status: "GENERATION_PENDING" } as const);
  }

  public complete(): void {
    delete this.failure;
    this.intent = this.intentView("2026-08-24", "SUCCEEDED");
    this.published = todayView();
  }

  public async close(): Promise<void> {}

  private intentView(productDate: string, status: "QUEUED" | "SUCCEEDED") {
    return {
      intent_ref: intentRef,
      product_date: productDate,
      status,
      ...(status === "SUCCEEDED" ? { result_ref: resultRef } : {}),
      ...(status === "QUEUED" ? { retry_after_seconds: 2 } : {}),
      updated_at: fixedNow.toISOString(),
    };
  }
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
    DAILYENERGY_RELEASE_ID: "c008-http-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

async function testApplication(
  store: DailyGenerationStore,
  events: OrdinaryLogEvent[] = [],
) {
  const application = await createApiApplication(config(), {
    authStore,
    dailyGenerationStore: store,
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

const startPayload = {
  command_ref: "generation-command-0001",
  expected_checkin_revision: 1,
} as const;

describe("C-008 HTTP generation flow", () => {
  it("starts once, replays the same command and exposes one status resource", async () => {
    const store = new HttpGenerationStore();
    const events: OrdinaryLogEvent[] = [];
    const application = await testApplication(store, events);
    const send = () =>
      authenticated(
        request(application.getHttpServer())
          .post("/v1/daily/generation/start")
          .set("Idempotency-Key", startPayload.command_ref)
          .send(startPayload),
      );
    const first = await send().expect(200);
    const replay = await send().expect(200);
    expect(replay.body.data).toEqual(first.body.data);
    expect(first.body.data).toMatchObject({
      intent_ref: intentRef,
      product_date: "2026-08-24",
      status: "QUEUED",
    });
    const status = await authenticated(
      request(application.getHttpServer()).get(
        `/v1/daily/generation/${intentRef}`,
      ),
    ).expect(200);
    expect(status.body.data).toEqual(first.body.data);
    await authenticated(
      request(application.getHttpServer()).get(
        "/v1/daily/generation/55555555-5555-4555-8555-555555555555",
      ),
    ).expect(404);
    expect(events.map(({ operation_code }) => operation_code)).toEqual([
      "GENERATION_START",
      "GENERATION_START",
      "GENERATION_STATUS",
      "GENERATION_STATUS",
    ]);
    expect(
      events.some(({ operation_code }) => operation_code === "UNKNOWN_HTTP"),
    ).toBe(false);
  });

  it("rejects owner/date injection, mismatched headers and changed replay", async () => {
    const application = await testApplication(new HttpGenerationStore());
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/generation/start")
        .set("Idempotency-Key", startPayload.command_ref)
        .send({ ...startPayload, product_date: "2020-01-01" }),
    ).expect(400);
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/generation/start")
        .set("Idempotency-Key", "different-command")
        .send(startPayload),
    ).expect(409);
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/generation/start")
        .set("Idempotency-Key", startPayload.command_ref)
        .send(startPayload),
    ).expect(200);
    const changed = await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/generation/start")
        .set("Idempotency-Key", startPayload.command_ref)
        .send({ ...startPayload, expected_checkin_revision: 2 }),
    ).expect(409);
    expect(changed.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("returns bounded polling guidance until Today becomes available", async () => {
    const store = new HttpGenerationStore();
    const application = await testApplication(store);
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/generation/start")
        .set("Idempotency-Key", startPayload.command_ref)
        .send(startPayload),
    ).expect(200);
    const pending = await authenticated(
      request(application.getHttpServer()).get("/v1/daily/today"),
    ).expect(503);
    expect(pending.headers["retry-after"]).toBe("2");
    expect(pending.body.error).toMatchObject({
      code: "GENERATION_PENDING",
      details: { retry_after_seconds: 2 },
      retryable: true,
    });

    store.failure = "GENERATION_FAILED_TERMINAL";
    const terminal = await authenticated(
      request(application.getHttpServer()).get("/v1/daily/today"),
    ).expect(422);
    expect(terminal.body.error).toMatchObject({
      code: "GENERATION_FAILED_TERMINAL",
      retryable: false,
    });

    store.complete();
    const today = await authenticated(
      request(application.getHttpServer()).get("/v1/daily/today"),
    ).expect(200);
    expect(today.body.data).toEqual(todayView());
    expect(JSON.stringify(today.body.data)).not.toMatch(
      /score|provenance|user_ref|seed|fingerprint/iu,
    );
  });

  it("applies Safety before start, status and cached Today reads", async () => {
    const store = new HttpGenerationStore();
    store.guard = "SAFETY_BLOCKED";
    const application = await testApplication(store);
    for (const operation of [
      authenticated(
        request(application.getHttpServer())
          .post("/v1/daily/generation/start")
          .set("Idempotency-Key", startPayload.command_ref)
          .send(startPayload),
      ),
      authenticated(
        request(application.getHttpServer()).get(
          `/v1/daily/generation/${intentRef}`,
        ),
      ),
      authenticated(
        request(application.getHttpServer()).get("/v1/daily/today"),
      ),
    ]) {
      const response = await operation.expect(409);
      expect(response.body.error.code).toBe("SAFETY_BLOCKED");
    }
  });

  it("returns a closed historical projection and rejects current/future dates", async () => {
    const application = await testApplication(new HttpGenerationStore());
    const history = await authenticated(
      request(application.getHttpServer()).get("/v1/daily/by-date/2026-08-23"),
    ).expect(200);
    expect(history.body.data).toMatchObject({
      checkin: { write_window: "CLOSED" },
      product_date: "2026-08-23",
    });
    expect(JSON.stringify(history.body.data)).not.toMatch(
      /account|seed|fingerprint|epoch/iu,
    );
    await authenticated(
      request(application.getHttpServer()).get("/v1/daily/by-date/2026-08-24"),
    ).expect(404);
    await authenticated(
      request(application.getHttpServer()).get("/v1/daily/by-date/not-a-date"),
    ).expect(400);
    await authenticated(
      request(application.getHttpServer()).get("/v1/daily/by-date/2026-02-30"),
    ).expect(400);
  });
});
