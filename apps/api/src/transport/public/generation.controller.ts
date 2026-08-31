import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  GenerationStartRequestSchema,
  ProductDateSchema,
  type GenerationStartRequest,
} from "@daily-energy/shared-schemas";
import type { Request } from "express";
import { z } from "zod";

import {
  GenerationService,
  type GenerationServiceResult,
} from "../../generation/generation.service.js";
import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import { ApiException } from "../common/api-exception.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionGuard, sessionPrincipalFromRequest } from "./session.guard.js";

@Controller("v1")
@UseGuards(SessionGuard)
export class GenerationController {
  public constructor(
    private readonly service: GenerationService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Post("daily/generation/start")
  @HttpCode(HttpStatus.OK)
  public async start(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(GenerationStartRequestSchema))
    body: GenerationStartRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.start(sessionPrincipalFromRequest(request), body),
    );
  }

  @Get("daily/generation/:intent_ref")
  public async getIntent(
    @Req() request: Request,
    @Param("intent_ref", new ZodValidationPipe(z.string().uuid()))
    intentRef: string,
  ) {
    return this.#success(
      await this.service.getIntent(
        sessionPrincipalFromRequest(request),
        intentRef,
      ),
    );
  }

  @Get("daily/today")
  public async getToday(@Req() request: Request) {
    return this.#success(
      await this.service.getToday(sessionPrincipalFromRequest(request)),
    );
  }

  @Get("daily/by-date/:product_date")
  public async getByDate(
    @Req() request: Request,
    @Param("product_date", new ZodValidationPipe(ProductDateSchema))
    productDate: string,
  ) {
    return this.#success(
      await this.service.getByDate(
        sessionPrincipalFromRequest(request),
        productDate,
      ),
    );
  }

  #success<T>(result: GenerationServiceResult<T>) {
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
