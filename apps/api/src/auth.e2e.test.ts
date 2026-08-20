import type { INestApplication } from "@nestjs/common";
import type {
  AuthSessionView,
  AuthStore,
  NewAccountMaterial,
  NewSessionMaterial,
  ProtectedExternalIdentity,
  SessionInspection,
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

interface MutableSession extends AuthSessionView {
  expired: boolean;
  revoked: boolean;
}

class HttpAuthStore implements AuthStore {
  readonly #accounts = new Map<string, string>();
  readonly #logoutReceipts = new Map<
    string,
    { fingerprint: Buffer; sessionId: string }
  >();
  readonly #sessions = new Map<string, MutableSession>();

  public async establishSession(input: {
    readonly identity: ProtectedExternalIdentity;
    readonly newAccount: NewAccountMaterial;
    readonly now: Date;
    readonly session: NewSessionMaterial;
  }): Promise<SessionInspection> {
    const key = input.identity.subjectLookupToken.toString("hex");
    let accountId = this.#accounts.get(key);
    if (accountId === undefined) {
      accountId = `account-${this.#accounts.size + 1}`;
      this.#accounts.set(key, accountId);
    }
    const view: MutableSession = {
      accountId,
      accountState: "ACTIVE",
      consentRequired: true,
      expired: false,
      expiresAt: input.session.expiresAt,
      onboardingRequired: true,
      revoked: false,
      sessionId: `session-${this.#sessions.size + 1}`,
    };
    this.#sessions.set(input.session.tokenHash.toString("hex"), view);
    return { status: "ACTIVE", session: view };
  }

  public async inspectSession(
    tokenHash: Buffer,
    now: Date,
  ): Promise<SessionInspection> {
    const session = this.#sessions.get(tokenHash.toString("hex"));
    if (session === undefined) {
      return { status: "INVALID" };
    }
    if (session.revoked) {
      return { status: "REVOKED" };
    }
    if (session.expired || session.expiresAt.getTime() <= now.getTime()) {
      return { status: "EXPIRED" };
    }
    return { status: "ACTIVE", session };
  }

  public async rotateSession(input: {
    readonly newSession: NewSessionMaterial;
    readonly now: Date;
    readonly sessionId: string;
  }): Promise<SessionInspection> {
    const current = [...this.#sessions.values()].find(
      (session) => session.sessionId === input.sessionId,
    );
    if (current === undefined) {
      return { status: "INVALID" };
    }
    if (current.revoked) {
      return { status: "REVOKED" };
    }
    if (current.expired || current.expiresAt.getTime() <= input.now.getTime()) {
      return { status: "EXPIRED" };
    }
    current.revoked = true;
    const view: MutableSession = {
      accountId: current.accountId,
      accountState: "ACTIVE",
      consentRequired: current.consentRequired,
      expired: false,
      expiresAt: input.newSession.expiresAt,
      onboardingRequired: current.onboardingRequired,
      revoked: false,
      sessionId: `session-${this.#sessions.size + 1}`,
    };
    this.#sessions.set(input.newSession.tokenHash.toString("hex"), view);
    return { status: "ACTIVE", session: view };
  }

  public async revokeSession(input: Parameters<AuthStore["revokeSession"]>[0]) {
    const session = this.#sessions.get(input.tokenHash.toString("hex"));
    if (
      session === undefined ||
      session.expired ||
      session.expiresAt.getTime() <= input.now.getTime()
    ) {
      return "INVALID" as const;
    }
    const receipt = this.#logoutReceipts.get(input.commandRef);
    if (receipt !== undefined) {
      return receipt.sessionId === session.sessionId &&
        receipt.fingerprint.equals(input.normalizedPayloadFingerprint)
        ? ("DUPLICATE" as const)
        : ("CONFLICT" as const);
    }
    if (session.revoked) {
      return "INVALID" as const;
    }
    this.#logoutReceipts.set(input.commandRef, {
      fingerprint: input.normalizedPayloadFingerprint,
      sessionId: session.sessionId,
    });
    session.revoked = true;
    return "ACCEPTED" as const;
  }

  public expireAll(): void {
    for (const session of this.#sessions.values()) {
      session.expired = true;
    }
  }

  public async close(): Promise<void> {}
}

function environment(): NodeJS.ProcessEnv {
  return {
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_ENVIRONMENT: "CI",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "c001-e2e-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  };
}

const apps: INestApplication[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup(store = new HttpAuthStore()) {
  const app = await createApiApplication(loadRuntimeConfig(environment()), {
    authStore: store,
    ordinaryLogSink: { write: () => undefined },
  });
  await app.listen(0, "127.0.0.1");
  apps.push(app);
  return { app, store };
}

describe("C-001 auth HTTP E2E", () => {
  it("creates a closed session view, rotates it, and never exposes WeChat identity fields", async () => {
    const { app } = await setup();
    const server = app.getHttpServer();
    const login = await request(server)
      .post("/v1/auth/wechat/session")
      .send({ code: "dev:alice:first" })
      .expect(200);

    expect(login.body).toMatchObject({
      ok: true,
      data: {
        account_state: "ACTIVE",
        consent_required: true,
        onboarding_required: true,
      },
    });
    expect(login.body.data.session_token).toEqual(expect.any(String));
    expect(JSON.stringify(login.body)).not.toMatch(
      /openid|unionid|subject|ciphertext|lookup|account_id/iu,
    );

    const oldToken = login.body.data.session_token as string;
    const refreshed = await request(server)
      .post("/v1/auth/session/refresh")
      .set("Authorization", `Bearer ${oldToken}`)
      .expect(200);
    const newToken = refreshed.body.data.session_token as string;
    expect(newToken).not.toBe(oldToken);

    await request(server)
      .post("/v1/auth/session/refresh")
      .set("Authorization", `Bearer ${oldToken}`)
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("AUTH_INVALID");
      });
    await request(server)
      .post("/v1/auth/session/refresh")
      .set("Authorization", `Bearer ${newToken}`)
      .expect(200);
  });

  it("returns stable invalid-code and rate-limit semantics and rejects client owner fields", async () => {
    const { app } = await setup();
    const server = app.getHttpServer();

    await request(server)
      .post("/v1/auth/wechat/session")
      .send({ code: "not-a-dev-code" })
      .expect(400)
      .expect((response) => {
        expect(response.body.error).toMatchObject({
          category: "AUTH",
          code: "AUTH_WECHAT_CODE_INVALID",
          retryable: false,
        });
      });
    await request(server)
      .post("/v1/auth/wechat/session")
      .send({ code: "rate-limited:synthetic" })
      .expect(429)
      .expect((response) => {
        expect(response.body.error.code).toBe("RATE_LIMITED");
      });
    await request(server)
      .post("/v1/auth/wechat/session")
      .send({ code: "dev:alice:owner-forgery", account_id: "other-account" })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("VALIDATION_FAILED");
      });
  });

  it("limits the trusted forwarded client address without throttling another client", async () => {
    const { app } = await setup();
    const server = app.getHttpServer();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await request(server)
        .post("/v1/auth/wechat/session")
        .set("X-Forwarded-For", "203.0.113.10")
        .send({ code: `invalid-code-${attempt}` })
        .expect(400);
    }
    await request(server)
      .post("/v1/auth/wechat/session")
      .set("X-Forwarded-For", "203.0.113.10")
      .send({ code: "invalid-code-blocked" })
      .expect(429)
      .expect("Retry-After", /\d+/u)
      .expect((response) => {
        expect(response.body.error).toMatchObject({
          code: "RATE_LIMITED",
          details: { retry_after_seconds: expect.any(Number) },
        });
      });
    await request(server)
      .post("/v1/auth/wechat/session")
      .set("X-Forwarded-For", "203.0.113.11")
      .send({ code: "invalid-code-other-client" })
      .expect(400);
  });

  it("fails refresh closed after expiry and after idempotent logout", async () => {
    const { app, store } = await setup();
    const server = app.getHttpServer();
    const first = await request(server)
      .post("/v1/auth/wechat/session")
      .send({ code: "dev:bob:expiry" })
      .expect(200);
    const expiredToken = first.body.data.session_token as string;
    store.expireAll();
    await request(server)
      .post("/v1/auth/session/refresh")
      .set("Authorization", `Bearer ${expiredToken}`)
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("AUTH_SESSION_EXPIRED");
      });

    const second = await request(server)
      .post("/v1/auth/wechat/session")
      .send({ code: "dev:bob:logout" })
      .expect(200);
    const token = second.body.data.session_token as string;
    const command = "logout-command-0001";
    await request(server)
      .post("/v1/auth/session/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", command)
      .send({ command_ref: command })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.outcome).toBe("ACCEPTED");
      });
    await request(server)
      .post("/v1/auth/session/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", command)
      .send({ command_ref: command })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.outcome).toBe("DUPLICATE");
      });
    await request(server)
      .post("/v1/auth/session/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", command)
      .send({
        client_context: { scene: "different-payload" },
        command_ref: command,
      })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      });
    await request(server)
      .post("/v1/auth/session/refresh")
      .set("Authorization", `Bearer ${token}`)
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("AUTH_INVALID");
      });
  });
});
