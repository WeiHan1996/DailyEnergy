import { Pool } from "pg";

import type {
  AnalyticsEnvironment,
  AnalyticsEventName,
} from "@daily-energy/shared-schemas";

import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export interface ClientAggregateDelta {
  readonly dimensions: readonly {
    readonly code: string;
    readonly name: string;
  }[];
  readonly environment: AnalyticsEnvironment;
  readonly eventCountDelta: number;
  readonly eventName: AnalyticsEventName;
  readonly generatedAt: Date;
  readonly productDate: string;
}

export interface AnalyticsAggregateStore {
  close(): Promise<void>;
  publishClientSignalDelta(input: ClientAggregateDelta): Promise<void>;
}

export interface AnalyticsBatchStore {
  close(): Promise<void>;
  purgeExpired(input: {
    readonly executedAt: Date;
    readonly revision: number;
  }): Promise<{ readonly deletedRows: number }>;
  rebuildProductDate(input: {
    readonly aggregationRevision: number;
    readonly environment: AnalyticsEnvironment;
    readonly finalizedProductDate: string;
    readonly generatedAt: Date;
    readonly productDate: string;
  }): Promise<{
    readonly aggregateRows: number;
    readonly gateRows: number;
    readonly metricRows: number;
  }>;
}

export interface PostgresAnalyticsStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: "daily_energy_api" | "daily_energy_background";
  readonly profile: "api" | "worker-background";
}

export class PostgresAnalyticsStore
  implements AnalyticsAggregateStore, AnalyticsBatchStore
{
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresAnalyticsStoreConfig,
  ): Promise<PostgresAnalyticsStore> {
    const roleProbe = createClosedDatabaseFactory(
      config.profile === "api"
        ? {
            databaseRole: config.expectedDatabaseRole,
            defaultConnectionLimit: 1,
            profile: "api" as const,
          }
        : {
            databaseRole: config.expectedDatabaseRole,
            defaultConnectionLimit: 1,
            profile: "worker-background" as const,
          },
      prismaRuntime,
    );
    const verified = await roleProbe.connect({
      applicationName: `${config.applicationName}:role-probe`,
      connectionLimit: 1,
      connectionString: config.connectionString,
    });
    await verified.disconnect();
    const pool = new Pool({
      application_name: config.applicationName,
      connectionString: config.connectionString,
      max: config.connectionLimit ?? 2,
    });
    return new PostgresAnalyticsStore(pool);
  }

  public async publishClientSignalDelta(
    input: ClientAggregateDelta,
  ): Promise<void> {
    this.#assertOpen();
    if (
      !Number.isSafeInteger(input.eventCountDelta) ||
      input.eventCountDelta <= 0
    ) {
      throw new Error("ANALYTICS_DELTA_INVALID");
    }
    if (input.dimensions.length > 2) {
      throw new Error("ANALYTICS_DIMENSION_LIMIT");
    }
    await this.#pool.query(
      `SELECT daily_energy.increment_c015_client_signal_aggregate(
         $1::date,$2::text,$3::text,$4::jsonb,$5::bigint,$6::timestamptz
       )`,
      [
        input.productDate,
        input.environment,
        input.eventName,
        JSON.stringify(input.dimensions),
        input.eventCountDelta,
        input.generatedAt,
      ],
    );
  }

  public async rebuildProductDate(
    input: Parameters<AnalyticsBatchStore["rebuildProductDate"]>[0],
  ): Promise<{
    readonly aggregateRows: number;
    readonly gateRows: number;
    readonly metricRows: number;
  }> {
    this.#assertOpen();
    const result = await this.#pool.query<{
      outcome: {
        aggregate_rows: number;
        gate_rows: number;
        metric_rows: number;
      };
    }>(
      `SELECT daily_energy.rebuild_c015_analytics_date(
         $1::date,$2::date,$3::text,$4::bigint,$5::timestamptz
       ) AS outcome`,
      [
        input.productDate,
        input.finalizedProductDate,
        input.environment,
        input.aggregationRevision,
        input.generatedAt,
      ],
    );
    const outcome = result.rows[0]?.outcome;
    if (outcome === undefined) {
      throw new Error("ANALYTICS_REBUILD_OUTCOME_MISSING");
    }
    return {
      aggregateRows: Number(outcome.aggregate_rows),
      gateRows: Number(outcome.gate_rows),
      metricRows: Number(outcome.metric_rows),
    };
  }

  public async purgeExpired(
    input: Parameters<AnalyticsBatchStore["purgeExpired"]>[0],
  ): Promise<{ readonly deletedRows: number }> {
    this.#assertOpen();
    const result = await this.#pool.query<{ deletedRows: bigint }>(
      `SELECT daily_energy.execute_c015_analytics_retention(
         $1::bigint,$2::timestamptz
       ) AS "deletedRows"`,
      [input.revision, input.executedAt],
    );
    return { deletedRows: Number(result.rows[0]?.deletedRows ?? 0n) };
  }

  public async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#pool.end();
    }
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("ANALYTICS_STORE_CLOSED");
    }
  }
}

export const UNAVAILABLE_ANALYTICS_AGGREGATE_STORE: AnalyticsAggregateStore = {
  close: async () => undefined,
  publishClientSignalDelta: async () => {
    throw new Error("ANALYTICS_STORE_UNAVAILABLE");
  },
};
