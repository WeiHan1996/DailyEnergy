import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import express from "express";

import { ApiModule } from "../composition/app.module.js";
import type { ApiCompositionOverrides } from "../composition/tokens.js";
import { ApiExceptionFilter } from "../transport/common/api-exception.filter.js";
import { HttpLoggingInterceptor } from "../transport/common/http-logging.interceptor.js";
import { MaintenanceGuard } from "../transport/common/maintenance.guard.js";
import { RequestContextStore } from "../transport/common/request-context.js";
import { HealthService } from "../transport/public/health.service.js";
import type { RuntimeConfig } from "./runtime-config.js";

export async function createApiApplication(
  config: RuntimeConfig,
  overrides?: ApiCompositionOverrides,
): Promise<INestApplication> {
  const application = await NestFactory.create(
    ApiModule.register({
      config,
      ...(overrides === undefined ? {} : { overrides }),
    }),
    {
      abortOnError: false,
      bodyParser: false,
      logger: false,
    },
  );

  application.use(application.get(RequestContextStore).middleware());
  application.use(
    express.json({
      limit: "32kb",
      strict: true,
      type: "application/json",
    }),
  );
  application.useGlobalGuards(application.get(MaintenanceGuard));
  application.useGlobalFilters(application.get(ApiExceptionFilter));
  application.useGlobalInterceptors(application.get(HttpLoggingInterceptor));
  application.enableShutdownHooks(["SIGINT", "SIGTERM"]);
  await application.init();
  application.get(HealthService).markStarted();
  return application;
}
