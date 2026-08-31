import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
  CheckinMutationResult,
  CheckinQueryResult,
  CheckinStore,
  StoredCheckinView,
} from "@daily-energy/server-adapters/api";
import type {
  CheckinCorrectRequest,
  CheckinSubmitRequest,
  CheckinView,
} from "@daily-energy/shared-schemas";

import type { SessionPrincipal } from "../auth/contracts.js";
import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import {
  CHECKIN_STORE,
  PRODUCT_DATE_CLOCK,
  RUNTIME_CONFIG,
} from "../composition/tokens.js";
import {
  resolveProductDate,
  type ProductDateClock,
  type ProductDateResolution,
} from "../product-date/product-date.js";
import { ApiException } from "../transport/common/api-exception.js";

export interface CheckinServiceResult {
  readonly resolution: CheckinResponseResolution;
  readonly view: CheckinView;
}

interface CheckinResponseResolution {
  readonly now: Date;
  readonly productDate: string;
}

interface CheckinAcceptance extends CheckinResponseResolution {
  readonly productDatePolicyVersion: string;
}

@Injectable()
export class CheckinService {
  public constructor(
    @Inject(CHECKIN_STORE) private readonly store: CheckinStore,
    @Inject(PRODUCT_DATE_CLOCK) private readonly clock: ProductDateClock,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  public async getToday(
    principal: SessionPrincipal,
  ): Promise<CheckinServiceResult> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.getToday({
        accountId: principal.accountId,
        productDate: resolution.productDate,
      }),
    );
    if (result.status !== "FOUND") {
      throw result.status === "NOT_FOUND"
        ? exceptionWithResolution("RESOURCE_NOT_FOUND", resolution)
        : guardException(result.status, resolution);
    }
    return { resolution, view: checkinView(result.value) };
  }

  public async submit(
    principal: SessionPrincipal,
    request: CheckinSubmitRequest,
  ): Promise<CheckinServiceResult> {
    const result = await this.#storeCall(() =>
      this.store.submit({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        energy: request.energy,
        mood: request.mood,
        normalizedPayloadFingerprint: payloadFingerprint("CHECKIN_SUBMIT", {
          energy: request.energy,
          expected_revision: request.expected_revision,
          mood: request.mood,
          sleep: request.sleep,
        }),
        resolveAcceptance: () => this.#resolveAcceptance(),
        sleep: request.sleep,
      }),
    );
    const resolution = this.#mutationResolution(result);
    return { resolution, view: mutationView(result, resolution) };
  }

  public async correct(
    principal: SessionPrincipal,
    request: CheckinCorrectRequest,
  ): Promise<CheckinServiceResult> {
    const result = await this.#storeCall(() =>
      this.store.correct({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        energy: request.energy,
        expectedRevision: request.expected_revision,
        mood: request.mood,
        normalizedPayloadFingerprint: payloadFingerprint("CHECKIN_CORRECT", {
          energy: request.energy,
          expected_revision: request.expected_revision,
          mood: request.mood,
          sleep: request.sleep,
        }),
        resolveAcceptance: () => this.#resolveAcceptance(),
        sleep: request.sleep,
      }),
    );
    const resolution = this.#mutationResolution(result);
    return { resolution, view: mutationView(result, resolution) };
  }

  #resolveAcceptance(): CheckinAcceptance {
    const resolution = this.#resolve();
    return {
      now: resolution.now,
      productDate: resolution.productDate,
      productDatePolicyVersion: this.config.productDatePolicyVersion,
    };
  }

  #mutationResolution(
    result: CheckinMutationResult,
  ): CheckinResponseResolution {
    const current = this.#resolve();
    const productDate =
      result.status === "ACCEPTED" || result.status === "DUPLICATE"
        ? result.value.productDate
        : result.status === "CHECKIN_ALREADY_EXISTS" ||
            result.status === "REVISION_CONFLICT"
          ? result.current.productDate
          : current.productDate;
    return { now: current.now, productDate };
  }

  #resolve(): ProductDateResolution {
    try {
      return resolveProductDate(this.clock.now());
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }

  async #storeCall<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }
}

function checkinView(value: StoredCheckinView): CheckinView {
  return {
    checkin_ref: value.checkinRef,
    energy: value.energy,
    mood: value.mood,
    product_date: value.productDate,
    revision: value.revision,
    sleep: value.sleep,
    updated_at: value.updatedAt.toISOString(),
    write_window: "OPEN",
  };
}

function mutationView(
  result: CheckinMutationResult,
  resolution: CheckinResponseResolution,
): CheckinView {
  if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
    return checkinView(result.value);
  }
  if (result.status === "REVISION_CONFLICT") {
    const current = checkinView(result.current);
    throw new ApiException({
      code: "REVISION_CONFLICT",
      details: { current, current_revision: current.revision },
      productDate: resolution.productDate,
      serverNow: resolution.now,
    });
  }
  if (result.status === "CHECKIN_ALREADY_EXISTS") {
    throw exceptionWithResolution("CHECKIN_ALREADY_EXISTS", resolution);
  }
  if (result.status === "NOT_FOUND") {
    throw exceptionWithResolution("RESOURCE_NOT_FOUND", resolution);
  }
  if (result.status === "IDEMPOTENCY_CONFLICT") {
    throw exceptionWithResolution("IDEMPOTENCY_CONFLICT", resolution);
  }
  throw guardException(result.status, resolution);
}

function guardException(
  status: Exclude<CheckinQueryResult["status"], "FOUND" | "NOT_FOUND">,
  resolution: CheckinResponseResolution,
): ApiException {
  return exceptionWithResolution(status, resolution);
}

function exceptionWithResolution(
  code:
    | "ACCOUNT_DELETED"
    | "ACCOUNT_DELETING"
    | "ACCOUNT_RESTRICTED"
    | "CHECKIN_ALREADY_EXISTS"
    | "CONSENT_REQUIRED"
    | "IDEMPOTENCY_CONFLICT"
    | "ONBOARDING_REQUIRED"
    | "RESOURCE_NOT_FOUND"
    | "SAFETY_BLOCKED"
    | "STATE_PRECONDITION_FAILED",
  resolution: CheckinResponseResolution,
): ApiException {
  return new ApiException({
    code,
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}

function payloadFingerprint(
  operation: string,
  payload: Readonly<Record<string, unknown>>,
): Buffer {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operation,
        payload: Object.fromEntries(
          Object.entries(payload).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
      }),
      "utf8",
    )
    .digest();
}
