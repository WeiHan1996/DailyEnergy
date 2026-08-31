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
  CheckinCorrectRequestSchema,
  CheckinSubmitRequestSchema,
  type CheckinCorrectRequest,
  type CheckinSubmitRequest,
} from "@daily-energy/shared-schemas";
import type { Request } from "express";

import {
  CheckinService,
  type CheckinServiceResult,
} from "../../checkin/checkin.service.js";
import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import { ApiException } from "../common/api-exception.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionGuard, sessionPrincipalFromRequest } from "./session.guard.js";

@Controller("v1")
@UseGuards(SessionGuard)
export class CheckinController {
  public constructor(
    private readonly service: CheckinService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Get("daily/today/checkin")
  public async getToday(@Req() request: Request) {
    return this.#success(
      await this.service.getToday(sessionPrincipalFromRequest(request)),
    );
  }

  @Post("daily/checkin/submit")
  @HttpCode(HttpStatus.OK)
  public async submit(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(CheckinSubmitRequestSchema))
    body: CheckinSubmitRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.submit(sessionPrincipalFromRequest(request), body),
    );
  }

  @Post("daily/checkin/correct")
  @HttpCode(HttpStatus.OK)
  public async correct(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(CheckinCorrectRequestSchema))
    body: CheckinCorrectRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.correct(sessionPrincipalFromRequest(request), body),
    );
  }

  #success(result: CheckinServiceResult) {
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
