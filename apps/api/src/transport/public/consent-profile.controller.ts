import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ConsentAcceptRequestSchema,
  ConsentWithdrawRequestSchema,
  MemoryPreferencesUpdateRequestSchema,
  NotificationPermissionSyncRequestSchema,
  NotificationSettingsUpdateRequestSchema,
  OnboardingCompleteRequestSchema,
  ProfileUpdateRequestSchema,
  StyleCalibrationRequestSchema,
  type ConsentAcceptRequest,
  type ConsentWithdrawRequest,
  type MemoryPreferencesUpdateRequest,
  type NotificationPermissionSyncRequest,
  type NotificationSettingsUpdateRequest,
  type OnboardingCompleteRequest,
  type ProfileUpdateRequest,
  type StyleCalibrationRequest,
} from "@daily-energy/shared-schemas";
import type { Request } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { ConsentProfileService } from "../../consent-profile/consent-profile.service.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import { ApiException } from "../common/api-exception.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionGuard, sessionPrincipalFromRequest } from "./session.guard.js";

@Controller("v1")
@UseGuards(SessionGuard)
export class ConsentProfileController {
  public constructor(
    private readonly service: ConsentProfileService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Get("consent/current")
  public async getCurrentConsent(@Req() request: Request) {
    return this.#success(
      await this.service.getConsent(sessionPrincipalFromRequest(request)),
    );
  }

  @Post("consent/accept")
  @HttpCode(HttpStatus.OK)
  public async acceptConsent(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(ConsentAcceptRequestSchema))
    body: ConsentAcceptRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.acceptConsent(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("consent/withdraw")
  @HttpCode(HttpStatus.OK)
  public async withdrawConsent(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(ConsentWithdrawRequestSchema))
    body: ConsentWithdrawRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.withdrawConsent(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Get("profile")
  public async getProfile(@Req() request: Request) {
    return this.#success(
      await this.service.getProfile(sessionPrincipalFromRequest(request)),
    );
  }

  @Post("onboarding/complete")
  @HttpCode(HttpStatus.OK)
  public async completeOnboarding(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(OnboardingCompleteRequestSchema))
    body: OnboardingCompleteRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.completeOnboarding(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("profile/update")
  @HttpCode(HttpStatus.OK)
  public async updateProfile(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(ProfileUpdateRequestSchema))
    body: ProfileUpdateRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.updateProfile(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("profile/style-calibration")
  @HttpCode(HttpStatus.OK)
  public async calibrateStyle(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(StyleCalibrationRequestSchema))
    body: StyleCalibrationRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.calibrateStyle(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Get("memory/preferences")
  public async getMemoryPreferences(@Req() request: Request) {
    return this.#success(
      await this.service.getMemoryPreferences(
        sessionPrincipalFromRequest(request),
      ),
    );
  }

  @Post("memory/preferences")
  @HttpCode(HttpStatus.OK)
  public async updateMemoryPreferences(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(MemoryPreferencesUpdateRequestSchema))
    body: MemoryPreferencesUpdateRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.updateMemoryPreferences(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Get("notifications/settings")
  public async getNotificationSettings(@Req() request: Request) {
    return this.#success(
      await this.service.getNotificationSettings(
        sessionPrincipalFromRequest(request),
      ),
    );
  }

  @Post("notifications/settings")
  @HttpCode(HttpStatus.OK)
  public async updateNotificationSettings(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(NotificationSettingsUpdateRequestSchema))
    body: NotificationSettingsUpdateRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.updateNotificationSettings(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("notifications/permission-sync")
  @HttpCode(HttpStatus.OK)
  public async syncNotificationPermission(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(NotificationPermissionSyncRequestSchema))
    body: NotificationPermissionSyncRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.syncNotificationPermission(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
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

function assertIdempotencyKey(
  idempotencyKey: string | undefined,
  commandRef: string,
): void {
  if (idempotencyKey === undefined || idempotencyKey !== commandRef) {
    throw new ApiException({ code: "IDEMPOTENCY_CONFLICT" });
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
