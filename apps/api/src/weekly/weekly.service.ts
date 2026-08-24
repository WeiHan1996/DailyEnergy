import { Inject, Injectable } from "@nestjs/common";
import type {
  WeeklyGuardFailure,
  WeeklyStore,
} from "@daily-energy/server-adapters/api";
import type { ClientWeeklySummaryView } from "@daily-energy/shared-schemas";

import type { SessionPrincipal } from "../auth/contracts.js";
import { PRODUCT_DATE_CLOCK, WEEKLY_STORE } from "../composition/tokens.js";
import {
  resolveProductDate,
  type ProductDateClock,
  type ProductDateResolution,
} from "../product-date/product-date.js";
import { ApiException } from "../transport/common/api-exception.js";

export interface WeeklyServiceResult {
  readonly resolution: ProductDateResolution;
  readonly view: ClientWeeklySummaryView;
}

@Injectable()
export class WeeklyService {
  public constructor(
    @Inject(WEEKLY_STORE) private readonly store: WeeklyStore,
    @Inject(PRODUCT_DATE_CLOCK) private readonly clock: ProductDateClock,
  ) {}

  public async getCurrent(
    principal: SessionPrincipal,
  ): Promise<WeeklyServiceResult> {
    const resolution = this.#resolve();
    return this.#get(principal, resolution.productDate, resolution);
  }

  public async getWindow(
    principal: SessionPrincipal,
    endProductDate: string,
  ): Promise<WeeklyServiceResult> {
    const resolution = this.#resolve();
    if (endProductDate > resolution.productDate) {
      throw new ApiException({
        code: "STATE_PRECONDITION_FAILED",
        productDate: resolution.productDate,
        serverNow: resolution.now,
      });
    }
    return this.#get(principal, endProductDate, resolution);
  }

  async #get(
    principal: SessionPrincipal,
    endProductDate: string,
    resolution: ProductDateResolution,
  ): Promise<WeeklyServiceResult> {
    let result: Awaited<ReturnType<WeeklyStore["get"]>>;
    try {
      result = await this.store.get({
        accountId: principal.accountId,
        endProductDate,
      });
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
    if (result.status !== "FOUND") {
      throw guardException(result.status, resolution);
    }
    return { resolution, view: result.value };
  }

  #resolve(): ProductDateResolution {
    try {
      return resolveProductDate(this.clock.now());
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }
}

function guardException(
  status: WeeklyGuardFailure,
  resolution: ProductDateResolution,
): ApiException {
  return new ApiException({
    code:
      status === "SAFETY_BLOCKED"
        ? "SAFETY_BLOCKED"
        : status === "CONSENT_REQUIRED"
          ? "CONSENT_REQUIRED"
          : status === "ONBOARDING_REQUIRED"
            ? "ONBOARDING_REQUIRED"
            : status === "ACCOUNT_RESTRICTED"
              ? "ACCOUNT_RESTRICTED"
              : status === "ACCOUNT_DELETING"
                ? "ACCOUNT_DELETING"
                : "ACCOUNT_DELETED",
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}
