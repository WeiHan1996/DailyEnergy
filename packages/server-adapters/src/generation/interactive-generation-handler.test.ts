import { describe, expect, it, vi } from "vitest";

import type {
  QueueTransaction,
  QueueTransactionResult,
  VersionedJobEnvelope,
} from "../queue/contracts.js";
import { createInteractiveGenerationHandlers } from "./interactive-generation-handler.js";

const INTENT_REF = "00000000-0000-4000-8000-000000000101";
const EVENT_REF = "00000000-0000-4000-8000-000000000102";
const ACCOUNT_REF = "00000000-0000-4000-8000-000000000103";

function envelope(
  guardEpochs: Readonly<Record<string, string>> = {
    deletion: "2",
    safety: "3",
  },
): VersionedJobEnvelope {
  return {
    aggregateRef: INTENT_REF,
    aggregateRevision: 1,
    contract: "dailyenergy.job",
    eventId: EVENT_REF,
    eventType: "GenerationIntentAccepted",
    eventVersion: "v1",
    guardEpochs,
    occurredAt: "2026-08-24T02:00:00.000Z",
    queueVersion: 1,
  };
}

function result<Row extends Readonly<Record<string, unknown>>>(
  rows: readonly Row[],
  rowCount = rows.length,
): QueueTransactionResult<Row> {
  return { rowCount, rows };
}

function transaction(input: {
  readonly guardStatus?: string;
  readonly safetyEpoch?: string;
}) {
  let reads = 0;
  const execute = vi.fn();
  const value: QueueTransaction = {
    async execute<Row extends Readonly<Record<string, unknown>>>(
      statement: string,
      values?: readonly unknown[],
    ): Promise<QueueTransactionResult<Row>> {
      execute(statement, values);
      if (statement.includes("FROM daily_energy.app_generation_intent")) {
        reads += 1;
        return result([
          {
            accountId: ACCOUNT_REF,
            productDate: "2026-08-24",
            revision: 1,
            state: "QUEUED",
          },
        ]) as unknown as QueueTransactionResult<Row>;
      }
      if (statement.includes("resolve_generation_guard_snapshot")) {
        return result([
          {
            snapshot: {
              account_revision: 1,
              deletion_epoch: "2",
              deletion_revision: 2,
              safety_epoch: input.safetyEpoch ?? "3",
              safety_revision: 3,
              status: input.guardStatus ?? "ALLOWED",
            },
          },
        ]) as unknown as QueueTransactionResult<Row>;
      }
      if (statement.includes("SET state='RUNNING'")) {
        return result([], 1) as QueueTransactionResult<Row>;
      }
      return result([]) as QueueTransactionResult<Row>;
    },
  };
  return {
    execute,
    get intentReads() {
      return reads;
    },
    value,
  };
}

describe("interactive generation handler", () => {
  it("claims inside the inbox transaction and executes only after commit", async () => {
    const database = transaction({});
    const executeIntent = vi.fn(async () => "PUBLISHED");
    const handler = createInteractiveGenerationHandlers({ executeIntent })[0]!;

    await expect(handler.handle(envelope(), database.value)).resolves.toBe(
      "GENERATION_CLAIMED",
    );
    expect(database.intentReads).toBe(2);
    expect(executeIntent).not.toHaveBeenCalled();

    await handler.afterCommit?.(envelope(), "GENERATION_CLAIMED");
    await handler.afterCommit?.(envelope(), "GENERATION_CLAIMED");
    expect(executeIntent).toHaveBeenCalledTimes(2);
    expect(executeIntent).toHaveBeenCalledWith(INTENT_REF);
  });

  it("cancels a stale-epoch event without executing generation", async () => {
    const database = transaction({ safetyEpoch: "4" });
    const executeIntent = vi.fn(async () => "PUBLISHED");
    const handler = createInteractiveGenerationHandlers({ executeIntent })[0]!;

    await expect(handler.handle(envelope(), database.value)).resolves.toBe(
      "GENERATION_BLOCKED",
    );
    expect(
      database.execute.mock.calls.some(([statement]) =>
        String(statement).includes("SET state='CANCELLED'"),
      ),
    ).toBe(true);

    await handler.afterCommit?.(envelope(), "GENERATION_BLOCKED");
    expect(executeIntent).not.toHaveBeenCalled();
  });

  it("rejects unrecognized generation guard epochs", async () => {
    const database = transaction({});
    const handler = createInteractiveGenerationHandlers({
      executeIntent: vi.fn(async () => "PUBLISHED"),
    })[0]!;

    await expect(
      handler.handle(envelope({ unknown: "1" }), database.value),
    ).rejects.toMatchObject({ code: "TERMINAL_GUARD_EPOCHS" });
  });
});
