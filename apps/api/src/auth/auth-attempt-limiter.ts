import { createHmac, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { ApiTelemetry } from "../observability/api-telemetry.js";
import { ApiException } from "../transport/common/api-exception.js";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 8;
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  windowStartedAt: number;
}

@Injectable()
export class AuthAttemptLimiter {
  readonly #key = randomBytes(32);
  readonly #buckets = new Map<string, Bucket>();

  public constructor(private readonly telemetry: ApiTelemetry) {}

  public consume(sourceAddress: string | undefined, now = Date.now()): void {
    const key = this.#ephemeralKey(sourceAddress ?? "unknown");
    const existing = this.#buckets.get(key);
    if (existing === undefined || now - existing.windowStartedAt >= WINDOW_MS) {
      this.#ensureCapacity(now);
      this.#buckets.set(key, { count: 1, windowStartedAt: now });
      this.#record("SUCCESS", "NONE");
      return;
    }
    if (existing.count >= MAX_ATTEMPTS_PER_WINDOW) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.windowStartedAt + WINDOW_MS - now) / 1_000),
      );
      this.#record("EXPECTED_REJECT", "RATE_LIMITED");
      throw new ApiException({
        code: "RATE_LIMITED",
        details: { retry_after_seconds: retryAfterSeconds },
      });
    }
    existing.count += 1;
    this.#record("SUCCESS", "NONE");
  }

  #ephemeralKey(sourceAddress: string): string {
    return createHmac("sha256", this.#key)
      .update(sourceAddress, "utf8")
      .digest("base64url");
  }

  #ensureCapacity(now: number): void {
    if (this.#buckets.size < MAX_BUCKETS) {
      return;
    }
    for (const [key, bucket] of this.#buckets) {
      if (now - bucket.windowStartedAt >= WINDOW_MS) {
        this.#buckets.delete(key);
      }
    }
    if (this.#buckets.size >= MAX_BUCKETS) {
      const oldestKey = this.#buckets.keys().next().value as string | undefined;
      if (oldestKey !== undefined) {
        this.#buckets.delete(oldestKey);
      }
    }
  }

  #record(
    outcomeCode: "EXPECTED_REJECT" | "SUCCESS",
    reasonCode: "NONE" | "RATE_LIMITED",
  ): void {
    this.telemetry.record("dailyenergy_rate_limit_decisions_total", 1, {
      operationCode: "PUBLIC_WECHAT_SESSION_PLACEHOLDER",
      outcomeCode,
      reasonCode,
    });
  }
}
