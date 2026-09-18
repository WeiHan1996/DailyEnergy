import { Pool, type PoolClient } from "pg";

import {
  recheckDailyMatterV1,
  selectDailyMatterV1,
  type DailyMatterMentionV1,
  type DailyMatterSelectionRequestV1,
  type DailyMatterSelectionV1,
  type DailyMatterSourceV1,
  type SelectedDailyMatterV1,
} from "@daily-energy/server-core/memory";

import { CURRENT_NECESSARY_CONSENT_NOTICE_VERSION } from "../consent-profile/postgres-consent-profile-store.js";

const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const MAX_MATTERS = 1_000;
const MAX_MENTIONS = 10_000;
const NO_MEMORY: DailyMatterSelectionV1 = Object.freeze({
  status: "NO_ELIGIBLE_MEMORY",
});

interface GuardRow {
  readonly snapshot: unknown;
}

interface MasterRow {
  readonly continuityEnabled: boolean;
  readonly dailyExpressionEnabled: boolean;
  readonly revision: number;
}

interface MatterRow {
  readonly sourceRef: string;
  readonly revision: number;
  readonly state: DailyMatterSourceV1["state"];
  readonly createdProductDate: string;
  readonly targetProductDate: string | null;
  readonly updatedAt: Date;
  readonly grantRef: string | null;
  readonly grantRevision: number | null;
  readonly grantState: "ACTIVE" | "REVOKED" | null;
  readonly grantPolicyVersion: string | null;
}

interface MentionRow {
  readonly sourceRef: string;
  readonly productDate: string;
}

// Staged metadata preselection only: existing Matter rows have no per-revision
// Safety clearance proof and are never eligible for provider projection here.
export class PostgresMemoryStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(input: {
    readonly applicationName: string;
    readonly connectionString: string;
    readonly expectedDatabaseRole: "daily_energy_interactive";
    readonly connectionLimit?: number;
  }): Promise<PostgresMemoryStore> {
    const pool = new Pool({
      application_name: input.applicationName,
      connectionString: input.connectionString,
      max: input.connectionLimit ?? 4,
    });
    try {
      const identity = (
        await pool.query<{
          currentUser: string;
          expectedMember: boolean;
          sessionUser: string;
        }>(
          `SELECT current_user AS "currentUser",
                  session_user AS "sessionUser",
                  pg_has_role(current_user,$1,'MEMBER') AS "expectedMember"`,
          [input.expectedDatabaseRole],
        )
      ).rows[0];
      if (
        identity === undefined ||
        identity.currentUser !== identity.sessionUser ||
        identity.expectedMember !== true
      ) {
        throw new Error("MEMORY_DB_ROLE_MISMATCH");
      }
      return new PostgresMemoryStore(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async resolveDaily(input: {
    readonly ownerRef: string;
    readonly productDate: string;
  }): Promise<DailyMatterSelectionV1> {
    if (this.#closed) {
      return NO_MEMORY;
    }
    try {
      return await this.#transaction(input.ownerRef, async (client) =>
        selectDailyMatterV1(await readCurrent(client, input)),
      );
    } catch {
      return NO_MEMORY;
    }
  }

  // Advisory liveness check only. A memory-enabled publisher must repeat the
  // check inside its own publication transaction before writing a dependency.
  public async recheckDaily(
    selected: SelectedDailyMatterV1,
    productDate: string,
  ): Promise<boolean> {
    if (this.#closed) {
      return false;
    }
    try {
      return await this.#transaction(selected.ownerRef, async (client) =>
        recheckDailyMatterV1(
          selected,
          await readCurrent(client, {
            ownerRef: selected.ownerRef,
            productDate,
            sourceRef: selected.sourceRef,
          }),
        ),
      );
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#pool.end();
    }
  }

  async #transaction<T>(
    ownerRef: string,
    run: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
        [ownerRef, ACCOUNT_GUARD_LOCK_SEED],
      );
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

async function readCurrent(
  client: PoolClient,
  input: {
    readonly ownerRef: string;
    readonly productDate: string;
    readonly sourceRef?: string;
  },
): Promise<DailyMatterSelectionRequestV1> {
  const guard = (
    await client.query<GuardRow>(
      `SELECT daily_energy.resolve_ai008_matter_guard_snapshot(
        $1::uuid,$2::uuid,$3::text
      ) AS snapshot`,
      [
        input.ownerRef,
        input.sourceRef ?? null,
        CURRENT_NECESSARY_CONSENT_NOTICE_VERSION,
      ],
    )
  ).rows[0]?.snapshot;
  if (guard === null || typeof guard !== "object" || Array.isArray(guard)) {
    throw new Error("MEMORY_GUARD_INVALID");
  }
  const facts = guard as Record<string, unknown>;
  if (facts.status !== "ALLOWED") {
    return noAccess(input);
  }
  const master = (
    await client.query<MasterRow>(
      `SELECT "continuityEnabled","dailyExpressionEnabled",revision
         FROM daily_energy.app_memory_master_preference
        WHERE "accountId"=$1::uuid LIMIT 1`,
      [input.ownerRef],
    )
  ).rows[0];
  if (!master || !master.continuityEnabled || !master.dailyExpressionEnabled) {
    return noAccess(input);
  }
  if (
    typeof facts.account_revision !== "number" ||
    typeof facts.safety_epoch !== "string" ||
    typeof facts.deletion_epoch !== "string"
  ) {
    throw new Error("MEMORY_GUARD_INVALID");
  }
  const matterRows = (
    await client.query<MatterRow>(
      `SELECT matter.id AS "sourceRef",matter.revision,
              matter.state::text AS state,
              matter."createdProductDate"::text AS "createdProductDate",
              matter."targetProductDate"::text AS "targetProductDate",
              matter."updatedAt",grant_row.id AS "grantRef",
              grant_row.revision AS "grantRevision",
              grant_row.state::text AS "grantState",
              grant_row."policyVersion" AS "grantPolicyVersion"
         FROM daily_energy.app_important_matter matter
         LEFT JOIN daily_energy.app_memory_purpose_grant grant_row
           ON grant_row."accountId"=matter."accountId"
          AND grant_row."sourceType"='MATTER'
          AND grant_row."sourceRef"=matter.id
          AND grant_row.purpose='DAILY_EXPRESSION'
        WHERE matter."accountId"=$1::uuid AND matter.state='ACTIVE'
          AND ($2::uuid IS NULL OR matter.id=$2::uuid)
          AND (daily_energy.resolve_ai008_matter_guard_snapshot(
            $1::uuid,matter.id,$3::text
          )->>'status')='ALLOWED'
        ORDER BY matter.id LIMIT ${MAX_MATTERS + 1}`,
      [
        input.ownerRef,
        input.sourceRef ?? null,
        CURRENT_NECESSARY_CONSENT_NOTICE_VERSION,
      ],
    )
  ).rows;
  if (matterRows.length > MAX_MATTERS) {
    throw new Error("MEMORY_MATTER_LIMIT_EXCEEDED");
  }
  const mentions = (
    await client.query<MentionRow>(
      `SELECT "sourceRef","productDate"::text AS "productDate"
         FROM daily_energy.app_memory_mention_receipt
        WHERE "accountId"=$1::uuid AND purpose='DAILY_EXPRESSION'
          AND "productDate" BETWEEN $2::date-6 AND $2::date
          AND ($3::uuid IS NULL OR "sourceRef"=$3::uuid)
        ORDER BY "productDate","sourceRef" LIMIT ${MAX_MENTIONS + 1}`,
      [input.ownerRef, input.productDate, input.sourceRef ?? null],
    )
  ).rows;
  if (mentions.length > MAX_MENTIONS) {
    throw new Error("MEMORY_MENTION_LIMIT_EXCEEDED");
  }
  return {
    ownerRef: input.ownerRef,
    productDate: input.productDate,
    access: {
      accountActive: true,
      accountRevision: facts.account_revision,
      consentActive: true,
      safetyClear: true,
      safetyEpoch: facts.safety_epoch,
      deletionClear: true,
      deletionEpoch: facts.deletion_epoch,
      masterEnabled: master.continuityEnabled,
      masterRevision: master.revision,
      dailyExpressionEnabled: master.dailyExpressionEnabled,
    },
    sources: matterRows.map((row): DailyMatterSourceV1 => ({
      ownerRef: input.ownerRef,
      sourceRef: row.sourceRef,
      revision: row.revision,
      state: row.state,
      createdProductDate: row.createdProductDate,
      ...(row.targetProductDate === null
        ? {}
        : { targetProductDate: row.targetProductDate }),
      updatedAt: row.updatedAt,
      ...(row.grantRef === null ||
      row.grantRevision === null ||
      row.grantState === null ||
      row.grantPolicyVersion === null
        ? {}
        : {
            grant: {
              ownerRef: input.ownerRef,
              sourceRef: row.sourceRef,
              grantRef: row.grantRef,
              revision: row.grantRevision,
              purpose: "DAILY_EXPRESSION",
              state: row.grantState,
              policyVersion: row.grantPolicyVersion,
            },
          }),
    })),
    mentions: mentions.map((row): DailyMatterMentionV1 => ({
      ownerRef: input.ownerRef,
      sourceRef: row.sourceRef,
      productDate: row.productDate,
      purpose: "DAILY_EXPRESSION",
    })),
  };
}

function noAccess(input: {
  readonly ownerRef: string;
  readonly productDate: string;
}): DailyMatterSelectionRequestV1 {
  return {
    ownerRef: input.ownerRef,
    productDate: input.productDate,
    access: {
      accountActive: false,
      accountRevision: 0,
      consentActive: false,
      safetyClear: false,
      safetyEpoch: "0",
      deletionClear: false,
      deletionEpoch: "0",
      masterEnabled: false,
      masterRevision: 0,
      dailyExpressionEnabled: false,
    },
    sources: [],
    mentions: [],
  };
}
