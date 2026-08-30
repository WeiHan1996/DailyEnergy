import { describe, expect, it } from "vitest";

import type {
  QueueTransactionResult,
  QueueTransaction,
  VersionedJobEnvelope,
} from "../queue/contracts.js";
import { createAnalyticsHandlers } from "./analytics-handler.js";

const envelope = (eventType: string): VersionedJobEnvelope => ({
  aggregateRef: "00000000-0000-4000-8000-000000000015",
  aggregateRevision: 2,
  contract: "dailyenergy.job",
  eventId: "00000000-0000-4000-8000-000000000016",
  eventType,
  eventVersion: "v1",
  guardEpochs: {},
  occurredAt: "2026-08-30T22:00:00.000Z",
  queueVersion: 1,
});

describe("C-015 background analytics handlers", () => {
  it("rebuilds only the previous finalized product date with no subject payload", async () => {
    const calls: { statement: string; values?: readonly unknown[] }[] = [];
    const transaction: QueueTransaction = {
      execute: async <Row extends Readonly<Record<string, unknown>>>(
        statement: string,
        values?: readonly unknown[],
      ) => {
        calls.push({ statement, ...(values === undefined ? {} : { values }) });
        return {
          rowCount: 1,
          rows: [
            {
              outcome: {
                aggregate_rows: 12,
                gate_rows: 4,
                metric_rows: 23,
              },
            },
          ],
        } as unknown as QueueTransactionResult<Row>;
      },
    };
    const handler = createAnalyticsHandlers("TEST").find(
      ({ eventType }) => eventType === "AnalyticsAggregationDue",
    )!;
    await expect(
      handler.handle(envelope(handler.eventType), transaction),
    ).resolves.toBe("ANALYTICS_REBUILT");
    expect(calls[0]).toMatchObject({
      statement: expect.stringContaining("rebuild_c015_analytics_date"),
      values: [
        "2026-08-30",
        "2026-08-31",
        "TEST",
        2,
        new Date("2026-08-30T22:00:00.000Z"),
      ],
    });
    expect(JSON.stringify(calls)).not.toMatch(
      /account|owner|subject|session|device|note|prompt/iu,
    );
  });

  it("routes retention to the closed TTL function", async () => {
    const calls: string[] = [];
    const transaction: QueueTransaction = {
      execute: async <Row extends Readonly<Record<string, unknown>>>(
        statement: string,
      ) => {
        calls.push(statement);
        return { rowCount: 1, rows: [] } as QueueTransactionResult<Row>;
      },
    };
    const handler = createAnalyticsHandlers("PROD").find(
      ({ eventType }) => eventType === "AnalyticsRetentionDue",
    )!;
    await expect(
      handler.handle(envelope(handler.eventType), transaction),
    ).resolves.toBe("ANALYTICS_RETENTION_EXECUTED");
    expect(calls[0]).toContain("execute_c015_analytics_retention");
  });
});
