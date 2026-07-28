import {
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

import { PUBLIC_AUDIENCE_VERIFIER } from "../../composition/tokens.js";
import type { AudienceVerifier } from "../../composition/types.js";
import { ApiException } from "../common/api-exception.js";

@Injectable()
export class PublicAudienceGuard implements CanActivate {
  public constructor(
    @Inject(PUBLIC_AUDIENCE_VERIFIER)
    private readonly verifier: AudienceVerifier,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (await this.verifier.verify(request.headers.authorization)) {
      return true;
    }
    throw new ApiException({
      category: "AUTH",
      code: "AUTH_REQUIRED",
      message: "请重新登录后继续。",
      messageKey: "error.auth_required",
      retryable: false,
      status: HttpStatus.UNAUTHORIZED,
    });
  }
}
