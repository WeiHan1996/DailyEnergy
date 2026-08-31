import { createHash, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  DailyInteractionStateSchema,
  HistoryListViewSchema,
  type DailyInteractionState,
  type HistoryListView,
  type TaskStatus,
} from "@daily-energy/shared-schemas";
import {
  createViewContinuationGrant,
  evaluateWriteWindow,
  parseProductDate,
  validateViewContinuationGrant,
  type ProductDateWriteOperation,
  type ViewContinuationGrant,
} from "@daily-energy/server-core/product-time";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";
import { resolveGenerationGuardSnapshot } from "../generation/guard-snapshot.js";

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const COMMAND_RECEIPT_TTL_MS = 7 * 24 * 60 * 60_000;
const OUTBOX_TTL_MS = 30 * 24 * 60 * 60_000;
const ACCOUNT_GUARD_LOCK_SEED = 20_400;

export type DailyInteractionGuardFailure =
  | "ACCOUNT_DELETED"
  | "ACCOUNT_DELETING"
  | "ACCOUNT_RESTRICTED"
  | "CONSENT_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "SAFETY_BLOCKED"
  | "STATE_PRECONDITION_FAILED";

export type DailyInteractionQueryResult =
  | { readonly status: "FOUND"; readonly value: DailyInteractionState }
  | { readonly status: "NOT_FOUND" | DailyInteractionGuardFailure };

export type DailyTaskMutationResult =
  | {
      readonly status: "ACCEPTED" | "DUPLICATE";
      readonly value: DailyInteractionState;
    }
  | {
      readonly status: "REVISION_CONFLICT";
      readonly current: DailyInteractionState;
    }
  | {
      readonly status:
        | "IDEMPOTENCY_CONFLICT"
        | "NOT_FOUND"
        | "VIEW_CONTINUATION_EXPIRED"
        | "WRITE_WINDOW_CLOSED"
        | DailyInteractionGuardFailure;
    };

export type DailyLightMutationResult =
  | {
      readonly status: "ACCEPTED" | "DUPLICATE";
      readonly value: DailyInteractionState;
    }
  | {
      readonly status:
        | "IDEMPOTENCY_CONFLICT"
        | "NOT_FOUND"
        | "VIEW_CONTINUATION_EXPIRED"
        | "WRITE_WINDOW_CLOSED"
        | DailyInteractionGuardFailure;
    };

export type HistoryListQueryResult =
  | { readonly status: "FOUND"; readonly value: HistoryListView }
  | { readonly status: DailyInteractionGuardFailure };

export interface DailyInteractionStore {
  close(): Promise<void>;
  get(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<DailyInteractionQueryResult>;
  lightDay(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
    readonly productDatePolicyVersion: string;
    readonly resultRef: string;
    readonly sessionId: string;
  }): Promise<DailyLightMutationResult>;
  listHistory(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<HistoryListQueryResult>;
  openToday(input: {
    readonly accountId: string;
    readonly openedAt: Date;
    readonly productDate: string;
    readonly resultId: string;
    readonly sessionId: string;
  }): Promise<{ readonly status: "RECORDED" | DailyInteractionGuardFailure }>;
  updateTask(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly expectedRevision: number;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
    readonly productDatePolicyVersion: string;
    readonly sessionId: string;
    readonly status: TaskStatus;
    readonly taskRef: string;
  }): Promise<DailyTaskMutationResult>;
}

export interface PostgresDailyInteractionStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface InteractionRow {
  readonly aggregateRevision: number;
  readonly helpfulnessRating:
    "HELPFUL" | "NEUTRAL" | "NOT_HELPFUL" | "NOT_USED" | null;
  readonly helpfulnessRevision: number | null;
  readonly interactionId: string;
  readonly isLit: boolean;
  readonly lightId: string | null;
  readonly productDate: string;
  readonly resultId: string;
  readonly taskRef: string;
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
  readonly allowedOperations: ProductDateWriteOperation[];
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

export class PostgresDailyInteractionStore implements DailyInteractionStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresDailyInteractionStoreConfig,
  ): Promise<PostgresDailyInteractionStore> {
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
      return new PostgresDailyInteractionStore(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async get(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<DailyInteractionQueryResult> {
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
      const row = await readInteraction(
        client,
        input.accountId,
        input.productDate,
      );
      return row === undefined
        ? { status: "NOT_FOUND" }
        : { status: "FOUND", value: interactionView(row) };
    });
  }

  public async listHistory(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<HistoryListQueryResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await historyGuard(client, input.accountId);
      if (guard !== undefined) {
        return { status: guard };
      }
      const rows = await client.query<{
        hasEveningFeedback: boolean;
        hasResult: boolean;
        isLit: boolean;
        productDate: string;
        recorded: boolean;
      }>(
        `SELECT product_date AS "productDate",recorded,
                has_result AS "hasResult",is_lit AS "isLit",
                has_evening_feedback AS "hasEveningFeedback"
           FROM daily_energy.list_c011_history_days($1::uuid,$2::date)`,
        [input.accountId, input.productDate],
      );
      return {
        status: "FOUND",
        value: HistoryListViewSchema.parse({
          items: rows.rows.map((row) => ({
            product_date: row.productDate,
            state: row.recorded ? "RECORDED" : "MISSING",
            is_lit: row.isLit,
            has_result: row.hasResult,
            has_evening_feedback: row.hasEveningFeedback,
          })),
          page_info: { has_more: false },
        }),
      };
    });
  }

  public async lightDay(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
    readonly productDatePolicyVersion: string;
    readonly resultRef: string;
    readonly sessionId: string;
  }): Promise<DailyLightMutationResult> {
    const clock = transactionClock(input.now);
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
      const current = await readInteraction(
        client,
        input.accountId,
        input.productDate,
        undefined,
        true,
      );
      if (current === undefined || current.resultId !== input.resultRef) {
        return { status: "NOT_FOUND" };
      }
      const currentInput = { ...input, now: clock() };
      const claim = await claimLightCommand(client, currentInput);
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE" && claim.responseRef !== null) {
        if (claim.responseRef !== current.lightId) {
          throw new Error("DAILY_LIGHT_COMMAND_RESPONSE_MISMATCH");
        }
        return { status: "DUPLICATE", value: interactionView(current) };
      }
      if (current.lightId !== null) {
        await attachCommandResponse(client, currentInput, current.lightId);
        return { status: "DUPLICATE", value: interactionView(current) };
      }
      const windowFailure = await interactionWindowFailure(
        client,
        currentInput,
        current,
        "ILLUMINATE",
      );
      if (windowFailure !== undefined) {
        return { status: windowFailure };
      }
      const lightId = randomUUID();
      await client.query(
        `INSERT INTO daily_energy.app_daily_light_fact
          (id,"interactionId","sourceCommandRef","litAt",
           "sourceValidityRevision","retentionPolicyVersion","retentionScope",
           "retentionAnchorAt")
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,1,$5,'DAY',
                 $4::timestamptz)`,
        [
          lightId,
          current.interactionId,
          commandRefStorageUuid(input.commandRef),
          currentInput.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      const aggregateUpdated = await client.query(
        `UPDATE daily_energy.app_daily_interaction
            SET "aggregateRevision"="aggregateRevision"+1,
                "updatedAt"=$1::timestamptz
          WHERE id=$2::uuid AND "aggregateRevision"=$3`,
        [currentInput.now, current.interactionId, current.aggregateRevision],
      );
      if (aggregateUpdated.rowCount !== 1) {
        throw new Error("DAILY_LIGHT_AGGREGATE_CAS_LOST");
      }
      await insertDayLitOutbox(client, {
        aggregateRevision: current.aggregateRevision + 1,
        deletionEpoch: guard.deletionEpoch,
        interactionId: current.interactionId,
        lightId,
        now: currentInput.now,
        productDate: input.productDate,
        safetyEpoch: guard.safetyEpoch,
      });
      await attachCommandResponse(client, currentInput, lightId);
      return {
        status: "ACCEPTED",
        value: interactionView({
          ...current,
          aggregateRevision: current.aggregateRevision + 1,
          isLit: true,
          lightId,
          updatedAt: currentInput.now,
        }),
      };
    });
  }

  public async openToday(input: {
    readonly accountId: string;
    readonly openedAt: Date;
    readonly productDate: string;
    readonly resultId: string;
    readonly sessionId: string;
  }): Promise<{ readonly status: "RECORDED" | DailyInteractionGuardFailure }> {
    const clock = transactionClock(input.openedAt);
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
      const openedAt = clock();
      const binding = await client.query(
        `SELECT 1
           FROM daily_energy.app_daily_interaction interaction
           JOIN daily_energy.app_published_result_visibility visibility
             ON visibility."resultId"=interaction."resultId"
            AND visibility.state='AVAILABLE'
           JOIN daily_energy.app_session_credential session
             ON session.id=$3::uuid AND session."accountId"=interaction."accountId"
            AND session."revokedAt" IS NULL
            AND session."issuedAt" <= $4::timestamptz
            AND session."expiresAt" > $4::timestamptz
          WHERE interaction."accountId"=$1::uuid
            AND interaction."productDate"=$2::date
            AND interaction."resultId"=$5::uuid`,
        [
          input.accountId,
          input.productDate,
          input.sessionId,
          openedAt,
          input.resultId,
        ],
      );
      if (binding.rowCount !== 1) {
        return { status: "STATE_PRECONDITION_FAILED" };
      }
      let grant: ViewContinuationGrant;
      try {
        grant = createViewContinuationGrant({
          grantRef: commandRefStorageUuid(
            `c010:view:DLY-003:${input.sessionId}:${input.resultId}`,
          ),
          openedAt,
          ownerRef: input.accountId,
          productDate: parseProductDate(input.productDate),
          resultRef: input.resultId,
          sessionRef: input.sessionId,
          surface: "DLY-003",
        });
      } catch {
        return { status: "STATE_PRECONDITION_FAILED" };
      }
      await client.query(
        `INSERT INTO daily_energy.app_view_continuation_grant
          (id,"accountId","sessionId","surfaceCode","productDate",
           "productDatePolicyVersion","resultRef","feedbackRevision",
           "boundaryAt","allowedOperations",revision,"expiresAt",
           "invalidatedAt","createdAt","retentionPolicyVersion",
           "retentionScope","retentionAnchorAt")
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::date,$6,$7::uuid,NULL,
                 $8::timestamptz,$9::text[],$10,$11::timestamptz,NULL,
                 $12::timestamptz,$13,'DAY',$12::timestamptz)
         ON CONFLICT (id) DO NOTHING`,
        grantParameters(grant),
      );
      return { status: "RECORDED" };
    });
  }

  public async updateTask(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly expectedRevision: number;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
    readonly productDatePolicyVersion: string;
    readonly sessionId: string;
    readonly status: TaskStatus;
    readonly taskRef: string;
  }): Promise<DailyTaskMutationResult> {
    const clock = transactionClock(input.now);
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
      const current = await readInteraction(
        client,
        input.accountId,
        input.productDate,
        input.taskRef,
        true,
      );
      if (current === undefined) {
        return { status: "NOT_FOUND" };
      }
      const currentInput = { ...input, now: clock() };
      const claim = await claimCommand(client, currentInput);
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE" && claim.responseRef !== null) {
        if (claim.responseRef !== current.taskStateId) {
          throw new Error("DAILY_TASK_COMMAND_RESPONSE_MISMATCH");
        }
        return { status: "DUPLICATE", value: interactionView(current) };
      }
      const windowFailure = await taskWindowFailure(
        client,
        currentInput,
        current,
      );
      if (windowFailure !== undefined) {
        return { status: windowFailure };
      }
      if (current.taskRevision !== input.expectedRevision) {
        return {
          current: interactionView(current),
          status: "REVISION_CONFLICT",
        };
      }
      if (current.taskStatus === input.status) {
        await attachCommandResponse(client, currentInput, current.taskStateId);
        return { status: "DUPLICATE", value: interactionView(current) };
      }
      const nextRevision = current.taskRevision + 1;
      const taskUpdated = await client.query(
        `UPDATE daily_energy.app_daily_task_state
            SET status=$1,revision=$2,"updatedAt"=$3::timestamptz
          WHERE id=$4::uuid AND revision=$5`,
        [
          input.status,
          nextRevision,
          currentInput.now,
          current.taskStateId,
          input.expectedRevision,
        ],
      );
      if (taskUpdated.rowCount !== 1) {
        const latest = await readInteraction(
          client,
          input.accountId,
          input.productDate,
          input.taskRef,
          true,
        );
        if (latest === undefined) {
          return { status: "NOT_FOUND" };
        }
        return {
          current: interactionView(latest),
          status: "REVISION_CONFLICT",
        };
      }
      const aggregateUpdated = await client.query(
        `UPDATE daily_energy.app_daily_interaction
            SET "aggregateRevision"="aggregateRevision"+1,
                "updatedAt"=$1::timestamptz
          WHERE id=$2::uuid AND "aggregateRevision"=$3`,
        [currentInput.now, current.interactionId, current.aggregateRevision],
      );
      if (aggregateUpdated.rowCount !== 1) {
        throw new Error("DAILY_INTERACTION_AGGREGATE_CAS_LOST");
      }
      await insertWeeklySourceChangedOutbox(client, {
        aggregateRevision: current.aggregateRevision + 1,
        deletionEpoch: guard.deletionEpoch,
        interactionId: current.interactionId,
        now: currentInput.now,
        productDate: input.productDate,
        safetyEpoch: guard.safetyEpoch,
      });
      await attachCommandResponse(client, currentInput, current.taskStateId);
      return {
        status: "ACCEPTED",
        value: interactionView({
          ...current,
          aggregateRevision: current.aggregateRevision + 1,
          taskRevision: nextRevision,
          taskStatus: input.status,
          updatedAt: currentInput.now,
        }),
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
    this.#assertOpen();
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

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("DAILY_INTERACTION_STORE_CLOSED");
    }
  }
}

export const UNAVAILABLE_DAILY_INTERACTION_STORE: DailyInteractionStore =
  Object.freeze({
    async close() {},
    async get() {
      throw new Error("DAILY_INTERACTION_STORE_UNAVAILABLE");
    },
    async lightDay() {
      throw new Error("DAILY_INTERACTION_STORE_UNAVAILABLE");
    },
    async listHistory() {
      throw new Error("DAILY_INTERACTION_STORE_UNAVAILABLE");
    },
    async openToday() {
      return { status: "RECORDED" } as const;
    },
    async updateTask() {
      throw new Error("DAILY_INTERACTION_STORE_UNAVAILABLE");
    },
  });

async function readInteraction(
  client: PoolClient,
  accountId: string,
  productDate: string,
  taskRef?: string,
  lock = false,
): Promise<InteractionRow | undefined> {
  return (
    await client.query<InteractionRow>(
      `SELECT interaction.id AS "interactionId",
              interaction."aggregateRevision",interaction."productDate"::text AS "productDate",
              interaction."resultId",interaction."updatedAt",
              task.id AS "taskStateId",task."taskDefinitionId" AS "taskRef",
              task.revision AS "taskRevision",task.status::text AS "taskStatus",
              helpfulness.rating::text AS "helpfulnessRating",
              helpfulness.revision AS "helpfulnessRevision",
              light.id AS "lightId",(light.id IS NOT NULL) AS "isLit"
         FROM daily_energy.app_daily_interaction interaction
         JOIN daily_energy.app_published_result_visibility visibility
           ON visibility."resultId"=interaction."resultId"
          AND visibility.state='AVAILABLE'
         JOIN daily_energy.app_daily_task_state task
           ON task."interactionId"=interaction.id
         LEFT JOIN daily_energy.app_daily_helpfulness_record helpfulness
           ON helpfulness."interactionId"=interaction.id
         LEFT JOIN daily_energy.app_daily_light_fact light
           ON light."interactionId"=interaction.id
        WHERE interaction."accountId"=$1::uuid
          AND interaction."productDate"=$2::date
          AND ($3::text IS NULL OR task."taskDefinitionId"=$3::text)
        LIMIT 1${lock ? " FOR UPDATE OF interaction,task" : ""}`,
      [accountId, productDate, taskRef ?? null],
    )
  ).rows[0];
}

function interactionView(row: InteractionRow): DailyInteractionState {
  if (row.helpfulnessRating !== null && row.helpfulnessRevision === null) {
    throw new Error("DAILY_HELPFULNESS_REVISION_MISSING");
  }
  return DailyInteractionStateSchema.parse({
    contract: "daily-interaction-state",
    schema_version: "1.0.0",
    result_id: row.resultId,
    product_date: row.productDate,
    is_lit: row.isLit,
    task: {
      task_id: row.taskRef,
      revision: row.taskRevision,
      status: row.taskStatus,
    },
    helpfulness:
      row.helpfulnessRating === null
        ? { rating: "UNRATED", revision: 0 }
        : {
            rating: row.helpfulnessRating,
            revision: row.helpfulnessRevision,
          },
    updated_at: row.updatedAt.toISOString(),
  });
}

async function taskWindowFailure(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly now: Date;
    readonly productDate: string;
    readonly sessionId: string;
  },
  current: InteractionRow,
): Promise<"VIEW_CONTINUATION_EXPIRED" | "WRITE_WINDOW_CLOSED" | undefined> {
  return interactionWindowFailure(client, input, current, "TASK_STATUS_SET");
}

async function interactionWindowFailure(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly now: Date;
    readonly productDate: string;
    readonly sessionId: string;
  },
  current: InteractionRow,
  operation: "ILLUMINATE" | "TASK_STATUS_SET",
): Promise<"VIEW_CONTINUATION_EXPIRED" | "WRITE_WINDOW_CLOSED" | undefined> {
  const grant = await findContinuationGrant(client, {
    accountId: input.accountId,
    productDate: input.productDate,
    resultId: current.resultId,
    sessionId: input.sessionId,
  });
  const writeWindow = evaluateWriteWindow({
    ...(grant === undefined ? {} : { grant }),
    now: input.now,
    operation,
    ownerRef: input.accountId,
    sessionRef: input.sessionId,
    surface: "DLY-003",
    targetProductDate: parseProductDate(input.productDate),
  });
  if (writeWindow !== "CLOSED") {
    return undefined;
  }
  return grant !== undefined &&
    (grant.invalidatedAt !== undefined ||
      input.now.getTime() >= grant.expiresAt.getTime())
    ? "VIEW_CONTINUATION_EXPIRED"
    : "WRITE_WINDOW_CLOSED";
}

async function claimLightCommand(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
    readonly productDatePolicyVersion: string;
    readonly resultRef: string;
  },
): Promise<CommandClaim> {
  const commandRef = commandRefStorageUuid(input.commandRef);
  const targetKey = `${input.productDate}:${input.resultRef}`;
  const inserted = await client.query(
    `INSERT INTO daily_energy.runtime_command_receipt
      (id,"accountId","commandRef","operationCode","targetScope",
       "targetKey","productDatePolicyVersion","normalizedPayloadFingerprint",
       "acceptedAt","retentionPolicyVersion","retentionScope",
       "retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),$1,$2,'ILLUMINATE','DAY',$3,$4,$5,
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
        WHERE "accountId"=$1::uuid AND "commandRef"=$2::uuid
        FOR UPDATE`,
      [input.accountId, commandRef],
    )
  ).rows[0];
  if (row === undefined) {
    throw new Error("DAILY_LIGHT_COMMAND_RECEIPT_MISSING");
  }
  return row.operationCode === "ILLUMINATE" &&
    row.targetKey === targetKey &&
    row.productDatePolicyVersion === input.productDatePolicyVersion &&
    row.normalizedPayloadFingerprint.equals(input.normalizedPayloadFingerprint)
    ? { responseRef: row.responseRef, status: "DUPLICATE" }
    : { status: "CONFLICT" };
}

async function insertDayLitOutbox(
  client: PoolClient,
  input: {
    readonly aggregateRevision: number;
    readonly deletionEpoch: bigint;
    readonly interactionId: string;
    readonly lightId: string;
    readonly now: Date;
    readonly productDate: string;
    readonly safetyEpoch: bigint;
  },
): Promise<void> {
  const idempotencyKey = createHash("sha256")
    .update(`c011:DayLit:${input.lightId}:1`, "utf8")
    .digest();
  await client.query(
    `INSERT INTO daily_energy.runtime_outbox_event
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
       state,"availableAt","attemptCount","createdAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),'DailyLight',$1::uuid,1,'DayLit','v1',$2,
             $3::jsonb,$4::jsonb,'PENDING',$5::timestamptz,0,$5::timestamptz,
             $6,'RUNTIME',$5::timestamptz,$7::timestamptz)`,
    [
      input.lightId,
      idempotencyKey,
      JSON.stringify({
        product_date: input.productDate,
        source_validity_revision: 1,
      }),
      JSON.stringify({
        deletion: input.deletionEpoch.toString(),
        safety: input.safetyEpoch.toString(),
      }),
      input.now,
      RETENTION_POLICY_VERSION,
      new Date(input.now.getTime() + OUTBOX_TTL_MS),
    ],
  );
  await insertWeeklySourceChangedOutbox(client, {
    aggregateRevision: input.aggregateRevision,
    deletionEpoch: input.deletionEpoch,
    interactionId: input.interactionId,
    now: input.now,
    productDate: input.productDate,
    safetyEpoch: input.safetyEpoch,
  });
}

async function insertWeeklySourceChangedOutbox(
  client: PoolClient,
  input: {
    readonly aggregateRevision: number;
    readonly deletionEpoch: bigint;
    readonly interactionId: string;
    readonly now: Date;
    readonly productDate: string;
    readonly safetyEpoch: bigint;
  },
): Promise<void> {
  const idempotencyKey = createHash("sha256")
    .update(
      `c013:WeeklySourceChanged:${input.interactionId}:${input.aggregateRevision}`,
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
      JSON.stringify({ product_date: input.productDate }),
      JSON.stringify({
        deletion: input.deletionEpoch.toString(),
        safety: input.safetyEpoch.toString(),
      }),
      input.now,
      RETENTION_POLICY_VERSION,
      new Date(input.now.getTime() + OUTBOX_TTL_MS),
    ],
  );
}

async function historyGuard(
  client: PoolClient,
  accountId: string,
): Promise<DailyInteractionGuardFailure | undefined> {
  const row = (
    await client.query<{ status: DailyInteractionGuardFailure | "ALLOWED" }>(
      `SELECT daily_energy.resolve_c011_history_guard(
         $1::uuid,'necessary-consent-v1'
       ) AS status`,
      [accountId],
    )
  ).rows[0];
  return row === undefined || row.status === "ALLOWED" ? undefined : row.status;
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
              g."productDatePolicyVersion",g."resultRef",
              g."feedbackRevision",g."boundaryAt",g."allowedOperations",
              g.revision,g."expiresAt",g."invalidatedAt",g."createdAt"
         FROM daily_energy.app_view_continuation_grant g
        WHERE g."accountId"=$1::uuid AND g."sessionId"=$2::uuid
          AND g."productDate"=$3::date AND g."resultRef"=$4::uuid
          AND g."surfaceCode"='DLY-003'
        ORDER BY g."createdAt" DESC,g.id
        LIMIT 1
        FOR SHARE OF g`,
      [input.accountId, input.sessionId, input.productDate, input.resultId],
    )
  ).rows[0];
  if (row === undefined || row.resultRef === null) {
    return undefined;
  }
  if (
    row.productDatePolicyVersion !== "product-date-v1" ||
    row.surface !== "DLY-003" ||
    row.feedbackRevision !== null
  ) {
    throw new Error("DAILY_INTERACTION_CONTINUATION_INVALID");
  }
  return validateViewContinuationGrant({
    allowedOperations: row.allowedOperations,
    boundaryAt: row.boundaryAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    grantRef: row.grantRef,
    ...(row.invalidatedAt === null ? {} : { invalidatedAt: row.invalidatedAt }),
    ownerRef: row.ownerRef,
    productDate: parseProductDate(row.productDate),
    productDatePolicyVersion: "product-date-v1",
    resultRef: row.resultRef,
    revision: row.revision,
    sessionRef: row.sessionRef,
    surface: "DLY-003",
  });
}

async function claimCommand(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
    readonly productDatePolicyVersion: string;
    readonly taskRef: string;
  },
): Promise<CommandClaim> {
  const commandRef = commandRefStorageUuid(input.commandRef);
  const targetKey = `${input.productDate}:${input.taskRef}`;
  const inserted = await client.query(
    `INSERT INTO daily_energy.runtime_command_receipt
      (id,"accountId","commandRef","operationCode","targetScope",
       "targetKey","productDatePolicyVersion","normalizedPayloadFingerprint",
       "acceptedAt","retentionPolicyVersion","retentionScope",
       "retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),$1,$2,'TASK_STATUS_SET','DAY',$3,$4,$5,
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
        WHERE "accountId"=$1::uuid AND "commandRef"=$2::uuid
        FOR UPDATE`,
      [input.accountId, commandRef],
    )
  ).rows[0];
  if (row === undefined) {
    throw new Error("DAILY_TASK_COMMAND_RECEIPT_MISSING");
  }
  return row.operationCode === "TASK_STATUS_SET" &&
    row.targetKey === targetKey &&
    row.productDatePolicyVersion === input.productDatePolicyVersion &&
    row.normalizedPayloadFingerprint.equals(input.normalizedPayloadFingerprint)
    ? { responseRef: row.responseRef, status: "DUPLICATE" }
    : { status: "CONFLICT" };
}

async function attachCommandResponse(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly now: Date;
  },
  taskStateId: string,
): Promise<void> {
  await client.query(
    `UPDATE daily_energy.runtime_command_receipt
        SET "responseRef"=$1::uuid,"terminalAt"=$2::timestamptz
      WHERE "accountId"=$3::uuid AND "commandRef"=$4::uuid`,
    [
      taskStateId,
      input.now,
      input.accountId,
      commandRefStorageUuid(input.commandRef),
    ],
  );
}

function grantParameters(grant: ViewContinuationGrant): unknown[] {
  return [
    grant.grantRef,
    grant.ownerRef,
    grant.sessionRef,
    grant.surface,
    grant.productDate,
    grant.productDatePolicyVersion,
    grant.resultRef,
    grant.boundaryAt,
    grant.allowedOperations,
    grant.revision,
    grant.expiresAt,
    grant.createdAt,
    RETENTION_POLICY_VERSION,
  ];
}

function transactionClock(baseNow: Date): () => Date {
  const startedAt = process.hrtime.bigint();
  return () => {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    const elapsedMilliseconds = Math.max(
      0,
      Math.floor(Number(elapsedNanoseconds) / 1_000_000),
    );
    return new Date(baseNow.getTime() + elapsedMilliseconds);
  };
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
    throw new Error("DAILY_INTERACTION_DB_ROLE_MISMATCH");
  }
}
