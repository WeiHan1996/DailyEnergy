import { timingSafeEqual } from "node:crypto";

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

  async listDataTasksDue(
    limit: number,
  ): Promise<readonly VersionedJobEnvelope[]> {
    this.#assertProfile("worker-restricted");
    const result = await this.#pool.query<{
      deletionEpoch: string | null;
      id: string;
      requestedAt: Date;
      revision: number;
    }>(
      `SELECT task.id, task.revision, task."requestedAt",
              guard."deletionEpoch"::text AS "deletionEpoch"
       FROM daily_energy.restricted_data_task task
       JOIN daily_energy.app_user_account account ON account.id = task."accountId"
       LEFT JOIN daily_energy.restricted_deletion_guard guard
         ON guard."taskRef" = task.id AND guard."releasedAt" IS NULL
       WHERE task."activeSlot" IS TRUE
         AND task.state IN ('QUEUED', 'RUNNING', 'FAILED')
         AND account.state <> 'DELETED'
         AND (task."expiresAt" IS NULL OR task."expiresAt" > now())
         AND (task.kind = 'EXPORT' OR guard.id IS NOT NULL)
       ORDER BY task."requestedAt", task.id
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) =>
      dueEnvelope(
        "DataTaskDue",
        row.id,
        row.revision,
        row.requestedAt,
        row.deletionEpoch ? { deletion: row.deletionEpoch } : {},
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
): VersionedJobEnvelope {
  return parseVersionedJobEnvelope({
    aggregateRef,
    aggregateRevision,
    contract: "dailyenergy.job",
    eventId: aggregateRef,
    eventType,
    eventVersion: "v1",
    guardEpochs,
    occurredAt: occurredAt.toISOString(),
    queueVersion: 1,
  });
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
