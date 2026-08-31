import { Controller, Get, Inject, Param, Req, UseGuards } from "@nestjs/common";
import { ProductDateSchema } from "@daily-energy/shared-schemas";
import type { Request } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import {
  WeeklyService,
  type WeeklyServiceResult,
} from "../../weekly/weekly.service.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionGuard, sessionPrincipalFromRequest } from "./session.guard.js";

@Controller("v1/weekly")
@UseGuards(SessionGuard)
export class WeeklyController {
  public constructor(
    private readonly service: WeeklyService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Get("current")
  public async getCurrent(@Req() request: Request) {
    return this.#success(
      await this.service.getCurrent(sessionPrincipalFromRequest(request)),
    );
  }

  @Get("window/:end_date")
  public async getWindow(
    @Req() request: Request,
    @Param("end_date", new ZodValidationPipe(ProductDateSchema))
    endProductDate: string,
  ) {
    return this.#success(
      await this.service.getWindow(
        sessionPrincipalFromRequest(request),
        endProductDate,
      ),
    );
  }

  #success(result: WeeklyServiceResult) {
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
