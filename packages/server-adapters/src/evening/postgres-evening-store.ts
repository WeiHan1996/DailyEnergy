import { createHash, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import type {
  EveningSaveRequest,
  HelpfulnessRating,
  OverallFeeling,
  TaskStatus,
  WriteWindow,
} from "@daily-energy/shared-schemas";
import {
  createViewContinuationGrant,
  evaluateWriteWindow,
  parseProductDate,
  validateViewContinuationGrant,
  type ViewContinuationGrant,
} from "@daily-energy/server-core/product-time";
import type { GenerationGuardSnapshotV1 } from "@daily-energy/server-core/generation";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";
import { resolveGenerationGuardSnapshot } from "../generation/guard-snapshot.js";

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const COMMAND_RECEIPT_TTL_MS = 7 * 24 * 60 * 60_000;
const RUNTIME_TTL_MS = 30 * 24 * 60 * 60_000;
const ACCOUNT_GUARD_LOCK_SEED = 20_400;

export interface ProtectedEveningNote {
  readonly ciphertext: Buffer;
  readonly keyVersion: string;
}

export interface StoredEveningView {
  readonly feedback?: {
    readonly feedbackId: string;
    readonly firstSubmittedAt: Date;
    readonly note?: ProtectedEveningNote;
    readonly overallFeeling: OverallFeeling;
    readonly revision: number;
    readonly updatedAt: Date;
  };
  readonly helpfulness: {
    readonly rating: "UNRATED" | HelpfulnessRating;
    readonly revision: number;
  };
  readonly productDate: string;
  readonly resultId: string;
  readonly task: {
    readonly instruction: string;
    readonly revision: number;
    readonly status: TaskStatus;
    readonly taskId: string;
  };
  readonly writeWindow: WriteWindow;
}

export type EveningGuardFailure = Exclude<
  GenerationGuardSnapshotV1["status"],
  "ALLOWED"
>;

export type EveningQueryResult =
  | { readonly status: "FOUND"; readonly value: StoredEveningView }
  | { readonly status: "NOT_FOUND" | EveningGuardFailure };

export type EveningSaveResult =
  | {
      readonly status: "ACCEPTED" | "DUPLICATE";
      readonly value: StoredEveningView;
    }
  | {
      readonly status: "REVISION_CONFLICT";
      readonly current: StoredEveningView;
    }
  | {
      readonly status:
        | "IDEMPOTENCY_CONFLICT"
        | "NOT_FOUND"
        | "VIEW_CONTINUATION_EXPIRED"
        | "WRITE_WINDOW_CLOSED"
        | EveningGuardFailure;
    };

export interface EveningStore {
  close(): Promise<void>;
  get(input: {
    readonly accountId: string;
    readonly now: Date;
    readonly openForContinuation: boolean;
    readonly productDate: string;
    readonly sessionId: string;
  }): Promise<EveningQueryResult>;
  save(input: {
    readonly accountId: string;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly note?: ProtectedEveningNote;
    readonly now: Date;
    readonly productDatePolicyVersion: string;
    readonly request: EveningSaveRequest;
    readonly sessionId: string;
  }): Promise<EveningSaveResult>;
}

export interface PostgresEveningStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface EveningRow {
  readonly aggregateRevision: number;
  readonly feedbackFirstSubmittedAt: Date | null;
  readonly feedbackId: string | null;
  readonly feedbackNoteCiphertext: Buffer | null;
  readonly feedbackNoteKeyVersion: string | null;
  readonly feedbackOverallFeeling: OverallFeeling | null;
  readonly feedbackRevision: number | null;
  readonly feedbackUpdatedAt: Date | null;
  readonly helpfulnessId: string | null;
  readonly helpfulnessRating: HelpfulnessRating | null;
  readonly helpfulnessRevision: number | null;
  readonly interactionId: string;
  readonly productDate: string;
  readonly resultId: string;
  readonly taskId: string;
  readonly taskInstruction: string;
  readonly taskRevision: number;
  readonly taskStateId: string;
  readonly taskStatus: TaskStatus;
  readonly updatedAt: Date;
}

interface ReceiptRow {
  readonly normalizedPayloadFingerprint: Buffer;
  readonly operationCode: string;
  readonly productDatePolicyVersion: string | null;
  readonly responseRef: string | null;
  readonly targetKey: string;
}

interface ContinuationRow {
  readonly allowedOperations: ["EVENING_SAVE"];
  readonly boundaryAt: Date;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly feedbackRevision: number | null;
  readonly grantRef: string;
  readonly invalidatedAt: Date | null;
  readonly ownerRef: string;
  readonly productDate: string;
  readonly productDatePolicyVersion: string;
  readonly resultRef: string | null;
  readonly revision: number;
  readonly sessionRef: string;
  readonly surface: string;
}

type CommandClaim =
  | { readonly status: "NEW" }
  | { readonly status: "CONFLICT" }
  | { readonly responseRef: string | null; readonly status: "DUPLICATE" };

export class PostgresEveningStore implements EveningStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresEveningStoreConfig,
  ): Promise<PostgresEveningStore> {
    const roleProbe = createClosedDatabaseFactory(
      {
        databaseRole: config.expectedDatabaseRole,
        defaultConnectionLimit: 1,
        profile: "api",
      },
      prismaRuntime,
    );
    const verified = await roleProbe.connect({
      applicationName: `${config.applicationName}:role-probe`,
      connectionLimit: 1,
      connectionString: config.connectionString,
    });
    await verified.disconnect();
    const pool = new Pool({
      application_name: config.applicationName,
      connectionString: config.connectionString,
      max: config.connectionLimit ?? 4,
    });
    try {
      await assertRole(pool, config.expectedDatabaseRole);
      return new PostgresEveningStore(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async get(input: {
    readonly accountId: string;
    readonly now: Date;
    readonly openForContinuation: boolean;
    readonly productDate: string;
    readonly sessionId: string;
  }): Promise<EveningQueryResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await resolveGenerationGuardSnapshot(
        client,
        input.accountId,
        input.productDate,
      );
      if (guard.status !== "ALLOWED") {
        return { status: guard.status };
      }
      const row = await readEveningRow(
        client,
        input.accountId,
        input.productDate,
        false,
      );
      if (row === undefined) {
        return { status: "NOT_FOUND" };
      }
      let grant = await findContinuationGrant(client, {
        accountId: input.accountId,
        productDate: input.productDate,
        resultId: row.resultId,
        sessionId: input.sessionId,
      });
      if (input.openForContinuation && grant === undefined) {
        grant = createViewContinuationGrant({
          feedbackRevision: row.feedbackRevision ?? 0,
          grantRef: commandRefStorageUuid(
            `c012:view:EVE-001:${input.sessionId}:${row.resultId}`,
          ),
          openedAt: input.now,
          ownerRef: input.accountId,
          productDate: parseProductDate(input.productDate),
          resultRef: row.resultId,
          sessionRef: input.sessionId,
          surface: "EVE-001",
        });
        const session = await client.query(
          `SELECT 1 FROM daily_energy.app_session_credential
            WHERE id=$1::uuid AND "accountId"=$2::uuid AND "revokedAt" IS NULL
              AND "issuedAt" <= $3::timestamptz AND "expiresAt" > $3::timestamptz`,
          [input.sessionId, input.accountId, input.now],
        );
        if (session.rowCount !== 1) {
          return { status: "STATE_PRECONDITION_FAILED" };
        }
        await insertContinuationGrant(client, grant);
      }
      return {
        status: "FOUND",
        value: storedView(row, writeWindow(input, grant)),
      };
    });
  }

  public async save(input: {
    readonly accountId: string;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly note?: ProtectedEveningNote;
    readonly now: Date;
    readonly productDatePolicyVersion: string;
    readonly request: EveningSaveRequest;
    readonly sessionId: string;
  }): Promise<EveningSaveResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await resolveGenerationGuardSnapshot(
        client,
        input.accountId,
        input.request.product_date,
      );
      if (guard.status !== "ALLOWED") {
        return { status: guard.status };
      }
      const current = await readEveningRow(
        client,
        input.accountId,
        input.request.product_date,
        true,
      );
      if (current === undefined) {
        return { status: "NOT_FOUND" };
      }
      const claim = await claimCommand(client, input, current.resultId);
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE" && claim.responseRef !== null) {
        if (current.feedbackId !== claim.responseRef) {
          throw new Error("EVENING_COMMAND_RESPONSE_MISMATCH");
        }
        return {
          status: "DUPLICATE",
          value: storedView(
            current,
            writeWindow(
              input,
              await findContinuationGrant(client, grantInput(input, current)),
            ),
          ),
        };
      }
      const grant = await findContinuationGrant(
        client,
        grantInput(input, current),
      );
      const window = writeWindow(input, grant);
      if (
        window === "CONTINUATION_ONLY" &&
        grant?.feedbackRevision !== input.request.expected_feedback_revision
      ) {
        return { status: "VIEW_CONTINUATION_EXPIRED" };
      }
      if (window === "CLOSED") {
        return {
          status:
            grant !== undefined &&
            (grant.invalidatedAt !== undefined ||
              input.now.getTime() >= grant.expiresAt.getTime())
              ? "VIEW_CONTINUATION_EXPIRED"
              : "WRITE_WINDOW_CLOSED",
        };
      }
      if (
        (current.feedbackRevision ?? 0) !==
          input.request.expected_feedback_revision ||
        (current.helpfulnessRevision ?? 0) !==
          input.request.expected_helpfulness_revision ||
        (input.request.task_patch !== undefined &&
          (input.request.task_patch.task_ref !== current.taskId ||
            input.request.task_patch.expected_revision !==
              current.taskRevision))
      ) {
        return {
          current: storedView(current, window),
          status: "REVISION_CONFLICT",
        };
      }

      let next = current;
      let changed = false;
      const feedbackResult = await saveFeedback(client, input, current);
      if (feedbackResult.changed) {
        changed = true;
        next = { ...next, ...feedbackResult.row };
      }
      const helpfulnessResult = await saveHelpfulness(client, input, next);
      if (helpfulnessResult.changed) {
        changed = true;
        next = { ...next, ...helpfulnessResult.row };
      }
      const taskResult = await saveTask(client, input, next);
      if (taskResult.changed) {
        changed = true;
        next = { ...next, ...taskResult.row };
      }
      if (changed) {
        const updated = await client.query(
          `UPDATE daily_energy.app_daily_interaction
              SET "aggregateRevision"="aggregateRevision"+1,
                  "updatedAt"=$1::timestamptz
            WHERE id=$2::uuid AND "aggregateRevision"=$3`,
          [input.now, current.interactionId, current.aggregateRevision],
        );
        if (updated.rowCount !== 1) {
          throw new Error("EVENING_AGGREGATE_CAS_LOST");
        }
        next = {
          ...next,
          aggregateRevision: current.aggregateRevision + 1,
          updatedAt: input.now,
        };
        await insertOutbox(client, {
          aggregateRevision: current.aggregateRevision + 1,
          interactionId: current.interactionId,
          now: input.now,
          productDate: input.request.product_date,
          feedbackRevision: next.feedbackRevision ?? 0,
          helpfulnessRevision: next.helpfulnessRevision ?? 0,
          taskRevision: next.taskRevision,
          deletionEpoch: guard.deletionEpoch,
          safetyEpoch: guard.safetyEpoch,
        });
      }
      if (next.feedbackId === null) {
        throw new Error("EVENING_FEEDBACK_RESPONSE_MISSING");
      }
      await attachCommandResponse(client, input, next.feedbackId);
      return {
        status: changed ? "ACCEPTED" : "DUPLICATE",
        value: storedView(next, window),
      };
    });
  }

  public async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#pool.end();
    }
  }

  async #transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    if (this.#closed) {
      throw new Error("EVENING_STORE_CLOSED");
    }
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const UNAVAILABLE_EVENING_STORE: EveningStore = Object.freeze({
  async close() {},
  async get() {
    return { status: "NOT_FOUND" } as const;
  },
  async save() {
    throw new Error("EVENING_STORE_UNAVAILABLE");
  },
});

async function readEveningRow(
  client: PoolClient,
  accountId: string,
  productDate: string,
  lock: boolean,
): Promise<EveningRow | undefined> {
  const result = await client.query<EveningRow>(
    `SELECT interaction.id AS "interactionId",interaction."aggregateRevision",
            interaction."productDate"::text AS "productDate",interaction."resultId",
            interaction."updatedAt",task.id AS "taskStateId",
            task."taskDefinitionId" AS "taskId",task.revision AS "taskRevision",
            task.status::text AS "taskStatus",
            result."expressionCorePayload" #>> '{optional_task,instruction}' AS "taskInstruction",
            helpfulness.id AS "helpfulnessId",helpfulness.revision AS "helpfulnessRevision",
            helpfulness.rating::text AS "helpfulnessRating",
            feedback.id AS "feedbackId",feedback.revision AS "feedbackRevision",
            feedback."overallFeeling"::text AS "feedbackOverallFeeling",
            feedback."noteCiphertext" AS "feedbackNoteCiphertext",
            feedback."noteKeyVersion" AS "feedbackNoteKeyVersion",
            feedback."firstSubmittedAt" AS "feedbackFirstSubmittedAt",
            feedback."updatedAt" AS "feedbackUpdatedAt"
       FROM daily_energy.app_daily_interaction interaction
       JOIN daily_energy.app_published_daily_result result
         ON result.id=interaction."resultId"
       JOIN daily_energy.app_published_result_visibility visibility
         ON visibility."resultId"=result.id AND visibility.state='AVAILABLE'
       JOIN daily_energy.app_daily_task_state task
         ON task."interactionId"=interaction.id
       LEFT JOIN daily_energy.app_daily_helpfulness_record helpfulness
         ON helpfulness."interactionId"=interaction.id
       LEFT JOIN daily_energy.app_evening_feedback_record feedback
         ON feedback."interactionId"=interaction.id
      WHERE interaction."accountId"=$1::uuid AND interaction."productDate"=$2::date
      LIMIT 1${lock ? " FOR UPDATE OF interaction,task" : ""}`,
    [accountId, productDate],
  );
  const row = result.rows[0];
  if (row !== undefined && row.taskInstruction.length === 0) {
    throw new Error("EVENING_TASK_INSTRUCTION_MISSING");
  }
  return row;
}

function storedView(row: EveningRow, window: WriteWindow): StoredEveningView {
  if (
    (row.feedbackNoteCiphertext === null) !==
      (row.feedbackNoteKeyVersion === null) ||
    (row.feedbackId === null) !== (row.feedbackRevision === null) ||
    (row.helpfulnessId === null) !== (row.helpfulnessRevision === null)
  ) {
    throw new Error("EVENING_ROW_INVARIANT");
  }
  return {
    ...(row.feedbackId === null ||
    row.feedbackRevision === null ||
    row.feedbackOverallFeeling === null ||
    row.feedbackFirstSubmittedAt === null ||
    row.feedbackUpdatedAt === null
      ? {}
      : {
          feedback: {
            feedbackId: row.feedbackId,
            firstSubmittedAt: row.feedbackFirstSubmittedAt,
            ...(row.feedbackNoteCiphertext === null ||
            row.feedbackNoteKeyVersion === null
              ? {}
              : {
                  note: {
                    ciphertext: row.feedbackNoteCiphertext,
                    keyVersion: row.feedbackNoteKeyVersion,
                  },
                }),
            overallFeeling: row.feedbackOverallFeeling,
            revision: row.feedbackRevision,
            updatedAt: row.feedbackUpdatedAt,
          },
        }),
    helpfulness:
      row.helpfulnessId === null ||
      row.helpfulnessRevision === null ||
      row.helpfulnessRating === null
        ? { rating: "UNRATED", revision: 0 }
        : {
            rating: row.helpfulnessRating,
            revision: row.helpfulnessRevision,
          },
    productDate: row.productDate,
    resultId: row.resultId,
    task: {
      instruction: row.taskInstruction,
      revision: row.taskRevision,
      status: row.taskStatus,
      taskId: row.taskId,
    },
    writeWindow: window,
  };
}

async function saveFeedback(
  client: PoolClient,
  input: Parameters<EveningStore["save"]>[0],
  current: EveningRow,
): Promise<{
  readonly changed: boolean;
  readonly row: Partial<EveningRow>;
}> {
  const notePatch = input.request.note_patch;
  const noteChanged =
    notePatch?.operation === "SET" ||
    (notePatch?.operation === "CLEAR" &&
      current.feedbackNoteCiphertext !== null);
  const overallChanged =
    current.feedbackOverallFeeling !== input.request.overall_feeling;
  if (current.feedbackId !== null && !noteChanged && !overallChanged) {
    return { changed: false, row: {} };
  }
  const feedbackId = current.feedbackId ?? randomUUID();
  const revision = (current.feedbackRevision ?? 0) + 1;
  const note =
    notePatch?.operation === "SET"
      ? input.note
      : notePatch?.operation === "CLEAR"
        ? undefined
        : current.feedbackNoteCiphertext === null ||
            current.feedbackNoteKeyVersion === null
          ? undefined
          : {
              ciphertext: current.feedbackNoteCiphertext,
              keyVersion: current.feedbackNoteKeyVersion,
            };
  if (notePatch?.operation === "SET" && note === undefined) {
    throw new Error("EVENING_NOTE_PROTECTION_MISSING");
  }
  if (current.feedbackId === null) {
    await client.query(
      `INSERT INTO daily_energy.app_evening_feedback_record
        (id,"interactionId","overallFeeling","noteCiphertext","noteKeyVersion",
         "firstSubmittedAt","updatedAt",revision,"retentionPolicyVersion",
         "retentionScope","retentionAnchorAt")
       VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::timestamptz,$6::timestamptz,$7,
               $8,'DAY',$6::timestamptz)`,
      [
        feedbackId,
        current.interactionId,
        input.request.overall_feeling,
        note?.ciphertext ?? null,
        note?.keyVersion ?? null,
        input.now,
        revision,
        RETENTION_POLICY_VERSION,
      ],
    );
  } else {
    const updated = await client.query(
      `UPDATE daily_energy.app_evening_feedback_record
          SET "overallFeeling"=$1,"noteCiphertext"=$2,"noteKeyVersion"=$3,
              revision=$4,"updatedAt"=$5::timestamptz
        WHERE id=$6::uuid AND revision=$7`,
      [
        input.request.overall_feeling,
        note?.ciphertext ?? null,
        note?.keyVersion ?? null,
        revision,
        input.now,
        feedbackId,
        current.feedbackRevision,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error("EVENING_FEEDBACK_CAS_LOST");
    }
  }
  const changedFields = [
    ...(overallChanged ? ["overall_feeling"] : []),
    ...(noteChanged ? ["note"] : []),
  ];
  if (changedFields.length === 0) {
    changedFields.push("overall_feeling");
  }
  await client.query(
    `INSERT INTO daily_energy.app_evening_feedback_revision
      (id,"feedbackId",revision,"changedFieldNames","noteChanged","commandRef",
       "createdAt","retentionPolicyVersion","retentionScope","retentionAnchorAt",
       "expiresAt")
     VALUES (gen_random_uuid(),$1::uuid,$2,$3::text[],$4,$5::uuid,$6::timestamptz,
             $7,'DAY',$6::timestamptz,$8::timestamptz)`,
    [
      feedbackId,
      revision,
      changedFields,
      noteChanged,
      commandRefStorageUuid(input.request.command_ref),
      input.now,
      RETENTION_POLICY_VERSION,
      new Date(input.now.getTime() + RUNTIME_TTL_MS),
    ],
  );
  return {
    changed: true,
    row: {
      feedbackFirstSubmittedAt: current.feedbackFirstSubmittedAt ?? input.now,
      feedbackId,
      feedbackNoteCiphertext: note?.ciphertext ?? null,
      feedbackNoteKeyVersion: note?.keyVersion ?? null,
      feedbackOverallFeeling: input.request.overall_feeling,
      feedbackRevision: revision,
      feedbackUpdatedAt: input.now,
    },
  };
}

async function saveHelpfulness(
  client: PoolClient,
  input: Parameters<EveningStore["save"]>[0],
  current: EveningRow,
): Promise<{ readonly changed: boolean; readonly row: Partial<EveningRow> }> {
  if (current.helpfulnessRating === input.request.helpfulness_rating) {
    return { changed: false, row: {} };
  }
  const id = current.helpfulnessId ?? randomUUID();
  const revision = (current.helpfulnessRevision ?? 0) + 1;
  if (current.helpfulnessId === null) {
    await client.query(
      `INSERT INTO daily_energy.app_daily_helpfulness_record
        (id,"interactionId",rating,revision,"updatedAt","retentionPolicyVersion",
         "retentionScope","retentionAnchorAt")
       VALUES ($1::uuid,$2::uuid,$3,$4,$5::timestamptz,$6,'DAY',$5::timestamptz)`,
      [
        id,
        current.interactionId,
        input.request.helpfulness_rating,
        revision,
        input.now,
        RETENTION_POLICY_VERSION,
      ],
    );
  } else {
    const updated = await client.query(
      `UPDATE daily_energy.app_daily_helpfulness_record
          SET rating=$1,revision=$2,"updatedAt"=$3::timestamptz
        WHERE id=$4::uuid AND revision=$5`,
      [
        input.request.helpfulness_rating,
        revision,
        input.now,
        id,
        current.helpfulnessRevision,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error("EVENING_HELPFULNESS_CAS_LOST");
    }
  }
  return {
    changed: true,
    row: {
      helpfulnessId: id,
      helpfulnessRating: input.request.helpfulness_rating,
      helpfulnessRevision: revision,
    },
  };
}

async function saveTask(
  client: PoolClient,
  input: Parameters<EveningStore["save"]>[0],
  current: EveningRow,
): Promise<{ readonly changed: boolean; readonly row: Partial<EveningRow> }> {
  const patch = input.request.task_patch;
  if (patch === undefined || patch.status === current.taskStatus) {
    return { changed: false, row: {} };
  }
  const revision = current.taskRevision + 1;
  const updated = await client.query(
    `UPDATE daily_energy.app_daily_task_state
        SET status=$1,revision=$2,"updatedAt"=$3::timestamptz
      WHERE id=$4::uuid AND revision=$5`,
    [
      patch.status,
      revision,
      input.now,
      current.taskStateId,
      current.taskRevision,
    ],
  );
  if (updated.rowCount !== 1) {
    throw new Error("EVENING_TASK_CAS_LOST");
  }
  return {
    changed: true,
    row: { taskRevision: revision, taskStatus: patch.status },
  };
}

function grantInput(
  input: Parameters<EveningStore["save"]>[0],
  row: EveningRow,
) {
  return {
    accountId: input.accountId,
    productDate: input.request.product_date,
    resultId: row.resultId,
    sessionId: input.sessionId,
  };
}

function writeWindow(
  input: {
    readonly accountId: string;
    readonly now: Date;
    readonly productDate?: string;
    readonly request?: { readonly product_date: string };
    readonly sessionId: string;
  },
  grant: ViewContinuationGrant | undefined,
): WriteWindow {
  return evaluateWriteWindow({
    ...(grant === undefined ? {} : { grant }),
    now: input.now,
    operation: "EVENING_SAVE",
    ownerRef: input.accountId,
    sessionRef: input.sessionId,
    surface: "EVE-001",
    targetProductDate: parseProductDate(
      input.productDate ?? input.request!.product_date,
    ),
  });
}

async function findContinuationGrant(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly productDate: string;
    readonly resultId: string;
    readonly sessionId: string;
  },
): Promise<ViewContinuationGrant | undefined> {
  const row = (
    await client.query<ContinuationRow>(
      `SELECT g.id AS "grantRef",g."accountId" AS "ownerRef",
              g."sessionId" AS "sessionRef",g."surfaceCode" AS surface,
              g."productDate"::text AS "productDate",
              g."productDatePolicyVersion",g."resultRef",g."feedbackRevision",
              g."boundaryAt",g."allowedOperations",g.revision,g."expiresAt",
              g."invalidatedAt",g."createdAt"
         FROM daily_energy.app_view_continuation_grant g
        WHERE g."accountId"=$1::uuid AND g."sessionId"=$2::uuid
          AND g."productDate"=$3::date AND g."resultRef"=$4::uuid
          AND g."surfaceCode"='EVE-001'
        ORDER BY g."createdAt" DESC,g.id LIMIT 1 FOR SHARE OF g`,
      [input.accountId, input.sessionId, input.productDate, input.resultId],
    )
  ).rows[0];
  if (
    row === undefined ||
    row.resultRef === null ||
    row.feedbackRevision === null
  ) {
    return undefined;
  }
  return validateViewContinuationGrant({
    allowedOperations: row.allowedOperations,
    boundaryAt: row.boundaryAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    feedbackRevision: row.feedbackRevision,
    grantRef: row.grantRef,
    ...(row.invalidatedAt === null ? {} : { invalidatedAt: row.invalidatedAt }),
    ownerRef: row.ownerRef,
    productDate: parseProductDate(row.productDate),
    productDatePolicyVersion: "product-date-v1",
    resultRef: row.resultRef,
    revision: row.revision,
    sessionRef: row.sessionRef,
    surface: "EVE-001",
  });
}

async function insertContinuationGrant(
  client: PoolClient,
  grant: ViewContinuationGrant,
): Promise<void> {
  await client.query(
    `INSERT INTO daily_energy.app_view_continuation_grant
      (id,"accountId","sessionId","surfaceCode","productDate",
       "productDatePolicyVersion","resultRef","feedbackRevision","boundaryAt",
       "allowedOperations",revision,"expiresAt","invalidatedAt","createdAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::date,$6,$7::uuid,$8,
             $9::timestamptz,$10::text[],$11,$12::timestamptz,NULL,
             $13::timestamptz,$14,'DAY',$13::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    [
      grant.grantRef,
      grant.ownerRef,
      grant.sessionRef,
      grant.surface,
      grant.productDate,
      grant.productDatePolicyVersion,
      grant.resultRef,
      grant.feedbackRevision,
      grant.boundaryAt,
      grant.allowedOperations,
      grant.revision,
      grant.expiresAt,
      grant.createdAt,
      RETENTION_POLICY_VERSION,
    ],
  );
}

async function claimCommand(
  client: PoolClient,
  input: Parameters<EveningStore["save"]>[0],
  resultId: string,
): Promise<CommandClaim> {
  const commandRef = commandRefStorageUuid(input.request.command_ref);
  const targetKey = `${input.request.product_date}:${resultId}`;
  const inserted = await client.query(
    `INSERT INTO daily_energy.runtime_command_receipt
      (id,"accountId","commandRef","operationCode","targetScope","targetKey",
       "productDatePolicyVersion","normalizedPayloadFingerprint","acceptedAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,'EVENING_SAVE','DAY',$3,$4,$5,
             $6::timestamptz,$7,'RUNTIME',$6::timestamptz,$8::timestamptz)
     ON CONFLICT ("accountId","commandRef") DO NOTHING`,
    [
      input.accountId,
      commandRef,
      targetKey,
      input.productDatePolicyVersion,
      input.normalizedPayloadFingerprint,
      input.now,
      RETENTION_POLICY_VERSION,
      new Date(input.now.getTime() + COMMAND_RECEIPT_TTL_MS),
    ],
  );
  if (inserted.rowCount === 1) {
    return { status: "NEW" };
  }
  const row = (
    await client.query<ReceiptRow>(
      `SELECT "operationCode","targetKey","productDatePolicyVersion",
              "normalizedPayloadFingerprint","responseRef"
         FROM daily_energy.runtime_command_receipt
        WHERE "accountId"=$1::uuid AND "commandRef"=$2::uuid FOR UPDATE`,
      [input.accountId, commandRef],
    )
  ).rows[0];
  if (row === undefined) {
    throw new Error("EVENING_COMMAND_RECEIPT_MISSING");
  }
  return row.operationCode === "EVENING_SAVE" &&
    row.targetKey === targetKey &&
    row.productDatePolicyVersion === input.productDatePolicyVersion &&
    row.normalizedPayloadFingerprint.equals(input.normalizedPayloadFingerprint)
    ? { responseRef: row.responseRef, status: "DUPLICATE" }
    : { status: "CONFLICT" };
}

async function attachCommandResponse(
  client: PoolClient,
  input: Parameters<EveningStore["save"]>[0],
  feedbackId: string,
): Promise<void> {
  await client.query(
    `UPDATE daily_energy.runtime_command_receipt
        SET "responseRef"=$1::uuid,"terminalAt"=$2::timestamptz
      WHERE "accountId"=$3::uuid AND "commandRef"=$4::uuid`,
    [
      feedbackId,
      input.now,
      input.accountId,
      commandRefStorageUuid(input.request.command_ref),
    ],
  );
}

async function insertOutbox(
  client: PoolClient,
  input: {
    readonly aggregateRevision: number;
    readonly deletionEpoch: bigint;
    readonly feedbackRevision: number;
    readonly helpfulnessRevision: number;
    readonly interactionId: string;
    readonly now: Date;
    readonly productDate: string;
    readonly safetyEpoch: bigint;
    readonly taskRevision: number;
  },
): Promise<void> {
  const idempotencyKey = createHash("sha256")
    .update(
      `c012:WeeklySourceChanged:${input.interactionId}:${input.aggregateRevision}`,
      "utf8",
    )
    .digest();
  await client.query(
    `INSERT INTO daily_energy.runtime_outbox_event
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
       state,"availableAt","attemptCount","createdAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),'DailyInteraction',$1::uuid,$2,
             'WeeklySourceChanged','v1',$3,$4::jsonb,$5::jsonb,'PENDING',
             $6::timestamptz,0,$6::timestamptz,$7,'RUNTIME',$6::timestamptz,
             $8::timestamptz)`,
    [
      input.interactionId,
      input.aggregateRevision,
      idempotencyKey,
      JSON.stringify({
        feedback_revision: input.feedbackRevision,
        helpfulness_revision: input.helpfulnessRevision,
        product_date: input.productDate,
        task_revision: input.taskRevision,
      }),
      JSON.stringify({
        deletion: input.deletionEpoch.toString(),
        safety: input.safetyEpoch.toString(),
      }),
      input.now,
      RETENTION_POLICY_VERSION,
      new Date(input.now.getTime() + RUNTIME_TTL_MS),
    ],
  );
}

async function lockAccountGuard(
  client: PoolClient,
  accountId: string,
): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
    [accountId, ACCOUNT_GUARD_LOCK_SEED],
  );
}

async function assertRole(pool: Pool, expectedRole: string): Promise<void> {
  const row = (
    await pool.query<{
      currentUser: string;
      expectedMember: boolean;
      sessionUser: string;
    }>(
      `SELECT current_user AS "currentUser",session_user AS "sessionUser",
              pg_has_role(current_user,$1,'MEMBER') AS "expectedMember"`,
      [expectedRole],
    )
  ).rows[0];
  if (!row || row.currentUser !== row.sessionUser || !row.expectedMember) {
    throw new Error("EVENING_DB_ROLE_MISMATCH");
  }
}
