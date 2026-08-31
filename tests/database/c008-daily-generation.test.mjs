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
const baseNow = new Date("2026-08-24T02:00:00.000Z");
const productDate = "2026-08-24";

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

async function createReadyDay(
  stores,
  protectDevelopmentSubject,
  keyVersion,
  ordinal,
  stableSubject = `synthetic:c008:subject:${ordinal}`,
) {
  const now = new Date(baseNow.getTime() + ordinal * 1_000);
  const session = await stores.auth.establishSession({
    identity: {
      keyVersion: "synthetic-key-v1",
      providerCode: "WECHAT_MINIAPP",
      subjectCiphertext: bytes(`c008:identity:${ordinal}`),
      subjectLookupToken: bytes(`c008:lookup:${ordinal}`),
    },
    newAccount: {
      ownerScopeToken: bytes(`c008:owner:${ordinal}`),
      stableSubjectCiphertext: protectDevelopmentSubject(stableSubject),
      stableSubjectKeyVersion: keyVersion,
    },
    now,
    session: {
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
      issuedAt: now,
      tokenHash: bytes(`c008:session:${ordinal}`),
    },
  });
  assert.equal(session.status, "ACTIVE");
  if (session.status !== "ACTIVE") {
    throw new Error("C008_ACCOUNT_SETUP_FAILED");
  }
  const accountId = session.session.accountId;
  assert.equal(
    (
      await stores.consent.acceptConsent({
        accountId,
        commandRef: `c008-consent-${ordinal}`,
        normalizedPayloadFingerprint: bytes(`c008:consent:${ordinal}`),
        noticeVersion: "necessary-consent-v1",
        now: new Date(now.getTime() + 1),
      })
    ).status,
    "ACCEPTED",
  );
  assert.equal(
    (
      await stores.consent.completeOnboarding({
        accountId,
        commandRef: `c008-onboarding-${ordinal}`,
        expressionStyle: "BALANCED",
        normalizedPayloadFingerprint: bytes(`c008:onboarding:${ordinal}`),
        now: new Date(now.getTime() + 2),
      })
    ).status,
    "ACCEPTED",
  );
  assert.equal(
    (
      await stores.checkin.submit({
        accountId,
        commandRef: `c008-checkin-${ordinal}`,
        energy: "STEADY",
        mood: "GOOD",
        normalizedPayloadFingerprint: bytes(`c008:checkin:${ordinal}`),
        now: new Date(now.getTime() + 3),
        productDate,
        productDatePolicyVersion: "product-date-v1",
        sleep: "OKAY",
      })
    ).status,
    "ACCEPTED",
  );
  return accountId;
}

async function startGeneration(store, accountId, ordinal, fingerprint) {
  return store.start({
    accountId,
    commandRef: `c008-generation-${ordinal}`,
    expectedCheckinRevision: 1,
    normalizedPayloadFingerprint: bytes(fingerprint),
    now: new Date(baseNow.getTime() + ordinal * 1_000 + 10),
    productDate,
    productDatePolicyVersion: "product-date-v1",
  });
}

async function acceptedEnvelope(admin, intentRef) {
  const row = (
    await admin.query(
      `SELECT id,"aggregateRef","aggregateRevision","eventType",
              "eventVersion","guardEpochs","createdAt"
         FROM runtime_outbox_event
        WHERE "aggregateRef"=$1 AND "eventType"='GenerationIntentAccepted'`,
      [intentRef],
    )
  ).rows[0];
  assert.ok(row);
  return {
    aggregateRef: row.aggregateRef,
    aggregateRevision: row.aggregateRevision,
    contract: "dailyenergy.job",
    eventId: row.id,
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    guardEpochs: Object.fromEntries(
      Object.entries(row.guardEpochs).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
    occurredAt: row.createdAt.toISOString(),
    queueVersion: 1,
  };
}

async function claimIntent(queueStore, handler, envelope) {
  const consumed = await queueStore.consumeInbox(
    "interactive-generation",
    envelope,
    (transaction) => handler.handle(envelope, transaction),
  );
  assert.equal(consumed.outcomeCode, "GENERATION_CLAIMED");
  assert.equal(consumed.terminal, false);
}

test(
  "C-008 real PostgreSQL idempotent generation, publication and guard fences",
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
      await runNode("tooling/database/seed.mjs", { DATABASE_URL: adminUrl });
      const { Client } = loadPg();
      const admin = await connect(Client, adminUrl, "c008-admin");
      const api = await connect(Client, loginUrls.api, "c008-api-observer");
      const interactive = await connect(
        Client,
        loginUrls.interactive,
        "c008-interactive-observer",
      );
      const safety = await connect(Client, loginUrls.safety, "c008-safety");
      const deletion = await connect(
        Client,
        loginUrls.deletion,
        "c008-deletion",
      );
      resources.push(admin, api, interactive, safety, deletion);

      const apiAdapters =
        await import("../../packages/server-adapters/dist/api/index.js");
      const testingAdapters =
        await import("../../packages/server-adapters/dist/testing/index.js");
      const auth = await apiAdapters.PostgresAuthStore.connect({
        applicationName: "c008-auth-store",
        connectionLimit: 4,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const consent = await apiAdapters.PostgresConsentProfileStore.connect({
        applicationName: "c008-consent-store",
        connectionLimit: 4,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const checkin = await apiAdapters.PostgresCheckinStore.connect({
        applicationName: "c008-checkin-store",
        connectionLimit: 4,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const generation = await apiAdapters.PostgresDailyGenerationStore.connect(
        {
          applicationName: "c008-generation-store",
          connectionLimit: 8,
          connectionString: loginUrls.api,
          expectedDatabaseRole: "daily_energy_api",
        },
      );
      const dailyInteraction =
        await apiAdapters.PostgresDailyInteractionStore.connect({
          applicationName: "c010-daily-interaction-store",
          connectionLimit: 8,
          connectionString: loginUrls.api,
          expectedDatabaseRole: "daily_energy_api",
        });
      const runtime =
        await testingAdapters.PostgresDailyGenerationRuntime.connect({
          applicationName: "c008-generation-runtime",
          connectionLimit: 8,
          connectionString: loginUrls.interactive,
          expectedDatabaseRole: "daily_energy_interactive",
        });
      const queueStore = await testingAdapters.PostgresQueueStore.connect({
        applicationName: "c008-queue-store",
        connectionLimit: 4,
        connectionString: loginUrls.interactive,
        expectedDatabaseRole: "daily_energy_interactive",
        profile: "worker-interactive",
      });
      resources.push(
        auth,
        consent,
        checkin,
        generation,
        dailyInteraction,
        runtime,
        queueStore,
      );
      const stores = { auth, consent, checkin };
      const handlers =
        testingAdapters.createInteractiveGenerationHandlers(runtime);
      const acceptedHandler = handlers.find(
        ({ eventType }) => eventType === "GenerationIntentAccepted",
      );
      assert.ok(acceptedHandler);

      const accountId = await createReadyDay(
        stores,
        apiAdapters.protectDevelopmentSubject,
        apiAdapters.DEVELOPMENT_SUBJECT_KEY_VERSION,
        1,
      );
      const concurrentStarts = await Promise.all([
        startGeneration(generation, accountId, 1, "c008:start:a"),
        generation.start({
          accountId,
          commandRef: "c008-generation-concurrent",
          expectedCheckinRevision: 1,
          normalizedPayloadFingerprint: bytes("c008:start:b"),
          now: new Date(baseNow.getTime() + 1_010),
          productDate,
          productDatePolicyVersion: "product-date-v1",
        }),
      ]);
      assert.deepEqual(concurrentStarts.map(({ status }) => status).sort(), [
        "ACCEPTED",
        "DUPLICATE",
      ]);
      const intentRef = concurrentStarts[0].value.intent_ref;
      assert.equal(concurrentStarts[1].value.intent_ref, intentRef);
      const accepted = await acceptedEnvelope(admin, intentRef);
      await claimIntent(queueStore, acceptedHandler, accepted);

      const outcomes = await Promise.all([
        runtime.executeIntent(intentRef, {
          now: () => new Date(baseNow.getTime() + 2_000),
        }),
        runtime.executeIntent(intentRef, {
          now: () => new Date(baseNow.getTime() + 2_000),
        }),
      ]);
      assert.deepEqual(outcomes.sort(), ["PUBLISHED", "RETURN_EXISTING"]);
      const counts = (
        await admin.query(
          `SELECT
             (SELECT count(*)::int FROM app_generation_intent
               WHERE "accountId"=$1 AND "targetProductDate"=$2) AS intents,
             (SELECT count(*)::int FROM app_generation_input_snapshot s
               JOIN app_generation_intent i ON i.id=s."generationIntentId"
              WHERE i."accountId"=$1 AND i."targetProductDate"=$2) AS snapshots,
             (SELECT count(*)::int FROM app_published_daily_result
               WHERE "accountId"=$1 AND "productDate"=$2) AS results,
             (SELECT count(*)::int FROM runtime_outbox_event
               WHERE "aggregateRef"=$3 AND "eventType"='GenerationIntentAccepted') AS accepted_events,
             (SELECT count(*)::int FROM runtime_outbox_event
               WHERE "aggregateRef"=(SELECT "publishedResultRef" FROM app_generation_intent WHERE id=$3)
                 AND "eventType"='DailyResultPublished') AS published_events`,
          [accountId, productDate, intentRef],
        )
      ).rows[0];
      assert.deepEqual(counts, {
        accepted_events: 1,
        intents: 1,
        published_events: 1,
        results: 1,
        snapshots: 1,
      });
      assert.equal(
        (
          await queueStore.consumeInbox(
            "interactive-generation",
            accepted,
            (transaction) => acceptedHandler.handle(accepted, transaction),
          )
        ).duplicate,
        true,
      );
      assert.equal(
        await runtime.executeIntent(intentRef, {
          now: () => new Date(baseNow.getTime() + 2_100),
        }),
        "RETURN_EXISTING",
      );

      const today = await generation.getToday({ accountId, productDate });
      assert.equal(today.status, "FOUND");
      if (today.status !== "FOUND") {
        throw new Error("C008_TODAY_MISSING");
      }
      assert.equal(today.value.content.product_date, productDate);
      assert.equal(today.value.interaction.task.status, "UNMARKED");
      assert.doesNotMatch(
        JSON.stringify(today.value),
        /score|provenance|user_ref|seed|fingerprint/iu,
      );
      const history = await generation.getByDate({ accountId, productDate });
      assert.equal(history.status, "FOUND");
      assert.equal(
        history.status === "FOUND" && history.value.checkin?.write_window,
        "CLOSED",
      );
      assert.equal(
        (await startGeneration(generation, accountId, 1, "c008:start:a"))
          .status,
        "DUPLICATE",
      );
      assert.equal(
        (await startGeneration(generation, accountId, 1, "c008:start:conflict"))
          .status,
        "IDEMPOTENCY_CONFLICT",
      );

      const sessionId = (
        await admin.query(
          `SELECT id FROM app_session_credential
            WHERE "accountId"=$1 ORDER BY "issuedAt" DESC,id LIMIT 1`,
          [accountId],
        )
      ).rows[0]?.id;
      assert.equal(typeof sessionId, "string");
      assert.deepEqual(
        await dailyInteraction.openToday({
          accountId,
          openedAt: new Date("2026-08-24T19:59:00.000Z"),
          productDate,
          resultId: today.value.interaction.result_id,
          sessionId,
        }),
        { status: "RECORDED" },
      );
      const interestedInput = {
        accountId,
        commandRef: "c010-task-interested",
        expectedRevision: 1,
        normalizedPayloadFingerprint: bytes("c010:task:interested"),
        now: new Date(baseNow.getTime() + 3_000),
        productDate,
        productDatePolicyVersion: "product-date-v1",
        sessionId,
        status: "INTERESTED",
        taskRef: today.value.interaction.task.task_id,
      };
      const interested = await dailyInteraction.updateTask(interestedInput);
      assert.equal(interested.status, "ACCEPTED");
      assert.equal(
        interested.status === "ACCEPTED" && interested.value.task.revision,
        2,
      );
      assert.equal(
        interested.status === "ACCEPTED" && interested.value.is_lit,
        false,
      );
      assert.equal(
        (await dailyInteraction.updateTask(interestedInput)).status,
        "DUPLICATE",
      );
      assert.equal(
        (
          await dailyInteraction.updateTask({
            ...interestedInput,
            normalizedPayloadFingerprint: bytes("c010:task:changed-payload"),
          })
        ).status,
        "IDEMPOTENCY_CONFLICT",
      );

      const concurrentTaskUpdates = await Promise.all([
        dailyInteraction.updateTask({
          ...interestedInput,
          commandRef: "c010-task-completed",
          expectedRevision: 2,
          normalizedPayloadFingerprint: bytes("c010:task:completed"),
          status: "COMPLETED",
        }),
        dailyInteraction.updateTask({
          ...interestedInput,
          commandRef: "c010-task-skipped",
          expectedRevision: 2,
          normalizedPayloadFingerprint: bytes("c010:task:skipped"),
          status: "SKIPPED",
        }),
      ]);
      assert.deepEqual(
        concurrentTaskUpdates.map(({ status }) => status).sort(),
        ["ACCEPTED", "REVISION_CONFLICT"],
      );
      const currentInteraction = await dailyInteraction.get({
        accountId,
        productDate,
      });
      assert.equal(currentInteraction.status, "FOUND");
      if (currentInteraction.status !== "FOUND") {
        throw new Error("C010_INTERACTION_MISSING");
      }
      assert.equal(currentInteraction.value.task.revision, 3);
      assert.equal(currentInteraction.value.is_lit, false);
      assert.equal(
        (
          await dailyInteraction.updateTask({
            ...interestedInput,
            commandRef: "c010-task-noop",
            expectedRevision: 3,
            normalizedPayloadFingerprint: bytes("c010:task:noop"),
            status: currentInteraction.value.task.status,
          })
        ).status,
        "DUPLICATE",
      );
      const continued = await dailyInteraction.updateTask({
        ...interestedInput,
        commandRef: "c010-task-continuation",
        expectedRevision: 3,
        normalizedPayloadFingerprint: bytes("c010:task:continuation"),
        now: new Date("2026-08-24T20:05:00.000Z"),
        status: "UNMARKED",
      });
      assert.equal(continued.status, "ACCEPTED");
      assert.equal(
        continued.status === "ACCEPTED" && continued.value.task.revision,
        4,
      );
      assert.equal(
        (
          await dailyInteraction.updateTask({
            ...interestedInput,
            commandRef: "c010-task-expired",
            expectedRevision: 4,
            normalizedPayloadFingerprint: bytes("c010:task:expired"),
            now: new Date("2026-08-24T20:31:00.000Z"),
            status: "INTERESTED",
          })
        ).status,
        "VIEW_CONTINUATION_EXPIRED",
      );
      const taskHistory = await generation.getByDate({
        accountId,
        productDate,
      });
      assert.equal(taskHistory.status, "FOUND");
      assert.equal(
        taskHistory.status === "FOUND" &&
          taskHistory.value.interaction?.task.status,
        "UNMARKED",
      );

      const c010DeletionTaskRef = randomUUID();
      await admin.query(
        `INSERT INTO restricted_data_task
          (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",
           state,revision,"confirmationVersion","requestedAt",
           "failureScopeCodes","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,'DELETE','DAY','DAY',$3,true,'QUEUED',1,
                 'confirmation-v1',$4,ARRAY[]::text[],
                 'retention-policy-v1',$4)`,
        [c010DeletionTaskRef, accountId, productDate, baseNow],
      );
      await deletion.query(
        `INSERT INTO restricted_deletion_guard
          (id,"accountId",scope,"targetKey",revision,"deletionEpoch",
           "taskRef","semanticBlockedAt","retentionPolicyVersion",
           "retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,'DAY',$2,1,1,$3,$4,
                 'retention-policy-v1',$4)`,
        [accountId, productDate, c010DeletionTaskRef, baseNow],
      );
      assert.equal(
        (
          await dailyInteraction.updateTask({
            ...interestedInput,
            commandRef: "c010-task-after-delete",
            expectedRevision: 4,
            normalizedPayloadFingerprint: bytes("c010:task:after-delete"),
            status: "COMPLETED",
          })
        ).status,
        "STATE_PRECONDITION_FAILED",
      );

      const blockedAccountId = await createReadyDay(
        stores,
        apiAdapters.protectDevelopmentSubject,
        apiAdapters.DEVELOPMENT_SUBJECT_KEY_VERSION,
        2,
      );
      const blockedStart = await startGeneration(
        generation,
        blockedAccountId,
        2,
        "c008:blocked:start",
      );
      assert.equal(blockedStart.status, "ACCEPTED");
      if (blockedStart.status !== "ACCEPTED") {
        throw new Error("C008_BLOCKED_INTENT_MISSING");
      }
      const blockedIntentRef = blockedStart.value.intent_ref;
      const blockedEnvelope = await acceptedEnvelope(admin, blockedIntentRef);
      await claimIntent(queueStore, acceptedHandler, blockedEnvelope);
      const blockedOutcome = await runtime.executeIntent(blockedIntentRef, {
        hooks: {
          beforePublish: async () => {
            await safety.query(
              `INSERT INTO restricted_safety_state
                (id,"accountId",state,revision,"guardEpoch","updatedAt",
                 "retentionPolicyVersion","retentionAnchorAt")
               VALUES (gen_random_uuid(),$1,'ACTIVE',1,1,$2,
                       'retention-policy-v1',$2)`,
              [blockedAccountId, new Date(baseNow.getTime() + 4_000)],
            );
          },
        },
        now: () => new Date(baseNow.getTime() + 4_000),
      });
      assert.equal(blockedOutcome, "BLOCKED");
      const blockedFacts = (
        await admin.query(
          `SELECT state::text AS state,
                  (SELECT count(*)::int FROM app_published_daily_result
                    WHERE "generationIntentId"=$1) AS results
             FROM app_generation_intent WHERE id=$1`,
          [blockedIntentRef],
        )
      ).rows[0];
      assert.deepEqual(blockedFacts, { results: 0, state: "CANCELLED" });

      const deletionAccountId = await createReadyDay(
        stores,
        apiAdapters.protectDevelopmentSubject,
        apiAdapters.DEVELOPMENT_SUBJECT_KEY_VERSION,
        3,
      );
      const deletionStart = await startGeneration(
        generation,
        deletionAccountId,
        3,
        "c008:deletion:start",
      );
      assert.equal(deletionStart.status, "ACCEPTED");
      if (deletionStart.status !== "ACCEPTED") {
        throw new Error("C008_DELETION_INTENT_MISSING");
      }
      const deletionIntentRef = deletionStart.value.intent_ref;
      await claimIntent(
        queueStore,
        acceptedHandler,
        await acceptedEnvelope(admin, deletionIntentRef),
      );
      const deletionTaskRef = randomUUID();
      await admin.query(
        `INSERT INTO restricted_data_task
          (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",
           state,revision,"confirmationVersion","requestedAt",
           "failureScopeCodes","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,'DELETE','DAY','DAY',$3,true,'QUEUED',1,
                 'confirmation-v1',$4,ARRAY[]::text[],
                 'retention-policy-v1',$4)`,
        [deletionTaskRef, deletionAccountId, productDate, baseNow],
      );
      const deletionOutcome = await runtime.executeIntent(deletionIntentRef, {
        hooks: {
          beforePublish: async () => {
            await deletion.query(
              `INSERT INTO restricted_deletion_guard
                (id,"accountId",scope,"targetKey",revision,"deletionEpoch",
                 "taskRef","semanticBlockedAt","retentionPolicyVersion",
                 "retentionAnchorAt")
               VALUES (gen_random_uuid(),$1,'DAY',$2,1,1,$3,$4,
                       'retention-policy-v1',$4)`,
              [
                deletionAccountId,
                productDate,
                deletionTaskRef,
                new Date(baseNow.getTime() + 5_000),
              ],
            );
          },
        },
        now: () => new Date(baseNow.getTime() + 5_000),
      });
      assert.equal(deletionOutcome, "BLOCKED");
      assert.equal(
        await generation
          .getToday({
            accountId: deletionAccountId,
            productDate,
          })
          .then(({ status }) => status),
        "STATE_PRECONDITION_FAILED",
      );
      assert.equal(
        await generation
          .getByDate({
            accountId: deletionAccountId,
            productDate,
          })
          .then(({ status }) => status),
        "STATE_PRECONDITION_FAILED",
      );
      assert.equal(
        await admin
          .query(
            `SELECT count(*)::int AS count FROM app_published_daily_result
              WHERE "generationIntentId"=$1`,
            [deletionIntentRef],
          )
          .then(({ rows }) => rows[0].count),
        0,
      );

      const terminalAccountId = await createReadyDay(
        stores,
        apiAdapters.protectDevelopmentSubject,
        apiAdapters.DEVELOPMENT_SUBJECT_KEY_VERSION,
        4,
        "bad",
      );
      const terminalStart = await startGeneration(
        generation,
        terminalAccountId,
        4,
        "c008:terminal:start",
      );
      assert.equal(terminalStart.status, "ACCEPTED");
      if (terminalStart.status !== "ACCEPTED") {
        throw new Error("C008_TERMINAL_INTENT_MISSING");
      }
      await claimIntent(
        queueStore,
        acceptedHandler,
        await acceptedEnvelope(admin, terminalStart.value.intent_ref),
      );
      assert.equal(
        await runtime.executeIntent(terminalStart.value.intent_ref, {
          now: () => new Date(baseNow.getTime() + 6_000),
        }),
        "TERMINAL",
      );
      assert.equal(
        await generation
          .getToday({
            accountId: terminalAccountId,
            productDate,
          })
          .then(({ status }) => status),
        "GENERATION_FAILED_TERMINAL",
      );
      assert.equal(
        (
          await generation.getIntent({
            accountId: blockedAccountId,
            intentRef,
          })
        ).status,
        "NOT_FOUND",
      );

      await assert.rejects(
        api.query(
          `UPDATE app_generation_intent SET revision=revision+1 WHERE id=$1`,
          [intentRef],
        ),
        (error) => error?.code === "42501",
      );
      await assert.rejects(
        interactive.query(
          `UPDATE app_generation_intent SET state=state,revision=0 WHERE id=$1`,
          [intentRef],
        ),
        (error) =>
          error?.code === "23514" &&
          error.message.includes("C008_GENERATION_REVISION"),
      );
      const privileges = (
        await admin.query(
          `SELECT
             has_function_privilege('daily_energy_api',
               'daily_energy.resolve_generation_guard_snapshot(uuid,date,text)',
               'EXECUTE') AS api_guard,
             has_function_privilege('daily_energy_interactive',
               'daily_energy.resolve_generation_guard_snapshot(uuid,date,text)',
               'EXECUTE') AS interactive_guard,
             has_table_privilege('daily_energy_interactive',
               'daily_energy.restricted_safety_state','SELECT') AS direct_safety`,
        )
      ).rows[0];
      assert.deepEqual(privileges, {
        api_guard: true,
        direct_safety: false,
        interactive_guard: true,
      });
    } finally {
      for (const resource of resources.reverse()) {
        if (typeof resource.close === "function") {
          await resource.close().catch(() => undefined);
        } else if (typeof resource.end === "function") {
          await resource.end().catch(() => undefined);
        }
      }
      await container.stop();
    }
  },
);
