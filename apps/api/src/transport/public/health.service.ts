import { Inject, Injectable } from "@nestjs/common";

import { READINESS_CHECKS } from "../../composition/tokens.js";
import type {
  ReadinessCheck,
  ReadinessCheckResult,
} from "../../composition/types.js";

@Injectable()
export class HealthService {
  private draining = false;
  private started = false;

  public constructor(
    @Inject(READINESS_CHECKS)
    private readonly readinessChecks: readonly ReadinessCheck[],
  ) {}

  public markStarted(): void {
    this.started = true;
  }

  public markDraining(): void {
    this.draining = true;
  }

  public startupStatus(): "STARTED" | "STARTING" {
    return this.started ? "STARTED" : "STARTING";
  }

  public async readiness(): Promise<ReadinessCheckResult> {
    if (this.draining) {
      return {
        reasonCode: "REQUIRED_DEPENDENCY_UNAVAILABLE",
        status: "DOWN",
      };
    }
    try {
      const results = await Promise.all(
        this.readinessChecks.map((check) => check.check()),
      );
      const failure = results.find((result) => result.status === "DOWN");
      return (
        failure ?? {
          status: "UP",
        }
      );
    } catch {
      return {
        reasonCode: "REQUIRED_DEPENDENCY_INDETERMINATE",
        status: "DOWN",
      };
    }
  }
}
