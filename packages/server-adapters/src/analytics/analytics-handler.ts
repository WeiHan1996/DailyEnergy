import type { AnalyticsEnvironment } from "@daily-energy/shared-schemas";
import { resolveProductDate } from "@daily-energy/server-core/product-time";

import type {
  QueueJobHandler,
  QueueTransaction,
  VersionedJobEnvelope,
} from "../queue/contracts.js";

interface RebuildRow extends Readonly<Record<string, unknown>> {
  readonly outcome: {
    readonly aggregate_rows: number;
    readonly gate_rows: number;
    readonly metric_rows: number;
  };
}

export function createAnalyticsHandlers(
  environment: AnalyticsEnvironment = workerAnalyticsEnvironment(
    process.env.DAILYENERGY_WORKER_TELEMETRY_ENVIRONMENT,
  ),
): readonly QueueJobHandler[] {
  return Object.freeze([
    Object.freeze({
      eventType: "AnalyticsAggregationDue",
      eventVersion: "v1" as const,
      handle: (envelope: VersionedJobEnvelope, transaction: QueueTransaction) =>
        rebuildAnalytics(envelope, transaction, environment),
    }),
    Object.freeze({
      eventType: "AnalyticsRetentionDue",
      eventVersion: "v1" as const,
      handle: purgeAnalytics,
    }),
  ]);
}

async function rebuildAnalytics(
  envelope: VersionedJobEnvelope,
  transaction: QueueTransaction,
  environment: AnalyticsEnvironment,
): Promise<string> {
  const occurredAt = new Date(envelope.occurredAt);
  const finalizedProductDate = resolveProductDate(occurredAt).productDate;
  const productDate = previousProductDate(finalizedProductDate);
  const result = await transaction.execute<RebuildRow>(
    `SELECT daily_energy.rebuild_c015_analytics_date(
       $1::date,$2::date,$3::text,$4::bigint,$5::timestamptz
     ) AS outcome`,
    [
      productDate,
      finalizedProductDate,
      environment,
      envelope.aggregateRevision,
      occurredAt,
    ],
  );
  const outcome = result.rows[0]?.outcome;
  if (
    outcome === undefined ||
    !Number.isInteger(Number(outcome.aggregate_rows)) ||
    Number(outcome.metric_rows) !== 23 ||
    Number(outcome.gate_rows) !== 4
  ) {
    throw new Error("ANALYTICS_REBUILD_OUTCOME_INVALID");
  }
  return "ANALYTICS_REBUILT";
}

async function purgeAnalytics(
  envelope: VersionedJobEnvelope,
  transaction: QueueTransaction,
): Promise<string> {
  await transaction.execute(
    `SELECT daily_energy.execute_c015_analytics_retention(
       $1::bigint,$2::timestamptz
     ) AS deleted`,
    [envelope.aggregateRevision, new Date(envelope.occurredAt)],
  );
  return "ANALYTICS_RETENTION_EXECUTED";
}

function previousProductDate(productDate: string): string {
  const value = new Date(`${productDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function workerAnalyticsEnvironment(
  value: string | undefined,
): AnalyticsEnvironment {
  if (value === "PRODUCTION" || value === "RECOVERY") {
    return "PROD";
  }
  if (value === "STAGING") {
    return "STAGING";
  }
  if (value === "CI") {
    return "TEST";
  }
  return "DEV";
}
