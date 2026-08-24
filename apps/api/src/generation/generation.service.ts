import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
  DailyGenerationStore,
  DailyInteractionStore,
  GenerationGuardFailure,
  HistoryDayQueryResult,
  GenerationIntentQueryResult,
  GenerationStartResult,
  TodayQueryResult,
} from "@daily-energy/server-adapters/api";
import type {
  GenerationIntentView,
  GenerationStartRequest,
  HistoryDayView,
  TodayView,
} from "@daily-energy/shared-schemas";

import type { SessionPrincipal } from "../auth/contracts.js";
import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import {
  DAILY_GENERATION_STORE,
  DAILY_INTERACTION_STORE,
  PRODUCT_DATE_CLOCK,
  RUNTIME_CONFIG,
} from "../composition/tokens.js";
import {
  resolveProductDate,
  type ProductDateClock,
  type ProductDateResolution,
} from "../product-date/product-date.js";
import { ApiException } from "../transport/common/api-exception.js";

export interface GenerationServiceResult<T> {
  readonly resolution: ProductDateResolution;
  readonly view: T;
}

@Injectable()
export class GenerationService {
  public constructor(
    @Inject(DAILY_GENERATION_STORE)
    private readonly store: DailyGenerationStore,
    @Inject(DAILY_INTERACTION_STORE)
    private readonly interactionStore: DailyInteractionStore,
    @Inject(PRODUCT_DATE_CLOCK) private readonly clock: ProductDateClock,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  public async start(
    principal: SessionPrincipal,
    request: GenerationStartRequest,
  ): Promise<GenerationServiceResult<GenerationIntentView>> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.start({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        expectedCheckinRevision: request.expected_checkin_revision,
        normalizedPayloadFingerprint: payloadFingerprint({
          expected_checkin_revision: request.expected_checkin_revision,
        }),
        now: resolution.now,
        productDate: resolution.productDate,
        productDatePolicyVersion: this.config.productDatePolicyVersion,
      }),
    );
    return { resolution, view: startView(result, resolution) };
  }

  public async getIntent(
    principal: SessionPrincipal,
    intentRef: string,
  ): Promise<GenerationServiceResult<GenerationIntentView>> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.getIntent({
        accountId: principal.accountId,
        intentRef,
      }),
    );
    if (result.status !== "FOUND") {
      throw queryException(result.status, resolution);
    }
    return { resolution, view: result.value };
  }

  public async getByDate(
    principal: SessionPrincipal,
    productDate: string,
  ): Promise<GenerationServiceResult<HistoryDayView>> {
    const resolution = this.#resolve();
    if (productDate >= resolution.productDate) {
      throw exception("RESOURCE_NOT_FOUND", resolution);
    }
    const result = await this.#storeCall(() =>
      this.store.getByDate({
        accountId: principal.accountId,
        productDate,
      }),
    );
    if (result.status !== "FOUND") {
      throw historyException(result.status, resolution);
    }
    return { resolution, view: result.value };
  }

  public async getToday(
    principal: SessionPrincipal,
  ): Promise<GenerationServiceResult<TodayView>> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.getToday({
        accountId: principal.accountId,
        productDate: resolution.productDate,
      }),
    );
    if (result.status !== "FOUND") {
      throw todayException(result.status, resolution);
    }
    const opened = await this.#storeCall(() =>
      this.interactionStore.openToday({
        accountId: principal.accountId,
        openedAt: resolution.now,
        productDate: result.value.content.product_date,
        resultId: result.value.content.result_id,
        sessionId: principal.sessionId,
      }),
    );
    if (opened.status !== "RECORDED") {
      throw guardException(opened.status, resolution);
    }
    return { resolution, view: result.value };
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

function startView(
  result: GenerationStartResult,
  resolution: ProductDateResolution,
): GenerationIntentView {
  if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
    return result.value;
  }
  if (result.status === "REVISION_CONFLICT") {
    throw new ApiException({
      code: "REVISION_CONFLICT",
      details: {
        current_revision: result.currentCheckin.revision,
        current: result.currentCheckin,
      },
      productDate: resolution.productDate,
      serverNow: resolution.now,
    });
  }
  if (result.status === "IDEMPOTENCY_CONFLICT") {
    throw exception("IDEMPOTENCY_CONFLICT", resolution);
  }
  if (result.status === "MANIFEST_NOT_FOUND") {
    throw exception("GENERATION_FAILED_TERMINAL", resolution);
  }
  if (result.status === "CHECKIN_REQUIRED") {
    throw exception("STATE_PRECONDITION_FAILED", resolution);
  }
  throw guardException(result.status, resolution);
}

function queryException(
  status: Exclude<GenerationIntentQueryResult["status"], "FOUND">,
  resolution: ProductDateResolution,
): ApiException {
  return status === "NOT_FOUND"
    ? exception("RESOURCE_NOT_FOUND", resolution)
    : guardException(status, resolution);
}

function historyException(
  status: Exclude<HistoryDayQueryResult["status"], "FOUND">,
  resolution: ProductDateResolution,
): ApiException {
  return status === "NOT_FOUND"
    ? exception("RESOURCE_NOT_FOUND", resolution)
    : guardException(status, resolution);
}

function todayException(
  status: Exclude<TodayQueryResult["status"], "FOUND">,
  resolution: ProductDateResolution,
): ApiException {
  if (
    status === "GENERATION_PENDING" ||
    status === "GENERATION_FAILED_RETRYABLE"
  ) {
    return new ApiException({
      code: status,
      details: { retry_after_seconds: 2 },
      productDate: resolution.productDate,
      serverNow: resolution.now,
    });
  }
  if (status === "GENERATION_FAILED_TERMINAL") {
    return exception(status, resolution);
  }
  if (status === "NOT_FOUND") {
    return exception("RESOURCE_NOT_FOUND", resolution);
  }
  return guardException(status, resolution);
}

function guardException(
  status: GenerationGuardFailure,
  resolution: ProductDateResolution,
): ApiException {
  return exception(status, resolution);
}

function exception(
  code:
    | GenerationGuardFailure
    | "GENERATION_FAILED_RETRYABLE"
    | "GENERATION_FAILED_TERMINAL"
    | "GENERATION_PENDING"
    | "IDEMPOTENCY_CONFLICT"
    | "RESOURCE_NOT_FOUND"
    | "STATE_PRECONDITION_FAILED",
  resolution: ProductDateResolution,
): ApiException {
  return new ApiException({
    code,
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}

function payloadFingerprint(
  payload: Readonly<Record<string, unknown>>,
): Buffer {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operation: "GENERATION_START",
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
