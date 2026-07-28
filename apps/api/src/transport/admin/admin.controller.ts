import { Controller, Get, HttpStatus, UseGuards } from "@nestjs/common";

import { ApiException } from "../common/api-exception.js";
import { AdminAudienceGuard } from "./admin-audience.guard.js";

@Controller("v1/admin")
export class AdminController {
  @Get("ops/overview")
  @UseGuards(AdminAudienceGuard)
  public getOperationsOverview(): never {
    throw new ApiException({
      category: "GUARD",
      code: "FEATURE_DISABLED",
      message: "该管理能力尚未开放。",
      messageKey: "error.feature_disabled",
      retryable: false,
      status: HttpStatus.FORBIDDEN,
    });
  }
}
