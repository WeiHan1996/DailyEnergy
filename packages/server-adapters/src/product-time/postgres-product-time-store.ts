import { Pool, type PoolClient } from "pg";

import {
  parseProductDate,
  validateViewContinuationGrant,
  type ProductDateWriteOperation,
  type ViewContinuationGrant,
} from "@daily-energy/server-core/product-time";
import type {
  ContinuationGrantCreateMutation,
  ContinuationGrantMutation,
  ContinuationGrantRejectionReason,
  ProductTimeStore,
} from "@daily-energy/server-core/product-time/spi";

import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export interface PostgresProductTimeStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface GrantRow {
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

export class PostgresProductTimeStore implements ProductTimeStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresProductTimeStoreConfig,
  ): Promise<PostgresProductTimeStore> {
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
    await assertRole(pool, config.expectedDatabaseRole);
    return new PostgresProductTimeStore(pool);
  }

  public async createGrant(
    input: ViewContinuationGrant,
  ): Promise<ContinuationGrantCreateMutation> {
    this.#assertOpen();
    const grant = validateViewContinuationGrant(input);
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await lockAccountGuard(client, grant.ownerRef);
      const guardReason = await grantGuardReason(client, grant);
      if (guardReason !== undefined) {
        await client.query("COMMIT");
        return { reason: guardReason, status: "GUARD_REJECTED" };
      }
      const inserted = await client.query(
        `INSERT INTO daily_energy.app_view_continuation_grant
           (id, "accountId", "sessionId", "surfaceCode", "productDate",
            "productDatePolicyVersion", "resultRef", "feedbackRevision",
            "boundaryAt", "allowedOperations", revision, "expiresAt",
            "invalidatedAt", "createdAt", "retentionPolicyVersion",
            "retentionScope", "retentionAnchorAt")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::date, $6,
                 $7::uuid, $8, $9::timestamptz, $10::text[], $11,
                 $12::timestamptz, $13::timestamptz, $14::timestamptz,
                 'retention-policy-v1', 'DAY', $14::timestamptz)
         ON CONFLICT (id) DO NOTHING`,
        grantParameters(grant),
      );
      if (inserted.rowCount === 1) {
        await client.query("COMMIT");
        return { grant, status: "ACCEPTED" };
      }
      const current = await findGrant(client, {
        grantRef: grant.grantRef,
        ownerRef: grant.ownerRef,
        sessionRef: grant.sessionRef,
      });
      if (current === undefined) {
        throw new Error("PRODUCT_TIME_GRANT_CONFLICT_TARGET_MISSING");
      }
      const result = sameGrant(current, grant)
        ? ({ grant: current, status: "DUPLICATE" } as const)
        : ({ current, status: "CONFLICT" } as const);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getGrant(input: {
    readonly grantRef: string;
    readonly ownerRef: string;
    readonly sessionRef: string;
  }): Promise<ViewContinuationGrant | undefined> {
    this.#assertOpen();
    return findGrant(this.#pool, input);
  }

  public async invalidateGrant(input: {
    readonly expectedRevision: number;
    readonly grantRef: string;
    readonly invalidatedAt: Date;
    readonly ownerRef: string;
    readonly sessionRef: string;
  }): Promise<ContinuationGrantMutation | undefined> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const current = grantFromRow(
        (
          await client.query<GrantRow>(grantSelect(true), [
            input.grantRef,
            input.ownerRef,
            input.sessionRef,
          ])
        ).rows[0],
      );
      if (current === undefined) {
        await client.query("COMMIT");
        return undefined;
      }
      if (current.invalidatedAt !== undefined) {
        await client.query("COMMIT");
        return { grant: current, status: "DUPLICATE" };
      }
      if (current.revision !== input.expectedRevision) {
        await client.query("COMMIT");
        return { current, status: "CONFLICT" };
      }
      const updated = await client.query<GrantRow>(
        `WITH updated_grant AS (
             UPDATE daily_energy.app_view_continuation_grant
                SET "invalidatedAt"=$1::timestamptz, revision=revision+1
              WHERE id=$2::uuid AND "accountId"=$3::uuid
                AND "sessionId"=$4::uuid AND revision=$5
              RETURNING *
           )
           ${grantSelectPrefix()} FROM updated_grant g`,
        [
          input.invalidatedAt,
          input.grantRef,
          input.ownerRef,
          input.sessionRef,
          input.expectedRevision,
        ],
      );
      const grant = grantFromRow(updated.rows[0]);
      if (grant === undefined) {
        throw new Error("PRODUCT_TIME_GRANT_CAS_FAILED");
      }
      await client.query("COMMIT");
      return { grant, status: "ACCEPTED" };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async invalidateSessionGrants(input: {
    readonly invalidatedAt: Date;
    readonly sessionRef: string;
  }): Promise<number> {
    this.#assertOpen();
    const updated = await this.#pool.query(
      `UPDATE daily_energy.app_view_continuation_grant
          SET "invalidatedAt"=$1::timestamptz, revision=revision+1
        WHERE "sessionId"=$2::uuid AND "invalidatedAt" IS NULL`,
      [input.invalidatedAt, input.sessionRef],
    );
    return updated.rowCount ?? 0;
  }

  public async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#pool.end();
    }
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("PRODUCT_TIME_STORE_CLOSED");
    }
  }
}

function grantSelect(lock: boolean): string {
  return `${grantSelectPrefix()}
    FROM daily_energy.app_view_continuation_grant g
   WHERE g.id=$1::uuid AND g."accountId"=$2::uuid
     AND g."sessionId"=$3::uuid
   ${lock ? "FOR UPDATE" : ""}`;
}

function grantSelectPrefix(): string {
  return `SELECT g.id AS "grantRef", g."accountId" AS "ownerRef",
    g."sessionId" AS "sessionRef", g."surfaceCode" AS surface,
    g."productDate"::text AS "productDate",
    g."productDatePolicyVersion", g."resultRef",
    g."feedbackRevision", g."boundaryAt", g."allowedOperations",
    g.revision, g."expiresAt", g."invalidatedAt", g."createdAt"`;
}

function grantFromRow(
  row: GrantRow | undefined,
): ViewContinuationGrant | undefined {
  if (row === undefined || row.resultRef === null) {
    return undefined;
  }
  if (
    row.productDatePolicyVersion !== "product-date-v1" ||
    !["DLY-003", "EVE-001"].includes(row.surface)
  ) {
    throw new Error("PRODUCT_TIME_GRANT_ROW_INVALID");
  }
  return validateViewContinuationGrant({
    allowedOperations: row.allowedOperations,
    boundaryAt: row.boundaryAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ...(row.feedbackRevision === null
      ? {}
      : { feedbackRevision: row.feedbackRevision }),
    grantRef: row.grantRef,
    ...(row.invalidatedAt === null ? {} : { invalidatedAt: row.invalidatedAt }),
    ownerRef: row.ownerRef,
    productDate: parseProductDate(row.productDate),
    productDatePolicyVersion: row.productDatePolicyVersion,
    resultRef: row.resultRef,
    revision: row.revision,
    sessionRef: row.sessionRef,
    surface: row.surface as "DLY-003" | "EVE-001",
  });
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
    grant.feedbackRevision ?? null,
    grant.boundaryAt,
    grant.allowedOperations,
    grant.revision,
    grant.expiresAt,
    grant.invalidatedAt ?? null,
    grant.createdAt,
  ];
}

function sameGrant(
  left: ViewContinuationGrant,
  right: ViewContinuationGrant,
): boolean {
  return (
    JSON.stringify({
      ...left,
      boundaryAt: left.boundaryAt.toISOString(),
      createdAt: left.createdAt.toISOString(),
      expiresAt: left.expiresAt.toISOString(),
      invalidatedAt: left.invalidatedAt?.toISOString(),
    }) ===
    JSON.stringify({
      ...right,
      boundaryAt: right.boundaryAt.toISOString(),
      createdAt: right.createdAt.toISOString(),
      expiresAt: right.expiresAt.toISOString(),
      invalidatedAt: right.invalidatedAt?.toISOString(),
    })
  );
}

async function assertRole(pool: Pool, expectedRole: string): Promise<void> {
  try {
    const row = (
      await pool.query<{
        currentUser: string;
        expectedMember: boolean;
        sessionUser: string;
      }>(
        `SELECT current_user AS "currentUser", session_user AS "sessionUser",
                pg_has_role(current_user,$1,'MEMBER') AS "expectedMember"`,
        [expectedRole],
      )
    ).rows[0];
    if (!row || row.currentUser !== row.sessionUser || !row.expectedMember) {
      throw new Error("PRODUCT_TIME_DB_ROLE_MISMATCH");
    }
  } catch (error) {
    await pool.end();
    throw error;
  }
}

const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const CURRENT_NOTICE_VERSION = "necessary-consent-v1";

async function lockAccountGuard(
  client: PoolClient,
  accountId: string,
): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text, $2::bigint))",
    [accountId, ACCOUNT_GUARD_LOCK_SEED],
  );
}

async function grantGuardReason(
  client: PoolClient,
  grant: ViewContinuationGrant,
): Promise<ContinuationGrantRejectionReason | undefined> {
  const guard = (
    await client.query<{ status: string }>(
      `SELECT daily_energy.resolve_checkin_guard_status(
         $1::uuid, $2::date, $3::text
       ) AS status`,
      [grant.ownerRef, grant.productDate, CURRENT_NOTICE_VERSION],
    )
  ).rows[0]?.status;
  if (guard !== "ALLOWED") {
    if (isGuardReason(guard)) {
      return guard;
    }
    throw new Error("PRODUCT_TIME_GRANT_GUARD_INVALID");
  }

  const session = await client.query(
    `SELECT 1
       FROM daily_energy.app_session_credential session
      WHERE session.id=$1::uuid AND session."accountId"=$2::uuid
        AND session."revokedAt" IS NULL
        AND session."issuedAt" <= $3::timestamptz
        AND session."expiresAt" > $3::timestamptz
      FOR SHARE OF session`,
    [grant.sessionRef, grant.ownerRef, grant.createdAt],
  );
  if (session.rowCount !== 1) {
    return "SESSION_INVALID";
  }

  const result = await client.query(
    `SELECT 1
       FROM daily_energy.app_published_daily_result result
       JOIN daily_energy.app_published_result_visibility visibility
         ON visibility."resultId"=result.id
      WHERE result.id=$1::uuid AND result."accountId"=$2::uuid
        AND result."productDate"=$3::date
        AND visibility.state IN ('AVAILABLE', 'FALLBACK_ONLY')
      FOR SHARE OF visibility`,
    [grant.resultRef, grant.ownerRef, grant.productDate],
  );
  return result.rowCount === 1 ? undefined : "RESULT_INVALID";
}

function isGuardReason(
  value: string | undefined,
): value is ContinuationGrantRejectionReason {
  return [
    "ACCOUNT_DELETED",
    "ACCOUNT_DELETING",
    "ACCOUNT_RESTRICTED",
    "CONSENT_REQUIRED",
    "ONBOARDING_REQUIRED",
    "SAFETY_BLOCKED",
    "STATE_PRECONDITION_FAILED",
  ].includes(value ?? "");
}

async function findGrant(
  client: Pick<Pool, "query"> | Pick<PoolClient, "query">,
  input: {
    readonly grantRef: string;
    readonly ownerRef: string;
    readonly sessionRef: string;
  },
): Promise<ViewContinuationGrant | undefined> {
  return grantFromRow(
    (
      await client.query<GrantRow>(grantSelect(false), [
        input.grantRef,
        input.ownerRef,
        input.sessionRef,
      ])
    ).rows[0],
  );
}
