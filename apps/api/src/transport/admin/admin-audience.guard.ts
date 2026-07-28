import {
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

import { ADMIN_AUDIENCE_VERIFIER } from "../../composition/tokens.js";
import type { AudienceVerifier } from "../../composition/types.js";
import { ApiException } from "../common/api-exception.js";

@Injectable()
export class AdminAudienceGuard implements CanActivate {
  public constructor(
    @Inject(ADMIN_AUDIENCE_VERIFIER)
    private readonly verifier: AudienceVerifier,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (await this.verifier.verify(request.headers.authorization)) {
      return true;
    }
    throw new ApiException({
      category: "AUTH",
      code: "AUTH_ADMIN_REQUIRED",
      message: "当前管理会话无权访问此内容。",
      messageKey: "error.auth_admin_required",
      retryable: false,
      status: HttpStatus.UNAUTHORIZED,
    });
  }
}
