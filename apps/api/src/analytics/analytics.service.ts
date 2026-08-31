import { Inject, Injectable } from "@nestjs/common";
import type {
  AnalyticsAggregateStore,
  ClientAggregateDelta,
} from "@daily-energy/server-adapters/api";
import type {
  AnalyticsEnvironment,
  ClientAnalyticsSignalAcceptedView,
  ClientAnalyticsSignalRequest,
} from "@daily-energy/shared-schemas";
import { ClientAnalyticsAppVersionBucketValues } from "@daily-energy/shared-schemas";

import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import {
  ANALYTICS_AGGREGATE_STORE,
  PRODUCT_DATE_CLOCK,
  RUNTIME_CONFIG,
} from "../composition/tokens.js";
import {
  resolveProductDate,
  type ProductDateClock,
  type ProductDateResolution,
} from "../product-date/product-date.js";

const MINIMUM_CELL_COUNT = 10;
const MAX_EPHEMERAL_CELLS = 2_048;
const APPROVED_APP_VERSION_BUCKETS = new Set<string>(
  ClientAnalyticsAppVersionBucketValues.filter((value) => value !== "OTHER"),
);

interface EphemeralCell {
  count: number;
  published: boolean;
}

export interface AnalyticsSignalServiceResult {
  readonly resolution: ProductDateResolution;
  readonly view: ClientAnalyticsSignalAcceptedView;
}

@Injectable()
export class AnalyticsService {
  readonly #cells = new Map<string, EphemeralCell>();

  public constructor(
    @Inject(ANALYTICS_AGGREGATE_STORE)
    private readonly store: AnalyticsAggregateStore,
    @Inject(PRODUCT_DATE_CLOCK) private readonly clock: ProductDateClock,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  public async accept(
    request: ClientAnalyticsSignalRequest,
  ): Promise<AnalyticsSignalServiceResult> {
    const resolution = resolveProductDate(this.clock.now());
    const dimensions = dimensionsFor(
      request,
      this.#appVersionBucket(request.app_version),
    );
    const cellIdentity: Omit<
      ClientAggregateDelta,
      "eventCountDelta" | "generatedAt"
    > = {
      dimensions,
      environment: analyticsEnvironment(this.config.environment),
      eventName: request.event_name,
      productDate: resolution.productDate,
    };
    const key = JSON.stringify(cellIdentity);
    const existing = this.#cells.get(key);
    const cell = existing ?? { count: 0, published: false };
    cell.count += 1;
    if (existing === undefined) {
      this.#ensureCellCapacity();
    }
    this.#cells.set(key, cell);

    if (!cell.published && cell.count >= MINIMUM_CELL_COUNT) {
      const delta = cell.count;
      cell.count = 0;
      try {
        await this.store.publishClientSignalDelta({
          ...cellIdentity,
          eventCountDelta: delta,
          generatedAt: resolution.now,
        });
        cell.published = true;
      } catch {
        this.#cells.delete(key);
      }
    } else if (cell.published) {
      cell.count = 0;
      try {
        await this.store.publishClientSignalDelta({
          ...cellIdentity,
          eventCountDelta: 1,
          generatedAt: resolution.now,
        });
      } catch {
        this.#cells.delete(key);
      }
    }

    return { resolution, view: { accepted: true } };
  }

  #appVersionBucket(version: string): string {
    const [major, minor] = version.split(".");
    const bucket = `${major}.${minor}`;
    return APPROVED_APP_VERSION_BUCKETS.has(bucket) ? bucket : "OTHER";
  }

  #ensureCellCapacity(): void {
    if (this.#cells.size < MAX_EPHEMERAL_CELLS) {
      return;
    }
    const first = this.#cells.keys().next().value as string | undefined;
    if (first !== undefined) {
      this.#cells.delete(first);
    }
  }
}

function dimensionsFor(
  request: ClientAnalyticsSignalRequest,
  appVersionBucket: string,
): ClientAggregateDelta["dimensions"] {
  if (
    request.event_name === "landing_viewed" ||
    request.event_name === "landing_primary_action_clicked"
  ) {
    return [
      { code: request.scene_code, name: "scene_code" },
      {
        code: request.surface_version_bucket,
        name: "surface_version_bucket",
      },
    ];
  }
  if (request.event_name === "faq_opened") {
    return [
      { code: request.faq_category_code, name: "faq_category_code" },
      { code: appVersionBucket, name: "app_version_bucket" },
    ];
  }
  return [
    { code: appVersionBucket, name: "app_version_bucket" },
    {
      code: request.locale === "zh-CN" ? "ZH_CN" : "OTHER",
      name: "locale_bucket",
    },
  ];
}

function analyticsEnvironment(
  environment: RuntimeConfig["environment"],
): AnalyticsEnvironment {
  if (environment === "PRODUCTION" || environment === "RECOVERY") {
    return "PROD";
  }
  if (environment === "STAGING") {
    return "STAGING";
  }
  if (environment === "CI") {
    return "TEST";
  }
  return "DEV";
}
