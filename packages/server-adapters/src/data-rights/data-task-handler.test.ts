import { describe, expect, it, vi } from "vitest";

import type {
  QueueTransaction,
  VersionedJobEnvelope,
} from "../queue/contracts.js";
import { createDataTaskHandlers } from "./data-task-handler.js";

const envelope: VersionedJobEnvelope = {
  aggregateRef: "10000000-0000-4000-8000-000000000001",
  aggregateRevision: 3,
  contract: "dailyenergy.job",
  eventId: "10000000-0000-4000-8000-000000000002",
  eventType: "DeletionGuarded",
  eventVersion: "v1",
  guardEpochs: { deletion: "4" },
  occurredAt: "2026-08-25T01:00:00.000Z",
  queueVersion: 1,
};

describe("C-014 restricted data-task handler", () => {
  it("registers every closed restricted event capability", () => {
    expect(
      createDataTaskHandlers().map((handler) => handler.eventType),
    ).toEqual([
      "DataDeletionStarted",
      "DataRightsRetentionDue",
      "DataTaskDue",
      "DeletionGuarded",
    ]);
  });

  it("passes only task ref, revision, guard epoch and execution time", async () => {
    const calls: Array<{ statement: string; values: readonly unknown[] }> = [];
    const transaction: QueueTransaction = {
      execute: async <Row extends Readonly<Record<string, unknown>>>(
        statement: string,
        values: readonly unknown[] = [],
      ) => {
        calls.push({ statement, values });
        return {
          rowCount: 1,
          rows: [{ outcome: "SUCCEEDED" }] as unknown as Row[],
        };
      },
    };
    const handler = createDataTaskHandlers(
      () => new Date("2026-08-25T02:00:00.000Z"),
    ).find((candidate) => candidate.eventType === "DeletionGuarded");
    await expect(handler?.handle(envelope, transaction)).resolves.toBe(
      "SUCCEEDED",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.values).toEqual([
      envelope.aggregateRef,
      3,
      "4",
      new Date("2026-08-25T02:00:00.000Z"),
    ]);
    expect(JSON.stringify(calls)).not.toMatch(
      /openid|note|checkin|ciphertext|targetKey/iu,
    );
  });

  it("freezes only the revision vector and finalizes a body-free export manifest", async () => {
    const calls: Array<{ statement: string; values: readonly unknown[] }> = [];
    const outcomes: unknown[] = [
      { outcome: "EXPORT_PREPARING" },
      {
        sourceRevisionVector: {
          account: [4, "ACTIVE"],
          days: [["2026-08-25", 2]],
        },
      },
      { outcome: "SUCCEEDED" },
    ];
    const transaction: QueueTransaction = {
      execute: async <Row extends Readonly<Record<string, unknown>>>(
        statement: string,
        values: readonly unknown[] = [],
      ) => {
        calls.push({ statement, values });
        return {
          rowCount: 1,
          rows: [outcomes.shift()] as unknown as Row[],
        };
      },
    };
    const handler = createDataTaskHandlers(
      () => new Date("2026-08-25T02:00:00.000Z"),
    ).find((candidate) => candidate.eventType === "DataTaskDue");
    await expect(handler?.handle(envelope, transaction)).resolves.toBe(
      "SUCCEEDED",
    );
    expect(calls).toHaveLength(3);
    expect(calls[1]?.statement).toContain("get_c014_export_source_vector");
    expect(calls[2]?.statement).toContain("finalize_c014_export_task");
    expect(calls[2]?.values[3]).toBeInstanceOf(Buffer);
    expect((calls[2]?.values[3] as Buffer).byteLength).toBe(32);
    expect(calls[2]?.values[4]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(JSON.stringify(calls)).not.toMatch(
      /preferred_name|evening_note|matter_title|expression_core_payload/iu,
    );
  });

  it("routes retention due only to the closed C-014 purge function", async () => {
    const execute = vi.fn(async () => ({
      rowCount: 1,
      rows: [{ outcome: "STATUS_GRANT_PURGED" }],
    }));
    const handler = createDataTaskHandlers(
      () => new Date("2026-09-01T02:00:00.000Z"),
    ).find((candidate) => candidate.eventType === "DataRightsRetentionDue");
    await expect(
      handler?.handle({ ...envelope, eventType: "DataRightsRetentionDue" }, {
        execute,
      } as QueueTransaction),
    ).resolves.toBe("STATUS_GRANT_PURGED");
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("execute_c014_data_rights_retention"),
      [envelope.aggregateRef, new Date("2026-09-01T02:00:00.000Z")],
    );
  });
});
