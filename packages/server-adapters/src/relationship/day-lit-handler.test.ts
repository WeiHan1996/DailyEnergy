import { describe, expect, it, vi } from "vitest";
import type { GenerationGuardSnapshotV1 } from "@daily-energy/server-core/generation";

import type {
  QueueTransaction,
  QueueTransactionResult,
  VersionedJobEnvelope,
} from "../queue/contracts.js";
import { createDayLitHandlers } from "./day-lit-handler.js";

const LIGHT_REF = "00000000-0000-4000-8000-000000000201";
const EVENT_REF = "00000000-0000-4000-8000-000000000202";
const ACCOUNT_REF = "00000000-0000-4000-8000-000000000203";
const CYCLE_REF = "00000000-0000-4000-8000-000000000204";

function envelope(
  guardEpochs: Readonly<Record<string, string>> = {
    deletion: "2",
    safety: "3",
  },
): VersionedJobEnvelope {
  return {
    aggregateRef: LIGHT_REF,
    aggregateRevision: 1,
    contract: "dailyenergy.job",
    eventId: EVENT_REF,
    eventType: "DayLit",
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
  readonly cutoffAt?: Date;
  readonly guardDeletionEpoch?: string;
  readonly guardSafetyEpoch?: string;
  readonly guardStatus?: GenerationGuardSnapshotV1["status"];
  readonly relationshipBlocked?: boolean;
  readonly relationshipEpoch?: string;
  readonly cycleCutoff?: string;
  readonly linkInserted?: boolean;
  readonly sourceLitAt?: Date;
}) {
  const execute = vi.fn();
  const source = {
    accountCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
    accountId: ACCOUNT_REF,
    litAt: input.sourceLitAt ?? new Date("2026-08-24T02:00:00.000Z"),
    productDate: "2026-08-24",
    sourceValidityRevision: 1,
  };
  const value: QueueTransaction = {
    async execute<Row extends Readonly<Record<string, unknown>>>(
      statement: string,
      values?: readonly unknown[],
    ): Promise<QueueTransactionResult<Row>> {
      execute(statement, values);
      if (statement.includes("FROM daily_energy.app_daily_light_fact light")) {
        return result([source]) as unknown as QueueTransactionResult<Row>;
      }
      if (statement.includes("resolve_generation_guard_snapshot")) {
        return result([
          {
            snapshot: {
              account_revision: 1,
              deletion_epoch: input.guardDeletionEpoch ?? "2",
              deletion_revision: 2,
              safety_epoch: input.guardSafetyEpoch ?? "3",
              safety_revision: 3,
              status: input.guardStatus ?? "ALLOWED",
            },
          },
        ]) as unknown as QueueTransactionResult<Row>;
      }
      if (statement.includes("resolve_c011_relationship_guard")) {
        return result([
          {
            snapshot: {
              blocked: input.relationshipBlocked ?? false,
              cutoff_at: (
                input.cutoffAt ?? source.accountCreatedAt
              ).toISOString(),
              deletion_epoch: input.relationshipEpoch ?? "0",
            },
          },
        ]) as unknown as QueueTransactionResult<Row>;
      }
      if (statement.includes("FROM daily_energy.app_relationship_cycle")) {
        return result([
          {
            cycleId: CYCLE_REF,
            revision: 1,
            sourceCutoffEpoch: input.cycleCutoff ?? "0",
            startedAt: input.cutoffAt ?? source.accountCreatedAt,
          },
        ]) as unknown as QueueTransactionResult<Row>;
      }
      if (
        statement.includes(
          "INSERT INTO daily_energy.app_relationship_encounter_link",
        )
      ) {
        return result(
          [],
          input.linkInserted === false ? 0 : 1,
        ) as QueueTransactionResult<Row>;
      }
      if (statement.includes('SELECT link."sourceLightId"')) {
        return result([
          {
            productDate: source.productDate,
            sourceLightId: LIGHT_REF,
            sourceValidityRevision: 1,
          },
        ]) as unknown as QueueTransactionResult<Row>;
      }
      if (statement.includes("UPDATE daily_energy.app_relationship_cycle")) {
        return result([], 1) as QueueTransactionResult<Row>;
      }
      return result([]) as QueueTransactionResult<Row>;
    },
  };
  return { execute, value };
}

describe("C-011 DayLit relationship handler", () => {
  it("links one valid source and updates the deterministic projection", async () => {
    const database = transaction({});
    const handler = createDayLitHandlers()[0]!;
    await expect(handler.handle(envelope(), database.value)).resolves.toBe(
      "RELATIONSHIP_LINKED",
    );
    expect(
      database.execute.mock.calls.some(([statement]) =>
        String(statement).includes("app_relationship_encounter_link"),
      ),
    ).toBe(true);
    expect(
      database.execute.mock.calls.some(([statement]) =>
        String(statement).includes("projectionFingerprint"),
      ),
    ).toBe(true);
  });

  it("returns the existing link on replay without advancing projection", async () => {
    const database = transaction({ linkInserted: false });
    const handler = createDayLitHandlers()[0]!;
    await expect(handler.handle(envelope(), database.value)).resolves.toBe(
      "RELATIONSHIP_EXISTS",
    );
    expect(
      database.execute.mock.calls.some(([statement]) =>
        String(statement).includes(
          "UPDATE daily_energy.app_relationship_cycle",
        ),
      ),
    ).toBe(false);
  });

  it("rejects stale and post-deletion replay sources", async () => {
    const stale = transaction({});
    const handler = createDayLitHandlers()[0]!;
    await expect(
      handler.handle(envelope({ deletion: "1", safety: "3" }), stale.value),
    ).resolves.toBe("SOURCE_STALE");

    const cutoff = transaction({
      cycleCutoff: "1",
      relationshipEpoch: "2",
    });
    await expect(handler.handle(envelope(), cutoff.value)).resolves.toBe(
      "SOURCE_BEFORE_CUTOFF",
    );

    const exactCutoff = new Date("2026-08-24T02:00:00.000Z");
    const equal = transaction({
      cutoffAt: exactCutoff,
      sourceLitAt: exactCutoff,
    });
    await expect(handler.handle(envelope(), equal.value)).resolves.toBe(
      "SOURCE_BEFORE_CUTOFF",
    );
  });

  it("retries reversible guards and converges after Safety clears", async () => {
    const handler = createDayLitHandlers()[0]!;
    for (const guardStatus of [
      "SAFETY_BLOCKED",
      "CONSENT_REQUIRED",
      "ACCOUNT_RESTRICTED",
    ] as const) {
      const blocked = transaction({ guardStatus });
      await expect(handler.handle(envelope(), blocked.value)).resolves.toBe(
        "SOURCE_DEFERRED",
      );
      expect(blocked.execute).toHaveBeenCalledWith(
        expect.stringContaining("runtime_outbox_event"),
        expect.arrayContaining([LIGHT_REF, 1, EVENT_REF]),
      );
    }

    const cleared = transaction({ guardSafetyEpoch: "4" });
    await expect(handler.handle(envelope(), cleared.value)).resolves.toBe(
      "RELATIONSHIP_LINKED",
    );
  });
});
