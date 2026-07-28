import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request, Response } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import {
  RUNTIME_CONFIG,
  SAFETY_CONTINUATION_VERIFIER,
} from "../../composition/tokens.js";
import type { SafetyContinuationVerifier } from "../../composition/types.js";
import { ApiException } from "./api-exception.js";
import {
  isSafetyContinuationRoute,
  safetyContinuationFrom,
} from "./safety-continuation.js";

@Injectable()
export class MaintenanceGuard implements CanActivate {
  public constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(SAFETY_CONTINUATION_VERIFIER)
    private readonly safetyVerifier: SafetyContinuationVerifier,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    if (!request.path.startsWith("/v1")) {
      return true;
    }
    if (this.config.maintenanceMode === "DEGRADED") {
      response.setHeader("X-Maintenance-Mode", "degraded");
      return true;
    }
    if (this.config.maintenanceMode === "BLOCKING") {
      if (
        isSafetyContinuationRoute(request) &&
        (await this.safetyVerifier.verify(safetyContinuationFrom(request)))
      ) {
        return true;
      }
      throw new ApiException({
        code: "MAINTENANCE_BLOCKING",
      });
    }
    return true;
  }
}
