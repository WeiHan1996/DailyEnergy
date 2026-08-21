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
const baseNow = new Date("2026-08-21T01:00:00.000Z");

function bytes(value) {
  return Buffer.from(value.padEnd(64, "0").slice(0, 64), "hex");
}

function command(accountId, commandRef, fingerprint, values, offset = 0) {
  return {
    accountId,
    commandRef,
    normalizedPayloadFingerprint: bytes(fingerprint),
    now: new Date(baseNow.getTime() + offset),
    productDate: "2026-08-21",
    productDatePolicyVersion: "product-date-v1",
    ...values,
  };
}

async function connect(Client, connectionString, applicationName) {
  const client = new Client({
    application_name: applicationName,
    connectionString,
  });
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  await client.query("SET search_path TO daily_energy, pg_catalog");
  return client;
}

async function waitForAdvisoryWait(client, applicationName) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const waiting = await client.query(
      `SELECT 1 FROM pg_stat_activity
        WHERE application_name=$1 AND wait_event_type='Lock'
          AND wait_event='advisory'`,
      [applicationName],
    );
    if (waiting.rowCount > 0) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("C004_ADVISORY_FENCE_WAIT_NOT_OBSERVED");
}

test(
  "C-004 real PostgreSQL check-in idempotency, CAS and restricted guards",
  {
    skip: integrationEnabled
      ? false
      : "set DATABASE_INTEGRATION=1 to run the real PostgreSQL 18 harness",
  },
  async () => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const adminUrl = container.getConnectionUri();
    let apiObserver;
    let privileged;
    let authStore;
    let consentStore;
    let checkinStore;
    try {
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      const { Client } = loadPg();
      apiObserver = await connect(Client, loginUrls.api, "c004-api-observer");
      privileged = await connect(Client, adminUrl, "c004-admin-observer");
      const {
        PostgresAuthStore,
        PostgresCheckinStore,
        PostgresConsentProfileStore,
      } = await import("../../packages/server-adapters/dist/api/index.js");
      authStore = await PostgresAuthStore.connect({
        applicationName: "c004-auth-store",
        connectionLimit: 4,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      consentStore = await PostgresConsentProfileStore.connect({
        applicationName: "c004-consent-store",
        connectionLimit: 4,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      checkinStore = await PostgresCheckinStore.connect({
        applicationName: "c004-checkin-store",
        connectionLimit: 8,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });

      const session = await authStore.establishSession({
        identity: {
          keyVersion: "synthetic-key-v1",
          providerCode: "WECHAT_MINIAPP",
          subjectCiphertext: bytes("c401"),
          subjectLookupToken: bytes("c402"),
        },
        newAccount: {
          ownerScopeToken: bytes("c403"),
          stableSubjectCiphertext: bytes("c404"),
          stableSubjectKeyVersion: "synthetic-key-v1",
        },
        now: baseNow,
        session: {
          expiresAt: new Date(baseNow.getTime() + 30 * 24 * 60 * 60 * 1_000),
          issuedAt: baseNow,
          tokenHash: bytes("c405"),
        },
      });
      assert.equal(session.status, "ACTIVE");
      if (session.status !== "ACTIVE") {
        throw new Error("C004_ACCOUNT_SETUP_FAILED");
      }
      const accountId = session.session.accountId;
      assert.equal(
        (
          await consentStore.acceptConsent({
            accountId,
            commandRef: "c004-consent-accept-0001",
            normalizedPayloadFingerprint: bytes("c410"),
            noticeVersion: "necessary-consent-v1",
            now: baseNow,
          })
        ).status,
        "ACCEPTED",
      );
      assert.equal(
        (
          await consentStore.completeOnboarding({
            accountId,
            commandRef: "c004-onboarding-0001",
            expressionStyle: "BALANCED",
            normalizedPayloadFingerprint: bytes("c411"),
            now: new Date(baseNow.getTime() + 1),
          })
        ).status,
        "ACCEPTED",
      );

      const firstValues = {
        energy: "STEADY",
        mood: "GOOD",
        sleep: "OKAY",
      };
      const concurrent = await Promise.all([
        checkinStore.submit(
          command(
            accountId,
            "c004-checkin-submit-0001",
            "c420",
            firstValues,
            10,
          ),
        ),
        checkinStore.submit(
          command(
            accountId,
            "c004-checkin-submit-0002",
            "c421",
            firstValues,
            10,
          ),
        ),
      ]);
      assert.deepEqual(concurrent.map(({ status }) => status).sort(), [
        "ACCEPTED",
        "DUPLICATE",
      ]);
      const current = await checkinStore.getToday({
        accountId,
        productDate: "2026-08-21",
      });
      assert.equal(current.status, "FOUND");
      if (current.status !== "FOUND") {
        throw new Error("C004_CHECKIN_MISSING");
      }
      assert.equal(current.value.revision, 1);
      const checkinRef = current.value.checkinRef;
      const counts = await apiObserver.query(
        `SELECT
           (SELECT count(*)::int FROM app_morning_checkin
             WHERE "accountId"=$1 AND "productDate"='2026-08-21') AS checkins,
           (SELECT count(*)::int FROM app_morning_checkin_revision
             WHERE "checkinId"=$2) AS revisions`,
        [accountId, checkinRef],
      );
      assert.deepEqual(counts.rows[0], { checkins: 1, revisions: 1 });

      const firstInput = command(
        accountId,
        "c004-checkin-submit-0001",
        "c420",
        firstValues,
        10,
      );
      assert.equal((await checkinStore.submit(firstInput)).status, "DUPLICATE");
      assert.equal(
        (
          await checkinStore.submit({
            ...firstInput,
            normalizedPayloadFingerprint: bytes("c499"),
          })
        ).status,
        "IDEMPOTENCY_CONFLICT",
      );
      assert.equal(
        (
          await checkinStore.submit(
            command(
              accountId,
              "c004-checkin-submit-different",
              "c422",
              { energy: "HIGH", mood: "LIGHT", sleep: "GOOD" },
              20,
            ),
          )
        ).status,
        "CHECKIN_ALREADY_EXISTS",
      );

      const intentId = randomUUID();
      const snapshotId = randomUUID();
      await privileged.query(
        `INSERT INTO daily_energy.app_generation_intent
           (id,"accountId","targetProductDate","productDatePolicyVersion",
            "acceptedAt",revision,state,"resultVersion","manifestRef",
            "manifestFingerprint","inputSnapshotFingerprint",
            "rootSeedMaterialRef","completionGrantVersion","createdAt",
            "updatedAt","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,'2026-08-21','product-date-v1',$3,1,'RUNNING',
                 'result-v1','manifest-v1',$4,$5,'seed-v1','grant-v1',$3,$3,
                 'retention-policy-v1',$3)`,
        [intentId, accountId, baseNow, bytes("c430"), bytes("c431")],
      );
      await privileged.query(
        `INSERT INTO daily_energy.app_generation_input_snapshot
           (id,"generationIntentId","checkinId","checkinRevision",
            "schemaVersion","snapshotPayload","snapshotFingerprint",
            "retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,$3,1,'snapshot-v1','{}',$4,'retention-policy-v1',$5)`,
        [snapshotId, intentId, checkinRef, bytes("c432"), baseNow],
      );

      const corrections = await Promise.all([
        checkinStore.correct({
          ...command(
            accountId,
            "c004-checkin-correct-0001",
            "c440",
            { energy: "HIGH", mood: "LIGHT", sleep: "GOOD" },
            30,
          ),
          expectedRevision: 1,
        }),
        checkinStore.correct({
          ...command(
            accountId,
            "c004-checkin-correct-0002",
            "c441",
            { energy: "LOW", mood: "LOW", sleep: "LOW" },
            30,
          ),
          expectedRevision: 1,
        }),
      ]);
      assert.deepEqual(corrections.map(({ status }) => status).sort(), [
        "ACCEPTED",
        "REVISION_CONFLICT",
      ]);
      const afterCorrection = await checkinStore.getToday({
        accountId,
        productDate: "2026-08-21",
      });
      assert.equal(afterCorrection.status, "FOUND");
      assert.equal(
        afterCorrection.status === "FOUND" && afterCorrection.value.revision,
        2,
      );
      const frozen = await privileged.query(
        `SELECT "checkinRevision" FROM daily_energy.app_generation_input_snapshot
          WHERE id=$1`,
        [snapshotId],
      );
      assert.equal(frozen.rows[0].checkinRevision, 1);

      await assert.rejects(
        apiObserver.query(
          `DELETE FROM app_morning_checkin_revision WHERE "checkinId"=$1`,
          [checkinRef],
        ),
        (error) => error?.code === "42501",
      );
      await assert.rejects(
        apiObserver.query(
          `UPDATE app_morning_checkin_revision SET mood='LOW'
            WHERE "checkinId"=$1`,
          [checkinRef],
        ),
        (error) => error?.code === "42501",
      );

      await privileged.query("BEGIN");
      await privileged.query(
        `INSERT INTO daily_energy.restricted_safety_state
           (id,"accountId",state,revision,"guardEpoch","updatedAt",
            "retentionPolicyVersion","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,'ACTIVE',1,1,$2,
                 'retention-policy-v1',$2)`,
        [accountId, new Date(baseNow.getTime() + 40)],
      );
      const blockedPromise = checkinStore.correct({
        ...command(
          accountId,
          "c004-checkin-correct-safety",
          "c450",
          firstValues,
          50,
        ),
        expectedRevision: 2,
      });
      await waitForAdvisoryWait(privileged, "c004-checkin-store");
      await privileged.query("COMMIT");
      const blocked = await blockedPromise;
      assert.equal(blocked.status, "SAFETY_BLOCKED");
      await privileged.query(
        `DELETE FROM daily_energy.restricted_safety_state WHERE "accountId"=$1`,
        [accountId],
      );

      const functionAcl = await privileged.query(
        `SELECT has_function_privilege('daily_energy_api',
           'daily_energy.resolve_checkin_guard_status(uuid,date,text)', 'EXECUTE') AS execute,
           has_table_privilege('daily_energy_api',
           'daily_energy.restricted_safety_state', 'SELECT') AS direct_safety_select`,
      );
      assert.deepEqual(functionAcl.rows[0], {
        direct_safety_select: false,
        execute: true,
      });
      const guardTriggers = await privileged.query(
        `SELECT count(*)::int AS count FROM pg_trigger
          WHERE tgname LIKE 'c004_%_guard_fence' AND NOT tgisinternal`,
      );
      assert.equal(guardTriggers.rows[0].count, 5);
    } finally {
      await privileged?.query("ROLLBACK").catch(() => undefined);
      await checkinStore?.close().catch(() => undefined);
      await consentStore?.close().catch(() => undefined);
      await authStore?.close().catch(() => undefined);
      await apiObserver?.end().catch(() => undefined);
      await privileged?.end().catch(() => undefined);
      await container.stop();
    }
  },
);
