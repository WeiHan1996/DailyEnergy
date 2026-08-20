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
const baseNow = new Date("2026-08-20T10:00:00.000Z");
const bytes = (value) => Buffer.from(value.padEnd(64, "0").slice(0, 64), "hex");

function session(suffix, issuedAt = baseNow) {
  return {
    expiresAt: new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1_000),
    issuedAt,
    tokenHash: bytes(`d2${suffix}`),
  };
}

function command(accountId, commandRef, fingerprint, now = baseNow) {
  return {
    accountId,
    commandRef,
    normalizedPayloadFingerprint: bytes(fingerprint),
    now,
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

test(
  "C-002 real PostgreSQL consent/profile/preference invariants",
  {
    skip: integrationEnabled
      ? false
      : "set DATABASE_INTEGRATION=1 to run the real PostgreSQL 18 harness",
  },
  async () => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const adminUrl = container.getConnectionUri();
    let authStore;
    let consentProfileStore;
    let observer;
    let privileged;
    try {
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      const { Client } = loadPg();
      observer = await connect(Client, loginUrls.api, "c002-api-observer");
      privileged = await connect(Client, adminUrl, "c002-admin-observer");
      const { PostgresAuthStore, PostgresConsentProfileStore } =
        await import("../../packages/server-adapters/dist/api/index.js");
      authStore = await PostgresAuthStore.connect({
        applicationName: "c002-auth-store",
        connectionLimit: 4,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      consentProfileStore = await PostgresConsentProfileStore.connect({
        applicationName: "c002-consent-profile-store",
        connectionLimit: 8,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });

      const identity = {
        keyVersion: "synthetic-key-v1",
        providerCode: "WECHAT_MINIAPP",
        subjectCiphertext: bytes("c201"),
        subjectLookupToken: bytes("c202"),
      };
      const firstSession = await authStore.establishSession({
        identity,
        newAccount: {
          ownerScopeToken: bytes("c203"),
          stableSubjectCiphertext: bytes("c204"),
          stableSubjectKeyVersion: "synthetic-key-v1",
        },
        now: baseNow,
        session: session("01"),
      });
      assert.equal(firstSession.status, "ACTIVE");
      if (firstSession.status !== "ACTIVE") {
        throw new Error("C002_ACCOUNT_SETUP_FAILED");
      }
      const accountId = firstSession.session.accountId;
      assert.equal(firstSession.session.consentRequired, true);
      assert.equal(firstSession.session.onboardingRequired, true);
      assert.deepEqual(await consentProfileStore.getConsent(accountId), {
        noticeVersion: "necessary-consent-v1",
        state: "MISSING",
      });

      await privileged.query(
        `INSERT INTO daily_energy.app_necessary_consent_record
           (id,"accountId","noticeVersion","logicalIntent",status,"commandRef",
            "acceptedAt","createdAt","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,'retired-notice-v0','ORDINARY_USE','ACCEPTED',$3,$4,$4,
                 'retention-policy-v1',$4)`,
        [randomUUID(), accountId, randomUUID(), baseNow],
      );
      const retiredNoticeSession = await authStore.establishSession({
        identity,
        newAccount: {
          ownerScopeToken: bytes("c205"),
          stableSubjectCiphertext: bytes("c206"),
          stableSubjectKeyVersion: "synthetic-key-v1",
        },
        now: new Date(baseNow.getTime() + 1_000),
        session: session("02", new Date(baseNow.getTime() + 1_000)),
      });
      assert.equal(retiredNoticeSession.status, "ACTIVE");
      assert.equal(
        retiredNoticeSession.status === "ACTIVE" &&
          retiredNoticeSession.session.consentRequired,
        true,
        "an accepted retired notice cannot unlock the current ordinary journey",
      );

      const acceptInput = {
        ...command(accountId, "c002-consent-accept-0001", "aa01"),
        noticeVersion: "necessary-consent-v1",
      };
      assert.equal(
        (await consentProfileStore.acceptConsent(acceptInput)).status,
        "ACCEPTED",
      );
      assert.equal(
        (await consentProfileStore.acceptConsent(acceptInput)).status,
        "DUPLICATE",
      );
      assert.equal(
        (
          await consentProfileStore.withdrawConsent({
            ...acceptInput,
            normalizedPayloadFingerprint: bytes("aa02"),
          })
        ).status,
        "IDEMPOTENCY_CONFLICT",
      );

      const acceptedSession = await authStore.establishSession({
        identity,
        newAccount: {
          ownerScopeToken: bytes("c207"),
          stableSubjectCiphertext: bytes("c208"),
          stableSubjectKeyVersion: "synthetic-key-v1",
        },
        now: new Date(baseNow.getTime() + 2_000),
        session: session("03", new Date(baseNow.getTime() + 2_000)),
      });
      assert.equal(acceptedSession.status, "ACTIVE");
      assert.equal(
        acceptedSession.status === "ACTIVE" &&
          acceptedSession.session.consentRequired,
        false,
      );

      const onboardingInput = {
        ...command(
          accountId,
          "c002-onboarding-complete-0001",
          "bb01",
          new Date(baseNow.getTime() + 3_000),
        ),
        expressionStyle: "BALANCED",
        preferredName: {
          ciphertext: bytes("c209"),
          keyVersion: "synthetic-profile-key-v1",
        },
      };
      const onboarding =
        await consentProfileStore.completeOnboarding(onboardingInput);
      assert.equal(onboarding.status, "ACCEPTED");
      const onboardingReplay =
        await consentProfileStore.completeOnboarding(onboardingInput);
      assert.equal(onboardingReplay.status, "DUPLICATE");
      assert.equal(onboardingReplay.value.revision, 1);

      const initialFacts = await observer.query(
        `SELECT
           (SELECT count(*)::int FROM app_user_profile_revision r
             JOIN app_user_profile p ON p.id=r."profileId" WHERE p."accountId"=$1) AS revisions,
           (SELECT count(*)::int FROM app_onboarding_completion WHERE "accountId"=$1) AS onboarding,
           (SELECT count(*)::int FROM app_memory_master_preference WHERE "accountId"=$1) AS memory,
           (SELECT count(*)::int FROM app_notification_preference WHERE "accountId"=$1) AS notifications`,
        [accountId],
      );
      assert.deepEqual(initialFacts.rows[0], {
        memory: 1,
        notifications: 2,
        onboarding: 1,
        revisions: 1,
      });
      assert.deepEqual(
        await consentProfileStore.getMemoryPreferences(accountId),
        {
          dailyUseEnabled: false,
          masterEnabled: false,
          revision: 1,
          updatedAt: onboardingInput.now,
          weeklyUseEnabled: false,
        },
      );

      const checkinId = randomUUID();
      const intentId = randomUUID();
      const snapshotId = randomUUID();
      const resultId = randomUUID();
      const historicalFingerprint = bytes("bbaa");
      await privileged.query(
        `INSERT INTO daily_energy.app_morning_checkin
           (id,"accountId","productDate","productDatePolicyVersion",revision,mood,energy,sleep,
            "firstSubmittedAt","updatedAt","sourceCommandRef","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,'2026-08-20','product-date-v1',1,'STEADY','STEADY','OKAY',
                 $3,$3,$4,'retention-policy-v1',$3)`,
        [checkinId, accountId, baseNow, randomUUID()],
      );
      await privileged.query(
        `INSERT INTO daily_energy.app_morning_checkin_revision
           (id,"checkinId",revision,mood,energy,sleep,"commandRef","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,1,'STEADY','STEADY','OKAY',$3,'retention-policy-v1',$4)`,
        [randomUUID(), checkinId, randomUUID(), baseNow],
      );
      await privileged.query(
        `INSERT INTO daily_energy.app_generation_intent
           (id,"accountId","targetProductDate","productDatePolicyVersion","acceptedAt",revision,state,
            "resultVersion","manifestRef","manifestFingerprint","inputSnapshotFingerprint",
            "rootSeedMaterialRef","completionGrantVersion","createdAt","updatedAt",
            "retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,'2026-08-20','product-date-v1',$3,1,'RUNNING','result-v1','manifest',
                 $4,$5,'seed','grant',$3,$3,'retention-policy-v1',$3)`,
        [intentId, accountId, baseNow, bytes("bb01"), bytes("bb02")],
      );
      await privileged.query(
        `INSERT INTO daily_energy.app_generation_input_snapshot
           (id,"generationIntentId","checkinId","checkinRevision","schemaVersion","snapshotPayload",
            "snapshotFingerprint","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,$3,1,'snapshot-v1','{}',$4,'retention-policy-v1',$5)`,
        [snapshotId, intentId, checkinId, bytes("bb03"), baseNow],
      );
      await privileged.query(
        `INSERT INTO daily_energy.app_published_daily_result
           (id,"accountId","generationIntentId","inputSnapshotId","productDate","resultVersion",
            "schemaVersion","generatedAt","ruleFactsPayload","expressionCorePayload","provenancePayload",
            "validationReceipt","resultFingerprint","retentionPolicyVersion","retentionAnchorAt")
         VALUES ($1,$2,$3,$4,'2026-08-20','result-v1','schema-v1',$5,
                 '{"stable":true}','{"text":"historical"}','{}','{}',$6,
                 'retention-policy-v1',$5)`,
        [
          resultId,
          accountId,
          intentId,
          snapshotId,
          baseNow,
          historicalFingerprint,
        ],
      );
      await privileged.query(
        `UPDATE daily_energy.app_generation_intent
            SET state='SUCCEEDED', "publishedResultRef"=$2, revision=2, "updatedAt"=$3
          WHERE id=$1`,
        [intentId, resultId, baseNow],
      );

      const firstUpdate = {
        ...command(
          accountId,
          "c002-profile-update-0001",
          "cc01",
          new Date(baseNow.getTime() + 4_000),
        ),
        expectedRevision: 1,
        expressionStyle: "GENTLE",
        operationCode: "PROFILE_UPDATE",
      };
      const secondUpdate = {
        ...command(
          accountId,
          "c002-profile-update-0002",
          "cc02",
          new Date(baseNow.getTime() + 4_000),
        ),
        expectedRevision: 1,
        expressionStyle: "CLEAR_DIRECT",
        operationCode: "PROFILE_UPDATE",
      };
      const concurrent = await Promise.all([
        consentProfileStore.updateProfile(firstUpdate),
        consentProfileStore.updateProfile(secondUpdate),
      ]);
      assert.deepEqual(
        concurrent.map(({ status }) => status).sort(),
        ["ACCEPTED", "REVISION_CONFLICT"],
        "S19-DB-004 requires exactly one CAS winner",
      );
      const winner =
        concurrent[0].status === "ACCEPTED" ? firstUpdate : secondUpdate;
      const winnerReplay = await consentProfileStore.updateProfile(winner);
      assert.equal(winnerReplay.status, "DUPLICATE");
      assert.equal(winnerReplay.value.revision, 2);
      assert.equal(
        (
          await consentProfileStore.updateProfile({
            ...winner,
            normalizedPayloadFingerprint: bytes("cc99"),
          })
        ).status,
        "IDEMPOTENCY_CONFLICT",
      );
      const historicalAfterProfileUpdate = await privileged.query(
        `SELECT "resultFingerprint", "expressionCorePayload", "ruleFactsPayload"
           FROM daily_energy.app_published_daily_result WHERE id=$1`,
        [resultId],
      );
      assert.deepEqual(historicalAfterProfileUpdate.rows[0], {
        expressionCorePayload: { text: "historical" },
        resultFingerprint: historicalFingerprint,
        ruleFactsPayload: { stable: true },
      });

      const revisions = await observer.query(
        `SELECT r.revision, r."expiresAt", r."preferredNameCiphertext" IS NOT NULL AS "hasName"
           FROM app_user_profile_revision r
           JOIN app_user_profile p ON p.id=r."profileId"
          WHERE p."accountId"=$1 ORDER BY revision`,
        [accountId],
      );
      assert.equal(revisions.rowCount, 2);
      for (const row of revisions.rows) {
        assert.equal(row.hasName, true);
        assert.ok(
          row.expiresAt.getTime() <=
            winner.now.getTime() + 72 * 60 * 60 * 1_000,
          "old preferred-name copies must clear within 72 hours",
        );
      }

      await privileged.query(
        `DELETE FROM daily_energy.app_user_profile_revision r
          USING daily_energy.app_user_profile p
          WHERE r."profileId"=p.id AND p."accountId"=$1 AND r.revision=2`,
        [accountId],
      );
      const updateAfterRevisionExpiry = await consentProfileStore.updateProfile(
        {
          ...command(
            accountId,
            "c002-profile-after-revision-expiry",
            "cc04",
            new Date(baseNow.getTime() + 4_500),
          ),
          expectedRevision: 2,
          expressionStyle: "GENTLE",
          operationCode: "PROFILE_UPDATE",
        },
      );
      assert.equal(updateAfterRevisionExpiry.status, "ACCEPTED");
      assert.equal(updateAfterRevisionExpiry.value.revision, 3);

      const permission = await consentProfileStore.syncNotificationPermission({
        ...command(
          accountId,
          "c002-permission-sync-0001",
          "dd01",
          new Date(baseNow.getTime() + 5_000),
        ),
        deviceRef: acceptedSession.session.sessionId,
        observedAt: new Date(baseNow.getTime() + 5_000),
        observedPermission: "GRANTED",
      });
      assert.equal(permission.status, "ACCEPTED");
      assert.equal(permission.value.observedPermission, "GRANTED");
      assert.equal(permission.value.morningEnabled, false);
      assert.equal(permission.value.eveningEnabled, false);
      assert.equal(permission.value.revision, 1);

      const withdraw = await consentProfileStore.withdrawConsent({
        ...command(
          accountId,
          "c002-consent-withdraw-0001",
          "ee01",
          new Date(baseNow.getTime() + 6_000),
        ),
        noticeVersion: "necessary-consent-v1",
      });
      assert.equal(withdraw.status, "ACCEPTED");
      assert.equal(withdraw.value.state, "WITHDRAWN");
      assert.equal(
        (
          await consentProfileStore.syncNotificationPermission({
            ...command(
              accountId,
              "c002-permission-after-withdraw",
              "ee03",
              new Date(baseNow.getTime() + 6_500),
            ),
            deviceRef: acceptedSession.session.sessionId,
            observedAt: new Date(baseNow.getTime() + 6_500),
            observedPermission: "REVOKED",
          })
        ).status,
        "CONSENT_REQUIRED",
      );
      assert.equal(
        (
          await consentProfileStore.updateProfile({
            ...command(
              accountId,
              "c002-profile-after-withdraw",
              "ee02",
              new Date(baseNow.getTime() + 7_000),
            ),
            expectedRevision: 3,
            expressionStyle: "LIGHT_HUMOR",
            operationCode: "PROFILE_UPDATE",
          })
        ).status,
        "CONSENT_REQUIRED",
      );

      const secondIdentity = {
        ...identity,
        subjectCiphertext: bytes("c210"),
        subjectLookupToken: bytes("c211"),
      };
      const secondOwner = await authStore.establishSession({
        identity: secondIdentity,
        newAccount: {
          ownerScopeToken: bytes("c212"),
          stableSubjectCiphertext: bytes("c213"),
          stableSubjectKeyVersion: "synthetic-key-v1",
        },
        now: baseNow,
        session: session("04"),
      });
      assert.equal(secondOwner.status, "ACTIVE");
      assert.equal(
        secondOwner.status === "ACTIVE" &&
          (await consentProfileStore.getProfile(secondOwner.session.accountId)),
        undefined,
        "a different session owner cannot resolve the first owner's profile",
      );

      await assert.rejects(
        observer.query(`SELECT "subjectCiphertext" FROM app_external_identity`),
        /permission denied/iu,
      );
      const visibleProfileCiphertext = await observer.query(
        `SELECT "preferredNameCiphertext" FROM app_user_profile WHERE "accountId"=$1`,
        [accountId],
      );
      assert.equal(visibleProfileCiphertext.rowCount, 1);
      assert.ok(
        Buffer.isBuffer(
          visibleProfileCiphertext.rows[0].preferredNameCiphertext,
        ),
      );
      await assert.rejects(
        observer.query(`DELETE FROM app_user_profile WHERE "accountId"=$1`, [
          accountId,
        ]),
        /permission denied/iu,
      );
    } catch (error) {
      process.stderr.write(
        `C002_CONSENT_PROFILE_ROOT:${error instanceof Error ? error.message : "UNKNOWN"}\n`,
      );
      throw error;
    } finally {
      await authStore?.close().catch(() => undefined);
      await consentProfileStore?.close().catch(() => undefined);
      await observer?.end().catch(() => undefined);
      await privileged?.end().catch(() => undefined);
      await container.stop();
    }
  },
);
