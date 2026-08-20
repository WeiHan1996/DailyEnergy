import { Pool, type PoolClient } from "pg";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export const CURRENT_NECESSARY_CONSENT_NOTICE_VERSION = "necessary-consent-v1";

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const PROFILE_SCHEMA_VERSION = "profile-v1";
const NOTIFICATION_RULE_VERSION = "notification-rule-v1";
const CONSENT_LOGICAL_INTENT = "ORDINARY_USE";
const COMMAND_RECEIPT_TTL_DAYS = 7;
const PROFILE_NAME_KEY_MAX_AGE_HOURS = 72;
const PROFILE_REVISION_MAX_AGE_DAYS = 30;
const PLATFORM_PERMISSION_MAX_AGE_DAYS = 35;
const CONSENT_LOCK_SEED = 20_002;

export type StoredExpressionStyle =
  "BALANCED" | "GENTLE" | "LIGHT_HUMOR" | "CLEAR_DIRECT";
export type StoredPermission = "UNKNOWN" | "GRANTED" | "DENIED" | "REVOKED";

export interface ProtectedPreferredName {
  readonly ciphertext: Buffer;
  readonly keyVersion: string;
}

export interface StoredConsentView {
  readonly acceptedAt?: Date;
  readonly noticeVersion: string;
  readonly state: "MISSING" | "ACCEPTED" | "WITHDRAWN";
}

export interface StoredProfileView {
  readonly expressionStyle: StoredExpressionStyle;
  readonly onboardingCompleted: boolean;
  readonly preferredName?: ProtectedPreferredName;
  readonly revision: number;
  readonly updatedAt: Date;
}

export interface StoredMemoryPreferencesView {
  readonly dailyUseEnabled: boolean;
  readonly masterEnabled: boolean;
  readonly revision: number;
  readonly updatedAt: Date;
  readonly weeklyUseEnabled: boolean;
}

export interface StoredNotificationSettingsView {
  readonly eveningEnabled: boolean;
  readonly morningEnabled: boolean;
  readonly observedPermission: StoredPermission;
  readonly revision: number;
  readonly updatedAt: Date;
}

export type StoreMutation<T> =
  | { readonly status: "ACCEPTED"; readonly value: T }
  | { readonly status: "DUPLICATE"; readonly value: T }
  | {
      readonly status:
        | "ACCOUNT_BLOCKED"
        | "CONSENT_REQUIRED"
        | "IDEMPOTENCY_CONFLICT"
        | "ONBOARDING_REQUIRED"
        | "REVISION_CONFLICT";
      readonly current?: T;
    };

interface CommandInput {
  readonly accountId: string;
  readonly commandRef: string;
  readonly normalizedPayloadFingerprint: Buffer;
  readonly now: Date;
}

export interface ConsentProfileStore {
  acceptConsent(
    input: CommandInput & { readonly noticeVersion: string },
  ): Promise<StoreMutation<StoredConsentView>>;
  withdrawConsent(
    input: CommandInput & { readonly noticeVersion: string },
  ): Promise<StoreMutation<StoredConsentView>>;
  getConsent(accountId: string): Promise<StoredConsentView>;
  completeOnboarding(
    input: CommandInput & {
      readonly expressionStyle: StoredExpressionStyle;
      readonly preferredName?: ProtectedPreferredName;
    },
  ): Promise<StoreMutation<StoredProfileView>>;
  getProfile(accountId: string): Promise<StoredProfileView | undefined>;
  updateProfile(
    input: CommandInput & {
      readonly expectedRevision: number;
      readonly expressionStyle?: StoredExpressionStyle;
      readonly preferredName?: ProtectedPreferredName | null;
      readonly operationCode: "PROFILE_UPDATE" | "STYLE_CALIBRATION";
    },
  ): Promise<StoreMutation<StoredProfileView>>;
  getMemoryPreferences(
    accountId: string,
  ): Promise<StoredMemoryPreferencesView | undefined>;
  updateMemoryPreferences(
    input: CommandInput & {
      readonly dailyUseEnabled: boolean;
      readonly expectedRevision: number;
      readonly masterEnabled: boolean;
      readonly requiresConsent: boolean;
      readonly weeklyUseEnabled: boolean;
    },
  ): Promise<StoreMutation<StoredMemoryPreferencesView>>;
  getNotificationSettings(
    accountId: string,
    deviceRef: string,
    now: Date,
  ): Promise<StoredNotificationSettingsView | undefined>;
  updateNotificationSettings(
    input: CommandInput & {
      readonly deviceRef: string;
      readonly eveningEnabled: boolean;
      readonly expectedRevision: number;
      readonly morningEnabled: boolean;
      readonly requiresConsent: boolean;
    },
  ): Promise<StoreMutation<StoredNotificationSettingsView>>;
  syncNotificationPermission(
    input: CommandInput & {
      readonly deviceRef: string;
      readonly observedAt: Date;
      readonly observedPermission: StoredPermission;
    },
  ): Promise<StoreMutation<StoredNotificationSettingsView>>;
  close(): Promise<void>;
}

export interface PostgresConsentProfileStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface ConsentRow {
  readonly acceptedAt: Date | null;
  readonly id: string;
  readonly noticeVersion: string;
  readonly state: "ACCEPTED" | "WITHDRAWN";
}

interface ProfileRow {
  readonly expressionStyle: StoredExpressionStyle;
  readonly onboardingCompleted: boolean;
  readonly preferredNameCiphertext: Buffer | null;
  readonly preferredNameKeyVersion: string | null;
  readonly profileRef: string;
  readonly revision: number;
  readonly revisionRef: string | null;
  readonly updatedAt: Date;
}

interface CommandReceiptRow {
  readonly normalizedPayloadFingerprint: Buffer;
  readonly operationCode: string;
  readonly responseRef: string | null;
  readonly targetKey: string;
}

type CommandClaim =
  | { readonly status: "NEW" }
  | { readonly status: "DUPLICATE"; readonly responseRef: string | null }
  | { readonly status: "CONFLICT" };

export class PostgresConsentProfileStore implements ConsentProfileStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresConsentProfileStoreConfig,
  ): Promise<PostgresConsentProfileStore> {
    const roleProbe = createClosedDatabaseFactory(
      {
        databaseRole: config.expectedDatabaseRole,
        defaultConnectionLimit: 1,
        profile: "api",
      },
      prismaRuntime,
    );
    const verifiedConnection = await roleProbe.connect({
      applicationName: `${config.applicationName}:role-probe`,
      connectionLimit: 1,
      connectionString: config.connectionString,
    });
    await verifiedConnection.disconnect();

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
      if (
        !row ||
        row.currentUser !== row.sessionUser ||
        row.expectedMember !== true
      ) {
        throw new Error("CONSENT_PROFILE_DB_ROLE_MISMATCH");
      }
    } catch {
      await pool.end();
      throw new Error("CONSENT_PROFILE_DB_ROLE_MISMATCH");
    }
    return new PostgresConsentProfileStore(pool);
  }

  public async getConsent(accountId: string): Promise<StoredConsentView> {
    this.#assertOpen();
    return consentView(await readCurrentConsent(this.#pool, accountId));
  }

  public async acceptConsent(
    input: CommandInput & { readonly noticeVersion: string },
  ): Promise<StoreMutation<StoredConsentView>> {
    return this.#transaction(async (client) => {
      if (!(await accountIsActive(client, input.accountId))) {
        return { status: "ACCOUNT_BLOCKED" };
      }
      await lockConsentOwner(client, input.accountId);
      const claim = await claimCommand(client, {
        ...input,
        operationCode: "CONSENT_ACCEPT",
        targetKey: input.noticeVersion,
      });
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        return {
          status: "DUPLICATE",
          value: consentView(await readCurrentConsent(client, input.accountId)),
        };
      }

      const created = await client.query<{ id: string }>(
        `INSERT INTO daily_energy.app_necessary_consent_record
           (id, "accountId", "noticeVersion", "logicalIntent", status,
            "commandRef", "acceptedAt", "createdAt", "retentionPolicyVersion",
            "retentionScope", "retentionAnchorAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'ACCEPTED', $4,
                 $5::timestamptz,
                 GREATEST(
                   $5::timestamptz,
                   COALESCE(
                     (SELECT max("createdAt") + interval '1 millisecond'
                        FROM daily_energy.app_necessary_consent_record
                       WHERE "accountId" = $1),
                     $5::timestamptz
                   )
                 ),
                 $6, 'ACCOUNT', $5::timestamptz)
         RETURNING id`,
        [
          input.accountId,
          input.noticeVersion,
          CONSENT_LOGICAL_INTENT,
          commandRefStorageUuid(input.commandRef),
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      const consentRef = requiredRef(
        created.rows[0]?.id,
        "CONSENT_CREATE_FAILED",
      );
      await expireReplacedConsent(
        client,
        input.accountId,
        consentRef,
        input.now,
      );
      await attachResponseRef(client, input, consentRef);
      return {
        status: "ACCEPTED",
        value: {
          acceptedAt: input.now,
          noticeVersion: input.noticeVersion,
          state: "ACCEPTED",
        },
      };
    });
  }

  public async withdrawConsent(
    input: CommandInput & { readonly noticeVersion: string },
  ): Promise<StoreMutation<StoredConsentView>> {
    return this.#transaction(async (client) => {
      if (!(await accountIsActive(client, input.accountId))) {
        return { status: "ACCOUNT_BLOCKED" };
      }
      await lockConsentOwner(client, input.accountId);
      const claim = await claimCommand(client, {
        ...input,
        operationCode: "CONSENT_WITHDRAW",
        targetKey: input.noticeVersion,
      });
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        return {
          status: "DUPLICATE",
          value: consentView(await readCurrentConsent(client, input.accountId)),
        };
      }

      const current = await readCurrentConsent(client, input.accountId, true);
      if (current?.state !== "ACCEPTED" || current.acceptedAt === null) {
        return {
          status: "ACCEPTED",
          value: consentView(current),
        };
      }
      const created = await client.query<{ id: string }>(
        `INSERT INTO daily_energy.app_necessary_consent_record
           (id, "accountId", "noticeVersion", "logicalIntent", status,
            "commandRef", "acceptedAt", "withdrawnAt", "createdAt",
            "retentionPolicyVersion", "retentionScope", "retentionAnchorAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'WITHDRAWN', $4,
                 $5::timestamptz, $6::timestamptz,
                 GREATEST(
                   $6::timestamptz,
                   COALESCE(
                     (SELECT max("createdAt") + interval '1 millisecond'
                        FROM daily_energy.app_necessary_consent_record
                       WHERE "accountId" = $1),
                     $6::timestamptz
                   )
                 ),
                 $7, 'ACCOUNT', $6::timestamptz)
         RETURNING id`,
        [
          input.accountId,
          input.noticeVersion,
          CONSENT_LOGICAL_INTENT,
          commandRefStorageUuid(input.commandRef),
          current.acceptedAt,
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      const consentRef = requiredRef(
        created.rows[0]?.id,
        "CONSENT_WITHDRAW_FAILED",
      );
      await expireReplacedConsent(
        client,
        input.accountId,
        consentRef,
        input.now,
      );
      await attachResponseRef(client, input, consentRef);
      return {
        status: "ACCEPTED",
        value: {
          acceptedAt: current.acceptedAt,
          noticeVersion: input.noticeVersion,
          state: "WITHDRAWN",
        },
      };
    });
  }

  public async getProfile(
    accountId: string,
  ): Promise<StoredProfileView | undefined> {
    this.#assertOpen();
    return profileView(await readCurrentProfile(this.#pool, accountId));
  }

  public async completeOnboarding(
    input: CommandInput & {
      readonly expressionStyle: StoredExpressionStyle;
      readonly preferredName?: ProtectedPreferredName;
    },
  ): Promise<StoreMutation<StoredProfileView>> {
    return this.#transaction(async (client) => {
      if (!(await accountIsActive(client, input.accountId))) {
        return { status: "ACCOUNT_BLOCKED" };
      }
      const claim = await claimCommand(client, {
        ...input,
        operationCode: "ONBOARDING_COMPLETE",
        targetKey: "profile",
      });
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        const duplicate =
          claim.responseRef === null
            ? await readCurrentProfile(client, input.accountId)
            : await readProfileRevision(client, claim.responseRef);
        const value = profileView(duplicate);
        if (value === undefined) {
          throw new Error("ONBOARDING_RECEIPT_TARGET_MISSING");
        }
        return { status: "DUPLICATE", value };
      }
      const consent = await readCurrentConsent(client, input.accountId, true);
      if (consent?.state !== "ACCEPTED") {
        return { status: "CONSENT_REQUIRED" };
      }

      const existing = await readCurrentProfile(client, input.accountId, true);
      if (existing !== undefined) {
        if (!existing.onboardingCompleted || existing.revisionRef === null) {
          throw new Error("ONBOARDING_PROFILE_STATE_INVALID");
        }
        await attachResponseRef(client, input, existing.revisionRef);
        return { status: "ACCEPTED", value: profileView(existing)! };
      }

      const profile = await client.query<{ id: string }>(
        `INSERT INTO daily_energy.app_user_profile
           (id, "accountId", revision, "preferredNameCiphertext",
            "preferredNameKeyVersion", "expressionStyle", "profileSchemaVersion",
            "createdAt", "updatedAt", "retentionPolicyVersion", "retentionScope",
            "retentionAnchorAt")
         VALUES (gen_random_uuid(), $1, 1, $2, $3, $4, $5,
                 $6::timestamptz, $6::timestamptz, $7, 'ACCOUNT', $6::timestamptz)
         RETURNING id`,
        [
          input.accountId,
          input.preferredName?.ciphertext ?? null,
          input.preferredName?.keyVersion ?? null,
          input.expressionStyle,
          PROFILE_SCHEMA_VERSION,
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      const profileRef = requiredRef(
        profile.rows[0]?.id,
        "PROFILE_CREATE_FAILED",
      );
      const revisionRef = await insertProfileRevision(client, {
        changedFieldNames: [
          ...(input.preferredName === undefined ? [] : ["preferredName"]),
          "expressionStyle",
        ],
        commandRef: input.commandRef,
        expressionStyle: input.expressionStyle,
        now: input.now,
        ...(input.preferredName === undefined
          ? {}
          : { preferredName: input.preferredName }),
        profileRef,
        revision: 1,
      });
      await client.query(
        `INSERT INTO daily_energy.app_onboarding_completion
           (id, "accountId", "profileRevision", "consentRecordId",
            "completionCommandRef", "completedAt", "retentionPolicyVersion",
            "retentionScope", "retentionAnchorAt")
         VALUES (gen_random_uuid(), $1, 1, $2, $3, $4::timestamptz,
                 $5, 'ACCOUNT', $4::timestamptz)`,
        [
          input.accountId,
          consent.id,
          commandRefStorageUuid(input.commandRef),
          input.now,
          RETENTION_POLICY_VERSION,
        ],
      );
      await insertDefaultPreferences(client, input.accountId, input.now);
      await attachResponseRef(client, input, revisionRef);
      return {
        status: "ACCEPTED",
        value: {
          expressionStyle: input.expressionStyle,
          onboardingCompleted: true,
          ...(input.preferredName === undefined
            ? {}
            : { preferredName: input.preferredName }),
          revision: 1,
          updatedAt: input.now,
        },
      };
    });
  }

  public async updateProfile(
    input: CommandInput & {
      readonly expectedRevision: number;
      readonly expressionStyle?: StoredExpressionStyle;
      readonly preferredName?: ProtectedPreferredName | null;
      readonly operationCode: "PROFILE_UPDATE" | "STYLE_CALIBRATION";
    },
  ): Promise<StoreMutation<StoredProfileView>> {
    return this.#transaction(async (client) => {
      if (!(await accountIsActive(client, input.accountId))) {
        return { status: "ACCOUNT_BLOCKED" };
      }
      const claim = await claimCommand(client, {
        ...input,
        operationCode: input.operationCode,
        targetKey: "profile",
      });
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        const duplicate =
          claim.responseRef === null
            ? await readCurrentProfile(client, input.accountId)
            : await readProfileRevision(client, claim.responseRef);
        const value = profileView(duplicate);
        if (value === undefined) {
          throw new Error("PROFILE_RECEIPT_TARGET_MISSING");
        }
        return { status: "DUPLICATE", value };
      }
      const consent = await readCurrentConsent(client, input.accountId, true);
      if (consent?.state !== "ACCEPTED") {
        return { status: "CONSENT_REQUIRED" };
      }
      const current = await readCurrentProfile(client, input.accountId, true);
      if (current === undefined || !current.onboardingCompleted) {
        return { status: "ONBOARDING_REQUIRED" };
      }
      const currentView = profileView(current)!;
      if (current.revision !== input.expectedRevision) {
        return { status: "REVISION_CONFLICT", current: currentView };
      }

      const nextPreferredName =
        input.preferredName === undefined
          ? current.preferredNameCiphertext === null ||
            current.preferredNameKeyVersion === null
            ? undefined
            : {
                ciphertext: current.preferredNameCiphertext,
                keyVersion: current.preferredNameKeyVersion,
              }
          : input.preferredName === null
            ? undefined
            : input.preferredName;
      const nextStyle = input.expressionStyle ?? current.expressionStyle;
      const changedFieldNames = [
        ...(input.preferredName === undefined ? [] : ["preferredName"]),
        ...(input.expressionStyle === undefined ? [] : ["expressionStyle"]),
      ];
      const nextRevision = current.revision + 1;
      const updated = await client.query(
        `UPDATE daily_energy.app_user_profile
            SET revision = $1,
                "preferredNameCiphertext" = $2,
                "preferredNameKeyVersion" = $3,
                "expressionStyle" = $4,
                "updatedAt" = $5::timestamptz,
                "retentionAnchorAt" = $5::timestamptz
          WHERE "accountId" = $6 AND revision = $7`,
        [
          nextRevision,
          nextPreferredName?.ciphertext ?? null,
          nextPreferredName?.keyVersion ?? null,
          nextStyle,
          input.now,
          input.accountId,
          input.expectedRevision,
        ],
      );
      if (updated.rowCount !== 1) {
        const latest = profileView(
          await readCurrentProfile(client, input.accountId, true),
        );
        if (latest === undefined) {
          throw new Error("PROFILE_DISAPPEARED_DURING_CAS");
        }
        return { status: "REVISION_CONFLICT", current: latest };
      }
      await shortenReplacedProfileRevision(client, current, input.now);
      const revisionRef = await insertProfileRevision(client, {
        changedFieldNames,
        commandRef: input.commandRef,
        expressionStyle: nextStyle,
        now: input.now,
        ...(nextPreferredName === undefined
          ? {}
          : { preferredName: nextPreferredName }),
        profileRef: current.profileRef,
        revision: nextRevision,
      });
      await attachResponseRef(client, input, revisionRef);
      return {
        status: "ACCEPTED",
        value: {
          expressionStyle: nextStyle,
          onboardingCompleted: true,
          ...(nextPreferredName === undefined
            ? {}
            : { preferredName: nextPreferredName }),
          revision: nextRevision,
          updatedAt: input.now,
        },
      };
    });
  }

  public async getMemoryPreferences(
    accountId: string,
  ): Promise<StoredMemoryPreferencesView | undefined> {
    this.#assertOpen();
    return readMemoryPreferences(this.#pool, accountId);
  }

  public async updateMemoryPreferences(
    input: CommandInput & {
      readonly dailyUseEnabled: boolean;
      readonly expectedRevision: number;
      readonly masterEnabled: boolean;
      readonly requiresConsent: boolean;
      readonly weeklyUseEnabled: boolean;
    },
  ): Promise<StoreMutation<StoredMemoryPreferencesView>> {
    return this.#transaction(async (client) => {
      if (!(await accountIsActive(client, input.accountId))) {
        return { status: "ACCOUNT_BLOCKED" };
      }
      const claim = await claimCommand(client, {
        ...input,
        operationCode: "MEMORY_PREFERENCES_UPDATE",
        targetKey: "memory-preferences",
      });
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        const value = await readMemoryPreferences(client, input.accountId);
        if (value === undefined) {
          throw new Error("MEMORY_PREFERENCES_RECEIPT_TARGET_MISSING");
        }
        return { status: "DUPLICATE", value };
      }
      if (
        input.requiresConsent &&
        (await readCurrentConsent(client, input.accountId, true))?.state !==
          "ACCEPTED"
      ) {
        return { status: "CONSENT_REQUIRED" };
      }
      const current = await readMemoryPreferences(
        client,
        input.accountId,
        true,
      );
      if (current === undefined) {
        return { status: "ONBOARDING_REQUIRED" };
      }
      if (current.revision !== input.expectedRevision) {
        return { status: "REVISION_CONFLICT", current };
      }
      const nextRevision = current.revision + 1;
      const updated = await client.query(
        `UPDATE daily_energy.app_memory_master_preference
            SET "continuityEnabled" = $1,
                "dailyExpressionEnabled" = $2,
                "weeklySummaryEnabled" = $3,
                revision = $4,
                "updatedAt" = $5::timestamptz,
                "retentionAnchorAt" = $5::timestamptz
          WHERE "accountId" = $6 AND revision = $7`,
        [
          input.masterEnabled,
          input.dailyUseEnabled,
          input.weeklyUseEnabled,
          nextRevision,
          input.now,
          input.accountId,
          input.expectedRevision,
        ],
      );
      if (updated.rowCount !== 1) {
        const latest = await readMemoryPreferences(
          client,
          input.accountId,
          true,
        );
        if (latest === undefined) {
          throw new Error("MEMORY_PREFERENCES_DISAPPEARED_DURING_CAS");
        }
        return {
          status: "REVISION_CONFLICT",
          current: latest,
        };
      }
      await attachResponseRef(client, input, null);
      return {
        status: "ACCEPTED",
        value: {
          dailyUseEnabled: input.dailyUseEnabled,
          masterEnabled: input.masterEnabled,
          revision: nextRevision,
          updatedAt: input.now,
          weeklyUseEnabled: input.weeklyUseEnabled,
        },
      };
    });
  }

  public async getNotificationSettings(
    accountId: string,
    deviceRef: string,
    now: Date,
  ): Promise<StoredNotificationSettingsView | undefined> {
    this.#assertOpen();
    return readNotificationSettings(this.#pool, accountId, deviceRef, now);
  }

  public async updateNotificationSettings(
    input: CommandInput & {
      readonly deviceRef: string;
      readonly eveningEnabled: boolean;
      readonly expectedRevision: number;
      readonly morningEnabled: boolean;
      readonly requiresConsent: boolean;
    },
  ): Promise<StoreMutation<StoredNotificationSettingsView>> {
    return this.#transaction(async (client) => {
      if (!(await accountIsActive(client, input.accountId))) {
        return { status: "ACCOUNT_BLOCKED" };
      }
      const claim = await claimCommand(client, {
        ...input,
        operationCode: "NOTIFICATION_SETTINGS_UPDATE",
        targetKey: "notification-settings",
      });
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        const value = await readNotificationSettings(
          client,
          input.accountId,
          input.deviceRef,
          input.now,
        );
        if (value === undefined) {
          throw new Error("NOTIFICATION_RECEIPT_TARGET_MISSING");
        }
        return { status: "DUPLICATE", value };
      }
      if (
        input.requiresConsent &&
        (await readCurrentConsent(client, input.accountId, true))?.state !==
          "ACCEPTED"
      ) {
        return { status: "CONSENT_REQUIRED" };
      }
      const current = await readNotificationSettings(
        client,
        input.accountId,
        input.deviceRef,
        input.now,
        true,
      );
      if (current === undefined) {
        return { status: "ONBOARDING_REQUIRED" };
      }
      if (current.revision !== input.expectedRevision) {
        return { status: "REVISION_CONFLICT", current };
      }
      const nextRevision = current.revision + 1;
      const updated = await client.query(
        `UPDATE daily_energy.app_notification_preference
            SET enabled = CASE "notificationType"
                  WHEN 'MORNING' THEN $1
                  WHEN 'EVENING' THEN $2
                  ELSE enabled
                END,
                revision = $3,
                "updatedAt" = $4::timestamptz,
                "retentionAnchorAt" = $4::timestamptz
          WHERE "accountId" = $5
            AND "notificationType" IN ('MORNING', 'EVENING')
            AND revision = $6`,
        [
          input.morningEnabled,
          input.eveningEnabled,
          nextRevision,
          input.now,
          input.accountId,
          input.expectedRevision,
        ],
      );
      if (updated.rowCount !== 2) {
        const latest = await readNotificationSettings(
          client,
          input.accountId,
          input.deviceRef,
          input.now,
          true,
        );
        if (latest === undefined) {
          throw new Error("NOTIFICATION_PREFERENCES_DISAPPEARED_DURING_CAS");
        }
        return {
          status: "REVISION_CONFLICT",
          current: latest,
        };
      }
      await attachResponseRef(client, input, null);
      return {
        status: "ACCEPTED",
        value: {
          eveningEnabled: input.eveningEnabled,
          morningEnabled: input.morningEnabled,
          observedPermission: current.observedPermission,
          revision: nextRevision,
          updatedAt: input.now,
        },
      };
    });
  }

  public async syncNotificationPermission(
    input: CommandInput & {
      readonly deviceRef: string;
      readonly observedAt: Date;
      readonly observedPermission: StoredPermission;
    },
  ): Promise<StoreMutation<StoredNotificationSettingsView>> {
    return this.#transaction(async (client) => {
      if (!(await accountIsActive(client, input.accountId))) {
        return { status: "ACCOUNT_BLOCKED" };
      }
      const claim = await claimCommand(client, {
        ...input,
        operationCode: "NOTIFICATION_PERMISSION_SYNC",
        targetKey: `notification-permission:${input.deviceRef}`,
      });
      if (claim.status === "CONFLICT") {
        return { status: "IDEMPOTENCY_CONFLICT" };
      }
      if (claim.status === "DUPLICATE") {
        const value = await readNotificationSettings(
          client,
          input.accountId,
          input.deviceRef,
          input.now,
        );
        if (value === undefined) {
          return { status: "ONBOARDING_REQUIRED" };
        }
        return { status: "DUPLICATE", value };
      }
      if (
        (await readCurrentConsent(client, input.accountId, true))?.state !==
        "ACCEPTED"
      ) {
        return { status: "CONSENT_REQUIRED" };
      }
      const current = await readNotificationSettings(
        client,
        input.accountId,
        input.deviceRef,
        input.now,
      );
      if (current === undefined) {
        return { status: "ONBOARDING_REQUIRED" };
      }
      const snapshot = await client.query<{ id: string }>(
        `INSERT INTO daily_energy.app_platform_permission_snapshot
           (id, "accountId", "platformCode", "deviceRef", "permissionType",
            "observedStatus", "observedAt", "expiresAt", "retentionPolicyVersion",
            "retentionScope", "retentionAnchorAt")
         VALUES (gen_random_uuid(), $1, 'WECHAT_MINIAPP', $2,
                 'SUBSCRIPTION_MESSAGE', $3, $4::timestamptz,
                 $7::timestamptz + make_interval(days => $5),
                 $6, 'NOTIFICATION', $7::timestamptz)
         RETURNING id`,
        [
          input.accountId,
          input.deviceRef,
          input.observedPermission,
          input.observedAt,
          PLATFORM_PERMISSION_MAX_AGE_DAYS,
          RETENTION_POLICY_VERSION,
          input.now,
        ],
      );
      await attachResponseRef(
        client,
        input,
        requiredRef(snapshot.rows[0]?.id, "PERMISSION_SNAPSHOT_CREATE_FAILED"),
      );
      return {
        status: "ACCEPTED",
        value: {
          ...current,
          observedPermission: input.observedPermission,
          updatedAt:
            input.observedAt.getTime() > current.updatedAt.getTime()
              ? input.observedAt
              : current.updatedAt,
        },
      };
    });
  }

  public async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#pool.end();
  }

  async #transaction<T>(
    run: (client: PoolClient) => Promise<StoreMutation<T>>,
  ): Promise<StoreMutation<T>> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client);
      if (
        result.status === "CONSENT_REQUIRED" ||
        result.status === "ONBOARDING_REQUIRED" ||
        result.status === "REVISION_CONFLICT"
      ) {
        await client.query("ROLLBACK");
      } else {
        await client.query("COMMIT");
      }
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
      throw new Error("CONSENT_PROFILE_STORE_CLOSED");
    }
  }
}

async function accountIsActive(
  client: PoolClient,
  accountId: string,
): Promise<boolean> {
  const result = await client.query<{ state: string }>(
    `SELECT state::text AS state
       FROM daily_energy.app_user_account
      WHERE id = $1
      FOR SHARE`,
    [accountId],
  );
  return result.rows[0]?.state === "ACTIVE";
}

async function lockConsentOwner(
  client: PoolClient,
  accountId: string,
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, $2))", [
    accountId,
    CONSENT_LOCK_SEED,
  ]);
}

async function readCurrentConsent(
  client: Pick<PoolClient, "query">,
  accountId: string,
  forUpdate = false,
): Promise<ConsentRow | undefined> {
  const result = await client.query<ConsentRow>(
    `SELECT id, "noticeVersion", status::text AS state, "acceptedAt"
       FROM daily_energy.app_necessary_consent_record
      WHERE "accountId" = $1 AND "noticeVersion" = $2
      ORDER BY "createdAt" DESC, "withdrawnAt" DESC NULLS LAST, id DESC
      LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [accountId, CURRENT_NECESSARY_CONSENT_NOTICE_VERSION],
  );
  return result.rows[0];
}

function consentView(row: ConsentRow | undefined): StoredConsentView {
  if (row === undefined) {
    return {
      noticeVersion: CURRENT_NECESSARY_CONSENT_NOTICE_VERSION,
      state: "MISSING",
    };
  }
  return {
    ...(row.acceptedAt === null ? {} : { acceptedAt: row.acceptedAt }),
    noticeVersion: CURRENT_NECESSARY_CONSENT_NOTICE_VERSION,
    state: row.state,
  };
}

async function expireReplacedConsent(
  client: PoolClient,
  accountId: string,
  currentRef: string,
  now: Date,
): Promise<void> {
  await client.query(
    `UPDATE daily_energy.app_necessary_consent_record
        SET "expiresAt" = LEAST(
              COALESCE("expiresAt", $1::timestamptz + interval '6 months'),
              $1::timestamptz + interval '6 months'
            )
      WHERE "accountId" = $2 AND id <> $3`,
    [now, accountId, currentRef],
  );
}

async function readCurrentProfile(
  client: Pick<PoolClient, "query">,
  accountId: string,
  forUpdate = false,
): Promise<ProfileRow | undefined> {
  const result = await client.query<ProfileRow>(
    `SELECT p.id AS "profileRef", p.revision, p."preferredNameCiphertext",
            p."preferredNameKeyVersion", p."expressionStyle"::text AS "expressionStyle",
            p."updatedAt", (o.id IS NOT NULL) AS "onboardingCompleted",
            r.id AS "revisionRef"
       FROM daily_energy.app_user_profile p
       LEFT JOIN daily_energy.app_onboarding_completion o
         ON o."accountId" = p."accountId"
       LEFT JOIN daily_energy.app_user_profile_revision r
         ON r."profileId" = p.id AND r.revision = p.revision
      WHERE p."accountId" = $1${forUpdate ? " FOR UPDATE OF p" : ""}`,
    [accountId],
  );
  return result.rows[0];
}

async function readProfileRevision(
  client: Pick<PoolClient, "query">,
  revisionRef: string,
): Promise<ProfileRow | undefined> {
  const result = await client.query<ProfileRow>(
    `SELECT r."profileId" AS "profileRef", r.revision, r."preferredNameCiphertext",
            r."preferredNameKeyVersion", r."expressionStyle"::text AS "expressionStyle",
            r."createdAt" AS "updatedAt", true AS "onboardingCompleted",
            r.id AS "revisionRef"
       FROM daily_energy.app_user_profile_revision r
      WHERE r.id = $1`,
    [revisionRef],
  );
  return result.rows[0];
}

function profileView(
  row: ProfileRow | undefined,
): StoredProfileView | undefined {
  if (row === undefined) {
    return undefined;
  }
  const preferredName =
    row.preferredNameCiphertext === null || row.preferredNameKeyVersion === null
      ? undefined
      : {
          ciphertext: row.preferredNameCiphertext,
          keyVersion: row.preferredNameKeyVersion,
        };
  return {
    expressionStyle: row.expressionStyle,
    onboardingCompleted: row.onboardingCompleted,
    ...(preferredName === undefined ? {} : { preferredName }),
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}

async function insertProfileRevision(
  client: PoolClient,
  input: {
    readonly changedFieldNames: readonly string[];
    readonly commandRef: string;
    readonly expressionStyle: StoredExpressionStyle;
    readonly now: Date;
    readonly preferredName?: ProtectedPreferredName;
    readonly profileRef: string;
    readonly revision: number;
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO daily_energy.app_user_profile_revision
       (id, "profileId", revision, "preferredNameCiphertext",
        "preferredNameKeyVersion", "expressionStyle", "changedFieldNames",
        "commandRef", "createdAt", "retentionPolicyVersion", "retentionScope",
        "retentionAnchorAt", "expiresAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::text[], $7,
             $8::timestamptz, $9, 'ACCOUNT', $8::timestamptz,
             $8::timestamptz + CASE WHEN $3::bytea IS NULL
               THEN make_interval(days => $10)
               ELSE make_interval(hours => $11)
             END)
     RETURNING id`,
    [
      input.profileRef,
      input.revision,
      input.preferredName?.ciphertext ?? null,
      input.preferredName?.keyVersion ?? null,
      input.expressionStyle,
      input.changedFieldNames,
      commandRefStorageUuid(input.commandRef),
      input.now,
      RETENTION_POLICY_VERSION,
      PROFILE_REVISION_MAX_AGE_DAYS,
      PROFILE_NAME_KEY_MAX_AGE_HOURS,
    ],
  );
  return requiredRef(result.rows[0]?.id, "PROFILE_REVISION_CREATE_FAILED");
}

async function shortenReplacedProfileRevision(
  client: PoolClient,
  current: ProfileRow,
  now: Date,
): Promise<void> {
  if (current.revisionRef === null) {
    return;
  }
  await client.query(
    `UPDATE daily_energy.app_user_profile_revision
        SET "expiresAt" = LEAST(
              "expiresAt",
              $1::timestamptz + CASE WHEN "preferredNameCiphertext" IS NULL
                THEN make_interval(days => $2)
                ELSE make_interval(hours => $3)
              END
            )
      WHERE id = $4`,
    [
      now,
      PROFILE_REVISION_MAX_AGE_DAYS,
      PROFILE_NAME_KEY_MAX_AGE_HOURS,
      current.revisionRef,
    ],
  );
}

async function insertDefaultPreferences(
  client: PoolClient,
  accountId: string,
  now: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO daily_energy.app_memory_master_preference
       (id, "accountId", "dailyExpressionEnabled", "weeklySummaryEnabled",
        "continuityEnabled", revision, "updatedAt", "retentionPolicyVersion",
        "retentionScope", "retentionAnchorAt")
     VALUES (gen_random_uuid(), $1, false, false, false, 1,
             $2::timestamptz, $3, 'ACCOUNT', $2::timestamptz)
     ON CONFLICT ("accountId") DO NOTHING`,
    [accountId, now, RETENTION_POLICY_VERSION],
  );
  await client.query(
    `INSERT INTO daily_energy.app_notification_preference
       (id, "accountId", "notificationType", enabled, "ruleVersion", revision,
        "updatedAt", "retentionPolicyVersion", "retentionScope", "retentionAnchorAt")
     SELECT gen_random_uuid(), $1, kind, false, $2, 1,
            $3::timestamptz, $4, 'NOTIFICATION', $3::timestamptz
       FROM unnest(ARRAY['MORNING', 'EVENING']::text[]) AS kind
     ON CONFLICT ("accountId", "notificationType") DO NOTHING`,
    [accountId, NOTIFICATION_RULE_VERSION, now, RETENTION_POLICY_VERSION],
  );
}

async function readMemoryPreferences(
  client: Pick<PoolClient, "query">,
  accountId: string,
  forUpdate = false,
): Promise<StoredMemoryPreferencesView | undefined> {
  const result = await client.query<{
    continuityEnabled: boolean;
    dailyExpressionEnabled: boolean;
    revision: number;
    updatedAt: Date;
    weeklySummaryEnabled: boolean;
  }>(
    `SELECT "continuityEnabled", "dailyExpressionEnabled",
            "weeklySummaryEnabled", revision, "updatedAt"
       FROM daily_energy.app_memory_master_preference
      WHERE "accountId" = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [accountId],
  );
  const row = result.rows[0];
  return row === undefined
    ? undefined
    : {
        dailyUseEnabled: row.dailyExpressionEnabled,
        masterEnabled: row.continuityEnabled,
        revision: row.revision,
        updatedAt: row.updatedAt,
        weeklyUseEnabled: row.weeklySummaryEnabled,
      };
}

async function readNotificationSettings(
  client: Pick<PoolClient, "query">,
  accountId: string,
  deviceRef: string,
  now: Date,
  forUpdate = false,
): Promise<StoredNotificationSettingsView | undefined> {
  const preferences = await client.query<{
    enabled: boolean;
    notificationType: "MORNING" | "EVENING";
    revision: number;
    updatedAt: Date;
  }>(
    `SELECT "notificationType", enabled, revision, "updatedAt"
       FROM daily_energy.app_notification_preference
      WHERE "accountId" = $1
        AND "notificationType" IN ('MORNING', 'EVENING')
      ORDER BY "notificationType"${forUpdate ? " FOR UPDATE" : ""}`,
    [accountId],
  );
  if (preferences.rows.length !== 2) {
    return undefined;
  }
  const morning = preferences.rows.find(
    (row) => row.notificationType === "MORNING",
  );
  const evening = preferences.rows.find(
    (row) => row.notificationType === "EVENING",
  );
  if (
    morning === undefined ||
    evening === undefined ||
    morning.revision !== evening.revision
  ) {
    throw new Error("NOTIFICATION_PREFERENCE_REVISION_INVALID");
  }
  const permission = await client.query<{
    observedAt: Date;
    observedStatus: StoredPermission;
  }>(
    `SELECT "observedStatus" AS "observedStatus", "observedAt"
       FROM daily_energy.app_platform_permission_snapshot
      WHERE "accountId" = $1 AND "deviceRef" = $2
        AND "permissionType" = 'SUBSCRIPTION_MESSAGE'
        AND "expiresAt" > $3::timestamptz
      ORDER BY "observedAt" DESC
      LIMIT 1`,
    [accountId, deviceRef, now],
  );
  const observed = permission.rows[0];
  return {
    eveningEnabled: evening.enabled,
    morningEnabled: morning.enabled,
    observedPermission: observed?.observedStatus ?? "UNKNOWN",
    revision: morning.revision,
    updatedAt: new Date(
      Math.max(
        morning.updatedAt.getTime(),
        evening.updatedAt.getTime(),
        observed?.observedAt.getTime() ?? 0,
      ),
    ),
  };
}

async function claimCommand(
  client: PoolClient,
  input: CommandInput & {
    readonly operationCode: string;
    readonly targetKey: string;
  },
): Promise<CommandClaim> {
  const storageRef = commandRefStorageUuid(input.commandRef);
  const inserted = await client.query(
    `INSERT INTO daily_energy.runtime_command_receipt
       (id, "accountId", "commandRef", "operationCode", "targetScope",
        "targetKey", "normalizedPayloadFingerprint", "acceptedAt", "terminalAt",
        "retentionPolicyVersion", "retentionScope", "retentionAnchorAt", "expiresAt")
     VALUES (gen_random_uuid(), $1, $2, $3, 'ACCOUNT', $4, $5,
             $6::timestamptz, $6::timestamptz, $7, 'RUNTIME',
             $6::timestamptz, $6::timestamptz + make_interval(days => $8))
     ON CONFLICT ("accountId", "commandRef") DO NOTHING
     RETURNING id`,
    [
      input.accountId,
      storageRef,
      input.operationCode,
      input.targetKey,
      input.normalizedPayloadFingerprint,
      input.now,
      RETENTION_POLICY_VERSION,
      COMMAND_RECEIPT_TTL_DAYS,
    ],
  );
  if (inserted.rowCount === 1) {
    return { status: "NEW" };
  }
  const existing = await client.query<CommandReceiptRow>(
    `SELECT "operationCode", "targetKey", "normalizedPayloadFingerprint", "responseRef"
       FROM daily_energy.runtime_command_receipt
      WHERE "accountId" = $1 AND "commandRef" = $2
      FOR UPDATE`,
    [input.accountId, storageRef],
  );
  const receipt = existing.rows[0];
  if (
    receipt?.operationCode === input.operationCode &&
    receipt.targetKey === input.targetKey &&
    receipt.normalizedPayloadFingerprint.equals(
      input.normalizedPayloadFingerprint,
    )
  ) {
    return { responseRef: receipt.responseRef, status: "DUPLICATE" };
  }
  return { status: "CONFLICT" };
}

async function attachResponseRef(
  client: PoolClient,
  input: Pick<CommandInput, "accountId" | "commandRef">,
  responseRef: string | null,
): Promise<void> {
  await client.query(
    `UPDATE daily_energy.runtime_command_receipt
        SET "responseRef" = $1
      WHERE "accountId" = $2 AND "commandRef" = $3`,
    [responseRef, input.accountId, commandRefStorageUuid(input.commandRef)],
  );
}

function requiredRef(value: string | null | undefined, code: string): string {
  if (value === undefined || value === null) {
    throw new Error(code);
  }
  return value;
}

export const UNAVAILABLE_CONSENT_PROFILE_STORE: ConsentProfileStore = {
  acceptConsent: unavailable,
  close: async () => undefined,
  completeOnboarding: unavailable,
  getConsent: unavailable,
  getMemoryPreferences: unavailable,
  getNotificationSettings: unavailable,
  getProfile: unavailable,
  syncNotificationPermission: unavailable,
  updateMemoryPreferences: unavailable,
  updateNotificationSettings: unavailable,
  updateProfile: unavailable,
  withdrawConsent: unavailable,
};

async function unavailable(): Promise<never> {
  throw new Error("CONSENT_PROFILE_STORE_UNAVAILABLE");
}
