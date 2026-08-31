import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  CheckinViewSchema,
  GenerationInputSnapshotSchema,
  GenerationIntentViewSchema,
  HistoryDayViewSchema,
  PublishedDailyResultSchema,
  TodayViewSchema,
  type CheckinView,
  type GenerationInputSnapshot,
  type GenerationIntentStatus,
  type GenerationIntentView,
  type HistoryDayView,
  type TodayView,
} from "@daily-energy/shared-schemas";
import {
  dailyResultFingerprintV1,
  projectClientDailyContentViewV1,
} from "@daily-energy/server-core/content-publication";
import {
  parseManifestFingerprint,
  verifyGenerationManifestRecord,
  type GenerationGuardSnapshotV1,
  type GenerationManifestRecord,
} from "@daily-energy/server-core/generation";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";
import {
  UNAVAILABLE_DAILY_CONTENT_CACHE,
  type DailyContentCache,
  type DailyContentCacheIdentity,
} from "./daily-content-cache.js";
import {
  resolveGenerationGuardSnapshot,
  sameGenerationGuardSnapshot,
} from "./guard-snapshot.js";

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const COMMAND_RECEIPT_TTL_MS = 7 * 24 * 60 * 60_000;
const RUNTIME_TTL_MS = 30 * 24 * 60 * 60_000;
const GENERATION_LOCK_SEED = 20_008;
const ACCOUNT_GUARD_LOCK_SEED = 20_400;
const ROOT_SEED_MATERIAL_REF = "account-stable-subject-v1";

export type GenerationGuardFailure = Exclude<
  GenerationGuardSnapshotV1["status"],
  "ALLOWED"
>;

export type GenerationStartResult =
  | {
      readonly status: "ACCEPTED" | "DUPLICATE";
      readonly value: GenerationIntentView;
    }
  | {
      readonly status: "REVISION_CONFLICT";
      readonly currentCheckin: CheckinView;
    }
  | {
      readonly status:
        | "IDEMPOTENCY_CONFLICT"
        | "CHECKIN_REQUIRED"
        | "MANIFEST_NOT_FOUND"
        | GenerationGuardFailure;
    };

export type GenerationIntentQueryResult =
  | { readonly status: "FOUND"; readonly value: GenerationIntentView }
  | { readonly status: "NOT_FOUND" | GenerationGuardFailure };

export type TodayQueryResult =
  | { readonly status: "FOUND"; readonly value: TodayView }
  | {
      readonly status:
        | "NOT_FOUND"
        | "GENERATION_PENDING"
        | "GENERATION_FAILED_RETRYABLE"
        | "GENERATION_FAILED_TERMINAL"
        | GenerationGuardFailure;
    };

export type HistoryDayQueryResult =
  | { readonly status: "FOUND"; readonly value: HistoryDayView }
  | { readonly status: "NOT_FOUND" | GenerationGuardFailure };

export interface DailyGenerationStore {
  close(): Promise<void>;
  getByDate(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<HistoryDayQueryResult>;
  getIntent(input: {
    readonly accountId: string;
    readonly intentRef: string;
  }): Promise<GenerationIntentQueryResult>;
  getToday(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<TodayQueryResult>;
  start(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly expectedCheckinRevision: number;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
    readonly productDatePolicyVersion: string;
  }): Promise<GenerationStartResult>;
}

export interface PostgresDailyGenerationStoreConfig {
  readonly applicationName: string;
  readonly cache?: DailyContentCache;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface CheckinRow {
  readonly checkinRef: string;
  readonly energy: GenerationInputSnapshot["checkin"]["energy"];
  readonly mood: GenerationInputSnapshot["checkin"]["mood"];
  readonly productDate: string;
  readonly revision: number;
  readonly sleep: GenerationInputSnapshot["checkin"]["sleep"];
  readonly updatedAt: Date;
}

interface IntentRow {
  readonly intentRef: string;
  readonly productDate: string;
  readonly publishedResultRef: string | null;
  readonly revision: number;
  readonly state: GenerationIntentStatus;
  readonly updatedAt: Date;
}

interface ManifestRow {
  readonly activatedAt: Date;
  readonly compatibilityPayload: unknown;
  readonly createdAt: Date;
  readonly fingerprint: Buffer;
  readonly manifestRef: string;
  readonly version: string;
}

interface ReceiptRow {
  readonly normalizedPayloadFingerprint: Buffer;
  readonly operationCode: string;
  readonly productDatePolicyVersion: string | null;
  readonly responseRef: string | null;
  readonly targetKey: string;
}

interface TodayRow {
  readonly aggregateRevision: number;
  readonly expressionCorePayload: unknown;
  readonly generatedAt: Date;
  readonly helpfulnessRating:
    "HELPFUL" | "NEUTRAL" | "NOT_HELPFUL" | "NOT_USED" | null;
  readonly helpfulnessRevision: number | null;
  readonly inputSnapshotId: string;
  readonly isLit: boolean;
  readonly productDate: string;
  readonly provenancePayload: unknown;
  readonly relationshipCount: number;
  readonly resultFingerprint: Buffer;
  readonly resultId: string;
  readonly resultVersion: string;
  readonly ruleFactsPayload: unknown;
  readonly schemaVersion: string;
  readonly taskDefinitionId: string;
  readonly taskRevision: number;
  readonly taskStatus: "UNMARKED" | "INTERESTED" | "COMPLETED" | "SKIPPED";
  readonly updatedAt: Date;
  readonly validationReceipt: unknown;
  readonly visibilityRevision: number;
  readonly visibilitySourceFingerprint: Buffer;
}

type CommandClaim =
  | { readonly status: "NEW" }
  | { readonly status: "CONFLICT" }
  | { readonly status: "DUPLICATE"; readonly responseRef: string | null };

interface TodaySource {
  readonly cacheIdentity: DailyContentCacheIdentity;
  readonly guard: GenerationGuardSnapshotV1;
  readonly publishedResult: ReturnType<typeof PublishedDailyResultSchema.parse>;
  readonly row: TodayRow;
}

interface HistorySource extends TodaySource {
  readonly checkin: CheckinRow;
}

export class PostgresDailyGenerationStore implements DailyGenerationStore {
  readonly #cache: DailyContentCache;
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool, cache: DailyContentCache) {
    this.#pool = pool;
    this.#cache = cache;
  }

  public static async connect(
    config: PostgresDailyGenerationStoreConfig,
  ): Promise<PostgresDailyGenerationStore> {
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
      return new PostgresDailyGenerationStore(
        pool,
        config.cache ?? UNAVAILABLE_DAILY_CONTENT_CACHE,
      );
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async start(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly expectedCheckinRevision: number;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
    readonly productDatePolicyVersion: string;
  }): Promise<GenerationStartResult> {
    return this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      await lockGeneration(client, input.accountId, input.productDate);
      const guard = await resolveGenerationGuardSnapshot(
        client,
        input.accountId,
        input.productDate,
      );
      if (guard.status !== "ALLOWED") {
        return { status: guard.status };
      }
      const checkin = await readCheckin(
        client,
        input.accountId,
        input.productDate,
        true,
      );
      if (checkin === undefined) {
        return { status: "CHECKIN_REQUIRED" };
      }
      if (checkin.revision !== input.expectedCheckinRevision) {
        return {
          currentCheckin: checkinView(checkin),
          status: "REVISION_CONFLICT",
        };
      }
      const claim = await claimCommand(client, input);
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        const duplicate = await readIntentForReceipt(
          client,
          input.accountId,
          input.productDate,
          claim.responseRef,
        );
        return { status: "DUPLICATE", value: intentView(duplicate) };
      }

      const existing = await readIntentForDate(
        client,
        input.accountId,
        input.productDate,
      );
      if (existing !== undefined) {
        await attachCommandResponse(client, input, existing.intentRef);
        return { status: "DUPLICATE", value: intentView(existing) };
      }

      const manifest = await selectActiveManifest(client, input.now);
      if (manifest === undefined) {
        await abandonCommandClaim(client, input);
        return { status: "MANIFEST_NOT_FOUND" };
      }
      const profile = await client.query<{
        expressionStyle: GenerationInputSnapshot["profile"]["expression_style"];
        revision: number;
      }>(
        `SELECT revision, "expressionStyle"::text AS "expressionStyle"
           FROM daily_energy.app_user_profile
          WHERE "accountId"=$1::uuid`,
        [input.accountId],
      );
      const profileRow = profile.rows[0];
      if (profileRow === undefined) {
        await abandonCommandClaim(client, input);
        return { status: "ONBOARDING_REQUIRED" };
      }
      const snapshot = GenerationInputSnapshotSchema.parse({
        snapshot_version: manifest.manifest.input_snapshot_version,
        product_date: input.productDate,
        result_version: manifest.resultVersion,
        user_ref: input.accountId,
        checkin: {
          revision: checkin.revision,
          mood: checkin.mood,
          energy: checkin.energy,
          sleep: checkin.sleep,
        },
        profile: {
          revision: profileRow.revision,
          expression_style: profileRow.expressionStyle,
        },
        relationship: {
          stage: "BEFORE_FIRST_MEETING",
          encounter_day_count: 0,
        },
        permitted_context: [],
      });
      const snapshotFingerprint = fingerprintJson(snapshot);
      const intentRef = randomUUID();
      const snapshotRef = randomUUID();
      await client.query(
        `INSERT INTO daily_energy.app_generation_intent
          (id,"accountId","targetProductDate","productDatePolicyVersion",
           "acceptedAt",revision,state,"resultVersion","manifestRef",
           "manifestFingerprint","inputSnapshotFingerprint",
           "rootSeedMaterialRef","completionGrantVersion","createdAt",
           "updatedAt","retentionPolicyVersion","retentionScope",
           "retentionAnchorAt","expiresAt")
         VALUES ($1,$2,$3::date,$4,$5::timestamptz,1,'QUEUED',$6,$7,$8,$9,
                 $10,'generation-completion-v1',$5::timestamptz,
                 $5::timestamptz,$11,'DAY',$5::timestamptz,NULL)`,
        [
          intentRef,
          input.accountId,
          input.productDate,
          input.productDatePolicyVersion,
          input.now,
          manifest.resultVersion,
          manifest.manifestRef,
          Buffer.from(manifest.fingerprintHex, "hex"),
          snapshotFingerprint,
          ROOT_SEED_MATERIAL_REF,
          RETENTION_POLICY_VERSION,
        ],
      );
      await client.query(
        `INSERT INTO daily_energy.app_generation_input_snapshot
          (id,"generationIntentId","checkinId","checkinRevision",
           "schemaVersion","snapshotPayload","snapshotFingerprint",
           "createdAt","retentionPolicyVersion","retentionScope",
           "retentionAnchorAt","expiresAt")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::timestamptz,$9,'DAY',
                 $8::timestamptz,NULL)`,
        [
          snapshotRef,
          intentRef,
          checkin.checkinRef,
          checkin.revision,
          snapshot.snapshot_version,
          JSON.stringify(snapshot),
          snapshotFingerprint,
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      await insertOutbox(client, {
        aggregateRef: intentRef,
        aggregateRevision: 1,
        eventType: "GenerationIntentAccepted",
        guard,
        now: input.now,
        payload: {
          intent_ref: intentRef,
          product_date: input.productDate,
          result_version: manifest.resultVersion,
        },
      });
      await attachCommandResponse(client, input, intentRef);
      return {
        status: "ACCEPTED",
        value: intentView({
          intentRef,
          productDate: input.productDate,
          publishedResultRef: null,
          revision: 1,
          state: "QUEUED",
          updatedAt: input.now,
        }),
      };
    });
  }

  public async getIntent(input: {
    readonly accountId: string;
    readonly intentRef: string;
  }): Promise<GenerationIntentQueryResult> {
    return this.#transaction(async (client) => {
      const intent = await readIntentByRef(
        client,
        input.accountId,
        input.intentRef,
      );
      if (intent === undefined) {
        return { status: "NOT_FOUND" };
      }
      await lockAccountGuard(client, input.accountId);
      const guard = await resolveGenerationGuardSnapshot(
        client,
        input.accountId,
        intent.productDate,
      );
      return guard.status === "ALLOWED"
        ? { status: "FOUND", value: intentView(intent) }
        : { status: guard.status };
    });
  }

  public async getByDate(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<HistoryDayQueryResult> {
    const source = await this.#transaction((client) =>
      readHistorySource(client, input.accountId, input.productDate),
    );
    if (source.status !== "FOUND") {
      return source;
    }
    let content = await this.#cache.get(source.value.cacheIdentity);
    if (
      content === undefined ||
      content.result_id !== source.value.row.resultId
    ) {
      content = projectClientDailyContentViewV1(source.value.publishedResult);
    }
    const currentGuard = await this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      return resolveGenerationGuardSnapshot(
        client,
        input.accountId,
        input.productDate,
      );
    });
    if (!sameGenerationGuardSnapshot(currentGuard, source.value.guard)) {
      return {
        status:
          currentGuard.status === "ALLOWED"
            ? "STATE_PRECONDITION_FAILED"
            : currentGuard.status,
      };
    }
    await this.#cache.set(source.value.cacheIdentity, content);
    return {
      status: "FOUND",
      value: HistoryDayViewSchema.parse({
        product_date: source.value.row.productDate,
        checkin: checkinView(source.value.checkin, "CLOSED"),
        content,
        interaction: interactionView(source.value.row),
      }),
    };
  }

  public async getToday(input: {
    readonly accountId: string;
    readonly productDate: string;
  }): Promise<TodayQueryResult> {
    const source = await this.#transaction((client) =>
      readTodaySource(client, input.accountId, input.productDate),
    );
    if (source.status !== "FOUND") {
      return source;
    }
    let content = await this.#cache.get(source.value.cacheIdentity);
    if (
      content === undefined ||
      content.result_id !== source.value.row.resultId
    ) {
      content = projectClientDailyContentViewV1(source.value.publishedResult);
    }
    const currentGuard = await this.#transaction(async (client) => {
      await lockAccountGuard(client, input.accountId);
      return resolveGenerationGuardSnapshot(
        client,
        input.accountId,
        input.productDate,
      );
    });
    if (!sameGenerationGuardSnapshot(currentGuard, source.value.guard)) {
      return {
        status:
          currentGuard.status === "ALLOWED"
            ? "STATE_PRECONDITION_FAILED"
            : currentGuard.status,
      };
    }
    await this.#cache.set(source.value.cacheIdentity, content);
    const row = source.value.row;
    if (row.helpfulnessRating !== null && row.helpfulnessRevision === null) {
      throw new Error("DAILY_HELPFULNESS_REVISION_MISSING");
    }
    const relationshipCount = row.relationshipCount;
    const view = TodayViewSchema.parse({
      content,
      interaction: interactionView(row),
      relationship: {
        stage:
          relationshipCount === 0
            ? "BEFORE_FIRST_MEETING"
            : relationshipCount < 3
              ? "NEWLY_MET"
              : relationshipCount < 7
                ? "BECOMING_FAMILIAR"
                : "FIRST_WEEK_RECORDED",
        encounter_day_count: relationshipCount,
        ...(relationshipNodeToken(relationshipCount) === undefined
          ? {}
          : { display_token: relationshipNodeToken(relationshipCount) }),
      },
    });
    return { status: "FOUND", value: view };
  }

  public async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await Promise.all([this.#pool.end(), this.#cache.close()]);
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
      throw new Error("DAILY_GENERATION_STORE_CLOSED");
    }
  }
}

export const UNAVAILABLE_DAILY_GENERATION_STORE: DailyGenerationStore =
  Object.freeze({
    async close() {},
    async getByDate() {
      throw new Error("DAILY_GENERATION_STORE_UNAVAILABLE");
    },
    async getIntent() {
      throw new Error("DAILY_GENERATION_STORE_UNAVAILABLE");
    },
    async getToday() {
      throw new Error("DAILY_GENERATION_STORE_UNAVAILABLE");
    },
    async start() {
      throw new Error("DAILY_GENERATION_STORE_UNAVAILABLE");
    },
  });

async function readTodaySource(
  client: PoolClient,
  accountId: string,
  productDate: string,
): Promise<
  | { readonly status: "FOUND"; readonly value: TodaySource }
  | Exclude<TodayQueryResult, { readonly status: "FOUND" }>
> {
  await lockAccountGuard(client, accountId);
  const guard = await resolveGenerationGuardSnapshot(
    client,
    accountId,
    productDate,
  );
  if (guard.status !== "ALLOWED") {
    return { status: guard.status };
  }
  const result = await client.query<TodayRow>(
    `SELECT result.id AS "resultId", result."inputSnapshotId",
            result."productDate"::text AS "productDate", result."resultVersion",
            result."schemaVersion", result."generatedAt", result."ruleFactsPayload",
            result."expressionCorePayload", result."provenancePayload",
            result."validationReceipt", result."resultFingerprint",
            visibility.revision AS "visibilityRevision",
            visibility."sourceFingerprint" AS "visibilitySourceFingerprint",
            interaction."aggregateRevision", interaction."updatedAt",
            task."taskDefinitionId", task.revision AS "taskRevision",
            task.status::text AS "taskStatus",
            helpfulness.rating::text AS "helpfulnessRating",
            helpfulness.revision AS "helpfulnessRevision",
            (light.id IS NOT NULL) AS "isLit",
            COALESCE(relationship.count, 0)::int AS "relationshipCount"
       FROM daily_energy.app_published_daily_result result
       JOIN daily_energy.app_published_result_visibility visibility
         ON visibility."resultId"=result.id AND visibility.state='AVAILABLE'
       JOIN daily_energy.app_daily_interaction interaction
         ON interaction."resultId"=result.id
       JOIN daily_energy.app_daily_task_state task
         ON task."interactionId"=interaction.id
       LEFT JOIN daily_energy.app_daily_helpfulness_record helpfulness
         ON helpfulness."interactionId"=interaction.id
       LEFT JOIN daily_energy.app_daily_light_fact light
         ON light."interactionId"=interaction.id
       LEFT JOIN LATERAL (
         SELECT count(link.id)::int AS count
           FROM daily_energy.app_relationship_cycle cycle
           LEFT JOIN daily_energy.app_relationship_encounter_link link
             ON link."cycleId"=cycle.id
           LEFT JOIN daily_energy.app_daily_light_fact relationship_light
             ON relationship_light.id=link."sourceLightId"
            AND relationship_light."sourceValidityRevision"=link."sourceValidityRevision"
          WHERE cycle."accountId"=result."accountId"
            AND cycle."activeSlot" IS TRUE
            AND cycle.state='ACTIVE'
            AND (link.id IS NULL OR relationship_light.id IS NOT NULL)
          GROUP BY cycle.id
          LIMIT 1
       ) relationship ON TRUE
      WHERE result."accountId"=$1::uuid AND result."productDate"=$2::date
      LIMIT 1`,
    [accountId, productDate],
  );
  const row = result.rows[0];
  if (row === undefined) {
    const intent = await readIntentForDate(client, accountId, productDate);
    if (intent === undefined) {
      return { status: "NOT_FOUND" };
    }
    if (intent.state === "TERMINAL_FAILED" || intent.state === "CANCELLED") {
      return { status: "GENERATION_FAILED_TERMINAL" };
    }
    if (intent.state === "RETRYABLE_FAILED") {
      return { status: "GENERATION_FAILED_RETRYABLE" };
    }
    return { status: "GENERATION_PENDING" };
  }
  const publishedResult = PublishedDailyResultSchema.parse({
    contract: "daily-content",
    schema_version: row.schemaVersion,
    identity: {
      result_id: row.resultId,
      user_ref: accountId,
      product_date: row.productDate,
      result_version: row.resultVersion,
      generated_at: row.generatedAt.toISOString(),
    },
    input_snapshot_ref: row.inputSnapshotId,
    facts: row.ruleFactsPayload,
    expression: row.expressionCorePayload,
    source_dependencies: [],
    privacy_fallbacks: {},
    provenance: row.provenancePayload,
    validation: row.validationReceipt,
  });
  const expectedFingerprint = dailyResultFingerprintV1(publishedResult);
  if (
    row.resultFingerprint.length !== expectedFingerprint.length ||
    !timingSafeEqual(row.resultFingerprint, expectedFingerprint)
  ) {
    throw new Error("DAILY_RESULT_FINGERPRINT_MISMATCH");
  }
  return {
    status: "FOUND",
    value: {
      cacheIdentity: {
        accountId,
        projectionVersion: "daily-content-view-v1",
        resultFingerprintHex: row.resultFingerprint.toString("hex"),
        resultId: row.resultId,
        sourceFingerprintHex: row.visibilitySourceFingerprint.toString("hex"),
        visibilityRevision: row.visibilityRevision,
      },
      guard,
      publishedResult,
      row,
    },
  };
}

function relationshipNodeToken(count: number): string | undefined {
  switch (count) {
    case 1:
      return "FIRST_MEETING";
    case 3:
      return "STYLE_CALIBRATION_AVAILABLE";
    case 4:
      return "IMPORTANT_MATTER_INVITE_AVAILABLE";
    case 7:
      return "FIRST_SEVEN_DAY_REVIEW_AVAILABLE";
    default:
      return undefined;
  }
}

async function readHistorySource(
  client: PoolClient,
  accountId: string,
  productDate: string,
): Promise<
  | { readonly status: "FOUND"; readonly value: HistorySource }
  | Exclude<HistoryDayQueryResult, { readonly status: "FOUND" }>
> {
  const source = await readTodaySource(client, accountId, productDate);
  if (source.status !== "FOUND") {
    switch (source.status) {
      case "GENERATION_FAILED_RETRYABLE":
      case "GENERATION_FAILED_TERMINAL":
      case "GENERATION_PENDING":
        return { status: "NOT_FOUND" };
      case "NOT_FOUND":
        return { status: "NOT_FOUND" };
      case "ACCOUNT_DELETED":
      case "ACCOUNT_DELETING":
      case "ACCOUNT_RESTRICTED":
      case "CONSENT_REQUIRED":
      case "ONBOARDING_REQUIRED":
      case "SAFETY_BLOCKED":
      case "STATE_PRECONDITION_FAILED":
        return { status: source.status };
    }
  }
  const checkin = await readCheckin(client, accountId, productDate);
  if (checkin === undefined) {
    throw new Error("HISTORY_CHECKIN_MISSING");
  }
  return {
    status: "FOUND",
    value: { ...source.value, checkin },
  };
}

async function readCheckin(
  client: PoolClient,
  accountId: string,
  productDate: string,
  lock = false,
): Promise<CheckinRow | undefined> {
  return (
    await client.query<CheckinRow>(
      `SELECT id AS "checkinRef","productDate"::text AS "productDate",
              revision,mood::text AS mood,energy::text AS energy,
              sleep::text AS sleep,"updatedAt"
         FROM daily_energy.app_morning_checkin
        WHERE "accountId"=$1::uuid AND "productDate"=$2::date
        LIMIT 1${lock ? " FOR UPDATE" : ""}`,
      [accountId, productDate],
    )
  ).rows[0];
}

async function readIntentByRef(
  client: PoolClient,
  accountId: string,
  intentRef: string,
): Promise<IntentRow | undefined> {
  return (
    await client.query<IntentRow>(
      `${intentSelect()}
        WHERE intent.id=$1::uuid AND intent."accountId"=$2::uuid
        LIMIT 1`,
      [intentRef, accountId],
    )
  ).rows[0];
}

async function readIntentForDate(
  client: PoolClient,
  accountId: string,
  productDate: string,
): Promise<IntentRow | undefined> {
  return (
    await client.query<IntentRow>(
      `${intentSelect()}
        WHERE intent."accountId"=$1::uuid
          AND intent."targetProductDate"=$2::date
        LIMIT 1`,
      [accountId, productDate],
    )
  ).rows[0];
}

async function readIntentForReceipt(
  client: PoolClient,
  accountId: string,
  productDate: string,
  responseRef: string | null,
): Promise<IntentRow> {
  const intent =
    responseRef === null
      ? await readIntentForDate(client, accountId, productDate)
      : await readIntentByRef(client, accountId, responseRef);
  if (intent === undefined) {
    throw new Error("GENERATION_COMMAND_RESPONSE_MISSING");
  }
  return intent;
}

function intentSelect(): string {
  return `SELECT intent.id AS "intentRef",
                 intent."targetProductDate"::text AS "productDate",
                 intent.revision, intent.state::text AS state,
                 intent."publishedResultRef", intent."updatedAt"
            FROM daily_energy.app_generation_intent intent`;
}

function intentView(row: IntentRow): GenerationIntentView {
  const running = [
    "QUEUED",
    "RUNNING",
    "FALLBACK_RUNNING",
    "RETRYABLE_FAILED",
  ].includes(row.state);
  return GenerationIntentViewSchema.parse({
    intent_ref: row.intentRef,
    product_date: row.productDate,
    status: row.state,
    ...(row.publishedResultRef === null
      ? {}
      : { result_ref: row.publishedResultRef }),
    ...(running ? { retry_after_seconds: 2 } : {}),
    updated_at: row.updatedAt.toISOString(),
  });
}

function checkinView(
  row: CheckinRow,
  writeWindow: "OPEN" | "CLOSED" = "OPEN",
): CheckinView {
  return CheckinViewSchema.parse({
    checkin_ref: row.checkinRef,
    product_date: row.productDate,
    revision: row.revision,
    mood: row.mood,
    energy: row.energy,
    sleep: row.sleep,
    write_window: writeWindow,
    updated_at: row.updatedAt.toISOString(),
  });
}

function interactionView(row: TodayRow) {
  if (row.helpfulnessRating !== null && row.helpfulnessRevision === null) {
    throw new Error("DAILY_HELPFULNESS_REVISION_MISSING");
  }
  return {
    contract: "daily-interaction-state" as const,
    schema_version: "1.0.0",
    result_id: row.resultId,
    product_date: row.productDate,
    is_lit: row.isLit,
    task: {
      task_id: row.taskDefinitionId,
      revision: row.taskRevision,
      status: row.taskStatus,
    },
    helpfulness:
      row.helpfulnessRating === null
        ? ({ revision: 0, rating: "UNRATED" } as const)
        : {
            revision: row.helpfulnessRevision!,
            rating: row.helpfulnessRating,
          },
    updated_at: row.updatedAt.toISOString(),
  };
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
  },
): Promise<CommandClaim> {
  const commandRef = commandRefStorageUuid(input.commandRef);
  const inserted = await client.query(
    `INSERT INTO daily_energy.runtime_command_receipt
      (id,"accountId","commandRef","operationCode","targetScope",
       "targetKey","productDatePolicyVersion","normalizedPayloadFingerprint",
       "acceptedAt","retentionPolicyVersion","retentionScope",
       "retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),$1,$2,'GENERATION_START','DAY',$3,$4,$5,
             $6::timestamptz,$7,'RUNTIME',$6::timestamptz,$8::timestamptz)
     ON CONFLICT ("accountId","commandRef") DO NOTHING`,
    [
      input.accountId,
      commandRef,
      input.productDate,
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
  const existing = await client.query<ReceiptRow>(
    `SELECT "operationCode","targetKey","productDatePolicyVersion",
            "normalizedPayloadFingerprint","responseRef"
       FROM daily_energy.runtime_command_receipt
      WHERE "accountId"=$1::uuid AND "commandRef"=$2::uuid
      FOR UPDATE`,
    [input.accountId, commandRef],
  );
  const row = existing.rows[0];
  if (row === undefined) {
    throw new Error("GENERATION_COMMAND_RECEIPT_MISSING");
  }
  return row.operationCode === "GENERATION_START" &&
    row.targetKey === input.productDate &&
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
  intentRef: string,
): Promise<void> {
  await client.query(
    `UPDATE daily_energy.runtime_command_receipt
        SET "responseRef"=$1::uuid,"terminalAt"=$2::timestamptz
      WHERE "accountId"=$3::uuid AND "commandRef"=$4::uuid`,
    [
      intentRef,
      input.now,
      input.accountId,
      commandRefStorageUuid(input.commandRef),
    ],
  );
}

async function abandonCommandClaim(
  client: PoolClient,
  input: {
    readonly accountId: string;
    readonly commandRef: string;
  },
): Promise<void> {
  await client.query(
    `DELETE FROM daily_energy.runtime_command_receipt
      WHERE "accountId"=$1::uuid AND "commandRef"=$2::uuid
        AND "responseRef" IS NULL`,
    [input.accountId, commandRefStorageUuid(input.commandRef)],
  );
}

async function selectActiveManifest(
  client: PoolClient,
  acceptedAt: Date,
): Promise<ReturnType<typeof verifyGenerationManifestRecord> | undefined> {
  const rows = (
    await client.query<ManifestRow>(
      `SELECT id AS "manifestRef",version,"compatibilityPayload",fingerprint,
              "activatedAt","createdAt"
         FROM daily_energy.system_version_catalog_entry
        WHERE "catalogType"='GENERATION_MANIFEST' AND state='ACTIVE'
          AND "activatedAt" IS NOT NULL
          AND "activatedAt" <= $1::timestamptz
        ORDER BY "activatedAt" DESC,"createdAt" DESC,version ASC
        LIMIT 2`,
      [acceptedAt],
    )
  ).rows;
  if (rows.length === 0) {
    return undefined;
  }
  if (
    rows.length === 2 &&
    rows[0]!.activatedAt.getTime() === rows[1]!.activatedAt.getTime() &&
    rows[0]!.createdAt.getTime() === rows[1]!.createdAt.getTime()
  ) {
    throw new Error("GENERATION_MANIFEST_ORDER_INVALID");
  }
  const row = rows[0]!;
  const record: GenerationManifestRecord = {
    activatedAt: row.activatedAt,
    fingerprintHex: parseManifestFingerprint(row.fingerprint),
    manifest: row.compatibilityPayload as GenerationManifestRecord["manifest"],
    manifestRef: row.manifestRef,
  };
  return verifyGenerationManifestRecord(record);
}

async function insertOutbox(
  client: PoolClient,
  input: {
    readonly aggregateRef: string;
    readonly aggregateRevision: number;
    readonly eventType: string;
    readonly guard: GenerationGuardSnapshotV1;
    readonly now: Date;
    readonly payload: Readonly<Record<string, unknown>>;
  },
): Promise<void> {
  const eventId = randomUUID();
  const idempotencyKey = createHash("sha256")
    .update(
      `c008:${input.eventType}:${input.aggregateRef}:${input.aggregateRevision}`,
    )
    .digest();
  await client.query(
    `INSERT INTO daily_energy.runtime_outbox_event
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
       state,"availableAt","attemptCount","createdAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt","expiresAt")
     VALUES ($1,'GenerationIntent',$2,$3,$4,'v1',$5,$6::jsonb,$7::jsonb,
             'PENDING',$8::timestamptz,0,$8::timestamptz,$9,'RUNTIME',
             $8::timestamptz,$10::timestamptz)`,
    [
      eventId,
      input.aggregateRef,
      input.aggregateRevision,
      input.eventType,
      idempotencyKey,
      JSON.stringify(input.payload),
      JSON.stringify({
        deletion: input.guard.deletionEpoch.toString(),
        safety: input.guard.safetyEpoch.toString(),
      }),
      input.now,
      RETENTION_POLICY_VERSION,
      new Date(input.now.getTime() + RUNTIME_TTL_MS),
    ],
  );
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
    throw new Error("DAILY_GENERATION_DB_ROLE_MISMATCH");
  }
}
