import { randomUUID } from "node:crypto";

import {
  MatterPolicyError,
  assertMatterTargetDate,
  matterStateAfterPatch,
  transitionMatterState,
  type MatterState,
  type MatterTransition,
} from "@daily-energy/server-core/matter";
import { Pool, type PoolClient } from "pg";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { CURRENT_NECESSARY_CONSENT_NOTICE_VERSION } from "../consent-profile/postgres-consent-profile-store.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const MEMORY_POLICY_VERSION = "memory-policy-v1";
const CONSENT_SURFACE_VERSION = "matter-management-v1";
const COMMAND_RECEIPT_TTL_DAYS = 7;
const MATTER_REVISION_TTL_HOURS = 72;
const TERMINAL_MATTER_TTL_DAYS = 90;
const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const MAX_MATTERS = 1_000;

export interface ProtectedMatterTitle {
  readonly ciphertext: Buffer;
  readonly keyVersion: string;
}

export interface StoredMatterView {
  readonly dailyUseGranted: boolean;
  readonly matterRef: string;
  readonly revision: number;
  readonly state: Exclude<MatterState, "DELETED">;
  readonly targetProductDate?: string;
  readonly title: ProtectedMatterTitle;
  readonly updatedAt: Date;
  readonly weeklyUseGranted: boolean;
}

export type MatterGuardFailure =
  | "ACCOUNT_DELETED"
  | "ACCOUNT_DELETING"
  | "ACCOUNT_RESTRICTED"
  | "CONSENT_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "SAFETY_BLOCKED"
  | "STATE_PRECONDITION_FAILED";

export type MatterQueryResult<T> =
  | { readonly status: "FOUND"; readonly value: T }
  | { readonly status: "NOT_FOUND" | MatterGuardFailure };

export type MatterMutationResult =
  | {
      readonly status: "ACCEPTED" | "DUPLICATE";
      readonly value: StoredMatterView;
    }
  | {
      readonly status:
        | "IDEMPOTENCY_CONFLICT"
        | "NOT_FOUND"
        | "REVISION_CONFLICT"
        | "STATE_PRECONDITION_FAILED"
        | MatterGuardFailure;
      readonly current?: StoredMatterView;
    };

interface MatterCommandInput {
  readonly accountId: string;
  readonly commandRef: string;
  readonly normalizedPayloadFingerprint: Buffer;
  readonly now: Date;
  readonly productDate: string;
}

export interface MatterStore {
  close(): Promise<void>;
  create(
    input: MatterCommandInput & {
      readonly dailyUseGranted: boolean;
      readonly targetProductDate?: string;
      readonly title: ProtectedMatterTitle;
      readonly weeklyUseGranted: boolean;
    },
  ): Promise<MatterMutationResult>;
  get(input: {
    readonly accountId: string;
    readonly matterRef: string;
    readonly now: Date;
    readonly productDate: string;
  }): Promise<MatterQueryResult<StoredMatterView>>;
  list(input: {
    readonly accountId: string;
    readonly now: Date;
    readonly productDate: string;
  }): Promise<MatterQueryResult<readonly StoredMatterView[]>>;
  transition(
    input: MatterCommandInput & {
      readonly expectedRevision: number;
      readonly matterRef: string;
      readonly revokeUseGrants: boolean;
      readonly transition: MatterTransition;
    },
  ): Promise<MatterMutationResult>;
  update(
    input: MatterCommandInput & {
      readonly clearTargetDate: boolean;
      readonly dailyUseGranted?: boolean;
      readonly expectedRevision: number;
      readonly matterRef: string;
      readonly targetProductDate?: string;
      readonly title?: ProtectedMatterTitle;
      readonly weeklyUseGranted?: boolean;
    },
  ): Promise<MatterMutationResult>;
}

export interface PostgresMatterStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface MatterRow {
  readonly createdProductDate: string;
  readonly dailyUseGranted: boolean;
  readonly matterRef: string;
  readonly revision: number;
  readonly state: MatterState;
  readonly targetProductDate: string | null;
  readonly terminalAt: Date | null;
  readonly titleCiphertext: Buffer;
  readonly titleKeyVersion: string;
  readonly updatedAt: Date;
  readonly weeklyUseGranted: boolean;
}

interface CommandReceiptRow {
  readonly normalizedPayloadFingerprint: Buffer;
  readonly operationCode: string;
  readonly responseRef: string | null;
  readonly targetKey: string;
}

type CommandClaim =
  | { readonly status: "NEW" }
  | { readonly responseRef: string | null; readonly status: "DUPLICATE" }
  | { readonly status: "CONFLICT" };

export class PostgresMatterStore implements MatterStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresMatterStoreConfig,
  ): Promise<PostgresMatterStore> {
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
      return new PostgresMatterStore(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async list(input: {
    readonly accountId: string;
    readonly now: Date;
    readonly productDate: string;
  }): Promise<MatterQueryResult<readonly StoredMatterView[]>> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await readGuard(client, input.accountId, null);
      if (guard !== "ALLOWED") {
        return { status: guard };
      }
      await expireDueMatters(client, input);
      const rows = await client.query<MatterRow>(
        `${matterSelect()}
          WHERE matter."accountId"=$1::uuid AND matter.state<>'DELETED'
            AND (daily_energy.resolve_ai008_matter_guard_snapshot(
              $1::uuid,matter.id,$2
            )->>'status')='ALLOWED'
          ORDER BY CASE matter.state
            WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1
            WHEN 'COMPLETED' THEN 2 ELSE 3 END,
            matter."targetProductDate" NULLS LAST,matter."updatedAt" DESC,matter.id
          LIMIT ${MAX_MATTERS + 1}`,
        [input.accountId, CURRENT_NECESSARY_CONSENT_NOTICE_VERSION],
      );
      if (rows.rows.length > MAX_MATTERS) {
        throw new Error("MATTER_LIST_LIMIT_EXCEEDED");
      }
      return { status: "FOUND", value: rows.rows.map(storedMatter) };
    });
  }

  public async get(input: {
    readonly accountId: string;
    readonly matterRef: string;
    readonly now: Date;
    readonly productDate: string;
  }): Promise<MatterQueryResult<StoredMatterView>> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await readGuard(client, input.accountId, input.matterRef);
      if (guard !== "ALLOWED") {
        return { status: guard };
      }
      await expireDueMatters(client, input);
      const row = await readMatter(
        client,
        input.accountId,
        input.matterRef,
        false,
      );
      return row === undefined
        ? { status: "NOT_FOUND" }
        : { status: "FOUND", value: storedMatter(row) };
    });
  }

  public async create(
    input: MatterCommandInput & {
      readonly dailyUseGranted: boolean;
      readonly targetProductDate?: string;
      readonly title: ProtectedMatterTitle;
      readonly weeklyUseGranted: boolean;
    },
  ): Promise<MatterMutationResult> {
    assertMatterTargetDate(input.targetProductDate, input.productDate);
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await readGuard(client, input.accountId, null);
      if (guard !== "ALLOWED") {
        return { status: guard };
      }
      const claim = await claimCommand(client, input, "MATTER_CREATE", "NEW");
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        const existing =
          claim.responseRef === null
            ? undefined
            : await readMatter(
                client,
                input.accountId,
                claim.responseRef,
                false,
              );
        return existing === undefined
          ? { status: "STATE_PRECONDITION_FAILED" }
          : { status: "DUPLICATE", value: storedMatter(existing) };
      }
      const matterRef = randomUUID();
      await client.query(
        `INSERT INTO daily_energy.app_important_matter
          (id,"accountId",revision,"titleCiphertext","titleKeyVersion",
           "targetProductDate",state,"createdProductDate","createdAt","updatedAt",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES ($1::uuid,$2::uuid,1,$3,$4,$5::date,'ACTIVE',$6::date,
                 $7::timestamptz,$7::timestamptz,$8,'MATTER',$7::timestamptz)`,
        [
          matterRef,
          input.accountId,
          input.title.ciphertext,
          input.title.keyVersion,
          input.targetProductDate ?? null,
          input.productDate,
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      await insertMatterRevision(client, {
        commandRef: input.commandRef,
        matterRef,
        now: input.now,
        revision: 1,
        state: "ACTIVE",
        ...(input.targetProductDate === undefined
          ? {}
          : { targetProductDate: input.targetProductDate }),
        title: input.title,
      });
      await setGrant(client, {
        accountId: input.accountId,
        enabled: input.dailyUseGranted,
        matterRef,
        now: input.now,
        purpose: "DAILY_EXPRESSION",
      });
      await setGrant(client, {
        accountId: input.accountId,
        enabled: input.weeklyUseGranted,
        matterRef,
        now: input.now,
        purpose: "WEEKLY_SUMMARY",
      });
      await attachResponseRef(client, input, matterRef);
      return {
        status: "ACCEPTED",
        value: storedMatter(
          requiredMatter(
            await readMatter(client, input.accountId, matterRef, false),
          ),
        ),
      };
    });
  }

  public async update(
    input: MatterCommandInput & {
      readonly clearTargetDate: boolean;
      readonly dailyUseGranted?: boolean;
      readonly expectedRevision: number;
      readonly matterRef: string;
      readonly targetProductDate?: string;
      readonly title?: ProtectedMatterTitle;
      readonly weeklyUseGranted?: boolean;
    },
  ): Promise<MatterMutationResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await readGuard(client, input.accountId, input.matterRef);
      if (guard !== "ALLOWED") {
        return { status: guard };
      }
      await expireDueMatters(client, input);
      const replay = await inspectCommand(
        client,
        input,
        "MATTER_UPDATE",
        input.matterRef,
      );
      if (replay.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (replay.status === "DUPLICATE") {
        const existing =
          replay.responseRef === null
            ? undefined
            : await readMatter(
                client,
                input.accountId,
                replay.responseRef,
                false,
              );
        return existing === undefined
          ? { status: "STATE_PRECONDITION_FAILED" }
          : { status: "DUPLICATE", value: storedMatter(existing) };
      }
      const current = await readMatter(
        client,
        input.accountId,
        input.matterRef,
        true,
      );
      if (current === undefined) {
        return { status: "NOT_FOUND" };
      }
      if (current.revision !== input.expectedRevision) {
        return { current: storedMatter(current), status: "REVISION_CONFLICT" };
      }
      let lifecycle;
      try {
        lifecycle = matterStateAfterPatch({
          clearTargetDate: input.clearTargetDate,
          currentProductDate: input.productDate,
          matter: lifecycleSnapshot(current),
          ...(input.targetProductDate === undefined
            ? {}
            : { targetProductDate: input.targetProductDate }),
        });
      } catch (error) {
        if (error instanceof MatterPolicyError) {
          return { status: "STATE_PRECONDITION_FAILED" };
        }
        throw error;
      }
      const claim = await claimCommand(
        client,
        input,
        "MATTER_UPDATE",
        input.matterRef,
      );
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        return { status: "DUPLICATE", value: storedMatter(current) };
      }
      const title = input.title ?? protectedTitle(current);
      const dailyUseGranted = input.dailyUseGranted ?? current.dailyUseGranted;
      const weeklyUseGranted =
        input.weeklyUseGranted ?? current.weeklyUseGranted;
      const targetProductDate = lifecycle.targetProductDate ?? null;
      const changed =
        input.title !== undefined ||
        targetProductDate !== current.targetProductDate ||
        lifecycle.state !== current.state ||
        dailyUseGranted !== current.dailyUseGranted ||
        weeklyUseGranted !== current.weeklyUseGranted;
      if (!changed) {
        await attachResponseRef(client, input, input.matterRef);
        return { status: "ACCEPTED", value: storedMatter(current) };
      }
      const revision = current.revision + 1;
      const reactivated =
        current.state !== "ACTIVE" && lifecycle.state === "ACTIVE";
      const updated = await client.query(
        `UPDATE daily_energy.app_important_matter
            SET revision=$1,"titleCiphertext"=$2,"titleKeyVersion"=$3,
                "targetProductDate"=$4::date,state=$5::daily_energy."MatterState",
                "createdProductDate"=$6::date,
                "terminalAt"=CASE WHEN $7 THEN NULL ELSE "terminalAt" END,
                "expiresAt"=CASE WHEN $7 THEN NULL ELSE "expiresAt" END,
                "updatedAt"=$8::timestamptz,"retentionAnchorAt"=$8::timestamptz
          WHERE id=$9::uuid AND "accountId"=$10::uuid AND revision=$11`,
        [
          revision,
          title.ciphertext,
          title.keyVersion,
          targetProductDate,
          lifecycle.state,
          lifecycle.createdProductDate,
          reactivated,
          input.now,
          input.matterRef,
          input.accountId,
          current.revision,
        ],
      );
      if (updated.rowCount !== 1) {
        return {
          current: storedMatter(
            requiredMatter(
              await readMatter(client, input.accountId, input.matterRef, true),
            ),
          ),
          status: "REVISION_CONFLICT",
        };
      }
      await insertMatterRevision(client, {
        commandRef: input.commandRef,
        matterRef: input.matterRef,
        now: input.now,
        revision,
        state: lifecycle.state,
        ...(targetProductDate === null ? {} : { targetProductDate }),
        title,
      });
      await setGrant(client, {
        accountId: input.accountId,
        enabled: dailyUseGranted,
        matterRef: input.matterRef,
        now: input.now,
        purpose: "DAILY_EXPRESSION",
      });
      await setGrant(client, {
        accountId: input.accountId,
        enabled: weeklyUseGranted,
        matterRef: input.matterRef,
        now: input.now,
        purpose: "WEEKLY_SUMMARY",
      });
      await attachResponseRef(client, input, input.matterRef);
      return {
        status: "ACCEPTED",
        value: storedMatter(
          requiredMatter(
            await readMatter(client, input.accountId, input.matterRef, false),
          ),
        ),
      };
    });
  }

  public async transition(
    input: MatterCommandInput & {
      readonly expectedRevision: number;
      readonly matterRef: string;
      readonly revokeUseGrants: boolean;
      readonly transition: MatterTransition;
    },
  ): Promise<MatterMutationResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      const guard = await readGuard(client, input.accountId, input.matterRef);
      if (guard !== "ALLOWED") {
        return { status: guard };
      }
      await expireDueMatters(client, input);
      const operationCode = `MATTER_${input.transition}`;
      const replay = await inspectCommand(
        client,
        input,
        operationCode,
        input.matterRef,
      );
      if (replay.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (replay.status === "DUPLICATE") {
        const existing =
          replay.responseRef === null
            ? undefined
            : await readMatter(
                client,
                input.accountId,
                replay.responseRef,
                false,
              );
        return existing === undefined
          ? { status: "STATE_PRECONDITION_FAILED" }
          : { status: "DUPLICATE", value: storedMatter(existing) };
      }
      const current = await readMatter(
        client,
        input.accountId,
        input.matterRef,
        true,
      );
      if (current === undefined) {
        return { status: "NOT_FOUND" };
      }
      if (current.revision !== input.expectedRevision) {
        return { current: storedMatter(current), status: "REVISION_CONFLICT" };
      }
      let lifecycle;
      try {
        lifecycle = transitionMatterState({
          currentProductDate: input.productDate,
          matter: lifecycleSnapshot(current),
          transition: input.transition,
        });
      } catch (error) {
        if (error instanceof MatterPolicyError) {
          return { status: "STATE_PRECONDITION_FAILED" };
        }
        throw error;
      }
      const claim = await claimCommand(
        client,
        input,
        operationCode,
        input.matterRef,
      );
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        return { status: "DUPLICATE", value: storedMatter(current) };
      }
      const revision = current.revision + 1;
      const terminal = lifecycle.state === "COMPLETED";
      await client.query(
        `UPDATE daily_energy.app_important_matter
            SET revision=$1,state=$2::daily_energy."MatterState",
                "createdProductDate"=$3::date,
                "terminalAt"=CASE WHEN $4 THEN $5::timestamptz ELSE NULL END,
                "expiresAt"=CASE WHEN $4 THEN $5::timestamptz+
                  make_interval(days=>$6) ELSE NULL END,
                "updatedAt"=$5::timestamptz,"retentionAnchorAt"=$5::timestamptz
          WHERE id=$7::uuid AND "accountId"=$8::uuid AND revision=$9`,
        [
          revision,
          lifecycle.state,
          lifecycle.createdProductDate,
          terminal,
          input.now,
          TERMINAL_MATTER_TTL_DAYS,
          input.matterRef,
          input.accountId,
          current.revision,
        ],
      );
      await insertMatterRevision(client, {
        commandRef: input.commandRef,
        matterRef: input.matterRef,
        now: input.now,
        revision,
        state: lifecycle.state,
        ...(current.targetProductDate === null
          ? {}
          : { targetProductDate: current.targetProductDate }),
        title: protectedTitle(current),
      });
      if (input.revokeUseGrants) {
        await setGrant(client, {
          accountId: input.accountId,
          enabled: false,
          matterRef: input.matterRef,
          now: input.now,
          purpose: "DAILY_EXPRESSION",
        });
        await setGrant(client, {
          accountId: input.accountId,
          enabled: false,
          matterRef: input.matterRef,
          now: input.now,
          purpose: "WEEKLY_SUMMARY",
        });
      }
      await attachResponseRef(client, input, input.matterRef);
      return {
        status: "ACCEPTED",
        value: storedMatter(
          requiredMatter(
            await readMatter(client, input.accountId, input.matterRef, false),
          ),
        ),
      };
    });
  }

  public async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#pool.end();
    }
  }

  async #transaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
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
      throw new Error("MATTER_STORE_CLOSED");
    }
  }
}

async function assertRole(pool: Pool, expectedRole: string): Promise<void> {
  const result = await pool.query<{
    currentUser: string;
    expectedMember: boolean;
    sessionUser: string;
  }>(
    `SELECT current_user AS "currentUser",session_user AS "sessionUser",
            pg_has_role(current_user,$1,'MEMBER') AS "expectedMember"`,
    [expectedRole],
  );
  const row = result.rows[0];
  if (
    row === undefined ||
    row.currentUser !== row.sessionUser ||
    row.expectedMember !== true
  ) {
    throw new Error("MATTER_DB_ROLE_MISMATCH");
  }
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

async function readGuard(
  client: PoolClient,
  accountId: string,
  matterRef: string | null,
): Promise<"ALLOWED" | MatterGuardFailure> {
  const result = await client.query<{ snapshot: unknown }>(
    `SELECT daily_energy.resolve_ai008_matter_guard_snapshot(
       $1::uuid,$2::uuid,$3::text
     ) AS snapshot`,
    [accountId, matterRef, CURRENT_NECESSARY_CONSENT_NOTICE_VERSION],
  );
  const snapshot = result.rows[0]?.snapshot;
  if (
    snapshot === null ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot)
  ) {
    throw new Error("MATTER_GUARD_INVALID");
  }
  const status = (snapshot as Record<string, unknown>).status;
  if (
    status !== "ALLOWED" &&
    status !== "ACCOUNT_DELETED" &&
    status !== "ACCOUNT_DELETING" &&
    status !== "ACCOUNT_RESTRICTED" &&
    status !== "CONSENT_REQUIRED" &&
    status !== "ONBOARDING_REQUIRED" &&
    status !== "SAFETY_BLOCKED" &&
    status !== "STATE_PRECONDITION_FAILED"
  ) {
    throw new Error("MATTER_GUARD_INVALID");
  }
  return status;
}

function matterSelect(): string {
  return `SELECT matter.id AS "matterRef",matter.revision,
                 matter."titleCiphertext",matter."titleKeyVersion",
                 matter."targetProductDate"::text AS "targetProductDate",
                 matter.state::text AS state,
                 matter."createdProductDate"::text AS "createdProductDate",
                 matter."terminalAt",matter."updatedAt",
                 EXISTS (SELECT 1 FROM daily_energy.app_memory_purpose_grant grant_row
                   WHERE grant_row."accountId"=matter."accountId"
                     AND grant_row."sourceType"='MATTER'
                     AND grant_row."sourceRef"=matter.id
                     AND grant_row.purpose='DAILY_EXPRESSION'
                     AND grant_row.state='ACTIVE') AS "dailyUseGranted",
                 EXISTS (SELECT 1 FROM daily_energy.app_memory_purpose_grant grant_row
                   WHERE grant_row."accountId"=matter."accountId"
                     AND grant_row."sourceType"='MATTER'
                     AND grant_row."sourceRef"=matter.id
                     AND grant_row.purpose='WEEKLY_SUMMARY'
                     AND grant_row.state='ACTIVE') AS "weeklyUseGranted"
            FROM daily_energy.app_important_matter matter`;
}

async function readMatter(
  client: PoolClient,
  accountId: string,
  matterRef: string,
  lock: boolean,
): Promise<MatterRow | undefined> {
  return (
    await client.query<MatterRow>(
      `${matterSelect()}
        WHERE matter.id=$1::uuid AND matter."accountId"=$2::uuid
          AND matter.state<>'DELETED'
        LIMIT 1${lock ? " FOR UPDATE OF matter" : ""}`,
      [matterRef, accountId],
    )
  ).rows[0];
}

function storedMatter(row: MatterRow): StoredMatterView {
  if (row.state === "DELETED") {
    throw new Error("DELETED_MATTER_PROJECTED");
  }
  return {
    dailyUseGranted: row.dailyUseGranted,
    matterRef: row.matterRef,
    revision: row.revision,
    state: row.state,
    ...(row.targetProductDate === null
      ? {}
      : { targetProductDate: row.targetProductDate }),
    title: protectedTitle(row),
    updatedAt: new Date(row.updatedAt.getTime()),
    weeklyUseGranted: row.weeklyUseGranted,
  };
}

function protectedTitle(row: MatterRow): ProtectedMatterTitle {
  return {
    ciphertext: row.titleCiphertext,
    keyVersion: row.titleKeyVersion,
  };
}

function lifecycleSnapshot(row: MatterRow) {
  return {
    createdProductDate: row.createdProductDate,
    state: row.state,
    ...(row.targetProductDate === null
      ? {}
      : { targetProductDate: row.targetProductDate }),
  };
}

async function expireDueMatters(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly now: Date;
    readonly productDate: string;
  },
): Promise<void> {
  const due = await client.query<MatterRow>(
    `${matterSelect()}
      WHERE matter."accountId"=$1::uuid AND matter.state='ACTIVE'
        AND (daily_energy.resolve_ai008_matter_guard_snapshot(
          $1::uuid,matter.id,$2
        )->>'status')='ALLOWED'
        AND ((matter."targetProductDate" IS NOT NULL
              AND matter."targetProductDate"<$3::date)
          OR (matter."targetProductDate" IS NULL
              AND $3::date>=matter."createdProductDate"+7))
      ORDER BY matter.id FOR UPDATE OF matter`,
    [
      input.accountId,
      CURRENT_NECESSARY_CONSENT_NOTICE_VERSION,
      input.productDate,
    ],
  );
  for (const matter of due.rows) {
    const revision = matter.revision + 1;
    const commandRef = randomUUID();
    await client.query(
      `UPDATE daily_energy.app_important_matter
          SET state='EXPIRED',revision=$1,"terminalAt"=$2::timestamptz,
              "updatedAt"=$2::timestamptz,"retentionAnchorAt"=$2::timestamptz,
              "expiresAt"=$2::timestamptz+make_interval(days=>$3)
        WHERE id=$4::uuid AND revision=$5 AND state='ACTIVE'`,
      [
        revision,
        input.now,
        TERMINAL_MATTER_TTL_DAYS,
        matter.matterRef,
        matter.revision,
      ],
    );
    await insertMatterRevision(client, {
      commandRef,
      matterRef: matter.matterRef,
      now: input.now,
      revision,
      state: "EXPIRED",
      ...(matter.targetProductDate === null
        ? {}
        : { targetProductDate: matter.targetProductDate }),
      title: protectedTitle(matter),
    });
  }
}

async function insertMatterRevision(
  client: PoolClient,
  input: {
    readonly commandRef: string;
    readonly matterRef: string;
    readonly now: Date;
    readonly revision: number;
    readonly state: Exclude<MatterState, "DELETED">;
    readonly targetProductDate?: string;
    readonly title: ProtectedMatterTitle;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO daily_energy.app_important_matter_revision
      (id,"matterId",revision,"titleCiphertext","titleKeyVersion",
       "targetProductDate",state,"commandRef","createdAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),$1::uuid,$2,$3,$4,$5::date,
             $6::daily_energy."MatterState",$7::uuid,$8::timestamptz,$9,
             'MATTER',$8::timestamptz,
             $8::timestamptz+make_interval(hours=>$10))`,
    [
      input.matterRef,
      input.revision,
      input.title.ciphertext,
      input.title.keyVersion,
      input.targetProductDate ?? null,
      input.state,
      commandRefStorageUuid(input.commandRef),
      input.now,
      RETENTION_POLICY_VERSION,
      MATTER_REVISION_TTL_HOURS,
    ],
  );
}

async function setGrant(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly enabled: boolean;
    readonly matterRef: string;
    readonly now: Date;
    readonly purpose: "DAILY_EXPRESSION" | "WEEKLY_SUMMARY";
  },
): Promise<void> {
  const current = (
    await client.query<{
      id: string;
      revision: number;
      state: "ACTIVE" | "REVOKED";
    }>(
      `SELECT id,revision,state::text AS state
         FROM daily_energy.app_memory_purpose_grant
        WHERE "accountId"=$1::uuid AND "sourceType"='MATTER'
          AND "sourceRef"=$2::uuid AND purpose=$3::daily_energy."MemoryPurpose"
        FOR UPDATE`,
      [input.accountId, input.matterRef, input.purpose],
    )
  ).rows[0];
  const desiredState = input.enabled ? "ACTIVE" : "REVOKED";
  if (current === undefined) {
    if (!input.enabled) {
      return;
    }
    await client.query(
      `INSERT INTO daily_energy.app_memory_purpose_grant
        (id,"accountId","sourceType","sourceRef",purpose,state,revision,
         "policyVersion","consentSurfaceVersion","createdAt","updatedAt",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES (gen_random_uuid(),$1::uuid,'MATTER',$2::uuid,
               $3::daily_energy."MemoryPurpose",'ACTIVE',1,$4,$5,
               $6::timestamptz,$6::timestamptz,$7,'MATTER',$6::timestamptz)`,
      [
        input.accountId,
        input.matterRef,
        input.purpose,
        MEMORY_POLICY_VERSION,
        CONSENT_SURFACE_VERSION,
        input.now,
        RETENTION_POLICY_VERSION,
      ],
    );
    return;
  }
  if (current.state === desiredState) {
    return;
  }
  await client.query(
    `UPDATE daily_energy.app_memory_purpose_grant
        SET state=$1::daily_energy."MemoryGrantState",revision=revision+1,
            "policyVersion"=$2,"consentSurfaceVersion"=$3,
            "updatedAt"=$4::timestamptz,
            "revokedAt"=CASE WHEN $1='REVOKED' THEN $4::timestamptz ELSE NULL END,
            "retentionAnchorAt"=$4::timestamptz,
            "expiresAt"=CASE WHEN $1='REVOKED'
              THEN $4::timestamptz+make_interval(days=>30) ELSE NULL END
      WHERE id=$5::uuid AND revision=$6`,
    [
      desiredState,
      MEMORY_POLICY_VERSION,
      CONSENT_SURFACE_VERSION,
      input.now,
      current.id,
      current.revision,
    ],
  );
}

async function claimCommand(
  client: PoolClient,
  input: MatterCommandInput,
  operationCode: string,
  targetKey: string,
): Promise<CommandClaim> {
  const storageRef = commandRefStorageUuid(input.commandRef);
  const inserted = await client.query(
    `INSERT INTO daily_energy.runtime_command_receipt
      (id,"accountId","commandRef","operationCode","targetScope","targetKey",
       "normalizedPayloadFingerprint","acceptedAt","terminalAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,$3,'MATTER',$4,$5,
             $6::timestamptz,$6::timestamptz,$7,'RUNTIME',$6::timestamptz,
             $6::timestamptz+make_interval(days=>$8))
     ON CONFLICT ("accountId","commandRef") DO NOTHING RETURNING id`,
    [
      input.accountId,
      storageRef,
      operationCode,
      targetKey,
      input.normalizedPayloadFingerprint,
      input.now,
      RETENTION_POLICY_VERSION,
      COMMAND_RECEIPT_TTL_DAYS,
    ],
  );
  if (inserted.rowCount === 1) {
    return { status: "NEW" };
  }
  const existing = (
    await client.query<CommandReceiptRow>(
      `SELECT "operationCode","targetKey","normalizedPayloadFingerprint","responseRef"
         FROM daily_energy.runtime_command_receipt
        WHERE "accountId"=$1::uuid AND "commandRef"=$2::uuid FOR UPDATE`,
      [input.accountId, storageRef],
    )
  ).rows[0];
  return existing?.operationCode === operationCode &&
    existing.targetKey === targetKey &&
    existing.normalizedPayloadFingerprint.equals(
      input.normalizedPayloadFingerprint,
    )
    ? { responseRef: existing.responseRef, status: "DUPLICATE" }
    : { status: "CONFLICT" };
}

async function inspectCommand(
  client: PoolClient,
  input: MatterCommandInput,
  operationCode: string,
  targetKey: string,
): Promise<CommandClaim> {
  const existing = (
    await client.query<CommandReceiptRow>(
      `SELECT "operationCode","targetKey","normalizedPayloadFingerprint","responseRef"
         FROM daily_energy.runtime_command_receipt
        WHERE "accountId"=$1::uuid AND "commandRef"=$2::uuid FOR UPDATE`,
      [input.accountId, commandRefStorageUuid(input.commandRef)],
    )
  ).rows[0];
  if (existing === undefined) {
    return { status: "NEW" };
  }
  return existing.operationCode === operationCode &&
    existing.targetKey === targetKey &&
    existing.normalizedPayloadFingerprint.equals(
      input.normalizedPayloadFingerprint,
    )
    ? { responseRef: existing.responseRef, status: "DUPLICATE" }
    : { status: "CONFLICT" };
}

async function attachResponseRef(
  client: PoolClient,
  input: Pick<MatterCommandInput, "accountId" | "commandRef">,
  responseRef: string,
): Promise<void> {
  await client.query(
    `UPDATE daily_energy.runtime_command_receipt SET "responseRef"=$1::uuid
      WHERE "accountId"=$2::uuid AND "commandRef"=$3::uuid`,
    [responseRef, input.accountId, commandRefStorageUuid(input.commandRef)],
  );
}

function requiredMatter(row: MatterRow | undefined): MatterRow {
  if (row === undefined) {
    throw new Error("MATTER_ROW_REQUIRED");
  }
  return row;
}

export const UNAVAILABLE_MATTER_STORE: MatterStore = Object.freeze({
  async close() {},
  async create() {
    throw new Error("MATTER_STORE_UNAVAILABLE");
  },
  async get() {
    throw new Error("MATTER_STORE_UNAVAILABLE");
  },
  async list() {
    throw new Error("MATTER_STORE_UNAVAILABLE");
  },
  async transition() {
    throw new Error("MATTER_STORE_UNAVAILABLE");
  },
  async update() {
    throw new Error("MATTER_STORE_UNAVAILABLE");
  },
});
