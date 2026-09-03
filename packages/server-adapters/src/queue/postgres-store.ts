import { createHash, timingSafeEqual } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import type {
  QueueTransaction,
  VersionedJobEnvelope,
  WorkerProfile,
} from "./contracts.js";
import {
  fingerprintEnvelope,
  parseVersionedJobEnvelope,
  QueueTerminalError,
} from "./contracts.js";

const OUTBOX_LOCK_SEED = 7_007;
const INBOX_RETENTION_DAYS = 30;

interface OutboxRow {
  readonly aggregateRef: string;
  readonly aggregateRevision: number;
  readonly attemptCount: number;
  readonly claimed?: boolean;
  readonly createdAt: Date;
  readonly eventType: string;
  readonly eventVersion: string;
  readonly guardEpochs: unknown;
  readonly id: string;
}

interface ExistingInboxRow {
  readonly eventFingerprint: Buffer;
  readonly outcomeCode: string;
}

export interface PostgresQueueStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
  readonly profile: WorkerProfile;
}

export interface InboxConsumeResult {
  readonly duplicate: boolean;
  readonly outcomeCode: string;
  readonly terminal: boolean;
}

export interface ClaimedOutboxEvent {
  readonly attemptCount: number;
  readonly envelope: VersionedJobEnvelope;
}

export interface OutboxClaimBatch {
  readonly events: readonly ClaimedOutboxEvent[];
  markPublished(eventId: string): Promise<void>;
  markRetryable(
    eventId: string,
    options: { readonly delayMs: number; readonly terminal: boolean },
  ): Promise<void>;
  release(): Promise<void>;
}

class PostgresOutboxClaimBatch implements OutboxClaimBatch {
  readonly events: readonly ClaimedOutboxEvent[];
  readonly #client: PoolClient;
  readonly #eventIds: readonly string[];
  #released = false;

  constructor(
    client: PoolClient,
    events: readonly ClaimedOutboxEvent[],
    eventIds: readonly string[],
  ) {
    this.#client = client;
    this.events = Object.freeze([...events]);
    this.#eventIds = Object.freeze([...eventIds]);
  }

  async markPublished(eventId: string): Promise<void> {
    this.#assertClaimed(eventId);
    const result = await this.#client.query(
      `UPDATE daily_energy.runtime_outbox_event
       SET state = 'PUBLISHED', "publishedAt" = now()
       WHERE id = $1 AND state = 'PENDING'`,
      [eventId],
    );
    if (result.rowCount !== 1) {
      throw new QueueTerminalError("OUTBOX_CLAIM_LOST");
    }
  }

  async markRetryable(
    eventId: string,
    options: { readonly delayMs: number; readonly terminal: boolean },
  ): Promise<void> {
    this.#assertClaimed(eventId);
    const nextState = options.terminal ? "FAILED" : "PENDING";
    const result = await this.#client.query(
      `UPDATE daily_energy.runtime_outbox_event
       SET state = $2::daily_energy."OutboxState",
           "availableAt" = CASE
             WHEN $2::daily_energy."OutboxState" = 'PENDING'
               THEN now() + ($3 * interval '1 millisecond')
             ELSE "availableAt"
           END
       WHERE id = $1 AND state = 'PENDING'`,
      [eventId, nextState, options.delayMs],
    );
    if (result.rowCount !== 1) {
      throw new QueueTerminalError("OUTBOX_CLAIM_LOST");
    }
  }

  async release(): Promise<void> {
    if (this.#released) {
      return;
    }
    this.#released = true;
    try {
      for (const eventId of this.#eventIds) {
        await this.#client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, $2))",
          [eventId, OUTBOX_LOCK_SEED],
        );
      }
    } finally {
      this.#client.release();
    }
  }

  #assertClaimed(eventId: string): void {
    if (!this.#eventIds.includes(eventId) || this.#released) {
      throw new QueueTerminalError("OUTBOX_CLAIM_LOST");
    }
  }
}

export class PostgresQueueStore {
  readonly #pool: Pool;
  readonly profile: WorkerProfile;
  #closed = false;

  private constructor(pool: Pool, profile: WorkerProfile) {
    this.#pool = pool;
    this.profile = profile;
  }

  static async connect(
    config: PostgresQueueStoreConfig,
  ): Promise<PostgresQueueStore> {
    const pool = new Pool({
      application_name: config.applicationName,
      connectionString: config.connectionString,
      max: config.connectionLimit ?? 4,
    });
    try {
      const identity = await pool.query<{
        currentUser: string;
        expectedMember: boolean;
        sessionUser: string;
      }>(
        `SELECT current_user AS "currentUser",
                session_user AS "sessionUser",
                pg_has_role(session_user, $1, 'MEMBER') AS "expectedMember"`,
        [config.expectedDatabaseRole],
      );
      const row = identity.rows[0];
      if (
        !row ||
        row.currentUser !== row.sessionUser ||
        row.expectedMember !== true
      ) {
        throw new Error("QUEUE_DB_ROLE_MISMATCH");
      }
    } catch {
      await pool.end();
      throw new Error("QUEUE_DB_ROLE_MISMATCH");
    }
    return new PostgresQueueStore(pool, config.profile);
  }

  async claimOutboxBatch(
    batchSize: number,
    maxAttempts: number,
  ): Promise<OutboxClaimBatch> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE daily_energy.runtime_outbox_event
         SET state = 'FAILED'
         WHERE state = 'PENDING'
           AND "availableAt" <= now()
           AND "attemptCount" >= $1`,
        [maxAttempts],
      );
      const candidates = await client.query<OutboxRow>(
        `WITH candidates AS (
           SELECT id, "aggregateRef", "aggregateRevision", "eventType",
                  "eventVersion", "guardEpochs", "createdAt", "attemptCount"
           FROM daily_energy.runtime_outbox_event
           WHERE state = 'PENDING'
             AND "availableAt" <= now()
             AND "attemptCount" < $1
             AND "expiresAt" > now()
           ORDER BY "availableAt", id
           FOR UPDATE SKIP LOCKED
           LIMIT $2
         )
         SELECT candidates.*,
                pg_try_advisory_lock(
                  hashtextextended(candidates.id::text, $3)
                ) AS claimed
         FROM candidates`,
        [maxAttempts, batchSize, OUTBOX_LOCK_SEED],
      );
      const claimed = candidates.rows.filter((row) => row.claimed === true);
      const eventIds = claimed.map((row) => row.id);
      if (eventIds.length > 0) {
        await client.query(
          `UPDATE daily_energy.runtime_outbox_event
           SET "attemptCount" = "attemptCount" + 1
           WHERE id = ANY($1::uuid[])`,
          [eventIds],
        );
      }
      await client.query("COMMIT");
      return new PostgresOutboxClaimBatch(
        client,
        claimed.map((row) => ({
          attemptCount: row.attemptCount + 1,
          envelope: envelopeFromOutbox(row),
        })),
        eventIds,
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
      throw error;
    }
  }

  async listPublishedOutboxCandidates(
    limit: number,
  ): Promise<readonly VersionedJobEnvelope[]> {
    this.#assertOpen();
    const result = await this.#pool.query<OutboxRow>(
      `SELECT id, "aggregateRef", "aggregateRevision", "eventType",
              "eventVersion", "guardEpochs", "createdAt", "attemptCount"
       FROM daily_energy.runtime_outbox_event
       WHERE state = 'PUBLISHED' AND "expiresAt" > now()
       ORDER BY "publishedAt" DESC NULLS LAST, id
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => envelopeFromOutbox(row));
  }

  async hasInboxReceipt(
    consumerCode: string,
    eventId: string,
  ): Promise<boolean> {
    this.#assertOpen();
    const result = await this.#pool.query(
      `SELECT 1
       FROM daily_energy.runtime_inbox_receipt
       WHERE "consumerCode" = $1 AND "eventId" = $2
       LIMIT 1`,
      [consumerCode, eventId],
    );
    return result.rowCount === 1;
  }

  async consumeInbox(
    consumerCode: string,
    envelope: VersionedJobEnvelope,
    handler: (transaction: QueueTransaction) => Promise<string>,
  ): Promise<InboxConsumeResult> {
    this.#assertOpen();
    const parsed = parseVersionedJobEnvelope(envelope);
    const fingerprint = fingerprintEnvelope(parsed);
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO daily_energy.runtime_inbox_receipt
          (id, "consumerCode", "eventId", "eventFingerprint", "processedAt",
           "outcomeCode", "retentionPolicyVersion", "retentionScope",
           "retentionAnchorAt", "expiresAt")
         VALUES (gen_random_uuid(), $1, $2, $3, now(), 'PROCESSING',
                 'queue-runtime-v1', 'RUNTIME', now(),
                 now() + ($4 * interval '1 day'))
         ON CONFLICT ("consumerCode", "eventId") DO NOTHING
         RETURNING id`,
        [consumerCode, parsed.eventId, fingerprint, INBOX_RETENTION_DAYS],
      );
      if (inserted.rowCount === 0) {
        const existing = await client.query<ExistingInboxRow>(
          `SELECT "eventFingerprint", "outcomeCode"
           FROM daily_energy.runtime_inbox_receipt
           WHERE "consumerCode" = $1 AND "eventId" = $2`,
          [consumerCode, parsed.eventId],
        );
        const row = existing.rows[0];
        if (
          !row ||
          row.eventFingerprint.length !== fingerprint.length ||
          !timingSafeEqual(row.eventFingerprint, fingerprint)
        ) {
          throw new QueueTerminalError("INBOX_FINGERPRINT_CONFLICT");
        }
        await client.query("COMMIT");
        return Object.freeze({
          duplicate: true,
          outcomeCode: row.outcomeCode,
          terminal: row.outcomeCode.startsWith("TERMINAL_"),
        });
      }

      await client.query("SAVEPOINT queue_handler");
      let outcomeCode: string;
      let terminal = false;
      try {
        outcomeCode = await handler(queueTransaction(client));
        if (outcomeCode.startsWith("TERMINAL_")) {
          throw new QueueTerminalError("INBOX_OUTCOME_INVALID");
        }
        await client.query("RELEASE SAVEPOINT queue_handler");
      } catch (error) {
        if (
          !(error instanceof QueueTerminalError) ||
          !error.code.startsWith("TERMINAL_")
        ) {
          throw error;
        }
        await client.query("ROLLBACK TO SAVEPOINT queue_handler");
        await client.query("RELEASE SAVEPOINT queue_handler");
        outcomeCode = error.code;
        terminal = true;
      }
      if (!/^[A-Z][A-Z0-9_]{0,31}$/u.test(outcomeCode)) {
        throw new QueueTerminalError("INBOX_OUTCOME_INVALID");
      }
      await client.query(
        `UPDATE daily_energy.runtime_inbox_receipt
         SET "outcomeCode" = $3, "processedAt" = now()
         WHERE "consumerCode" = $1 AND "eventId" = $2`,
        [consumerCode, parsed.eventId, outcomeCode],
      );
      await client.query("COMMIT");
      return Object.freeze({ duplicate: false, outcomeCode, terminal });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listGenerationDue(
    limit: number,
  ): Promise<readonly VersionedJobEnvelope[]> {
    this.#assertProfile("worker-interactive");
    const result = await this.#pool.query<{
      acceptedAt: Date;
      id: string;
      revision: number;
    }>(
      `SELECT intent.id, intent.revision, intent."acceptedAt"
       FROM daily_energy.app_generation_intent intent
       JOIN daily_energy.app_user_account account ON account.id = intent."accountId"
       WHERE intent.state IN ('QUEUED', 'RUNNING', 'FALLBACK_RUNNING', 'RETRYABLE_FAILED')
         AND account.state = 'ACTIVE'
         AND (intent."expiresAt" IS NULL OR intent."expiresAt" > now())
       ORDER BY intent."updatedAt", intent.id
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) =>
      dueEnvelope("GenerationIntentDue", row.id, row.revision, row.acceptedAt),
    );
  }

  async listNotificationDue(
    limit: number,
  ): Promise<readonly VersionedJobEnvelope[]> {
    this.#assertProfile("worker-background");
    const result = await this.#pool.query<{
      id: string;
      scheduledAt: Date;
    }>(
      `SELECT intent.id, intent."scheduledAt"
       FROM daily_energy.app_notification_intent intent
       JOIN daily_energy.app_user_account account ON account.id = intent."accountId"
       WHERE intent.state = 'SCHEDULED'
         AND intent."scheduledAt" <= now()
         AND account.state = 'ACTIVE'
         AND (intent."expiresAt" IS NULL OR intent."expiresAt" > now())
       ORDER BY intent."scheduledAt", intent.id
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) =>
      dueEnvelope("NotificationIntentDue", row.id, 1, row.scheduledAt),
    );
  }

  async listWeeklyDue(limit: number): Promise<readonly VersionedJobEnvelope[]> {
    this.#assertProfile("worker-background");
    const result = await this.#pool.query<{
      acceptedAt: Date;
      deletionEpoch: string;
      id: string;
      revision: number;
      safetyEpoch: string;
    }>(
      `SELECT intent.id,intent.revision,intent."createdAt" AS "acceptedAt",
              COALESCE(guard.snapshot->>'deletion_epoch','0') AS "deletionEpoch",
              COALESCE(guard.snapshot->>'safety_epoch','0') AS "safetyEpoch"
         FROM daily_energy.app_weekly_summary_intent intent
         JOIN daily_energy.app_weekly_window weekly_window
           ON weekly_window.id=intent."windowId"
         JOIN daily_energy.app_user_account account
           ON account.id=weekly_window."accountId"
         CROSS JOIN LATERAL (
           SELECT daily_energy.resolve_c013_weekly_guard(
             account.id,weekly_window."endProductDate",'necessary-consent-v1'
           ) AS snapshot
         ) guard
        WHERE intent.state IN ('RUNNING','RETRYABLE_FAILED')
          AND account.state='ACTIVE'
          AND weekly_window."currentSourceFingerprint"=intent."sourceFingerprint"
          AND (intent."expiresAt" IS NULL OR intent."expiresAt">now())
        ORDER BY intent."updatedAt",intent.id
        LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) =>
      dueEnvelope("WeeklySummaryDue", row.id, row.revision, row.acceptedAt, {
        deletion: row.deletionEpoch,
        safety: row.safetyEpoch,
      }),
    );
  }

  async listDataTasksDue(
    limit: number,
    asOf: Date = new Date(),
  ): Promise<readonly VersionedJobEnvelope[]> {
    this.#assertProfile("worker-restricted");
    const result = await this.#pool.query<{
      deletionEpoch: string | null;
      eventType: "DataRightsRetentionDue" | "DataTaskDue";
      id: string;
      requestedAt: Date;
      revision: number;
    }>(
      `WITH candidates AS (
         SELECT task.id,task.revision,task."requestedAt",
                guard."deletionEpoch"::text AS "deletionEpoch",
                'DataTaskDue'::text AS "eventType",1 AS priority
           FROM daily_energy.restricted_data_task task
           JOIN daily_energy.app_user_account account ON account.id=task."accountId"
           LEFT JOIN daily_energy.restricted_deletion_guard guard
             ON guard."taskRef"=task.id AND guard."releasedAt" IS NULL
          WHERE task."activeSlot" IS TRUE
            AND task.state IN ('QUEUED','RUNNING','FAILED')
            AND account.state<>'DELETED'
            AND (task."expiresAt" IS NULL OR task."expiresAt">$2::timestamptz)
            AND (task.kind='EXPORT' OR guard.id IS NOT NULL)
         UNION ALL
         SELECT task.id,task.revision,status_grant."expiresAt",NULL::text,
                'DataRightsRetentionDue',0
           FROM daily_energy.restricted_deletion_status_grant status_grant
           JOIN daily_energy.restricted_data_task task ON task.id=status_grant."taskId"
          WHERE status_grant."expiresAt"<=$2::timestamptz
         UNION ALL
         SELECT task.id,task.revision,manifest."expiresAt",NULL::text,
                'DataRightsRetentionDue',0
           FROM daily_energy.restricted_export_manifest manifest
           JOIN daily_energy.restricted_data_task task ON task.id=manifest."taskId"
          WHERE manifest.state='READY' AND manifest."expiresAt"<=$2::timestamptz
         UNION ALL
         SELECT task.id,task.revision,task."expiresAt",NULL::text,
                'DataRightsRetentionDue',0
           FROM daily_energy.restricted_data_task task
          WHERE task.kind='EXPORT' AND task."activeSlot" IS NULL
            AND task."expiresAt" IS NOT NULL
            AND task."expiresAt"<=$2::timestamptz
       ), selected AS (
         SELECT DISTINCT ON (id) id,revision,"requestedAt","deletionEpoch","eventType"
           FROM candidates
          ORDER BY id,priority,"requestedAt"
       )
       SELECT id,revision,"requestedAt","deletionEpoch","eventType"
         FROM selected ORDER BY "requestedAt",id LIMIT $1`,
      [limit, asOf],
    );
    return result.rows.map((row) =>
      dueEnvelope(
        row.eventType,
        row.id,
        row.revision,
        row.requestedAt,
        row.deletionEpoch ? { deletion: row.deletionEpoch } : {},
        revisionScopedEventId(row.id, row.revision),
      ),
    );
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#pool.end();
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("QUEUE_STORE_CLOSED");
    }
  }

  #assertProfile(expected: WorkerProfile): void {
    this.#assertOpen();
    if (this.profile !== expected) {
      throw new QueueTerminalError("QUEUE_PROFILE_DB_SCOPE_REJECTED");
    }
  }
}

function queueTransaction(client: PoolClient): QueueTransaction {
  return Object.freeze({
    async execute<Row extends Readonly<Record<string, unknown>>>(
      statement: string,
      values: readonly unknown[] = [],
    ) {
      const result = await client.query<Row>(statement, [...values]);
      return Object.freeze({
        rowCount: result.rowCount ?? 0,
        rows: Object.freeze([...result.rows]),
      });
    },
  });
}

function envelopeFromOutbox(row: OutboxRow): VersionedJobEnvelope {
  return parseVersionedJobEnvelope({
    aggregateRef: row.aggregateRef,
    aggregateRevision: row.aggregateRevision,
    contract: "dailyenergy.job",
    eventId: row.id,
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    guardEpochs: normalizeGuardEpochs(row.guardEpochs),
    occurredAt: row.createdAt.toISOString(),
    queueVersion: 1,
  });
}

function dueEnvelope(
  eventType: string,
  aggregateRef: string,
  aggregateRevision: number,
  occurredAt: Date,
  guardEpochs: Readonly<Record<string, string>> = {},
  eventId: string = aggregateRef,
): VersionedJobEnvelope {
  return parseVersionedJobEnvelope({
    aggregateRef,
    aggregateRevision,
    contract: "dailyenergy.job",
    eventId,
    eventType,
    eventVersion: "v1",
    guardEpochs,
    occurredAt: occurredAt.toISOString(),
    queueVersion: 1,
  });
}

function revisionScopedEventId(
  aggregateRef: string,
  aggregateRevision: number,
): string {
  const bytes = createHash("sha256")
    .update(`dailyenergy-due:${aggregateRef}:${aggregateRevision}`, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeGuardEpochs(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new QueueTerminalError("OUTBOX_GUARD_EPOCHS_INVALID");
  }
  const result: Record<string, string> = {};
  for (const [key, epoch] of Object.entries(value)) {
    if (
      (typeof epoch !== "string" && typeof epoch !== "number") ||
      !/^(0|[1-9][0-9]*)$/u.test(String(epoch))
    ) {
      throw new QueueTerminalError("OUTBOX_GUARD_EPOCHS_INVALID");
    }
    result[key] = String(epoch);
  }
  return result;
}
