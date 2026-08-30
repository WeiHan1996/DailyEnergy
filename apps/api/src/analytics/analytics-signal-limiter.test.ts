import { describe, expect, it } from "vitest";

import { ApiException } from "../transport/common/api-exception.js";
import { AnalyticsSignalLimiter } from "./analytics-signal-limiter.js";

describe("C-015 analytics signal limiter", () => {
  it("uses only an ephemeral source hash and returns a stable rate limit", () => {
    const limiter = new AnalyticsSignalLimiter();
    for (let index = 0; index < 120; index += 1) {
      limiter.consume("192.0.2.10", 1_000);
    }
    try {
      limiter.consume("192.0.2.10", 1_000);
      throw new Error("expected rate limit");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe("RATE_LIMITED");
    }
    expect(() => limiter.consume("192.0.2.11", 1_000)).not.toThrow();
    expect(() => limiter.consume("192.0.2.10", 61_001)).not.toThrow();
  });
});
