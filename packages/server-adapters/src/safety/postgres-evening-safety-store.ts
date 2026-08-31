import { createHash, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  SafetyOverlayViewSchema,
  type SafetyOverlayView,
} from "@daily-energy/shared-schemas";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const RUNTIME_TTL_MS = 30 * 24 * 60 * 60_000;
const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const RESPONSE_VERSION = "safety-response-zh-cn-v1";
const RESOURCE_REGISTRY_VERSION = "safety-resources-cn-v1";

export type EveningSafetyActivationResult =
  | {
      readonly status: "ACCEPTED" | "DUPLICATE";
      readonly view: SafetyOverlayView;
    }
  | { readonly status: "IDEMPOTENCY_CONFLICT" };

export interface EveningSafetyActivationStore {
  activate(input: {
    readonly accountId: string;
    readonly categoryCodes: readonly string[];
    readonly classifierVersion: string;
    readonly commandRef: string;
    readonly irreversibleFingerprint: Buffer;
    readonly now: Date;
    readonly policyVersion: string;
    readonly ruleVersion: string;
  }): Promise<EveningSafetyActivationResult>;
  close(): Promise<void>;
}

export interface PostgresEveningSafetyStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface SafetyRow {
  readonly guardEpoch: string;
  readonly latestEventRef: string | null;
  readonly responsePlanRef: string | null;
  readonly revision: number;
  readonly safetyStateId: string;
  readonly state: "ACTIVE" | "CLEAR" | "RECOVERY_PENDING";
  readonly updatedAt: Date;
}

interface DecisionRow {
  readonly irreversibleFingerprint: Buffer;
}

export class PostgresEveningSafetyStore implements EveningSafetyActivationStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresEveningSafetyStoreConfig,
  ): Promise<PostgresEveningSafetyStore> {
    const roleProbe = createClosedDatabaseFactory(
      {
        databaseRole: config.expectedDatabaseRole,
        defaultConnectionLimit: 1,
        profile: "api-restricted",
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
      max: config.connectionLimit ?? 2,
    });
    try {
      await assertRole(pool, config.expectedDatabaseRole);
      return new PostgresEveningSafetyStore(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async activate(input: {
    readonly accountId: string;
    readonly categoryCodes: readonly string[];
    readonly classifierVersion: string;
    readonly commandRef: string;
    readonly irreversibleFingerprint: Buffer;
    readonly now: Date;
    readonly policyVersion: string;
    readonly ruleVersion: string;
  }): Promise<EveningSafetyActivationResult> {
    return this.#transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
        [input.accountId, ACCOUNT_GUARD_LOCK_SEED],
      );
      const account = await client.query(
        `SELECT 1 FROM daily_energy.app_user_account WHERE id=$1::uuid`,
        [input.accountId],
      );
      if (account.rowCount !== 1) {
        throw new Error("EVENING_SAFETY_ACCOUNT_MISSING");
      }
      const commandRef = commandRefStorageUuid(input.commandRef);
      const existingDecision = (
        await client.query<DecisionRow>(
          `SELECT "irreversibleFingerprint"
             FROM daily_energy.restricted_safety_decision
            WHERE "accountId"=$1::uuid AND "surfaceCode"='EVE-001'
              AND "commandRef"=$2::uuid`,
          [input.accountId, commandRef],
        )
      ).rows[0];
      if (existingDecision !== undefined) {
        if (
          !existingDecision.irreversibleFingerprint.equals(
            input.irreversibleFingerprint,
          )
        ) {
          return { status: "IDEMPOTENCY_CONFLICT" };
        }
        return {
          status: "DUPLICATE",
          view: await readSafetyView(client, input.accountId),
        };
      }
      const current = (
        await client.query<SafetyRow>(
          `SELECT id AS "safetyStateId",state::text AS state,revision,
                  "guardEpoch"::text AS "guardEpoch","latestEventRef",
                  "responsePlanRef","updatedAt"
             FROM daily_energy.restricted_safety_state
            WHERE "accountId"=$1::uuid FOR UPDATE`,
          [input.accountId],
        )
      ).rows[0];
      const revision = (current?.revision ?? 0) + 1;
      const guardEpoch = BigInt(current?.guardEpoch ?? "0") + 1n;
      const stateId = current?.safetyStateId ?? randomUUID();
      const eventId = randomUUID();
      const planId = randomUUID();
      const categories = [...new Set(input.categoryCodes)].sort();
      if (
        categories.length < 1 ||
        categories.length > 4 ||
        categories.some((value) => !/^[A-Z][A-Z0-9_]{0,63}$/u.test(value))
      ) {
        throw new Error("EVENING_SAFETY_CATEGORY_INVALID");
      }
      await client.query(
        `INSERT INTO daily_energy.restricted_safety_decision
          (id,"accountId","surfaceCode","commandRef",level,"categoryCodes",
           "policyVersion","ruleVersion","classifierVersion",
           "irreversibleFingerprint","createdAt","retentionPolicyVersion",
           "retentionScope","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1::uuid,'EVE-001',$2::uuid,'HIGH_RISK',
                 $3::text[],$4,$5,$6,$7,$8::timestamptz,$9,'SAFETY',
                 $8::timestamptz)`,
        [
          input.accountId,
          commandRef,
          categories,
          input.policyVersion,
          input.ruleVersion,
          input.classifierVersion,
          input.irreversibleFingerprint,
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      await client.query(
        `INSERT INTO daily_energy.restricted_safety_event
          (id,"accountId","stateRevision","guardEpoch","surfaceCode",
           "decisionLevel","categoryCodes","policyVersion","ruleVersion",
           "classifierVersion","responseVersion","resourceRegistryVersion",
           "createdAt","retentionPolicyVersion","retentionScope",
           "retentionAnchorAt")
         VALUES ($1::uuid,$2::uuid,$3,$4::bigint,'EVE-001','HIGH_RISK',$5::text[],
                 $6,$7,$8,$9,$10,$11::timestamptz,$12,'SAFETY',$11::timestamptz)`,
        [
          eventId,
          input.accountId,
          revision,
          guardEpoch.toString(),
          categories,
          input.policyVersion,
          input.ruleVersion,
          input.classifierVersion,
          RESPONSE_VERSION,
          RESOURCE_REGISTRY_VERSION,
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      await client.query(
        `INSERT INTO daily_energy.restricted_safety_response_plan
          (id,"accountId","stateRevision","blockIds","resourceEntryRefs",
           "localeCode","regionCode","fallbackCode","viewVersion","createdAt",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES ($1::uuid,$2::uuid,$3,$4::text[],'[]'::jsonb,'zh-CN','CN',
                 'GENERIC_REALITY_HELP',$5,$6::timestamptz,$7,'SAFETY',
                 $6::timestamptz)`,
        [
          planId,
          input.accountId,
          revision,
          [
            "DIRECT_ACKNOWLEDGEMENT_V1",
            "IMMEDIATE_ACTION_V1",
            "PRODUCT_LIMIT_V1",
          ],
          RESPONSE_VERSION,
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      if (current === undefined) {
        await client.query(
          `INSERT INTO daily_energy.restricted_safety_state
            (id,"accountId",state,revision,"guardEpoch","latestEventRef",
             "responsePlanRef","updatedAt","retentionPolicyVersion",
             "retentionScope","retentionAnchorAt")
           VALUES ($1::uuid,$2::uuid,'ACTIVE',$3,$4::bigint,$5::uuid,$6::uuid,
                   $7::timestamptz,$8,'SAFETY',$7::timestamptz)`,
          [
            stateId,
            input.accountId,
            revision,
            guardEpoch.toString(),
            eventId,
            planId,
            input.now,
            RETENTION_POLICY_VERSION,
          ],
        );
      } else {
        await client.query(
          `UPDATE daily_energy.restricted_safety_state
              SET state='ACTIVE',revision=$2,"guardEpoch"=$3::bigint,
                  "latestEventRef"=$4::uuid,"responsePlanRef"=$5::uuid,
                  "updatedAt"=$6::timestamptz
            WHERE id=$1::uuid AND revision=$7`,
          [
            stateId,
            revision,
            guardEpoch.toString(),
            eventId,
            planId,
            input.now,
            current.revision,
          ],
        );
      }
      await insertOutbox(client, {
        eventId,
        guardEpoch,
        now: input.now,
        revision,
        stateId,
      });
      return {
        status: "ACCEPTED",
        view: safetyView(revision, input.now),
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
      throw new Error("EVENING_SAFETY_STORE_CLOSED");
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

async function readSafetyView(
  client: PoolClient,
  accountId: string,
): Promise<SafetyOverlayView> {
  const row = (
    await client.query<SafetyRow>(
      `SELECT id AS "safetyStateId",state::text AS state,revision,
              "guardEpoch"::text AS "guardEpoch","latestEventRef",
              "responsePlanRef","updatedAt"
         FROM daily_energy.restricted_safety_state
        WHERE "accountId"=$1::uuid`,
      [accountId],
    )
  ).rows[0];
  if (row === undefined || row.state === "CLEAR") {
    throw new Error("EVENING_SAFETY_STATE_MISSING");
  }
  return safetyView(row.revision, row.updatedAt, row.state);
}

function safetyView(
  revision: number,
  updatedAt: Date,
  state: "ACTIVE" | "RECOVERY_PENDING" = "ACTIVE",
): SafetyOverlayView {
  return SafetyOverlayViewSchema.parse({
    state,
    revision,
    response_bundle_version: RESPONSE_VERSION,
    blocks: [
      {
        block_id: "DIRECT_ACKNOWLEDGEMENT_V1",
        kind: "DIRECT_ACKNOWLEDGEMENT",
        copy: "你刚才提到的内容可能关系到现实中的安全。这里先停止今日能量和普通建议。",
        resources: [],
      },
      {
        block_id: "IMMEDIATE_ACTION_V1",
        kind: "IMMEDIATE_ACTION",
        copy: "如果你或他人正面临立即危险，请先去更安全、有人可以帮助的地方，并联系当地紧急服务。",
        resources: [],
      },
      {
        block_id: "PRODUCT_LIMIT_V1",
        kind: "PRODUCT_LIMIT",
        copy: "DailyEnergy 不能处理危机，也不能替代紧急服务、医疗或专业支持。",
        resources: [],
      },
    ],
    updated_at: updatedAt.toISOString(),
  });
}

async function insertOutbox(
  client: PoolClient,
  input: {
    readonly eventId: string;
    readonly guardEpoch: bigint;
    readonly now: Date;
    readonly revision: number;
    readonly stateId: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO daily_energy.runtime_outbox_event
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
       state,"availableAt","attemptCount","createdAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),'SafetyState',$1::uuid,$2,'SafetyActivated','v1',
             $3,'{}'::jsonb,$4::jsonb,'PENDING',$5::timestamptz,0,$5::timestamptz,
             $6,'RUNTIME',$5::timestamptz,$7::timestamptz)`,
    [
      input.stateId,
      input.revision,
      createHash("sha256")
        .update(`c012:SafetyActivated:${input.eventId}`, "utf8")
        .digest(),
      JSON.stringify({ safety: input.guardEpoch.toString() }),
      input.now,
      RETENTION_POLICY_VERSION,
      new Date(input.now.getTime() + RUNTIME_TTL_MS),
    ],
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
    throw new Error("EVENING_SAFETY_DB_ROLE_MISMATCH");
  }
}
