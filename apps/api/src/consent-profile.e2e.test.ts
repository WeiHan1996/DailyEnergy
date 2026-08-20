import type { INestApplication } from "@nestjs/common";
import type {
  AuthSessionView,
  AuthStore,
  ConsentProfileStore,
  NewAccountMaterial,
  NewSessionMaterial,
  ProtectedExternalIdentity,
  SessionInspection,
  StoreMutation,
  StoredConsentView,
  StoredMemoryPreferencesView,
  StoredNotificationSettingsView,
  StoredProfileView,
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
  revoked: boolean;
}

class HttpAuthStore implements AuthStore {
  readonly #accounts = new Map<string, string>();
  readonly #sessions = new Map<string, MutableSession>();
  #nextAccount = 1;
  #nextSession = 1;

  public async establishSession(input: {
    readonly identity: ProtectedExternalIdentity;
    readonly newAccount: NewAccountMaterial;
    readonly now: Date;
    readonly session: NewSessionMaterial;
  }): Promise<SessionInspection> {
    const identityKey = input.identity.subjectLookupToken.toString("hex");
    let accountId = this.#accounts.get(identityKey);
    if (accountId === undefined) {
      accountId = uuid(this.#nextAccount++);
      this.#accounts.set(identityKey, accountId);
    }
    const session: MutableSession = {
      accountId,
      accountState: "ACTIVE",
      consentRequired: true,
      expiresAt: input.session.expiresAt,
      onboardingRequired: true,
      revoked: false,
      sessionId: uuid(10_000 + this.#nextSession++),
    };
    this.#sessions.set(input.session.tokenHash.toString("hex"), session);
    return { session, status: "ACTIVE" };
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
    if (session.expiresAt.getTime() <= now.getTime()) {
      return { status: "EXPIRED" };
    }
    return { session, status: "ACTIVE" };
  }

  public async rotateSession(input: {
    readonly newSession: NewSessionMaterial;
    readonly now: Date;
    readonly sessionId: string;
  }): Promise<SessionInspection> {
    const current = [...this.#sessions.values()].find(
      (session) => session.sessionId === input.sessionId,
    );
    if (current === undefined || current.revoked) {
      return { status: "INVALID" };
    }
    current.revoked = true;
    const session: MutableSession = {
      ...current,
      expiresAt: input.newSession.expiresAt,
      revoked: false,
      sessionId: uuid(10_000 + this.#nextSession++),
    };
    this.#sessions.set(input.newSession.tokenHash.toString("hex"), session);
    return { session, status: "ACTIVE" };
  }

  public async revokeSession(): Promise<"ACCEPTED"> {
    return "ACCEPTED";
  }

  public async close(): Promise<void> {}
}

interface AccountState {
  consent: StoredConsentView;
  memory?: StoredMemoryPreferencesView;
  notifications?: StoredNotificationSettingsView;
  profile?: StoredProfileView;
}

class HttpConsentProfileStore implements ConsentProfileStore {
  readonly #accounts = new Map<string, AccountState>();
  readonly #receipts = new Map<
    string,
    { fingerprint: Buffer; operation: string }
  >();

  #account(accountId: string): AccountState {
    let state = this.#accounts.get(accountId);
    if (state === undefined) {
      state = {
        consent: {
          noticeVersion: "necessary-consent-v1",
          state: "MISSING",
        },
      };
      this.#accounts.set(accountId, state);
    }
    return state;
  }

  #claim(
    accountId: string,
    commandRef: string,
    fingerprint: Buffer,
    operation: string,
  ): "NEW" | "DUPLICATE" | "CONFLICT" {
    const key = `${accountId}:${commandRef}`;
    const current = this.#receipts.get(key);
    if (current === undefined) {
      this.#receipts.set(key, { fingerprint, operation });
      return "NEW";
    }
    return current.operation === operation &&
      current.fingerprint.equals(fingerprint)
      ? "DUPLICATE"
      : "CONFLICT";
  }

  public async getConsent(accountId: string): Promise<StoredConsentView> {
    return this.#account(accountId).consent;
  }

  public async acceptConsent(
    input: Parameters<ConsentProfileStore["acceptConsent"]>[0],
  ): Promise<StoreMutation<StoredConsentView>> {
    const claim = this.#claim(
      input.accountId,
      input.commandRef,
      input.normalizedPayloadFingerprint,
      "CONSENT_ACCEPT",
    );
    if (claim === "CONFLICT") {
      return { status: "IDEMPOTENCY_CONFLICT" };
    }
    const account = this.#account(input.accountId);
    if (claim === "NEW") {
      account.consent = {
        acceptedAt: input.now,
        noticeVersion: input.noticeVersion,
        state: "ACCEPTED",
      };
    }
    return {
      status: claim === "NEW" ? "ACCEPTED" : "DUPLICATE",
      value: account.consent,
    };
  }

  public async withdrawConsent(
    input: Parameters<ConsentProfileStore["withdrawConsent"]>[0],
  ): Promise<StoreMutation<StoredConsentView>> {
    const claim = this.#claim(
      input.accountId,
      input.commandRef,
      input.normalizedPayloadFingerprint,
      "CONSENT_WITHDRAW",
    );
    if (claim === "CONFLICT") {
      return { status: "IDEMPOTENCY_CONFLICT" };
    }
    const account = this.#account(input.accountId);
    if (claim === "NEW" && account.consent.state === "ACCEPTED") {
      account.consent = { ...account.consent, state: "WITHDRAWN" };
    }
    return {
      status: claim === "NEW" ? "ACCEPTED" : "DUPLICATE",
      value: account.consent,
    };
  }

  public async completeOnboarding(
    input: Parameters<ConsentProfileStore["completeOnboarding"]>[0],
  ): Promise<StoreMutation<StoredProfileView>> {
    const account = this.#account(input.accountId);
    if (account.consent.state !== "ACCEPTED") {
      return { status: "CONSENT_REQUIRED" };
    }
    const claim = this.#claim(
      input.accountId,
      input.commandRef,
      input.normalizedPayloadFingerprint,
      "ONBOARDING_COMPLETE",
    );
    if (claim === "CONFLICT") {
      return { status: "IDEMPOTENCY_CONFLICT" };
    }
    account.profile ??= {
      expressionStyle: input.expressionStyle,
      onboardingCompleted: true,
      ...(input.preferredName === undefined
        ? {}
        : { preferredName: input.preferredName }),
      revision: 1,
      updatedAt: input.now,
    };
    account.memory ??= {
      dailyUseEnabled: false,
      masterEnabled: false,
      revision: 1,
      updatedAt: input.now,
      weeklyUseEnabled: false,
    };
    account.notifications ??= {
      eveningEnabled: false,
      morningEnabled: false,
      observedPermission: "UNKNOWN",
      revision: 1,
      updatedAt: input.now,
    };
    return {
      status: claim === "NEW" ? "ACCEPTED" : "DUPLICATE",
      value: account.profile,
    };
  }

  public async getProfile(accountId: string) {
    return this.#account(accountId).profile;
  }

  public async updateProfile(
    input: Parameters<ConsentProfileStore["updateProfile"]>[0],
  ): Promise<StoreMutation<StoredProfileView>> {
    const account = this.#account(input.accountId);
    if (account.consent.state !== "ACCEPTED") {
      return { status: "CONSENT_REQUIRED" };
    }
    if (account.profile === undefined) {
      return { status: "ONBOARDING_REQUIRED" };
    }
    const receiptKey = `${input.accountId}:${input.commandRef}`;
    const existing = this.#receipts.get(receiptKey);
    if (existing !== undefined) {
      return existing.operation === input.operationCode &&
        existing.fingerprint.equals(input.normalizedPayloadFingerprint)
        ? { status: "DUPLICATE", value: account.profile }
        : { status: "IDEMPOTENCY_CONFLICT" };
    }
    if (account.profile.revision !== input.expectedRevision) {
      return { current: account.profile, status: "REVISION_CONFLICT" };
    }
    this.#receipts.set(receiptKey, {
      fingerprint: input.normalizedPayloadFingerprint,
      operation: input.operationCode,
    });
    const { preferredName: _preferredName, ...profileWithoutName } =
      account.profile;
    const nextProfile: StoredProfileView = {
      ...(input.preferredName === null ? profileWithoutName : account.profile),
      expressionStyle: input.expressionStyle ?? account.profile.expressionStyle,
      ...(input.preferredName === undefined
        ? {}
        : input.preferredName === null
          ? {}
          : { preferredName: input.preferredName }),
      revision: account.profile.revision + 1,
      updatedAt: input.now,
    };
    account.profile = nextProfile;
    return { status: "ACCEPTED", value: nextProfile };
  }

  public async getMemoryPreferences(accountId: string) {
    return this.#account(accountId).memory;
  }

  public async updateMemoryPreferences(
    input: Parameters<ConsentProfileStore["updateMemoryPreferences"]>[0],
  ): Promise<StoreMutation<StoredMemoryPreferencesView>> {
    const account = this.#account(input.accountId);
    if (input.requiresConsent && account.consent.state !== "ACCEPTED") {
      return { status: "CONSENT_REQUIRED" };
    }
    if (account.memory === undefined) {
      return { status: "ONBOARDING_REQUIRED" };
    }
    if (account.memory.revision !== input.expectedRevision) {
      return { current: account.memory, status: "REVISION_CONFLICT" };
    }
    account.memory = {
      dailyUseEnabled: input.dailyUseEnabled,
      masterEnabled: input.masterEnabled,
      revision: account.memory.revision + 1,
      updatedAt: input.now,
      weeklyUseEnabled: input.weeklyUseEnabled,
    };
    return { status: "ACCEPTED", value: account.memory };
  }

  public async getNotificationSettings(accountId: string) {
    return this.#account(accountId).notifications;
  }

  public async updateNotificationSettings(
    input: Parameters<ConsentProfileStore["updateNotificationSettings"]>[0],
  ): Promise<StoreMutation<StoredNotificationSettingsView>> {
    const account = this.#account(input.accountId);
    if (input.requiresConsent && account.consent.state !== "ACCEPTED") {
      return { status: "CONSENT_REQUIRED" };
    }
    if (account.notifications === undefined) {
      return { status: "ONBOARDING_REQUIRED" };
    }
    if (account.notifications.revision !== input.expectedRevision) {
      return {
        current: account.notifications,
        status: "REVISION_CONFLICT",
      };
    }
    account.notifications = {
      ...account.notifications,
      eveningEnabled: input.eveningEnabled,
      morningEnabled: input.morningEnabled,
      revision: account.notifications.revision + 1,
      updatedAt: input.now,
    };
    return { status: "ACCEPTED", value: account.notifications };
  }

  public async syncNotificationPermission(
    input: Parameters<ConsentProfileStore["syncNotificationPermission"]>[0],
  ): Promise<StoreMutation<StoredNotificationSettingsView>> {
    const account = this.#account(input.accountId);
    if (account.consent.state !== "ACCEPTED") {
      return { status: "CONSENT_REQUIRED" };
    }
    if (account.notifications === undefined) {
      return { status: "ONBOARDING_REQUIRED" };
    }
    account.notifications = {
      ...account.notifications,
      observedPermission: input.observedPermission,
      updatedAt: input.observedAt,
    };
    return { status: "ACCEPTED", value: account.notifications };
  }

  public async close(): Promise<void> {}
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
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
    DAILYENERGY_RELEASE_ID: "c002-e2e-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  };
}

const apps: INestApplication[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const app = await createApiApplication(loadRuntimeConfig(environment()), {
    authStore: new HttpAuthStore(),
    consentProfileStore: new HttpConsentProfileStore(),
    ordinaryLogSink: { write: () => undefined },
  });
  apps.push(app);
  return app;
}

async function login(app: INestApplication, subject: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/v1/auth/wechat/session")
    .send({ code: `dev:${subject}:c002` })
    .expect(200);
  return response.body.data.session_token as string;
}

describe("C-002 consent/profile HTTP E2E", () => {
  it("runs consent and optional-name onboarding without accepting owner injection", async () => {
    const app = await setup();
    const server = app.getHttpServer();
    const token = await login(app, "alice");

    await request(server)
      .get("/v1/consent/current")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual({
          notice_version: "necessary-consent-v1",
          state: "MISSING",
        });
      });

    await request(server)
      .post("/v1/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "01JONBOARDING0000000000001")
      .send({
        command_ref: "01JONBOARDING0000000000001",
        expression_style: "BALANCED",
      })
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("CONSENT_REQUIRED");
      });

    const consentCommand = "01JCONSENT0000000000000001";
    await request(server)
      .post("/v1/consent/accept")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", consentCommand)
      .send({
        command_ref: consentCommand,
        notice_version: "necessary-consent-v1",
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.outcome).toBe("ACCEPTED");
      });
    await request(server)
      .post("/v1/consent/accept")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", consentCommand)
      .send({
        command_ref: consentCommand,
        notice_version: "necessary-consent-v1",
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.outcome).toBe("DUPLICATE");
      });
    await request(server)
      .post("/v1/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", consentCommand)
      .send({ command_ref: consentCommand, expression_style: "BALANCED" })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      });

    const onboardingCommand = "01JONBOARDING0000000000002";
    await request(server)
      .post("/v1/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", onboardingCommand)
      .send({
        account_id: "forged-owner",
        command_ref: onboardingCommand,
        expression_style: "GENTLE",
      })
      .expect(400);
    await request(server)
      .post("/v1/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", onboardingCommand)
      .send({ command_ref: onboardingCommand, expression_style: "GENTLE" })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          expression_style: "GENTLE",
          onboarding_completed: true,
          revision: 1,
        });
        expect(response.body.data.preferred_name).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toMatch(
          /account_id|ciphertext|key_version|provider/iu,
        );
      });
  });

  it("allows only one profile CAS winner and returns the latest allowlisted view", async () => {
    const app = await setup();
    const server = app.getHttpServer();
    const token = await login(app, "alice-cas");
    const headers = { Authorization: `Bearer ${token}` };

    await request(server)
      .post("/v1/consent/accept")
      .set(headers)
      .set("Idempotency-Key", "01JCONSENTCAS0000000000001")
      .send({
        command_ref: "01JCONSENTCAS0000000000001",
        notice_version: "necessary-consent-v1",
      })
      .expect(200);
    await request(server)
      .post("/v1/onboarding/complete")
      .set(headers)
      .set("Idempotency-Key", "01JONBOARDCAS000000000001")
      .send({
        command_ref: "01JONBOARDCAS000000000001",
        expression_style: "BALANCED",
      })
      .expect(200);

    const responses = await Promise.all([
      request(server)
        .post("/v1/profile/update")
        .set(headers)
        .set("Idempotency-Key", "01JPROFILECAS0000000000001")
        .send({
          command_ref: "01JPROFILECAS0000000000001",
          expected_revision: 1,
          expression_style: "GENTLE",
        }),
      request(server)
        .post("/v1/profile/update")
        .set(headers)
        .set("Idempotency-Key", "01JPROFILECAS0000000000002")
        .send({
          command_ref: "01JPROFILECAS0000000000002",
          expected_revision: 1,
          expression_style: "CLEAR_DIRECT",
        }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const conflict = responses.find((response) => response.status === 409);
    expect(conflict?.body.error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: { current: { revision: 2 }, current_revision: 2 },
    });
  });

  it("keeps preferences off when permission is granted and blocks new writes after withdrawal", async () => {
    const app = await setup();
    const server = app.getHttpServer();
    const token = await login(app, "alice-withdraw");
    const headers = { Authorization: `Bearer ${token}` };

    await request(server)
      .post("/v1/consent/accept")
      .set(headers)
      .set("Idempotency-Key", "01JCONSENTWITHDRAW00000001")
      .send({
        command_ref: "01JCONSENTWITHDRAW00000001",
        notice_version: "necessary-consent-v1",
      })
      .expect(200);
    await request(server)
      .post("/v1/onboarding/complete")
      .set(headers)
      .set("Idempotency-Key", "01JONBOARDWITHDRAW0000001")
      .send({
        command_ref: "01JONBOARDWITHDRAW0000001",
        expression_style: "BALANCED",
      })
      .expect(200);

    await request(server)
      .post("/v1/notifications/permission-sync")
      .set(headers)
      .set("Idempotency-Key", "01JPERMISSIONSYNC0000000001")
      .send({
        command_ref: "01JPERMISSIONSYNC0000000001",
        observed_at: "2026-08-20T12:00:00.000Z",
        observed_permission: "GRANTED",
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          evening_enabled: false,
          morning_enabled: false,
          observed_permission: "GRANTED",
        });
      });

    await request(server)
      .post("/v1/consent/withdraw")
      .set(headers)
      .set("Idempotency-Key", "01JCONSENTWITHDRAW00000002")
      .send({
        command_ref: "01JCONSENTWITHDRAW00000002",
        notice_version: "necessary-consent-v1",
      })
      .expect(200);

    await request(server)
      .post("/v1/notifications/permission-sync")
      .set(headers)
      .set("Idempotency-Key", "01JPERMISSIONAFTERWITHDRAW1")
      .send({
        command_ref: "01JPERMISSIONAFTERWITHDRAW1",
        observed_at: "2026-08-20T12:01:00.000Z",
        observed_permission: "REVOKED",
      })
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("CONSENT_REQUIRED");
      });

    await request(server)
      .post("/v1/profile/update")
      .set(headers)
      .set("Idempotency-Key", "01JPROFILEAFTERWITHDRAW001")
      .send({
        command_ref: "01JPROFILEAFTERWITHDRAW001",
        expected_revision: 1,
        expression_style: "GENTLE",
      })
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("CONSENT_REQUIRED");
      });

    await request(server)
      .post("/v1/notifications/settings")
      .set(headers)
      .set("Idempotency-Key", "01JNOTIFYAFTERWITHDRAW0001")
      .send({
        command_ref: "01JNOTIFYAFTERWITHDRAW0001",
        evening_enabled: true,
        expected_revision: 1,
        morning_enabled: true,
      })
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("CONSENT_REQUIRED");
      });
  });

  it("does not expose another session owner's profile", async () => {
    const app = await setup();
    const server = app.getHttpServer();
    const alice = await login(app, "alice-owner");
    const bob = await login(app, "bob-owner");

    await request(server)
      .post("/v1/consent/accept")
      .set("Authorization", `Bearer ${alice}`)
      .set("Idempotency-Key", "01JALICECONSENT00000000001")
      .send({
        command_ref: "01JALICECONSENT00000000001",
        notice_version: "necessary-consent-v1",
      })
      .expect(200);
    await request(server)
      .post("/v1/onboarding/complete")
      .set("Authorization", `Bearer ${alice}`)
      .set("Idempotency-Key", "01JALICEONBOARD0000000001")
      .send({
        command_ref: "01JALICEONBOARD0000000001",
        expression_style: "BALANCED",
        preferred_name: "Alice",
      })
      .expect(200);

    await request(server)
      .get("/v1/profile")
      .set("Authorization", `Bearer ${bob}`)
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("ONBOARDING_REQUIRED");
        expect(JSON.stringify(response.body)).not.toContain("Alice");
      });
  });
});
