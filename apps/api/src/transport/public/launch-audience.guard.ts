import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

import {
  PUBLIC_AUDIENCE_VERIFIER,
  SAFETY_CONTINUATION_VERIFIER,
} from "../../composition/tokens.js";
import type {
  AudienceVerifier,
  SafetyContinuationVerifier,
} from "../../composition/types.js";
import { ApiException } from "../common/api-exception.js";
import { safetyContinuationFrom } from "../common/safety-continuation.js";

@Injectable()
export class LaunchAudienceGuard implements CanActivate {
  public constructor(
    @Inject(PUBLIC_AUDIENCE_VERIFIER)
    private readonly publicVerifier: AudienceVerifier,
    @Inject(SAFETY_CONTINUATION_VERIFIER)
    private readonly safetyVerifier: SafetyContinuationVerifier,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (await this.publicVerifier.verify(request.headers.authorization)) {
      return true;
    }
    if (await this.safetyVerifier.verify(safetyContinuationFrom(request))) {
      return true;
    }
    throw new ApiException({
      code: "AUTH_REQUIRED",
    });
  }
}
