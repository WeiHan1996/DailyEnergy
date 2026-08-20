import { createHash } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { CURRENT_NECESSARY_CONSENT_NOTICE_VERSION } from "../consent-profile/postgres-consent-profile-store.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export type AuthAccountState = "ACTIVE" | "RESTRICTED" | "DELETING" | "DELETED";

export interface ProtectedExternalIdentity {
  readonly keyVersion: string;
  readonly providerCode: string;
  readonly subjectCiphertext: Buffer;
  readonly subjectLookupToken: Buffer;
}

export interface NewAccountMaterial {
  readonly ownerScopeToken: Buffer;
  readonly stableSubjectCiphertext: Buffer;
  readonly stableSubjectKeyVersion: string;
}

export interface NewSessionMaterial {
  readonly expiresAt: Date;
  readonly issuedAt: Date;
  readonly tokenHash: Buffer;
}

export interface AuthSessionView {
  readonly accountId: string;
  readonly accountState: AuthAccountState;
  readonly consentRequired: boolean;
  readonly expiresAt: Date;
  readonly onboardingRequired: boolean;
  readonly sessionId: string;
}

export type SessionInspection =
  | { readonly status: "ACTIVE"; readonly session: AuthSessionView }
  | {
      readonly status: "INVALID" | "EXPIRED" | "REVOKED" | "ACCOUNT_BLOCKED";
    };

export type SessionRevocation =
  "ACCEPTED" | "DUPLICATE" | "CONFLICT" | "INVALID" | "EXPIRED";

export interface AuthStore {
  establishSession(input: {
    readonly identity: ProtectedExternalIdentity;
    readonly newAccount: NewAccountMaterial;
    readonly now: Date;
    readonly session: NewSessionMaterial;
  }): Promise<SessionInspection>;
  inspectSession(tokenHash: Buffer, now: Date): Promise<SessionInspection>;
  rotateSession(input: {
    readonly newSession: NewSessionMaterial;
    readonly now: Date;
    readonly sessionId: string;
  }): Promise<SessionInspection>;
  revokeSession(input: {
    readonly commandRef: string;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly tokenHash: Buffer;
  }): Promise<SessionRevocation>;
  close(): Promise<void>;
}

export interface PostgresAuthStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface AccountRow {
  readonly accountId: string;
  readonly accountState: AuthAccountState;
  readonly consentRequired: boolean;
  readonly onboardingRequired: boolean;
}

interface SessionRow extends AccountRow {
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly sessionId: string;
}

interface CommandReceiptRow {
  readonly normalizedPayloadFingerprint: Buffer;
  readonly operationCode: string;
  readonly targetKey: string;
}

const RETENTION_POLICY_VERSION = "retention-policy-v1";
const AUTH_LOCK_SEED = 10_001;
const COMMAND_RECEIPT_TTL_DAYS = 7;
const SESSION_LOGOUT_OPERATION = "SESSION_LOGOUT";

export class PostgresAuthStore implements AuthStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresAuthStoreConfig,
  ): Promise<PostgresAuthStore> {
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
        throw new Error("AUTH_DB_ROLE_MISMATCH");
      }
    } catch {
      await pool.end();
      throw new Error("AUTH_DB_ROLE_MISMATCH");
    }
    return new PostgresAuthStore(pool);
  }

  public async establishSession(input: {
    readonly identity: ProtectedExternalIdentity;
    readonly newAccount: NewAccountMaterial;
    readonly now: Date;
    readonly session: NewSessionMaterial;
  }): Promise<SessionInspection> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, $2))",
        [
          `${input.identity.providerCode}:${input.identity.subjectLookupToken.toString("hex")}`,
          AUTH_LOCK_SEED,
        ],
      );

      let account = await findAccountForIdentity(
        client,
        input.identity.providerCode,
        input.identity.subjectLookupToken,
      );
      if (account === undefined) {
        const created = await client.query<{ accountId: string }>(
          `INSERT INTO daily_energy.app_user_account
             (id, "ownerScopeToken", "stableSubjectCiphertext",
              "stableSubjectKeyVersion", state, revision, "lastActiveUseAt",
              "inactivityDeletionDueAt", "retentionPolicyVersion",
              "retentionScope", "retentionAnchorAt", "createdAt", "updatedAt")
           VALUES
             (gen_random_uuid(), $1, $2, $3, 'ACTIVE', 1, $4::timestamptz,
              $4::timestamptz + interval '24 months', $5, 'ACCOUNT',
              $4::timestamptz, $4::timestamptz, $4::timestamptz)
           RETURNING id AS "accountId"`,
          [
            input.newAccount.ownerScopeToken,
            input.newAccount.stableSubjectCiphertext,
            input.newAccount.stableSubjectKeyVersion,
            input.now,
            RETENTION_POLICY_VERSION,
          ],
        );
        const accountId = created.rows[0]?.accountId;
        if (accountId === undefined) {
          throw new Error("AUTH_ACCOUNT_CREATE_FAILED");
        }
        await client.query(
          `INSERT INTO daily_energy.app_external_identity
             (id, "accountId", "providerCode", "subjectLookupToken",
              "subjectCiphertext", "keyVersion", "createdAt", "lastSeenAt",
              "retentionPolicyVersion", "retentionScope", "retentionAnchorAt")
           VALUES
             (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $6, $7, 'ACCOUNT', $6)`,
          [
            accountId,
            input.identity.providerCode,
            input.identity.subjectLookupToken,
            input.identity.subjectCiphertext,
            input.identity.keyVersion,
            input.now,
            RETENTION_POLICY_VERSION,
          ],
        );
        account = {
          accountId,
          accountState: "ACTIVE",
          consentRequired: true,
          onboardingRequired: true,
        };
      } else {
        if (account.accountState !== "ACTIVE") {
          await client.query("ROLLBACK");
          return { status: "ACCOUNT_BLOCKED" };
        }
        await client.query(
          `UPDATE daily_energy.app_external_identity
              SET "lastSeenAt" = $1
            WHERE "providerCode" = $2 AND "subjectLookupToken" = $3`,
          [
            input.now,
            input.identity.providerCode,
            input.identity.subjectLookupToken,
          ],
        );
        await client.query(
          `UPDATE daily_energy.app_user_account
              SET "lastActiveUseAt" = $1::timestamptz,
                  "inactivityDeletionDueAt" = $1::timestamptz + interval '24 months',
                  "updatedAt" = $1::timestamptz
            WHERE id = $2`,
          [input.now, account.accountId],
        );
      }

      if (account.accountState !== "ACTIVE") {
        await client.query("ROLLBACK");
        return { status: "ACCOUNT_BLOCKED" };
      }

      const sessionId = await insertSession(
        client,
        account.accountId,
        input.session,
      );
      await client.query("COMMIT");
      return {
        status: "ACTIVE",
        session: {
          ...account,
          expiresAt: input.session.expiresAt,
          sessionId,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async inspectSession(
    tokenHash: Buffer,
    now: Date,
  ): Promise<SessionInspection> {
    this.#assertOpen();
    const result = await this.#pool.query<SessionRow>(
      sessionSelect('WHERE s."tokenHash" = $1'),
      [tokenHash],
    );
    return inspectRow(result.rows[0], now);
  }

  public async rotateSession(input: {
    readonly newSession: NewSessionMaterial;
    readonly now: Date;
    readonly sessionId: string;
  }): Promise<SessionInspection> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<SessionRow>(
        `${sessionSelect("WHERE s.id = $1")} FOR UPDATE OF s, a`,
        [input.sessionId],
      );
      const inspected = inspectRow(result.rows[0], input.now);
      if (inspected.status !== "ACTIVE") {
        await client.query("ROLLBACK");
        return inspected;
      }
      await client.query(
        `UPDATE daily_energy.app_session_credential
            SET "revokedAt" = COALESCE("revokedAt", $1)
          WHERE id = $2`,
        [input.now, input.sessionId],
      );
      const sessionId = await insertSession(
        client,
        inspected.session.accountId,
        input.newSession,
      );
      await client.query("COMMIT");
      return {
        status: "ACTIVE",
        session: {
          ...inspected.session,
          expiresAt: input.newSession.expiresAt,
          sessionId,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async revokeSession(input: {
    readonly commandRef: string;
    readonly normalizedPayloadFingerprint: Buffer;
    readonly now: Date;
    readonly tokenHash: Buffer;
  }): Promise<SessionRevocation> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const sessionResult = await client.query<SessionRow>(
        `${sessionSelect('WHERE s."tokenHash" = $1')} FOR UPDATE OF s, a`,
        [input.tokenHash],
      );
      const session = sessionResult.rows[0];
      if (session === undefined) {
        await client.query("ROLLBACK");
        return "INVALID";
      }

      const storedCommandRef = commandRefStorageUuid(input.commandRef);
      const inserted = await client.query(
        `INSERT INTO daily_energy.runtime_command_receipt
           (id, "accountId", "commandRef", "operationCode", "targetScope",
            "targetKey", "normalizedPayloadFingerprint", "acceptedAt", "terminalAt",
            "retentionPolicyVersion", "retentionScope", "retentionAnchorAt", "expiresAt")
         SELECT gen_random_uuid(), $1, $2, $3, 'SESSION', $4, $5,
                $6::timestamptz, $6::timestamptz, $7, 'RUNTIME',
                $6::timestamptz, $6::timestamptz + make_interval(days => $8)
          WHERE $9::timestamptz > $6
            AND $10::timestamptz IS NULL
         ON CONFLICT ("accountId", "commandRef") DO NOTHING
         RETURNING id`,
        [
          session.accountId,
          storedCommandRef,
          SESSION_LOGOUT_OPERATION,
          session.sessionId,
          input.normalizedPayloadFingerprint,
          input.now,
          RETENTION_POLICY_VERSION,
          COMMAND_RECEIPT_TTL_DAYS,
          session.expiresAt,
          session.revokedAt,
        ],
      );
      if (inserted.rowCount === 0) {
        const existing = await client.query<CommandReceiptRow>(
          `SELECT "operationCode", "targetKey", "normalizedPayloadFingerprint"
             FROM daily_energy.runtime_command_receipt
            WHERE "accountId" = $1 AND "commandRef" = $2
            FOR UPDATE`,
          [session.accountId, storedCommandRef],
        );
        const receipt = existing.rows[0];
        if (receipt !== undefined) {
          const duplicate =
            receipt.operationCode === SESSION_LOGOUT_OPERATION &&
            receipt.targetKey === session.sessionId &&
            receipt.normalizedPayloadFingerprint.equals(
              input.normalizedPayloadFingerprint,
            );
          await client.query("COMMIT");
          return duplicate ? "DUPLICATE" : "CONFLICT";
        }
        await client.query("ROLLBACK");
        return session.expiresAt.getTime() <= input.now.getTime()
          ? "EXPIRED"
          : "INVALID";
      }

      await client.query(
        `UPDATE daily_energy.app_session_credential
            SET "revokedAt" = $1
          WHERE id = $2`,
        [input.now, session.sessionId],
      );
      await client.query("COMMIT");
      return "ACCEPTED";
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#pool.end();
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("AUTH_STORE_CLOSED");
    }
  }
}

async function findAccountForIdentity(
  client: PoolClient,
  providerCode: string,
  subjectLookupToken: Buffer,
): Promise<AccountRow | undefined> {
  const result = await client.query<AccountRow>(
    `SELECT a.id AS "accountId",
            a.state::text AS "accountState",
            COALESCE((
              SELECT c.status::text
                FROM daily_energy.app_necessary_consent_record c
               WHERE c."accountId" = a.id
                 AND c."noticeVersion" = '${CURRENT_NECESSARY_CONSENT_NOTICE_VERSION}'
               ORDER BY c."createdAt" DESC, c."withdrawnAt" DESC NULLS LAST, c.id DESC
               LIMIT 1
            ), 'MISSING') <> 'ACCEPTED' AS "consentRequired",
            NOT EXISTS (
              SELECT 1
                FROM daily_energy.app_onboarding_completion o
               WHERE o."accountId" = a.id
            ) AS "onboardingRequired"
       FROM daily_energy.app_external_identity e
       JOIN daily_energy.app_user_account a ON a.id = e."accountId"
      WHERE e."providerCode" = $1 AND e."subjectLookupToken" = $2
      LIMIT 1
      FOR UPDATE OF a`,
    [providerCode, subjectLookupToken],
  );
  return result.rows[0];
}

function sessionSelect(whereClause: string): string {
  return `SELECT s.id AS "sessionId", s."expiresAt", s."revokedAt",
                 a.id AS "accountId", a.state::text AS "accountState",
                 COALESCE((
                   SELECT c.status::text
                     FROM daily_energy.app_necessary_consent_record c
                    WHERE c."accountId" = a.id
                      AND c."noticeVersion" = '${CURRENT_NECESSARY_CONSENT_NOTICE_VERSION}'
                    ORDER BY c."createdAt" DESC, c."withdrawnAt" DESC NULLS LAST, c.id DESC
                    LIMIT 1
                 ), 'MISSING') <> 'ACCEPTED' AS "consentRequired",
                 NOT EXISTS (
                   SELECT 1 FROM daily_energy.app_onboarding_completion o
                    WHERE o."accountId" = a.id
                 ) AS "onboardingRequired"
            FROM daily_energy.app_session_credential s
            JOIN daily_energy.app_user_account a ON a.id = s."accountId"
            ${whereClause}
            LIMIT 1`;
}

function inspectRow(row: SessionRow | undefined, now: Date): SessionInspection {
  if (row === undefined) {
    return { status: "INVALID" };
  }
  if (row.revokedAt !== null) {
    return { status: "REVOKED" };
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return { status: "EXPIRED" };
  }
  if (row.accountState !== "ACTIVE") {
    return { status: "ACCOUNT_BLOCKED" };
  }
  return {
    status: "ACTIVE",
    session: {
      accountId: row.accountId,
      accountState: row.accountState,
      consentRequired: row.consentRequired,
      expiresAt: row.expiresAt,
      onboardingRequired: row.onboardingRequired,
      sessionId: row.sessionId,
    },
  };
}

async function insertSession(
  client: PoolClient,
  accountId: string,
  session: NewSessionMaterial,
): Promise<string> {
  const result = await client.query<{ sessionId: string }>(
    `INSERT INTO daily_energy.app_session_credential
       (id, "accountId", "tokenHash", "issuedAt", "expiresAt",
        "retentionPolicyVersion", "retentionScope", "retentionAnchorAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACCOUNT', $3)
     RETURNING id AS "sessionId"`,
    [
      accountId,
      session.tokenHash,
      session.issuedAt,
      session.expiresAt,
      RETENTION_POLICY_VERSION,
    ],
  );
  const sessionId = result.rows[0]?.sessionId;
  if (sessionId === undefined) {
    throw new Error("AUTH_SESSION_CREATE_FAILED");
  }
  return sessionId;
}
