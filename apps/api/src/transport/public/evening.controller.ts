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
  EveningSaveRequestSchema,
  type EveningSaveRequest,
} from "@daily-energy/shared-schemas";
import type { Request } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import {
  EveningService,
  type EveningServiceResult,
} from "../../evening/evening.service.js";
import { ApiException } from "../common/api-exception.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionGuard, sessionPrincipalFromRequest } from "./session.guard.js";

@Controller("v1/evening")
@UseGuards(SessionGuard)
export class EveningController {
  public constructor(
    private readonly service: EveningService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Get("today")
  public async getToday(@Req() request: Request) {
    return this.#success(
      await this.service.getToday(sessionPrincipalFromRequest(request)),
    );
  }

  @Post("save")
  @HttpCode(HttpStatus.OK)
  public async save(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(EveningSaveRequestSchema))
    body: EveningSaveRequest,
  ) {
    if (idempotencyKey === undefined || idempotencyKey !== body.command_ref) {
      throw new ApiException({ code: "IDEMPOTENCY_CONFLICT" });
    }
    return this.#success(
      await this.service.save(sessionPrincipalFromRequest(request), body),
    );
  }

  #success(result: EveningServiceResult) {
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
