import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ApiException } from "../common/api-exception.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { LaunchAudienceGuard } from "./launch-audience.guard.js";

const WechatSessionRequestSchema = z.strictObject({
  channel: z.string().min(1).max(64).optional(),
  code: z.string().min(1).max(256),
});

type WechatSessionRequest = z.infer<typeof WechatSessionRequestSchema>;

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
