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
const baseNow = new Date("2026-08-25T12:00:00.000Z");

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

async function createAccount(auth, label) {
  const result = await auth.establishSession({
    identity: {
      keyVersion: "synthetic-key-v1",
      providerCode: "WECHAT_MINIAPP",
      subjectCiphertext: bytes(`${label}:identity`),
      subjectLookupToken: bytes(`${label}:lookup`),
    },
    newAccount: {
      ownerScopeToken: bytes(`${label}:owner`),
      stableSubjectCiphertext: bytes(`${label}:subject`),
      stableSubjectKeyVersion: "synthetic-key-v1",
    },
    now: baseNow,
    session: {
      expiresAt: new Date(baseNow.getTime() + 30 * 24 * 60 * 60_000),
      issuedAt: baseNow,
      tokenHash: bytes(`${label}:session`),
    },
  });
  assert.equal(result.status, "ACTIVE");
  return result.session;
}

async function insertMatterFragment(admin, accountId, matterRef) {
  const checkinId = randomUUID();
  const intentId = randomUUID();
  const snapshotId = randomUUID();
  const resultId = randomUUID();
  const visibilityId = randomUUID();
  const slotId = randomUUID();
  const fragmentId = randomUUID();
  const dependencyId = randomUUID();
  await admin.query("BEGIN");
  try {
    await admin.query(
      `INSERT INTO app_morning_checkin
        (id,"accountId","productDate","productDatePolicyVersion",revision,
         mood,energy,sleep,"firstSubmittedAt","updatedAt","sourceCommandRef",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES ($1,$2,'2026-08-25','product-date-v1',1,'STEADY','STEADY','OKAY',
         $3,$3,$4,'retention-policy-v1','DAY',$3)`,
      [checkinId, accountId, baseNow, randomUUID()],
    );
    await admin.query(
      `INSERT INTO app_morning_checkin_revision
        (id,"checkinId",revision,mood,energy,sleep,"commandRef",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES (gen_random_uuid(),$1,1,'STEADY','STEADY','OKAY',$2,
         'retention-policy-v1','DAY',$3)`,
      [checkinId, randomUUID(), baseNow],
    );
    await admin.query(
      `INSERT INTO app_generation_intent
        (id,"accountId","targetProductDate","productDatePolicyVersion",
         "acceptedAt",revision,state,"resultVersion","manifestRef",
         "manifestFingerprint","inputSnapshotFingerprint","rootSeedMaterialRef",
         "completionGrantVersion","createdAt","updatedAt","retentionPolicyVersion",
         "retentionScope","retentionAnchorAt")
       VALUES ($1,$2,'2026-08-25','product-date-v1',$3,1,'RUNNING','result-v1',
         'manifest-v1',$4,$5,'seed-v1','grant-v1',$3,$3,'retention-policy-v1',
         'DAY',$3)`,
      [
        intentId,
        accountId,
        baseNow,
        bytes("matter-manifest"),
        bytes("matter-input"),
      ],
    );
    await admin.query(
      `INSERT INTO app_generation_input_snapshot
        (id,"generationIntentId","checkinId","checkinRevision","schemaVersion",
         "snapshotPayload","snapshotFingerprint","createdAt","retentionPolicyVersion",
         "retentionScope","retentionAnchorAt")
       VALUES ($1,$2,$3,1,'snapshot-v1','{}',$4,$5,'retention-policy-v1','DAY',$5)`,
      [snapshotId, intentId, checkinId, bytes("matter-snapshot"), baseNow],
    );
    await admin.query(
      `INSERT INTO app_published_daily_result
        (id,"accountId","generationIntentId","inputSnapshotId","productDate",
         "resultVersion","schemaVersion","generatedAt","ruleFactsPayload",
         "expressionCorePayload","provenancePayload","validationReceipt",
         "resultFingerprint","retentionPolicyVersion","retentionScope",
         "retentionAnchorAt")
       VALUES ($1,$2,$3,$4,'2026-08-25','result-v1','result-schema-v1',$5,
         '{}','{}','{}','{}',$6,'retention-policy-v1','DAY',$5)`,
      [
        resultId,
        accountId,
        intentId,
        snapshotId,
        baseNow,
        bytes("matter-result"),
      ],
    );
    await admin.query(
      `UPDATE app_generation_intent
       SET state='SUCCEEDED',"publishedResultRef"=$2,revision=2,"updatedAt"=$3
       WHERE id=$1`,
      [intentId, resultId, baseNow],
    );
    await admin.query(
      `INSERT INTO app_published_result_visibility
        (id,"resultId",state,revision,"sourceFingerprint","updatedAt",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES ($1,$2,'AVAILABLE',1,$3,$4,'retention-policy-v1','DAY',$4)`,
      [visibilityId, resultId, bytes("matter-visibility"), baseNow],
    );
    await admin.query(
      `INSERT INTO app_result_content_slot
        (id,"resultId","segmentPath","fallbackPayload","fallbackFingerprint",
         "fallbackSchemaVersion","createdAt","retentionPolicyVersion",
         "retentionScope","retentionAnchorAt")
       VALUES ($1,$2,'matter-segment','{"text":"safe fallback"}',$3,
         'fragment-v1',$4,'retention-policy-v1','DAY',$4)`,
      [slotId, resultId, bytes("matter-fallback"), baseNow],
    );
    await admin.query(
      `INSERT INTO app_personalized_content_fragment
        (id,"slotId","payloadCiphertext","payloadKeyVersion","payloadFingerprint",
         "schemaVersion","createdAt","retentionPolicyVersion","retentionScope",
         "retentionAnchorAt")
       VALUES ($1,$2,$3,'synthetic-key-v1',$4,'fragment-v1',$5,
         'retention-policy-v1','DAY',$5)`,
      [
        fragmentId,
        slotId,
        bytes("matter-personalized"),
        bytes("matter-fragment"),
        baseNow,
      ],
    );
    await admin.query(
      `INSERT INTO app_source_dependency
        (id,"fragmentId","sourceType","sourceRef","sourceRevision",purpose,
         "policyVersion","segmentPaths","fallbackPaths","validAtPublish",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES ($1,$2,'MATTER',$3,1,'DAILY_EXPRESSION','memory-policy-v1',
         ARRAY['matter-segment'],ARRAY['matter-segment'],true,
         'retention-policy-v1','DAY',$4)`,
      [dependencyId, fragmentId, matterRef, baseNow],
    );
    await admin.query("SET CONSTRAINTS ALL IMMEDIATE");
    await admin.query("COMMIT");
    return { dependencyId, fragmentId, slotId, visibilityId };
  } catch (error) {
    await admin.query("ROLLBACK");
    throw error;
  }
}

async function consume(queueStore, handler, envelope) {
  return queueStore.consumeInbox(
    "restricted-data-task",
    envelope,
    (transaction) => handler.handle(envelope, transaction),
  );
}

test(
  "C-014 PG18 TX-09, restricted cleanup, receipt and account destruction",
  {
    skip: integrationEnabled
      ? false
      : "set DATABASE_INTEGRATION=1 to run the real PostgreSQL 18 harness",
  },
  async () => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const resources = [];
    try {
      const adminUrl = container.getConnectionUri();
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      const { Client } = loadPg();
      const admin = await connect(Client, adminUrl, "c014-admin");
      resources.push(admin);
      const apiAdapters =
        await import("../../packages/server-adapters/dist/api/index.js");
      const restrictedApiAdapters =
        await import("../../packages/server-adapters/dist/api-restricted/index.js");
      const testingAdapters =
        await import("../../packages/server-adapters/dist/testing/index.js");
      const restrictedAdapters =
        await import("../../packages/server-adapters/dist/worker-restricted/index.js");
      const auth = await apiAdapters.PostgresAuthStore.connect({
        applicationName: "c014-auth",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const rights = await apiAdapters.PostgresDataRightsStore.connect({
        applicationName: "c014-rights",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const eveningSafety =
        await restrictedApiAdapters.PostgresEveningSafetyStore.connect({
          applicationName: "c014-evening-safety",
          connectionString: loginUrls.safety,
          expectedDatabaseRole: "daily_energy_safety",
        });
      const queue = await testingAdapters.PostgresQueueStore.connect({
        applicationName: "c014-deletion-queue",
        connectionString: loginUrls.deletion,
        expectedDatabaseRole: "daily_energy_deletion",
        profile: "worker-restricted",
      });
      resources.push(auth, rights, eveningSafety, queue);

      await assert.rejects(
        connect(Client, loginUrls.api, "c014-api-forbidden").then(
          async (client) => {
            try {
              await client.query("SELECT * FROM restricted_data_task");
            } finally {
              await client.end();
            }
          },
        ),
        /permission denied/iu,
      );

      const raceSession = await createAccount(auth, "c014-account-fence-race");
      const raceCheckinRef = randomUUID();
      await admin.query(
        `INSERT INTO app_morning_checkin
          (id,"accountId","productDate","productDatePolicyVersion",revision,
           mood,energy,sleep,"firstSubmittedAt","updatedAt","sourceCommandRef",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES ($1,$2,'2026-08-24','product-date-v1',1,'STEADY','STEADY','OKAY',
           $3,$3,$4,'retention-policy-v1','DAY',$3)`,
        [raceCheckinRef, raceSession.accountId, baseNow, randomUUID()],
      );
      await admin.query(
        `INSERT INTO app_morning_checkin_revision
          (id,"checkinId",revision,mood,energy,sleep,"commandRef",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,1,'STEADY','STEADY','OKAY',$2,
           'retention-policy-v1','DAY',$3)`,
        [raceCheckinRef, randomUUID(), baseNow],
      );
      const accountFence = await connect(
        Client,
        adminUrl,
        "c014-account-fence-race",
      );
      resources.push(accountFence);
      await accountFence.query("BEGIN");
      await accountFence.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1::text,20400))",
        [raceSession.accountId],
      );
      const dayAttempt = rights
        .deleteDay({
          accountId: raceSession.accountId,
          commandRef: "c014-race-delete-day",
          confirmationVersion: "data-rights-day-v1",
          expectedRevision: 1,
          fingerprint: bytes("c014-race-delete-day"),
          now: new Date(baseNow.getTime() + 500),
          productDate: "2026-08-24",
        })
        .then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
      const safetyAttempt = eveningSafety
        .activate({
          accountId: raceSession.accountId,
          categoryCodes: ["SELF_HARM"],
          classifierVersion: "synthetic-classifier-v1",
          commandRef: "c014-race-evening-safety",
          irreversibleFingerprint: bytes("c014-race-evening-safety"),
          now: new Date(baseNow.getTime() + 501),
          policyVersion: "safety-v1",
          ruleVersion: "safety-rules-v1",
        })
        .then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
      await new Promise((resolve) => setImmediate(resolve));
      await accountFence.query(
        `UPDATE app_user_account
            SET state='DELETING',revision=revision+1,"updatedAt"=$2
          WHERE id=$1`,
        [raceSession.accountId, new Date(baseNow.getTime() + 502)],
      );
      await accountFence.query("COMMIT");
      const [dayOutcome, safetyOutcome] = await Promise.all([
        dayAttempt,
        safetyAttempt,
      ]);
      assert.equal(dayOutcome.error?.code, "ACCOUNT_DELETING");
      assert.match(
        safetyOutcome.error?.message ?? "",
        /EVENING_SAFETY_ACCOUNT_NOT_ACTIVE/u,
      );
      const raceWrites = (
        await admin.query(
          `SELECT
             (SELECT count(*)::int FROM restricted_data_task
               WHERE "accountId"=$1) AS tasks,
             (SELECT count(*)::int FROM restricted_deletion_guard
               WHERE "accountId"=$1) AS guards,
             (SELECT count(*)::int FROM restricted_safety_state
               WHERE "accountId"=$1) AS safety_states,
             (SELECT count(*)::int FROM restricted_safety_decision
               WHERE "accountId"=$1) AS safety_decisions`,
          [raceSession.accountId],
        )
      ).rows[0];
      assert.deepEqual(raceWrites, {
        guards: 0,
        safety_decisions: 0,
        safety_states: 0,
        tasks: 0,
      });

      const daySession = await createAccount(auth, "c014-day");
      const checkinRef = randomUUID();
      await admin.query(
        `INSERT INTO app_morning_checkin
          (id,"accountId","productDate","productDatePolicyVersion",revision,
           mood,energy,sleep,"firstSubmittedAt","updatedAt","sourceCommandRef",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES ($1,$2,'2026-08-24','product-date-v1',1,'STEADY','STEADY','OKAY',
           $3,$3,$4,'retention-policy-v1','DAY',$3)`,
        [checkinRef, daySession.accountId, baseNow, randomUUID()],
      );
      await admin.query(
        `INSERT INTO app_morning_checkin_revision
          (id,"checkinId",revision,mood,energy,sleep,"commandRef",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,1,'STEADY','STEADY','OKAY',$2,
           'retention-policy-v1','DAY',$3)`,
        [checkinRef, randomUUID(), baseNow],
      );
      const dayTask = await rights.deleteDay({
        accountId: daySession.accountId,
        commandRef: "c014-delete-day-command",
        confirmationVersion: "data-rights-day-v1",
        expectedRevision: 1,
        fingerprint: bytes("c014-delete-day"),
        now: new Date(baseNow.getTime() + 1_000),
        productDate: "2026-08-24",
      });
      assert.equal(dayTask.status, "PENDING");
      const guard = (
        await admin.query(
          `SELECT "deletionEpoch"::text AS epoch FROM restricted_deletion_guard
           WHERE "taskRef"=$1`,
          [dayTask.task_ref],
        )
      ).rows[0];
      assert.equal(guard.epoch, "1");
      const due = await queue.listDataTasksDue(
        10,
        new Date(baseNow.getTime() + 2_000),
      );
      const dayEnvelope = due.find(
        (item) => item.aggregateRef === dayTask.task_ref,
      );
      assert.ok(dayEnvelope);
      const dayHandler = restrictedAdapters
        .createDataTaskHandlers(() => new Date(baseNow.getTime() + 2_000))
        .find((item) => item.eventType === "DataTaskDue");
      assert.ok(dayHandler);
      assert.equal(
        (await consume(queue, dayHandler, dayEnvelope)).outcomeCode,
        "SUCCEEDED",
      );
      assert.equal(
        Number(
          (
            await admin.query(
              `SELECT count(*) AS count FROM app_morning_checkin
               WHERE "accountId"=$1 AND "productDate"='2026-08-24'`,
              [daySession.accountId],
            )
          ).rows[0].count,
        ),
        0,
      );
      const dayEvidence = (
        await admin.query(
          `SELECT
             (SELECT count(*)::int FROM restricted_day_erasure_guard
               WHERE "deletionTaskRef"=$1) AS day_guard,
             (SELECT count(*)::int FROM restricted_restore_deny_record
               WHERE "caseRef" IN (SELECT "caseRef" FROM restricted_deletion_receipt
                 WHERE "taskRef"=$1)) AS restore_deny,
             (SELECT count(*)::int FROM restricted_deletion_receipt
               WHERE "taskRef"=$1 AND outcome='SUCCEEDED') AS receipt`,
          [dayTask.task_ref],
        )
      ).rows[0];
      assert.deepEqual(dayEvidence, {
        day_guard: 1,
        receipt: 1,
        restore_deny: 1,
      });

      const matterSession = await createAccount(auth, "c014-matter");
      const matterRef = randomUUID();
      await admin.query(
        `INSERT INTO app_important_matter
          (id,"accountId",revision,"titleCiphertext","titleKeyVersion",state,
           "createdProductDate","createdAt","updatedAt","retentionPolicyVersion",
           "retentionScope","retentionAnchorAt")
         VALUES ($1,$2,1,$3,'synthetic-key-v1','ACTIVE','2026-08-25',$4,$4,
           'retention-policy-v1','MATTER',$4)`,
        [matterRef, matterSession.accountId, bytes("matter-title"), baseNow],
      );
      await admin.query(
        `INSERT INTO app_important_matter_revision
          (id,"matterId",revision,"titleCiphertext","titleKeyVersion",state,
           "commandRef","createdAt","retentionPolicyVersion","retentionScope",
           "retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,1,$2,'synthetic-key-v1','ACTIVE',$3,$4,
           'retention-policy-v1','MATTER',$4)`,
        [matterRef, bytes("matter-title"), randomUUID(), baseNow],
      );
      const matterFragment = await insertMatterFragment(
        admin,
        matterSession.accountId,
        matterRef,
      );
      const matterTask = await rights.deleteMatter({
        accountId: matterSession.accountId,
        commandRef: "c014-delete-matter-command",
        confirmationVersion: "data-rights-matter-v1",
        expectedRevision: 1,
        fingerprint: bytes("c014-delete-matter"),
        matterRef,
        now: new Date(baseNow.getTime() + 3_000),
      });
      const matterDue = (
        await queue.listDataTasksDue(20, new Date(baseNow.getTime() + 4_000))
      ).find((item) => item.aggregateRef === matterTask.task_ref);
      assert.ok(matterDue);
      const matterHandler = restrictedAdapters
        .createDataTaskHandlers(() => new Date(baseNow.getTime() + 4_000))
        .find((item) => item.eventType === "DataTaskDue");
      assert.ok(matterHandler);
      assert.equal(
        (await consume(queue, matterHandler, matterDue)).outcomeCode,
        "SUCCEEDED",
      );
      assert.equal(
        Number(
          (
            await admin.query(
              `SELECT count(*) AS count FROM app_important_matter WHERE id=$1`,
              [matterRef],
            )
          ).rows[0].count,
        ),
        0,
      );
      const matterDerivedState = (
        await admin.query(
          `SELECT
             (SELECT count(*)::int FROM app_source_dependency WHERE id=$1)
               AS dependencies,
             (SELECT count(*)::int FROM app_personalized_content_fragment WHERE id=$2)
               AS fragments,
             (SELECT state::text FROM app_published_result_visibility WHERE id=$3)
               AS visibility,
             (SELECT "fallbackPayload" IS NOT NULL FROM app_result_content_slot WHERE id=$4)
               AS fallback`,
          [
            matterFragment.dependencyId,
            matterFragment.fragmentId,
            matterFragment.visibilityId,
            matterFragment.slotId,
          ],
        )
      ).rows[0];
      assert.deepEqual(matterDerivedState, {
        dependencies: 0,
        fallback: true,
        fragments: 0,
        visibility: "AVAILABLE",
      });

      const relationshipSession = await createAccount(
        auth,
        "c014-relationship",
      );
      const relationshipCheckin = randomUUID();
      await admin.query(
        `INSERT INTO app_morning_checkin
          (id,"accountId","productDate","productDatePolicyVersion",revision,
           mood,energy,sleep,"firstSubmittedAt","updatedAt","sourceCommandRef",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES ($1,$2,'2026-08-24','product-date-v1',1,'GOOD','HIGH','GOOD',
           $3,$3,$4,'retention-policy-v1','DAY',$3)`,
        [
          relationshipCheckin,
          relationshipSession.accountId,
          baseNow,
          randomUUID(),
        ],
      );
      await admin.query(
        `INSERT INTO app_relationship_cycle
          (id,"accountId",revision,"startedAt","sourceCutoffEpoch",state,
           "activeSlot","projectionFingerprint","retentionPolicyVersion",
           "retentionScope","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,1,$2,0,'ACTIVE',true,$3,
           'retention-policy-v1','RELATIONSHIP_DATA',$2)`,
        [relationshipSession.accountId, baseNow, bytes("relationship")],
      );
      const rightsSummary = await rights.getSummary(
        relationshipSession.accountId,
        new Date(baseNow.getTime() + 4_500),
      );
      assert.equal(rightsSummary.account.expected_revision, 1);
      assert.equal(rightsSummary.relationship.expected_revision, 1);
      assert.equal(rightsSummary.capabilities.delete_relationship_data, true);
      assert.equal(rightsSummary.online_erasure_sla_hours, 72);
      assert.equal(rightsSummary.backup_max_days, 35);
      assert.equal(
        JSON.stringify(rightsSummary).includes("account_ref"),
        false,
      );
      const frozenRelationship = {
        expected_day_revisions: [],
        target: {
          included_day_product_dates: [],
          relationship_scope: "CURRENT_CYCLE_AND_HISTORY",
        },
      };
      const relationshipConfirmation = await rights.prepareRelationshipDeletion(
        {
          accountId: relationshipSession.accountId,
          commandRef: "c014-prepare-relationship",
          confirmationVersion: "data-rights-relationship-v1",
          expectedRelationshipRevision: 1,
          fingerprint: bytes("c014-prepare-relationship"),
          frozenPayload: frozenRelationship,
          now: new Date(baseNow.getTime() + 5_000),
        },
      );
      const relationshipConfirmationReplay =
        await rights.prepareRelationshipDeletion({
          accountId: relationshipSession.accountId,
          commandRef: "c014-prepare-relationship",
          confirmationVersion: "data-rights-relationship-v1",
          expectedRelationshipRevision: 1,
          fingerprint: bytes("c014-prepare-relationship"),
          frozenPayload: frozenRelationship,
          now: new Date(baseNow.getTime() + 5_500),
        });
      assert.deepEqual(
        relationshipConfirmationReplay,
        relationshipConfirmation,
      );
      const relationshipTask = await rights.confirmRelationshipDeletion({
        accountId: relationshipSession.accountId,
        challengeRef: relationshipConfirmation.confirmation_challenge_ref,
        commandRef: "c014-confirm-relationship",
        confirmationVersion: relationshipConfirmation.confirmation_version,
        expectedRelationshipRevision:
          relationshipConfirmation.expected_revision,
        fingerprint: bytes("c014-confirm-relationship"),
        frozenPayload: frozenRelationship,
        now: new Date(baseNow.getTime() + 6_000),
      });
      const relationshipDue = (
        await queue.listDataTasksDue(20, new Date(baseNow.getTime() + 7_000))
      ).find((item) => item.aggregateRef === relationshipTask.task_ref);
      assert.ok(relationshipDue);
      const relationshipHandler = restrictedAdapters
        .createDataTaskHandlers(() => new Date(baseNow.getTime() + 7_000))
        .find((item) => item.eventType === "DataTaskDue");
      assert.ok(relationshipHandler);
      assert.equal(
        (await consume(queue, relationshipHandler, relationshipDue))
          .outcomeCode,
        "SUCCEEDED",
      );
      const relationshipState = (
        await admin.query(
          `SELECT
             (SELECT count(*)::int FROM app_relationship_cycle
               WHERE "accountId"=$1) AS cycles,
             (SELECT count(*)::int FROM app_morning_checkin
               WHERE "accountId"=$1 AND "productDate"='2026-08-24') AS days,
             (SELECT "releasedAt" IS NOT NULL FROM restricted_deletion_guard
               WHERE "taskRef"=$2) AS released,
             (daily_energy.resolve_c011_relationship_guard($1)->>'blocked')::boolean
               AS blocked`,
          [relationshipSession.accountId, relationshipTask.task_ref],
        )
      ).rows[0];
      assert.deepEqual(relationshipState, {
        blocked: false,
        cycles: 0,
        days: 1,
        released: true,
      });

      const exportTask = await rights.createExport({
        accountId: relationshipSession.accountId,
        commandRef: "c014-export-command",
        confirmationVersion: "data-export-v1",
        fingerprint: bytes("c014-export"),
        now: new Date(baseNow.getTime() + 8_000),
      });
      const exportReplay = await rights.createExport({
        accountId: relationshipSession.accountId,
        commandRef: "c014-export-command",
        confirmationVersion: "data-export-v1",
        fingerprint: bytes("c014-export"),
        now: new Date(baseNow.getTime() + 8_001),
      });
      assert.equal(exportReplay.task_ref, exportTask.task_ref);
      const exportDue = (
        await queue.listDataTasksDue(20, new Date(baseNow.getTime() + 9_000))
      ).find((item) => item.aggregateRef === exportTask.task_ref);
      assert.ok(exportDue);
      const exportHandler = restrictedAdapters
        .createDataTaskHandlers(() => new Date(baseNow.getTime() + 9_000))
        .find((item) => item.eventType === "DataTaskDue");
      assert.ok(exportHandler);
      assert.equal(
        (await consume(queue, exportHandler, exportDue)).outcomeCode,
        "SUCCEEDED",
      );
      const readyExport = await rights.getTask(
        relationshipSession.accountId,
        exportTask.task_ref,
        new Date(baseNow.getTime() + 9_500),
      );
      assert.equal(readyExport.status, "SUCCEEDED");
      assert.equal(readyExport.online_erased_at, undefined);
      assert.equal(readyExport.backup_purge_deadline, undefined);
      assert.equal(readyExport.export_artifact.state, "READY");
      const manifestColumns = (
        await admin.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema='daily_energy'
             AND table_name='restricted_export_manifest'
           ORDER BY column_name`,
        )
      ).rows.map((row) => row.column_name);
      assert.equal(
        manifestColumns.some((column) =>
          /body|content|payload|object/iu.test(column),
        ),
        false,
      );
      const firstDownload = await rights.readExportArtifact({
        accountId: relationshipSession.accountId,
        downloadRef: readyExport.export_artifact.download_ref,
        now: new Date(baseNow.getTime() + 10_000),
        taskRef: exportTask.task_ref,
      });
      const repeatedDownload = await rights.readExportArtifact({
        accountId: relationshipSession.accountId,
        downloadRef: readyExport.export_artifact.download_ref,
        now: new Date(baseNow.getTime() + 10_500),
        taskRef: exportTask.task_ref,
      });
      assert.equal(firstDownload.status, "READY");
      assert.equal(firstDownload.source.days.length, 1);
      assert.deepEqual(repeatedDownload, firstDownload);
      await admin.query(
        `UPDATE app_morning_checkin SET revision=2,mood='LIGHT',"updatedAt"=$3
         WHERE "accountId"=$1 AND "productDate"=$2::date`,
        [
          relationshipSession.accountId,
          "2026-08-24",
          new Date(baseNow.getTime() + 11_000),
        ],
      );
      assert.deepEqual(
        await rights.readExportArtifact({
          accountId: relationshipSession.accountId,
          downloadRef: readyExport.export_artifact.download_ref,
          now: new Date(baseNow.getTime() + 11_500),
          taskRef: exportTask.task_ref,
        }),
        { status: "SOURCE_CHANGED" },
      );
      assert.equal(
        (
          await rights.getTask(
            relationshipSession.accountId,
            exportTask.task_ref,
            new Date(baseNow.getTime() + 11_600),
          )
        ).export_artifact.state,
        "INVALIDATED",
      );

      const expiryTask = await rights.createExport({
        accountId: relationshipSession.accountId,
        commandRef: "c014-export-expiry-command",
        confirmationVersion: "data-export-v1",
        fingerprint: bytes("c014-export-expiry"),
        now: new Date(baseNow.getTime() + 12_000),
      });
      const expiryDue = (
        await queue.listDataTasksDue(20, new Date(baseNow.getTime() + 13_000))
      ).find((item) => item.aggregateRef === expiryTask.task_ref);
      assert.ok(expiryDue);
      assert.equal(
        (
          await consume(
            queue,
            restrictedAdapters
              .createDataTaskHandlers(
                () => new Date(baseNow.getTime() + 13_000),
              )
              .find((item) => item.eventType === "DataTaskDue"),
            expiryDue,
          )
        ).outcomeCode,
        "SUCCEEDED",
      );
      const expiringExport = await rights.getTask(
        relationshipSession.accountId,
        expiryTask.task_ref,
        new Date(baseNow.getTime() + 13_500),
      );
      const retentionNow = new Date(
        baseNow.getTime() + 13_000 + 24 * 60 * 60_000,
      );
      const exportRetentionDue = (
        await queue.listDataTasksDue(20, retentionNow)
      ).find((item) => item.aggregateRef === expiryTask.task_ref);
      assert.ok(exportRetentionDue);
      assert.equal(exportRetentionDue.eventType, "DataRightsRetentionDue");
      assert.equal(
        (
          await consume(
            queue,
            restrictedAdapters
              .createDataTaskHandlers(() => retentionNow)
              .find((item) => item.eventType === "DataRightsRetentionDue"),
            exportRetentionDue,
          )
        ).outcomeCode,
        "EXPORT_ARTIFACT_EXPIRED",
      );
      assert.deepEqual(
        await rights.readExportArtifact({
          accountId: relationshipSession.accountId,
          downloadRef: expiringExport.export_artifact.download_ref,
          now: retentionNow,
          taskRef: expiryTask.task_ref,
        }),
        { status: "EXPIRED" },
      );
      assert.equal(
        (await queue.listDataTasksDue(20, retentionNow)).some(
          (item) => item.aggregateRef === exportTask.task_ref,
        ),
        false,
      );

      const accountSession = await createAccount(auth, "c014-account");
      const confirmation = await rights.prepareAccountDeletion({
        accountId: accountSession.accountId,
        commandRef: "c014-prepare-account",
        confirmationVersion: "data-rights-account-v1",
        expectedAccountRevision: 1,
        fingerprint: bytes("c014-prepare-account"),
        now: new Date(baseNow.getTime() + 3_000),
      });
      const confirmationReplay = await rights.prepareAccountDeletion({
        accountId: accountSession.accountId,
        commandRef: "c014-prepare-account",
        confirmationVersion: "data-rights-account-v1",
        expectedAccountRevision: 1,
        fingerprint: bytes("c014-prepare-account"),
        now: new Date(baseNow.getTime() + 3_500),
      });
      assert.deepEqual(confirmationReplay, confirmation);
      await assert.rejects(
        rights.verifyIdentity({
          accountId: accountSession.accountId,
          challengeRef: confirmation.confirmation_challenge_ref,
          commandRef: "c014-verify-wrong-identity",
          fingerprint: bytes("c014-verify-wrong-identity"),
          now: new Date(baseNow.getTime() + 3_600),
          subjectLookupToken: bytes("wrong-identity"),
        }),
        (error) => error?.code === "IDENTITY_MISMATCH",
      );
      const verification = await rights.verifyIdentity({
        accountId: accountSession.accountId,
        challengeRef: confirmation.confirmation_challenge_ref,
        commandRef: "c014-verify-account",
        fingerprint: bytes("c014-verify-account"),
        now: new Date(baseNow.getTime() + 4_000),
        subjectLookupToken: bytes("c014-account:lookup"),
      });
      const verificationReplay = await rights.verifyIdentity({
        accountId: accountSession.accountId,
        challengeRef: confirmation.confirmation_challenge_ref,
        commandRef: "c014-verify-account",
        fingerprint: bytes("c014-verify-account"),
        now: new Date(baseNow.getTime() + 4_500),
        subjectLookupToken: bytes("c014-account:lookup"),
      });
      assert.deepEqual(verificationReplay, verification);
      await assert.rejects(
        rights.verifyIdentity({
          accountId: accountSession.accountId,
          challengeRef: randomUUID(),
          commandRef: "c014-verify-account",
          fingerprint: bytes("different-challenge"),
          now: new Date(baseNow.getTime() + 4_600),
          subjectLookupToken: bytes("c014-account:lookup"),
        }),
        (error) => error?.code === "IDEMPOTENCY_CONFLICT",
      );
      const statusTokenHash = bytes("c014-account-status-token");
      const accountAccepted = await rights.confirmAccountDeletion({
        accountId: accountSession.accountId,
        challengeRef: confirmation.confirmation_challenge_ref,
        commandRef: "c014-confirm-account",
        confirmationVersion: confirmation.confirmation_version,
        expectedAccountRevision: confirmation.expected_revision,
        fingerprint: bytes("c014-confirm-account"),
        identityVerificationRef: verification.identity_verification_ref,
        now: new Date(baseNow.getTime() + 5_000),
        statusTokenHash,
      });
      const accountTask = accountAccepted.task;
      assert.equal(accountAccepted.statusGrant.taskRef, accountTask.task_ref);
      assert.deepEqual(
        await rights.getDeletionStatus(
          accountTask.task_ref,
          bytes("wrong-status-token"),
          new Date(baseNow.getTime() + 5_001),
        ),
        undefined,
      );
      assert.equal(
        (
          await rights.getDeletionStatus(
            accountTask.task_ref,
            statusTokenHash,
            new Date(baseNow.getTime() + 5_002),
          )
        ).status,
        "PENDING",
      );
      assert.equal(
        (
          await auth.inspectSession(
            bytes("c014-account:session"),
            new Date(baseNow.getTime() + 5_001),
          )
        ).status,
        "REVOKED",
      );
      const accountDue = (
        await queue.listDataTasksDue(10, new Date(baseNow.getTime() + 6_000))
      ).find((item) => item.aggregateRef === accountTask.task_ref);
      assert.ok(accountDue);
      const accountOwnerToken = (
        await admin.query(
          `SELECT "ownerScopeToken" AS token FROM app_user_account WHERE id=$1`,
          [accountSession.accountId],
        )
      ).rows[0].token;
      const holdRef = randomUUID();
      await admin.query(
        `INSERT INTO restricted_legal_hold
          (id,"holdRef","blindedSubjectToken","scopeCode","dataCategoryCodes",
           "legalBasisRef","approvalRef","startedAt","reviewDueAt","endsAt",
           state,"retentionPolicyVersion","retentionScope","retentionAnchorAt",
           "expiresAt")
         VALUES (gen_random_uuid(),$1,$2,'ACCOUNT',ARRAY['ACCOUNT'],
           'synthetic-legal-basis','synthetic-approval',$3::timestamptz,
           $4::timestamptz,$4::timestamptz,'ACTIVE','retention-policy-v1',
           'LEGAL_EVIDENCE',$3::timestamptz,$4::timestamptz+interval '72 hours')`,
        [
          holdRef,
          accountOwnerToken,
          baseNow,
          new Date(baseNow.getTime() + 30 * 24 * 60 * 60_000),
        ],
      );
      const accountHandler = restrictedAdapters
        .createDataTaskHandlers(() => new Date(baseNow.getTime() + 6_000))
        .find((item) => item.eventType === "DataTaskDue");
      assert.ok(accountHandler);
      assert.equal(
        (await consume(queue, accountHandler, accountDue)).outcomeCode,
        "RESTRICTED_LEGAL_HOLD",
      );
      const blockedAccount = (
        await admin.query(
          `SELECT account.state::text AS state,task.state::text AS task_state,
                  task."failureScopeCodes" AS failures
             FROM app_user_account account
             JOIN restricted_data_task task ON task."accountId"=account.id
            WHERE account.id=$1 AND task.id=$2`,
          [accountSession.accountId, accountTask.task_ref],
        )
      ).rows[0];
      assert.deepEqual(blockedAccount, {
        failures: ["RESTRICTED_LEGAL_HOLD"],
        state: "DELETING",
        task_state: "FAILED",
      });
      assert.equal(
        (
          await rights.getDeletionStatus(
            accountTask.task_ref,
            statusTokenHash,
            new Date(baseNow.getTime() + 6_100),
          )
        ).status,
        "FAILED",
      );
      await admin.query(
        `DELETE FROM restricted_legal_hold WHERE "holdRef"=$1`,
        [holdRef],
      );
      await admin.query(`
        CREATE OR REPLACE FUNCTION c014_fail_restricted_evidence()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SYNTHETIC_C014_STEP_3';
        END;
        $$;
        CREATE TRIGGER c014_fail_restricted_evidence_trigger
        BEFORE INSERT ON restricted_restore_deny_record
        FOR EACH ROW EXECUTE FUNCTION c014_fail_restricted_evidence();
      `);
      const accountRetryDue = (
        await queue.listDataTasksDue(10, new Date(baseNow.getTime() + 7_000))
      ).find((item) => item.aggregateRef === accountTask.task_ref);
      assert.ok(accountRetryDue);
      assert.notEqual(accountRetryDue.eventId, accountDue.eventId);
      assert.equal(accountRetryDue.aggregateRef, accountDue.aggregateRef);
      const accountRetryHandler = restrictedAdapters
        .createDataTaskHandlers(() => new Date(baseNow.getTime() + 7_000))
        .find((item) => item.eventType === "DataTaskDue");
      assert.ok(accountRetryHandler);
      assert.equal(
        (await consume(queue, accountRetryHandler, accountRetryDue))
          .outcomeCode,
        "RESTRICTED_EVIDENCE_FAILED",
      );
      const thirdStepFailure = (
        await admin.query(
          `SELECT account.state::text AS state,task.state::text AS task_state,
                  checkpoint.state::text AS checkpoint_state,
                  checkpoint."lastStableFailureCode" AS checkpoint_failure,
                  (SELECT count(*)::int FROM app_external_identity
                    WHERE "accountId"=account.id) AS identities
             FROM app_user_account account
             JOIN restricted_data_task task ON task."accountId"=account.id
             JOIN restricted_deletion_step_checkpoint checkpoint
               ON checkpoint."taskId"=task.id
              AND checkpoint."subsystemCode"='RESTRICTED_EVIDENCE'
            WHERE account.id=$1 AND task.id=$2`,
          [accountSession.accountId, accountTask.task_ref],
        )
      ).rows[0];
      assert.deepEqual(thirdStepFailure, {
        checkpoint_failure: "RESTRICTED_EVIDENCE_WRITE_FAILED",
        checkpoint_state: "FAILED",
        identities: 0,
        state: "DELETING",
        task_state: "FAILED",
      });
      await admin.query(`
        DROP TRIGGER c014_fail_restricted_evidence_trigger
          ON restricted_restore_deny_record;
        DROP FUNCTION c014_fail_restricted_evidence();
      `);
      const accountEvidenceRetryDue = (
        await queue.listDataTasksDue(10, new Date(baseNow.getTime() + 8_000))
      ).find((item) => item.aggregateRef === accountTask.task_ref);
      assert.ok(accountEvidenceRetryDue);
      assert.notEqual(accountEvidenceRetryDue.eventId, accountRetryDue.eventId);
      assert.equal(
        (
          await consume(
            queue,
            restrictedAdapters
              .createDataTaskHandlers(() => new Date(baseNow.getTime() + 8_000))
              .find((item) => item.eventType === "DataTaskDue"),
            accountEvidenceRetryDue,
          )
        ).outcomeCode,
        "SUCCEEDED",
      );
      const accountEvidence = (
        await admin.query(
          `SELECT account.state::text AS state,
                  account."stableSubjectKeyVersion" AS key_version,
                  (SELECT count(*)::int FROM app_external_identity
                    WHERE "accountId"=account.id) AS identities,
                  (SELECT count(*)::int FROM restricted_deletion_receipt receipt
                    WHERE receipt."taskRef"=$2
                      AND receipt."blindedSubjectToken" IS NULL) AS receipt
             FROM app_user_account account WHERE account.id=$1`,
          [accountSession.accountId, accountTask.task_ref],
        )
      ).rows[0];
      assert.deepEqual(accountEvidence, {
        identities: 0,
        key_version: "destroyed-c014-v1",
        receipt: 1,
        state: "DELETED",
      });
      assert.equal(
        (
          await rights.getDeletionStatus(
            accountTask.task_ref,
            statusTokenHash,
            new Date(baseNow.getTime() + 8_100),
          )
        ).status,
        "SUCCEEDED",
      );
      assert.equal(
        await rights.getDeletionStatus(
          accountTask.task_ref,
          statusTokenHash,
          new Date(baseNow.getTime() + 8_200),
        ),
        undefined,
      );
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
