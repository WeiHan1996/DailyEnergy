import { createHash, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  GenerationInputSnapshotSchema,
  type GenerationInputSnapshot,
  type GenerationIntentStatus,
  type PublishedDailyResult,
} from "@daily-energy/shared-schemas";
import {
  DailyPublicationError,
  assembleControlledTemplateDailyResultV1,
  dailyResultFingerprintV1,
} from "@daily-energy/server-core/content-publication";
import {
  DAILY_V1_GENERATION_MANIFEST,
  DeterministicGenerationError,
  decideGenerationPublishV1,
  deriveDailyRulesV1,
  deriveRootSeed,
  parseStableSubjectId,
  verifyGenerationManifestRecord,
  type FrozenGenerationManifest,
  type GenerationGuardSnapshotV1,
  type GenerationManifestRecord,
} from "@daily-energy/server-core/generation";
import {
  isGenerationCompletionEligible,
  parseProductDate,
} from "@daily-energy/server-core/product-time";

import {
  DailyTemplateAdapterError,
  renderControlledDailyTemplate,
} from "../ai/controlled-daily-template.js";
import { unprotectDevelopmentSubject } from "../identity/development-protected-subject.js";
import { resolveGenerationGuardSnapshot } from "./guard-snapshot.js";

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const RUNTIME_TTL_MS = 30 * 24 * 60 * 60_000;
const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const GENERATION_LOCK_SEED = 20_008;

interface RuntimeRow {
  readonly acceptedAt: Date;
  readonly accountId: string;
  readonly inputSnapshotFingerprint: Buffer;
  readonly intentRef: string;
  readonly manifestFingerprint: Buffer;
  readonly manifestRef: string;
  readonly publishedResultRef: string | null;
  readonly resultVersion: string;
  readonly revision: number;
  readonly rootSeedMaterialRef: string;
  readonly snapshotFingerprint: Buffer;
  readonly snapshotId: string;
  readonly snapshotPayload: unknown;
  readonly stableSubjectCiphertext: Buffer;
  readonly stableSubjectKeyVersion: string;
  readonly state: GenerationIntentStatus;
  readonly targetProductDate: string;
}

interface LoadedGeneration {
  readonly guard: GenerationGuardSnapshotV1;
  readonly manifest: FrozenGenerationManifest;
  readonly rootSeed: Uint8Array;
  readonly row: RuntimeRow;
  readonly snapshot: GenerationInputSnapshot;
}

export interface GenerationExecutionHooks {
  beforePublish?(intentRef: string): Promise<void>;
}

export type GenerationExecutionOutcome =
  "PUBLISHED" | "RETURN_EXISTING" | "BLOCKED" | "CANCELLED" | "TERMINAL";

export class PostgresDailyGenerationRuntime {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(input: {
    readonly applicationName: string;
    readonly connectionLimit?: number;
    readonly connectionString: string;
    readonly expectedDatabaseRole: string;
  }): Promise<PostgresDailyGenerationRuntime> {
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
          `SELECT current_user AS "currentUser",session_user AS "sessionUser",
                  pg_has_role(current_user,$1,'MEMBER') AS "expectedMember"`,
          [input.expectedDatabaseRole],
        )
      ).rows[0];
      if (
        !identity ||
        identity.currentUser !== identity.sessionUser ||
        !identity.expectedMember
      ) {
        throw new Error("GENERATION_RUNTIME_DB_ROLE_MISMATCH");
      }
      return new PostgresDailyGenerationRuntime(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async executeIntent(
    intentRef: string,
    input: {
      readonly hooks?: GenerationExecutionHooks;
      readonly now?: () => Date;
    } = {},
  ): Promise<GenerationExecutionOutcome> {
    this.#assertOpen();
    const clock = input.now ?? (() => new Date());
    let loaded: LoadedGeneration;
    try {
      loaded = await this.#load(intentRef);
      if (loaded.row.state === "SUCCEEDED") {
        return "RETURN_EXISTING";
      }
      if (
        loaded.row.state === "CANCELLED" ||
        loaded.row.state === "TERMINAL_FAILED"
      ) {
        return loaded.row.state === "CANCELLED" ? "CANCELLED" : "TERMINAL";
      }
      if (loaded.guard.status !== "ALLOWED") {
        await this.#cancel(intentRef, loaded.guard.status, clock());
        return "BLOCKED";
      }
      if (
        !isGenerationCompletionEligible({
          intentCreatedAt: loaded.row.acceptedAt,
          now: clock(),
          targetProductDate: parseProductDate(loaded.row.targetProductDate),
        })
      ) {
        await this.#cancel(intentRef, "GENERATION_WINDOW_CLOSED", clock());
        return "CANCELLED";
      }
      const derivation = deriveDailyRulesV1({
        manifest: loaded.manifest,
        rootSeed: loaded.rootSeed,
        snapshot: loaded.snapshot,
        stableSubjectId: parseStableSubjectId(
          unprotectDevelopmentSubject(
            loaded.row.stableSubjectCiphertext,
            loaded.row.stableSubjectKeyVersion,
          ),
        ),
      });
      const candidate = renderControlledDailyTemplate(
        derivation.controlledExpressionPlan,
      );
      await input.hooks?.beforePublish?.(intentRef);
      const resultId = randomUUID();
      return this.#publish(
        loaded,
        (publishedAt) =>
          assembleControlledTemplateDailyResultV1({
            expression: candidate.expression,
            generatedAt: publishedAt,
            inputSnapshotRef: loaded.row.snapshotId,
            productDate: loaded.row.targetProductDate,
            resultId,
            resultVersion: loaded.row.resultVersion,
            ruleFacts: derivation.ruleFacts,
            safetyPolicyVersion: loaded.manifest.manifest.safety_contract_floor,
            templateVersion: candidate.templateVersion,
            userRef: loaded.row.accountId,
          }),
        clock,
      );
    } catch (error) {
      if (
        error instanceof DeterministicGenerationError ||
        error instanceof DailyTemplateAdapterError ||
        error instanceof DailyPublicationError
      ) {
        await this.#markTerminal(intentRef, error.message, clock());
        return "TERMINAL";
      }
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#pool.end();
    }
  }

  async #load(intentRef: string): Promise<LoadedGeneration> {
    const row = (
      await this.#pool.query<RuntimeRow>(
        `SELECT intent.id AS "intentRef",intent."accountId",
                intent."targetProductDate"::text AS "targetProductDate",
                intent."acceptedAt",intent.revision,intent.state::text AS state,
                intent."resultVersion",intent."manifestRef",
                intent."manifestFingerprint",intent."inputSnapshotFingerprint",
                intent."rootSeedMaterialRef",intent."publishedResultRef",
                snapshot.id AS "snapshotId",snapshot."snapshotPayload",
                snapshot."snapshotFingerprint",
                account."stableSubjectCiphertext",
                account."stableSubjectKeyVersion"
           FROM daily_energy.app_generation_intent intent
           JOIN daily_energy.app_generation_input_snapshot snapshot
             ON snapshot."generationIntentId"=intent.id
           JOIN daily_energy.app_user_account account
             ON account.id=intent."accountId"
          WHERE intent.id=$1::uuid
          LIMIT 1`,
        [intentRef],
      )
    ).rows[0];
    if (row === undefined) {
      throw new Error("GENERATION_INTENT_NOT_FOUND");
    }
    if (row.rootSeedMaterialRef !== "account-stable-subject-v1") {
      throw new DeterministicGenerationError("ROOT_SEED_MISMATCH");
    }
    const snapshot = parseGenerationInputSnapshot(row.snapshotPayload);
    const snapshotFingerprint = fingerprintJson(snapshot);
    if (
      !row.snapshotFingerprint.equals(snapshotFingerprint) ||
      !row.inputSnapshotFingerprint.equals(snapshotFingerprint)
    ) {
      throw new DeterministicGenerationError("SNAPSHOT_BINDING_MISMATCH");
    }
    const manifestRow = (
      await this.#pool.query<{
        activatedAt: Date | null;
        compatibilityPayload: unknown;
        fingerprint: Buffer;
        manifestRef: string;
      }>(
        `SELECT id AS "manifestRef","compatibilityPayload",fingerprint,
                "activatedAt"
           FROM daily_energy.system_version_catalog_entry
          WHERE "catalogType"='GENERATION_MANIFEST' AND version=$1
          LIMIT 1`,
        [row.resultVersion],
      )
    ).rows[0];
    if (manifestRow === undefined || manifestRow.activatedAt === null) {
      throw new DeterministicGenerationError("MANIFEST_NOT_FOUND");
    }
    const manifestRecord: GenerationManifestRecord = {
      activatedAt: manifestRow.activatedAt,
      fingerprintHex: manifestRow.fingerprint.toString("hex"),
      manifest:
        manifestRow.compatibilityPayload as GenerationManifestRecord["manifest"],
      manifestRef: manifestRow.manifestRef,
    };
    const manifest = verifyGenerationManifestRecord(manifestRecord);
    if (
      manifest.resultVersion !== row.resultVersion ||
      manifest.manifestRef !== row.manifestRef ||
      !row.manifestFingerprint.equals(manifestRow.fingerprint) ||
      manifest.resultVersion !== DAILY_V1_GENERATION_MANIFEST.result_version
    ) {
      throw new DeterministicGenerationError("MANIFEST_FINGERPRINT_MISMATCH");
    }
    const stableSubjectId = parseStableSubjectId(
      unprotectDevelopmentSubject(
        row.stableSubjectCiphertext,
        row.stableSubjectKeyVersion,
      ),
    );
    const rootSeed = deriveRootSeed({
      productDate: parseProductDate(row.targetProductDate),
      resultVersion: row.resultVersion,
      stableSubjectId,
    });
    return Object.freeze({
      guard: await resolveGenerationGuardSnapshot(
        this.#pool,
        row.accountId,
        row.targetProductDate,
      ),
      manifest,
      rootSeed,
      row,
      snapshot,
    });
  }

  async #publish(
    loaded: LoadedGeneration,
    buildResult: (publishedAt: Date) => PublishedDailyResult,
    clock: () => Date,
  ): Promise<GenerationExecutionOutcome> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, loaded.row.accountId);
      await lockGeneration(
        client,
        loaded.row.accountId,
        loaded.row.targetProductDate,
      );
      const currentGuard = await resolveGenerationGuardSnapshot(
        client,
        loaded.row.accountId,
        loaded.row.targetProductDate,
      );
      const current = (
        await client.query<{
          acceptedAt: Date;
          publishedResultRef: string | null;
          revision: number;
          state: GenerationIntentStatus;
        }>(
          `SELECT "acceptedAt",revision,state::text AS state,
                  "publishedResultRef"
             FROM daily_energy.app_generation_intent
            WHERE id=$1::uuid AND "accountId"=$2::uuid
            FOR UPDATE`,
          [loaded.row.intentRef, loaded.row.accountId],
        )
      ).rows[0];
      if (current === undefined) {
        throw new Error("GENERATION_INTENT_NOT_FOUND");
      }
      // The completion fence is evaluated after all publication locks. A
      // candidate that waited across 04:15 must not publish using an earlier
      // render timestamp.
      const publishedAt = clock();
      const decision = decideGenerationPublishV1({
        completionEligible: isGenerationCompletionEligible({
          intentCreatedAt: current.acceptedAt,
          now: publishedAt,
          targetProductDate: parseProductDate(loaded.row.targetProductDate),
        }),
        currentGuard,
        currentRevision: current.revision,
        expectedGuard: loaded.guard,
        expectedRevision: loaded.row.revision,
        hasPublishedResult: current.publishedResultRef !== null,
        state: current.state,
      });
      if (decision.outcome === "RETURN_EXISTING") {
        return "RETURN_EXISTING";
      }
      if (
        decision.outcome === "BLOCKED" ||
        decision.outcome === "CANCELLED" ||
        decision.outcome === "TERMINAL"
      ) {
        await cancelIfActive(
          client,
          loaded.row.intentRef,
          publishedAt,
          decision.reasonCode,
        );
        return decision.outcome;
      }
      if (decision.outcome === "RETRYABLE") {
        throw new Error(decision.reasonCode);
      }
      const result = buildResult(publishedAt);
      const fingerprint = dailyResultFingerprintV1(result);
      const interactionRef = randomUUID();
      await client.query(
        `INSERT INTO daily_energy.app_published_daily_result
          (id,"accountId","generationIntentId","inputSnapshotId",
           "productDate","resultVersion","schemaVersion","generatedAt",
           "ruleFactsPayload","expressionCorePayload","provenancePayload",
           "validationReceipt","resultFingerprint","retentionPolicyVersion",
           "retentionScope","retentionAnchorAt","expiresAt")
         VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8::timestamptz,$9::jsonb,
                 $10::jsonb,$11::jsonb,$12::jsonb,$13,$14,'DAY',
                 $8::timestamptz,NULL)`,
        [
          result.identity.result_id,
          loaded.row.accountId,
          loaded.row.intentRef,
          loaded.row.snapshotId,
          loaded.row.targetProductDate,
          loaded.row.resultVersion,
          result.schema_version,
          publishedAt,
          JSON.stringify(result.facts),
          JSON.stringify(result.expression),
          JSON.stringify(result.provenance),
          JSON.stringify(result.validation),
          fingerprint,
          RETENTION_POLICY_VERSION,
        ],
      );
      await client.query(
        `INSERT INTO daily_energy.app_published_result_visibility
          (id,"resultId",state,revision,"sourceFingerprint","updatedAt",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt",
           "expiresAt")
         VALUES (gen_random_uuid(),$1,'AVAILABLE',1,$2,$3::timestamptz,$4,
                 'DAY',$3::timestamptz,NULL)`,
        [
          result.identity.result_id,
          fingerprint,
          publishedAt,
          RETENTION_POLICY_VERSION,
        ],
      );
      await client.query(
        `INSERT INTO daily_energy.app_daily_interaction
          (id,"accountId","productDate","resultId","aggregateRevision",
           "createdAt","updatedAt","retentionPolicyVersion",
           "retentionScope","retentionAnchorAt","expiresAt")
         VALUES ($1,$2,$3::date,$4,1,$5::timestamptz,$5::timestamptz,$6,
                 'DAY',$5::timestamptz,NULL)`,
        [
          interactionRef,
          loaded.row.accountId,
          loaded.row.targetProductDate,
          result.identity.result_id,
          publishedAt,
          RETENTION_POLICY_VERSION,
        ],
      );
      await client.query(
        `INSERT INTO daily_energy.app_daily_task_state
          (id,"interactionId","taskDefinitionId","taskKind",status,revision,
           "updatedAt","retentionPolicyVersion","retentionScope",
           "retentionAnchorAt","expiresAt")
         VALUES (gen_random_uuid(),$1,$2,$3,'UNMARKED',1,$4::timestamptz,$5,
                 'DAY',$4::timestamptz,NULL)`,
        [
          interactionRef,
          result.facts.optional_task_plan.task_id,
          result.facts.optional_task_plan.kind,
          publishedAt,
          RETENTION_POLICY_VERSION,
        ],
      );
      const updated = await client.query(
        `UPDATE daily_energy.app_generation_intent
            SET state='SUCCEEDED',revision=revision+1,
                "publishedResultRef"=$1,"updatedAt"=$2::timestamptz,
                "terminalReasonCode"=NULL
          WHERE id=$3::uuid AND revision=$4
            AND state IN ('RUNNING','FALLBACK_RUNNING')`,
        [
          result.identity.result_id,
          publishedAt,
          loaded.row.intentRef,
          loaded.row.revision,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error("GENERATION_PUBLISH_CAS_LOST");
      }
      await insertPublishedOutbox(client, {
        accountId: loaded.row.accountId,
        generatedAt: publishedAt,
        guard: currentGuard,
        intentRef: loaded.row.intentRef,
        resultId: result.identity.result_id,
        resultVersion: loaded.row.resultVersion,
      });
      return "PUBLISHED";
    });
  }

  async #cancel(
    intentRef: string,
    reasonCode: string,
    now: Date,
  ): Promise<void> {
    await this.#transitionActiveIntent(intentRef, "CANCELLED", reasonCode, now);
  }

  async #markTerminal(
    intentRef: string,
    reasonCode: string,
    now: Date,
  ): Promise<void> {
    await this.#transitionActiveIntent(
      intentRef,
      "TERMINAL_FAILED",
      reasonCode,
      now,
    );
  }

  async #transitionActiveIntent(
    intentRef: string,
    state: "CANCELLED" | "TERMINAL_FAILED",
    reasonCode: string,
    now: Date,
  ): Promise<void> {
    await this.#transaction(async (client) => {
      const intent = (
        await client.query<{ accountId: string; productDate: string }>(
          `SELECT "accountId","targetProductDate"::text AS "productDate"
             FROM daily_energy.app_generation_intent
            WHERE id=$1::uuid`,
          [intentRef],
        )
      ).rows[0];
      if (intent === undefined) {
        return;
      }
      await lockAccountGuard(client, intent.accountId);
      await lockGeneration(client, intent.accountId, intent.productDate);
      await client.query(
        `UPDATE daily_energy.app_generation_intent
            SET state=$2::daily_energy."GenerationState",
                revision=revision+1,"terminalReasonCode"=$3,
                "updatedAt"=$4::timestamptz
          WHERE id=$1::uuid AND "accountId"=$5::uuid
            AND state IN ('QUEUED','RUNNING','FALLBACK_RUNNING','RETRYABLE_FAILED')`,
        [intentRef, state, boundedReason(reasonCode), now, intent.accountId],
      );
    });
  }

  async #transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
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
      throw new Error("GENERATION_RUNTIME_CLOSED");
    }
  }
}

function parseGenerationInputSnapshot(value: unknown): GenerationInputSnapshot {
  const parsed = GenerationInputSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new DeterministicGenerationError("SNAPSHOT_FIELD_INVALID");
  }
  return parsed.data;
}

async function cancelIfActive(
  client: PoolClient,
  intentRef: string,
  now: Date,
  reasonCode: string,
): Promise<void> {
  await client.query(
    `UPDATE daily_energy.app_generation_intent
        SET state='CANCELLED',revision=revision+1,
            "terminalReasonCode"=$2,"updatedAt"=$3::timestamptz
      WHERE id=$1::uuid
        AND state IN ('QUEUED','RUNNING','FALLBACK_RUNNING','RETRYABLE_FAILED')`,
    [intentRef, boundedReason(reasonCode), now],
  );
}

async function insertPublishedOutbox(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly generatedAt: Date;
    readonly guard: GenerationGuardSnapshotV1;
    readonly intentRef: string;
    readonly resultId: string;
    readonly resultVersion: string;
  },
): Promise<void> {
  const idempotencyKey = createHash("sha256")
    .update(`c008:DailyResultPublished:${input.resultId}:1`)
    .digest();
  await client.query(
    `INSERT INTO daily_energy.runtime_outbox_event
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
       state,"availableAt","attemptCount","createdAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),'PublishedDailyResult',$1,1,
             'DailyResultPublished','v1',$2,$3::jsonb,$4::jsonb,'PENDING',
             $5::timestamptz,0,$5::timestamptz,$6,'RUNTIME',
             $5::timestamptz,$7::timestamptz)`,
    [
      input.resultId,
      idempotencyKey,
      JSON.stringify({
        intent_ref: input.intentRef,
        result_ref: input.resultId,
        result_version: input.resultVersion,
      }),
      JSON.stringify({
        deletion: input.guard.deletionEpoch.toString(),
        safety: input.guard.safetyEpoch.toString(),
      }),
      input.generatedAt,
      RETENTION_POLICY_VERSION,
      new Date(input.generatedAt.getTime() + RUNTIME_TTL_MS),
    ],
  );
}

function boundedReason(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9_]/gu, "_");
  return (normalized || "GENERATION_TERMINAL").slice(0, 64);
}

function fingerprintJson(value: unknown): Buffer {
  return createHash("sha256").update(stableJson(value), "utf8").digest();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
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

async function lockGeneration(
  client: PoolClient,
  accountId: string,
  productDate: string,
): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
    [`${accountId}:${productDate}`, GENERATION_LOCK_SEED],
  );
}
