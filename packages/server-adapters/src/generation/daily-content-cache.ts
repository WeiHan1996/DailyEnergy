import { createHash } from "node:crypto";

import { Redis } from "ioredis";

import {
  ClientDailyContentViewSchema,
  type ClientDailyContentView,
} from "@daily-energy/shared-schemas";

export interface DailyContentCacheIdentity {
  readonly accountId: string;
  readonly projectionVersion: "daily-content-view-v1";
  readonly resultFingerprintHex: string;
  readonly resultId: string;
  readonly sourceFingerprintHex: string;
  readonly visibilityRevision: number;
}

export interface DailyContentCache {
  close(): Promise<void>;
  get(
    identity: DailyContentCacheIdentity,
  ): Promise<ClientDailyContentView | undefined>;
  set(
    identity: DailyContentCacheIdentity,
    value: ClientDailyContentView,
  ): Promise<void>;
}

export const UNAVAILABLE_DAILY_CONTENT_CACHE: DailyContentCache = Object.freeze(
  {
    async close() {},
    async get() {
      return undefined;
    },
    async set() {},
  },
);

export class RedisDailyContentCache implements DailyContentCache {
  readonly #keyPrefix: string;
  readonly #redis: Redis;
  #closed = false;

  private constructor(redis: Redis, keyPrefix: string) {
    this.#redis = redis;
    this.#keyPrefix = keyPrefix;
  }

  public static async connect(input: {
    readonly keyPrefix: string;
    readonly redisUrl: string;
  }): Promise<RedisDailyContentCache> {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(input.keyPrefix)) {
      throw new Error("DAILY_CONTENT_CACHE_PREFIX_INVALID");
    }
    const redis = new Redis(input.redisUrl, {
      connectionName: "daily-energy:api:daily-content-cache",
      enableOfflineQueue: false,
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    try {
      await redis.connect();
      const info = await redis.info("server");
      const version = /^redis_version:([^\r\n]+)/mu.exec(info)?.[1];
      if (!version || Number.parseInt(version, 10) !== 8) {
        throw new Error("REDIS_VERSION_MISMATCH");
      }
      return new RedisDailyContentCache(redis, input.keyPrefix);
    } catch {
      redis.disconnect(false);
      throw new Error("DAILY_CONTENT_CACHE_UNAVAILABLE");
    }
  }

  public async get(
    identity: DailyContentCacheIdentity,
  ): Promise<ClientDailyContentView | undefined> {
    if (this.#closed) {
      return undefined;
    }
    const key = cacheKey(this.#keyPrefix, identity);
    try {
      const value = await this.#redis.get(key);
      if (value === null) {
        return undefined;
      }
      const parsed = ClientDailyContentViewSchema.safeParse(JSON.parse(value));
      if (!parsed.success) {
        await this.#redis.del(key).catch(() => undefined);
        return undefined;
      }
      return parsed.data;
    } catch {
      return undefined;
    }
  }

  public async set(
    identity: DailyContentCacheIdentity,
    value: ClientDailyContentView,
  ): Promise<void> {
    if (this.#closed) {
      return;
    }
    const parsed = ClientDailyContentViewSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error("DAILY_CONTENT_CACHE_VALUE_INVALID");
    }
    await this.#redis
      .set(
        cacheKey(this.#keyPrefix, identity),
        JSON.stringify(parsed.data),
        "EX",
        24 * 60 * 60,
      )
      .catch(() => undefined);
  }

  public async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#redis.quit().catch(() => this.#redis.disconnect(false));
  }
}

function cacheKey(prefix: string, identity: DailyContentCacheIdentity): string {
  if (
    !/^[a-f0-9]{64}$/u.test(identity.resultFingerprintHex) ||
    !/^[a-f0-9]{64}$/u.test(identity.sourceFingerprintHex) ||
    !Number.isSafeInteger(identity.visibilityRevision) ||
    identity.visibilityRevision < 1
  ) {
    throw new Error("DAILY_CONTENT_CACHE_IDENTITY_INVALID");
  }
  const ownerToken = createHash("sha256")
    .update(identity.accountId, "utf8")
    .digest("hex")
    .slice(0, 24);
  return [
    prefix,
    "daily-content",
    ownerToken,
    identity.resultId,
    identity.projectionVersion,
    `v${identity.visibilityRevision}`,
    identity.resultFingerprintHex,
    identity.sourceFingerprintHex,
  ].join(":");
}
