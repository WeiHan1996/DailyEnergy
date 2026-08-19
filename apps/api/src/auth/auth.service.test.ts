import type {
  AuthSessionView,
  AuthStore,
  NewAccountMaterial,
  NewSessionMaterial,
  ProtectedExternalIdentity,
  SessionInspection,
} from "@daily-energy/server-adapters/api";
import { describe, expect, it } from "vitest";

import { ApiException } from "../transport/common/api-exception.js";
import { AuthService } from "./auth.service.js";
import {
  DevelopmentWechatCodeExchange,
  WechatExchangeError,
  type WechatCodeExchange,
} from "./contracts.js";

class InMemoryAuthStore implements AuthStore {
  readonly accounts = new Map<string, string>();
  readonly sessions = new Map<string, AuthSessionView & { revoked: boolean }>();
  #lock = Promise.resolve();

  public async establishSession(input: {
    readonly identity: ProtectedExternalIdentity;
    readonly newAccount: NewAccountMaterial;
    readonly now: Date;
    readonly session: NewSessionMaterial;
  }): Promise<SessionInspection> {
    return this.#serialized(async () => {
      const identityKey = `${input.identity.providerCode}:${input.identity.subjectLookupToken.toString("hex")}`;
      let accountId = this.accounts.get(identityKey);
      if (accountId === undefined) {
        accountId = `account-${this.accounts.size + 1}`;
        this.accounts.set(identityKey, accountId);
      }
      const view: AuthSessionView = {
        accountId,
        accountState: "ACTIVE",
        consentRequired: true,
        expiresAt: input.session.expiresAt,
        onboardingRequired: true,
        sessionId: `session-${this.sessions.size + 1}`,
      };
      this.sessions.set(input.session.tokenHash.toString("hex"), {
        ...view,
        revoked: false,
      });
      return { status: "ACTIVE", session: view };
    });
  }

  public async inspectSession(tokenHash: Buffer, now: Date): Promise<SessionInspection> {
    const session = this.sessions.get(tokenHash.toString("hex"));
    if (session === undefined) return { status: "INVALID" };
    if (session.revoked) return { status: "REVOKED" };
    if (session.expiresAt.getTime() <= now.getTime()) return { status: "EXPIRED" };
    return { status: "ACTIVE", session };
  }

  public async rotateSession(input: {
    readonly newSession: NewSessionMaterial;
    readonly now: Date;
    readonly sessionId: string;
  }): Promise<SessionInspection> {
    const current = [...this.sessions.values()].find(
      (session) => session.sessionId === input.sessionId,
    );
    if (current === undefined) return { status: "INVALID" };
    if (current.revoked) return { status: "REVOKED" };
    if (current.expiresAt.getTime() <= input.now.getTime()) return { status: "EXPIRED" };
    current.revoked = true;
    const view: AuthSessionView = {
      accountId: current.accountId,
      accountState: "ACTIVE",
      consentRequired: current.consentRequired,
      expiresAt: input.newSession.expiresAt,
      onboardingRequired: current.onboardingRequired,
      sessionId: `session-${this.sessions.size + 1}`,
    };
    this.sessions.set(input.newSession.tokenHash.toString("hex"), {
      ...view,
      revoked: false,
    });
    return { status: "ACTIVE", session: view };
  }

  public async revokeSession(tokenHash: Buffer, now: Date): Promise<boolean> {
    const session = this.sessions.get(tokenHash.toString("hex"));
    if (session === undefined || session.expiresAt.getTime() <= now.getTime()) {
      return false;
    }
    session.revoked = true;
    return true;
  }

  public async close(): Promise<void> {}

  async #serialized<T>(run: () => Promise<T>): Promise<T> {
    const previous = this.#lock;
    let release: () => void = () => undefined;
    this.#lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await run();
    } finally {
      release();
    }
  }
}

function codeExchangeFailure(
  reason: ConstructorParameters<typeof WechatExchangeError>[0],
): WechatCodeExchange {
  return {
    exchange: async () => {
      throw new WechatExchangeError(reason);
    },
  };
}

describe("C-001 auth service", () => {
  it("converges concurrent first logins for one synthetic WeChat subject to one account", async () => {
    const store = new InMemoryAuthStore();
    const service = new AuthService(store, new DevelopmentWechatCodeExchange("CI"));

    const [first, second] = await Promise.all([
      service.createWechatSession({ code: "dev:alice:code-a" }),
      service.createWechatSession({ code: "dev:alice:code-b" }),
    ]);

    expect(store.accounts.size).toBe(1);
    expect(first.session_token).not.toBe(second.session_token);
    expect(first).toMatchObject({
      account_state: "ACTIVE",
      consent_required: true,
      onboarding_required: true,
    });
    expect(JSON.stringify(first)).not.toMatch(/openid|unionid|ciphertext|subject/iu);
  });

  it("rejects replay of the same wx code without creating another account", async () => {
    const store = new InMemoryAuthStore();
    const service = new AuthService(store, new DevelopmentWechatCodeExchange("CI"));

    await service.createWechatSession({ code: "dev:alice:one-time" });
    await expect(
      service.createWechatSession({ code: "dev:alice:one-time" }),
    ).rejects.toMatchObject({ code: "AUTH_WECHAT_CODE_INVALID" });
    expect(store.accounts.size).toBe(1);
  });

  it("rotates and revokes sessions without accepting the old token", async () => {
    const store = new InMemoryAuthStore();
    const service = new AuthService(store, new DevelopmentWechatCodeExchange("CI"));
    const created = await service.createWechatSession({ code: "dev:bob:initial" });
    const resolved = await service.resolveAuthorization(`Bearer ${created.session_token}`);
    expect(resolved.status).toBe("ACTIVE");
    if (resolved.status !== "ACTIVE") throw new Error("expected active session");

    const refreshed = await service.refresh(resolved.principal);
    expect(refreshed.session_token).not.toBe(created.session_token);
    await expect(
      service.resolveAuthorization(`Bearer ${created.session_token}`),
    ).resolves.toEqual({ status: "INVALID" });

    await service.logout(`Bearer ${refreshed.session_token}`);
    await service.logout(`Bearer ${refreshed.session_token}`);
    await expect(
      service.resolveAuthorization(`Bearer ${refreshed.session_token}`),
    ).resolves.toEqual({ status: "INVALID" });
  });

  it("leaves no account fact when WeChat exchange fails before persistence", async () => {
    for (const reason of ["INVALID_CODE", "RATE_LIMITED", "UPSTREAM_UNAVAILABLE"] as const) {
      const store = new InMemoryAuthStore();
      const service = new AuthService(store, codeExchangeFailure(reason));
      await expect(
        service.createWechatSession({ code: "opaque-client-code" }),
      ).rejects.toBeInstanceOf(ApiException);
      expect(store.accounts.size).toBe(0);
      expect(store.sessions.size).toBe(0);
    }
  });

  it("forbids the synthetic WeChat adapter in release environments", () => {
    for (const environment of ["STAGING", "PRODUCTION", "RECOVERY"] as const) {
      expect(() => new DevelopmentWechatCodeExchange(environment)).toThrow(
        "DEVELOPMENT_WECHAT_ADAPTER_FORBIDDEN",
      );
    }
  });
});
