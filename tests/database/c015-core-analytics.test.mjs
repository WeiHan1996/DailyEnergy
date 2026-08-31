import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  POSTGRES_IMAGE,
  bootstrapTestDatabase,
  loadPg,
  loadTestcontainers,
  runNode,
} from "./container-harness.mjs";

const integrationEnabled = process.env.DATABASE_INTEGRATION === "1";
const prismaBin = new URL("../../node_modules/.bin/prisma", import.meta.url)
  .pathname;
const D0 = "2026-08-20";

test(
  "C-015 PostgreSQL T4 isolation, k=10, metrics, retention and revision rebuild",
  {
    skip: integrationEnabled
      ? false
      : "set DATABASE_INTEGRATION=1 to run the real PostgreSQL 18 harness",
  },
  async () => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const adminUrl = container.getConnectionUri();
    const { Client } = loadPg();
    const clients = [];
    try {
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      const admin = await connect(Client, adminUrl, "c015-admin");
      const api = await connect(Client, loginUrls.api, "c015-api");
      const background = await connect(
        Client,
        loginUrls.background,
        "c015-background",
      );
      const inspect = await connect(Client, loginUrls.test, "c015-inspect");
      clients.push(admin, api, background, inspect);

      const rawTables = await inspect.query(
        `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='daily_energy' AND c.relkind='r'
            AND relname ~ '^analytics_.*(raw|subject|session|event_store)'`,
      );
      assert.equal(rawTables.rowCount, 0);
      await assert.rejects(
        api.query(
          "SELECT * FROM daily_energy.analytics_product_daily_aggregate",
        ),
        /permission denied/u,
      );
      await assert.rejects(
        background.query(
          "SELECT * FROM daily_energy.analytics_safety_daily_aggregate",
        ),
        /permission denied/u,
      );
      await assert.rejects(
        api.query(
          `SELECT daily_energy.increment_c015_client_signal_aggregate(
             $1::date,'TEST','landing_viewed',$2::jsonb,9,$3::timestamptz
           )`,
          [
            D0,
            dimensions("scene_code", "DIRECT"),
            new Date("2026-08-20T08:00:00Z"),
          ],
        ),
        /SUB_K_PERSISTENCE_FORBIDDEN/u,
      );
      await api.query(
        `SELECT daily_energy.increment_c015_client_signal_aggregate(
           $1::date,'TEST','landing_viewed',$2::jsonb,10,$3::timestamptz
         )`,
        [
          D0,
          dimensions("scene_code", "DIRECT"),
          new Date("2026-08-20T08:00:00Z"),
        ],
      );
      await api.query(
        `SELECT daily_energy.increment_c015_client_signal_aggregate(
           $1::date,'TEST','landing_viewed',$2::jsonb,1,$3::timestamptz
         )`,
        [
          D0,
          dimensions("scene_code", "DIRECT"),
          new Date("2026-08-20T08:01:00Z"),
        ],
      );
      await assert.rejects(
        api.query(
          `SELECT daily_energy.increment_c015_client_signal_aggregate(
             $1::date,'TEST','day_lit','[]'::jsonb,10,$2::timestamptz
           )`,
          [D0, new Date("2026-08-20T08:00:00Z")],
        ),
        /CLIENT_SIGNAL_INVALID/u,
      );
      await assert.rejects(
        api.query(
          `SELECT daily_energy.increment_c015_client_signal_aggregate(
             $1::date,'TEST','landing_viewed',$2::jsonb,10,$3::timestamptz
           )`,
          [
            D0,
            JSON.stringify([
              { name: "scene_code", code: "DIRECT" },
              { name: "app_version_bucket", code: "1.4" },
              { name: "locale_bucket", code: "ZH_CN" },
            ]),
            new Date("2026-08-20T08:00:00Z"),
          ],
        ),
        /CLIENT_SIGNAL_INVALID/u,
      );
      const clientCell = await inspect.query(
        `SELECT "eventCount","uniqueOwnerCount","dimension1Name","dimension1Code",
                "expiresAt"::text AS expiry
           FROM daily_energy.analytics_product_daily_aggregate
          WHERE "eventName"='landing_viewed'`,
      );
      assert.deepEqual(clientCell.rows[0], {
        eventCount: "11",
        uniqueOwnerCount: null,
        dimension1Name: "scene_code",
        dimension1Code: "DIRECT",
        expiry: "2027-09-20 00:00:00+00",
      });
      await seedGateEvidence(admin, D0);

      const owners = [];
      for (let index = 0; index < 20; index += 1) {
        const owner = await seedOwner(admin, index);
        owners.push(owner);
        await seedDay(admin, owner, D0, index * 10);
        if (index < 7) {
          await seedDay(admin, owner, "2026-08-21", index * 10 + 1);
        }
        if (index < 4) {
          await seedDay(admin, owner, "2026-08-23", index * 10 + 3);
        }
        if (index < 3) {
          await seedDay(admin, owner, "2026-08-27", index * 10 + 7);
        }
      }
      for (let index = 20; index < 30; index += 1) {
        const owner = await seedOwner(admin, index);
        await seedDay(admin, owner, D0, index * 10, { light: false });
      }

      const first = await background.query(
        `SELECT daily_energy.rebuild_c015_analytics_date(
           $1::date,$2::date,'TEST',1,$3::timestamptz
         ) AS outcome`,
        [D0, "2026-08-30", new Date("2026-08-30T06:00:00Z")],
      );
      assert.equal(first.rows[0].outcome.metric_rows, 23);
      assert.equal(first.rows[0].outcome.gate_rows, 4);
      const metrics = await inspect.query(
        "SELECT daily_energy.get_c015_metric_reports($1::date,'TEST') AS reports",
        [D0],
      );
      const byId = new Map(
        metrics.rows[0].reports.map((entry) => [entry.metric_id, entry]),
      );
      assert.deepEqual(pick(byId.get("S25-M02")), {
        denominator: 30,
        numerator: 30,
        status: "FINALIZED",
        value: 1,
      });
      assert.deepEqual(pick(byId.get("S25-M05")), {
        denominator: 30,
        numerator: 20,
        status: "FINALIZED",
        value: 0.6666666667,
      });
      assert.deepEqual(pick(byId.get("S25-M07")), {
        denominator: 20,
        numerator: 7,
        status: "FINALIZED",
        value: 0.35,
      });
      assert.deepEqual(pick(byId.get("S25-M08")), {
        denominator: 20,
        numerator: 4,
        status: "FINALIZED",
        value: 0.2,
      });
      assert.deepEqual(pick(byId.get("S25-M09")), {
        denominator: 20,
        numerator: 3,
        status: "FINALIZED",
        value: 0.15,
      });
      const suppressed = byId.get("S25-M15");
      assert.equal(suppressed.status, "SUPPRESSED");
      assert.equal("numerator" in suppressed, false);
      assert.equal("denominator" in suppressed, false);
      assert.equal("value" in suppressed, false);
      assert.equal(byId.get("S25-M19").status, "UNAVAILABLE");
      assert.deepEqual(byId.get("S25-M19").notes_code, [
        "SOURCE_UNAVAILABLE",
        "POST_AGGREGATION_DELETION_NOT_RESTATED",
      ]);
      assert.equal(byId.get("S25-M22").status, "BLOCKED");
      assert.deepEqual(byId.get("S25-M22").notes_code, [
        "SOURCE_INCOMPLETE",
        "POST_AGGREGATION_DELETION_NOT_RESTATED",
      ]);

      const research = await inspect.query(
        "SELECT daily_energy.get_c015_research_metric_status('S25-Q01') AS status",
      );
      assert.deepEqual(research.rows[0].status, {
        metric_id: "S25-Q01",
        reason_code: "RESEARCH_CONTRACT_NOT_ACCEPTED",
        status: "UNAVAILABLE",
      });
      const gates = await inspect.query(
        "SELECT daily_energy.get_c015_gate_reports('TEST') AS reports",
      );
      assert.equal(gates.rows[0].reports.length, 4);
      assert.deepEqual(
        gates.rows[0].reports.map(({ gate_id, status }) => [gate_id, status]),
        [
          ["S25-G01", "PASS"],
          ["S25-G02", "PASS"],
          ["S25-G03", "PASS"],
          ["S25-G04", "PASS"],
        ],
      );
      assert.equal(
        JSON.stringify(gates.rows[0].reports).match(/owner|count|cycle/giu),
        null,
      );

      const beforeRerun = await inspect.query(
        `SELECT count(*)::int AS count FROM daily_energy.analytics_product_metric_snapshot
          WHERE "periodOrCohort"=$1::date AND "environment"='TEST'`,
        [D0],
      );
      await background.query(
        `SELECT daily_energy.rebuild_c015_analytics_date(
           $1::date,$2::date,'TEST',1,$3::timestamptz
         )`,
        [D0, "2026-08-30", new Date("2026-08-30T06:05:00Z")],
      );
      const afterRerun = await inspect.query(
        `SELECT count(*)::int AS count FROM daily_energy.analytics_product_metric_snapshot
          WHERE "periodOrCohort"=$1::date AND "environment"='TEST'`,
        [D0],
      );
      assert.equal(beforeRerun.rows[0].count, 23);
      assert.equal(afterRerun.rows[0].count, 23);

      await seedDay(admin, owners[7], "2026-08-21", 9_999);
      await background.query(
        `SELECT daily_energy.rebuild_c015_analytics_date(
           $1::date,$2::date,'TEST',2,$3::timestamptz
         )`,
        [D0, "2026-08-30", new Date("2026-08-30T06:10:00Z")],
      );
      const revised = await inspect.query(
        "SELECT daily_energy.get_c015_metric_reports($1::date,'TEST') AS reports",
        [D0],
      );
      const d1 = revised.rows[0].reports.find(
        (entry) => entry.metric_id === "S25-M07",
      );
      assert.equal(d1.numerator, 8);
      assert.equal(d1.denominator, 20);
      assert.equal(d1.aggregation_revision, 2);

      await upsertGateEvidence(admin, {
        codes: [
          ["subsystem", "AGGREGATE"],
          ["outcome_code", "MATCH"],
        ],
        eventName: "raw_content_detector_outcome",
        productDate: D0,
      });
      await background.query(
        `SELECT daily_energy.rebuild_c015_analytics_date(
           $1::date,$2::date,'TEST',3,$3::timestamptz
         )`,
        [D0, "2026-08-30", new Date("2026-08-30T06:15:00Z")],
      );
      const blockedGates = await inspect.query(
        "SELECT daily_energy.get_c015_gate_reports('TEST') AS reports",
      );
      assert.deepEqual(
        blockedGates.rows[0].reports.find(
          ({ gate_id }) => gate_id === "S25-G02",
        ),
        {
          aggregation_revision: 3,
          gate_id: "S25-G02",
          generated_at: "2026-08-30T06:15:00+00:00",
          reason_codes: ["RAW_CONTENT_MATCH"],
          status: "BLOCKED",
        },
      );
      await admin.query(
        `DELETE FROM daily_energy.analytics_runtime_daily_aggregate
          WHERE "productDate"=$1 AND "environment"='TEST'
            AND "eventName"='release_contract_outcome'
            AND "dimension1Code"='DATABASE'`,
        [D0],
      );
      await background.query(
        `SELECT daily_energy.rebuild_c015_analytics_date(
           $1::date,$2::date,'TEST',4,$3::timestamptz
         )`,
        [D0, "2026-08-30", new Date("2026-08-30T06:20:00Z")],
      );
      assert.equal(await gateStatus(inspect, "S25-G01"), "BLOCKED");
      await admin.query(
        `DELETE FROM daily_energy.analytics_runtime_daily_aggregate
          WHERE "productDate"=$1 AND "environment"='TEST'
            AND "eventName"='release_contract_outcome'
            AND "dimension1Code"='METRIC'`,
        [D0],
      );
      await background.query(
        `SELECT daily_energy.rebuild_c015_analytics_date(
           $1::date,$2::date,'TEST',5,$3::timestamptz
         )`,
        [D0, "2026-08-30", new Date("2026-08-30T06:25:00Z")],
      );
      assert.equal(await gateStatus(inspect, "S25-G03"), "BLOCKED");
      await admin.query(
        `INSERT INTO daily_energy.restricted_data_task
          (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",
           state,revision,"confirmationVersion","requestedAt","failureScopeCodes",
           "retentionPolicyVersion","retentionScope","retentionAnchorAt")
         VALUES (gen_random_uuid(),$1,'EXPORT','EXPORT_ACCOUNT','ACCOUNT','SELF',
           true,'FAILED',1,'data-rights-export-v1',$2::timestamptz,
           ARRAY['SYNTHETIC_OVERDUE'],'retention-policy-v1','RUNTIME',$2::timestamptz)`,
        [owners[0].accountId, new Date("2026-08-20T00:00:00Z")],
      );
      await background.query(
        `SELECT daily_energy.rebuild_c015_analytics_date(
           $1::date,$2::date,'TEST',6,$3::timestamptz
         )`,
        [D0, "2026-08-30", new Date("2026-08-30T06:30:00Z")],
      );
      assert.equal(await gateStatus(inspect, "S25-G04"), "BLOCKED");

      const forbiddenColumns = await inspect.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='daily_energy' AND table_name LIKE 'analytics_%'
            AND column_name ~* '(account|owner|subject|openid|device|session|ip|token|prompt|body|text|ref|fingerprint)'`,
      );
      assert.deepEqual(
        forbiddenColumns.rows.filter(
          ({ column_name }) => column_name !== "uniqueOwnerCount",
        ),
        [],
      );
      const lowCells = await inspect.query(
        `SELECT count(*)::int AS count FROM (
          SELECT "eventCount","uniqueOwnerCount" FROM daily_energy.analytics_product_daily_aggregate
          UNION ALL SELECT "eventCount","uniqueOwnerCount" FROM daily_energy.analytics_runtime_daily_aggregate
          UNION ALL SELECT "eventCount","uniqueOwnerCount" FROM daily_energy.analytics_governance_daily_aggregate
          UNION ALL SELECT "eventCount","uniqueOwnerCount" FROM daily_energy.analytics_safety_daily_aggregate
        ) cells WHERE "eventCount"<10 OR ("uniqueOwnerCount" IS NOT NULL AND "uniqueOwnerCount"<10)`,
      );
      assert.equal(lowCells.rows[0].count, 0);

      const purged = await background.query(
        `SELECT daily_energy.execute_c015_analytics_retention(
           1,'2027-09-21T00:00:00Z'::timestamptz
         ) AS deleted`,
      );
      assert.ok(Number(purged.rows[0].deleted) > 0);
      const remaining = await inspect.query(
        `SELECT count(*)::int AS count FROM daily_energy.analytics_product_metric_snapshot
          WHERE "periodOrCohort"=$1::date`,
        [D0],
      );
      assert.equal(remaining.rows[0].count, 0);
    } finally {
      await Promise.all(clients.map((client) => client.end().catch(() => {})));
      await container.stop();
    }
  },
);

async function connect(Client, connectionString, applicationName) {
  const client = new Client({
    application_name: applicationName,
    connectionString,
  });
  await client.connect();
  return client;
}

function dimensions(name, code) {
  return JSON.stringify([{ code, name }]);
}

function pick(value) {
  return {
    denominator: value.denominator,
    numerator: value.numerator,
    status: value.status,
    value: Number(value.value),
  };
}

async function seedOwner(client, index) {
  const accountId = randomUUID();
  const cycleId = randomUUID();
  const now = new Date(`2026-08-20T0${index % 9}:00:00Z`);
  await client.query(
    `INSERT INTO daily_energy.app_user_account
      (id,"ownerScopeToken","stableSubjectCiphertext","stableSubjectKeyVersion",
       state,revision,"lastActiveUseAt","inactivityDeletionDueAt","createdAt","updatedAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,$3,'synthetic-key-v1','ACTIVE',1,$4::timestamptz,$4::timestamptz+interval '24 months',$4::timestamptz,$4::timestamptz,
             'retention-policy-v1','ACCOUNT',$4::timestamptz)`,
    [
      accountId,
      Buffer.from(`owner-${index}`),
      Buffer.from(`subject-${index}`),
      now,
    ],
  );
  const consentId = randomUUID();
  await client.query(
    `INSERT INTO daily_energy.app_necessary_consent_record
      (id,"accountId","noticeVersion","logicalIntent",status,"commandRef",
       "acceptedAt","createdAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,'necessary-consent-v1','NECESSARY_CONSENT','ACCEPTED',$3,$4,$4,
             'retention-policy-v1','ACCOUNT',$4)`,
    [consentId, accountId, randomUUID(), now],
  );
  await client.query(
    `INSERT INTO daily_energy.app_onboarding_completion
      (id,"accountId","profileRevision","consentRecordId","completionCommandRef",
       "completedAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,1,$3,$4,$5,'retention-policy-v1','ACCOUNT',$5)`,
    [randomUUID(), accountId, consentId, randomUUID(), now],
  );
  await client.query(
    `INSERT INTO daily_energy.app_relationship_cycle
      (id,"accountId",revision,"startedAt","sourceCutoffEpoch",state,"activeSlot",
       "projectionFingerprint","retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,1,$3,0,'ACTIVE',true,$4,'retention-policy-v1','RELATIONSHIP_DATA',$3)`,
    [cycleId, accountId, now, Buffer.from(`cycle-${index}`)],
  );
  return { accountId, cycleId };
}

async function seedDay(
  client,
  owner,
  productDate,
  ordinal,
  { light = true } = {},
) {
  const at = new Date(`${productDate}T08:00:00Z`);
  const checkinId = randomUUID();
  const intentId = randomUUID();
  const snapshotId = randomUUID();
  const resultId = randomUUID();
  const interactionId = randomUUID();
  const lightId = randomUUID();
  await client.query(
    `INSERT INTO daily_energy.app_morning_checkin
      (id,"accountId","productDate","productDatePolicyVersion",revision,mood,energy,sleep,
       "firstSubmittedAt","updatedAt","sourceCommandRef","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt")
     VALUES ($1,$2,$3,'product-date-v1',1,'STEADY','STEADY','OKAY',$4,$4,$5,
             'retention-policy-v1','DAY',$4)`,
    [checkinId, owner.accountId, productDate, at, randomUUID()],
  );
  await client.query(
    `INSERT INTO daily_energy.app_morning_checkin_revision
      (id,"checkinId",revision,mood,energy,sleep,"commandRef","createdAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,1,'STEADY','STEADY','OKAY',$3,$4,
             'retention-policy-v1','DAY',$4)`,
    [randomUUID(), checkinId, randomUUID(), at],
  );
  await client.query(
    `INSERT INTO daily_energy.app_generation_intent
      (id,"accountId","targetProductDate","productDatePolicyVersion","acceptedAt",revision,
       state,"resultVersion","manifestRef","manifestFingerprint","inputSnapshotFingerprint",
       "rootSeedMaterialRef","completionGrantVersion","publishedResultRef","createdAt","updatedAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,$3,'product-date-v1',$4,1,'SUCCEEDED','result-v1','manifest-v1',$5,$6,
             'seed-ref-v1','grant-v1',$7,$4,$4,'retention-policy-v1','DAY',$4)`,
    [
      intentId,
      owner.accountId,
      productDate,
      at,
      Buffer.from(`manifest-${ordinal}`),
      Buffer.from(`snapshot-${ordinal}`),
      resultId,
    ],
  );
  await client.query(
    `INSERT INTO daily_energy.app_generation_input_snapshot
      (id,"generationIntentId","checkinId","checkinRevision","schemaVersion","snapshotPayload",
       "snapshotFingerprint","createdAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,$3,1,'snapshot-v1','{}'::jsonb,$4,$5,
             'retention-policy-v1','DAY',$5)`,
    [snapshotId, intentId, checkinId, Buffer.from(`snapshot-${ordinal}`), at],
  );
  await client.query(
    `INSERT INTO daily_energy.app_published_daily_result
      (id,"accountId","generationIntentId","inputSnapshotId","productDate","resultVersion",
       "schemaVersion","generatedAt","ruleFactsPayload","expressionCorePayload",
       "provenancePayload","validationReceipt","resultFingerprint","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt")
     VALUES ($1,$2,$3,$4,$5,'result-v1','daily-v1',$6::timestamptz+interval '1 second','{}','{}',
             '{"generation_mode":"AI"}','{}',$7,'retention-policy-v1','DAY',$6::timestamptz)`,
    [
      resultId,
      owner.accountId,
      intentId,
      snapshotId,
      productDate,
      at,
      Buffer.from(`result-${ordinal}`),
    ],
  );
  await client.query(
    `INSERT INTO daily_energy.app_daily_interaction
      (id,"accountId","productDate","resultId","aggregateRevision","createdAt","updatedAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,$3,$4,1,$5,$5,'retention-policy-v1','DAY',$5)`,
    [interactionId, owner.accountId, productDate, resultId, at],
  );
  if (!light) {
    return;
  }
  await client.query(
    `INSERT INTO daily_energy.app_daily_light_fact
      (id,"interactionId","sourceCommandRef","litAt","sourceValidityRevision",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,$3,$4,1,'retention-policy-v1','DAY',$4)`,
    [lightId, interactionId, randomUUID(), at],
  );
  await client.query(
    `INSERT INTO daily_energy.app_relationship_encounter_link
      (id,"cycleId","sourceLightId","productDate","sourceValidityRevision","sourceEventId",
       "createdAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
     VALUES ($1,$2,$3,$4,1,$5,$6,'retention-policy-v1','RELATIONSHIP_DATA',$6)`,
    [randomUUID(), owner.cycleId, lightId, productDate, randomUUID(), at],
  );
}

async function seedGateEvidence(client, productDate) {
  for (const contractGroup of [
    "SCHEMA",
    "API",
    "EVENT",
    "METRIC",
    "DATABASE",
  ]) {
    await upsertGateEvidence(client, {
      codes: [
        ["contract_group", contractGroup],
        ["outcome_code", "PASS"],
      ],
      eventName: "release_contract_outcome",
      productDate,
    });
  }
  for (const subsystem of ["CONTRACT", "QUEUE", "LOG", "AGGREGATE", "EXPORT"]) {
    await upsertGateEvidence(client, {
      codes: [
        ["subsystem", subsystem],
        ["outcome_code", "CLEAN"],
      ],
      eventName: "raw_content_detector_outcome",
      productDate,
    });
  }
}

async function upsertGateEvidence(client, { codes, eventName, productDate }) {
  await client.query(
    `SELECT daily_energy.upsert_c015_anonymous_aggregate(
       'RUNTIME',$1::date,'TEST',$2,$3::jsonb,10,NULL,NULL,1,$4::timestamptz
     )`,
    [
      productDate,
      eventName,
      JSON.stringify(codes.map(([name, code]) => ({ code, name }))),
      new Date(`${productDate}T10:00:00Z`),
    ],
  );
}

async function gateStatus(client, gateId) {
  const reports = await client.query(
    "SELECT daily_energy.get_c015_gate_reports('TEST') AS reports",
  );
  return reports.rows[0].reports.find((entry) => entry.gate_id === gateId)
    ?.status;
}
