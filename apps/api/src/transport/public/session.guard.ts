import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

import { AuthService } from "../../auth/auth.service.js";
import type { SessionPrincipal } from "../../auth/contracts.js";
import { ApiException } from "../common/api-exception.js";

const SESSION_PRINCIPAL = Symbol("dailyenergy.session-principal");

type AuthenticatedRequest = Request & {
  [SESSION_PRINCIPAL]?: SessionPrincipal;
};

@Injectable()
export class SessionGuard implements CanActivate {
  public constructor(private readonly authService: AuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const resolved = await this.authService.resolveAuthorization(
      request.headers.authorization,
    );
    if (resolved.status === "ACTIVE") {
      request[SESSION_PRINCIPAL] = resolved.principal;
      return true;
    }
    if (resolved.status === "EXPIRED") {
      throw new ApiException({ code: "AUTH_SESSION_EXPIRED" });
    }
    throw new ApiException({
      code: resolved.status === "MISSING" ? "AUTH_REQUIRED" : "AUTH_INVALID",
    });
  }
}

export function sessionPrincipalFromRequest(
  request: Request,
): SessionPrincipal {
  const principal = (request as AuthenticatedRequest)[SESSION_PRINCIPAL];
  if (principal === undefined) {
    throw new ApiException({ code: "AUTH_REQUIRED" });
  }
  return principal;
}
