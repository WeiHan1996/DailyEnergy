import {
  parseGatewayBreakerSnapshotV1,
  type GatewayBreakerSnapshotV1,
} from "@daily-energy/server-core/ai-gateway";
import type { GatewayBreakerStateStoreV1 } from "@daily-energy/server-core/ai-gateway/spi";
import { Redis } from "ioredis";

const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local expected_revision = ARGV[1]
local expected_fingerprint = ARGV[2]
if expected_revision == 'missing' then
  if current then return 0 end
else
  if not current then return 0 end
  local ok, decoded = pcall(cjson.decode, current)
  if not ok or tostring(decoded.revision) ~= expected_revision or decoded.routeFingerprint ~= expected_fingerprint then return 0 end
end
redis.call('SET', KEYS[1], ARGV[3], 'PX', ARGV[4])
return 1
`;

export class RedisGatewayBreakerStoreV1 implements GatewayBreakerStateStoreV1 {
  readonly #prefix: string;
  readonly #redis: Redis;
  #closed = false;

  private constructor(redis: Redis, prefix: string) {
    this.#redis = redis;
    this.#prefix = prefix;
  }

  public static async connect(input: {
    readonly keyPrefix: string;
    readonly redisUrl: string;
  }): Promise<RedisGatewayBreakerStoreV1> {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(input.keyPrefix)) {
      throw new Error("GATEWAY_BREAKER_CONFIG_INVALID");
    }
    let url: URL;
    try {
      url = new URL(input.redisUrl);
    } catch {
      throw new Error("GATEWAY_BREAKER_CONFIG_INVALID");
    }
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      throw new Error("GATEWAY_BREAKER_CONFIG_INVALID");
    }
    const redis = new Redis(input.redisUrl, {
      connectionName: "daily-energy:gateway-breaker",
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    try {
      await redis.connect();
      const version = /^redis_version:([^\r\n]+)/mu.exec(
        await redis.info("server"),
      )?.[1];
      if (!version || Number.parseInt(version, 10) !== 8) {
        throw new Error("GATEWAY_BREAKER_REDIS_VERSION_MISMATCH");
      }
      return new RedisGatewayBreakerStoreV1(redis, input.keyPrefix);
    } catch {
      redis.disconnect(false);
      throw new Error("GATEWAY_BREAKER_STORE_UNAVAILABLE");
    }
  }

  public async load(key: string): Promise<GatewayBreakerSnapshotV1 | null> {
    this.#assertOpen();
    assertKey(key);
    try {
      const value = await this.#redis.get(this.#key(key));
      if (value === null) {
        return null;
      }
      return parseGatewayBreakerSnapshotV1(JSON.parse(value));
    } catch {
      throw new Error("GATEWAY_BREAKER_STORE_UNAVAILABLE");
    }
  }

  public async compareAndSet(input: {
    readonly expectedRevision: number | null;
    readonly expectedRouteFingerprint: string | null;
    readonly key: string;
    readonly next: GatewayBreakerSnapshotV1;
    readonly ttlMs: number;
  }): Promise<boolean> {
    this.#assertOpen();
    assertKey(input.key);
    if (
      (input.expectedRevision === null) !==
        (input.expectedRouteFingerprint === null) ||
      (input.expectedRevision !== null &&
        (!Number.isSafeInteger(input.expectedRevision) ||
          input.expectedRevision < 0))
    ) {
      throw new Error("GATEWAY_BREAKER_CAS_EXPECTATION_INVALID");
    }
    if (input.expectedRouteFingerprint !== null) {
      assertKey(input.expectedRouteFingerprint);
    }
    const next = parseGatewayBreakerSnapshotV1(input.next);
    if (
      !Number.isSafeInteger(input.ttlMs) ||
      input.ttlMs < 60_000 ||
      input.ttlMs > 7 * 24 * 60 * 60_000
    ) {
      throw new Error("GATEWAY_BREAKER_TTL_INVALID");
    }
    try {
      const result = await this.#redis.eval(
        CAS_SCRIPT,
        1,
        this.#key(input.key),
        input.expectedRevision === null
          ? "missing"
          : String(input.expectedRevision),
        input.expectedRouteFingerprint ?? "missing",
        JSON.stringify(next),
        String(input.ttlMs),
      );
      return Number(result) === 1;
    } catch {
      throw new Error("GATEWAY_BREAKER_STORE_UNAVAILABLE");
    }
  }

  public async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#redis.quit().catch(() => this.#redis.disconnect(false));
    }
  }

  #key(key: string): string {
    return `${this.#prefix}:gateway-breaker:${key}`;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("GATEWAY_BREAKER_STORE_CLOSED");
    }
  }
}

function assertKey(value: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error("GATEWAY_BREAKER_KEY_INVALID");
  }
}
