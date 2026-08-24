import type { GenerationIntentStatus } from "@daily-energy/shared-schemas";
import {
  decideGenerationClaimV1,
  type GenerationGuardSnapshotV1,
} from "@daily-energy/server-core/generation";

import { CURRENT_NECESSARY_CONSENT_NOTICE_VERSION } from "../consent-profile/postgres-consent-profile-store.js";
import {
  QueueRetryableError,
  QueueTerminalError,
  type QueueJobHandler,
  type QueueTransaction,
  type VersionedJobEnvelope,
} from "../queue/contracts.js";
import { parseGenerationGuardSnapshot } from "./guard-snapshot.js";

const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const GENERATION_LOCK_SEED = 20_008;

type IntentClaimRow = Readonly<Record<string, unknown>> & {
  readonly accountId: string;
  readonly productDate: string;
  readonly revision: number;
  readonly state: GenerationIntentStatus;
};

type GuardRow = Readonly<Record<string, unknown>> & {
  readonly snapshot: unknown;
};

const EXECUTABLE_OUTCOMES = new Set([
  "GENERATION_CLAIMED",
  "GENERATION_RESUMED",
]);

export interface DailyGenerationExecutor {
  executeIntent(intentRef: string): Promise<unknown>;
}

export function createInteractiveGenerationHandlers(
  runtime: DailyGenerationExecutor,
): readonly QueueJobHandler[] {
  return Object.freeze([
    generationHandler("GenerationIntentAccepted", runtime),
    generationHandler("GenerationIntentDue", runtime),
  ]);
}

function generationHandler(
  eventType: "GenerationIntentAccepted" | "GenerationIntentDue",
  runtime: DailyGenerationExecutor,
): QueueJobHandler {
  return Object.freeze({
    eventType,
    eventVersion: "v1" as const,
    async handle(
      envelope: VersionedJobEnvelope,
      transaction: QueueTransaction,
    ): Promise<string> {
      return claimGenerationIntent(transaction, envelope);
    },
    async afterCommit(
      envelope: VersionedJobEnvelope,
      outcomeCode: string,
    ): Promise<void> {
      if (EXECUTABLE_OUTCOMES.has(outcomeCode)) {
        await runtime.executeIntent(envelope.aggregateRef);
      }
    },
  });
}

async function claimGenerationIntent(
  transaction: QueueTransaction,
  envelope: VersionedJobEnvelope,
): Promise<string> {
  const initial = await readIntent(transaction, envelope.aggregateRef, false);
  if (initial === undefined) {
    throw new QueueTerminalError("TERMINAL_INTENT_NOT_FOUND");
  }
  await transaction.execute(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
    [initial.accountId, ACCOUNT_GUARD_LOCK_SEED],
  );
  await transaction.execute(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
    [`${initial.accountId}:${initial.productDate}`, GENERATION_LOCK_SEED],
  );
  const current = await readIntent(transaction, envelope.aggregateRef, true);
  if (current === undefined || current.accountId !== initial.accountId) {
    throw new QueueRetryableError("GENERATION_CLAIM_LOST");
  }
  const guard = await readGuard(transaction, current);
  const decision = decideGenerationClaimV1({
    currentRevision: current.revision,
    envelopeRevision: envelope.aggregateRevision,
    guardMatches: guardMatchesEnvelope(envelope.guardEpochs, guard),
    guardStatus: guard.status,
    state: current.state,
  });
  switch (decision.outcome) {
    case "CLAIM": {
      const updated = await transaction.execute(
        `UPDATE daily_energy.app_generation_intent
            SET state='RUNNING',revision=$2,"terminalReasonCode"=NULL,
                "updatedAt"=now()
          WHERE id=$1::uuid AND revision=$3
            AND state IN ('QUEUED','RETRYABLE_FAILED')`,
        [envelope.aggregateRef, decision.nextRevision, current.revision],
      );
      if (updated.rowCount !== 1) {
        throw new QueueRetryableError("GENERATION_CLAIM_LOST");
      }
      return "GENERATION_CLAIMED";
    }
    case "RESUME":
      return "GENERATION_RESUMED";
    case "RETURN_EXISTING":
      return "GENERATION_EXISTS";
    case "BLOCKED": {
      await cancelActiveIntent(
        transaction,
        envelope.aggregateRef,
        decision.reasonCode,
      );
      return "GENERATION_BLOCKED";
    }
    case "CANCELLED":
      return "GENERATION_CANCELLED";
    case "TERMINAL":
      return "GENERATION_TERMINAL";
    case "STALE":
      return "GENERATION_STALE";
  }
}

async function readIntent(
  transaction: QueueTransaction,
  intentRef: string,
  lock: boolean,
): Promise<IntentClaimRow | undefined> {
  const result = await transaction.execute<IntentClaimRow>(
    `SELECT "accountId","targetProductDate"::text AS "productDate",
            revision,state::text AS state
       FROM daily_energy.app_generation_intent
      WHERE id=$1::uuid${lock ? " FOR UPDATE" : ""}`,
    [intentRef],
  );
  return result.rows[0];
}

async function readGuard(
  transaction: QueueTransaction,
  intent: IntentClaimRow,
): Promise<GenerationGuardSnapshotV1> {
  const result = await transaction.execute<GuardRow>(
    `SELECT daily_energy.resolve_generation_guard_snapshot(
       $1::uuid,$2::date,$3::text
     ) AS snapshot`,
    [
      intent.accountId,
      intent.productDate,
      CURRENT_NECESSARY_CONSENT_NOTICE_VERSION,
    ],
  );
  try {
    return parseGenerationGuardSnapshot(result.rows[0]?.snapshot);
  } catch {
    throw new QueueTerminalError("TERMINAL_GUARD_INVALID");
  }
}

function guardMatchesEnvelope(
  epochs: Readonly<Record<string, string>>,
  guard: GenerationGuardSnapshotV1,
): boolean {
  if (
    Object.keys(epochs).some((key) => key !== "deletion" && key !== "safety")
  ) {
    throw new QueueTerminalError("TERMINAL_GUARD_EPOCHS");
  }
  return (
    (epochs.deletion === undefined ||
      epochs.deletion === guard.deletionEpoch.toString()) &&
    (epochs.safety === undefined ||
      epochs.safety === guard.safetyEpoch.toString())
  );
}

async function cancelActiveIntent(
  transaction: QueueTransaction,
  intentRef: string,
  reasonCode: string,
): Promise<void> {
  await transaction.execute(
    `UPDATE daily_energy.app_generation_intent
        SET state='CANCELLED',revision=revision+1,
            "terminalReasonCode"=$2,"updatedAt"=now()
      WHERE id=$1::uuid
        AND state IN ('QUEUED','RUNNING','FALLBACK_RUNNING','RETRYABLE_FAILED')`,
    [intentRef, boundedReason(reasonCode)],
  );
}

function boundedReason(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_]/gu, "_")
    .slice(0, 64);
}
