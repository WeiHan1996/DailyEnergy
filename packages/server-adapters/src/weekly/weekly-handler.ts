import { createHash } from "node:crypto";

import {
  PublishedWeeklySummarySchema,
  WeeklyAggregateFactsSchema,
  WeeklyExpressionPlanSchema,
} from "@daily-energy/shared-schemas";
import { resolveProductDate } from "@daily-energy/server-core/product-time";
import {
  deriveWeeklyAggregate,
  renderControlledWeeklyExpression,
} from "@daily-energy/server-core/weekly-reflection";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import {
  QueueRetryableError,
  QueueTerminalError,
  type QueueJobHandler,
  type QueueTransaction,
  type VersionedJobEnvelope,
} from "../queue/contracts.js";
import {
  loadWeeklySourceSnapshot,
  stableWeeklyJson,
  weeklyWindowId,
} from "./weekly-source.js";

const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const RETENTION_POLICY_VERSION = "retention-policy-v1";
const RUNTIME_TTL_MS = 30 * 24 * 60 * 60_000;

interface SourceEventRow extends Readonly<Record<string, unknown>> {
  readonly accountId: string;
  readonly productDate: string;
  readonly sourceRevision: number;
}

interface GuardSnapshot {
  readonly deletionEpoch: string;
  readonly safetyEpoch: string;
  readonly status:
    | "ACCOUNT_DELETED"
    | "ACCOUNT_DELETING"
    | "ACCOUNT_RESTRICTED"
    | "ALLOWED"
    | "CONSENT_REQUIRED"
    | "ONBOARDING_REQUIRED"
    | "SAFETY_BLOCKED";
}

interface WindowRow extends Readonly<Record<string, unknown>> {
  readonly currentSourceFingerprint: Buffer | null;
  readonly currentSummaryRef: string | null;
  readonly revision: number;
  readonly windowId: string;
}

interface IntentRow extends Readonly<Record<string, unknown>> {
  readonly accountId: string;
  readonly aggregateFactsPayload: unknown;
  readonly currentSourceFingerprint: Buffer | null;
  readonly currentSummaryRef: string | null;
  readonly expressionPlanPayload: unknown;
  readonly intentRevision: number;
  readonly intentId: string;
  readonly sourceFingerprint: Buffer;
  readonly snapshotId: string;
  readonly state: string;
  readonly windowEndDate: string;
  readonly windowId: string;
  readonly windowRevision: number;
  readonly windowStartDate: string;
}

export function createWeeklyHandlers(): readonly QueueJobHandler[] {
  return Object.freeze([
    sourceHandler("CheckinCorrected"),
    sourceHandler("DailyResultPublished"),
    sourceHandler("WeeklySourceChanged"),
    Object.freeze({
      eventType: "WeeklySummaryDue",
      eventVersion: "v1" as const,
      handle: handleSummaryDue,
    }),
  ]);
}

function sourceHandler(
  eventType:
    "CheckinCorrected" | "DailyResultPublished" | "WeeklySourceChanged",
): QueueJobHandler {
  return Object.freeze({
    eventType,
    eventVersion: "v1" as const,
    handle: handleSourceChanged,
  });
}

async function handleSourceChanged(
  envelope: VersionedJobEnvelope,
  transaction: QueueTransaction,
): Promise<string> {
  const sourceEvent = await resolveSourceEvent(envelope, transaction);
  if (sourceEvent === undefined) {
    return "SOURCE_MISSING";
  }
  await lockAccount(transaction, sourceEvent.accountId);
  const lockedSource = await resolveSourceEvent(envelope, transaction, true);
  if (
    lockedSource === undefined ||
    lockedSource.accountId !== sourceEvent.accountId ||
    lockedSource.sourceRevision !== envelope.aggregateRevision
  ) {
    return "SOURCE_STALE";
  }
  const guard = await readWeeklyGuard(
    transaction,
    sourceEvent.accountId,
    sourceEvent.productDate,
  );
  if (guard.status !== "ALLOWED") {
    return "SOURCE_BLOCKED";
  }
  if (!epochsMatch(envelope.guardEpochs, guard)) {
    return "SOURCE_STALE";
  }
  const endProductDate = resolveProductDate(
    new Date(envelope.occurredAt),
  ).productDate;
  const preferredWindowId = weeklyWindowId(
    sourceEvent.accountId,
    endProductDate,
  );
  await transaction.execute(
    `INSERT INTO daily_energy.app_weekly_window
      (id,"accountId","endProductDate","windowRuleVersion",revision,
       "updatedAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1::uuid,$2::uuid,$3::date,'window-v1',1,$5::timestamptz,$4,
             'DAY',$5::timestamptz)
     ON CONFLICT ("accountId","endProductDate","windowRuleVersion") DO NOTHING`,
    [
      preferredWindowId,
      sourceEvent.accountId,
      endProductDate,
      RETENTION_POLICY_VERSION,
      new Date(envelope.occurredAt),
    ],
  );
  const window = await readWindow(
    transaction,
    sourceEvent.accountId,
    endProductDate,
    true,
  );
  if (window === undefined) {
    throw new QueueRetryableError("WEEKLY_WINDOW_MISSING");
  }
  let derivation: ReturnType<typeof deriveWeeklyAggregate>;
  let weeklySource: Awaited<ReturnType<typeof loadWeeklySourceSnapshot>>;
  try {
    weeklySource = await loadWeeklySourceSnapshot(transaction, {
      accountId: sourceEvent.accountId,
      endProductDate,
      windowId: window.windowId,
    });
    derivation = deriveWeeklyAggregate(weeklySource);
  } catch {
    throw new QueueTerminalError("TERMINAL_WEEKLY_SOURCE_INVALID");
  }
  const fingerprint = Buffer.from(
    derivation.aggregate.source_fingerprint,
    "hex",
  );
  if (window.currentSourceFingerprint?.equals(fingerprint) === true) {
    return "WEEKLY_UNCHANGED";
  }
  const now = await databaseNow(transaction);
  const snapshotId = commandRefStorageUuid(
    `c013:weekly-snapshot:${window.windowId}:${derivation.aggregate.source_fingerprint}`,
  );
  await transaction.execute(
    `UPDATE daily_energy.app_weekly_source_snapshot
        SET "invalidatedAt"=COALESCE("invalidatedAt",$2::timestamptz),
            "retentionAnchorAt"=CASE WHEN "expiresAt" IS NULL
              THEN $2::timestamptz ELSE "retentionAnchorAt" END,
            "expiresAt"=COALESCE(
              "expiresAt",$2::timestamptz+interval '30 days'
            )
      WHERE "windowId"=$1::uuid AND "sourceFingerprint"<>$3`,
    [window.windowId, now, fingerprint],
  );
  await transaction.execute(
    `UPDATE daily_energy.app_published_weekly_summary_revision
        SET "retentionAnchorAt"=CASE WHEN "expiresAt" IS NULL
              THEN $2::timestamptz ELSE "retentionAnchorAt" END,
            "expiresAt"=COALESCE(
              "expiresAt",$2::timestamptz+interval '30 days'
            )
      WHERE "windowId"=$1::uuid AND "sourceFingerprint"<>$3`,
    [window.windowId, now, fingerprint],
  );
  await transaction.execute(
    `INSERT INTO daily_energy.app_weekly_source_snapshot
      (id,"windowId","sourceFingerprint","sourceSlotsPayload",
       "aggregateFactsPayload","expressionPlanPayload","aggregateVersion",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1::uuid,$2::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,
             'weekly-aggregate-v1',$7,'DAY',$8::timestamptz)
     ON CONFLICT ("windowId","sourceFingerprint") DO NOTHING`,
    [
      snapshotId,
      window.windowId,
      fingerprint,
      stableWeeklyJson(weeklySource),
      stableWeeklyJson(derivation.aggregate),
      stableWeeklyJson(derivation.expressionPlan ?? {}),
      RETENTION_POLICY_VERSION,
      now,
    ],
  );
  const updated = await transaction.execute(
    `UPDATE daily_energy.app_weekly_window
        SET "currentSourceFingerprint"=$2,"currentSummaryRef"=NULL,
            revision=revision+1,"updatedAt"=$3::timestamptz
      WHERE id=$1::uuid AND revision=$4`,
    [window.windowId, fingerprint, now, window.revision],
  );
  if (updated.rowCount !== 1) {
    throw new QueueRetryableError("WEEKLY_WINDOW_CAS_LOST");
  }
  if (derivation.expressionPlan === undefined) {
    return "WEEKLY_FACTS_UPDATED";
  }
  const intentId = commandRefStorageUuid(
    `c013:weekly-intent:${window.windowId}:${derivation.aggregate.source_fingerprint}`,
  );
  await transaction.execute(
    `INSERT INTO daily_energy.app_weekly_summary_intent
      (id,"windowId","sourceFingerprint",revision,state,"summaryVersion",
       "updatedAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1::uuid,$2::uuid,$3,1,'RUNNING','weekly-template-v1',
             $5::timestamptz,$4,'DAY',$5::timestamptz)
     ON CONFLICT ("windowId","sourceFingerprint") DO NOTHING`,
    [intentId, window.windowId, fingerprint, RETENTION_POLICY_VERSION, now],
  );
  await insertSummaryDueOutbox(transaction, {
    intentId,
    now,
    guard,
  });
  return "WEEKLY_SUMMARY_QUEUED";
}

async function handleSummaryDue(
  envelope: VersionedJobEnvelope,
  transaction: QueueTransaction,
): Promise<string> {
  const intent = await readIntent(transaction, envelope.aggregateRef, true);
  if (intent === undefined) {
    return "SOURCE_MISSING";
  }
  await lockAccount(transaction, intent.accountId);
  const current = await readIntent(transaction, envelope.aggregateRef, true);
  if (current === undefined) {
    return "SOURCE_MISSING";
  }
  if (current.state === "SUCCEEDED") {
    return "WEEKLY_SUMMARY_EXISTS";
  }
  if (current.state === "CANCELLED" || current.state === "FAILED") {
    return "WEEKLY_SUMMARY_TERMINAL";
  }
  const guard = await readWeeklyGuard(
    transaction,
    current.accountId,
    current.windowEndDate,
  );
  if (guard.status !== "ALLOWED") {
    await cancelIntent(transaction, current, "WEEKLY_GUARD_BLOCKED");
    return "SOURCE_BLOCKED";
  }
  if (
    envelope.aggregateRevision !== current.intentRevision ||
    !current.currentSourceFingerprint?.equals(current.sourceFingerprint) ||
    !epochsMatch(envelope.guardEpochs, guard)
  ) {
    await cancelIntent(transaction, current, "WEEKLY_SOURCE_STALE");
    return "SOURCE_STALE";
  }
  let aggregate: ReturnType<typeof WeeklyAggregateFactsSchema.parse>;
  let plan: ReturnType<typeof WeeklyExpressionPlanSchema.parse>;
  try {
    aggregate = WeeklyAggregateFactsSchema.parse(current.aggregateFactsPayload);
    plan = WeeklyExpressionPlanSchema.parse(current.expressionPlanPayload);
  } catch {
    throw new QueueTerminalError("TERMINAL_WEEKLY_CONTRACT_INVALID");
  }
  if (
    aggregate.window_id !== current.windowId ||
    aggregate.source_fingerprint !== current.sourceFingerprint.toString("hex")
  ) {
    throw new QueueTerminalError("TERMINAL_WEEKLY_BINDING_INVALID");
  }
  const expression = renderControlledWeeklyExpression(aggregate, plan);
  const now = await databaseNow(transaction);
  const previous = await transaction.execute<{
    readonly revision: number;
    readonly summaryId: string;
  }>(
    `SELECT id AS "summaryId",revision
       FROM daily_energy.app_published_weekly_summary_revision
      WHERE "windowId"=$1::uuid
      ORDER BY revision DESC,id DESC
      LIMIT 1`,
    [current.windowId],
  );
  const summaryRevision = (previous.rows[0]?.revision ?? 0) + 1;
  const summaryId = commandRefStorageUuid(
    `c013:weekly-summary:${envelope.aggregateRef}`,
  );
  const published = PublishedWeeklySummarySchema.parse({
    aggregate_facts_ref: current.snapshotId,
    contract: "weekly-summary",
    expression,
    expression_plan: plan,
    expression_version: "weekly-expression-v1",
    privacy_fallbacks: {},
    provenance: {
      generation_mode: "CONTROLLED_TEMPLATE",
      personalization_level: "REDUCED",
      safety_policy_version: "safety-baseline-v1",
      template_version: "weekly-template-v1",
    },
    published_at: now.toISOString(),
    schema_version: "1.0.0",
    source_dependencies: [],
    source_fingerprint: aggregate.source_fingerprint,
    summary_id: summaryId,
    summary_revision: summaryRevision,
    ...(previous.rows[0] === undefined
      ? {}
      : { supersedes_summary_id: previous.rows[0].summaryId }),
    validation: { status: "PASSED", validated_at: now.toISOString() },
    window_end_date: current.windowEndDate,
    window_id: current.windowId,
    window_start_date: current.windowStartDate,
  });
  await transaction.execute(
    `INSERT INTO daily_energy.app_published_weekly_summary_revision
      (id,"windowId","summaryIntentId",revision,"sourceFingerprint",
       "schemaVersion","summaryVersion","expressionCorePayload",
       "provenancePayload","validationReceipt","supersedesRef","publishedAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,'weekly-template-v1',
             $7::jsonb,$8::jsonb,$9::jsonb,$10::uuid,$11::timestamptz,$12,
             'DAY',$11::timestamptz)
     ON CONFLICT ("summaryIntentId") DO NOTHING`,
    [
      summaryId,
      current.windowId,
      envelope.aggregateRef,
      summaryRevision,
      current.sourceFingerprint,
      published.schema_version,
      stableWeeklyJson(published),
      stableWeeklyJson(published.provenance),
      stableWeeklyJson(published.validation),
      previous.rows[0]?.summaryId ?? null,
      now,
      RETENTION_POLICY_VERSION,
    ],
  );
  const intentUpdated = await transaction.execute(
    `UPDATE daily_energy.app_weekly_summary_intent
        SET state='SUCCEEDED',revision=revision+1,"updatedAt"=$2::timestamptz
      WHERE id=$1::uuid AND revision=$3 AND state='RUNNING'`,
    [envelope.aggregateRef, now, current.intentRevision],
  );
  if (intentUpdated.rowCount !== 1) {
    throw new QueueRetryableError("WEEKLY_INTENT_CAS_LOST");
  }
  const windowUpdated = await transaction.execute(
    `UPDATE daily_energy.app_weekly_window
        SET "currentSummaryRef"=$2::uuid,revision=revision+1,
            "updatedAt"=$3::timestamptz
      WHERE id=$1::uuid AND revision=$4
        AND "currentSourceFingerprint"=$5`,
    [
      current.windowId,
      summaryId,
      now,
      current.windowRevision,
      current.sourceFingerprint,
    ],
  );
  if (windowUpdated.rowCount !== 1) {
    throw new QueueRetryableError("WEEKLY_PUBLISH_CAS_LOST");
  }
  return "WEEKLY_SUMMARY_PUBLISHED";
}

async function resolveSourceEvent(
  envelope: VersionedJobEnvelope,
  transaction: QueueTransaction,
  _lock = false,
): Promise<SourceEventRow | undefined> {
  if (
    ![
      "CheckinCorrected",
      "DailyResultPublished",
      "WeeklySourceChanged",
    ].includes(envelope.eventType)
  ) {
    throw new QueueTerminalError("TERMINAL_WEEKLY_EVENT_UNSUPPORTED");
  }
  return (
    await transaction.execute<SourceEventRow>(
      `SELECT * FROM daily_energy.resolve_c013_weekly_source_event($1,$2::uuid)`,
      [envelope.eventType, envelope.aggregateRef],
    )
  ).rows[0];
}

async function readWeeklyGuard(
  transaction: QueueTransaction,
  accountId: string,
  productDate: string,
): Promise<GuardSnapshot> {
  const result = await transaction.execute<{ readonly snapshot: unknown }>(
    `SELECT daily_energy.resolve_c013_weekly_guard(
       $1::uuid,$2::date,'necessary-consent-v1'
     ) AS snapshot`,
    [accountId, productDate],
  );
  const value = result.rows[0]?.snapshot;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new QueueRetryableError("WEEKLY_GUARD_INVALID");
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.status !== "string" ||
    typeof candidate.safety_epoch !== "string" ||
    typeof candidate.deletion_epoch !== "string" ||
    !/^(0|[1-9][0-9]*)$/u.test(candidate.safety_epoch) ||
    !/^(0|[1-9][0-9]*)$/u.test(candidate.deletion_epoch)
  ) {
    throw new QueueRetryableError("WEEKLY_GUARD_INVALID");
  }
  return {
    deletionEpoch: candidate.deletion_epoch,
    safetyEpoch: candidate.safety_epoch,
    status: candidate.status as GuardSnapshot["status"],
  };
}

async function readWindow(
  transaction: QueueTransaction,
  accountId: string,
  endProductDate: string,
  lock: boolean,
): Promise<WindowRow | undefined> {
  return (
    await transaction.execute<WindowRow>(
      `SELECT id AS "windowId",revision,"currentSourceFingerprint",
              "currentSummaryRef"
         FROM daily_energy.app_weekly_window
        WHERE "accountId"=$1::uuid AND "endProductDate"=$2::date
          AND "windowRuleVersion"='window-v1'${lock ? " FOR UPDATE" : ""}`,
      [accountId, endProductDate],
    )
  ).rows[0];
}

async function readIntent(
  transaction: QueueTransaction,
  intentId: string,
  lock: boolean,
): Promise<IntentRow | undefined> {
  return (
    await transaction.execute<IntentRow>(
      `SELECT intent.id AS "intentId",intent.revision AS "intentRevision",
              intent.state::text AS state,
              intent."sourceFingerprint",weekly_window.id AS "windowId",
              weekly_window."accountId",
              weekly_window.revision AS "windowRevision",
              weekly_window."endProductDate"::text AS "windowEndDate",
              (weekly_window."endProductDate" - 6)::text AS "windowStartDate",
              weekly_window."currentSourceFingerprint",
              weekly_window."currentSummaryRef",
              snapshot.id AS "snapshotId",snapshot."aggregateFactsPayload",
              snapshot."expressionPlanPayload"
         FROM daily_energy.app_weekly_summary_intent intent
         JOIN daily_energy.app_weekly_window weekly_window
           ON weekly_window.id=intent."windowId"
         JOIN daily_energy.app_weekly_source_snapshot snapshot
           ON snapshot."windowId"=weekly_window.id
          AND snapshot."sourceFingerprint"=intent."sourceFingerprint"
        WHERE intent.id=$1::uuid${lock ? " FOR UPDATE OF intent,weekly_window" : ""}`,
      [intentId],
    )
  ).rows[0];
}

async function cancelIntent(
  transaction: QueueTransaction,
  intent: IntentRow,
  reasonCode: string,
): Promise<void> {
  await transaction.execute(
    `UPDATE daily_energy.app_weekly_summary_intent
        SET state='CANCELLED',revision=revision+1,"terminalReasonCode"=$2,
            "updatedAt"=now()
      WHERE id=$1::uuid AND revision=$3
        AND state IN ('RUNNING','RETRYABLE_FAILED')`,
    [intent.intentId, reasonCode, intent.intentRevision],
  );
}

async function insertSummaryDueOutbox(
  transaction: QueueTransaction,
  input: {
    readonly guard: GuardSnapshot;
    readonly intentId: string;
    readonly now: Date;
  },
): Promise<void> {
  const idempotencyKey = createHash("sha256")
    .update(`c013:WeeklySummaryDue:${input.intentId}:1`, "utf8")
    .digest();
  await transaction.execute(
    `INSERT INTO daily_energy.runtime_outbox_event
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
       state,"availableAt","attemptCount","createdAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt","expiresAt")
     VALUES ($1::uuid,'WeeklySummaryIntent',$1::uuid,1,'WeeklySummaryDue','v1',
             $2,'{}'::jsonb,$3::jsonb,'PENDING',$4::timestamptz,0,
             $4::timestamptz,$5,'RUNTIME',$4::timestamptz,$6::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    [
      input.intentId,
      idempotencyKey,
      stableWeeklyJson({
        deletion: input.guard.deletionEpoch,
        safety: input.guard.safetyEpoch,
      }),
      input.now,
      RETENTION_POLICY_VERSION,
      new Date(input.now.getTime() + RUNTIME_TTL_MS),
    ],
  );
}

async function databaseNow(transaction: QueueTransaction): Promise<Date> {
  const row = (
    await transaction.execute<{ readonly now: Date }>(
      `SELECT clock_timestamp() AS now`,
    )
  ).rows[0];
  if (row === undefined) {
    throw new QueueRetryableError("WEEKLY_CLOCK_UNAVAILABLE");
  }
  return row.now;
}

async function lockAccount(
  transaction: QueueTransaction,
  accountId: string,
): Promise<void> {
  await transaction.execute(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
    [accountId, ACCOUNT_GUARD_LOCK_SEED],
  );
}

function epochsMatch(
  epochs: Readonly<Record<string, string>>,
  guard: GuardSnapshot,
): boolean {
  return (
    Object.keys(epochs).every(
      (key) => key === "deletion" || key === "safety",
    ) &&
    (epochs.deletion === undefined ||
      epochs.deletion === guard.deletionEpoch) &&
    (epochs.safety === undefined || epochs.safety === guard.safetyEpoch)
  );
}
