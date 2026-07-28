import { Controller, Get, UseGuards } from "@nestjs/common";

import { ApiException } from "../common/api-exception.js";
import { AdminAudienceGuard } from "./admin-audience.guard.js";

@Controller("v1/admin")
export class AdminController {
  @Get("ops/overview")
  @UseGuards(AdminAudienceGuard)
  public getOperationsOverview(): never {
    throw new ApiException({
      code: "FEATURE_DISABLED",
    });
  }
}
