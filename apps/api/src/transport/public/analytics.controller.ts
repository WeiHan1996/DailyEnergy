import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from "@nestjs/common";
import {
  ClientAnalyticsSignalRequestSchema,
  type ClientAnalyticsSignalRequest,
} from "@daily-energy/shared-schemas";
import type { Request } from "express";

import { AnalyticsSignalLimiter } from "../../analytics/analytics-signal-limiter.js";
import { AnalyticsService } from "../../analytics/analytics.service.js";
import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";

@Controller("v1/analytics")
export class AnalyticsController {
  public constructor(
    private readonly service: AnalyticsService,
    private readonly limiter: AnalyticsSignalLimiter,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Post("signals")
  @HttpCode(HttpStatus.ACCEPTED)
  public async submit(
    @Req() request: Request,
    @Body(new ZodValidationPipe(ClientAnalyticsSignalRequestSchema))
    body: ClientAnalyticsSignalRequest,
  ) {
    this.limiter.consume(request.ip);
    const result = await this.service.accept(body);
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
