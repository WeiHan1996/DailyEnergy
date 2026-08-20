import { createHash } from "node:crypto";

import type { AuthStore } from "@daily-energy/server-adapters/api";

import type { RuntimeEnvironment } from "../bootstrap/runtime-config.js";

export interface WechatIdentity {
  readonly providerCode: "WECHAT_MINIAPP";
  readonly subject: string;
}

export type WechatExchangeFailure =
  "INVALID_CODE" | "RATE_LIMITED" | "UPSTREAM_UNAVAILABLE";

export class WechatExchangeError extends Error {
  public constructor(public readonly reason: WechatExchangeFailure) {
    super(reason);
    this.name = "WechatExchangeError";
  }
}

export interface WechatCodeExchange {
  exchange(code: string): Promise<WechatIdentity>;
}

export interface SessionPrincipal {
  readonly accountId: string;
  readonly accountState: "ACTIVE";
  readonly expiresAt: Date;
  readonly sessionId: string;
}

export type SessionResolution =
  | { readonly status: "MISSING" | "INVALID" | "EXPIRED" }
  | { readonly status: "ACTIVE"; readonly principal: SessionPrincipal };

export interface SessionResolver {
  resolveAuthorization(
    authorization: string | undefined,
  ): Promise<SessionResolution>;
}

export interface AuthDependencies {
  readonly authStore: AuthStore;
  readonly wechatCodeExchange: WechatCodeExchange;
}

export class DevelopmentWechatCodeExchange implements WechatCodeExchange {
  readonly #usedCodes = new Set<string>();

  public constructor(environment: RuntimeEnvironment) {
    if (!["LOCAL", "CI", "DEV"].includes(environment)) {
      throw new Error("DEVELOPMENT_WECHAT_ADAPTER_FORBIDDEN");
    }
  }

  public async exchange(code: string): Promise<WechatIdentity> {
    if (code.startsWith("unavailable:")) {
      throw new WechatExchangeError("UPSTREAM_UNAVAILABLE");
    }
    if (code.startsWith("rate-limited:")) {
      throw new WechatExchangeError("RATE_LIMITED");
    }
    const match = /^dev:([A-Za-z0-9._-]{1,96}):([A-Za-z0-9._-]{1,96})$/u.exec(
      code,
    );
    if (match === null || this.#usedCodes.has(code)) {
      throw new WechatExchangeError("INVALID_CODE");
    }
    this.#usedCodes.add(code);
    return {
      providerCode: "WECHAT_MINIAPP",
      subject: `synthetic:${match[1]}`,
    };
  }
}

export const UNAVAILABLE_WECHAT_CODE_EXCHANGE: WechatCodeExchange = {
  exchange: async () => {
    throw new WechatExchangeError("UPSTREAM_UNAVAILABLE");
  },
};

export const UNAVAILABLE_AUTH_STORE: AuthStore = {
  establishSession: async () => {
    throw new Error("AUTH_STORE_UNAVAILABLE");
  },
  inspectSession: async () => ({ status: "INVALID" }),
  rotateSession: async () => {
    throw new Error("AUTH_STORE_UNAVAILABLE");
  },
  revokeSession: async () => "INVALID",
  close: async () => undefined,
};

export function bearerToken(
  authorization: string | undefined,
): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }
  const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/u.exec(authorization);
  return match?.[1];
}

export function sessionTokenHash(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}
