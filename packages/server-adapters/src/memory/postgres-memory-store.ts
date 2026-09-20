import { createHash, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  recheckDailyMatterV1,
  recheckPublishedDailyMatterV1,
  resolveDailyMemoryStateResponseV2,
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
  readonly memorySafetySourceRevision: number | null;
  readonly memorySafetyPolicyVersion: string | null;
  readonly memorySafetyRuleVersion: string | null;
  readonly memorySafetyClassifierVersion: string | null;
  readonly memorySafetyFingerprint: Buffer | null;
}

interface MentionRow {
  readonly sourceRef: string;
  readonly productDate: string;
}

interface PublishedDependencyRow {
  readonly sourceRef: string;
  readonly sourceRevision: number;
  readonly grantRef: string;
  readonly grantRevision: number;
  readonly masterRevision: number;
  readonly accountRevision: number;
  readonly safetyEpoch: string;
  readonly deletionEpoch: string;
  readonly sourceSafetyPolicyVersion: string;
  readonly sourceSafetyRuleVersion: string;
  readonly sourceSafetyClassifierVersion: string;
  readonly sourceSafetyFingerprint: Buffer;
  readonly validUntilProductDate: string;
  readonly temporalRelation: SelectedDailyMatterV1["temporalRelation"];
  readonly policyVersion: "memory-policy-v1";
}

// Existing Matter rows without a current per-revision Safety proof remain
// ineligible; this store never reads title ciphertext.
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

  public async commitDailyUse(input: {
    readonly selected: SelectedDailyMatterV1;
    readonly productDate: string;
    readonly resultId: string;
    readonly protectedStateResponse: {
      readonly ciphertext: Buffer;
      readonly keyVersion: string;
      readonly fingerprint: Buffer;
    };
    readonly fallbackStateResponse: string;
    readonly now: Date;
    readonly hooks?: {
      beforeCommit?(): Promise<void>;
      onFailure?(diagnostic: {
        readonly phase: MemoryPublicationPhase;
        readonly databaseCode?: string;
        readonly constraint?: string;
      }): Promise<void>;
    };
  }): Promise<"COMMITTED" | "DUPLICATE" | "FALLBACK_REQUIRED"> {
    if (this.#closed) {
      return "FALLBACK_REQUIRED";
    }
    let phase: MemoryPublicationPhase = "LIVE_RECHECK";
    try {
      return await this.#transaction(
        input.selected.ownerRef,
        async (client) => {
          phase = "RESULT_BINDING";
          const result = (
            await client.query<{
              accountId: string;
              productDate: string;
              resultVersion: string;
              schemaVersion: string;
            }>(
              `SELECT "accountId","productDate"::text AS "productDate",
                      "resultVersion","schemaVersion"
               FROM daily_energy.app_published_daily_result
              WHERE id=$1::uuid`,
              [input.resultId],
            )
          ).rows[0];
          if (
            result === undefined ||
            result.accountId !== input.selected.ownerRef ||
            result.productDate !== input.productDate ||
            result.resultVersion !== "daily-v2" ||
            result.schemaVersion !== "2.0.0"
          ) {
            return "FALLBACK_REQUIRED";
          }
          phase = "SLOT";
          const duplicate = await client.query(
            `SELECT 1 FROM daily_energy.app_result_content_slot
            WHERE "resultId"=$1::uuid AND "segmentPath"='expression.state_response'`,
            [input.resultId],
          );
          if (duplicate.rowCount === 1) {
            return "DUPLICATE";
          }
          phase = "LIVE_RECHECK";
          const current = await readCurrent(client, {
            ownerRef: input.selected.ownerRef,
            productDate: input.productDate,
            sourceRef: input.selected.sourceRef,
          });
          if (!recheckDailyMatterV1(input.selected, current)) {
            return "FALLBACK_REQUIRED";
          }
          assertProtectedFragment(input.protectedStateResponse);
          if (
            input.fallbackStateResponse.length < 1 ||
            Buffer.byteLength(input.fallbackStateResponse, "utf8") > 560
          ) {
            return "FALLBACK_REQUIRED";
          }
          resolveDailyMemoryStateResponseV2({
            dependencyValid: false,
            fallbackStateResponse: input.fallbackStateResponse,
          });
          const slotId = randomUUID();
          const fragmentId = randomUUID();
          await client.query(
            `INSERT INTO daily_energy.app_result_content_slot
            (id,"resultId","segmentPath","fallbackPayload","fallbackFingerprint",
             "fallbackSchemaVersion","createdAt","retentionPolicyVersion",
             "retentionScope","retentionAnchorAt")
           VALUES ($1::uuid,$2::uuid,'expression.state_response',$3::jsonb,$4,
             'daily-memory-fragment-v2',$5::timestamptz,'retention-policy-v1',
             'DAY',$5::timestamptz)`,
            [
              slotId,
              input.resultId,
              JSON.stringify({ text: input.fallbackStateResponse }),
              createHash("sha256")
                .update(input.fallbackStateResponse, "utf8")
                .digest(),
              input.now,
            ],
          );
          phase = "FRAGMENT";
          await client.query(
            `INSERT INTO daily_energy.app_personalized_content_fragment
            (id,"slotId","payloadCiphertext","payloadKeyVersion",
             "payloadFingerprint","schemaVersion","createdAt",
             "retentionPolicyVersion","retentionScope","retentionAnchorAt")
           VALUES ($1::uuid,$2::uuid,$3,$4,$5,'daily-memory-fragment-v2',
             $6::timestamptz,'retention-policy-v1','DAY',$6::timestamptz)`,
            [
              fragmentId,
              slotId,
              input.protectedStateResponse.ciphertext,
              input.protectedStateResponse.keyVersion,
              input.protectedStateResponse.fingerprint,
              input.now,
            ],
          );
          phase = "DEPENDENCY";
          await client.query(
            `INSERT INTO daily_energy.app_source_dependency
            (id,"fragmentId","sourceType","sourceRef","sourceRevision",purpose,
             "grantRef","grantRevision","masterRevision","accountRevision",
             "safetyEpoch","deletionEpoch","sourceSafetyPolicyVersion",
             "sourceSafetyRuleVersion","sourceSafetyClassifierVersion",
             "sourceSafetyFingerprint","validUntilProductDate","temporalRelation",
             "policyVersion","segmentPaths",
             "fallbackPaths","validAtPublish","retentionPolicyVersion",
             "retentionScope","retentionAnchorAt")
           VALUES (gen_random_uuid(),$1::uuid,'MATTER',$2::uuid,$3,
             'DAILY_EXPRESSION',$4::uuid,$5,$6,$7,$8::bigint,$9::bigint,
             $10,$11,$12,$13,$14::date,$15,$16,
             ARRAY['expression.state_response'],ARRAY['expression.state_response'],
             true,'retention-policy-v1','DAY',$17::timestamptz)`,
            [
              fragmentId,
              input.selected.sourceRef,
              input.selected.sourceRevision,
              input.selected.grantRef,
              input.selected.grantRevision,
              input.selected.masterRevision,
              input.selected.accountRevision,
              input.selected.safetyEpoch,
              input.selected.deletionEpoch,
              input.selected.sourceSafetyPolicyVersion,
              input.selected.sourceSafetyRuleVersion,
              input.selected.sourceSafetyClassifierVersion,
              Buffer.from(input.selected.sourceSafetyFingerprintHex, "hex"),
              input.selected.validUntilProductDate,
              input.selected.temporalRelation,
              input.selected.policyVersion,
              input.now,
            ],
          );
          phase = "MENTION";
          await client.query(
            `INSERT INTO daily_energy.app_memory_mention_receipt
            (id,"accountId","sourceType","sourceRef","productDate",purpose,
             "resultId","policyVersion","createdAt","retentionPolicyVersion",
             "retentionScope","retentionAnchorAt")
           VALUES (gen_random_uuid(),$1::uuid,'MATTER',$2::uuid,$3::date,
             'DAILY_EXPRESSION',$4::uuid,$5,$6::timestamptz,
             'retention-policy-v1','DAY',$6::timestamptz)`,
            [
              input.selected.ownerRef,
              input.selected.sourceRef,
              input.productDate,
              input.resultId,
              input.selected.policyVersion,
              input.now,
            ],
          );
          phase = "BEFORE_COMMIT";
          await input.hooks?.beforeCommit?.();
          return "COMMITTED";
        },
      );
    } catch (error) {
      const databaseCode = safeDiagnosticField(error, "code");
      const constraint = safeDiagnosticField(error, "constraint");
      await input.hooks?.onFailure?.({
        phase,
        ...(databaseCode === undefined ? {} : { databaseCode }),
        ...(constraint === undefined ? {} : { constraint }),
      });
      return "FALLBACK_REQUIRED";
    }
  }

  public async isDailyDependencyValid(input: {
    readonly ownerRef: string;
    readonly productDate: string;
    readonly resultId: string;
  }): Promise<boolean> {
    if (this.#closed) {
      return false;
    }
    try {
      return await this.#transaction(input.ownerRef, async (client) => {
        const rows = (
          await client.query<PublishedDependencyRow>(
            `SELECT dependency."sourceRef",dependency."sourceRevision",
                    dependency."grantRef",dependency."grantRevision",
                    dependency."masterRevision",dependency."accountRevision",
                    dependency."safetyEpoch"::text AS "safetyEpoch",
                    dependency."deletionEpoch"::text AS "deletionEpoch",
                    dependency."sourceSafetyPolicyVersion",
                    dependency."sourceSafetyRuleVersion",
                    dependency."sourceSafetyClassifierVersion",
                    dependency."sourceSafetyFingerprint",
                    dependency."validUntilProductDate"::text AS "validUntilProductDate",
                    dependency."temporalRelation",dependency."policyVersion"
               FROM daily_energy.app_source_dependency dependency
               JOIN daily_energy.app_personalized_content_fragment fragment
                 ON fragment.id=dependency."fragmentId"
               JOIN daily_energy.app_result_content_slot slot
                 ON slot.id=fragment."slotId"
               JOIN daily_energy.app_published_daily_result result
                 ON result.id=slot."resultId"
              WHERE slot."resultId"=$1::uuid
                AND result."accountId"=$2::uuid
                AND result."productDate"=$3::date
                AND slot."segmentPath"='expression.state_response'
                AND dependency."sourceType"='MATTER'
                AND dependency.purpose='DAILY_EXPRESSION'`,
            [input.resultId, input.ownerRef, input.productDate],
          )
        ).rows;
        if (rows.length !== 1) {
          return false;
        }
        const row = rows[0]!;
        const selected: SelectedDailyMatterV1 = {
          ownerRef: input.ownerRef,
          accountRevision: row.accountRevision,
          safetyEpoch: row.safetyEpoch,
          deletionEpoch: row.deletionEpoch,
          masterRevision: row.masterRevision,
          sourceSafetyPolicyVersion: row.sourceSafetyPolicyVersion,
          sourceSafetyRuleVersion: row.sourceSafetyRuleVersion,
          sourceSafetyClassifierVersion: row.sourceSafetyClassifierVersion,
          sourceSafetyFingerprintHex:
            row.sourceSafetyFingerprint.toString("hex"),
          temporalRelation: row.temporalRelation,
          sourceRef: row.sourceRef,
          sourceRevision: row.sourceRevision,
          grantRef: row.grantRef,
          grantRevision: row.grantRevision,
          validUntilProductDate: row.validUntilProductDate,
          policyVersion: row.policyVersion,
        };
        return recheckPublishedDailyMatterV1(
          selected,
          await readCurrent(client, {
            ownerRef: input.ownerRef,
            productDate: input.productDate,
            sourceRef: row.sourceRef,
          }),
        );
      });
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

type MemoryPublicationPhase =
  | "LIVE_RECHECK"
  | "RESULT_BINDING"
  | "SLOT"
  | "FRAGMENT"
  | "DEPENDENCY"
  | "MENTION"
  | "BEFORE_COMMIT";

function safeDiagnosticField(
  error: unknown,
  field: "code" | "constraint",
): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(value)
    ? value
    : undefined;
}

function assertProtectedFragment(value: {
  readonly ciphertext: Buffer;
  readonly keyVersion: string;
  readonly fingerprint: Buffer;
}): void {
  if (
    value.ciphertext.length < 29 ||
    value.keyVersion.length < 1 ||
    value.keyVersion.length > 64 ||
    value.fingerprint.length !== 32
  ) {
    throw new Error("MEMORY_FRAGMENT_PROTECTION_INVALID");
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
              grant_row."policyVersion" AS "grantPolicyVersion",
              matter."memorySafetySourceRevision",
              matter."memorySafetyPolicyVersion",matter."memorySafetyRuleVersion",
              matter."memorySafetyClassifierVersion",matter."memorySafetyFingerprint"
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
      ...(row.memorySafetySourceRevision === null ||
      row.memorySafetyPolicyVersion === null ||
      row.memorySafetyRuleVersion === null ||
      row.memorySafetyClassifierVersion === null ||
      row.memorySafetyFingerprint === null
        ? {}
        : {
            memorySafetyProof: {
              sourceRevision: row.memorySafetySourceRevision,
              policyVersion: row.memorySafetyPolicyVersion,
              ruleVersion: row.memorySafetyRuleVersion,
              classifierVersion: row.memorySafetyClassifierVersion,
              fingerprintHex: row.memorySafetyFingerprint.toString("hex"),
            },
          }),
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
