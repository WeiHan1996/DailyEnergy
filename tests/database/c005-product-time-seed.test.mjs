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
const productDate = "2026-08-21";
const boundaryAt = new Date("2026-08-21T20:00:00.000Z");
const bytes = (value) => Buffer.from(value.padEnd(64, "0").slice(0, 64), "hex");

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

async function waitForApplicationLock(client, applicationName) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const waiting = await client.query(
      `SELECT 1 FROM pg_stat_activity
        WHERE application_name=$1 AND wait_event_type='Lock'`,
      [applicationName],
    );
    if (waiting.rowCount > 0) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("C005_GUARD_FENCE_WAIT_NOT_OBSERVED");
}

async function insertDailyPublication(client, accountId) {
  const checkinId = randomUUID();
  const intentId = randomUUID();
  const snapshotId = randomUUID();
  const resultId = randomUUID();
  const visibilityId = randomUUID();
  await client.query(
    `INSERT INTO daily_energy.app_morning_checkin
       (id,"accountId","productDate","productDatePolicyVersion",revision,
        mood,energy,sleep,"firstSubmittedAt","updatedAt","sourceCommandRef",
        "retentionPolicyVersion","retentionAnchorAt","expiresAt")
     VALUES ($1,$2,$3::date,'product-date-v1',1,'STEADY','STEADY','OKAY',
             $4::timestamptz,$4::timestamptz,$5,'retention-policy-v1',
             $4::timestamptz,$4::timestamptz+interval '7 days')`,
    [checkinId, accountId, productDate, baseNow, randomUUID()],
  );
  await client.query(
    `INSERT INTO daily_energy.app_morning_checkin_revision
       (id,"checkinId",revision,mood,energy,sleep,"commandRef",
        "retentionPolicyVersion","retentionAnchorAt","expiresAt")
     VALUES (gen_random_uuid(),$1,1,'STEADY','STEADY','OKAY',$2,
             'retention-policy-v1',$3::timestamptz,
             $3::timestamptz+interval '7 days')`,
    [checkinId, randomUUID(), baseNow],
  );
  await client.query(
    `INSERT INTO daily_energy.app_generation_intent
       (id,"accountId","targetProductDate","productDatePolicyVersion",
        "acceptedAt",revision,state,"resultVersion","manifestRef",
        "manifestFingerprint","inputSnapshotFingerprint","rootSeedMaterialRef",
        "completionGrantVersion","updatedAt","retentionPolicyVersion",
        "retentionAnchorAt","expiresAt")
     VALUES ($1,$2,$3::date,'product-date-v1',$4::timestamptz,1,'QUEUED','daily-v1',
             'manifest-ref-daily-v1',$5,$6,'root-seed-ref-v1','grant-v1',
             $4::timestamptz,'retention-policy-v1',$4::timestamptz,
             $4::timestamptz+interval '7 days')`,
    [intentId, accountId, productDate, baseNow, bytes("c501"), bytes("c502")],
  );
  await client.query(
    `INSERT INTO daily_energy.app_generation_input_snapshot
       (id,"generationIntentId","checkinId","checkinRevision","schemaVersion",
        "snapshotPayload","snapshotFingerprint","retentionPolicyVersion",
        "retentionAnchorAt","expiresAt")
     VALUES ($1,$2,$3,1,'input-v1','{}',$4,'retention-policy-v1',
             $5::timestamptz,$5::timestamptz+interval '7 days')`,
    [snapshotId, intentId, checkinId, bytes("c503"), baseNow],
  );
  await client.query(
    `INSERT INTO daily_energy.app_published_daily_result
       (id,"accountId","generationIntentId","inputSnapshotId","productDate",
        "resultVersion","schemaVersion","generatedAt","ruleFactsPayload",
        "expressionCorePayload","provenancePayload","validationReceipt",
        "resultFingerprint","retentionPolicyVersion","retentionAnchorAt","expiresAt")
     VALUES ($1,$2,$3,$4,$5::date,'daily-v1','1.0.0',$6::timestamptz,
             '{}','{}','{}','{}',$7,'retention-policy-v1',$6::timestamptz,
             $6::timestamptz+interval '7 days')`,
    [
      resultId,
      accountId,
      intentId,
      snapshotId,
      productDate,
      baseNow,
      bytes("c504"),
    ],
  );
  await client.query(
    `INSERT INTO daily_energy.app_published_result_visibility
       (id,"resultId",state,revision,"sourceFingerprint","updatedAt",
        "retentionPolicyVersion","retentionAnchorAt","expiresAt")
     VALUES ($1,$2,'AVAILABLE',1,$3,$4::timestamptz,'retention-policy-v1',
             $4::timestamptz,$4::timestamptz+interval '7 days')`,
    [visibilityId, resultId, bytes("c505"), baseNow],
  );
  await client.query(
    `UPDATE daily_energy.app_generation_intent
        SET state='SUCCEEDED', "publishedResultRef"=$1, revision=2,
            "updatedAt"=$2::timestamptz
      WHERE id=$3`,
    [resultId, baseNow, intentId],
  );
  return { resultId, visibilityId };
}

test(
  "C-005 real PostgreSQL continuation fences and immutable manifest selection",
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
    let authStore;
    let consentStore;
    let manifestStore;
    let privileged;
    let productTimeStore;
    try {
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      await runNode("tooling/database/seed.mjs", {
        DATABASE_URL: adminUrl,
      });
      const { Client } = loadPg();
      apiObserver = await connect(Client, loginUrls.api, "c005-api-observer");
      privileged = await connect(Client, adminUrl, "c005-admin-observer");
      const {
        PostgresAuthStore,
        PostgresConsentProfileStore,
        PostgresProductTimeStore,
      } = await import("../../packages/server-adapters/dist/api/index.js");
      const { PostgresGenerationManifestStore } =
        await import("../../packages/server-adapters/dist/worker-interactive/index.js");
      const {
        createViewContinuationGrant,
        generationManifestFingerprintHex,
        parseGenerationManifest,
        parseProductDate,
        selectFrozenGenerationManifest,
      } =
        await import("../../packages/server-core/dist/modules/generation/public/index.js").then(
          async (generation) => ({
            ...generation,
            ...(await import("../../packages/server-core/dist/modules/product-time/public/index.js")),
          }),
        );

      authStore = await PostgresAuthStore.connect({
        applicationName: "c005-auth-store",
        connectionLimit: 4,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      consentStore = await PostgresConsentProfileStore.connect({
        applicationName: "c005-consent-store",
        connectionLimit: 4,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      productTimeStore = await PostgresProductTimeStore.connect({
        applicationName: "c005-product-time-store",
        connectionLimit: 6,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      manifestStore = await PostgresGenerationManifestStore.connect({
        applicationName: "c005-manifest-store",
        connectionLimit: 2,
        connectionString: loginUrls.interactive,
        expectedDatabaseRole: "daily_energy_interactive",
      });

      const identity = {
        keyVersion: "synthetic-key-v1",
        providerCode: "WECHAT_MINIAPP",
        subjectCiphertext: bytes("c510"),
        subjectLookupToken: bytes("c511"),
      };
      const tokenHashes = [bytes("c512"), bytes("c513"), bytes("c514")];
      const sessions = [];
      for (const [index, tokenHash] of tokenHashes.entries()) {
        const issuedAt = new Date(baseNow.getTime() + index);
        const established = await authStore.establishSession({
          identity,
          newAccount: {
            ownerScopeToken: bytes(`c52${index}`),
            stableSubjectCiphertext: bytes(`c53${index}`),
            stableSubjectKeyVersion: "synthetic-key-v1",
          },
          now: issuedAt,
          session: {
            expiresAt: new Date(issuedAt.getTime() + 30 * 24 * 60 * 60_000),
            issuedAt,
            tokenHash,
          },
        });
        assert.equal(established.status, "ACTIVE");
        if (established.status !== "ACTIVE") {
          throw new Error("C005_ACCOUNT_SETUP_FAILED");
        }
        sessions.push(established.session);
      }
      const accountId = sessions[0].accountId;
      assert.ok(sessions.every((session) => session.accountId === accountId));
      assert.equal(
        (
          await consentStore.acceptConsent({
            accountId,
            commandRef: "c005-consent-accept-0001",
            normalizedPayloadFingerprint: bytes("c540"),
            noticeVersion: "necessary-consent-v1",
            now: new Date(baseNow.getTime() + 10),
          })
        ).status,
        "ACCEPTED",
      );
      assert.equal(
        (
          await consentStore.completeOnboarding({
            accountId,
            commandRef: "c005-onboarding-0001",
            expressionStyle: "BALANCED",
            normalizedPayloadFingerprint: bytes("c541"),
            now: new Date(baseNow.getTime() + 20),
          })
        ).status,
        "ACCEPTED",
      );
      const { resultId, visibilityId } = await insertDailyPublication(
        privileged,
        accountId,
      );

      const makeGrant = (sessionRef, openedAt, grantRef = randomUUID()) =>
        createViewContinuationGrant({
          grantRef,
          openedAt,
          ownerRef: accountId,
          productDate: parseProductDate(productDate),
          resultRef: resultId,
          sessionRef,
          surface: "DLY-003",
        });

      const firstGrant = makeGrant(
        sessions[0].sessionId,
        new Date("2026-08-21T19:58:00.000Z"),
      );
      assert.equal(
        (await productTimeStore.createGrant(firstGrant)).status,
        "ACCEPTED",
      );
      assert.equal(
        (await productTimeStore.createGrant(firstGrant)).status,
        "DUPLICATE",
      );
      assert.equal(
        (
          await productTimeStore.invalidateGrant({
            expectedRevision: 1,
            grantRef: firstGrant.grantRef,
            invalidatedAt: new Date("2026-08-21T19:58:10.000Z"),
            ownerRef: accountId,
            sessionRef: sessions[0].sessionId,
          })
        )?.status,
        "ACCEPTED",
      );

      const safetyGrant = makeGrant(
        sessions[0].sessionId,
        new Date("2026-08-21T19:58:20.000Z"),
      );
      assert.equal(
        (await productTimeStore.createGrant(safetyGrant)).status,
        "ACCEPTED",
      );
      await privileged.query("BEGIN");
      await privileged.query(
        `INSERT INTO daily_energy.restricted_safety_state
           (id,"accountId",state,revision,"guardEpoch","updatedAt",
            "retentionPolicyVersion","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,'ACTIVE',1,1,$2,'retention-policy-v1',$2)`,
        [accountId, new Date("2026-08-21T19:58:30.000Z")],
      );
      const racedGrant = makeGrant(
        sessions[0].sessionId,
        new Date("2026-08-21T19:58:31.000Z"),
      );
      const racedCreate = productTimeStore.createGrant(racedGrant);
      await waitForApplicationLock(privileged, "c005-product-time-store");
      await privileged.query("COMMIT");
      assert.deepEqual(await racedCreate, {
        reason: "SAFETY_BLOCKED",
        status: "GUARD_REJECTED",
      });
      assert.ok(
        (
          await productTimeStore.getGrant({
            grantRef: safetyGrant.grantRef,
            ownerRef: accountId,
            sessionRef: sessions[0].sessionId,
          })
        )?.invalidatedAt,
      );
      await privileged.query(
        `DELETE FROM daily_energy.restricted_safety_state WHERE "accountId"=$1`,
        [accountId],
      );

      const deletionGrant = makeGrant(
        sessions[0].sessionId,
        new Date("2026-08-21T19:58:40.000Z"),
      );
      assert.equal(
        (await productTimeStore.createGrant(deletionGrant)).status,
        "ACCEPTED",
      );
      const deletionGuardId = randomUUID();
      await privileged.query(
        `INSERT INTO daily_energy.restricted_deletion_guard
           (id,"accountId",scope,"targetKey",revision,"deletionEpoch","taskRef",
            "semanticBlockedAt","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,'DAY',$3,1,1,$4,$5,'retention-policy-v1',$5)`,
        [
          deletionGuardId,
          accountId,
          productDate,
          randomUUID(),
          new Date("2026-08-21T19:58:50.000Z"),
        ],
      );
      assert.ok(
        (
          await productTimeStore.getGrant({
            grantRef: deletionGrant.grantRef,
            ownerRef: accountId,
            sessionRef: sessions[0].sessionId,
          })
        )?.invalidatedAt,
      );
      await privileged.query(
        `UPDATE daily_energy.restricted_deletion_guard
            SET "releasedAt"=$1
          WHERE id=$2`,
        [new Date("2026-08-21T19:58:51.000Z"), deletionGuardId],
      );

      const consentGrant = makeGrant(
        sessions[0].sessionId,
        new Date("2026-08-21T19:59:00.000Z"),
      );
      assert.equal(
        (await productTimeStore.createGrant(consentGrant)).status,
        "ACCEPTED",
      );
      assert.equal(
        (
          await consentStore.withdrawConsent({
            accountId,
            commandRef: "c005-consent-withdraw-0001",
            normalizedPayloadFingerprint: bytes("c542"),
            noticeVersion: "necessary-consent-v1",
            now: new Date("2026-08-21T19:59:10.000Z"),
          })
        ).status,
        "ACCEPTED",
      );
      assert.ok(
        (
          await productTimeStore.getGrant({
            grantRef: consentGrant.grantRef,
            ownerRef: accountId,
            sessionRef: sessions[0].sessionId,
          })
        )?.invalidatedAt,
      );
      assert.deepEqual(
        await productTimeStore.createGrant(
          makeGrant(
            sessions[0].sessionId,
            new Date("2026-08-21T19:59:11.000Z"),
          ),
        ),
        { reason: "CONSENT_REQUIRED", status: "GUARD_REJECTED" },
      );
      assert.equal(
        (
          await consentStore.acceptConsent({
            accountId,
            commandRef: "c005-consent-accept-0002",
            normalizedPayloadFingerprint: bytes("c543"),
            noticeVersion: "necessary-consent-v1",
            now: new Date("2026-08-21T19:59:12.000Z"),
          })
        ).status,
        "ACCEPTED",
      );

      const logoutGrant = makeGrant(
        sessions[1].sessionId,
        new Date("2026-08-21T19:59:20.000Z"),
      );
      assert.equal(
        (await productTimeStore.createGrant(logoutGrant)).status,
        "ACCEPTED",
      );
      assert.equal(
        await authStore.revokeSession({
          commandRef: "c005-session-logout-0001",
          normalizedPayloadFingerprint: bytes("c544"),
          now: new Date("2026-08-21T19:59:21.000Z"),
          tokenHash: tokenHashes[1],
        }),
        "ACCEPTED",
      );
      assert.ok(
        (
          await productTimeStore.getGrant({
            grantRef: logoutGrant.grantRef,
            ownerRef: accountId,
            sessionRef: sessions[1].sessionId,
          })
        )?.invalidatedAt,
      );

      const visibilityGrant = makeGrant(
        sessions[2].sessionId,
        new Date("2026-08-21T19:59:30.000Z"),
      );
      assert.equal(
        (await productTimeStore.createGrant(visibilityGrant)).status,
        "ACCEPTED",
      );
      await privileged.query(
        `UPDATE daily_energy.app_published_result_visibility
            SET state='BLOCKED', "blockedReasonCode"='SOURCE_DELETED',
                revision=revision+1, "updatedAt"=$1
          WHERE id=$2`,
        [new Date("2026-08-21T19:59:31.000Z"), visibilityId],
      );
      assert.ok(
        (
          await productTimeStore.getGrant({
            grantRef: visibilityGrant.grantRef,
            ownerRef: accountId,
            sessionRef: sessions[2].sessionId,
          })
        )?.invalidatedAt,
      );
      assert.deepEqual(
        await productTimeStore.createGrant(
          makeGrant(
            sessions[2].sessionId,
            new Date("2026-08-21T19:59:32.000Z"),
          ),
        ),
        { reason: "RESULT_INVALID", status: "GUARD_REJECTED" },
      );

      const invalidConstraintGrant = makeGrant(
        sessions[0].sessionId,
        new Date("2026-08-21T19:59:40.000Z"),
      );
      await assert.rejects(
        privileged.query(
          `INSERT INTO daily_energy.app_view_continuation_grant
             (id,"accountId","sessionId","surfaceCode","productDate",
              "productDatePolicyVersion","resultRef","boundaryAt",
              "allowedOperations",revision,"expiresAt","createdAt",
              "retentionPolicyVersion","retentionScope","retentionAnchorAt")
           VALUES ($1,$2,$3,'DLY-003',$4::date,'product-date-v1',$5,$6,$7,1,
                   $6::timestamptz+interval '31 minutes',$8::timestamptz,
                   'retention-policy-v1','DAY',$8::timestamptz)`,
          [
            invalidConstraintGrant.grantRef,
            accountId,
            sessions[0].sessionId,
            productDate,
            resultId,
            boundaryAt,
            invalidConstraintGrant.allowedOperations,
            invalidConstraintGrant.createdAt,
          ],
        ),
        (error) => error?.code === "23514",
      );
      await assert.rejects(
        apiObserver.query(
          `UPDATE app_view_continuation_grant
              SET "productDate"='2026-08-22'
            WHERE id=$1`,
          [firstGrant.grantRef],
        ),
        (error) => error?.code === "42501",
      );
      await assert.rejects(
        apiObserver.query(
          `DELETE FROM app_view_continuation_grant WHERE id=$1`,
          [firstGrant.grantRef],
        ),
        (error) => error?.code === "42501",
      );

      const manifestV1 = await manifestStore.findByVersion("daily-v1");
      assert.ok(manifestV1);
      const manifestV2Payload = parseGenerationManifest({
        ...manifestV1.manifest,
        result_version: "daily-v2",
        rule_version: "daily-rules-v2",
      });
      const manifestV2Ref = randomUUID();
      await privileged.query(
        `INSERT INTO daily_energy.system_version_catalog_entry
           (id,"catalogType",version,"compatibilityPayload",fingerprint,state,
            "activatedAt","createdAt")
         VALUES ($1,'GENERATION_MANIFEST','daily-v2',$2::jsonb,decode($3,'hex'),
                 'ACTIVE',$4,$4)`,
        [
          manifestV2Ref,
          JSON.stringify(manifestV2Payload),
          generationManifestFingerprintHex(manifestV2Payload),
          new Date("2026-08-21T12:00:00.000Z"),
        ],
      );
      const [beforeRelease, concurrentAfterRelease] = await Promise.all([
        manifestStore.selectActive(new Date("2026-08-21T11:59:59.999Z")),
        Promise.all(
          Array.from({ length: 8 }, () =>
            manifestStore.selectActive(new Date("2026-08-21T12:00:00.000Z")),
          ),
        ),
      ]);
      assert.equal(beforeRelease?.manifest.result_version, "daily-v1");
      assert.ok(
        concurrentAfterRelease.every(
          (entry) => entry?.manifestRef === manifestV2Ref,
        ),
      );
      const frozenV1 = await selectFrozenGenerationManifest(manifestStore, {
        acceptedAt: new Date("2026-08-21T12:00:01.000Z"),
        existing: {
          fingerprintHex: manifestV1.fingerprintHex,
          manifestRef: manifestV1.manifestRef,
          resultVersion: "daily-v1",
        },
      });
      assert.equal(frozenV1.resultVersion, "daily-v1");

      const mismatchedPayload = parseGenerationManifest({
        ...manifestV2Payload,
        result_version: "daily-mismatch-v1",
      });
      await privileged.query(
        `INSERT INTO daily_energy.system_version_catalog_entry
           (id,"catalogType",version,"compatibilityPayload",fingerprint,state,
            "activatedAt","createdAt")
         VALUES ($1,'GENERATION_MANIFEST','daily-mismatch-v1',$2::jsonb,$3,
                 'ACTIVE',$4,$4)`,
        [
          randomUUID(),
          JSON.stringify(mismatchedPayload),
          Buffer.alloc(32),
          new Date("2026-08-21T13:00:00.000Z"),
        ],
      );
      await assert.rejects(
        selectFrozenGenerationManifest(manifestStore, {
          acceptedAt: new Date("2026-08-21T13:00:00.000Z"),
        }),
        (error) => error?.code === "MANIFEST_FINGERPRINT_MISMATCH",
      );
      const manifestAcl = await privileged.query(
        `SELECT
           has_table_privilege('daily_energy_interactive',
             'daily_energy.system_version_catalog_entry','SELECT') AS read,
           has_table_privilege('daily_energy_interactive',
             'daily_energy.system_version_catalog_entry','UPDATE') AS write`,
      );
      assert.deepEqual(manifestAcl.rows[0], { read: true, write: false });
    } finally {
      await privileged?.query("ROLLBACK").catch(() => undefined);
      await manifestStore?.close().catch(() => undefined);
      await productTimeStore?.close().catch(() => undefined);
      await consentStore?.close().catch(() => undefined);
      await authStore?.close().catch(() => undefined);
      await apiObserver?.end().catch(() => undefined);
      await privileged?.end().catch(() => undefined);
      await container.stop();
    }
  },
);
