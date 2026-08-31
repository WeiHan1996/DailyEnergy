import type { INestApplication } from "@nestjs/common";
import type {
  AuthStore,
  CheckinStore,
  StoredCheckinView,
} from "@daily-energy/server-adapters/api";
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
const sessionToken = "c004_public_session_token_000001";
const fixedNow = new Date("2026-08-20T20:00:00.000Z");

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
      expiresAt: new Date("2026-09-20T00:00:00.000Z"),
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

class HttpCheckinStore implements CheckinStore {
  current?: StoredCheckinView;
  guard?: "SAFETY_BLOCKED";
  readonly receipts = new Map<
    string,
    { fingerprint: Buffer; value?: StoredCheckinView }
  >();

  public async getToday() {
    if (this.guard !== undefined) {
      return { status: this.guard } as const;
    }
    return this.current === undefined
      ? ({ status: "NOT_FOUND" } as const)
      : ({ status: "FOUND", value: this.current } as const);
  }

  public async submit(input: Parameters<CheckinStore["submit"]>[0]) {
    if (this.guard !== undefined) {
      return { status: this.guard } as const;
    }
    const receipt = this.receipts.get(input.commandRef);
    if (receipt !== undefined) {
      return receipt.fingerprint.equals(input.normalizedPayloadFingerprint)
        ? ({ status: "DUPLICATE", value: receipt.value! } as const)
        : ({ status: "IDEMPOTENCY_CONFLICT" } as const);
    }
    if (this.current !== undefined) {
      this.receipts.set(input.commandRef, {
        fingerprint: input.normalizedPayloadFingerprint,
      });
      return sameValues(this.current, input)
        ? ({ status: "DUPLICATE", value: this.current } as const)
        : ({
            current: this.current,
            status: "CHECKIN_ALREADY_EXISTS",
          } as const);
    }
    this.current = {
      checkinRef: "33333333-3333-4333-8333-333333333333",
      energy: input.energy,
      mood: input.mood,
      productDate: input.productDate,
      revision: 1,
      sleep: input.sleep,
      updatedAt: input.now,
    };
    this.receipts.set(input.commandRef, {
      fingerprint: input.normalizedPayloadFingerprint,
      value: this.current,
    });
    return { status: "ACCEPTED", value: this.current } as const;
  }

  public async correct(input: Parameters<CheckinStore["correct"]>[0]) {
    const receipt = this.receipts.get(input.commandRef);
    if (receipt !== undefined) {
      return receipt.fingerprint.equals(input.normalizedPayloadFingerprint)
        ? ({ status: "DUPLICATE", value: receipt.value! } as const)
        : ({ status: "IDEMPOTENCY_CONFLICT" } as const);
    }
    if (this.current === undefined) {
      return { status: "NOT_FOUND" } as const;
    }
    if (this.current.revision !== input.expectedRevision) {
      return { current: this.current, status: "REVISION_CONFLICT" } as const;
    }
    this.current = {
      ...this.current,
      energy: input.energy,
      mood: input.mood,
      revision: this.current.revision + 1,
      sleep: input.sleep,
      updatedAt: input.now,
    };
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
    DAILYENERGY_RELEASE_ID: "c004-http-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

async function testApplication(
  checkinStore: CheckinStore,
  events: OrdinaryLogEvent[] = [],
  now: Date = fixedNow,
) {
  const application = await createApiApplication(config(), {
    authStore,
    checkinStore,
    ordinaryLogSink: { write: (event) => events.push(event) },
    productDateClock: { now: () => now },
  });
  await application.listen(0, "127.0.0.1");
  applications.push(application);
  return application;
}

function authenticated(test: request.Test, token = sessionToken) {
  return test.set("Authorization", `Bearer ${token}`);
}

const payload = {
  command_ref: "checkin-command-0001",
  energy: "STEADY",
  expected_revision: 0,
  mood: "GOOD",
  sleep: "OKAY",
} as const;

describe("C-004 HTTP check-in flow", () => {
  it("binds 03:59:59 and 04:00:00 requests to different server dates", async () => {
    const before = await testApplication(
      new HttpCheckinStore(),
      [],
      new Date("2026-08-20T19:59:59.999Z"),
    );
    const after = await testApplication(
      new HttpCheckinStore(),
      [],
      new Date("2026-08-20T20:00:00.000Z"),
    );
    const submit = async (application: INestApplication, commandRef: string) =>
      authenticated(
        request(application.getHttpServer())
          .post("/v1/daily/checkin/submit")
          .set("Idempotency-Key", commandRef)
          .send({ ...payload, command_ref: commandRef }),
      ).expect(200);
    expect(
      (await submit(before, "checkin-boundary-before")).body.data.product_date,
    ).toBe("2026-08-20");
    expect(
      (await submit(after, "checkin-boundary-after")).body.data.product_date,
    ).toBe("2026-08-21");
  });

  it("returns the authoritative product date when today's record is absent", async () => {
    const beforeBoundary = new Date("2026-08-20T19:59:59.999Z");
    const application = await testApplication(
      new HttpCheckinStore(),
      [],
      beforeBoundary,
    );
    const response = await authenticated(
      request(application.getHttpServer()).get("/v1/daily/today/checkin"),
    ).expect(404);
    expect(response.body).toMatchObject({
      error: { code: "RESOURCE_NOT_FOUND" },
      product_date: "2026-08-20",
      server_now: beforeBoundary.toISOString(),
    });
  });

  it("rejects owner/date injection and mismatched idempotency headers", async () => {
    const application = await testApplication(new HttpCheckinStore());
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/checkin/submit")
        .set("Idempotency-Key", payload.command_ref)
        .send({ ...payload, product_date: "2020-01-01" }),
    )
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("VALIDATION_FAILED");
      });
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/checkin/submit")
        .set("Idempotency-Key", "different-command")
        .send(payload),
    )
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      });
  });

  it("replays the same submit and rejects the same key with different values", async () => {
    const store = new HttpCheckinStore();
    const application = await testApplication(store);
    const send = (body: Record<string, unknown>) =>
      authenticated(
        request(application.getHttpServer())
          .post("/v1/daily/checkin/submit")
          .set("Idempotency-Key", payload.command_ref)
          .send(body),
      );
    const first = await send(payload).expect(200);
    const replay = await send(payload).expect(200);
    expect(first.body.data).toEqual(replay.body.data);
    expect(first.body.data).toMatchObject({
      product_date: "2026-08-21",
      revision: 1,
    });
    await send({ ...payload, mood: "LIGHT" })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      });
  });

  it("requires correct for a different new payload and applies CAS", async () => {
    const store = new HttpCheckinStore();
    const application = await testApplication(store);
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/checkin/submit")
        .set("Idempotency-Key", payload.command_ref)
        .send(payload),
    ).expect(200);
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/checkin/submit")
        .set("Idempotency-Key", "checkin-command-0002")
        .send({
          ...payload,
          command_ref: "checkin-command-0002",
          mood: "LIGHT",
        }),
    )
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("CHECKIN_ALREADY_EXISTS");
      });

    const corrected = await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/checkin/correct")
        .set("Idempotency-Key", "checkin-correct-0001")
        .send({
          command_ref: "checkin-correct-0001",
          energy: "HIGH",
          expected_revision: 1,
          mood: "LIGHT",
          sleep: "GOOD",
        }),
    ).expect(200);
    expect(corrected.body.data).toMatchObject({
      energy: "HIGH",
      mood: "LIGHT",
      revision: 2,
      sleep: "GOOD",
    });

    const stale = await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/checkin/correct")
        .set("Idempotency-Key", "checkin-correct-0002")
        .send({
          command_ref: "checkin-correct-0002",
          energy: "LOW",
          expected_revision: 1,
          mood: "LOW",
          sleep: "LOW",
        }),
    ).expect(409);
    expect(stale.body.error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: { current: { revision: 2 }, current_revision: 2 },
    });
    expect(JSON.stringify(stale.body)).not.toMatch(
      /account|fingerprint|command/iu,
    );
  });

  it("lets only one of two concurrent client corrections win", async () => {
    const store = new HttpCheckinStore();
    const application = await testApplication(store);
    await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/checkin/submit")
        .set("Idempotency-Key", payload.command_ref)
        .send(payload),
    ).expect(200);

    const correction = (
      token: string,
      commandRef: string,
      mood: "LIGHT" | "LOW",
    ) =>
      authenticated(
        request(application.getHttpServer())
          .post("/v1/daily/checkin/correct")
          .set("Idempotency-Key", commandRef)
          .send({
            command_ref: commandRef,
            energy: mood === "LIGHT" ? "HIGH" : "LOW",
            expected_revision: 1,
            mood,
            sleep: mood === "LIGHT" ? "GOOD" : "LOW",
          }),
        token,
      );
    const responses = await Promise.all([
      correction(
        "c004_client_a_session_token_0001",
        "checkin-client-a-correct",
        "LIGHT",
      ),
      correction(
        "c004_client_b_session_token_0001",
        "checkin-client-b-correct",
        "LOW",
      ),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(store.current?.revision).toBe(2);
    const conflict = responses.find(({ status }) => status === 409);
    expect(conflict?.body.error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: { current_revision: 2 },
    });
  });

  it("blocks Safety before the ordinary write and logs no state values", async () => {
    const store = new HttpCheckinStore();
    store.guard = "SAFETY_BLOCKED";
    const events: OrdinaryLogEvent[] = [];
    const application = await testApplication(store, events);
    const response = await authenticated(
      request(application.getHttpServer())
        .post("/v1/daily/checkin/submit")
        .set("Idempotency-Key", payload.command_ref)
        .send(payload),
    ).expect(409);
    expect(response.body.error.code).toBe("SAFETY_BLOCKED");
    expect(store.current).toBeUndefined();
    const serialized = JSON.stringify(events);
    expect(serialized).not.toMatch(/GOOD|STEADY|OKAY|11111111/iu);
    expect(events.at(-1)?.operation_code).toBe("CHECKIN_SUBMIT");
  });
});

function sameValues(
  current: StoredCheckinView,
  input: Parameters<CheckinStore["submit"]>[0],
) {
  return (
    current.mood === input.mood &&
    current.energy === input.energy &&
    current.sleep === input.sleep
  );
}
