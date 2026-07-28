import { Inject, Injectable, type INestApplication } from "@nestjs/common";

import { RUNTIME_CONFIG, SHUTDOWN_DRAIN_HOOKS } from "../composition/tokens.js";
import type { ShutdownDrainHook } from "../composition/types.js";
import { OrdinaryLogger } from "../observability/ordinary-logger.js";
import { HealthService } from "../transport/public/health.service.js";
import type { RuntimeConfig } from "./runtime-config.js";

type ShutdownResult = "COMPLETED" | "FAILED" | "TIMED_OUT";

@Injectable()
export class ShutdownObserver {
  private shuttingDown = false;

  public constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(SHUTDOWN_DRAIN_HOOKS)
    private readonly drainHooks: readonly ShutdownDrainHook[],
    private readonly health: HealthService,
    private readonly logger: OrdinaryLogger,
  ) {}

  public install(application: INestApplication): void {
    const handler = (signal: NodeJS.Signals): void => {
      void this.shutdown(application, signal);
    };
    process.once("SIGINT", handler);
    process.once("SIGTERM", handler);
  }

  private async shutdown(
    application: INestApplication,
    _signal: NodeJS.Signals,
  ): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;
    this.health.markDraining();
    this.logger.write("INFO", {
      message_code: "API_SHUTDOWN_STARTED",
      operation_code: "API_LIFECYCLE",
      outcome_code: "SUCCESS",
      reason_code: "SIGNAL",
    });

    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<ShutdownResult>((resolvePromise) => {
      timer = setTimeout(() => {
        resolvePromise("TIMED_OUT");
      }, this.config.shutdownGraceMs);
    });
    const close: Promise<ShutdownResult> = Promise.all([
      application.close(),
      ...this.drainHooks.map(async (hook) => hook.drain()),
    ])
      .then((): ShutdownResult => "COMPLETED")
      .catch((): ShutdownResult => "FAILED");
    const result = await Promise.race([close, deadline]);
    if (timer !== undefined) {
      clearTimeout(timer);
    }

    if (result === "COMPLETED") {
      this.logger.write("INFO", {
        message_code: "API_SHUTDOWN_COMPLETED",
        operation_code: "API_LIFECYCLE",
        outcome_code: "SUCCESS",
        reason_code: "SIGNAL",
      });
      process.exitCode = 0;
      return;
    }

    this.logger.write("ERROR", {
      message_code:
        result === "TIMED_OUT"
          ? "API_SHUTDOWN_TIMED_OUT"
          : "API_SHUTDOWN_FAILED",
      operation_code: "API_LIFECYCLE",
      outcome_code: "TERMINAL",
      reason_code:
        result === "TIMED_OUT"
          ? "SHUTDOWN_DEADLINE_EXCEEDED"
          : "SHUTDOWN_FAILED",
    });
    process.exit(1);
  }
}
