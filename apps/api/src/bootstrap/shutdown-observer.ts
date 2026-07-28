import {
  Injectable,
  type BeforeApplicationShutdown,
  type OnApplicationShutdown,
} from "@nestjs/common";

import { OrdinaryLogger } from "../observability/ordinary-logger.js";
import { HealthService } from "../transport/public/health.service.js";

@Injectable()
export class ShutdownObserver
  implements BeforeApplicationShutdown, OnApplicationShutdown
{
  public constructor(
    private readonly health: HealthService,
    private readonly logger: OrdinaryLogger,
  ) {}

  public beforeApplicationShutdown(signal?: string): void {
    this.health.markDraining();
    this.logger.write("INFO", {
      message_code: "API_SHUTDOWN_STARTED",
      operation_code: "API_LIFECYCLE",
      outcome_code: "SUCCESS",
      reason_code: signal === undefined ? "APPLICATION_CLOSE" : "SIGNAL",
    });
  }

  public onApplicationShutdown(signal?: string): void {
    this.logger.write("INFO", {
      message_code: "API_SHUTDOWN_COMPLETED",
      operation_code: "API_LIFECYCLE",
      outcome_code: "SUCCESS",
      reason_code: signal === undefined ? "APPLICATION_CLOSE" : "SIGNAL",
    });
  }
}
