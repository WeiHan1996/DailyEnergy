import { describe, expect, it } from "vitest";

import { ApiException } from "../transport/common/api-exception.js";
import { AuthAttemptLimiter } from "./auth-attempt-limiter.js";

describe("C-001 auth attempt limiter", () => {
  it("bounds login exchange attempts per ephemeral source and resets after the short window", () => {
    const limiter = new AuthAttemptLimiter();
    const startedAt = 1_000_000;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(() => limiter.consume("127.0.0.1", startedAt)).not.toThrow();
    }
    try {
      limiter.consume("127.0.0.1", startedAt);
      throw new Error("expected rate limit");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({ code: "RATE_LIMITED" });
    }
    expect(() => limiter.consume("127.0.0.2", startedAt)).not.toThrow();
    expect(() => limiter.consume("127.0.0.1", startedAt + 60_000)).not.toThrow();
  });
});
