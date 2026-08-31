import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  LightDayRequestSchema,
  TaskStateUpdateRequestSchema,
  type DailyInteractionState,
  type HistoryListView,
  type LightDayRequest,
  type TaskStateUpdateRequest,
} from "@daily-energy/shared-schemas";
import type { Request } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import {
  DailyInteractionService,
  type DailyInteractionServiceResult,
} from "../../daily-interaction/daily-interaction.service.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import { ApiException } from "../common/api-exception.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionGuard, sessionPrincipalFromRequest } from "./session.guard.js";

@Controller("v1")
@UseGuards(SessionGuard)
export class DailyInteractionController {
  public constructor(
    private readonly service: DailyInteractionService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Get("daily/interaction")
  public async getToday(@Req() request: Request) {
    return this.#success(
      await this.service.getToday(sessionPrincipalFromRequest(request)),
    );
  }

  @Get("history/days")
  public async listHistory(@Req() request: Request) {
    return this.#success(
      await this.service.listHistory(sessionPrincipalFromRequest(request)),
    );
  }

  @Post("daily/interaction/light")
  @HttpCode(HttpStatus.OK)
  public async lightDay(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(LightDayRequestSchema)) body: LightDayRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.lightDay(sessionPrincipalFromRequest(request), body),
    );
  }

  @Post("daily/interaction/task")
  @HttpCode(HttpStatus.OK)
  public async updateTask(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(TaskStateUpdateRequestSchema))
    body: TaskStateUpdateRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.updateTask(sessionPrincipalFromRequest(request), body),
    );
  }

  #success<View extends DailyInteractionState | HistoryListView>(
    result: DailyInteractionServiceResult<View>,
  ) {
    return {
      data: result.view,
      ok: true as const,
      product_date: result.resolution.productDate,
      product_date_policy_version: this.config.productDatePolicyVersion,
      request_id: this.contextStore.get().requestId,
      server_now: result.resolution.now.toISOString(),
    };
  }
}

function assertIdempotencyKey(
  idempotencyKey: string | undefined,
  commandRef: string,
): void {
  if (idempotencyKey === undefined || idempotencyKey !== commandRef) {
    throw new ApiException({ code: "IDEMPOTENCY_CONFLICT" });
  }
}
