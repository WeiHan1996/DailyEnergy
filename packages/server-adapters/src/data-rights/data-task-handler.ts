import { createHash, randomUUID } from "node:crypto";

import type {
  QueueJobHandler,
  QueueTransaction,
  VersionedJobEnvelope,
} from "../queue/contracts.js";

const EVENT_TYPES = [
  "DataDeletionStarted",
  "DataRightsRetentionDue",
  "DataTaskDue",
  "DeletionGuarded",
] as const;

export function createDataTaskHandlers(
  now: () => Date = () => new Date(),
): readonly QueueJobHandler[] {
  return EVENT_TYPES.map((eventType) =>
    Object.freeze({
      eventType,
      eventVersion: "v1" as const,
      handle: (envelope: VersionedJobEnvelope, transaction: QueueTransaction) =>
        executeTask(envelope, transaction, now()),
    }),
  );
}

async function executeTask(
  envelope: VersionedJobEnvelope,
  transaction: QueueTransaction,
  executedAt: Date,
): Promise<string> {
  if (envelope.eventType === "DataRightsRetentionDue") {
    const result = await transaction.execute<{ readonly outcome: string }>(
      `SELECT daily_energy.execute_c014_data_rights_retention($1,$2) AS outcome`,
      [envelope.aggregateRef, executedAt],
    );
    return closedOutcome(result, "DATA_RIGHTS_RETENTION_OUTCOME_INVALID");
  }
  const deletionEpoch = envelope.guardEpochs.deletion ?? "0";
  const result = await transaction.execute<{ readonly outcome: string }>(
    `SELECT daily_energy.execute_c014_data_task($1,$2,$3::bigint,$4) AS outcome`,
    [
      envelope.aggregateRef,
      envelope.aggregateRevision,
      deletionEpoch,
      executedAt,
    ],
  );
  const outcome = result.rows[0]?.outcome;
  if (outcome === "EXPORT_PREPARING") {
    return finalizeExport(envelope, transaction, executedAt);
  }
  return closedOutcome(result, "DATA_TASK_OUTCOME_INVALID");
}

async function finalizeExport(
  envelope: VersionedJobEnvelope,
  transaction: QueueTransaction,
  executedAt: Date,
): Promise<string> {
  const source = await transaction.execute<{
    readonly sourceRevisionVector: unknown;
  }>(
    `SELECT daily_energy.get_c014_export_source_vector($1) AS "sourceRevisionVector"`,
    [envelope.aggregateRef],
  );
  const sourceRevisionVector = source.rows[0]?.sourceRevisionVector;
  if (
    source.rowCount !== 1 ||
    sourceRevisionVector === null ||
    typeof sourceRevisionVector !== "object" ||
    Array.isArray(sourceRevisionVector)
  ) {
    throw new Error("EXPORT_SOURCE_VECTOR_INVALID");
  }
  const sourceFingerprint = createHash("sha256")
    .update(stableJson(sourceRevisionVector), "utf8")
    .digest();
  const finalized = await transaction.execute<{ readonly outcome: string }>(
    `SELECT daily_energy.finalize_c014_export_task(
      $1,$2,$3::jsonb,$4,$5,$6) AS outcome`,
    [
      envelope.aggregateRef,
      envelope.aggregateRevision + 1,
      JSON.stringify(sourceRevisionVector),
      sourceFingerprint,
      randomUUID(),
      executedAt,
    ],
  );
  return closedOutcome(finalized, "EXPORT_FINALIZE_OUTCOME_INVALID");
}

function closedOutcome(
  result: {
    readonly rowCount: number;
    readonly rows: readonly { readonly outcome: string }[];
  },
  errorCode: string,
): string {
  const outcome = result.rows[0]?.outcome;
  if (
    result.rowCount !== 1 ||
    !outcome ||
    !/^[A-Z][A-Z0-9_]{0,31}$/u.test(outcome)
  ) {
    throw new Error(errorCode);
  }
  return outcome;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
