#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import {
  bootstrapTestDatabase,
  loadPg,
  loadTestcontainers,
  POSTGRES_IMAGE,
  runNode,
} from "./container-harness.mjs";

const integrationEnabled = process.env.DATABASE_INTEGRATION === "1";
const prismaBin = path.resolve(
  "node_modules/.bin",
  process.platform === "win32" ? "prisma.CMD" : "prisma",
);
const now = "2026-08-19T10:00:00.000Z";
const due = "2028-08-19T10:00:00.000Z";
const bytes = (value) => Buffer.from(value.padEnd(64, "0").slice(0, 64), "hex");
const session = (suffix, issuedAt = new Date(now)) => ({
  expiresAt: new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1_000),
  issuedAt,
  tokenHash: bytes(`f1${suffix}`),
});

async function connect(Client, connectionString, applicationName) {
  const client = new Client({
    connectionString,
    application_name: applicationName,
  });
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  await client.query("SET search_path TO daily_energy, pg_catalog");
  return client;
}

async function createIdentity(client, suffix, lookupToken, ciphertext) {
  const accountId = randomUUID();
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO app_user_account
        (id, "ownerScopeToken", "stableSubjectCiphertext", "stableSubjectKeyVersion", state, revision,
         "lastActiveUseAt", "inactivityDeletionDueAt", "updatedAt", "retentionPolicyVersion", "retentionAnchorAt")
       VALUES ($1,$2,$3,'synthetic-key-v1','ACTIVE',1,$4,$5,$4,'retention-policy-v1',$4)`,
      [accountId, bytes(`a1${suffix}`), bytes(`b1${suffix}`), now, due],
    );
    await client.query(
      `INSERT INTO app_external_identity
        (id,"accountId","providerCode","subjectLookupToken","subjectCiphertext","keyVersion",
         "createdAt","lastSeenAt","retentionPolicyVersion","retentionAnchorAt")
       VALUES ($1,$2,'WECHAT_MINIAPP',$3,$4,'synthetic-key-v1',$5,$5,'retention-policy-v1',$5)`,
      [randomUUID(), accountId, lookupToken, ciphertext, now],
    );
    await client.query("COMMIT");
    return accountId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function waitForApplicationLock(client, applicationName) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = await client.query(
      `SELECT 1
         FROM pg_stat_activity
        WHERE application_name = $1 AND wait_event_type = 'Lock'`,
      [applicationName],
    );
    if (waiting.rowCount > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`C001_LOCK_WAIT_NOT_OBSERVED:${applicationName}`);
}

test(
  "C-001 API role enforces identity uniqueness and ciphertext-independent lookup",
  {
    skip: integrationEnabled
      ? false
      : "set DATABASE_INTEGRATION=1 to run the real PostgreSQL 18 harness",
  },
  async () => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const adminUrl = container.getConnectionUri();
    try {
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      const { Client } = loadPg();
      const first = await connect(Client, loginUrls.api, "c001-api-first");
      const second = await connect(Client, loginUrls.api, "c001-api-second");
      const observer = await connect(
        Client,
        loginUrls.api,
        "c001-api-observer",
      );
      const privileged = await connect(
        Client,
        adminUrl,
        "c001-admin-reencrypt",
      );
      const { PostgresAuthStore } =
        await import("../../packages/server-adapters/dist/api/index.js");
      const authApplicationName = "c001-auth-store";
      let authStore;
      try {
        authStore = await PostgresAuthStore.connect({
          applicationName: authApplicationName,
          connectionLimit: 4,
          connectionString: loginUrls.api,
          expectedDatabaseRole: "daily_energy_api",
        });
      } catch (error) {
        await Promise.all([
          first.end(),
          second.end(),
          observer.end(),
          privileged.end(),
        ]);
        throw error;
      }
      try {
        const lookupToken = bytes("c00101");
        const attempts = await Promise.allSettled([
          createIdentity(first, "01", lookupToken, bytes("d001")),
          createIdentity(second, "02", lookupToken, bytes("d002")),
        ]);
        assert.equal(
          attempts.filter((result) => result.status === "fulfilled").length,
          1,
          "S19-DB-001 requires one committed account mapping",
        );
        assert.equal(
          attempts.filter((result) => result.status === "rejected").length,
          1,
          "the competing identity transaction must lose and roll back",
        );

        const mapping = await observer.query(
          `SELECT e."accountId", e."providerCode", e."subjectLookupToken"
             FROM app_external_identity e
            WHERE e."providerCode"='WECHAT_MINIAPP' AND e."subjectLookupToken"=$1`,
          [lookupToken],
        );
        assert.equal(mapping.rowCount, 1);
        const account = await observer.query(
          `SELECT id, state FROM app_user_account WHERE id=$1`,
          [mapping.rows[0].accountId],
        );
        assert.deepEqual(account.rows[0], {
          id: mapping.rows[0].accountId,
          state: "ACTIVE",
        });

        await assert.rejects(
          observer.query(
            `SELECT "subjectCiphertext" FROM app_external_identity WHERE "subjectLookupToken"=$1`,
            [lookupToken],
          ),
          /permission denied/iu,
          "daily_energy_api must never regain ciphertext SELECT",
        );

        const replacementCiphertext = bytes("d099");
        await privileged.query(
          `UPDATE daily_energy.app_external_identity
              SET "subjectCiphertext"=$1
            WHERE "providerCode"='WECHAT_MINIAPP' AND "subjectLookupToken"=$2`,
          [replacementCiphertext, lookupToken],
        );
        const afterReencrypt = await observer.query(
          `SELECT "accountId"
             FROM app_external_identity
            WHERE "providerCode"='WECHAT_MINIAPP' AND "subjectLookupToken"=$1`,
          [lookupToken],
        );
        assert.equal(afterReencrypt.rowCount, 1);
        assert.equal(
          afterReencrypt.rows[0].accountId,
          mapping.rows[0].accountId,
        );

        const protectedIdentity = {
          keyVersion: "synthetic-key-v1",
          providerCode: "WECHAT_MINIAPP",
          subjectCiphertext: bytes("e101"),
          subjectLookupToken: bytes("e102"),
        };
        const authAttempts = await Promise.all([
          authStore.establishSession({
            identity: protectedIdentity,
            newAccount: {
              ownerScopeToken: bytes("e103"),
              stableSubjectCiphertext: bytes("e104"),
              stableSubjectKeyVersion: "synthetic-key-v1",
            },
            now: new Date(now),
            session: session("01"),
          }),
          authStore.establishSession({
            identity: protectedIdentity,
            newAccount: {
              ownerScopeToken: bytes("e105"),
              stableSubjectCiphertext: bytes("e106"),
              stableSubjectKeyVersion: "synthetic-key-v1",
            },
            now: new Date(now),
            session: session("02"),
          }),
        ]);
        assert.equal(authAttempts[0].status, "ACTIVE");
        assert.equal(authAttempts[1].status, "ACTIVE");
        if (
          authAttempts[0].status !== "ACTIVE" ||
          authAttempts[1].status !== "ACTIVE"
        ) {
          throw new Error("C001_AUTH_SESSION_SETUP_FAILED");
        }
        assert.equal(
          authAttempts[0].session.accountId,
          authAttempts[1].session.accountId,
        );
        const authAccountId = authAttempts[0].session.accountId;

        const beforeBlockedLogin = await observer.query(
          `SELECT count(*)::int AS count
             FROM app_session_credential
            WHERE "accountId" = $1`,
          [authAccountId],
        );
        await privileged.query("BEGIN");
        await privileged.query(
          `UPDATE daily_energy.app_user_account
              SET state = 'DELETING'
            WHERE id = $1`,
          [authAccountId],
        );
        const blockedLoginPromise = authStore.establishSession({
          identity: protectedIdentity,
          newAccount: {
            ownerScopeToken: bytes("e107"),
            stableSubjectCiphertext: bytes("e108"),
            stableSubjectKeyVersion: "synthetic-key-v1",
          },
          now: new Date("2026-08-19T10:01:00.000Z"),
          session: session("03", new Date("2026-08-19T10:01:00.000Z")),
        });
        await waitForApplicationLock(privileged, authApplicationName);
        await privileged.query("COMMIT");
        assert.deepEqual(await blockedLoginPromise, {
          status: "ACCOUNT_BLOCKED",
        });
        const afterBlockedLogin = await observer.query(
          `SELECT count(*)::int AS count
             FROM app_session_credential
            WHERE "accountId" = $1`,
          [authAccountId],
        );
        assert.equal(
          afterBlockedLogin.rows[0].count,
          beforeBlockedLogin.rows[0].count,
        );

        await privileged.query(
          `UPDATE daily_energy.app_user_account SET state = 'ACTIVE' WHERE id = $1`,
          [authAccountId],
        );
        await privileged.query("BEGIN");
        await privileged.query(
          `UPDATE daily_energy.app_user_account
              SET state = 'DELETING'
            WHERE id = $1`,
          [authAccountId],
        );
        const blockedRefreshPromise = authStore.rotateSession({
          newSession: session("04", new Date("2026-08-19T10:02:00.000Z")),
          now: new Date("2026-08-19T10:02:00.000Z"),
          sessionId: authAttempts[0].session.sessionId,
        });
        await waitForApplicationLock(privileged, authApplicationName);
        await privileged.query("COMMIT");
        assert.deepEqual(await blockedRefreshPromise, {
          status: "ACCOUNT_BLOCKED",
        });

        await privileged.query(
          `UPDATE daily_energy.app_user_account SET state = 'ACTIVE' WHERE id = $1`,
          [authAccountId],
        );
        const logoutInput = {
          commandRef: "logout-command-0001",
          normalizedPayloadFingerprint: bytes("e109"),
          now: new Date("2026-08-19T10:03:00.000Z"),
          tokenHash: session("02").tokenHash,
        };
        assert.equal(await authStore.revokeSession(logoutInput), "ACCEPTED");
        assert.equal(await authStore.revokeSession(logoutInput), "DUPLICATE");
        assert.equal(
          await authStore.revokeSession({
            ...logoutInput,
            normalizedPayloadFingerprint: bytes("e110"),
          }),
          "CONFLICT",
        );
      } finally {
        await privileged.query("ROLLBACK").catch(() => undefined);
        await authStore.close();
        await Promise.all([
          first.end(),
          second.end(),
          observer.end(),
          privileged.end(),
        ]);
      }
    } catch (error) {
      process.stderr.write(
        `C001_AUTH_IDENTITY_ROOT:${error instanceof Error ? error.message : "UNKNOWN"}\n`,
      );
      throw error;
    } finally {
      await container.stop();
    }
  },
);
