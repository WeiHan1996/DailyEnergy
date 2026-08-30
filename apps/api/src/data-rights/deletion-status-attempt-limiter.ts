import { createHmac, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { ApiTelemetry } from "../observability/api-telemetry.js";
import { ApiException } from "../transport/common/api-exception.js";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 12;
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  windowStartedAt: number;
}

@Injectable()
export class DeletionStatusAttemptLimiter {
  readonly #key = randomBytes(32);
  readonly #buckets = new Map<string, Bucket>();

  public constructor(private readonly telemetry: ApiTelemetry) {}

  public consume(sourceAddress: string | undefined, now = Date.now()): void {
    const key = createHmac("sha256", this.#key)
      .update(sourceAddress ?? "unknown", "utf8")
      .digest("base64url");
    const bucket = this.#buckets.get(key);
    if (bucket === undefined || now - bucket.windowStartedAt >= WINDOW_MS) {
      this.#trim(now);
      this.#buckets.set(key, { count: 1, windowStartedAt: now });
      this.#record("SUCCESS", "NONE");
      return;
    }
    if (bucket.count >= MAX_ATTEMPTS_PER_WINDOW) {
      this.#record("EXPECTED_REJECT", "RATE_LIMITED");
      throw new ApiException({
        code: "RATE_LIMITED",
        details: {
          retry_after_seconds: Math.max(
            1,
            Math.ceil((bucket.windowStartedAt + WINDOW_MS - now) / 1_000),
          ),
        },
      });
    }
    bucket.count += 1;
    this.#record("SUCCESS", "NONE");
  }

  #trim(now: number): void {
    for (const [key, bucket] of this.#buckets) {
      if (now - bucket.windowStartedAt >= WINDOW_MS) {
        this.#buckets.delete(key);
      }
    }
    if (this.#buckets.size >= MAX_BUCKETS) {
      const oldest = this.#buckets.keys().next().value as string | undefined;
      if (oldest !== undefined) {
        this.#buckets.delete(oldest);
      }
    }
  }

  #record(
    outcomeCode: "EXPECTED_REJECT" | "SUCCESS",
    reasonCode: "NONE" | "RATE_LIMITED",
  ): void {
    this.telemetry.record("dailyenergy_rate_limit_decisions_total", 1, {
      operationCode: "DATA_TASK_STEP",
      outcomeCode,
      reasonCode,
    });
  }
}
