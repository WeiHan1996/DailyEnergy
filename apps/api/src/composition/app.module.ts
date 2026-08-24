import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import {
  UNAVAILABLE_CHECKIN_STORE,
  UNAVAILABLE_CONSENT_PROFILE_STORE,
  UNAVAILABLE_DAILY_GENERATION_STORE,
  UNAVAILABLE_DAILY_INTERACTION_STORE,
  UNAVAILABLE_EVENING_STORE,
  UNAVAILABLE_WEEKLY_STORE,
} from "@daily-energy/server-adapters/api";

import { AuthAttemptLimiter } from "../auth/auth-attempt-limiter.js";
import { AuthService } from "../auth/auth.service.js";
import {
  DevelopmentWechatCodeExchange,
  UNAVAILABLE_AUTH_STORE,
  UNAVAILABLE_WECHAT_CODE_EXCHANGE,
} from "../auth/contracts.js";
import { ShutdownObserver } from "../bootstrap/shutdown-observer.js";
import { CheckinService } from "../checkin/checkin.service.js";
import { ConsentProfileService } from "../consent-profile/consent-profile.service.js";
import { GenerationService } from "../generation/generation.service.js";
import { DailyInteractionService } from "../daily-interaction/daily-interaction.service.js";
import { EveningService } from "../evening/evening.service.js";
import { WeeklyService } from "../weekly/weekly.service.js";
import {
  developmentEveningNoteCodec,
  UNAVAILABLE_EVENING_NOTE_CODEC,
} from "../evening/evening-note-codec.js";
import {
  UNAVAILABLE_EVENING_SAFETY_GATE,
  UNAVAILABLE_EVENING_SAFETY_STORE,
} from "../evening/evening-safety.js";
import {
  developmentPreferredNameCodec,
  UNAVAILABLE_PREFERRED_NAME_CODEC,
} from "../consent-profile/preferred-name-codec.js";
import {
  ApiTelemetry,
  NOOP_TELEMETRY_RUNTIME,
} from "../observability/api-telemetry.js";
import {
  OrdinaryLogger,
  STANDARD_OUTPUT_LOG_SINK,
} from "../observability/ordinary-logger.js";
import { SYSTEM_PRODUCT_DATE_CLOCK } from "../product-date/product-date.js";
import { AdminAudienceGuard } from "../transport/admin/admin-audience.guard.js";
import { AdminController } from "../transport/admin/admin.controller.js";
import { ApiExceptionFilter } from "../transport/common/api-exception.filter.js";
import { HttpLoggingInterceptor } from "../transport/common/http-logging.interceptor.js";
import { MaintenanceGuard } from "../transport/common/maintenance.guard.js";
import { RequestContextStore } from "../transport/common/request-context.js";
import { AuthController } from "../transport/public/auth.controller.js";
import { CheckinController } from "../transport/public/checkin.controller.js";
import { ConsentProfileController } from "../transport/public/consent-profile.controller.js";
import { HealthController } from "../transport/public/health.controller.js";
import { GenerationController } from "../transport/public/generation.controller.js";
import { DailyInteractionController } from "../transport/public/daily-interaction.controller.js";
import { EveningController } from "../transport/public/evening.controller.js";
import { WeeklyController } from "../transport/public/weekly.controller.js";
import { HealthService } from "../transport/public/health.service.js";
import { LaunchAudienceGuard } from "../transport/public/launch-audience.guard.js";
import { PublicAudienceGuard } from "../transport/public/public-audience.guard.js";
import { PublicController } from "../transport/public/public.controller.js";
import { SessionGuard } from "../transport/public/session.guard.js";
import {
  ADMIN_AUDIENCE_VERIFIER,
  AUTH_STORE,
  CHECKIN_STORE,
  CONSENT_PROFILE_STORE,
  DAILY_GENERATION_STORE,
  DAILY_INTERACTION_STORE,
  EVENING_NOTE_CODEC,
  EVENING_SAFETY_GATE,
  EVENING_SAFETY_STORE,
  EVENING_STORE,
  WEEKLY_STORE,
  type ApiComposition,
  ORDINARY_LOG_SINK,
  PREFERRED_NAME_CODEC,
  PRODUCT_DATE_CLOCK,
  PUBLIC_AUDIENCE_VERIFIER,
  READINESS_CHECKS,
  RUNTIME_CONFIG,
  SAFETY_CONTINUATION_VERIFIER,
  SHUTDOWN_DRAIN_HOOKS,
  TELEMETRY_RUNTIME,
  WECHAT_CODE_EXCHANGE,
} from "./tokens.js";
import {
  DENY_ALL_AUDIENCE_VERIFIER,
  DENY_ALL_SAFETY_CONTINUATION_VERIFIER,
} from "./types.js";

@Module({})
export class ApiModule {
  public static register(composition: ApiComposition): DynamicModule {
    const developmentWechat = ["LOCAL", "CI", "DEV"].includes(
      composition.config.environment,
    )
      ? new DevelopmentWechatCodeExchange(composition.config.environment)
      : UNAVAILABLE_WECHAT_CODE_EXCHANGE;
    const developmentProfileCodec = ["LOCAL", "CI", "DEV"].includes(
      composition.config.environment,
    )
      ? developmentPreferredNameCodec()
      : UNAVAILABLE_PREFERRED_NAME_CODEC;
    const developmentNoteCodec = ["LOCAL", "CI", "DEV"].includes(
      composition.config.environment,
    )
      ? developmentEveningNoteCodec()
      : UNAVAILABLE_EVENING_NOTE_CODEC;
    const providers: Provider[] = [
      { provide: RUNTIME_CONFIG, useValue: composition.config },
      {
        provide: AUTH_STORE,
        useValue: composition.overrides?.authStore ?? UNAVAILABLE_AUTH_STORE,
      },
      {
        provide: CONSENT_PROFILE_STORE,
        useValue:
          composition.overrides?.consentProfileStore ??
          UNAVAILABLE_CONSENT_PROFILE_STORE,
      },
      {
        provide: CHECKIN_STORE,
        useValue:
          composition.overrides?.checkinStore ?? UNAVAILABLE_CHECKIN_STORE,
      },
      {
        provide: DAILY_GENERATION_STORE,
        useValue:
          composition.overrides?.dailyGenerationStore ??
          UNAVAILABLE_DAILY_GENERATION_STORE,
      },
      {
        provide: DAILY_INTERACTION_STORE,
        useValue:
          composition.overrides?.dailyInteractionStore ??
          UNAVAILABLE_DAILY_INTERACTION_STORE,
      },
      {
        provide: EVENING_STORE,
        useValue:
          composition.overrides?.eveningStore ?? UNAVAILABLE_EVENING_STORE,
      },
      {
        provide: WEEKLY_STORE,
        useValue:
          composition.overrides?.weeklyStore ?? UNAVAILABLE_WEEKLY_STORE,
      },
      {
        provide: EVENING_NOTE_CODEC,
        useValue:
          composition.overrides?.eveningNoteCodec ?? developmentNoteCodec,
      },
      {
        provide: EVENING_SAFETY_GATE,
        useValue:
          composition.overrides?.eveningSafetyGate ??
          UNAVAILABLE_EVENING_SAFETY_GATE,
      },
      {
        provide: EVENING_SAFETY_STORE,
        useValue:
          composition.overrides?.eveningSafetyStore ??
          UNAVAILABLE_EVENING_SAFETY_STORE,
      },
      {
        provide: PREFERRED_NAME_CODEC,
        useValue:
          composition.overrides?.preferredNameCodec ?? developmentProfileCodec,
      },
      {
        provide: PRODUCT_DATE_CLOCK,
        useValue:
          composition.overrides?.productDateClock ?? SYSTEM_PRODUCT_DATE_CLOCK,
      },
      {
        provide: WECHAT_CODE_EXCHANGE,
        useValue:
          composition.overrides?.wechatCodeExchange ?? developmentWechat,
      },
      {
        provide: PUBLIC_AUDIENCE_VERIFIER,
        useValue:
          composition.overrides?.publicAudienceVerifier ??
          DENY_ALL_AUDIENCE_VERIFIER,
      },
      {
        provide: ADMIN_AUDIENCE_VERIFIER,
        useValue:
          composition.overrides?.adminAudienceVerifier ??
          DENY_ALL_AUDIENCE_VERIFIER,
      },
      {
        provide: SAFETY_CONTINUATION_VERIFIER,
        useValue:
          composition.overrides?.safetyContinuationVerifier ??
          DENY_ALL_SAFETY_CONTINUATION_VERIFIER,
      },
      {
        provide: READINESS_CHECKS,
        useValue: composition.overrides?.readinessChecks ?? [],
      },
      {
        provide: SHUTDOWN_DRAIN_HOOKS,
        useValue: composition.overrides?.shutdownDrainHooks ?? [],
      },
      {
        provide: ORDINARY_LOG_SINK,
        useValue:
          composition.overrides?.ordinaryLogSink ?? STANDARD_OUTPUT_LOG_SINK,
      },
      {
        provide: TELEMETRY_RUNTIME,
        useValue:
          composition.overrides?.telemetryRuntime ?? NOOP_TELEMETRY_RUNTIME,
      },
      AdminAudienceGuard,
      ApiTelemetry,
      ApiExceptionFilter,
      AuthAttemptLimiter,
      AuthService,
      CheckinService,
      ConsentProfileService,
      DailyInteractionService,
      EveningService,
      GenerationService,
      WeeklyService,
      HealthService,
      HttpLoggingInterceptor,
      LaunchAudienceGuard,
      MaintenanceGuard,
      OrdinaryLogger,
      PublicAudienceGuard,
      RequestContextStore,
      SessionGuard,
      ShutdownObserver,
    ];
    return {
      controllers: [
        AdminController,
        AuthController,
        CheckinController,
        ConsentProfileController,
        DailyInteractionController,
        EveningController,
        GenerationController,
        WeeklyController,
        HealthController,
        PublicController,
      ],
      module: ApiModule,
      providers,
    };
  }
}
