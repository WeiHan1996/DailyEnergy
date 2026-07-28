import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";

import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  public constructor(private readonly health: HealthService) {}

  @Get("startup")
  public startup(): Readonly<{ status: "STARTED" | "STARTING" }> {
    return {
      status: this.health.startupStatus(),
    };
  }

  @Get("live")
  public liveness(): Readonly<{ status: "UP" }> {
    return {
      status: "UP",
    };
  }

  @Get("ready")
  public async readiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<
    Readonly<{
      reason_code?: string;
      status: "READY" | "NOT_READY";
    }>
  > {
    const result = await this.health.readiness();
    if (result.status === "DOWN") {
      response.status(503);
      return {
        reason_code: result.reasonCode ?? "REQUIRED_DEPENDENCY_UNAVAILABLE",
        status: "NOT_READY",
      };
    }
    return {
      status: "READY",
    };
  }
}
