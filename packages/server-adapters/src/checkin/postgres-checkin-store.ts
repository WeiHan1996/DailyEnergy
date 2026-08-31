import { createHash } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import { resolveGenerationGuardSnapshot } from "../generation/guard-snapshot.js";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { CURRENT_NECESSARY_CONSENT_NOTICE_VERSION } from "../consent-profile/postgres-consent-profile-store.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const COMMAND_RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const OUTBOX_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const CHECKIN_LOCK_SEED = 20_004;
const ACCOUNT_GUARD_LOCK_SEED = 20_400;

export type StoredCheckinMood =
  "VERY_LOW" | "LOW" | "STEADY" | "GOOD" | "LIGHT" | "UNSURE";
export type StoredCheckinEnergy =
  "EMPTY" | "LOW" | "STEADY" | "HIGH" | "FULL" | "UNSURE";
export type StoredCheckinSleep = "POOR" | "LOW" | "OKAY" | "GOOD" | "UNSURE";

export interface StoredCheckinView {
  readonly checkinRef: string;
  readonly energy: StoredCheckinEnergy;
  readonly mood: StoredCheckinMood;
  readonly productDate: string;
  readonly revision: number;
  readonly sleep: StoredCheckinSleep;
  readonly updatedAt: Date;
}

export type CheckinGuardFailure =
  | "ACCOUNT_DELETED"
  | "ACCOUNT_DELETING"
  | "ACCOUNT_RESTRICTED"
  | "CONSENT_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "SAFETY_BLOCKED"
  | "STATE_PRECONDITION_FAILED";

export type CheckinQueryResult =
  | { readonly status: "FOUND"; readonly value: StoredCheckinView }
  | { readonly status: "NOT_FOUND" | CheckinGuardFailure };

export type CheckinMutationResult =
  | {
      readonly status: "ACCEPTED" | "DUPLICATE";
      readonly value: StoredCheckinView;
    }
  | {
      readonly status: "CHECKIN_ALREADY_EXISTS" | "REVISION_CONFLICT";
      readonly current: StoredCheckinView;
    }
  | {
      readonly status:
        "IDEMPOTENCY_CONFLICT" | "NOT_FOUND" | CheckinGuardFailure;
    };

interface CheckinValues {
  readonly energy: StoredCheckinEnergy;
  readonly mood: StoredCheckinMood;
  readonly sleep: StoredCheckinSleep;
}

interface CheckinCommandAcceptance {
  readonly now: Date;
  readonly productDate: string;
  readonly productDatePolicyVersion: string;
}

interface CheckinCommandInput extends CheckinValues {
  readonly accountId: string;
  readonly commandRef: string;
  readonly normalizedPayloadFingerprint: Buffer;
  readonly now?: Date;
  readonly productDate?: string;
  readonly productDatePolicyVersion?: string;
  readonly resolveAcceptance?: () => CheckinCommandAcceptance;
}

export interface CheckinStore {
  close(): Promise<void>;
  correct(
    input: CheckinCommandInput & { readonly expectedRevision: number },
  ): Promise<CheckinMutationResult>;
  getToday(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<CheckinQueryResult>;
  submit(input: CheckinCommandInput): Promise<CheckinMutationResult>;
}

export interface PostgresCheckinStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface CheckinRow {
  readonly checkinRef: string;
  readonly commandRef: string;
  readonly energy: StoredCheckinEnergy;
  readonly mood: StoredCheckinMood;
  readonly productDate: string;
  readonly revision: number;
  readonly revisionRef: string;
  readonly sleep: StoredCheckinSleep;
  readonly updatedAt: Date;
}

interface ReceiptRow {
  readonly acceptedAt: Date;
  readonly normalizedPayloadFingerprint: Buffer;
  readonly operationCode: string;
  readonly productDatePolicyVersion: string | null;
  readonly responseRef: string | null;
  readonly targetKey: string;
}

type CommandClaim =
  | {
      readonly acceptance: CheckinCommandAcceptance;
      readonly status: "NEW";
    }
  | { readonly status: "CONFLICT" }
  | { readonly receipt: ReceiptRow; readonly status: "DUPLICATE" };

export class PostgresCheckinStore implements CheckinStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresCheckinStoreConfig,
  ): Promise<PostgresCheckinStore> {
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
      const identity = await pool.query<{
        currentUser: string;
        expectedMember: boolean;
        sessionUser: string;
      }>(
        `SELECT current_user AS "currentUser",
                session_user AS "sessionUser",
                pg_has_role(current_user, $1, 'MEMBER') AS "expectedMember"`,
        [config.expectedDatabaseRole],
      );
      const row = identity.rows[0];
      if (!row || row.currentUser !== row.sessionUser || !row.expectedMember) {
        throw new Error("CHECKIN_DB_ROLE_MISMATCH");
      }
    } catch {
      await pool.end();
      throw new Error("CHECKIN_DB_ROLE_MISMATCH");
    }
    return new PostgresCheckinStore(pool);
  }

  public async getToday(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<CheckinQueryResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await checkGuard(
        client,
        input.accountId,
        input.productDate,
      );
      if (guard !== "ALLOWED") {
        return { status: guard };
      }
      const current = await readCurrentCheckin(
        client,
        input.accountId,
        input.productDate,
      );
      return current === undefined
        ? { status: "NOT_FOUND" }
        : { status: "FOUND", value: checkinView(current) };
    });
  }

  public async submit(
    input: CheckinCommandInput,
  ): Promise<CheckinMutationResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const existingReceipt = await findCommandReceipt(
        client,
        input.accountId,
        input.commandRef,
      );
      if (
        existingReceipt !== undefined &&
        !commandReceiptMatches(
          existingReceipt,
          input.normalizedPayloadFingerprint,
          "CHECKIN_SUBMIT",
        )
      ) {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (existingReceipt !== undefined) {
        await lockCheckin(client, input.accountId, existingReceipt.targetKey);
        const guard = await checkGuard(
          client,
          input.accountId,
          existingReceipt.targetKey,
        );
        if (guard !== "ALLOWED") {
          return { status: guard };
        }
        const revision = await requiredReceiptRevision(
          client,
          input.accountId,
          existingReceipt.responseRef,
        );
        return { status: "DUPLICATE", value: checkinView(revision) };
      }

      const prepared = await prepareNewCommand(client, input);
      if (prepared.status !== "READY") {
        return { status: prepared.status };
      }
      const acceptance = prepared.acceptance;
      const claim = await claimCommand(
        client,
        input,
        "CHECKIN_SUBMIT",
        acceptance,
      );
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        const revision = await requiredReceiptRevision(
          client,
          input.accountId,
          claim.receipt.responseRef,
        );
        return { status: "DUPLICATE", value: checkinView(revision) };
      }

      const current = await readCurrentCheckin(
        client,
        input.accountId,
        acceptance.productDate,
        true,
      );
      if (current !== undefined) {
        await attachResponse(
          client,
          input,
          acceptance.now,
          current.revisionRef,
        );
        const value = checkinView(current);
        return sameValues(current, input)
          ? { status: "DUPLICATE", value }
          : { status: "CHECKIN_ALREADY_EXISTS", current: value };
      }

      const storageCommandRef = commandRefStorageUuid(input.commandRef);
      const created = await client.query<{ checkinRef: string }>(
        `INSERT INTO daily_energy.app_morning_checkin
           (id, "accountId", "productDate", "productDatePolicyVersion",
            revision, mood, energy, sleep, "firstSubmittedAt", "updatedAt",
            "sourceCommandRef", "retentionPolicyVersion", "retentionScope",
           "retentionAnchorAt")
         VALUES (gen_random_uuid(), $1, $2::date, $3, 1, $4, $5, $6,
                 $7::timestamptz, $7::timestamptz, $8::uuid, $9, 'DAY',
                 $7::timestamptz)
         RETURNING id AS "checkinRef"`,
        [
          input.accountId,
          acceptance.productDate,
          acceptance.productDatePolicyVersion,
          input.mood,
          input.energy,
          input.sleep,
          acceptance.now,
          storageCommandRef,
          RETENTION_POLICY_VERSION,
        ],
      );
      const checkinRef = requiredString(
        created.rows[0]?.checkinRef,
        "CHECKIN_CREATE_FAILED",
      );
      const revisionRef = await insertRevision(client, {
        ...input,
        acceptance,
        checkinRef,
        revision: 1,
      });
      await attachResponse(client, input, acceptance.now, revisionRef);
      return {
        status: "ACCEPTED",
        value: {
          checkinRef,
          energy: input.energy,
          mood: input.mood,
          productDate: acceptance.productDate,
          revision: 1,
          sleep: input.sleep,
          updatedAt: acceptance.now,
        },
      };
    });
  }

  public async correct(
    input: CheckinCommandInput & { readonly expectedRevision: number },
  ): Promise<CheckinMutationResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const existingReceipt = await findCommandReceipt(
        client,
        input.accountId,
        input.commandRef,
      );
      if (
        existingReceipt !== undefined &&
        !commandReceiptMatches(
          existingReceipt,
          input.normalizedPayloadFingerprint,
          "CHECKIN_CORRECT",
        )
      ) {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      let replayReceipt = existingReceipt;
      let acceptance: CheckinCommandAcceptance;
      if (existingReceipt !== undefined) {
        await lockCheckin(client, input.accountId, existingReceipt.targetKey);
        const guard = await checkGuard(
          client,
          input.accountId,
          existingReceipt.targetKey,
        );
        if (guard !== "ALLOWED") {
          return { status: guard };
        }
        acceptance = {
          now: existingReceipt.acceptedAt,
          productDate: existingReceipt.targetKey,
          productDatePolicyVersion:
            existingReceipt.productDatePolicyVersion ?? "product-date-v1",
        };
      } else {
        const prepared = await prepareNewCommand(client, input);
        if (prepared.status !== "READY") {
          return { status: prepared.status };
        }
        acceptance = prepared.acceptance;
        const claim = await claimCommand(
          client,
          input,
          "CHECKIN_CORRECT",
          acceptance,
        );
        if (claim.status === "CONFLICT") {
          return { status: "IDEMPOTENCY_CONFLICT" };
        }
        if (claim.status === "DUPLICATE") {
          replayReceipt = claim.receipt;
          acceptance = {
            now: claim.receipt.acceptedAt,
            productDate: claim.receipt.targetKey,
            productDatePolicyVersion:
              claim.receipt.productDatePolicyVersion ??
              acceptance.productDatePolicyVersion,
          };
        }
      }
      const current = await readCurrentCheckin(
        client,
        input.accountId,
        acceptance.productDate,
        true,
      );
      if (current === undefined) {
        return { status: "NOT_FOUND" };
      }
      if (replayReceipt !== undefined) {
        if (replayReceipt.responseRef === null) {
          return { status: "REVISION_CONFLICT", current: checkinView(current) };
        }
        const revision = await requiredReceiptRevision(
          client,
          input.accountId,
          replayReceipt.responseRef,
        );
        return {
          status: "DUPLICATE",
          value: checkinView(revision),
        };
      }
      if (current.revision !== input.expectedRevision) {
        return { status: "REVISION_CONFLICT", current: checkinView(current) };
      }
      if (sameValues(current, input)) {
        await attachResponse(
          client,
          input,
          acceptance.now,
          current.revisionRef,
        );
        return { status: "DUPLICATE", value: checkinView(current) };
      }

      const nextRevision = current.revision + 1;
      const updated = await client.query(
        `UPDATE daily_energy.app_morning_checkin
            SET revision = $1, mood = $2, energy = $3, sleep = $4,
                "updatedAt" = $5::timestamptz
          WHERE id = $6::uuid AND "accountId" = $7::uuid AND revision = $8`,
        [
          nextRevision,
          input.mood,
          input.energy,
          input.sleep,
          acceptance.now,
          current.checkinRef,
          input.accountId,
          input.expectedRevision,
        ],
      );
      if (updated.rowCount !== 1) {
        return {
          status: "REVISION_CONFLICT",
          current: checkinView(
            requiredCheckin(
              await readCurrentCheckin(
                client,
                input.accountId,
                acceptance.productDate,
                true,
              ),
            ),
          ),
        };
      }
      const revisionRef = await insertRevision(client, {
        ...input,
        acceptance,
        checkinRef: current.checkinRef,
        revision: nextRevision,
      });
      const weeklyGuard = await resolveGenerationGuardSnapshot(
        client,
        input.accountId,
        acceptance.productDate,
      );
      if (weeklyGuard.status !== "ALLOWED") {
        throw new Error("CHECKIN_CORRECTION_GUARD_CHANGED");
      }
      await insertCheckinCorrectedOutbox(client, {
        checkinRef: current.checkinRef,
        deletionEpoch: weeklyGuard.deletionEpoch,
        now: acceptance.now,
        productDate: acceptance.productDate,
        revision: nextRevision,
        safetyEpoch: weeklyGuard.safetyEpoch,
      });
      await attachResponse(client, input, acceptance.now, revisionRef);
      return {
        status: "ACCEPTED",
        value: {
          checkinRef: current.checkinRef,
          energy: input.energy,
          mood: input.mood,
          productDate: acceptance.productDate,
          revision: nextRevision,
          sleep: input.sleep,
          updatedAt: acceptance.now,
        },
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
      throw new Error("CHECKIN_STORE_CLOSED");
    }
  }
}

async function insertCheckinCorrectedOutbox(
  client: PoolClient,
  input: {
    readonly checkinRef: string;
    readonly deletionEpoch: bigint;
    readonly now: Date;
    readonly productDate: string;
    readonly revision: number;
    readonly safetyEpoch: bigint;
  },
): Promise<void> {
  const idempotencyKey = createHash("sha256")
    .update(
      `c013:CheckinCorrected:${input.checkinRef}:${input.revision}`,
      "utf8",
    )
    .digest();
  await client.query(
    `INSERT INTO daily_energy.runtime_outbox_event
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
       state,"availableAt","attemptCount","createdAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),'MorningCheckin',$1::uuid,$2,'CheckinCorrected',
             'v1',$3,$4::jsonb,$5::jsonb,'PENDING',$6::timestamptz,0,
             $6::timestamptz,$7,'RUNTIME',$6::timestamptz,$8::timestamptz)`,
    [
      input.checkinRef,
      input.revision,
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

export const UNAVAILABLE_CHECKIN_STORE: CheckinStore = {
  close: async () => undefined,
  correct: async () => {
    throw new Error("CHECKIN_STORE_UNAVAILABLE");
  },
  getToday: async () => {
    throw new Error("CHECKIN_STORE_UNAVAILABLE");
  },
  submit: async () => {
    throw new Error("CHECKIN_STORE_UNAVAILABLE");
  },
};

async function checkGuard(
  client: Pick<Pool, "query"> | Pick<PoolClient, "query">,
  accountId: string,
  productDate: string,
): Promise<"ALLOWED" | CheckinGuardFailure> {
  const result = await client.query<{ status: string }>(
    `SELECT daily_energy.resolve_checkin_guard_status(
       $1::uuid, $2::date, $3::text
     ) AS status`,
    [accountId, productDate, CURRENT_NECESSARY_CONSENT_NOTICE_VERSION],
  );
  const status = result.rows[0]?.status;
  if (
    status === "ALLOWED" ||
    status === "ACCOUNT_DELETED" ||
    status === "ACCOUNT_DELETING" ||
    status === "ACCOUNT_RESTRICTED" ||
    status === "CONSENT_REQUIRED" ||
    status === "ONBOARDING_REQUIRED" ||
    status === "SAFETY_BLOCKED" ||
    status === "STATE_PRECONDITION_FAILED"
  ) {
    return status;
  }
  throw new Error("CHECKIN_GUARD_INVALID");
}

async function lockCheckin(
  client: PoolClient,
  accountId: string,
  productDate: string,
): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text, $2::bigint))",
    [`${accountId}:${productDate}`, CHECKIN_LOCK_SEED],
  );
}

async function lockAccountGuard(
  client: PoolClient,
  accountId: string,
): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text, $2::bigint))",
    [accountId, ACCOUNT_GUARD_LOCK_SEED],
  );
}

async function claimCommand(
  client: PoolClient,
  input: CheckinCommandInput,
  operationCode: "CHECKIN_CORRECT" | "CHECKIN_SUBMIT",
  acceptance: CheckinCommandAcceptance,
): Promise<CommandClaim> {
  const storageCommandRef = commandRefStorageUuid(input.commandRef);
  const inserted = await client.query(
    `INSERT INTO daily_energy.runtime_command_receipt
       (id, "accountId", "commandRef", "operationCode", "targetScope",
        "targetKey", "productDatePolicyVersion",
        "normalizedPayloadFingerprint", "acceptedAt",
        "retentionPolicyVersion", "retentionScope", "retentionAnchorAt",
        "expiresAt")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'DAY', $4, $5, $6,
             $7::timestamptz, $8, 'RUNTIME', $7::timestamptz,
             $9::timestamptz)
     ON CONFLICT ("accountId", "commandRef") DO NOTHING`,
    [
      input.accountId,
      storageCommandRef,
      operationCode,
      acceptance.productDate,
      acceptance.productDatePolicyVersion,
      input.normalizedPayloadFingerprint,
      acceptance.now,
      RETENTION_POLICY_VERSION,
      new Date(acceptance.now.getTime() + COMMAND_RECEIPT_TTL_MS),
    ],
  );
  if (inserted.rowCount === 1) {
    return { acceptance, status: "NEW" };
  }
  const row = await findCommandReceipt(
    client,
    input.accountId,
    input.commandRef,
  );
  if (row === undefined) {
    throw new Error("CHECKIN_COMMAND_RECEIPT_MISSING");
  }
  return commandReceiptMatches(
    row,
    input.normalizedPayloadFingerprint,
    operationCode,
  )
    ? { receipt: row, status: "DUPLICATE" }
    : { status: "CONFLICT" };
}

async function findCommandReceipt(
  client: PoolClient,
  accountId: string,
  commandRef: string,
): Promise<ReceiptRow | undefined> {
  const existing = await client.query<ReceiptRow>(
    `SELECT "acceptedAt", "operationCode", "targetKey",
            "productDatePolicyVersion", "normalizedPayloadFingerprint",
            "responseRef"
       FROM daily_energy.runtime_command_receipt
      WHERE "accountId" = $1::uuid AND "commandRef" = $2::uuid
      FOR UPDATE`,
    [accountId, commandRefStorageUuid(commandRef)],
  );
  return existing.rows[0];
}

function commandReceiptMatches(
  receipt: ReceiptRow,
  fingerprint: Buffer,
  operationCode: "CHECKIN_CORRECT" | "CHECKIN_SUBMIT",
): boolean {
  return (
    receipt.operationCode === operationCode &&
    receipt.normalizedPayloadFingerprint.equals(fingerprint)
  );
}

async function prepareNewCommand(
  client: PoolClient,
  input: CheckinCommandInput,
): Promise<
  | { readonly acceptance: CheckinCommandAcceptance; readonly status: "READY" }
  | { readonly status: CheckinGuardFailure }
> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const beforeLock = resolveCommandAcceptance(input);
    await lockCheckin(client, input.accountId, beforeLock.productDate);
    const afterLock = resolveCommandAcceptance(input);
    if (!sameAcceptanceTarget(beforeLock, afterLock)) {
      continue;
    }
    const guard = await checkGuard(
      client,
      input.accountId,
      afterLock.productDate,
    );
    if (guard !== "ALLOWED") {
      return { status: guard };
    }
    const atPersistence = resolveCommandAcceptance(input);
    if (!sameAcceptanceTarget(afterLock, atPersistence)) {
      continue;
    }
    return { acceptance: atPersistence, status: "READY" };
  }
  throw new Error("CHECKIN_ACCEPTANCE_DATE_UNSTABLE");
}

function resolveCommandAcceptance(
  input: CheckinCommandInput,
): CheckinCommandAcceptance {
  const acceptance =
    input.resolveAcceptance?.() ??
    (input.now === undefined ||
    input.productDate === undefined ||
    input.productDatePolicyVersion === undefined
      ? undefined
      : {
          now: input.now,
          productDate: input.productDate,
          productDatePolicyVersion: input.productDatePolicyVersion,
        });
  if (
    acceptance === undefined ||
    !Number.isFinite(acceptance.now.getTime()) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(acceptance.productDate) ||
    acceptance.productDatePolicyVersion.length === 0
  ) {
    throw new Error("CHECKIN_ACCEPTANCE_INVALID");
  }
  return {
    now: new Date(acceptance.now.getTime()),
    productDate: acceptance.productDate,
    productDatePolicyVersion: acceptance.productDatePolicyVersion,
  };
}

function sameAcceptanceTarget(
  left: CheckinCommandAcceptance,
  right: CheckinCommandAcceptance,
): boolean {
  return (
    left.productDate === right.productDate &&
    left.productDatePolicyVersion === right.productDatePolicyVersion
  );
}

async function attachResponse(
  client: PoolClient,
  input: CheckinCommandInput,
  terminalAt: Date,
  responseRef: string,
): Promise<void> {
  await client.query(
    `UPDATE daily_energy.runtime_command_receipt
        SET "responseRef" = $1::uuid, "terminalAt" = $2::timestamptz
      WHERE "accountId" = $3::uuid AND "commandRef" = $4::uuid`,
    [
      responseRef,
      terminalAt,
      input.accountId,
      commandRefStorageUuid(input.commandRef),
    ],
  );
}

async function readCurrentCheckin(
  client: Pick<Pool, "query"> | Pick<PoolClient, "query">,
  accountId: string,
  productDate: string,
  lock = false,
): Promise<CheckinRow | undefined> {
  const result = await client.query<CheckinRow>(
    `SELECT checkin.id AS "checkinRef", checkin."productDate"::text AS "productDate",
            checkin.revision, checkin.mood, checkin.energy, checkin.sleep,
            checkin."updatedAt", revision.id AS "revisionRef",
            revision."commandRef"::text AS "commandRef"
       FROM daily_energy.app_morning_checkin checkin
       JOIN daily_energy.app_morning_checkin_revision revision
         ON revision."checkinId" = checkin.id
        AND revision.revision = checkin.revision
      WHERE checkin."accountId" = $1::uuid
        AND checkin."productDate" = $2::date
      ${lock ? "FOR UPDATE OF checkin" : ""}`,
    [accountId, productDate],
  );
  return result.rows[0];
}

async function requiredReceiptRevision(
  client: PoolClient,
  accountId: string,
  responseRef: string | null,
): Promise<CheckinRow> {
  if (responseRef === null) {
    throw new Error("CHECKIN_RECEIPT_RESPONSE_MISSING");
  }
  const result = await client.query<CheckinRow>(
    `SELECT checkin.id AS "checkinRef", checkin."productDate"::text AS "productDate",
            revision.revision, revision.mood, revision.energy, revision.sleep,
            revision."createdAt" AS "updatedAt", revision.id AS "revisionRef",
            revision."commandRef"::text AS "commandRef"
       FROM daily_energy.app_morning_checkin_revision revision
       JOIN daily_energy.app_morning_checkin checkin
         ON checkin.id = revision."checkinId"
      WHERE revision.id = $1::uuid AND checkin."accountId" = $2::uuid`,
    [responseRef, accountId],
  );
  return requiredCheckin(result.rows[0]);
}

async function insertRevision(
  client: PoolClient,
  input: CheckinCommandInput & {
    readonly acceptance: CheckinCommandAcceptance;
    readonly checkinRef: string;
    readonly revision: number;
  },
): Promise<string> {
  const result = await client.query<{ revisionRef: string }>(
    `INSERT INTO daily_energy.app_morning_checkin_revision
       (id, "checkinId", revision, mood, energy, sleep, "commandRef",
        "createdAt", "retentionPolicyVersion", "retentionScope",
        "retentionAnchorAt")
     VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6::uuid,
             $7::timestamptz, $8, 'DAY', $7::timestamptz)
     RETURNING id AS "revisionRef"`,
    [
      input.checkinRef,
      input.revision,
      input.mood,
      input.energy,
      input.sleep,
      commandRefStorageUuid(input.commandRef),
      input.acceptance.now,
      RETENTION_POLICY_VERSION,
    ],
  );
  return requiredString(
    result.rows[0]?.revisionRef,
    "CHECKIN_REVISION_CREATE_FAILED",
  );
}

function sameValues(row: CheckinRow, values: CheckinValues): boolean {
  return (
    row.mood === values.mood &&
    row.energy === values.energy &&
    row.sleep === values.sleep
  );
}

function checkinView(row: CheckinRow): StoredCheckinView {
  return {
    checkinRef: row.checkinRef,
    energy: row.energy,
    mood: row.mood,
    productDate: row.productDate,
    revision: row.revision,
    sleep: row.sleep,
    updatedAt: row.updatedAt,
  };
}

function requiredCheckin(value: CheckinRow | undefined): CheckinRow {
  if (value === undefined) {
    throw new Error("CHECKIN_ROW_MISSING");
  }
  return value;
}

function requiredString(value: string | undefined, code: string): string {
  if (value === undefined) {
    throw new Error(code);
  }
  return value;
}
