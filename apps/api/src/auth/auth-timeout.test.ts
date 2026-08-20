import type {
  AuthSessionView,
  AuthStore,
  NewAccountMaterial,
  NewSessionMaterial,
  ProtectedExternalIdentity,
  SessionInspection,
} from "@daily-energy/server-adapters/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.js";
import type { WechatCodeExchange } from "./contracts.js";

class EmptyStore implements AuthStore {
  public writes = 0;

  public async establishSession(_input: {
    readonly identity: ProtectedExternalIdentity;
    readonly newAccount: NewAccountMaterial;
    readonly now: Date;
    readonly session: NewSessionMaterial;
  }): Promise<SessionInspection> {
    this.writes += 1;
    const session: AuthSessionView = {
      accountId: "unexpected",
      accountState: "ACTIVE",
      consentRequired: true,
      expiresAt: new Date(Date.now() + 60_000),
      onboardingRequired: true,
      sessionId: "unexpected",
    };
    return { status: "ACTIVE", session };
  }
  public async inspectSession(): Promise<SessionInspection> {
    return { status: "INVALID" };
  }
  public async rotateSession(): Promise<SessionInspection> {
    return { status: "INVALID" };
  }
  public async revokeSession(): Promise<"INVALID"> {
    return "INVALID";
  }
  public async close(): Promise<void> {}
}

afterEach(() => {
  vi.useRealTimers();
});

describe("C-001 WeChat provider timeout", () => {
  it("fails with a retryable transient error before any persistence starts", async () => {
    vi.useFakeTimers();
    const store = new EmptyStore();
    const exchange: WechatCodeExchange = {
      exchange: () => new Promise(() => undefined),
    };
    const service = new AuthService(store, exchange);

    const request = expect(
      service.createWechatSession({ code: "opaque-timeout-code" }),
    ).rejects.toMatchObject({
      code: "UPSTREAM_TRANSIENT",
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(3_000);
    await request;
    expect(store.writes).toBe(0);
  });
});
