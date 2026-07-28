import {
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request, Response } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import { ApiException } from "./api-exception.js";

@Injectable()
export class MaintenanceGuard implements CanActivate {
  public constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
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
      throw new ApiException({
        category: "GUARD",
        code: "MAINTENANCE_BLOCKING",
        message: "服务正在短暂维护，请稍后再来。",
        messageKey: "error.maintenance_blocking",
        retryable: true,
        status: HttpStatus.FORBIDDEN,
      });
    }
    return true;
  }
}
