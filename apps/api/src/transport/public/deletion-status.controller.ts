import { Controller, Get, Headers, Inject, Param, Req } from "@nestjs/common";
import { OpaqueIdSchema } from "@daily-energy/shared-schemas";
import type { Request } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import { DataRightsService } from "../../data-rights/data-rights.service.js";
import { DeletionStatusAttemptLimiter } from "../../data-rights/deletion-status-attempt-limiter.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";

@Controller("v1/data-rights/deletion-status")
export class DeletionStatusController {
  public constructor(
    private readonly service: DataRightsService,
    private readonly attemptLimiter: DeletionStatusAttemptLimiter,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Get(":task_ref")
  public async getStatus(
    @Req() request: Request,
    @Headers("authorization") authorization: string | undefined,
    @Param("task_ref", new ZodValidationPipe(OpaqueIdSchema)) taskRef: string,
  ) {
    this.attemptLimiter.consume(request.ip);
    const result = await this.service.getDeletionStatus(authorization, taskRef);
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
