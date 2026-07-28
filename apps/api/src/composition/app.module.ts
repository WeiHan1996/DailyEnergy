import { Module, type DynamicModule, type Provider } from "@nestjs/common";

import { ShutdownObserver } from "../bootstrap/shutdown-observer.js";
import { OrdinaryLogger } from "../observability/ordinary-logger.js";
import { AdminAudienceGuard } from "../transport/admin/admin-audience.guard.js";
import { AdminController } from "../transport/admin/admin.controller.js";
import { ApiExceptionFilter } from "../transport/common/api-exception.filter.js";
import { HttpLoggingInterceptor } from "../transport/common/http-logging.interceptor.js";
import { MaintenanceGuard } from "../transport/common/maintenance.guard.js";
import { RequestContextStore } from "../transport/common/request-context.js";
import { HealthController } from "../transport/public/health.controller.js";
import { HealthService } from "../transport/public/health.service.js";
import { LaunchAudienceGuard } from "../transport/public/launch-audience.guard.js";
import { PublicAudienceGuard } from "../transport/public/public-audience.guard.js";
import { PublicController } from "../transport/public/public.controller.js";
import {
  ADMIN_AUDIENCE_VERIFIER,
  type ApiComposition,
  ORDINARY_LOG_SINK,
  PUBLIC_AUDIENCE_VERIFIER,
  READINESS_CHECKS,
  RUNTIME_CONFIG,
  SAFETY_CONTINUATION_VERIFIER,
  SHUTDOWN_DRAIN_HOOKS,
} from "./tokens.js";
import {
  DENY_ALL_AUDIENCE_VERIFIER,
  DENY_ALL_SAFETY_CONTINUATION_VERIFIER,
} from "./types.js";
import { STANDARD_OUTPUT_LOG_SINK } from "../observability/ordinary-logger.js";

@Module({})
export class ApiModule {
  public static register(composition: ApiComposition): DynamicModule {
    const providers: Provider[] = [
      {
        provide: RUNTIME_CONFIG,
        useValue: composition.config,
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
      AdminAudienceGuard,
      ApiExceptionFilter,
      HealthService,
      HttpLoggingInterceptor,
      LaunchAudienceGuard,
      MaintenanceGuard,
      OrdinaryLogger,
      PublicAudienceGuard,
      RequestContextStore,
      ShutdownObserver,
    ];
    return {
      controllers: [AdminController, HealthController, PublicController],
      module: ApiModule,
      providers,
    };
  }
}
