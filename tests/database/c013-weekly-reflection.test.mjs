#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
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
const baseNow = new Date("2026-08-24T12:00:00.000Z");

function bytes(value) {
  return createHash("sha256").update(value, "utf8").digest();
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

function sourceEnvelope(checkinRef, revision) {
  return {
    aggregateRef: checkinRef,
    aggregateRevision: revision,
    contract: "dailyenergy.job",
    eventId: randomUUID(),
    eventType: "CheckinCorrected",
    eventVersion: "v1",
    guardEpochs: { deletion: "0", safety: "0" },
    occurredAt: baseNow.toISOString(),
    queueVersion: 1,
  };
}

async function insertCheckin(admin, accountId, productDate, values) {
  const checkinRef = randomUUID();
  const commandRef = randomUUID();
  await admin.query("BEGIN");
  try {
    await admin.query(
      `INSERT INTO app_morning_checkin
        (id,"accountId","productDate","productDatePolicyVersion",revision,
         mood,energy,sleep,"firstSubmittedAt","updatedAt","sourceCommandRef",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES ($1,$2,$3::date,'product-date-v1',1,$4,$5,$6,$7,$7,$8,
               'retention-policy-v1','DAY',$7)`,
      [
        checkinRef,
        accountId,
        productDate,
        values.mood,
        values.energy,
        values.sleep,
        baseNow,
        commandRef,
      ],
    );
    await admin.query(
      `INSERT INTO app_morning_checkin_revision
        (id,"checkinId",revision,mood,energy,sleep,"commandRef",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES (gen_random_uuid(),$1,1,$2,$3,$4,$5,
               'retention-policy-v1','DAY',$6)`,
      [
        checkinRef,
        values.mood,
        values.energy,
        values.sleep,
        commandRef,
        baseNow,
      ],
    );
    await admin.query("SET CONSTRAINTS ALL IMMEDIATE");
    await admin.query("COMMIT");
    return checkinRef;
  } catch (error) {
    await admin.query("ROLLBACK");
    throw error;
  }
}

async function correctCheckin(admin, checkinRef, revision, values) {
  const commandRef = randomUUID();
  await admin.query("BEGIN");
  try {
    await admin.query(
      `UPDATE app_morning_checkin
          SET revision=$2,mood=$3,energy=$4,sleep=$5,"updatedAt"=$6
        WHERE id=$1 AND revision=$2-1`,
      [
        checkinRef,
        revision,
        values.mood,
        values.energy,
        values.sleep,
        new Date(baseNow.getTime() + revision * 1_000),
      ],
    );
    await admin.query(
      `INSERT INTO app_morning_checkin_revision
        (id,"checkinId",revision,mood,energy,sleep,"commandRef",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,
               'retention-policy-v1','DAY',$7)`,
      [
        checkinRef,
        revision,
        values.mood,
        values.energy,
        values.sleep,
        commandRef,
        baseNow,
      ],
    );
    await admin.query("SET CONSTRAINTS ALL IMMEDIATE");
    await admin.query("COMMIT");
  } catch (error) {
    await admin.query("ROLLBACK");
    throw error;
  }
}

async function consume(queueStore, consumerCode, handler, envelope) {
  return queueStore.consumeInbox(consumerCode, envelope, (transaction) =>
    handler.handle(envelope, transaction),
  );
}

test(
  "C-013 real PostgreSQL snapshot, due row, TX-07 invalidation and deletion visibility",
  {
    skip: integrationEnabled
      ? false
      : "set DATABASE_INTEGRATION=1 to run the real PostgreSQL 18 harness",
  },
  async () => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const adminUrl = container.getConnectionUri();
    const resources = [];
    try {
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      const { Client } = loadPg();
      const admin = await connect(Client, adminUrl, "c013-admin");
      resources.push(admin);

      const apiAdapters =
        await import("../../packages/server-adapters/dist/api/index.js");
      const backgroundAdapters =
        await import("../../packages/server-adapters/dist/worker-background/index.js");
      const testingAdapters =
        await import("../../packages/server-adapters/dist/testing/index.js");
      const auth = await apiAdapters.PostgresAuthStore.connect({
        applicationName: "c013-auth",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const consent = await apiAdapters.PostgresConsentProfileStore.connect({
        applicationName: "c013-consent",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const weekly = await apiAdapters.PostgresWeeklyStore.connect({
        applicationName: "c013-weekly-query",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const queueStore = await testingAdapters.PostgresQueueStore.connect({
        applicationName: "c013-background-queue",
        connectionString: loginUrls.background,
        expectedDatabaseRole: "daily_energy_background",
        profile: "worker-background",
      });
      resources.push(auth, consent, weekly, queueStore);

      const session = await auth.establishSession({
        identity: {
          keyVersion: "synthetic-key-v1",
          providerCode: "WECHAT_MINIAPP",
          subjectCiphertext: bytes("c013-identity"),
          subjectLookupToken: bytes("c013-lookup"),
        },
        newAccount: {
          ownerScopeToken: bytes("c013-owner"),
          stableSubjectCiphertext: bytes("c013-subject"),
          stableSubjectKeyVersion: "synthetic-key-v1",
        },
        now: baseNow,
        session: {
          expiresAt: new Date(baseNow.getTime() + 30 * 24 * 60 * 60_000),
          issuedAt: baseNow,
          tokenHash: bytes("c013-session"),
        },
      });
      assert.equal(session.status, "ACTIVE");
      const accountId = session.session.accountId;
      assert.equal(
        (
          await consent.acceptConsent({
            accountId,
            commandRef: "c013-consent-0001",
            normalizedPayloadFingerprint: bytes("c013-consent"),
            noticeVersion: "necessary-consent-v1",
            now: new Date(baseNow.getTime() + 1),
          })
        ).status,
        "ACCEPTED",
      );
      assert.equal(
        (
          await consent.completeOnboarding({
            accountId,
            commandRef: "c013-onboarding-0001",
            expressionStyle: "BALANCED",
            normalizedPayloadFingerprint: bytes("c013-onboarding"),
            now: new Date(baseNow.getTime() + 2),
          })
        ).status,
        "ACCEPTED",
      );

      await insertCheckin(admin, accountId, "2026-08-22", {
        energy: "LOW",
        mood: "LOW",
        sleep: "LOW",
      });
      await insertCheckin(admin, accountId, "2026-08-23", {
        energy: "STEADY",
        mood: "STEADY",
        sleep: "OKAY",
      });
      const currentCheckin = await insertCheckin(
        admin,
        accountId,
        "2026-08-24",
        { energy: "HIGH", mood: "GOOD", sleep: "GOOD" },
      );

      const beforeProjection = await weekly.get({
        accountId,
        endProductDate: "2026-08-24",
      });
      assert.equal(beforeProjection.status, "FOUND");
      assert.equal(beforeProjection.value.coverage.level, "PARTIAL");
      assert.equal(beforeProjection.value.summary_status, "ELIGIBLE");
      const historical = await weekly.get({
        accountId,
        endProductDate: "2026-08-23",
      });
      assert.equal(historical.status, "FOUND");
      assert.equal(historical.value.window_end_date, "2026-08-23");
      assert.equal(historical.value.coverage.level, "POINTS_ONLY");
      assert.equal(historical.value.days.at(-1).product_date, "2026-08-23");

      const handlers = backgroundAdapters.createWeeklyHandlers();
      const sourceHandler = handlers.find(
        (handler) => handler.eventType === "CheckinCorrected",
      );
      const dueHandler = handlers.find(
        (handler) => handler.eventType === "WeeklySummaryDue",
      );
      assert.ok(sourceHandler);
      assert.ok(dueHandler);

      const firstSource = sourceEnvelope(currentCheckin, 1);
      const sourceResult = await consume(
        queueStore,
        "background-projection",
        sourceHandler,
        firstSource,
      );
      assert.equal(sourceResult.outcomeCode, "WEEKLY_SUMMARY_QUEUED");
      const firstDueRows = await queueStore.listWeeklyDue(10);
      assert.equal(firstDueRows.length, 1);
      const firstDue = firstDueRows[0];
      assert.equal(firstDue.eventId, firstDue.aggregateRef);

      const generating = await weekly.get({
        accountId,
        endProductDate: "2026-08-24",
      });
      assert.equal(generating.status, "FOUND");
      assert.equal(generating.value.summary_status, "GENERATING");
      assert.equal(generating.value.summary, undefined);

      const firstPublished = await consume(
        queueStore,
        "background-weekly-summary",
        dueHandler,
        firstDue,
      );
      assert.equal(firstPublished.outcomeCode, "WEEKLY_SUMMARY_PUBLISHED");
      const available = await weekly.get({
        accountId,
        endProductDate: "2026-08-24",
      });
      assert.equal(available.status, "FOUND");
      assert.equal(available.value.summary_status, "AVAILABLE");
      assert.equal(available.value.summary.revision, 1);
      await assert.rejects(
        connect(
          Client,
          loginUrls.background,
          "c013-summary-content-denied",
        ).then(async (client) => {
          try {
            await client.query(
              `UPDATE app_published_weekly_summary_revision
                    SET "summaryVersion"='tampered-version'
                  WHERE revision=1`,
            );
          } finally {
            await client.end();
          }
        }),
        /permission denied|SQL-008/iu,
      );

      const snapshot = (
        await admin.query(
          `SELECT "sourceSlotsPayload" FROM app_weekly_source_snapshot
            ORDER BY "createdAt" DESC LIMIT 1`,
        )
      ).rows[0].sourceSlotsPayload;
      assert.doesNotMatch(
        JSON.stringify(snapshot),
        /note|daily_score|raw_score|expression|provider|model/iu,
      );
      assert.equal(snapshot.days.length, 7);
      assert.equal(
        snapshot.days.filter((day) => day.source_state === "MISSING").length,
        4,
      );

      const duplicate = await consume(
        queueStore,
        "background-projection",
        sourceHandler,
        firstSource,
      );
      assert.equal(duplicate.duplicate, true);

      await correctCheckin(admin, currentCheckin, 2, {
        energy: "STEADY",
        mood: "STEADY",
        sleep: "OKAY",
      });
      const secondSource = sourceEnvelope(currentCheckin, 2);
      assert.equal(
        (
          await consume(
            queueStore,
            "background-projection",
            sourceHandler,
            secondSource,
          )
        ).outcomeCode,
        "WEEKLY_SUMMARY_QUEUED",
      );
      const invalidated = await weekly.get({
        accountId,
        endProductDate: "2026-08-24",
      });
      assert.equal(invalidated.status, "FOUND");
      assert.equal(invalidated.value.summary_status, "INVALIDATED");
      assert.equal(invalidated.value.summary, undefined);
      const firstRetention = (
        await admin.query(
          `SELECT snapshot."invalidatedAt" AS "snapshotInvalidatedAt",
                  snapshot."expiresAt" AS "snapshotExpiresAt",
                  summary."retentionAnchorAt" AS "summaryRetentionAnchorAt",
                  summary."expiresAt" AS "summaryExpiresAt"
             FROM app_weekly_source_snapshot snapshot
             JOIN app_published_weekly_summary_revision summary
               ON summary."windowId"=snapshot."windowId"
              AND summary."sourceFingerprint"=snapshot."sourceFingerprint"
            WHERE summary.revision=1`,
        )
      ).rows[0];
      assert.equal(
        firstRetention.snapshotExpiresAt.getTime() -
          firstRetention.snapshotInvalidatedAt.getTime(),
        30 * 24 * 60 * 60_000,
      );
      assert.equal(
        firstRetention.summaryExpiresAt.getTime() -
          firstRetention.summaryRetentionAnchorAt.getTime(),
        30 * 24 * 60 * 60_000,
      );
      const secondDue = (await queueStore.listWeeklyDue(10))[0];

      await correctCheckin(admin, currentCheckin, 3, {
        energy: "LOW",
        mood: "LOW",
        sleep: "LOW",
      });
      assert.equal(
        (
          await consume(
            queueStore,
            "background-projection",
            sourceHandler,
            sourceEnvelope(currentCheckin, 3),
          )
        ).outcomeCode,
        "WEEKLY_SUMMARY_QUEUED",
      );
      const repeatedExpiry = (
        await admin.query(
          `SELECT "expiresAt" FROM app_published_weekly_summary_revision
            WHERE revision=1`,
        )
      ).rows[0].expiresAt;
      assert.equal(
        repeatedExpiry.getTime(),
        firstRetention.summaryExpiresAt.getTime(),
      );
      const thirdDue = (await queueStore.listWeeklyDue(10))[0];
      assert.notEqual(secondDue.aggregateRef, thirdDue.aggregateRef);
      assert.equal(
        (
          await consume(
            queueStore,
            "background-weekly-summary",
            dueHandler,
            secondDue,
          )
        ).outcomeCode,
        "SOURCE_STALE",
      );
      assert.equal(
        (
          await consume(
            queueStore,
            "background-weekly-summary",
            dueHandler,
            thirdDue,
          )
        ).outcomeCode,
        "WEEKLY_SUMMARY_PUBLISHED",
      );
      const revised = await weekly.get({
        accountId,
        endProductDate: "2026-08-24",
      });
      assert.equal(revised.status, "FOUND");
      assert.equal(revised.value.summary_status, "AVAILABLE");
      assert.equal(revised.value.summary.revision, 2);
      const currentRetention = (
        await admin.query(
          `SELECT
             (SELECT count(*)::int FROM app_weekly_source_snapshot
               WHERE "invalidatedAt" IS NOT NULL
                 AND "expiresAt"="invalidatedAt"+interval '30 days')
               AS "boundedSnapshots",
             (SELECT count(*)::int FROM app_weekly_source_snapshot
               WHERE "invalidatedAt" IS NULL AND "expiresAt" IS NULL)
               AS "currentSnapshots",
             (SELECT count(*)::int FROM app_published_weekly_summary_revision
               WHERE "expiresAt" IS NOT NULL
                 AND "expiresAt"="retentionAnchorAt"+interval '30 days')
               AS "boundedSummaries",
             (SELECT count(*)::int FROM app_published_weekly_summary_revision
               WHERE revision=2 AND "expiresAt" IS NULL)
               AS "currentSummaries"`,
        )
      ).rows[0];
      assert.deepEqual(currentRetention, {
        boundedSnapshots: 2,
        boundedSummaries: 1,
        currentSnapshots: 1,
        currentSummaries: 1,
      });

      const taskRef = randomUUID();
      await admin.query(
        `INSERT INTO restricted_data_task
          (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",
           state,revision,"confirmationVersion","requestedAt","guardedAt",
           "startedAt","retentionPolicyVersion","retentionScope",
           "retentionAnchorAt","expiresAt")
         VALUES ($1,$2,'DELETE','DAY','PRODUCT_DATE','2026-08-23',true,
                 'RUNNING',1,'day-delete-v1',$3,$3,$3,'retention-policy-v1',
                 'RUNTIME',$3,$4)`,
        [
          taskRef,
          accountId,
          new Date(baseNow.getTime() + 10_000),
          new Date(baseNow.getTime() + 30 * 24 * 60 * 60_000),
        ],
      );
      await admin.query(
        `INSERT INTO restricted_deletion_guard
          (id,"accountId",scope,"targetKey",revision,"deletionEpoch",
           "taskRef","semanticBlockedAt","retentionPolicyVersion",
           "retentionScope","retentionAnchorAt","expiresAt")
         VALUES (gen_random_uuid(),$1,'DAY','2026-08-23',1,1,$2,$3,
                 'retention-policy-v1','RUNTIME',$3,$4)`,
        [
          accountId,
          taskRef,
          new Date(baseNow.getTime() + 10_000),
          new Date(baseNow.getTime() + 30 * 24 * 60 * 60_000),
        ],
      );
      const afterGuard = await weekly.get({
        accountId,
        endProductDate: "2026-08-24",
      });
      assert.equal(afterGuard.status, "FOUND");
      assert.equal(afterGuard.value.coverage.level, "POINTS_ONLY");
      assert.equal(afterGuard.value.summary_status, "NOT_ELIGIBLE");
      assert.equal(afterGuard.value.summary, undefined);
      assert.ok(afterGuard.value.coverage.missing_dates.includes("2026-08-23"));

      const databaseState = (
        await admin.query(
          `SELECT
             (SELECT count(*)::int FROM app_weekly_source_snapshot) AS snapshots,
             (SELECT count(*)::int FROM app_weekly_summary_intent
               WHERE state='CANCELLED') AS cancelled,
             (SELECT count(*)::int
                FROM app_published_weekly_summary_revision) AS summaries,
             (SELECT count(*)::int FROM app_weekly_window
               WHERE "currentSummaryRef" IS NOT NULL) AS current_pointers`,
        )
      ).rows[0];
      assert.deepEqual(databaseState, {
        cancelled: 1,
        current_pointers: 1,
        snapshots: 3,
        summaries: 2,
      });
    } finally {
      await Promise.all(
        resources
          .reverse()
          .map((resource) =>
            typeof resource.close === "function"
              ? resource.close().catch(() => undefined)
              : typeof resource.end === "function"
                ? resource.end().catch(() => undefined)
                : Promise.resolve(),
          ),
      );
      await container.stop();
    }
  },
);
