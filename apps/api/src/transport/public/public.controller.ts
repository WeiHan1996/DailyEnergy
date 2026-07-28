import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { ApiException } from "../common/api-exception.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PublicAudienceGuard } from "./public-audience.guard.js";

const WechatSessionRequestSchema = z.strictObject({
  channel: z.string().min(1).max(64).optional(),
  code: z.string().min(1).max(256),
});

type WechatSessionRequest = z.infer<typeof WechatSessionRequestSchema>;

function featureDisabled(): never {
  throw new ApiException({
    category: "GUARD",
    code: "FEATURE_DISABLED",
    message: "该能力尚未开放。",
    messageKey: "error.feature_disabled",
    retryable: false,
    status: HttpStatus.FORBIDDEN,
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
  @UseGuards(PublicAudienceGuard)
  public getLaunchState(): never {
    return featureDisabled();
  }
}
