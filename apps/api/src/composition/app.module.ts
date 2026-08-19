import { Module, type DynamicModule, type Provider } from "@nestjs/common";

import { AuthAttemptLimiter } from "../auth/auth-attempt-limiter.js";
import { AuthService } from "../auth/auth.service.js";
import {
  DevelopmentWechatCodeExchange,
  UNAVAILABLE_AUTH_STORE,
  UNAVAILABLE_WECHAT_CODE_EXCHANGE,
} from "../auth/contracts.js";
import { ShutdownObserver } from "../bootstrap/shutdown-observer.js";
import { ApiTelemetry, NOOP_TELEMETRY_RUNTIME } from "../observability/api-telemetry.js";
import {
  OrdinaryLogger,
  STANDARD_OUTPUT_LOG_SINK,
} from "../observability/ordinary-logger.js";
import { AdminAudienceGuard } from "../transport/admin/admin-audience.guard.js";
import { AdminController } from "../transport/admin/admin.controller.js";
import { ApiExceptionFilter } from "../transport/common/api-exception.filter.js";
import { HttpLoggingInterceptor } from "../transport/common/http-logging.interceptor.js";
import { MaintenanceGuard } from "../transport/common/maintenance.guard.js";
import { RequestContextStore } from "../transport/common/request-context.js";
import { AuthController } from "../transport/public/auth.controller.js";
import { HealthController } from "../transport/public/health.controller.js";
import { HealthService } from "../transport/public/health.service.js";
import { LaunchAudienceGuard } from "../transport/public/launch-audience.guard.js";
import { PublicAudienceGuard } from "../transport/public/public-audience.guard.js";
import { PublicController } from "../transport/public/public.controller.js";
import { SessionGuard } from "../transport/public/session.guard.js";
import {
  ADMIN_AUDIENCE_VERIFIER,
  AUTH_STORE,
  type ApiComposition,
  ORDINARY_LOG_SINK,
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
    const providers: Provider[] = [
      { provide: RUNTIME_CONFIG, useValue: composition.config },
      {
        provide: AUTH_STORE,
        useValue: composition.overrides?.authStore ?? UNAVAILABLE_AUTH_STORE,
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
        HealthController,
        PublicController,
      ],
      module: ApiModule,
      providers,
    };
  }
}
