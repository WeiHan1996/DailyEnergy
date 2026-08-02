#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { GenericContainer, Wait } from "testcontainers";

import {
  BACKGROUND_WORKER_MANIFEST,
  BullMqConsumer,
  BullMqProducer,
  fingerprintCapabilityManifest,
  INTERACTIVE_WORKER_MANIFEST,
  OutboxRelay,
  OutboxRelayCrashError,
  PostgresQueueStore,
  QueueRetryableError,
  QueueTerminalError,
  RESTRICTED_WORKER_MANIFEST,
  RedisLossRebuilder,
} from "../../packages/server-adapters/dist/testing/index.js";
import {
  bootstrapTestDatabase,
  loadPg,
  loadTestcontainers,
  POSTGRES_IMAGE,
  runNode,
} from "../database/container-harness.mjs";

const integrationEnabled = process.env.QUEUE_INTEGRATION === "1";
const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);
const prismaBin = path.join(repositoryRoot, "node_modules/.bin/prisma");
const REDIS_IMAGE =
  "redis:8.2.1-bookworm@sha256:5fa2edb1e408fa8235e6db8fab01d1afaaae96c9403ba67b70feceb8661e8621";

function hash(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

function queueConfig(manifest, redisUrl, keyPrefix) {
  return {
    concurrency: 2,
    drainTimeoutMs: 2_000,
    egressAllowlist: [...manifest.egressAllowlist],
    expectedCapabilityFingerprint: fingerprintCapabilityManifest(manifest),
    expectedDatabaseRole: manifest.databaseRole,
    expectedProfile: manifest.profile,
    keyPrefix,
    redisUrl,
    restoreReadiness: "NORMAL",
  };
}

function envelope({
  aggregateRef,
  aggregateRevision = 1,
  eventId = randomUUID(),
  eventType = "GenerationIntentAccepted",
  guardEpochs = {},
}) {
  return {
    aggregateRef,
    aggregateRevision,
    contract: "dailyenergy.job",
    eventId,
    eventType,
    eventVersion: "v1",
    guardEpochs,
    occurredAt: new Date().toISOString(),
    queueVersion: 1,
  };
}

async function startRedis() {
  const container = await new GenericContainer(REDIS_IMAGE)
    .withCommand(["redis-server", "--save", "", "--appendonly", "no"])
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/u))
    .start();
  return {
    container,
    url: `redis://${container.getHost()}:${container.getMappedPort(6379)}`,
  };
}

async function connectAdmin(Client, connectionString) {
  const client = new Client({
    application_name: "e007-queue-integration-admin",
    connectionString,
  });
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  await client.query("SET search_path TO daily_energy, pg_catalog");
  return client;
}

async function connectStore(profile, connectionString, manifest) {
  return PostgresQueueStore.connect({
    applicationName: `e007-queue-integration:${profile}`,
    connectionString,
    expectedDatabaseRole: manifest.databaseRole,
    profile,
  });
}

async function insertAccount(admin, state = "ACTIVE") {
  const accountId = randomUUID();
  const now = new Date();
  await admin.query(
    `INSERT INTO app_user_account
      (id, "ownerScopeToken", "stableSubjectCiphertext",
       "stableSubjectKeyVersion", state, revision, "lastActiveUseAt",
       "inactivityDeletionDueAt", "updatedAt", "retentionPolicyVersion",
       "retentionAnchorAt", "expiresAt")
     VALUES ($1,$2,$3,'synthetic-key-v1',$4,1,$5,$6,$5,
             'retention-policy-v1',$5,$6)`,
    [
      accountId,
      hash(`owner:${accountId}`),
      hash(`subject:${accountId}`),
      state,
      now,
      new Date(now.getTime() + 86_400_000),
    ],
  );
  return accountId;
}

async function insertGeneration(
  admin,
  accountId,
  { expires = "now() + interval '1 day'", revision = 1 } = {},
) {
  const intentId = randomUUID();
  const retentionAnchor = expires.includes(" - interval")
    ? "now() - interval '1 day'"
    : "now()";
  await admin.query(
    `INSERT INTO app_generation_intent
      (id,"accountId","targetProductDate","productDatePolicyVersion",
       "acceptedAt",revision,state,"resultVersion","manifestRef",
       "manifestFingerprint","inputSnapshotFingerprint","rootSeedMaterialRef",
       "completionGrantVersion","createdAt","updatedAt",
       "retentionPolicyVersion","retentionAnchorAt","expiresAt")
     VALUES ($1,$2,current_date,'product-date-v1',now(),$3,'QUEUED',
             'result-v1','manifest-v1',$4,$5,'seed-v1','grant-v1',now(),now(),
             'retention-policy-v1',${retentionAnchor},${expires})`,
    [
      intentId,
      accountId,
      revision,
      hash(`manifest:${intentId}`),
      hash(`snapshot:${intentId}`),
    ],
  );
  return intentId;
}

async function insertNotification(
  admin,
  accountId,
  { expires = "now() + interval '1 day'" } = {},
) {
  const intentId = randomUUID();
  const retentionAnchor = expires.includes(" - interval")
    ? "now() - interval '1 day'"
    : "now()";
  await admin.query(
    `INSERT INTO app_notification_intent
      (id,"accountId","notificationType","semanticKey","plannedWindow",
       "ruleVersion",state,"scheduledAt","updatedAt","retentionPolicyVersion",
       "retentionAnchorAt","expiresAt")
     VALUES ($1,$2,'DAILY',$3,'MORNING','notification-v1','SCHEDULED',
             now() - interval '1 minute',now(),'retention-policy-v1',
             ${retentionAnchor},${expires})`,
    [intentId, accountId, hash(`notification:${intentId}`)],
  );
  return intentId;
}

async function insertDataTask(
  admin,
  accountId,
  { expires = "now() + interval '1 day'", kind = "DELETE" } = {},
) {
  const taskId = randomUUID();
  const targetKey = `synthetic-${taskId}`;
  const retentionAnchor = expires.includes(" - interval")
    ? "now() - interval '1 day'"
    : "now()";
  await admin.query(
    `INSERT INTO restricted_data_task
      (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",
       state,revision,"confirmationVersion","requestedAt","failureScopeCodes",
       "retentionPolicyVersion","retentionAnchorAt","expiresAt")
     VALUES ($1,$2,$3,'DAY','DAY',$4,true,'QUEUED',1,'confirmation-v1',
             now() - interval '1 minute',ARRAY[]::text[],
             'retention-policy-v1',${retentionAnchor},${expires})`,
    [taskId, accountId, kind, targetKey],
  );
  if (kind === "DELETE") {
    await admin.query(
      `INSERT INTO restricted_deletion_guard
        (id,"accountId",scope,"targetKey",revision,"deletionEpoch","taskRef",
         "semanticBlockedAt","retentionPolicyVersion","retentionAnchorAt",
         "expiresAt")
       VALUES ($1,$2,'DAY',$3,1,3,$4,now(),'retention-policy-v1',now(),
               now() + interval '1 day')`,
      [randomUUID(), accountId, targetKey, taskId],
    );
  }
  return taskId;
}

async function insertOutbox(
  admin,
  {
    aggregateRef,
    aggregateRevision = 1,
    eventId = randomUUID(),
    eventType = "GenerationIntentAccepted",
    expires = "now() + interval '1 day'",
    state = "PENDING",
  },
) {
  const retentionAnchor = expires.includes(" - interval")
    ? "now() - interval '1 day'"
    : "now()";
  await admin.query(
    `INSERT INTO runtime_outbox_event
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",
       state,"availableAt","publishedAt","retentionPolicyVersion",
       "retentionAnchorAt","expiresAt")
     VALUES ($1,'SyntheticAggregate',$2,$3,$4,'v1',$5,'{}','{}',$6,
             now() - interval '1 minute',
             CASE WHEN $6::"OutboxState" = 'PUBLISHED' THEN now() ELSE NULL END,
             'retention-policy-v1',${retentionAnchor},${expires})`,
    [
      eventId,
      aggregateRef,
      aggregateRevision,
      eventType,
      hash(`outbox:${eventId}`),
      state,
    ],
  );
  return eventId;
}

async function waitForJob(producer, queueFamily, eventId, expectedState) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const job = await producer.getJob(queueFamily, eventId);
    if (job && (await job.getState()) === expectedState) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`QUEUE_JOB_TIMEOUT:${queueFamily}:${expectedState}`);
}

async function count(admin, table, predicate, values = []) {
  const result = await admin.query(
    `SELECT count(*)::int AS count FROM ${table} WHERE ${predicate}`,
    values,
  );
  return result.rows[0].count;
}

test(
  "T-QUEUE-INTEGRATION-001 real Redis 8, BullMQ 5 and PostgreSQL 18 resilience",
  {
    skip: integrationEnabled
      ? false
      : "set QUEUE_INTEGRATION=1 to run the real queue harness",
  },
  async (t) => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const [postgresContainer, initialRedis] = await Promise.all([
      new PostgreSqlContainer(POSTGRES_IMAGE).start(),
      startRedis(),
    ]);
    let redisContainer = initialRedis.container;
    let redisUrl = initialRedis.url;
    const adminUrl = postgresContainer.getConnectionUri();
    try {
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      const { Client } = loadPg();
      const admin = await connectAdmin(Client, adminUrl);
      try {
        await t.test(
          "S29-ARCH-018/S31-TEST-025 relay crash replays one domain effect",
          async () => {
            await redisContainer.exec(["redis-cli", "FLUSHALL"]);
            const accountId = await insertAccount(admin);
            const intentId = await insertGeneration(admin, accountId);
            const eventId = await insertOutbox(admin, {
              aggregateRef: intentId,
            });
            const interactiveStore = await connectStore(
              "worker-interactive",
              loginUrls.interactive,
              INTERACTIVE_WORKER_MANIFEST,
            );
            const backgroundStore = await connectStore(
              "worker-background",
              loginUrls.background,
              BACKGROUND_WORKER_MANIFEST,
            );
            const producer = await BullMqProducer.connect(
              redisUrl,
              "e007-relay-crash",
            );
            let handlerCalls = 0;
            const consumer = await BullMqConsumer.connect(
              INTERACTIVE_WORKER_MANIFEST,
              queueConfig(
                INTERACTIVE_WORKER_MANIFEST,
                redisUrl,
                "e007-relay-crash",
              ),
              [
                {
                  eventType: "GenerationIntentAccepted",
                  eventVersion: "v1",
                  async handle(job, transaction) {
                    handlerCalls += 1;
                    const updated = await transaction.execute(
                      `UPDATE daily_energy.app_generation_intent
                       SET revision = revision + 1, "updatedAt" = now()
                       WHERE id = $1 AND revision = $2`,
                      [job.aggregateRef, job.aggregateRevision],
                    );
                    assert.equal(updated.rowCount, 1);
                    return "HANDLED";
                  },
                },
              ],
              interactiveStore,
            );
            try {
              const crashingRelay = new OutboxRelay({
                faultHooks: {
                  afterEnqueueBeforePublished: async () => {
                    throw new OutboxRelayCrashError();
                  },
                },
                producer,
                store: backgroundStore,
              });
              await assert.rejects(
                crashingRelay.relayOnce(),
                /OUTBOX_RELAY_CRASH_INJECTED/u,
              );
              const firstJob = await waitForJob(
                producer,
                "interactive",
                eventId,
                "completed",
              );
              await firstJob.remove();

              await new OutboxRelay({
                producer,
                store: backgroundStore,
              }).relayOnce();
              await waitForJob(producer, "interactive", eventId, "completed");

              assert.equal(handlerCalls, 1);
              assert.equal(
                await count(admin, "runtime_inbox_receipt", '"eventId"=$1', [
                  eventId,
                ]),
                1,
              );
              const outbox = await admin.query(
                `SELECT state, "attemptCount" FROM runtime_outbox_event
                 WHERE id=$1`,
                [eventId],
              );
              assert.deepEqual(outbox.rows[0], {
                attemptCount: 2,
                state: "PUBLISHED",
              });
            } finally {
              await consumer.drain(2_000);
              await producer.close();
              await interactiveStore.close();
              await backgroundStore.close();
            }
          },
        );

        await t.test(
          "S29-ARCH-019/S31-TEST-026 commit-before-ACK crash is inbox no-op",
          async () => {
            await redisContainer.exec(["redis-cli", "FLUSHALL"]);
            const accountId = await insertAccount(admin);
            const intentId = await insertGeneration(admin, accountId);
            const event = envelope({ aggregateRef: intentId });
            const store = await connectStore(
              "worker-interactive",
              loginUrls.interactive,
              INTERACTIVE_WORKER_MANIFEST,
            );
            const producer = await BullMqProducer.connect(
              redisUrl,
              "e007-ack-crash",
            );
            const telemetry = [];
            let handlerCalls = 0;
            let crashInjected = false;
            const consumer = await BullMqConsumer.connect(
              INTERACTIVE_WORKER_MANIFEST,
              queueConfig(
                INTERACTIVE_WORKER_MANIFEST,
                redisUrl,
                "e007-ack-crash",
              ),
              [
                {
                  eventType: event.eventType,
                  eventVersion: "v1",
                  async handle(job, transaction) {
                    handlerCalls += 1;
                    const updated = await transaction.execute(
                      `UPDATE daily_energy.app_generation_intent
                       SET revision = revision + 1, "updatedAt" = now()
                       WHERE id = $1 AND revision = $2`,
                      [job.aggregateRef, job.aggregateRevision],
                    );
                    assert.equal(updated.rowCount, 1);
                    return "HANDLED";
                  },
                },
              ],
              store,
              { record: (item) => telemetry.push(item) },
              {
                async afterInboxCommitBeforeAck() {
                  if (!crashInjected) {
                    crashInjected = true;
                    throw new Error("synthetic crash");
                  }
                },
              },
            );
            try {
              await producer.enqueue("interactive", event, {
                attempts: 2,
                backoffDelayMs: 10,
              });
              await waitForJob(
                producer,
                "interactive",
                event.eventId,
                "completed",
              );
              assert.equal(handlerCalls, 1);
              assert.equal(
                await count(admin, "runtime_inbox_receipt", '"eventId"=$1', [
                  event.eventId,
                ]),
                1,
              );
              assert.ok(
                telemetry.some(
                  (item) =>
                    item.outcomeCode === "RETRYABLE" &&
                    item.reasonCode === "QUEUE_ACK_CRASH_WINDOW",
                ),
              );
              assert.ok(
                telemetry.some((item) => item.outcomeCode === "DUPLICATE"),
              );
              assert.doesNotMatch(
                JSON.stringify(telemetry),
                new RegExp(event.eventId, "u"),
              );
            } finally {
              await consumer.drain(2_000);
              await producer.close();
              await store.close();
            }
          },
        );

        await t.test(
          "S29-ARCH-007/020/024 profile, stale guard and retry fail closed",
          async () => {
            await redisContainer.exec(["redis-cli", "FLUSHALL"]);
            const accountId = await insertAccount(admin);
            const intentId = await insertGeneration(admin, accountId, {
              revision: 2,
            });
            const store = await connectStore(
              "worker-interactive",
              loginUrls.interactive,
              INTERACTIVE_WORKER_MANIFEST,
            );
            const producer = await BullMqProducer.connect(
              redisUrl,
              "e007-runtime-deny",
            );
            const telemetry = [];
            let terminalCalls = 0;
            let retryCalls = 0;
            const consumer = await BullMqConsumer.connect(
              INTERACTIVE_WORKER_MANIFEST,
              queueConfig(
                INTERACTIVE_WORKER_MANIFEST,
                redisUrl,
                "e007-runtime-deny",
              ),
              [
                {
                  eventType: "GenerationRecoveryRequested",
                  eventVersion: "v1",
                  async handle(job, transaction) {
                    terminalCalls += 1;
                    const current = await transaction.execute(
                      `SELECT revision FROM daily_energy.app_generation_intent
                       WHERE id=$1`,
                      [job.aggregateRef],
                    );
                    if (current.rows[0]?.revision !== job.aggregateRevision) {
                      throw new QueueTerminalError("TERMINAL_STALE_GUARD");
                    }
                    return "HANDLED";
                  },
                },
                {
                  eventType: "GenerationIntentDue",
                  eventVersion: "v1",
                  async handle() {
                    retryCalls += 1;
                    throw new QueueRetryableError("SYNTHETIC_RETRYABLE");
                  },
                },
              ],
              store,
              { record: (item) => telemetry.push(item) },
            );
            try {
              const wrongProfile = envelope({
                aggregateRef: randomUUID(),
                eventType: "DataTaskDue",
              });
              await producer.enqueue("interactive", wrongProfile);
              const wrongJob = await waitForJob(
                producer,
                "interactive",
                wrongProfile.eventId,
                "failed",
              );
              assert.equal(wrongJob.attemptsMade, 1);

              const stale = envelope({
                aggregateRef: intentId,
                aggregateRevision: 1,
                eventType: "GenerationRecoveryRequested",
              });
              await producer.enqueue("interactive", stale);
              const staleJob = await waitForJob(
                producer,
                "interactive",
                stale.eventId,
                "failed",
              );
              assert.equal(staleJob.attemptsMade, 1);
              assert.equal(terminalCalls, 1);
              const terminalReceipt = await admin.query(
                `SELECT "outcomeCode" FROM runtime_inbox_receipt
                 WHERE "eventId"=$1`,
                [stale.eventId],
              );
              assert.equal(
                terminalReceipt.rows[0].outcomeCode,
                "TERMINAL_STALE_GUARD",
              );

              const retryable = envelope({
                aggregateRef: randomUUID(),
                eventType: "GenerationIntentDue",
              });
              await producer.enqueue("interactive", retryable, {
                attempts: 3,
                backoffDelayMs: 10,
              });
              const retryJob = await waitForJob(
                producer,
                "interactive",
                retryable.eventId,
                "failed",
              );
              assert.equal(retryJob.attemptsMade, 3);
              assert.equal(retryCalls, 3);
              assert.equal(
                await count(admin, "runtime_inbox_receipt", '"eventId"=$1', [
                  retryable.eventId,
                ]),
                0,
              );
              await assert.rejects(
                producer.enqueue("interactive", retryable, { attempts: 6 }),
                /QUEUE_RETRY_POLICY_INVALID/u,
              );
              assert.ok(
                telemetry.some(
                  (item) => item.reasonCode === "QUEUE_PROFILE_REJECTED",
                ),
              );
              assert.ok(
                telemetry.some(
                  (item) => item.reasonCode === "TERMINAL_STALE_GUARD",
                ),
              );
            } finally {
              await consumer.drain(2_000);
              await producer.close();
              await store.close();
            }
          },
        );

        await t.test(
          "S30-REPO-032 Restricted profile commits with its deletion role",
          async () => {
            await redisContainer.exec(["redis-cli", "FLUSHALL"]);
            const accountId = await insertAccount(admin, "DELETING");
            const taskId = await insertDataTask(admin, accountId);
            const event = envelope({
              aggregateRef: taskId,
              eventType: "DataTaskDue",
              guardEpochs: { deletion: "3" },
            });
            const store = await connectStore(
              "worker-restricted",
              loginUrls.deletion,
              RESTRICTED_WORKER_MANIFEST,
            );
            const producer = await BullMqProducer.connect(
              redisUrl,
              "e007-restricted-profile",
            );
            const consumer = await BullMqConsumer.connect(
              RESTRICTED_WORKER_MANIFEST,
              queueConfig(
                RESTRICTED_WORKER_MANIFEST,
                redisUrl,
                "e007-restricted-profile",
              ),
              [
                {
                  eventType: event.eventType,
                  eventVersion: "v1",
                  async handle(job, transaction) {
                    const updated = await transaction.execute(
                      `UPDATE daily_energy.restricted_data_task
                       SET revision=revision+1
                       WHERE id=$1 AND revision=$2`,
                      [job.aggregateRef, job.aggregateRevision],
                    );
                    assert.equal(updated.rowCount, 1);
                    return "HANDLED";
                  },
                },
              ],
              store,
            );
            try {
              await producer.enqueue("restricted", event);
              await waitForJob(
                producer,
                "restricted",
                event.eventId,
                "completed",
              );
              const result = await admin.query(
                `SELECT task.revision, receipt."outcomeCode"
                 FROM restricted_data_task task
                 JOIN runtime_inbox_receipt receipt ON receipt."eventId"=$2
                 WHERE task.id=$1`,
                [taskId, event.eventId],
              );
              assert.deepEqual(result.rows[0], {
                outcomeCode: "HANDLED",
                revision: 2,
              });
            } finally {
              await consumer.drain(2_000);
              await producer.close();
              await store.close();
              await admin.query(
                `DELETE FROM runtime_inbox_receipt WHERE "eventId"=$1`,
                [event.eventId],
              );
              await admin.query(
                `DELETE FROM restricted_deletion_guard WHERE "taskRef"=$1`,
                [taskId],
              );
              await admin.query(
                `DELETE FROM restricted_data_task WHERE id=$1`,
                [taskId],
              );
            }
          },
        );

        await t.test(
          "S29-ARCH-022/S31-TEST-027 empty Redis rebuilds eligible PG facts only",
          async () => {
            await redisContainer.stop();
            const replacement = await startRedis();
            redisContainer = replacement.container;
            redisUrl = replacement.url;
            await admin.query(
              `UPDATE app_generation_intent
               SET state='CANCELLED', "updatedAt"=now()
               WHERE state IN ('QUEUED','RUNNING','FALLBACK_RUNNING','RETRYABLE_FAILED')`,
            );
            await admin.query("DELETE FROM runtime_inbox_receipt");
            await admin.query("DELETE FROM runtime_outbox_event");

            const activeAccount = await insertAccount(admin);
            const validGeneration = await insertGeneration(
              admin,
              activeAccount,
            );
            const expiredAccount = await insertAccount(admin);
            const expiredGeneration = await insertGeneration(
              admin,
              expiredAccount,
              { expires: "now() - interval '1 minute'" },
            );
            const deletedAccount = await insertAccount(admin, "DELETED");
            const deletedGeneration = await insertGeneration(
              admin,
              deletedAccount,
            );
            const validNotification = await insertNotification(
              admin,
              activeAccount,
            );
            const expiredNotification = await insertNotification(
              admin,
              expiredAccount,
              { expires: "now() - interval '1 minute'" },
            );
            const deletingAccount = await insertAccount(admin, "DELETING");
            const validDataTask = await insertDataTask(admin, deletingAccount);
            const expiredTaskAccount = await insertAccount(admin, "DELETING");
            const expiredDataTask = await insertDataTask(
              admin,
              expiredTaskAccount,
              { expires: "now() - interval '1 minute'" },
            );
            const deletedTaskAccount = await insertAccount(admin, "DELETED");
            const deletedDataTask = await insertDataTask(
              admin,
              deletedTaskAccount,
              { kind: "EXPORT" },
            );
            const publishedEvent = await insertOutbox(admin, {
              aggregateRef: randomUUID(),
              eventType: "DailyResultPublished",
              state: "PUBLISHED",
            });
            const consumedEvent = await insertOutbox(admin, {
              aggregateRef: randomUUID(),
              eventType: "DayLit",
              state: "PUBLISHED",
            });
            const expiredEvent = await insertOutbox(admin, {
              aggregateRef: randomUUID(),
              eventType: "DailyResultPublished",
              expires: "now() - interval '1 minute'",
              state: "PUBLISHED",
            });
            const generationFactsBefore = await count(
              admin,
              "app_generation_intent",
              "true",
            );
            await admin.query(
              `INSERT INTO runtime_inbox_receipt
                (id,"consumerCode","eventId","eventFingerprint","processedAt",
                 "outcomeCode","retentionPolicyVersion","retentionScope",
                 "retentionAnchorAt","expiresAt")
               VALUES ($1,'background-relationship',$2,$3,now(),'HANDLED',
                       'queue-runtime-v1','RUNTIME',now(),now()+interval '1 day')`,
              [randomUUID(), consumedEvent, hash(`receipt:${consumedEvent}`)],
            );

            const interactiveStore = await connectStore(
              "worker-interactive",
              loginUrls.interactive,
              INTERACTIVE_WORKER_MANIFEST,
            );
            const backgroundStore = await connectStore(
              "worker-background",
              loginUrls.background,
              BACKGROUND_WORKER_MANIFEST,
            );
            const restrictedStore = await connectStore(
              "worker-restricted",
              loginUrls.deletion,
              RESTRICTED_WORKER_MANIFEST,
            );
            const producer = await BullMqProducer.connect(
              redisUrl,
              "e007-redis-replacement",
            );
            try {
              const results = await Promise.all([
                new RedisLossRebuilder({
                  manifest: INTERACTIVE_WORKER_MANIFEST,
                  producer,
                  store: interactiveStore,
                }).rebuild(),
                new RedisLossRebuilder({
                  manifest: BACKGROUND_WORKER_MANIFEST,
                  producer,
                  store: backgroundStore,
                }).rebuild(),
                new RedisLossRebuilder({
                  manifest: RESTRICTED_WORKER_MANIFEST,
                  producer,
                  store: restrictedStore,
                }).rebuild(),
              ]);
              assert.deepEqual(results, [
                {
                  dueRows: 1,
                  publishedOutbox: 0,
                  skippedReceipts: 0,
                  unsupported: 0,
                },
                {
                  dueRows: 1,
                  publishedOutbox: 1,
                  skippedReceipts: 1,
                  unsupported: 0,
                },
                {
                  dueRows: 1,
                  publishedOutbox: 0,
                  skippedReceipts: 0,
                  unsupported: 0,
                },
              ]);
              for (const [family, eventId] of [
                ["interactive", validGeneration],
                ["background", validNotification],
                ["background", publishedEvent],
                ["restricted", validDataTask],
              ]) {
                assert.ok(await producer.getJob(family, eventId));
              }
              for (const [family, eventId] of [
                ["interactive", expiredGeneration],
                ["interactive", deletedGeneration],
                ["background", expiredNotification],
                ["background", consumedEvent],
                ["background", expiredEvent],
                ["restricted", expiredDataTask],
                ["restricted", deletedDataTask],
              ]) {
                assert.equal(await producer.getJob(family, eventId), undefined);
              }
              const restrictedJob = await producer.getJob(
                "restricted",
                validDataTask,
              );
              assert.deepEqual(restrictedJob.data.guardEpochs, {
                deletion: "3",
              });
              assert.equal(
                await count(admin, "app_generation_intent", "true"),
                generationFactsBefore,
              );
            } finally {
              await producer.close();
              await interactiveStore.close();
              await backgroundStore.close();
              await restrictedStore.close();
            }
          },
        );

        await t.test(
          "S32-DEPLOY-027 in-flight work drains before Redis disconnect",
          async () => {
            await redisContainer.exec(["redis-cli", "FLUSHALL"]);
            const accountId = await insertAccount(admin);
            const intentId = await insertGeneration(admin, accountId);
            const event = envelope({ aggregateRef: intentId });
            const store = await connectStore(
              "worker-interactive",
              loginUrls.interactive,
              INTERACTIVE_WORKER_MANIFEST,
            );
            const producer = await BullMqProducer.connect(
              redisUrl,
              "e007-graceful-drain",
            );
            let releaseHandler;
            const handlerStarted = Promise.withResolvers();
            const handlerRelease = new Promise((resolve) => {
              releaseHandler = resolve;
            });
            const consumer = await BullMqConsumer.connect(
              INTERACTIVE_WORKER_MANIFEST,
              queueConfig(
                INTERACTIVE_WORKER_MANIFEST,
                redisUrl,
                "e007-graceful-drain",
              ),
              [
                {
                  eventType: event.eventType,
                  eventVersion: "v1",
                  async handle() {
                    handlerStarted.resolve();
                    await handlerRelease;
                    return "HANDLED";
                  },
                },
              ],
              store,
            );
            try {
              await producer.enqueue("interactive", event);
              await handlerStarted.promise;
              let drained = false;
              const drain = consumer.drain(2_000).then(() => {
                drained = true;
              });
              await new Promise((resolve) => setImmediate(resolve));
              assert.equal(drained, false);
              releaseHandler();
              await drain;
              assert.equal(drained, true);
              await waitForJob(
                producer,
                "interactive",
                event.eventId,
                "completed",
              );
            } finally {
              releaseHandler();
              await consumer.drain(2_000);
              await producer.close();
              await store.close();
            }
          },
        );
      } finally {
        await admin.end();
      }
    } finally {
      await Promise.allSettled([
        postgresContainer.stop(),
        redisContainer.stop(),
      ]);
    }
  },
);
