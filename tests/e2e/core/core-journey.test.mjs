#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { GenericContainer, Wait } from "testcontainers";

import {
  bootstrapTestDatabase,
  loadPg,
  loadTestcontainers,
  POSTGRES_IMAGE,
  runNode,
} from "../../database/container-harness.mjs";

const enabled = process.env.CORE_E2E_ENABLED === "1";
const runOrdinal = process.env.CORE_E2E_RUN_ORDINAL ?? "1";
const prismaBin = path.resolve(
  "node_modules/.bin",
  process.platform === "win32" ? "prisma.CMD" : "prisma",
);
const REDIS_IMAGE =
  "redis:8.2.1-bookworm@sha256:5fa2edb1e408fa8235e6db8fab01d1afaaae96c9403ba67b70feceb8661e8621";
const FORBIDDEN_OUTPUT =
  /stack|prisma|sql|provider|model|prompt|openid|ciphertext|deletion_epoch|guard_epoch/iu;

class MutableClock {
  #value = new Date("2026-08-30T12:00:00.000Z");

  now() {
    return new Date(this.#value);
  }

  setProductDate(productDate) {
    this.#value = new Date(`${productDate}T12:00:00.000Z`);
  }
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

function workerConfig(
  connectionString,
  redisUrl,
  keyPrefix,
  manifest,
  fingerprint,
) {
  return {
    database: {
      applicationName: `c016:${manifest.profile}:${runOrdinal}`,
      connectionLimit: 4,
      connectionString,
    },
    queue: {
      concurrency: 2,
      drainTimeoutMs: 3_000,
      egressAllowlist: [...manifest.egressAllowlist],
      expectedCapabilityFingerprint: fingerprint(manifest),
      expectedDatabaseRole: manifest.databaseRole,
      expectedProfile: manifest.profile,
      keyPrefix,
      redisUrl,
      restoreReadiness: "NORMAL",
    },
  };
}

async function requestJson(baseUrl, route, options = {}) {
  const headers = {
    ...(options.authorization === undefined
      ? {}
      : { Authorization: options.authorization }),
    ...(options.body === undefined
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.body?.command_ref === undefined
      ? {}
      : { "Idempotency-Key": options.body.command_ref }),
    ...(options.headers ?? {}),
  };
  const response = await fetch(new URL(route, baseUrl), {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
  });
  const body = await response.json();
  if (options.expectedStatus !== undefined) {
    assert.equal(
      response.status,
      options.expectedStatus,
      `${route}:${JSON.stringify(body)}`,
    );
  }
  if (!response.ok) {
    assert.doesNotMatch(JSON.stringify(body), FORBIDDEN_OUTPUT);
  }
  return { body, response };
}

function authenticated(sessionToken) {
  return `Bearer ${sessionToken}`;
}

async function pollUntil(label, read, accept, drive = async () => undefined) {
  const deadline = Date.now() + 12_000;
  let last;
  while (Date.now() < deadline) {
    await drive();
    last = await read();
    if (accept(last)) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`CORE_E2E_POLL_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

async function connectAdmin(connectionString) {
  const { Client } = loadPg();
  const client = new Client({
    application_name: `c016-core-e2e-admin-${runOrdinal}`,
    connectionString,
  });
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  await client.query("SET search_path TO daily_energy, pg_catalog");
  return client;
}

async function scalar(admin, statement, values = []) {
  return (await admin.query(statement, values)).rows[0]?.value;
}

test(
  "T-C016-CORE-E2E-001 runs the deterministic seven-day, recovery, Safety and deletion journey",
  {
    skip: enabled ? false : "set CORE_E2E_ENABLED=1 to run real dependencies",
    timeout: 180_000,
  },
  async () => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const [postgresContainer, redis] = await Promise.all([
      new PostgreSqlContainer(POSTGRES_IMAGE).start(),
      startRedis(),
    ]);
    const resources = [];
    let application;
    let maintenanceApplication;
    let interactiveWorker;
    let backgroundWorker;
    let restrictedWorker;
    let generationRuntime;
    try {
      const adminUrl = postgresContainer.getConnectionUri();
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      await runNode("tooling/database/seed.mjs", { DATABASE_URL: adminUrl });

      const [
        apiAdapters,
        restrictedApiAdapters,
        testingAdapters,
        interactiveAdapters,
        backgroundAdapters,
        restrictedAdapters,
        apiBootstrap,
        runtimeConfig,
      ] = await Promise.all([
        import("../../../packages/server-adapters/dist/api/index.js"),
        import("../../../packages/server-adapters/dist/api-restricted/index.js"),
        import("../../../packages/server-adapters/dist/testing/index.js"),
        import("../../../packages/server-adapters/dist/worker-interactive/index.js"),
        import("../../../packages/server-adapters/dist/worker-background/index.js"),
        import("../../../packages/server-adapters/dist/worker-restricted/index.js"),
        import("../../../apps/api/dist/bootstrap/create-api-application.js"),
        import("../../../apps/api/dist/bootstrap/runtime-config.js"),
      ]);
      const admin = await connectAdmin(adminUrl);
      resources.push(admin);
      const clock = new MutableClock();
      const cache = await apiAdapters.RedisDailyContentCache.connect({
        keyPrefix: `c016-cache-${runOrdinal}`,
        redisUrl: redis.url,
      });
      const connectApiStore = (Store, suffix, extra = {}) =>
        Store.connect({
          applicationName: `c016:${suffix}:${runOrdinal}`,
          connectionLimit: 4,
          connectionString: loginUrls.api,
          expectedDatabaseRole: "daily_energy_api",
          ...extra,
        });
      const [
        authStore,
        consentProfileStore,
        checkinStore,
        dailyGenerationStore,
        dailyInteractionStore,
        dataRightsStore,
        eveningStore,
        weeklyStore,
        eveningSafetyStore,
      ] = await Promise.all([
        connectApiStore(apiAdapters.PostgresAuthStore, "auth"),
        connectApiStore(apiAdapters.PostgresConsentProfileStore, "consent"),
        connectApiStore(apiAdapters.PostgresCheckinStore, "checkin"),
        connectApiStore(
          apiAdapters.PostgresDailyGenerationStore,
          "generation",
          {
            cache,
          },
        ),
        connectApiStore(
          apiAdapters.PostgresDailyInteractionStore,
          "interaction",
        ),
        connectApiStore(apiAdapters.PostgresDataRightsStore, "rights"),
        connectApiStore(apiAdapters.PostgresEveningStore, "evening"),
        connectApiStore(apiAdapters.PostgresWeeklyStore, "weekly"),
        restrictedApiAdapters.PostgresEveningSafetyStore.connect({
          applicationName: `c016:safety:${runOrdinal}`,
          connectionLimit: 2,
          connectionString: loginUrls.safety,
          expectedDatabaseRole: "daily_energy_safety",
        }),
      ]);
      resources.push(
        authStore,
        consentProfileStore,
        checkinStore,
        dailyGenerationStore,
        dailyInteractionStore,
        dataRightsStore,
        eveningStore,
        weeklyStore,
        eveningSafetyStore,
      );

      const keyPrefix = `c016-core-${runOrdinal}`;
      generationRuntime =
        await testingAdapters.PostgresDailyGenerationRuntime.connect({
          applicationName: `c016:generation-runtime:${runOrdinal}`,
          connectionLimit: 4,
          connectionString: loginUrls.interactive,
          expectedDatabaseRole: "daily_energy_interactive",
        });
      const interactiveConfig = workerConfig(
        loginUrls.interactive,
        redis.url,
        keyPrefix,
        interactiveAdapters.workerInteractiveManifest,
        interactiveAdapters.fingerprintCapabilityManifest,
      );
      const startInteractive = () =>
        interactiveAdapters.startWorkerInteractiveInfrastructure(
          interactiveConfig,
          testingAdapters.createInteractiveGenerationHandlers({
            executeIntent: (intentRef) =>
              generationRuntime.executeIntent(intentRef, {
                now: () => clock.now(),
              }),
          }),
        );
      interactiveWorker = await startInteractive();
      backgroundWorker = await backgroundAdapters.startWorkerBackgroundRuntime(
        workerConfig(
          loginUrls.background,
          redis.url,
          keyPrefix,
          backgroundAdapters.workerBackgroundManifest,
          backgroundAdapters.fingerprintCapabilityManifest,
        ),
      );
      restrictedWorker =
        await restrictedAdapters.startWorkerRestrictedInfrastructure(
          workerConfig(
            loginUrls.deletion,
            redis.url,
            keyPrefix,
            restrictedAdapters.workerRestrictedManifest,
            restrictedAdapters.fingerprintCapabilityManifest,
          ),
          restrictedAdapters.createDataTaskHandlers(() => clock.now()),
        );

      const logs = [];
      const config = runtimeConfig.loadRuntimeConfig({
        DAILYENERGY_CONFIG_SCHEMA_VERSION:
          runtimeConfig.API_RUNTIME_CONFIG_SCHEMA_VERSION,
        DAILYENERGY_CONTRACT_BUNDLE_VERSION:
          runtimeConfig.API_CONTRACT_BUNDLE_VERSION,
        DAILYENERGY_ENVIRONMENT: "CI",
        DAILYENERGY_LOG_LEVEL: "DEBUG",
        DAILYENERGY_MAINTENANCE_MODE: "OFF",
        DAILYENERGY_PORT: "0",
        DAILYENERGY_PRODUCT_DATE_POLICY_VERSION:
          runtimeConfig.PRODUCT_DATE_POLICY_VERSION,
        DAILYENERGY_RELEASE_ID: `c016-core-${runOrdinal}`,
        DAILYENERGY_RUNTIME_PROFILE: "API",
        DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
      });
      application = await apiBootstrap.createApiApplication(config, {
        adminAudienceVerifier: {
          verify: (value) => value === "Bearer synthetic-admin-c016",
        },
        authStore,
        checkinStore,
        consentProfileStore,
        dailyGenerationStore,
        dailyInteractionStore,
        dataRightsStore,
        eveningSafetyGate: {
          decide: async ({ note }) =>
            note === "synthetic-safety-trigger"
              ? {
                  categoryCodes: ["SELF_HARM"],
                  classifierVersion: "synthetic-classifier-v1",
                  irreversibleFingerprint: createHash("sha256")
                    .update(note)
                    .digest(),
                  outcome: "HIGH_RISK",
                  policyVersion: "safety-policy-v1",
                  ruleVersion: "synthetic-rule-v1",
                }
              : { outcome: "INDETERMINATE" },
        },
        eveningSafetyStore,
        eveningStore,
        ordinaryLogSink: { write: (event) => logs.push(event) },
        productDateClock: clock,
        weeklyStore,
      });
      await application.listen(0, "127.0.0.1");
      const baseUrl = await application.getUrl();

      const firstSession = await requestJson(
        baseUrl,
        "/v1/auth/wechat/session",
        {
          body: { code: "dev:c016-owner:device-a" },
          expectedStatus: 200,
        },
      );
      const tokenA = firstSession.body.data.session_token;
      const authA = authenticated(tokenA);
      assert.equal(firstSession.body.data.consent_required, true);
      assert.doesNotMatch(
        JSON.stringify(firstSession.body),
        /openid|ciphertext/iu,
      );
      const accountId = await scalar(
        admin,
        `SELECT "accountId" AS value FROM app_session_credential
          ORDER BY "issuedAt" DESC LIMIT 1`,
      );
      await admin.query(
        `UPDATE app_user_account SET "createdAt"='2026-08-29T12:00:00.000Z'
          WHERE id=$1`,
        [accountId],
      );

      const consentCommand = "c016-consent-command-0001";
      await requestJson(baseUrl, "/v1/consent/accept", {
        authorization: authA,
        body: {
          command_ref: consentCommand,
          notice_version: "necessary-consent-v1",
        },
        expectedStatus: 200,
      });
      await requestJson(baseUrl, "/v1/onboarding/complete", {
        authorization: authA,
        body: {
          command_ref: "c016-onboarding-command-0001",
          expression_style: "BALANCED",
          preferred_name: "合成测试者",
        },
        expectedStatus: 200,
      });
      const secondSession = await requestJson(
        baseUrl,
        "/v1/auth/wechat/session",
        {
          body: { code: "dev:c016-owner:device-b" },
          expectedStatus: 200,
        },
      );
      const tokenB = secondSession.body.data.session_token;
      const authB = authenticated(tokenB);
      assert.equal(secondSession.body.data.consent_required, false);
      assert.equal(secondSession.body.data.onboarding_required, false);
      await admin.query(
        `UPDATE app_session_credential SET "issuedAt"='2026-08-29T12:00:00.000Z'
          WHERE "accountId"=$1`,
        [accountId],
      );
      assert.equal(
        await scalar(
          admin,
          "SELECT count(*)::int AS value FROM app_user_account",
        ),
        1,
      );

      const dates = [
        "2026-08-30",
        "2026-08-31",
        "2026-09-01",
        "2026-09-02",
        "2026-09-03",
        "2026-09-04",
        "2026-09-05",
      ];
      const resultRefs = [];
      for (const [index, productDate] of dates.entries()) {
        clock.setProductDate(productDate);
        const activeAuth = index % 2 === 0 ? authA : authB;
        if (index === 0) {
          const withoutCheckin = await requestJson(
            baseUrl,
            "/v1/daily/generation/start",
            {
              authorization: authA,
              body: {
                command_ref: "c016-generation-without-checkin",
                expected_checkin_revision: 1,
              },
              expectedStatus: 422,
            },
          );
          assert.equal(
            withoutCheckin.body.error.code,
            "STATE_PRECONDITION_FAILED",
          );
          const invalidCheckin = await requestJson(
            baseUrl,
            "/v1/daily/checkin/submit",
            {
              authorization: authA,
              body: {
                command_ref: "c016-invalid-checkin",
                energy: "STEADY",
                expected_revision: 0,
                mood: "GOOD",
                sleep: "OKAY",
                unknown: "must-fail",
              },
              expectedStatus: 400,
            },
          );
          assert.deepEqual(invalidCheckin.body.error.details.fields, [
            { field: "$", reason: "unrecognized_keys" },
          ]);
        }
        const checkinBody = {
          command_ref: `c016-checkin-${index}`,
          energy: index % 3 === 0 ? "STEADY" : "HIGH",
          expected_revision: 0,
          mood: index % 2 === 0 ? "GOOD" : "STEADY",
          sleep: "OKAY",
        };
        const checkins =
          index === 0
            ? await Promise.all([
                requestJson(baseUrl, "/v1/daily/checkin/submit", {
                  authorization: authA,
                  body: checkinBody,
                  expectedStatus: 200,
                }),
                requestJson(baseUrl, "/v1/daily/checkin/submit", {
                  authorization: authB,
                  body: checkinBody,
                  expectedStatus: 200,
                }),
              ])
            : [
                await requestJson(baseUrl, "/v1/daily/checkin/submit", {
                  authorization: activeAuth,
                  body: checkinBody,
                  expectedStatus: 200,
                }),
              ];
        assert.equal(
          new Set(checkins.map(({ body }) => body.data.checkin_ref)).size,
          1,
        );

        const generationBody = {
          command_ref: `c016-generation-${index}`,
          expected_checkin_revision: 1,
        };
        const firstGeneration = await requestJson(
          baseUrl,
          "/v1/daily/generation/start",
          {
            authorization: activeAuth,
            body: generationBody,
            expectedStatus: 200,
          },
        );
        const replayGeneration = await requestJson(
          baseUrl,
          "/v1/daily/generation/start",
          {
            authorization: index === 0 ? authB : activeAuth,
            body: generationBody,
            expectedStatus: 200,
          },
        );
        assert.equal(
          replayGeneration.body.data.intent_ref,
          firstGeneration.body.data.intent_ref,
        );

        if (index === 3) {
          await interactiveWorker.drain();
          interactiveWorker = undefined;
          await backgroundWorker.relayOnce();
          const pending = await requestJson(baseUrl, "/v1/daily/today", {
            authorization: activeAuth,
            expectedStatus: 503,
          });
          assert.equal(pending.body.error.code, "GENERATION_PENDING");
          interactiveWorker = await startInteractive();
          const rebuilt = await interactiveWorker.rebuild();
          assert.ok(rebuilt.publishedOutbox >= 1 || rebuilt.dueRows >= 1);
        }

        const today = await pollUntil(
          `today-${productDate}`,
          async () =>
            requestJson(baseUrl, "/v1/daily/today", {
              authorization: activeAuth,
            }),
          ({ response }) => response.status === 200,
          () => backgroundWorker.relayOnce(),
        );
        const resultRef = today.body.data.content.result_id;
        resultRefs.push(resultRef);
        assert.equal(today.body.data.content.product_date, productDate);
        assert.equal(today.body.data.interaction.is_lit, false);
        assert.doesNotMatch(
          JSON.stringify(today.body),
          /provider|model|prompt|seed|guard_epoch|deletion_epoch/iu,
        );

        const sameDayReturn = await requestJson(baseUrl, "/v1/daily/today", {
          authorization: index % 2 === 0 ? authB : authA,
          expectedStatus: 200,
        });
        assert.equal(sameDayReturn.body.data.content.result_id, resultRef);

        if (index === 0) {
          const task = today.body.data.interaction.task;
          const taskAttempts = await Promise.all([
            requestJson(baseUrl, "/v1/daily/interaction/task", {
              authorization: authA,
              body: {
                command_ref: "c016-task-device-a",
                expected_revision: task.revision,
                product_date: productDate,
                status: "COMPLETED",
                task_ref: task.task_id,
              },
            }),
            requestJson(baseUrl, "/v1/daily/interaction/task", {
              authorization: authB,
              body: {
                command_ref: "c016-task-device-b",
                expected_revision: task.revision,
                product_date: productDate,
                status: "SKIPPED",
                task_ref: task.task_id,
              },
            }),
          ]);
          assert.deepEqual(
            taskAttempts.map(({ response }) => response.status).sort(),
            [200, 409],
          );
          assert.equal(
            taskAttempts.find(({ response }) => response.status === 409).body
              .error.code,
            "REVISION_CONFLICT",
          );
        }

        const lightBody = {
          command_ref: `c016-light-${index}`,
          product_date: productDate,
          result_ref: resultRef,
        };
        const lights =
          index === 0
            ? await Promise.all([
                requestJson(baseUrl, "/v1/daily/interaction/light", {
                  authorization: authA,
                  body: lightBody,
                  expectedStatus: 200,
                }),
                requestJson(baseUrl, "/v1/daily/interaction/light", {
                  authorization: authB,
                  body: lightBody,
                  expectedStatus: 200,
                }),
              ])
            : [
                await requestJson(baseUrl, "/v1/daily/interaction/light", {
                  authorization: activeAuth,
                  body: lightBody,
                  expectedStatus: 200,
                }),
              ];
        assert.equal(
          lights.every(({ body }) => body.data.is_lit),
          true,
        );

        await pollUntil(
          `relationship-${productDate}`,
          () =>
            scalar(
              admin,
              `SELECT count(*)::int AS value
                 FROM app_relationship_encounter_link link
                 JOIN app_relationship_cycle cycle ON cycle.id=link."cycleId"
                WHERE cycle."accountId"=(SELECT "accountId" FROM app_session_credential
                  ORDER BY "issuedAt" LIMIT 1)`,
            ),
          (count) => count === index + 1,
          () => backgroundWorker.relayOnce(),
        );

        const currentInteraction = await requestJson(
          baseUrl,
          "/v1/daily/interaction",
          { authorization: activeAuth, expectedStatus: 200 },
        );
        await requestJson(baseUrl, "/v1/evening/save", {
          authorization: activeAuth,
          body: {
            client_context: {
              entry_source: "TODAY_EVENING_CARD",
              view_schema_version: "1.0.0",
            },
            command_ref: `c016-evening-${index}`,
            expected_feedback_revision: 0,
            expected_helpfulness_revision:
              currentInteraction.body.data.helpfulness.revision,
            helpfulness_rating: "HELPFUL",
            overall_feeling: index % 2 === 0 ? "PRETTY_GOOD" : "STEADY",
            product_date: productDate,
          },
          expectedStatus: 200,
        });
        await backgroundWorker.relayOnce();
      }

      clock.setProductDate(dates.at(-1));
      const weekly = await pollUntil(
        "weekly-seven-day",
        async () => {
          const response = await requestJson(baseUrl, "/v1/weekly/current", {
            authorization: authA,
          });
          if (response.body.error?.code === "DEPENDENCY_UNAVAILABLE") {
            try {
              await weeklyStore.get({
                accountId,
                endProductDate: dates.at(-1),
              });
            } catch (error) {
              throw new Error(
                `CORE_E2E_WEEKLY_ADAPTER:${
                  error instanceof Error ? error.message : "UNKNOWN"
                }`,
                { cause: error },
              );
            }
          }
          return response;
        },
        ({ response, body }) =>
          response.status === 200 && body.data.summary_status === "AVAILABLE",
        () => backgroundWorker.relayOnce(),
      );
      assert.equal(weekly.body.data.coverage.real_state_day_count, 7);
      assert.equal(weekly.body.data.activity.lit_day_count, 7);
      assert.equal(weekly.body.data.days.length, 7);
      assert.equal(
        weekly.body.data.days.every((day) => day.state === "RECORDED"),
        true,
      );

      assert.equal(
        await scalar(
          admin,
          "SELECT count(*)::int AS value FROM runtime_gateway_attempt",
        ),
        0,
      );
      assert.equal(
        await scalar(
          admin,
          "SELECT count(*)::int AS value FROM app_published_daily_result",
        ),
        7,
      );
      assert.equal(
        await scalar(
          admin,
          `SELECT count(*)::int AS value FROM runtime_outbox_event
            WHERE "eventType"='GenerationIntentAccepted'`,
        ),
        7,
      );
      assert.deepEqual(
        (
          await admin.query(
            `SELECT DISTINCT "provenancePayload"->>'generation_mode' AS mode
               FROM app_published_daily_result`,
          )
        ).rows.map(({ mode }) => mode),
        ["CONTROLLED_TEMPLATE"],
      );

      await redis.container.exec(["redis-cli", "FLUSHALL"]);
      const rebuilds = await Promise.all([
        interactiveWorker.rebuild(),
        backgroundWorker.rebuild(),
        restrictedWorker.rebuild(),
      ]);
      assert.ok(rebuilds.some((result) => result.skippedReceipts > 0));
      const afterRedisLoss = await requestJson(baseUrl, "/v1/daily/today", {
        authorization: authB,
        expectedStatus: 200,
      });
      assert.equal(
        afterRedisLoss.body.data.content.result_id,
        resultRefs.at(-1),
      );

      const adminDenied = await requestJson(baseUrl, "/v1/admin/ops/overview", {
        authorization: authA,
        expectedStatus: 401,
      });
      assert.equal(adminDenied.body.error.code, "AUTH_ADMIN_REQUIRED");
      const adminView = await requestJson(baseUrl, "/v1/admin/ops/overview", {
        authorization: "Bearer synthetic-admin-c016",
        expectedStatus: 403,
      });
      assert.equal(adminView.body.error.code, "FEATURE_DISABLED");
      const forbiddenAdminMutation = await requestJson(
        baseUrl,
        "/v1/admin/safety/events/synthetic/clear",
        {
          authorization: "Bearer synthetic-admin-c016",
          body: { command_ref: "c016-forbidden-admin-safety" },
          expectedStatus: 404,
        },
      );
      assert.equal(
        forbiddenAdminMutation.body.error.code,
        "RESOURCE_NOT_FOUND",
      );

      const cachedHistoricalDay = await requestJson(
        baseUrl,
        `/v1/daily/by-date/${dates[0]}`,
        { authorization: authA, expectedStatus: 200 },
      );
      assert.equal(
        cachedHistoricalDay.body.data.content.result_id,
        resultRefs[0],
      );

      const deleteResponse = await requestJson(
        baseUrl,
        "/v1/data-rights/delete/day",
        {
          authorization: authA,
          body: {
            command_ref: "c016-delete-day-0001",
            confirmation_version: "data-rights-day-v1",
            confirmed: true,
            expected_revision: 1,
            scope: "DAY",
            target: { product_date: dates[0] },
          },
          expectedStatus: 202,
        },
      );
      const taskRef = deleteResponse.body.data.task_ref;
      const guardedRead = await requestJson(
        baseUrl,
        `/v1/daily/by-date/${dates[0]}`,
        { authorization: authB },
      );
      assert.notEqual(guardedRead.response.status, 200);
      assert.equal(
        await scalar(
          admin,
          `SELECT count(*)::int AS value FROM app_morning_checkin
            WHERE "productDate"=$1::date`,
          [dates[0]],
        ),
        1,
      );
      const deletion = await pollUntil(
        "day-deletion",
        () =>
          requestJson(baseUrl, `/v1/data-rights/tasks/${taskRef}`, {
            authorization: authA,
          }),
        ({ response, body }) =>
          response.status === 200 && body.data.status === "SUCCEEDED",
        () => backgroundWorker.relayOnce(),
      );
      assert.equal(deletion.body.data.online_erased_at !== undefined, true);
      assert.equal(
        await scalar(
          admin,
          `SELECT count(*)::int AS value FROM app_morning_checkin
            WHERE "productDate"=$1::date`,
          [dates[0]],
        ),
        0,
      );
      const afterDeletion = await requestJson(
        baseUrl,
        `/v1/daily/by-date/${dates[0]}`,
        { authorization: authA, expectedStatus: 422 },
      );
      assert.equal(afterDeletion.body.error.code, "STATE_PRECONDITION_FAILED");
      const weeklyAfterDeletion = await requestJson(
        baseUrl,
        "/v1/weekly/current",
        { authorization: authA, expectedStatus: 200 },
      );
      assert.equal(
        weeklyAfterDeletion.body.data.coverage.real_state_day_count,
        6,
      );
      assert.equal(weeklyAfterDeletion.body.data.activity.lit_day_count, 6);
      assert.equal(
        weeklyAfterDeletion.body.data.days.filter(
          (day) => day.state === "MISSING",
        ).length,
        1,
      );
      await backgroundWorker.rebuild();
      await backgroundWorker.relayOnce();
      assert.equal(
        await scalar(
          admin,
          `SELECT count(*)::int AS value FROM app_morning_checkin
            WHERE "productDate"=$1::date`,
          [dates[0]],
        ),
        0,
      );

      const feedbackCountBeforeSafety = await scalar(
        admin,
        "SELECT count(*)::int AS value FROM app_evening_feedback_record",
      );
      const safetyResponse = await requestJson(baseUrl, "/v1/evening/save", {
        authorization: authA,
        body: {
          client_context: {
            entry_source: "EDIT_EXISTING",
            view_schema_version: "1.0.0",
          },
          command_ref: "c016-safety-evening-0001",
          expected_feedback_revision: 1,
          expected_helpfulness_revision: 1,
          helpfulness_rating: "HELPFUL",
          note_patch: {
            operation: "SET",
            value: "synthetic-safety-trigger",
          },
          overall_feeling: "STEADY",
          product_date: dates.at(-1),
        },
        expectedStatus: 409,
      });
      assert.equal(safetyResponse.body.error.code, "SAFETY_OVERLAY");
      assert.equal(safetyResponse.body.error.safety_view.state, "ACTIVE");
      assert.doesNotMatch(
        JSON.stringify(safetyResponse.body),
        /synthetic-safety-trigger|SELF_HARM|classifier|ruleVersion/iu,
      );
      const safetyToday = await requestJson(baseUrl, "/v1/daily/today", {
        authorization: authA,
        expectedStatus: 409,
      });
      assert.equal(safetyToday.body.error.code, "SAFETY_BLOCKED");
      const safetyCheckin = await requestJson(
        baseUrl,
        "/v1/daily/checkin/submit",
        {
          authorization: authB,
          body: {
            command_ref: "c016-safety-blocked-checkin",
            energy: "STEADY",
            expected_revision: 0,
            mood: "STEADY",
            sleep: "OKAY",
          },
          expectedStatus: 409,
        },
      );
      assert.equal(safetyCheckin.body.error.code, "SAFETY_BLOCKED");
      const safetyBlocked = await requestJson(
        baseUrl,
        "/v1/daily/interaction/light",
        {
          authorization: authB,
          body: {
            command_ref: "c016-safety-blocked-light",
            product_date: dates.at(-1),
            result_ref: resultRefs.at(-1),
          },
          expectedStatus: 409,
        },
      );
      assert.equal(safetyBlocked.body.error.code, "SAFETY_BLOCKED");
      assert.equal(
        await scalar(
          admin,
          "SELECT count(*)::int AS value FROM app_evening_feedback_record",
        ),
        feedbackCountBeforeSafety,
      );
      assert.equal(
        await scalar(
          admin,
          "SELECT count(*)::int AS value FROM runtime_gateway_attempt",
        ),
        0,
      );
      clock.setProductDate("2026-09-06");
      const crossDaySafety = await requestJson(baseUrl, "/v1/daily/today", {
        authorization: authA,
        expectedStatus: 409,
      });
      assert.equal(crossDaySafety.body.error.code, "SAFETY_BLOCKED");

      maintenanceApplication = await apiBootstrap.createApiApplication(
        runtimeConfig.loadRuntimeConfig({
          DAILYENERGY_CONFIG_SCHEMA_VERSION:
            runtimeConfig.API_RUNTIME_CONFIG_SCHEMA_VERSION,
          DAILYENERGY_CONTRACT_BUNDLE_VERSION:
            runtimeConfig.API_CONTRACT_BUNDLE_VERSION,
          DAILYENERGY_ENVIRONMENT: "CI",
          DAILYENERGY_LOG_LEVEL: "DEBUG",
          DAILYENERGY_MAINTENANCE_MODE: "BLOCKING",
          DAILYENERGY_PORT: "0",
          DAILYENERGY_PRODUCT_DATE_POLICY_VERSION:
            runtimeConfig.PRODUCT_DATE_POLICY_VERSION,
          DAILYENERGY_RELEASE_ID: `c016-maintenance-${runOrdinal}`,
          DAILYENERGY_RUNTIME_PROFILE: "API",
          DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
        }),
        { ordinaryLogSink: { write: (event) => logs.push(event) } },
      );
      await maintenanceApplication.listen(0, "127.0.0.1");
      const maintenance = await requestJson(
        await maintenanceApplication.getUrl(),
        "/v1/bootstrap/launch",
        { expectedStatus: 403 },
      );
      assert.equal(maintenance.body.error.code, "MAINTENANCE_BLOCKING");

      const queuePayloads = (
        await admin.query(
          `SELECT "allowlistedPayload","guardEpochs" FROM runtime_outbox_event`,
        )
      ).rows;
      assert.doesNotMatch(
        JSON.stringify(queuePayloads),
        /preferred_name|checkin|mood|energy|sleep|note|prompt|expression|provider|openid/iu,
      );
      assert.doesNotMatch(
        JSON.stringify(logs),
        /合成测试者|synthetic-safety-trigger|SELF_HARM|openid|authorization|prompt/iu,
      );
    } finally {
      await maintenanceApplication?.close().catch(() => undefined);
      await application?.close().catch(() => undefined);
      await restrictedWorker?.drain().catch(() => undefined);
      await backgroundWorker?.drain().catch(() => undefined);
      await interactiveWorker?.drain().catch(() => undefined);
      await generationRuntime?.close().catch(() => undefined);
      for (const resource of resources.reverse()) {
        await resource.close?.().catch(() => undefined);
        await resource.end?.().catch(() => undefined);
      }
      await Promise.allSettled([
        redis.container.stop(),
        postgresContainer.stop(),
      ]);
    }
  },
);
