import { createHash } from "node:crypto";

import type { GenerationGuardSnapshotV1 } from "@daily-energy/server-core/generation";

import { parseGenerationGuardSnapshot } from "../generation/guard-snapshot.js";
import {
  QueueRetryableError,
  type QueueJobHandler,
  type QueueTransaction,
  type VersionedJobEnvelope,
} from "../queue/contracts.js";

const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const RETENTION_POLICY_VERSION = "retention-policy-v1";

type SourceRow = Readonly<Record<string, unknown>> & {
  readonly accountCreatedAt: Date;
  readonly accountId: string;
  readonly litAt: Date;
  readonly productDate: string;
  readonly sourceValidityRevision: number;
};

type CycleRow = Readonly<Record<string, unknown>> & {
  readonly cycleId: string;
  readonly revision: number;
  readonly sourceCutoffEpoch: string;
  readonly startedAt: Date;
};

type GuardRow = Readonly<Record<string, unknown>> & {
  readonly snapshot: unknown;
};

type RelationshipGuardRow = Readonly<Record<string, unknown>> & {
  readonly snapshot: unknown;
};

interface RelationshipGuardSnapshot {
  readonly blocked: boolean;
  readonly cutoffAt: Date;
  readonly deletionEpoch: string;
}

const TRANSIENT_SOURCE_GUARDS = new Set<GenerationGuardSnapshotV1["status"]>([
  "ACCOUNT_RESTRICTED",
  "CONSENT_REQUIRED",
  "SAFETY_BLOCKED",
]);

type LinkFingerprintRow = Readonly<Record<string, unknown>> & {
  readonly productDate: string;
  readonly sourceLightId: string;
  readonly sourceValidityRevision: number;
};

export function createDayLitHandlers(): readonly QueueJobHandler[] {
  return Object.freeze([
    Object.freeze({
      eventType: "DayLit",
      eventVersion: "v1" as const,
      handle: handleDayLit,
    }),
  ]);
}

async function handleDayLit(
  envelope: VersionedJobEnvelope,
  transaction: QueueTransaction,
): Promise<string> {
  const initial = await readSource(transaction, envelope.aggregateRef, false);
  if (initial === undefined) {
    return "SOURCE_MISSING";
  }
  await transaction.execute(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
    [initial.accountId, ACCOUNT_GUARD_LOCK_SEED],
  );
  const source = await readSource(transaction, envelope.aggregateRef, true);
  if (source === undefined || source.accountId !== initial.accountId) {
    throw new QueueRetryableError("RELATIONSHIP_SOURCE_CHANGED");
  }
  const guard = await readGuard(transaction, source);
  if (guard.status !== "ALLOWED") {
    if (TRANSIENT_SOURCE_GUARDS.has(guard.status)) {
      await deferDayLit(transaction, envelope, guard);
      return "SOURCE_DEFERRED";
    }
    return "SOURCE_BLOCKED";
  }
  if (
    envelope.aggregateRevision !== source.sourceValidityRevision ||
    !deletionEpochMatches(envelope.guardEpochs, guard)
  ) {
    return "SOURCE_STALE";
  }
  const relationshipGuard = await readRelationshipGuard(
    transaction,
    source.accountId,
  );
  if (relationshipGuard.blocked) {
    return "RELATIONSHIP_BLOCKED";
  }
  await transaction.execute(
    `INSERT INTO daily_energy.app_relationship_cycle
      (id,"accountId",revision,"startedAt","sourceCutoffEpoch",state,
       "activeSlot","projectionFingerprint","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt")
     VALUES (gen_random_uuid(),$1::uuid,1,$2::timestamptz,$3::bigint,'ACTIVE',
             true,$4,$5,'RELATIONSHIP_DATA',$2::timestamptz)
     ON CONFLICT ("accountId","activeSlot") DO NOTHING`,
    [
      source.accountId,
      relationshipGuard.cutoffAt,
      relationshipGuard.deletionEpoch,
      relationshipFingerprint([]),
      RETENTION_POLICY_VERSION,
    ],
  );
  const cycle = await readActiveCycle(transaction, source.accountId);
  if (cycle === undefined) {
    throw new QueueRetryableError("RELATIONSHIP_CYCLE_MISSING");
  }
  if (
    source.litAt.getTime() <= cycle.startedAt.getTime() ||
    BigInt(relationshipGuard.deletionEpoch) > BigInt(cycle.sourceCutoffEpoch)
  ) {
    return "SOURCE_BEFORE_CUTOFF";
  }
  const inserted = await transaction.execute(
    `INSERT INTO daily_energy.app_relationship_encounter_link
      (id,"cycleId","sourceLightId","productDate","sourceValidityRevision",
       "sourceEventId","retentionPolicyVersion","retentionScope",
       "retentionAnchorAt")
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,$3::date,$4,$5::uuid,$6,
             'RELATIONSHIP_DATA',$7::timestamptz)
     ON CONFLICT DO NOTHING`,
    [
      cycle.cycleId,
      envelope.aggregateRef,
      source.productDate,
      source.sourceValidityRevision,
      envelope.eventId,
      RETENTION_POLICY_VERSION,
      envelope.occurredAt,
    ],
  );
  if (inserted.rowCount === 0) {
    return "RELATIONSHIP_EXISTS";
  }
  const links = await transaction.execute<LinkFingerprintRow>(
    `SELECT link."sourceLightId",link."productDate"::text AS "productDate",
            link."sourceValidityRevision"
       FROM daily_energy.app_relationship_encounter_link link
       JOIN daily_energy.app_daily_light_fact light
         ON light.id=link."sourceLightId"
        AND light."sourceValidityRevision"=link."sourceValidityRevision"
      WHERE link."cycleId"=$1::uuid
      ORDER BY link."productDate",link."sourceLightId"`,
    [cycle.cycleId],
  );
  const updated = await transaction.execute(
    `UPDATE daily_energy.app_relationship_cycle
        SET revision=revision+1,"projectionFingerprint"=$2
      WHERE id=$1::uuid AND revision=$3 AND state='ACTIVE'
        AND "activeSlot" IS TRUE`,
    [cycle.cycleId, relationshipFingerprint(links.rows), cycle.revision],
  );
  if (updated.rowCount !== 1) {
    throw new QueueRetryableError("RELATIONSHIP_PROJECTION_CAS_LOST");
  }
  return "RELATIONSHIP_LINKED";
}

async function deferDayLit(
  transaction: QueueTransaction,
  envelope: VersionedJobEnvelope,
  guard: GenerationGuardSnapshotV1,
): Promise<void> {
  await transaction.execute(
    `WITH timing AS (SELECT clock_timestamp() AS now)
     INSERT INTO daily_energy.runtime_outbox_event
       (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
        "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
        state,"availableAt","attemptCount","createdAt","retentionPolicyVersion",
        "retentionScope","retentionAnchorAt","expiresAt")
     SELECT gen_random_uuid(),'DailyLight',$1::uuid,$2,'DayLit','v1',
       decode(md5('c011:daylit-deferred:'||$3::text),'hex'),'{}'::jsonb,
       jsonb_build_object('deletion',$4::text,'safety',$5::text),'PENDING',
       timing.now+interval '1 hour',0,timing.now,$6,'RUNTIME',timing.now,
       timing.now+interval '30 days'
     FROM timing
     ON CONFLICT ("idempotencyKey") DO NOTHING`,
    [
      envelope.aggregateRef,
      envelope.aggregateRevision,
      envelope.eventId,
      guard.deletionEpoch.toString(),
      guard.safetyEpoch.toString(),
      RETENTION_POLICY_VERSION,
    ],
  );
}

async function readSource(
  transaction: QueueTransaction,
  lightId: string,
  lock: boolean,
): Promise<SourceRow | undefined> {
  const result = await transaction.execute<SourceRow>(
    `SELECT interaction."accountId",interaction."productDate"::text AS "productDate",
            account."createdAt" AS "accountCreatedAt",light."litAt",
            light."sourceValidityRevision"
       FROM daily_energy.app_daily_light_fact light
       JOIN daily_energy.app_daily_interaction interaction
         ON interaction.id=light."interactionId"
       JOIN daily_energy.app_user_account account
         ON account.id=interaction."accountId"
       JOIN daily_energy.app_published_result_visibility visibility
         ON visibility."resultId"=interaction."resultId"
        AND visibility.state='AVAILABLE'
      WHERE light.id=$1::uuid${lock ? " FOR SHARE OF light,interaction,account,visibility" : ""}`,
    [lightId],
  );
  return result.rows[0];
}

async function readGuard(
  transaction: QueueTransaction,
  source: SourceRow,
): Promise<GenerationGuardSnapshotV1> {
  const result = await transaction.execute<GuardRow>(
    `SELECT daily_energy.resolve_generation_guard_snapshot(
       $1::uuid,$2::date,'necessary-consent-v1'
     ) AS snapshot`,
    [source.accountId, source.productDate],
  );
  return parseGenerationGuardSnapshot(result.rows[0]?.snapshot);
}

async function readRelationshipGuard(
  transaction: QueueTransaction,
  accountId: string,
): Promise<RelationshipGuardSnapshot> {
  const result = await transaction.execute<RelationshipGuardRow>(
    `SELECT daily_energy.resolve_c011_relationship_guard($1::uuid) AS snapshot`,
    [accountId],
  );
  const snapshot = result.rows[0]?.snapshot;
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    throw new QueueRetryableError("RELATIONSHIP_GUARD_INVALID");
  }
  const value = snapshot as Record<string, unknown>;
  if (
    typeof value.blocked !== "boolean" ||
    typeof value.deletion_epoch !== "string" ||
    !/^(0|[1-9][0-9]*)$/u.test(value.deletion_epoch) ||
    typeof value.cutoff_at !== "string" ||
    !Number.isFinite(Date.parse(value.cutoff_at))
  ) {
    throw new QueueRetryableError("RELATIONSHIP_GUARD_INVALID");
  }
  return {
    blocked: value.blocked,
    cutoffAt: new Date(value.cutoff_at),
    deletionEpoch: value.deletion_epoch,
  };
}

async function readActiveCycle(
  transaction: QueueTransaction,
  accountId: string,
): Promise<CycleRow | undefined> {
  const result = await transaction.execute<CycleRow>(
    `SELECT id AS "cycleId",revision,"startedAt",
            "sourceCutoffEpoch"::text AS "sourceCutoffEpoch"
       FROM daily_energy.app_relationship_cycle
      WHERE "accountId"=$1::uuid AND "activeSlot" IS TRUE AND state='ACTIVE'
      FOR UPDATE`,
    [accountId],
  );
  return result.rows[0];
}

function deletionEpochMatches(
  epochs: Readonly<Record<string, string>>,
  guard: GenerationGuardSnapshotV1,
): boolean {
  return (
    Object.keys(epochs).every(
      (key) => key === "deletion" || key === "safety",
    ) &&
    (epochs.deletion === undefined ||
      epochs.deletion === guard.deletionEpoch.toString())
  );
}

function relationshipFingerprint(rows: readonly LinkFingerprintRow[]): Buffer {
  const source = rows
    .map(
      (row) =>
        `${row.productDate}:${row.sourceLightId}:${row.sourceValidityRevision}`,
    )
    .join("|");
  return createHash("sha256")
    .update(`relationship-projection-v1|${source}`, "utf8")
    .digest();
}
