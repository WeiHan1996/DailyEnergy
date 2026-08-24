import { Pool, type PoolClient } from "pg";

import {
  PublishedWeeklySummarySchema,
  type ClientWeeklySummaryView,
  type PublishedWeeklySummary,
} from "@daily-energy/shared-schemas";
import {
  createClientWeeklySummaryView,
  deriveWeeklyAggregate,
} from "@daily-energy/server-core/weekly-reflection";

import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";
import {
  loadWeeklySourceSnapshot,
  weeklyWindowId,
  type WeeklySourceExecutor,
} from "./weekly-source.js";

const ACCOUNT_GUARD_LOCK_SEED = 20_400;

export type WeeklyGuardFailure =
  | "ACCOUNT_DELETED"
  | "ACCOUNT_DELETING"
  | "ACCOUNT_RESTRICTED"
  | "CONSENT_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "SAFETY_BLOCKED";

export type WeeklyQueryResult =
  | { readonly status: "FOUND"; readonly value: ClientWeeklySummaryView }
  | { readonly status: WeeklyGuardFailure };

export interface WeeklyStore {
  close(): Promise<void>;
  get(input: {
    readonly accountId: string;
    readonly endProductDate: string;
  }): Promise<WeeklyQueryResult>;
}

export interface PostgresWeeklyStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface GuardRow {
  readonly snapshot: unknown;
}

interface WindowRow {
  readonly currentSourceFingerprint: Buffer | null;
  readonly currentSummaryRef: string | null;
  readonly hasPriorSummary: boolean;
  readonly windowId: string;
}

interface IntentRow {
  readonly state: string;
}

interface SummaryRow {
  readonly expressionCorePayload: unknown;
  readonly sourceFingerprint: Buffer;
}

export class PostgresWeeklyStore implements WeeklyStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresWeeklyStoreConfig,
  ): Promise<PostgresWeeklyStore> {
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
      return new PostgresWeeklyStore(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async get(input: {
    readonly accountId: string;
    readonly endProductDate: string;
  }): Promise<WeeklyQueryResult> {
    return this.#transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
        [input.accountId, ACCOUNT_GUARD_LOCK_SEED],
      );
      const guard = await readGuard(
        client,
        input.accountId,
        input.endProductDate,
      );
      if (guard !== "ALLOWED") {
        return { status: guard };
      }
      const window = (
        await client.query<WindowRow>(
          `SELECT id AS "windowId","currentSourceFingerprint","currentSummaryRef",
                  EXISTS (
                    SELECT 1
                      FROM daily_energy.app_published_weekly_summary_revision summary
                     WHERE summary."windowId"=weekly_window.id
                  ) AS "hasPriorSummary"
             FROM daily_energy.app_weekly_window
             AS weekly_window
            WHERE "accountId"=$1::uuid AND "endProductDate"=$2::date
              AND "windowRuleVersion"='window-v1'`,
          [input.accountId, input.endProductDate],
        )
      ).rows[0];
      const windowId =
        window?.windowId ??
        weeklyWindowId(input.accountId, input.endProductDate);
      const source = await loadWeeklySourceSnapshot(
        poolClientExecutor(client),
        {
          accountId: input.accountId,
          endProductDate: input.endProductDate,
          windowId,
        },
      );
      const derivation = deriveWeeklyAggregate(source);
      const eligible = derivation.expressionPlan !== undefined;
      if (!eligible) {
        return {
          status: "FOUND",
          value: createClientWeeklySummaryView({
            aggregate: derivation.aggregate,
            summaryStatus: "NOT_ELIGIBLE",
          }),
        };
      }
      const currentFingerprint = Buffer.from(source.source_fingerprint, "hex");
      if (window === undefined || window.currentSourceFingerprint === null) {
        return {
          status: "FOUND",
          value: createClientWeeklySummaryView({
            aggregate: derivation.aggregate,
            summaryStatus: "ELIGIBLE",
          }),
        };
      }
      if (!window.currentSourceFingerprint.equals(currentFingerprint)) {
        return {
          status: "FOUND",
          value: createClientWeeklySummaryView({
            aggregate: derivation.aggregate,
            summaryStatus: "INVALIDATED",
          }),
        };
      }
      if (window.currentSummaryRef !== null) {
        const published = await readPublished(
          client,
          window.currentSummaryRef,
          currentFingerprint,
        );
        return {
          status: "FOUND",
          value: createClientWeeklySummaryView({
            aggregate: derivation.aggregate,
            published,
            summaryStatus: "AVAILABLE",
          }),
        };
      }
      const intent = (
        await client.query<IntentRow>(
          `SELECT state::text AS state
             FROM daily_energy.app_weekly_summary_intent
            WHERE "windowId"=$1::uuid AND "sourceFingerprint"=$2
            LIMIT 1`,
          [window.windowId, currentFingerprint],
        )
      ).rows[0];
      const summaryStatus =
        intent === undefined
          ? ("ELIGIBLE" as const)
          : intent.state === "RUNNING" || intent.state === "RETRYABLE_FAILED"
            ? window.hasPriorSummary
              ? ("INVALIDATED" as const)
              : ("GENERATING" as const)
            : intent.state === "FAILED"
              ? ("FAILED" as const)
              : intent.state === "CANCELLED"
                ? ("INVALIDATED" as const)
                : undefined;
      if (summaryStatus === undefined) {
        throw new Error("WEEKLY_CURRENT_POINTER_MISSING");
      }
      return {
        status: "FOUND",
        value: createClientWeeklySummaryView({
          aggregate: derivation.aggregate,
          summaryStatus,
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
    if (this.#closed) {
      throw new Error("WEEKLY_STORE_CLOSED");
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

export const UNAVAILABLE_WEEKLY_STORE: WeeklyStore = Object.freeze({
  async close() {},
  async get() {
    throw new Error("WEEKLY_STORE_UNAVAILABLE");
  },
});

function poolClientExecutor(client: PoolClient): WeeklySourceExecutor {
  return Object.freeze({
    async execute<Row extends Readonly<Record<string, unknown>>>(
      statement: string,
      values: readonly unknown[] = [],
    ) {
      const result = await client.query<Row>(statement, [...values]);
      return { rows: result.rows };
    },
  });
}

async function readGuard(
  client: PoolClient,
  accountId: string,
  productDate: string,
): Promise<"ALLOWED" | WeeklyGuardFailure> {
  const row = (
    await client.query<GuardRow>(
      `SELECT daily_energy.resolve_c013_weekly_guard(
         $1::uuid,$2::date,'necessary-consent-v1'
       ) AS snapshot`,
      [accountId, productDate],
    )
  ).rows[0];
  const value = row?.snapshot;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("WEEKLY_GUARD_INVALID");
  }
  const status = (value as Record<string, unknown>).status;
  if (
    status === "ALLOWED" ||
    status === "ACCOUNT_DELETED" ||
    status === "ACCOUNT_DELETING" ||
    status === "ACCOUNT_RESTRICTED" ||
    status === "CONSENT_REQUIRED" ||
    status === "ONBOARDING_REQUIRED" ||
    status === "SAFETY_BLOCKED"
  ) {
    return status;
  }
  throw new Error("WEEKLY_GUARD_INVALID");
}

async function readPublished(
  client: PoolClient,
  summaryId: string,
  sourceFingerprint: Buffer,
): Promise<PublishedWeeklySummary> {
  const row = (
    await client.query<SummaryRow>(
      `SELECT "expressionCorePayload","sourceFingerprint"
         FROM daily_energy.app_published_weekly_summary_revision
        WHERE id=$1::uuid`,
      [summaryId],
    )
  ).rows[0];
  if (row === undefined || !row.sourceFingerprint.equals(sourceFingerprint)) {
    throw new Error("WEEKLY_CURRENT_SUMMARY_INVALID");
  }
  return PublishedWeeklySummarySchema.parse(row.expressionCorePayload);
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
    throw new Error("WEEKLY_DB_ROLE_MISMATCH");
  }
}
