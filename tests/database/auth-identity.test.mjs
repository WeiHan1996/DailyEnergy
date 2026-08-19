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

async function connect(Client, connectionString, applicationName) {
  const client = new Client({ connectionString, application_name: applicationName });
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

test(
  "C-001 real PostgreSQL identity uniqueness and ciphertext-independent lookup",
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
      const first = await connect(Client, adminUrl, "c001-identity-first");
      const second = await connect(Client, adminUrl, "c001-identity-second");
      const observer = await connect(Client, adminUrl, "c001-identity-observer");
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
          "the competing identity transaction must lose",
        );
        const mapping = await observer.query(
          `SELECT e."accountId", e."subjectCiphertext"
             FROM app_external_identity e
            WHERE e."providerCode"='WECHAT_MINIAPP' AND e."subjectLookupToken"=$1`,
          [lookupToken],
        );
        assert.equal(mapping.rowCount, 1);
        const accountCount = await observer.query(
          `SELECT count(*)::int AS count FROM app_user_account`,
        );
        assert.equal(accountCount.rows[0].count, 1);

        const replacementCiphertext = bytes("d099");
        assert.notDeepEqual(mapping.rows[0].subjectCiphertext, replacementCiphertext);
        await observer.query(
          `UPDATE app_external_identity
              SET "subjectCiphertext"=$1
            WHERE "providerCode"='WECHAT_MINIAPP' AND "subjectLookupToken"=$2`,
          [replacementCiphertext, lookupToken],
        );
        const afterReencrypt = await observer.query(
          `SELECT "accountId", "subjectCiphertext"
             FROM app_external_identity
            WHERE "providerCode"='WECHAT_MINIAPP' AND "subjectLookupToken"=$1`,
          [lookupToken],
        );
        assert.equal(afterReencrypt.rowCount, 1);
        assert.equal(afterReencrypt.rows[0].accountId, mapping.rows[0].accountId);
        assert.deepEqual(afterReencrypt.rows[0].subjectCiphertext, replacementCiphertext);
      } finally {
        await Promise.all([first.end(), second.end(), observer.end()]);
      }
    } finally {
      await container.stop();
    }
  },
);
