import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  WechatSessionRequestSchema,
  type WechatSessionRequest,
} from "@daily-energy/shared-schemas";
import type { Request } from "express";
import { z } from "zod";

import { AuthService } from "../../auth/auth.service.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { ApiException } from "../common/api-exception.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import {
  SessionGuard,
  sessionPrincipalFromRequest,
} from "./session.guard.js";

const COMMAND_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const LogoutRequestSchema = z
  .object({
    command_ref: z.string().regex(COMMAND_REF),
    client_context: z
      .object({
        app_version: z.string().min(1).max(64).optional(),
        scene: z.string().min(1).max(64).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

@Controller("v1/auth")
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Post("wechat/session")
  @HttpCode(HttpStatus.OK)
  public async createWechatSession(
    @Body(new ZodValidationPipe(WechatSessionRequestSchema))
    request: WechatSessionRequest,
  ) {
    const data = await this.authService.createWechatSession(request);
    return this.#success(data);
  }

  @Post("session/refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  public async refreshSession(@Req() request: Request) {
    const data = await this.authService.refresh(
      sessionPrincipalFromRequest(request),
    );
    return this.#success(data);
  }

  @Post("session/logout")
  @HttpCode(HttpStatus.OK)
  public async logoutSession(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(LogoutRequestSchema)) body: LogoutRequest,
  ) {
    if (idempotencyKey === undefined || idempotencyKey !== body.command_ref) {
      throw new ApiException({
        code: "VALIDATION_FAILED",
        details: {
          fields: [
            {
              field: "Idempotency-Key",
              reason: "idempotency_key_mismatch",
            },
          ],
        },
      });
    }
    await this.authService.logout(request.headers.authorization);
    return this.#success({
      command_ref: body.command_ref,
      operation: "SESSION_LOGOUT",
      outcome: "ACCEPTED",
    });
  }

  #success<T>(data: T) {
    const serverNow = new Date();
    return {
      ok: true as const,
      request_id: this.contextStore.get().requestId,
      server_now: serverNow.toISOString(),
      product_date: productDate(serverNow),
      product_date_policy_version: this.config.productDatePolicyVersion,
      data,
    };
  }
}

function productDate(now: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const date = `${values.year}-${values.month}-${values.day}`;
  if (Number(values.hour) >= 4) {
    return date;
  }
  const previous = new Date(`${date}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}
