#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  loadPg,
  loadTestcontainers,
  POSTGRES_IMAGE,
  runNode,
} from "./container-harness.mjs";

const integrationEnabled = process.env.DATABASE_INTEGRATION === "1";
const transactionMetadata = Object.freeze(
  Array.from({ length: 9 }, (_, index) => ({
    test_id: `T-DB-TX-${String(index + 1).padStart(3, "0")}`,
    source_ids: [`TX-${String(index + 1).padStart(2, "0")}`],
    level: "DB",
    workload_or_profile: "TEST",
    fixture_version: "synthetic-v1",
    fault_id: `TX-${String(index + 1).padStart(2, "0")}-ROLLBACK`,
    expected_codes: ["COMMITTED", "ROLLED_BACK"],
    evidence_class: "PR",
  })),
);
const ts = "2026-07-30T00:00:00.000Z";
const later = "2026-08-06T00:00:00.000Z";
const hex = (value) => Buffer.from(value.padEnd(64, "0").slice(0, 64), "hex");
const id = () => randomUUID();

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

async function transaction(client, callback) {
  await client.query("BEGIN");
  try {
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function expectRollback(client, callback, pattern) {
  await assert.rejects(transaction(client, callback), pattern);
}

async function count(client, table, predicate, values = []) {
  const result = await client.query(
    `SELECT count(*)::int AS count FROM ${table} WHERE ${predicate}`,
    values,
  );
  return result.rows[0].count;
}

async function waitUntilBlocked(observer, applicationName) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await observer.query(
      `SELECT wait_event_type, wait_event
         FROM pg_stat_activity
        WHERE application_name = $1 AND state = 'active'`,
      [applicationName],
    );
    if (result.rows.some((row) => row.wait_event_type === "Lock")) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`TX_BARRIER_NOT_BLOCKED:${applicationName}`);
}

async function account(client, suffix) {
  const accountId = id();
  await client.query(
    `INSERT INTO app_user_account
      (id, "ownerScopeToken", "stableSubjectCiphertext", "stableSubjectKeyVersion", state, revision,
       "lastActiveUseAt", "inactivityDeletionDueAt", "updatedAt", "retentionPolicyVersion", "retentionAnchorAt")
     VALUES ($1, $2, $3, 'synthetic-key-v1', 'ACTIVE', 1, $4, $5, $4, 'retention-policy-v1', $4)`,
    [accountId, hex(`aa${suffix}`), hex(`bb${suffix}`), ts, later],
  );
  return accountId;
}

async function dailyPublication(client, accountId, productDate, suffix) {
  const checkinId = id();
  const intentId = id();
  const snapshotId = id();
  const resultId = id();
  await client.query(
    `INSERT INTO app_morning_checkin
      (id, "accountId", "productDate", "productDatePolicyVersion", revision, mood, energy, sleep,
       "firstSubmittedAt", "updatedAt", "sourceCommandRef", "retentionPolicyVersion", "retentionAnchorAt")
     VALUES ($1,$2,$3,'product-date-v1',1,'STEADY','STEADY','OKAY',$4,$4,$5,'retention-policy-v1',$4)`,
    [checkinId, accountId, productDate, ts, id()],
  );
  await client.query(
    `INSERT INTO app_generation_intent
      (id,"accountId","targetProductDate","productDatePolicyVersion","acceptedAt",revision,state,
       "resultVersion","manifestRef","manifestFingerprint","inputSnapshotFingerprint","rootSeedMaterialRef",
       "completionGrantVersion","createdAt","updatedAt","retentionPolicyVersion","retentionAnchorAt")
     VALUES ($1,$2,$3,'product-date-v1',$4,1,'QUEUED','result-v1','manifest-v1',$5,$6,'seed-v1',
             'grant-v1',$4,$4,'retention-policy-v1',$4)`,
    [
      intentId,
      accountId,
      productDate,
      ts,
      hex(`c1${suffix}`),
      hex(`c2${suffix}`),
    ],
  );
  await client.query(
    `INSERT INTO app_generation_input_snapshot
      (id,"generationIntentId","checkinId","checkinRevision","schemaVersion","snapshotPayload",
       "snapshotFingerprint","retentionPolicyVersion","retentionAnchorAt")
     VALUES ($1,$2,$3,1,'snapshot-v1','{}',$4,'retention-policy-v1',$5)`,
    [snapshotId, intentId, checkinId, hex(`c3${suffix}`), ts],
  );
  await client.query(
    `INSERT INTO app_published_daily_result
      (id,"accountId","generationIntentId","inputSnapshotId","productDate","resultVersion","schemaVersion",
       "generatedAt","ruleFactsPayload","expressionCorePayload","provenancePayload","validationReceipt",
       "resultFingerprint","retentionPolicyVersion","retentionAnchorAt")
     VALUES ($1,$2,$3,$4,$5,'result-v1','result-schema-v1',$6,'{}','{}','{}','{}',$7,'retention-policy-v1',$6)`,
    [
      resultId,
      accountId,
      intentId,
      snapshotId,
      productDate,
      ts,
      hex(`c4${suffix}`),
    ],
  );
  await client.query(
    `UPDATE app_generation_intent SET state='SUCCEEDED', "publishedResultRef"=$2, revision=2, "updatedAt"=$3 WHERE id=$1`,
    [intentId, resultId, ts],
  );
  return { checkinId, intentId, snapshotId, resultId };
}

async function interaction(client, accountId, productDate, suffix) {
  const publication = await dailyPublication(
    client,
    accountId,
    productDate,
    suffix,
  );
  const interactionId = id();
  await client.query(
    `INSERT INTO app_daily_interaction
      (id,"accountId","productDate","resultId","aggregateRevision","updatedAt","retentionPolicyVersion","retentionAnchorAt")
     VALUES ($1,$2,$3,$4,1,$5,'retention-policy-v1',$5)`,
    [interactionId, accountId, productDate, publication.resultId, ts],
  );
  return { ...publication, interactionId };
}

test(
  "E-006 TX-01 through TX-09 real PostgreSQL atomicity and rollback evidence",
  {
    skip: integrationEnabled
      ? false
      : "set DATABASE_INTEGRATION=1 to run the real PostgreSQL 18 harness",
  },
  async (t) => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const adminUrl = container.getConnectionUri();
    try {
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: adminUrl,
        PRISMA_BIN:
          "/Users/chenbin/SelfProject/DailyEnergy/node_modules/.bin/prisma",
      });
      const { Client } = loadPg();
      const admin = await connect(Client, adminUrl, "tx-admin");
      try {
        await t.test(
          `${transactionMetadata[0].test_id} TX-01 profile/onboarding commits all facts and rolls all back`,
          async () => {
            const accountId = await account(admin, "01");
            const commandRef = id();
            const consentId = id();
            const profileId = id();
            const completionId = id();
            await transaction(admin, async (client) => {
              await client.query(
                `INSERT INTO app_necessary_consent_record
                (id,"accountId","noticeVersion","logicalIntent",status,"commandRef","acceptedAt",
                 "retentionPolicyVersion","retentionAnchorAt")
               VALUES ($1,$2,'notice-v1','ONBOARDING','ACCEPTED',$3,$4,'retention-policy-v1',$4)`,
                [consentId, accountId, id(), ts],
              );
              await client.query(
                `INSERT INTO runtime_command_receipt
                (id,"accountId","commandRef","operationCode","targetScope","targetKey","normalizedPayloadFingerprint",
                 "acceptedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
               VALUES ($1,$2,$3,'PROFILE_SUBMIT','ACCOUNT',($2::uuid)::text,$4,$5,'retention-policy-v1',$5,$6)`,
                [id(), accountId, commandRef, hex("01"), ts, later],
              );
              await client.query(
                `INSERT INTO app_user_profile
                (id,"accountId",revision,"preferredNameCiphertext","preferredNameKeyVersion","expressionStyle",
                 "profileSchemaVersion","updatedAt","retentionPolicyVersion","retentionAnchorAt")
               VALUES ($1,$2,1,$3,'synthetic-key-v1','BALANCED','profile-v1',$4,'retention-policy-v1',$4)`,
                [profileId, accountId, hex("02"), ts],
              );
              await client.query(
                `INSERT INTO app_user_profile_revision
                (id,"profileId",revision,"preferredNameCiphertext","preferredNameKeyVersion","expressionStyle",
                 "changedFieldNames","commandRef","retentionPolicyVersion","retentionAnchorAt","expiresAt")
               VALUES ($1,$2,1,$3,'synthetic-key-v1','BALANCED',ARRAY['preferredName'],$4,'retention-policy-v1',$5,$6)`,
                [id(), profileId, hex("02"), commandRef, ts, later],
              );
              await client.query(
                `INSERT INTO app_onboarding_completion
                (id,"accountId","profileRevision","consentRecordId","completionCommandRef","completedAt",
                 "retentionPolicyVersion","retentionAnchorAt")
               VALUES ($1,$2,1,$3,$4,$5,'retention-policy-v1',$5)`,
                [completionId, accountId, consentId, commandRef, ts],
              );
            });
            assert.equal(
              await count(admin, "app_onboarding_completion", "id=$1", [
                completionId,
              ]),
              1,
            );

            const failedCommand = id();
            await expectRollback(
              admin,
              async (client) => {
                await client.query(
                  `INSERT INTO runtime_command_receipt
                  (id,"accountId","commandRef","operationCode","targetScope","targetKey","normalizedPayloadFingerprint",
                   "acceptedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
                 VALUES ($1,$2,$3,'PROFILE_SUBMIT','ACCOUNT','failed',$4,$5,'retention-policy-v1',$5,$6)`,
                  [id(), accountId, failedCommand, hex("03"), ts, later],
                );
                await client.query(
                  `INSERT INTO app_onboarding_completion
                  (id,"accountId","profileRevision","consentRecordId","completionCommandRef","completedAt",
                   "retentionPolicyVersion","retentionAnchorAt")
                 VALUES ($1,$2,2,$3,$4,$5,'retention-policy-v1',$5)`,
                  [id(), accountId, id(), failedCommand, ts],
                );
              },
              /(foreign key constraint|unique constraint)/u,
            );
            assert.equal(
              await count(admin, "runtime_command_receipt", '"commandRef"=$1', [
                failedCommand,
              ]),
              0,
            );
          },
        );

        await t.test(
          `${transactionMetadata[1].test_id} TX-02 checkin/intent snapshot/outbox is unique and atomic`,
          async () => {
            const accountId = await account(admin, "02");
            const productDate = "2026-07-30";
            const winner = await connect(Client, adminUrl, "tx02-winner");
            const loser = await connect(Client, adminUrl, "tx02-loser");
            try {
              await winner.query("BEGIN");
              await loser.query("BEGIN");
              const checkinId = id();
              await winner.query(
                `INSERT INTO app_morning_checkin
                (id,"accountId","productDate","productDatePolicyVersion",revision,mood,energy,sleep,"firstSubmittedAt",
                 "updatedAt","sourceCommandRef","retentionPolicyVersion","retentionAnchorAt")
               VALUES ($1,$2,$3,'product-date-v1',1,'GOOD','HIGH','GOOD',$4,$4,$5,'retention-policy-v1',$4)`,
                [checkinId, accountId, productDate, ts, id()],
              );
              const loserInsert = loser.query(
                `INSERT INTO app_morning_checkin
                (id,"accountId","productDate","productDatePolicyVersion",revision,mood,energy,sleep,"firstSubmittedAt",
                 "updatedAt","sourceCommandRef","retentionPolicyVersion","retentionAnchorAt")
               VALUES ($1,$2,$3,'product-date-v1',1,'LOW','LOW','LOW',$4,$4,$5,'retention-policy-v1',$4)`,
                [id(), accountId, productDate, ts, id()],
              );
              await waitUntilBlocked(admin, "tx02-loser");
              await winner.query("COMMIT");
              await assert.rejects(loserInsert, /unique constraint/u);
              await loser.query("ROLLBACK");
              assert.equal(
                await count(
                  admin,
                  "app_morning_checkin",
                  '"accountId"=$1 AND "productDate"=$2',
                  [accountId, productDate],
                ),
                1,
              );

              const intentId = id();
              const snapshotId = id();
              const eventId = id();
              await transaction(admin, async (client) => {
                await client.query(
                  `INSERT INTO app_generation_intent
                  (id,"accountId","targetProductDate","productDatePolicyVersion","acceptedAt",revision,state,"resultVersion",
                   "manifestRef","manifestFingerprint","inputSnapshotFingerprint","rootSeedMaterialRef","completionGrantVersion",
                   "createdAt","updatedAt","retentionPolicyVersion","retentionAnchorAt")
                 VALUES ($1,$2,$3,'product-date-v1',$4,1,'QUEUED','result-v1','manifest',$5,$6,'seed','grant',$4,$4,'retention-policy-v1',$4)`,
                  [intentId, accountId, productDate, ts, hex("11"), hex("12")],
                );
                await client.query(
                  `INSERT INTO app_generation_input_snapshot
                  (id,"generationIntentId","checkinId","checkinRevision","schemaVersion","snapshotPayload","snapshotFingerprint",
                   "retentionPolicyVersion","retentionAnchorAt")
                 VALUES ($1,$2,$3,1,'snapshot-v1','{}',$4,'retention-policy-v1',$5)`,
                  [snapshotId, intentId, checkinId, hex("13"), ts],
                );
                await client.query(
                  `INSERT INTO runtime_outbox_event
                  (id,"aggregateType","aggregateRef","aggregateRevision","eventType","eventVersion","idempotencyKey",
                   "allowlistedPayload","guardEpochs","availableAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
                 VALUES ($1,'GenerationIntent',$2,1,'GenerationQueued','v1',$3,'{}','{}',$4,'retention-policy-v1',$4,$5)`,
                  [eventId, intentId, hex("14"), ts, later],
                );
              });
              assert.equal(
                await count(admin, "runtime_outbox_event", "id=$1", [eventId]),
                1,
              );
              const failedIntent = id();
              await expectRollback(
                admin,
                async (client) => {
                  await client.query(
                    `INSERT INTO app_generation_intent
                  (id,"accountId","targetProductDate","productDatePolicyVersion","acceptedAt",revision,state,"resultVersion",
                   "manifestRef","manifestFingerprint","inputSnapshotFingerprint","rootSeedMaterialRef","completionGrantVersion",
                   "createdAt","updatedAt","retentionPolicyVersion","retentionAnchorAt")
                 VALUES ($1,$2,'2026-07-31','product-date-v1',$3,1,'QUEUED','result-v1','manifest',$4,$5,'seed','grant',$3,$3,'retention-policy-v1',$3)`,
                    [failedIntent, accountId, ts, hex("15"), hex("16")],
                  );
                  throw new Error("TX02_INJECTED_FAILURE");
                },
                /TX02_INJECTED_FAILURE/u,
              );
              assert.equal(
                await count(admin, "app_generation_intent", "id=$1", [
                  failedIntent,
                ]),
                0,
              );
            } finally {
              await winner.end();
              await loser.end();
            }
          },
        );

        await t.test(
          `${transactionMetadata[2].test_id} TX-03 daily publication has one concurrent winner and no partial result`,
          async () => {
            const accountId = await account(admin, "03");
            const productDate = "2026-08-01";
            const base = await transaction(admin, async (client) => {
              const checkinId = id();
              const intentId = id();
              const snapshotId = id();
              await client.query(
                `INSERT INTO app_morning_checkin (id,"accountId","productDate","productDatePolicyVersion",revision,mood,energy,sleep,"firstSubmittedAt","updatedAt","sourceCommandRef","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,'product-date-v1',1,'STEADY','STEADY','OKAY',$4,$4,$5,'retention-policy-v1',$4)`,
                [checkinId, accountId, productDate, ts, id()],
              );
              await client.query(
                `INSERT INTO app_generation_intent (id,"accountId","targetProductDate","productDatePolicyVersion","acceptedAt",revision,state,"resultVersion","manifestRef","manifestFingerprint","inputSnapshotFingerprint","rootSeedMaterialRef","completionGrantVersion","createdAt","updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,'product-date-v1',$4,1,'RUNNING','result-v1','manifest',$5,$6,'seed','grant',$4,$4,'retention-policy-v1',$4)`,
                [intentId, accountId, productDate, ts, hex("21"), hex("22")],
              );
              await client.query(
                `INSERT INTO app_generation_input_snapshot (id,"generationIntentId","checkinId","checkinRevision","schemaVersion","snapshotPayload","snapshotFingerprint","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,1,'snapshot-v1','{}',$4,'retention-policy-v1',$5)`,
                [snapshotId, intentId, checkinId, hex("23"), ts],
              );
              return { intentId, snapshotId };
            });
            const winner = await connect(Client, adminUrl, "tx03-winner");
            const loser = await connect(Client, adminUrl, "tx03-loser");
            const resultId = id();
            try {
              await winner.query("BEGIN");
              await loser.query("BEGIN");
              await winner.query(
                `INSERT INTO app_published_daily_result (id,"accountId","generationIntentId","inputSnapshotId","productDate","resultVersion","schemaVersion","generatedAt","ruleFactsPayload","expressionCorePayload","provenancePayload","validationReceipt","resultFingerprint","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,$4,$5,'result-v1','schema-v1',$6,'{}','{}','{}','{}',$7,'retention-policy-v1',$6)`,
                [
                  resultId,
                  accountId,
                  base.intentId,
                  base.snapshotId,
                  productDate,
                  ts,
                  hex("24"),
                ],
              );
              await winner.query(
                `INSERT INTO app_published_result_visibility (id,"resultId",state,revision,"sourceFingerprint","updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'AVAILABLE',1,$3,$4,'retention-policy-v1',$4)`,
                [id(), resultId, hex("25"), ts],
              );
              const slotId = id();
              await winner.query(
                `INSERT INTO app_result_content_slot (id,"resultId","segmentPath","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'core',$3,$4)`,
                [slotId, resultId, "retention-policy-v1", ts],
              );
              await winner.query(
                `INSERT INTO app_personalized_content_fragment (id,"slotId","payloadCiphertext","payloadKeyVersion","payloadFingerprint","schemaVersion","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,'synthetic-key-v1',$4,'fragment-v1','retention-policy-v1',$5)`,
                [id(), slotId, hex("26"), hex("27"), ts],
              );
              await winner.query(
                `UPDATE app_generation_intent SET state='SUCCEEDED',"publishedResultRef"=$2,revision=2,"updatedAt"=$3 WHERE id=$1`,
                [base.intentId, resultId, ts],
              );
              await winner.query(
                `INSERT INTO runtime_outbox_event (id,"aggregateType","aggregateRef","aggregateRevision","eventType","eventVersion","idempotencyKey","allowlistedPayload","guardEpochs","availableAt","retentionPolicyVersion","retentionAnchorAt","expiresAt") VALUES ($1,'DailyResult',$2,1,'DailyResultPublished','v1',$3,'{}','{}',$4,'retention-policy-v1',$4,$5)`,
                [id(), resultId, hex("28"), ts, later],
              );
              const loserInsert = loser.query(
                `INSERT INTO app_published_daily_result (id,"accountId","generationIntentId","inputSnapshotId","productDate","resultVersion","schemaVersion","generatedAt","ruleFactsPayload","expressionCorePayload","provenancePayload","validationReceipt","resultFingerprint","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,$4,$5,'result-v1','schema-v1',$6,'{}','{}','{}','{}',$7,'retention-policy-v1',$6)`,
                [
                  id(),
                  accountId,
                  base.intentId,
                  base.snapshotId,
                  productDate,
                  ts,
                  hex("29"),
                ],
              );
              await waitUntilBlocked(admin, "tx03-loser");
              await winner.query("COMMIT");
              await assert.rejects(loserInsert, /unique constraint/u);
              await loser.query("ROLLBACK");
              assert.equal(
                await count(
                  admin,
                  "app_published_daily_result",
                  '"accountId"=$1 AND "productDate"=$2',
                  [accountId, productDate],
                ),
                1,
              );

              const failedAccount = await account(admin, "03f");
              const failedResult = id();
              await expectRollback(
                admin,
                async (client) => {
                  const pub = await dailyPublication(
                    client,
                    failedAccount,
                    "2026-08-02",
                    "03f",
                  );
                  await client.query(
                    `INSERT INTO app_published_result_visibility (id,"resultId",state,revision,"sourceFingerprint","updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'AVAILABLE',1,$3,$4,'retention-policy-v1',$4)`,
                    [id(), pub.resultId, hex("30"), ts],
                  );
                  await client.query(
                    `INSERT INTO app_result_content_slot (id,"resultId","segmentPath","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'missing-content','retention-policy-v1',$3)`,
                    [id(), pub.resultId, ts],
                  );
                  return failedResult;
                },
                /SQL-013/u,
              );
              assert.equal(
                await count(
                  admin,
                  "app_published_daily_result",
                  '"accountId"=$1',
                  [failedAccount],
                ),
                0,
              );
            } finally {
              await winner.end();
              await loser.end();
            }
          },
        );

        await t.test(
          `${transactionMetadata[3].test_id} TX-04 EVE components commit together and conflict rolls all back`,
          async () => {
            const accountId = await account(admin, "04");
            const base = await transaction(admin, (client) =>
              interaction(client, accountId, "2026-08-03", "04"),
            );
            const taskId = id();
            const helpfulnessId = id();
            const feedbackId = id();
            await transaction(admin, async (client) => {
              await client.query(
                `SELECT id FROM app_daily_interaction WHERE id=$1 FOR UPDATE`,
                [base.interactionId],
              );
              await client.query(
                `INSERT INTO app_daily_task_state (id,"interactionId","taskDefinitionId","taskKind",status,revision,"updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'task-v1','SYNTHETIC','COMPLETED',1,$3,'retention-policy-v1',$3)`,
                [taskId, base.interactionId, ts],
              );
              await client.query(
                `INSERT INTO app_daily_helpfulness_record (id,"interactionId",rating,revision,"updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'HELPFUL',1,$3,'retention-policy-v1',$3)`,
                [helpfulnessId, base.interactionId, ts],
              );
              await client.query(
                `INSERT INTO app_evening_feedback_record (id,"interactionId","overallFeeling","firstSubmittedAt","updatedAt",revision,"retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'STEADY',$3,$3,1,'retention-policy-v1',$3)`,
                [feedbackId, base.interactionId, ts],
              );
              await client.query(
                `INSERT INTO app_evening_feedback_revision (id,"feedbackId",revision,"changedFieldNames","noteChanged","commandRef","retentionPolicyVersion","retentionAnchorAt","expiresAt") VALUES ($1,$2,1,ARRAY['overallFeeling'],false,$3,'retention-policy-v1',$4,$5)`,
                [id(), feedbackId, id(), ts, later],
              );
              await client.query(
                `UPDATE app_daily_interaction SET "aggregateRevision"=2,"updatedAt"=$2 WHERE id=$1 AND "aggregateRevision"=1`,
                [base.interactionId, ts],
              );
            });
            assert.equal(
              await count(admin, "app_evening_feedback_record", "id=$1", [
                feedbackId,
              ]),
              1,
            );
            await expectRollback(
              admin,
              async (client) => {
                await client.query(
                  `SELECT id FROM app_daily_interaction WHERE id=$1 FOR UPDATE`,
                  [base.interactionId],
                );
                await client.query(
                  `UPDATE app_daily_task_state SET status='SKIPPED',revision=2,"updatedAt"=$2 WHERE id=$1 AND revision=1`,
                  [taskId, ts],
                );
                const changed = await client.query(
                  `UPDATE app_daily_helpfulness_record SET rating='NEUTRAL',revision=2,"updatedAt"=$2 WHERE id=$1 AND revision=99`,
                  [helpfulnessId, ts],
                );
                if (changed.rowCount !== 1) {
                  throw new Error("TX04_REVISION_CONFLICT");
                }
              },
              /TX04_REVISION_CONFLICT/u,
            );
            const task = await admin.query(
              `SELECT status,revision FROM app_daily_task_state WHERE id=$1`,
              [taskId],
            );
            assert.deepEqual(task.rows[0], {
              status: "COMPLETED",
              revision: 1,
            });
          },
        );

        await t.test(
          `${transactionMetadata[4].test_id} TX-05 HIGH_RISK commits only minimal safety facts and rollback is complete`,
          async () => {
            const accountId = await account(admin, "05");
            const stateId = id();
            await admin.query(
              `INSERT INTO restricted_safety_state (id,"accountId",state,revision,"guardEpoch","updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'CLEAR',1,0,$3,'retention-policy-v1',$3)`,
              [stateId, accountId, ts],
            );
            const eventId = id();
            const planId = id();
            await transaction(admin, async (client) => {
              const changed = await client.query(
                `UPDATE restricted_safety_state SET state='ACTIVE',revision=2,"guardEpoch"=1,"latestEventRef"=$2,"responsePlanRef"=$3,"updatedAt"=$4 WHERE id=$1 AND revision=1 AND "guardEpoch"=0`,
                [stateId, eventId, planId, ts],
              );
              assert.equal(changed.rowCount, 1);
              await client.query(
                `INSERT INTO restricted_safety_decision (id,"accountId","surfaceCode","commandRef",level,"categoryCodes","policyVersion","ruleVersion","irreversibleFingerprint","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'EVE',$3,'HIGH_RISK',ARRAY['SYNTHETIC'],'safety-v1','rules-v1',$4,'retention-policy-v1',$5)`,
                [id(), accountId, id(), hex("31"), ts],
              );
              await client.query(
                `INSERT INTO restricted_safety_event (id,"accountId","stateRevision","guardEpoch","surfaceCode","decisionLevel","categoryCodes","policyVersion","ruleVersion","responseVersion","resourceRegistryVersion","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,2,1,'EVE','HIGH_RISK',ARRAY['SYNTHETIC'],'safety-v1','rules-v1','response-v1','resources-v1','retention-policy-v1',$3)`,
                [eventId, accountId, ts],
              );
              await client.query(
                `INSERT INTO restricted_safety_response_plan (id,"accountId","stateRevision","blockIds","resourceEntryRefs","localeCode","regionCode","fallbackCode","viewVersion","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,2,ARRAY['synthetic-block'],'[]','zh-CN','CN','SYNTHETIC','view-v1','retention-policy-v1',$3)`,
                [planId, accountId, ts],
              );
              await client.query(
                `INSERT INTO runtime_outbox_event (id,"aggregateType","aggregateRef","aggregateRevision","eventType","eventVersion","idempotencyKey","allowlistedPayload","guardEpochs","availableAt","retentionPolicyVersion","retentionAnchorAt","expiresAt") VALUES ($1,'SafetyState',$2,2,'SafetyActivated','v1',$3,'{}','{"safety":1}',$4,'retention-policy-v1',$4,$5)`,
                [id(), stateId, hex("32"), ts, later],
              );
            });
            assert.equal(
              await count(admin, "restricted_safety_event", "id=$1", [eventId]),
              1,
            );
            assert.equal(
              await count(
                admin,
                "app_evening_feedback_record",
                '"interactionId" IN (SELECT id FROM app_daily_interaction WHERE "accountId"=$1)',
                [accountId],
              ),
              0,
            );
            const failedEvent = id();
            await expectRollback(
              admin,
              async (client) => {
                await client.query(
                  `UPDATE restricted_safety_state SET revision=3,"guardEpoch"=2,"updatedAt"=$2 WHERE id=$1`,
                  [stateId, ts],
                );
                await client.query(
                  `INSERT INTO restricted_safety_event (id,"accountId","stateRevision","guardEpoch","surfaceCode","decisionLevel","categoryCodes","policyVersion","ruleVersion","responseVersion","resourceRegistryVersion","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,4,2,'EVE','HIGH_RISK',ARRAY[]::text[],'safety-v1','rules-v1','response-v1','resources-v1','retention-policy-v1',$3)`,
                  [failedEvent, accountId, ts],
                );
              },
              /SQL-014/u,
            );
            const state = await admin.query(
              `SELECT revision,"guardEpoch"::int FROM restricted_safety_state WHERE id=$1`,
              [stateId],
            );
            assert.deepEqual(state.rows[0], { revision: 2, guardEpoch: 1 });
          },
        );

        await t.test(
          `${transactionMetadata[5].test_id} TX-06 light/outbox and replay-safe inbox/link are atomic`,
          async () => {
            const accountId = await account(admin, "06");
            const base = await transaction(admin, (client) =>
              interaction(client, accountId, "2026-08-04", "06"),
            );
            const lightId = id();
            const eventId = id();
            await transaction(admin, async (client) => {
              await client.query(
                `INSERT INTO app_daily_light_fact (id,"interactionId","sourceCommandRef","litAt","sourceValidityRevision","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,$4,1,'retention-policy-v1',$4)`,
                [lightId, base.interactionId, id(), ts],
              );
              await client.query(
                `INSERT INTO runtime_outbox_event (id,"aggregateType","aggregateRef","aggregateRevision","eventType","eventVersion","idempotencyKey","allowlistedPayload","guardEpochs","availableAt","retentionPolicyVersion","retentionAnchorAt","expiresAt") VALUES ($1,'DailyLight',$2,1,'DayLit','v1',$3,'{}','{}',$4,'retention-policy-v1',$4,$5)`,
                [eventId, lightId, hex("41"), ts, later],
              );
            });
            const cycleId = id();
            await admin.query(
              `INSERT INTO app_relationship_cycle (id,"accountId",revision,"startedAt","sourceCutoffEpoch",state,"activeSlot","projectionFingerprint","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,1,$3,0,'ACTIVE',true,$4,'retention-policy-v1',$3)`,
              [cycleId, accountId, ts, hex("42")],
            );
            const worker1 = await connect(Client, adminUrl, "tx06-worker1");
            const worker2 = await connect(Client, adminUrl, "tx06-worker2");
            try {
              await worker1.query("BEGIN");
              await worker2.query("BEGIN");
              await worker1.query(
                `INSERT INTO runtime_inbox_receipt (id,"consumerCode","eventId","eventFingerprint","processedAt","outcomeCode","retentionPolicyVersion","retentionAnchorAt","expiresAt") VALUES ($1,'relationship',$2,$3,$4,'LINKED','retention-policy-v1',$4,$5)`,
                [id(), eventId, hex("43"), ts, later],
              );
              await worker1.query(
                `INSERT INTO app_relationship_encounter_link (id,"cycleId","sourceLightId","productDate","sourceValidityRevision","sourceEventId","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,'2026-08-04',1,$4,'retention-policy-v1',$5)`,
                [id(), cycleId, lightId, eventId, ts],
              );
              const replay = worker2.query(
                `INSERT INTO runtime_inbox_receipt (id,"consumerCode","eventId","eventFingerprint","processedAt","outcomeCode","retentionPolicyVersion","retentionAnchorAt","expiresAt") VALUES ($1,'relationship',$2,$3,$4,'LINKED','retention-policy-v1',$4,$5)`,
                [id(), eventId, hex("43"), ts, later],
              );
              await waitUntilBlocked(admin, "tx06-worker2");
              await worker1.query("COMMIT");
              await assert.rejects(replay, /unique constraint/u);
              await worker2.query("ROLLBACK");
            } finally {
              await worker1.end();
              await worker2.end();
            }
            assert.equal(
              await count(
                admin,
                "app_relationship_encounter_link",
                '"sourceEventId"=$1',
                [eventId],
              ),
              1,
            );
            const failedBase = await transaction(admin, (client) =>
              interaction(client, accountId, "2026-08-05", "06f"),
            );
            const failedLight = id();
            await expectRollback(
              admin,
              async (client) => {
                await client.query(
                  `INSERT INTO app_daily_light_fact (id,"interactionId","sourceCommandRef","litAt","sourceValidityRevision","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,$4,1,'retention-policy-v1',$4)`,
                  [failedLight, failedBase.interactionId, id(), ts],
                );
                throw new Error("TX06_OUTBOX_FAILURE");
              },
              /TX06_OUTBOX_FAILURE/u,
            );
            assert.equal(
              await count(admin, "app_daily_light_fact", "id=$1", [
                failedLight,
              ]),
              0,
            );
          },
        );

        await t.test(
          `${transactionMetadata[6].test_id} TX-07 weekly immutable revision and CAS pointer reject stale publisher`,
          async () => {
            const accountId = await account(admin, "07");
            const windowId = id();
            const fingerprint = hex("51");
            const intentId = id();
            await transaction(admin, async (client) => {
              await client.query(
                `INSERT INTO app_weekly_window (id,"accountId","endProductDate","windowRuleVersion","currentSourceFingerprint",revision,"updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'2026-08-05','window-v1',$3,1,$4,'retention-policy-v1',$4)`,
                [windowId, accountId, fingerprint, ts],
              );
              await client.query(
                `INSERT INTO app_weekly_source_snapshot (id,"windowId","sourceFingerprint","sourceSlotsPayload","aggregateFactsPayload","expressionPlanPayload","aggregateVersion","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,'{}','{}','{}','aggregate-v1','retention-policy-v1',$4)`,
                [id(), windowId, fingerprint, ts],
              );
              await client.query(
                `INSERT INTO app_weekly_summary_intent (id,"windowId","sourceFingerprint",revision,state,"summaryVersion","updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,1,'RUNNING','summary-v1',$4,'retention-policy-v1',$4)`,
                [intentId, windowId, fingerprint, ts],
              );
            });
            const publisher1 = await connect(
              Client,
              adminUrl,
              "tx07-publisher1",
            );
            const publisher2 = await connect(
              Client,
              adminUrl,
              "tx07-publisher2",
            );
            const summaryId = id();
            try {
              await publisher1.query("BEGIN");
              await publisher2.query("BEGIN");
              await publisher1.query(
                `INSERT INTO app_published_weekly_summary_revision (id,"windowId","summaryIntentId",revision,"sourceFingerprint","schemaVersion","summaryVersion","expressionCorePayload","provenancePayload","validationReceipt","publishedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,1,$4,'weekly-v1','summary-v1','{}','{}','{}',$5,'retention-policy-v1',$5)`,
                [summaryId, windowId, intentId, fingerprint, ts],
              );
              await publisher1.query(
                `UPDATE app_weekly_window SET "currentSummaryRef"=$2,revision=2,"updatedAt"=$3 WHERE id=$1 AND revision=1 AND "currentSourceFingerprint"=$4`,
                [windowId, summaryId, ts, fingerprint],
              );
              const staleUpdate = publisher2.query(
                `UPDATE app_weekly_window SET revision=2,"updatedAt"=$2 WHERE id=$1 AND revision=1 AND "currentSourceFingerprint"=$3`,
                [windowId, ts, fingerprint],
              );
              await waitUntilBlocked(admin, "tx07-publisher2");
              await publisher1.query("COMMIT");
              const stale = await staleUpdate;
              assert.equal(stale.rowCount, 0);
              await publisher2.query("ROLLBACK");
            } finally {
              await publisher1.end();
              await publisher2.end();
            }
            const pointer = await admin.query(
              `SELECT "currentSummaryRef",revision FROM app_weekly_window WHERE id=$1`,
              [windowId],
            );
            assert.deepEqual(pointer.rows[0], {
              currentSummaryRef: summaryId,
              revision: 2,
            });
            const badSummary = id();
            await expectRollback(
              admin,
              async (client) => {
                await client.query(
                  `INSERT INTO app_published_weekly_summary_revision (id,"windowId","summaryIntentId",revision,"sourceFingerprint","schemaVersion","summaryVersion","expressionCorePayload","provenancePayload","validationReceipt","publishedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,$3,2,$4,'weekly-v1','summary-v1','{}','{}','{}',$5,'retention-policy-v1',$5)`,
                  [badSummary, windowId, id(), fingerprint, ts],
                );
              },
              /foreign key constraint/u,
            );
            assert.equal(
              await count(
                admin,
                "app_published_weekly_summary_revision",
                "id=$1",
                [badSummary],
              ),
              0,
            );
          },
        );

        await t.test(
          `${transactionMetadata[7].test_id} TX-08 dispatch claim has one locker/winner and failed claim rolls back`,
          async () => {
            const accountId = await account(admin, "08");
            await admin.query(
              `INSERT INTO app_notification_preference (id,"accountId","notificationType",enabled,"ruleVersion",revision,"updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'DAILY',true,'rule-v1',1,$3,'retention-policy-v1',$3)`,
              [id(), accountId, ts],
            );
            await admin.query(
              `INSERT INTO restricted_safety_state (id,"accountId",state,revision,"guardEpoch","updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'CLEAR',1,0,$3,'retention-policy-v1',$3)`,
              [id(), accountId, ts],
            );
            const intentId = id();
            await admin.query(
              `INSERT INTO app_notification_intent (id,"accountId","notificationType","semanticKey","plannedWindow","ruleVersion",state,"scheduledAt","updatedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'DAILY',$3,'MORNING','rule-v1','SCHEDULED',$4,$4,'retention-policy-v1',$4)`,
              [intentId, accountId, hex("61"), ts],
            );
            const worker1 = await connect(Client, adminUrl, "tx08-worker1");
            const worker2 = await connect(Client, adminUrl, "tx08-worker2");
            const claim = id();
            try {
              await worker1.query("BEGIN");
              await worker2.query("BEGIN");
              await worker1.query(
                `SELECT id FROM app_notification_intent WHERE id=$1 FOR UPDATE`,
                [intentId],
              );
              const waitLock = worker2.query(
                `SELECT id FROM app_notification_intent WHERE id=$1 FOR UPDATE`,
                [intentId],
              );
              await waitUntilBlocked(admin, "tx08-worker2");
              await worker1.query(
                `UPDATE app_notification_intent SET "dispatchClaimToken"=$2,"updatedAt"=$3 WHERE id=$1 AND state='SCHEDULED' AND "dispatchClaimToken" IS NULL`,
                [intentId, claim, ts],
              );
              await worker1.query("COMMIT");
              await waitLock;
              const loser = await worker2.query(
                `UPDATE app_notification_intent SET "dispatchClaimToken"=$2,"updatedAt"=$3 WHERE id=$1 AND state='SCHEDULED' AND "dispatchClaimToken" IS NULL`,
                [intentId, id(), ts],
              );
              assert.equal(loser.rowCount, 0);
              await worker2.query("ROLLBACK");
            } finally {
              await worker1.end();
              await worker2.end();
            }
            const claimed = await admin.query(
              `SELECT "dispatchClaimToken" FROM app_notification_intent WHERE id=$1`,
              [intentId],
            );
            assert.equal(claimed.rows[0].dispatchClaimToken, claim);
            await expectRollback(
              admin,
              async (client) => {
                await client.query(
                  `UPDATE app_notification_intent SET state='SENT',"terminalAt"=$2,"updatedAt"=$2 WHERE id=$1`,
                  [intentId, ts],
                );
                await client.query(
                  `INSERT INTO runtime_notification_delivery_attempt (id,"intentId",ordinal,"channelCredentialRef","requestFingerprint","startedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,-1,'synthetic-channel',$3,$4,'retention-policy-v1',$4)`,
                  [id(), intentId, hex("62"), ts],
                );
              },
              /check constraint/u,
            );
            const state = await admin.query(
              `SELECT state FROM app_notification_intent WHERE id=$1`,
              [intentId],
            );
            assert.equal(state.rows[0].state, "SCHEDULED");
          },
        );

        await t.test(
          `${transactionMetadata[8].test_id} TX-09 active deletion task/guard is concurrent-idempotent and failure keeps prior epoch`,
          async () => {
            const accountId = await account(admin, "09");
            const worker1 = await connect(Client, adminUrl, "tx09-worker1");
            const worker2 = await connect(Client, adminUrl, "tx09-worker2");
            const taskId = id();
            try {
              await worker1.query("BEGIN");
              await worker2.query("BEGIN");
              await worker1.query(
                `INSERT INTO restricted_data_task (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",state,revision,"confirmationVersion","requestedAt","guardedAt","failureScopeCodes","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'DELETE','DAY','PRODUCT_DATE','2026-08-06',true,'QUEUED',1,'confirm-v1',$3,$3,ARRAY[]::text[],'retention-policy-v1',$3)`,
                [taskId, accountId, ts],
              );
              await worker1.query(
                `INSERT INTO restricted_deletion_guard (id,"accountId",scope,"targetKey",revision,"deletionEpoch","taskRef","semanticBlockedAt","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'DAY','2026-08-06',1,1,$3,$4,'retention-policy-v1',$4)`,
                [id(), accountId, taskId, ts],
              );
              await worker1.query(
                `INSERT INTO runtime_outbox_event (id,"aggregateType","aggregateRef","aggregateRevision","eventType","eventVersion","idempotencyKey","allowlistedPayload","guardEpochs","availableAt","retentionPolicyVersion","retentionAnchorAt","expiresAt") VALUES ($1,'DataTask',$2,1,'DeletionGuarded','v1',$3,'{}','{"deletion":1}',$4,'retention-policy-v1',$4,$5)`,
                [id(), taskId, hex("71"), ts, later],
              );
              const duplicate = worker2.query(
                `INSERT INTO restricted_data_task (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",state,revision,"confirmationVersion","requestedAt","guardedAt","failureScopeCodes","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'DELETE','DAY','PRODUCT_DATE','2026-08-06',true,'QUEUED',1,'confirm-v1',$3,$3,ARRAY[]::text[],'retention-policy-v1',$3)`,
                [id(), accountId, ts],
              );
              await waitUntilBlocked(admin, "tx09-worker2");
              await worker1.query("COMMIT");
              await assert.rejects(duplicate, /unique constraint/u);
              await worker2.query("ROLLBACK");
            } finally {
              await worker1.end();
              await worker2.end();
            }
            assert.equal(
              await count(
                admin,
                "restricted_data_task",
                '"accountId"=$1 AND "targetKey"=$2',
                [accountId, "2026-08-06"],
              ),
              1,
            );
            assert.equal(
              await count(
                admin,
                "restricted_deletion_guard",
                '"accountId"=$1 AND "targetKey"=$2 AND "deletionEpoch"=1',
                [accountId, "2026-08-06"],
              ),
              1,
            );
            const failedTask = id();
            await expectRollback(
              admin,
              async (client) => {
                await client.query(
                  `INSERT INTO restricted_data_task (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",state,revision,"confirmationVersion","requestedAt","guardedAt","failureScopeCodes","retentionPolicyVersion","retentionAnchorAt") VALUES ($1,$2,'DELETE','MATTER','MATTER','synthetic-matter',true,'QUEUED',1,'confirm-v1',$3,$3,ARRAY[]::text[],'retention-policy-v1',$3)`,
                  [failedTask, accountId, ts],
                );
                await client.query(
                  `UPDATE restricted_deletion_guard SET revision=2,"deletionEpoch"=2,"taskRef"=$2 WHERE "accountId"=$1 AND scope='DAY' AND "targetKey"='2026-08-06'`,
                  [accountId, failedTask],
                );
                throw new Error("TX09_OUTBOX_FAILURE");
              },
              /TX09_OUTBOX_FAILURE/u,
            );
            assert.equal(
              await count(admin, "restricted_data_task", "id=$1", [failedTask]),
              0,
            );
            const guard = await admin.query(
              `SELECT revision,"deletionEpoch"::int FROM restricted_deletion_guard WHERE "accountId"=$1 AND "targetKey"='2026-08-06'`,
              [accountId],
            );
            assert.deepEqual(guard.rows[0], { revision: 1, deletionEpoch: 1 });
          },
        );
      } finally {
        await admin.end();
      }
    } finally {
      await container.stop();
    }
  },
);
