import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  WechatSessionRequestSchema,
  type WechatSessionRequest,
} from "@daily-energy/shared-schemas";

import { ApiException } from "../common/api-exception.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { LaunchAudienceGuard } from "./launch-audience.guard.js";

function featureDisabled(): never {
  throw new ApiException({
    code: "FEATURE_DISABLED",
  });
}

@Controller("v1")
export class PublicController {
  @Post("auth/wechat/session")
  public createWechatSession(
    @Body(new ZodValidationPipe(WechatSessionRequestSchema))
    _request: WechatSessionRequest,
  ): never {
    return featureDisabled();
  }

  @Get("bootstrap/launch")
  @UseGuards(LaunchAudienceGuard)
  public getLaunchState(): never {
    return featureDisabled();
  }
}
