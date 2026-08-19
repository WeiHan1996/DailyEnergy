import { createHmac, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

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

  public consume(sourceAddress: string | undefined, now = Date.now()): void {
    const key = this.#ephemeralKey(sourceAddress ?? "unknown");
    const existing = this.#buckets.get(key);
    if (existing === undefined || now - existing.windowStartedAt >= WINDOW_MS) {
      this.#ensureCapacity(now);
      this.#buckets.set(key, { count: 1, windowStartedAt: now });
      return;
    }
    if (existing.count >= MAX_ATTEMPTS_PER_WINDOW) {
      throw new ApiException({ code: "RATE_LIMITED" });
    }
    existing.count += 1;
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
}
