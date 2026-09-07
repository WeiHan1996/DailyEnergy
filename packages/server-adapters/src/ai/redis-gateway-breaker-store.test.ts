import { describe, expect, it } from "vitest";

import { RedisGatewayBreakerStoreV1 } from "./redis-gateway-breaker-store.js";

describe("AI-002 Redis breaker configuration boundary", () => {
  it.each([
    { keyPrefix: "UPPERCASE", redisUrl: "redis://127.0.0.1:6379" },
    { keyPrefix: "ai002", redisUrl: "not-a-url" },
    { keyPrefix: "ai002", redisUrl: "https://127.0.0.1:6379" },
  ])("rejects malformed configuration before connecting: %o", async (input) => {
    await expect(
      RedisGatewayBreakerStoreV1.connect(input),
    ).rejects.toThrowError("GATEWAY_BREAKER_CONFIG_INVALID");
  });
});
