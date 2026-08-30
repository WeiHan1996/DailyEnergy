import { createHmac, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { ApiException } from "../transport/common/api-exception.js";

const WINDOW_MS = 60_000;
const MAX_SIGNALS_PER_WINDOW = 120;
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  windowStartedAt: number;
}

@Injectable()
export class AnalyticsSignalLimiter {
  readonly #key = randomBytes(32);
  readonly #buckets = new Map<string, Bucket>();

  public consume(sourceAddress: string | undefined, now = Date.now()): void {
    const key = createHmac("sha256", this.#key)
      .update(sourceAddress ?? "unknown", "utf8")
      .digest("base64url");
    const current = this.#buckets.get(key);
    if (current === undefined || now - current.windowStartedAt >= WINDOW_MS) {
      this.#ensureCapacity(now);
      this.#buckets.set(key, { count: 1, windowStartedAt: now });
      return;
    }
    if (current.count >= MAX_SIGNALS_PER_WINDOW) {
      throw new ApiException({
        code: "RATE_LIMITED",
        details: {
          retry_after_seconds: Math.max(
            1,
            Math.ceil((current.windowStartedAt + WINDOW_MS - now) / 1_000),
          ),
        },
      });
    }
    current.count += 1;
  }

  #ensureCapacity(now: number): void {
    for (const [key, bucket] of this.#buckets) {
      if (now - bucket.windowStartedAt >= WINDOW_MS) {
        this.#buckets.delete(key);
      }
    }
    if (this.#buckets.size >= MAX_BUCKETS) {
      const first = this.#buckets.keys().next().value as string | undefined;
      if (first !== undefined) {
        this.#buckets.delete(first);
      }
    }
  }
}
