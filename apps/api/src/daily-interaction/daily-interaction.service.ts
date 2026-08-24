import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
  DailyInteractionGuardFailure,
  DailyInteractionQueryResult,
  DailyInteractionStore,
  DailyLightMutationResult,
  DailyTaskMutationResult,
} from "@daily-energy/server-adapters/api";
import type {
  DailyInteractionState,
  HistoryListView,
  LightDayRequest,
  TaskStateUpdateRequest,
} from "@daily-energy/shared-schemas";

import type { SessionPrincipal } from "../auth/contracts.js";
import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import {
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

export interface DailyInteractionServiceResult<
  View extends DailyInteractionState | HistoryListView = DailyInteractionState,
> {
  readonly resolution: ProductDateResolution;
  readonly view: View;
}

@Injectable()
export class DailyInteractionService {
  public constructor(
    @Inject(DAILY_INTERACTION_STORE)
    private readonly store: DailyInteractionStore,
    @Inject(PRODUCT_DATE_CLOCK) private readonly clock: ProductDateClock,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  public async getToday(
    principal: SessionPrincipal,
  ): Promise<DailyInteractionServiceResult> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.get({
        accountId: principal.accountId,
        productDate: resolution.productDate,
      }),
    );
    if (result.status !== "FOUND") {
      throw result.status === "NOT_FOUND"
        ? exception("RESOURCE_NOT_FOUND", resolution)
        : guardException(result.status, resolution);
    }
    return { resolution, view: result.value };
  }

  public async listHistory(
    principal: SessionPrincipal,
  ): Promise<DailyInteractionServiceResult<HistoryListView>> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.listHistory({
        accountId: principal.accountId,
        productDate: resolution.productDate,
      }),
    );
    if (result.status !== "FOUND") {
      throw guardException(result.status, resolution);
    }
    return { resolution, view: result.value };
  }

  public async lightDay(
    principal: SessionPrincipal,
    request: LightDayRequest,
  ): Promise<DailyInteractionServiceResult> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.lightDay({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        normalizedPayloadFingerprint: payloadFingerprint("ILLUMINATE", {
          product_date: request.product_date,
          result_ref: request.result_ref,
        }),
        now: resolution.now,
        productDate: request.product_date,
        productDatePolicyVersion: this.config.productDatePolicyVersion,
        resultRef: request.result_ref,
        sessionId: principal.sessionId,
      }),
    );
    return { resolution, view: lightMutationView(result, resolution) };
  }

  public async updateTask(
    principal: SessionPrincipal,
    request: TaskStateUpdateRequest,
  ): Promise<DailyInteractionServiceResult> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.updateTask({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        expectedRevision: request.expected_revision,
        normalizedPayloadFingerprint: payloadFingerprint("TASK_STATUS_SET", {
          expected_revision: request.expected_revision,
          product_date: request.product_date,
          status: request.status,
          task_ref: request.task_ref,
        }),
        now: resolution.now,
        productDate: request.product_date,
        productDatePolicyVersion: this.config.productDatePolicyVersion,
        sessionId: principal.sessionId,
        status: request.status,
        taskRef: request.task_ref,
      }),
    );
    return { resolution, view: mutationView(result, resolution) };
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

function mutationView(
  result: DailyTaskMutationResult,
  resolution: ProductDateResolution,
): DailyInteractionState {
  if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
    return result.value;
  }
  if (result.status === "REVISION_CONFLICT") {
    throw new ApiException({
      code: "REVISION_CONFLICT",
      details: {
        current: result.current,
        current_revision: result.current.task.revision,
      },
      productDate: resolution.productDate,
      serverNow: resolution.now,
    });
  }
  if (result.status === "NOT_FOUND") {
    throw exception("RESOURCE_NOT_FOUND", resolution);
  }
  if (result.status === "IDEMPOTENCY_CONFLICT") {
    throw exception("IDEMPOTENCY_CONFLICT", resolution);
  }
  if (
    result.status === "VIEW_CONTINUATION_EXPIRED" ||
    result.status === "WRITE_WINDOW_CLOSED"
  ) {
    throw exception(result.status, resolution);
  }
  throw guardException(result.status, resolution);
}

function lightMutationView(
  result: DailyLightMutationResult,
  resolution: ProductDateResolution,
): DailyInteractionState {
  if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
    return result.value;
  }
  if (result.status === "NOT_FOUND") {
    throw exception("RESOURCE_NOT_FOUND", resolution);
  }
  if (result.status === "IDEMPOTENCY_CONFLICT") {
    throw exception("IDEMPOTENCY_CONFLICT", resolution);
  }
  if (
    result.status === "VIEW_CONTINUATION_EXPIRED" ||
    result.status === "WRITE_WINDOW_CLOSED"
  ) {
    throw exception(result.status, resolution);
  }
  throw guardException(result.status, resolution);
}

function guardException(
  status: DailyInteractionGuardFailure,
  resolution: ProductDateResolution,
): ApiException {
  return exception(status, resolution);
}

function exception(
  code:
    | DailyInteractionGuardFailure
    | "IDEMPOTENCY_CONFLICT"
    | "RESOURCE_NOT_FOUND"
    | "VIEW_CONTINUATION_EXPIRED"
    | "WRITE_WINDOW_CLOSED",
  resolution: ProductDateResolution,
): ApiException {
  return new ApiException({
    code,
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}

function payloadFingerprint(
  operation: "ILLUMINATE" | "TASK_STATUS_SET",
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
