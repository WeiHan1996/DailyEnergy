import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
  AuthSessionView,
  AuthStore,
  NewSessionMaterial,
  ProtectedExternalIdentity,
} from "@daily-energy/server-adapters/api";
import {
  DEVELOPMENT_SUBJECT_KEY_VERSION,
  developmentSubjectLookupToken,
  protectDevelopmentSubject,
} from "@daily-energy/server-adapters/api";
import type { WechatSessionRequest } from "@daily-energy/shared-schemas";

import { AUTH_STORE, WECHAT_CODE_EXCHANGE } from "../composition/tokens.js";
import { ApiException } from "../transport/common/api-exception.js";
import {
  bearerToken,
  sessionTokenHash,
  type SessionPrincipal,
  type SessionResolution,
  type SessionResolver,
  type WechatCodeExchange,
  WechatExchangeError,
} from "./contracts.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const SESSION_REFRESH_AFTER_MS = 15 * 24 * 60 * 60 * 1_000;
const WECHAT_EXCHANGE_TIMEOUT_MS = 3_000;

export interface SessionResponse {
  readonly account_state: "ACTIVE";
  readonly consent_required: boolean;
  readonly expires_at: string;
  readonly onboarding_required: boolean;
  readonly refresh_after: string;
  readonly session_token: string;
}

export interface LogoutCommand {
  readonly clientContext?: {
    readonly app_version?: string | undefined;
    readonly scene?: string | undefined;
  };
  readonly commandRef: string;
}

export type LogoutOutcome = "ACCEPTED" | "DUPLICATE";

@Injectable()
export class AuthService implements SessionResolver {
  public constructor(
    @Inject(AUTH_STORE) private readonly store: AuthStore,
    @Inject(WECHAT_CODE_EXCHANGE)
    private readonly wechat: WechatCodeExchange,
  ) {}

  public async createWechatSession(
    request: WechatSessionRequest,
  ): Promise<SessionResponse> {
    const identity = await this.#exchangeWechatCode(request.code);
    const now = new Date();
    const token = newSessionToken();
    const session = sessionMaterial(token, now);
    const result = await this.#storeCall(() =>
      this.store.establishSession({
        identity: protectIdentity(identity.providerCode, identity.subject),
        newAccount: {
          ownerScopeToken: randomBytes(32),
          stableSubjectCiphertext: protectDevelopmentSubject(
            `stable:${randomUUID()}`,
          ),
          stableSubjectKeyVersion: DEVELOPMENT_SUBJECT_KEY_VERSION,
        },
        now,
        session,
      }),
    );
    if (result.status !== "ACTIVE") {
      throw new ApiException({ code: "AUTH_INVALID" });
    }
    return sessionResponse(token, now, result.session);
  }

  public async refresh(principal: SessionPrincipal): Promise<SessionResponse> {
    const now = new Date();
    const token = newSessionToken();
    const newSession = sessionMaterial(token, now);
    const result = await this.#storeCall(() =>
      this.store.rotateSession({
        newSession,
        now,
        sessionId: principal.sessionId,
      }),
    );
    if (result.status === "EXPIRED") {
      throw new ApiException({ code: "AUTH_SESSION_EXPIRED" });
    }
    if (result.status !== "ACTIVE") {
      throw new ApiException({ code: "AUTH_INVALID" });
    }
    return sessionResponse(token, now, result.session);
  }

  public async logout(
    authorization: string | undefined,
    command: LogoutCommand,
  ): Promise<LogoutOutcome> {
    const token = bearerToken(authorization);
    if (token === undefined) {
      throw new ApiException({ code: "AUTH_REQUIRED" });
    }
    const revoked = await this.#storeCall(() =>
      this.store.revokeSession({
        commandRef: command.commandRef,
        normalizedPayloadFingerprint: logoutPayloadFingerprint(command),
        now: new Date(),
        tokenHash: sessionTokenHash(token),
      }),
    );
    if (revoked === "CONFLICT") {
      throw new ApiException({ code: "IDEMPOTENCY_CONFLICT" });
    }
    if (revoked === "EXPIRED") {
      throw new ApiException({ code: "AUTH_SESSION_EXPIRED" });
    }
    if (revoked === "INVALID") {
      throw new ApiException({ code: "AUTH_INVALID" });
    }
    return revoked;
  }

  public async resolveAuthorization(
    authorization: string | undefined,
  ): Promise<SessionResolution> {
    const token = bearerToken(authorization);
    if (token === undefined) {
      return {
        status: authorization === undefined ? "MISSING" : "INVALID",
      };
    }
    const inspected = await this.#storeCall(() =>
      this.store.inspectSession(sessionTokenHash(token), new Date()),
    );
    if (inspected.status === "EXPIRED") {
      return { status: "EXPIRED" };
    }
    if (inspected.status !== "ACTIVE") {
      return { status: "INVALID" };
    }
    return {
      status: "ACTIVE",
      principal: {
        accountId: inspected.session.accountId,
        accountState: "ACTIVE",
        expiresAt: inspected.session.expiresAt,
        sessionId: inspected.session.sessionId,
      },
    };
  }

  async #exchangeWechatCode(code: string) {
    try {
      return await withTimeout(
        this.wechat.exchange(code),
        WECHAT_EXCHANGE_TIMEOUT_MS,
      );
    } catch (error) {
      if (error instanceof WechatExchangeError) {
        if (error.reason === "INVALID_CODE") {
          throw new ApiException({ code: "AUTH_WECHAT_CODE_INVALID" });
        }
        if (error.reason === "RATE_LIMITED") {
          throw new ApiException({ code: "RATE_LIMITED" });
        }
        throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
      }
      if (error instanceof ExchangeTimeoutError) {
        throw new ApiException({ code: "UPSTREAM_TRANSIENT" });
      }
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }

  async #storeCall<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }
}

function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function sessionMaterial(token: string, now: Date): NewSessionMaterial {
  return {
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    issuedAt: now,
    tokenHash: sessionTokenHash(token),
  };
}

function logoutPayloadFingerprint(command: LogoutCommand): Buffer {
  const context = command.clientContext;
  const normalizedContext =
    context === undefined ||
    (context.app_version === undefined && context.scene === undefined)
      ? null
      : {
          app_version: context.app_version ?? null,
          scene: context.scene ?? null,
        };
  return createHash("sha256")
    .update(
      JSON.stringify({
        client_context: normalizedContext,
        operation: "SESSION_LOGOUT",
      }),
      "utf8",
    )
    .digest();
}

function sessionResponse(
  token: string,
  issuedAt: Date,
  session: AuthSessionView,
): SessionResponse {
  return {
    account_state: "ACTIVE",
    consent_required: session.consentRequired,
    expires_at: session.expiresAt.toISOString(),
    onboarding_required: session.onboardingRequired,
    refresh_after: new Date(
      Math.min(
        issuedAt.getTime() + SESSION_REFRESH_AFTER_MS,
        session.expiresAt.getTime(),
      ),
    ).toISOString(),
    session_token: token,
  };
}

function protectIdentity(
  providerCode: "WECHAT_MINIAPP",
  subject: string,
): ProtectedExternalIdentity {
  return {
    keyVersion: DEVELOPMENT_SUBJECT_KEY_VERSION,
    providerCode,
    subjectCiphertext: protectDevelopmentSubject(subject),
    subjectLookupToken: developmentSubjectLookupToken(providerCode, subject),
  };
}

class ExchangeTimeoutError extends Error {}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ExchangeTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
