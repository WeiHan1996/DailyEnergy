import { Controller, Get, UseGuards } from "@nestjs/common";

import { ApiException } from "../common/api-exception.js";
import { LaunchAudienceGuard } from "./launch-audience.guard.js";

function featureDisabled(): never {
  throw new ApiException({
    code: "FEATURE_DISABLED",
  });
}

@Controller("v1")
export class PublicController {
  @Get("bootstrap/launch")
  @UseGuards(LaunchAudienceGuard)
  public getLaunchState(): never {
    return featureDisabled();
  }
}
