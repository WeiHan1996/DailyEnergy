// @ts-check
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import {
  POSTGRES_IMAGE,
  bootstrapTestDatabase,
  loadPg,
  loadTestcontainers,
  runNode,
} from "./container-harness.mjs";

const integrationEnabled = process.env.DATABASE_INTEGRATION === "1";
const prismaBin = path.resolve(
  "node_modules/.bin",
  process.platform === "win32" ? "prisma.CMD" : "prisma",
);
const baseNow = new Date("2026-09-14T04:00:00.000Z");
const CALIBRATION = Object.freeze({ minimumEncounterDays: 3 });

function bytes(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

function command(accountId, commandRef, label, now = baseNow) {
  return {
    accountId,
    commandRef,
    normalizedPayloadFingerprint: bytes(label),
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

async function createReadyAccount(auth, consent, label) {
  const established = await auth.establishSession({
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
  assert.equal(established.status, "ACTIVE");
  const accountId = established.session.accountId;
  assert.equal(
    (
      await consent.acceptConsent({
        ...command(accountId, `${label}-consent-command`, `${label}:consent`),
        noticeVersion: "necessary-consent-v1",
      })
    ).status,
    "ACCEPTED",
  );
  assert.equal(
    (
      await consent.completeOnboarding({
        ...command(
          accountId,
          `${label}-onboarding-command`,
          `${label}:onboarding`,
        ),
        expressionStyle: "BALANCED",
      })
    ).status,
    "ACCEPTED",
  );
  return accountId;
}

/**
 * Synthetic relationship fixtures. Foreign keys to generated light facts are
 * not what is under test, so the administrator session skips FK triggers.
 */
async function seedCycle(admin, accountId, encounterDays, publishedNode) {
  await admin.query("SET session_replication_role = replica");
  try {
    const cycle = (
      await admin.query(
        `INSERT INTO app_relationship_cycle
           (id,"accountId",revision,"startedAt","sourceCutoffEpoch",state,
            "activeSlot","projectionFingerprint","retentionPolicyVersion",
            "retentionScope","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,1,$2,0,'ACTIVE',true,$3,
                 'retention-policy-v1','RELATIONSHIP_DATA',$2)
         RETURNING id`,
        [accountId, baseNow, bytes(`${accountId}:projection`)],
      )
    ).rows[0].id;
    for (let day = 0; day < encounterDays; day += 1) {
      await admin.query(
        `INSERT INTO app_relationship_encounter_link
           (id,"cycleId","sourceLightId","productDate","sourceValidityRevision",
            "sourceEventId","retentionPolicyVersion","retentionScope",
            "retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,gen_random_uuid(),
                 ($2::date + $3::int),1,gen_random_uuid(),
                 'retention-policy-v1','RELATIONSHIP_DATA',$2)`,
        [cycle, "2026-09-10", day],
      );
    }
    if (publishedNode) {
      await admin.query(
        `INSERT INTO app_relationship_node_receipt
           (id,"cycleId","nodeCode","sourceFingerprint","outcomeCode",
            "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,'STYLE_CALIBRATION_AVAILABLE',$2,
                 'PUBLISHED','retention-policy-v1','RELATIONSHIP_DATA',$3)`,
        [cycle, bytes(`${cycle}:node`), baseNow],
      );
    }
    return cycle;
  } finally {
    await admin.query("SET session_replication_role = origin");
  }
}

async function nodeOutcome(admin, cycleId) {
  const rows = (
    await admin.query(
      `SELECT "outcomeCode" FROM app_relationship_node_receipt
        WHERE "cycleId"=$1 AND "nodeCode"='STYLE_CALIBRATION_AVAILABLE'`,
      [cycleId],
    )
  ).rows;
  return rows.length === 0 ? undefined : rows[0].outcomeCode;
}

async function profileState(admin, accountId) {
  const row = (
    await admin.query(
      `SELECT revision,"expressionStyle"::text AS style,
              (SELECT count(*)::int FROM app_user_profile_revision revision_row
                WHERE revision_row."profileId"=profile.id) AS revisions
         FROM app_user_profile profile WHERE profile."accountId"=$1`,
      [accountId],
    )
  ).rows[0];
  return { revision: row.revision, revisions: row.revisions, style: row.style };
}

test(
  "AI-010 real PostgreSQL style calibration eligibility, outcome receipt, CAS and idempotency",
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
      const admin = await connect(Client, adminUrl, "ai010-admin");
      resources.push(admin);
      const api =
        await import("../../packages/server-adapters/dist/api/index.js");
      const apiConfig = {
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      };
      const auth = await api.PostgresAuthStore.connect({
        ...apiConfig,
        applicationName: "ai010-auth",
      });
      const consent = await api.PostgresConsentProfileStore.connect({
        ...apiConfig,
        applicationName: "ai010-consent",
      });
      resources.push(auth, consent);

      const owner = await createReadyAccount(auth, consent, "ai010-owner");
      const other = await createReadyAccount(auth, consent, "ai010-other");
      const calibrate = (accountId, ref, label, over) =>
        consent.updateProfile({
          ...command(accountId, ref, label),
          calibration: { ...CALIBRATION, changesStyle: false, outcome: "KEPT" },
          expectedRevision: 1,
          operationCode: "STYLE_CALIBRATION",
          ...over,
        });

      // 1. No relationship cycle at all: not eligible, nothing changes and the
      //    rolled-back command can be retried once eligible.
      const early = await calibrate(owner, "ai010-early-command", "early", {
        calibration: {
          ...CALIBRATION,
          changesStyle: true,
          outcome: "ADJUSTED",
        },
        expressionStyle: "GENTLE",
      });
      assert.equal(early.status, "NOT_ELIGIBLE");
      assert.deepEqual(await profileState(admin, owner), {
        revision: 1,
        revisions: 1,
        style: "BALANCED",
      });

      // 2. Two encounter days are still below the threshold.
      const cycle = await seedCycle(admin, owner, 2, true);
      assert.equal(
        (await calibrate(owner, "ai010-two-days-command", "two-days")).status,
        "NOT_ELIGIBLE",
      );
      assert.equal(await nodeOutcome(admin, cycle), "PUBLISHED");

      // 3. Third day: a stale revision conflicts and leaves the receipt alone.
      await admin.query("SET session_replication_role = replica");
      await admin.query(
        `INSERT INTO app_relationship_encounter_link
           (id,"cycleId","sourceLightId","productDate","sourceValidityRevision",
            "sourceEventId","retentionPolicyVersion","retentionScope",
            "retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,gen_random_uuid(),'2026-09-12',1,
                 gen_random_uuid(),'retention-policy-v1','RELATIONSHIP_DATA',$2)`,
        [cycle, baseNow],
      );
      await admin.query("SET session_replication_role = origin");
      const stale = await calibrate(owner, "ai010-stale-command", "stale", {
        expectedRevision: 7,
      });
      assert.equal(stale.status, "REVISION_CONFLICT");
      assert.equal(await nodeOutcome(admin, cycle), "PUBLISHED");

      // 4. An adjusting answer changes the style in one profile revision and
      //    records the outcome once; the identical retry is a pure replay.
      const adjust = {
        calibration: {
          ...CALIBRATION,
          changesStyle: true,
          outcome: "ADJUSTED",
        },
        expressionStyle: "GENTLE",
      };
      const adjusted = await calibrate(
        owner,
        "ai010-adjust-command",
        "adjust",
        adjust,
      );
      assert.equal(adjusted.status, "ACCEPTED");
      assert.equal(adjusted.value.expressionStyle, "GENTLE");
      assert.equal(adjusted.value.revision, 2);
      assert.equal(await nodeOutcome(admin, cycle), "ADJUSTED");
      const replay = await calibrate(
        owner,
        "ai010-adjust-command",
        "adjust",
        adjust,
      );
      assert.equal(replay.status, "DUPLICATE");
      assert.deepEqual(await profileState(admin, owner), {
        revision: 2,
        revisions: 2,
        style: "GENTLE",
      });
      assert.equal(
        (
          await calibrate(owner, "ai010-adjust-command", "adjust-changed", {
            ...adjust,
            expectedRevision: 1,
          })
        ).status,
        "IDEMPOTENCY_CONFLICT",
      );

      // 5. Once handled, a later explicit answer (SET-002) still works but the
      //    terminal automatic-prompt outcome is never overwritten.
      const later = await calibrate(owner, "ai010-later-command", "later", {
        calibration: {
          ...CALIBRATION,
          changesStyle: false,
          outcome: "DEFERRED",
        },
        expectedRevision: 2,
      });
      assert.equal(later.status, "ACCEPTED");
      assert.equal(later.value.revision, 2);
      assert.equal(await nodeOutcome(admin, cycle), "ADJUSTED");
      assert.equal((await profileState(admin, owner)).revisions, 2);

      // 6. Another account is unaffected and still not eligible.
      assert.equal(
        (await calibrate(other, "ai010-other-command", "other")).status,
        "NOT_ELIGIBLE",
      );
      assert.deepEqual(await profileState(admin, other), {
        revision: 1,
        revisions: 1,
        style: "BALANCED",
      });

      // 7. A keep answer on a fresh cycle records KEPT without a new revision.
      const keeper = await createReadyAccount(auth, consent, "ai010-keeper");
      const keeperCycle = await seedCycle(admin, keeper, 3, true);
      const kept = await calibrate(keeper, "ai010-keep-command", "keep");
      assert.equal(kept.status, "ACCEPTED");
      assert.equal(kept.value.revision, 1);
      assert.equal(await nodeOutcome(admin, keeperCycle), "KEPT");
      assert.deepEqual(await profileState(admin, keeper), {
        revision: 1,
        revisions: 1,
        style: "BALANCED",
      });
      assert.equal(
        (await calibrate(keeper, "ai010-keep-command", "keep")).status,
        "DUPLICATE",
      );
    } finally {
      for (const resource of resources.reverse()) {
        await resource.close?.().catch?.(() => undefined);
        await resource.end?.().catch?.(() => undefined);
      }
      await container.stop();
    }
  },
);
