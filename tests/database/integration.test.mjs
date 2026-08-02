#!/usr/bin/env node
import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bootstrapTestDatabase,
  loadPg,
  loadTestcontainers,
  POSTGRES_IMAGE,
  runCommandResult,
  runNode,
  runNodeResult,
  TEST_DATABASE_PROFILES,
} from "./container-harness.mjs";

const integrationEnabled = process.env.DATABASE_INTEGRATION === "1";
const schema = "daily_energy";
const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);
const prismaBin = path.join(repositoryRoot, "node_modules/.bin/prisma");
const tsxBin = path.join(repositoryRoot, "node_modules/.bin/tsx");

async function createInitialMigrationProject(temporaryRoot) {
  const prismaDirectory = path.join(temporaryRoot, "initial-prisma");
  const migrationsDirectory = path.join(prismaDirectory, "migrations");
  const initialDirectory = path.join(
    migrationsDirectory,
    "20260730000000_initial_application_schema",
  );
  await mkdir(initialDirectory, { recursive: true });
  await copyFile(
    path.join(repositoryRoot, "prisma/schema.prisma"),
    path.join(prismaDirectory, "schema.prisma"),
  );
  await copyFile(
    path.join(repositoryRoot, "prisma/migrations/migration_lock.toml"),
    path.join(migrationsDirectory, "migration_lock.toml"),
  );
  await copyFile(
    path.join(
      repositoryRoot,
      "prisma/migrations/20260730000000_initial_application_schema/migration.sql",
    ),
    path.join(initialDirectory, "migration.sql"),
  );
  const configPath = path.join(temporaryRoot, "initial-prisma.config.ts");
  await writeFile(
    configPath,
    `import { defineConfig } from ${JSON.stringify(import.meta.resolve("prisma/config"))};
export default defineConfig({
  schema: ${JSON.stringify(path.join(prismaDirectory, "schema.prisma"))},
  migrations: { path: ${JSON.stringify(migrationsDirectory)} },
  datasource: { url: process.env.DATABASE_URL },
});
`,
  );
  return configPath;
}

const metadata = Object.freeze({
  test_id: "T-DB-INTEGRATION-001",
  source_ids: [
    ...Array.from(
      { length: 20 },
      (_, index) => `SQL-${String(index + 1).padStart(3, "0")}`,
    ),
    "S19-DB-005",
    "S19-DB-011",
    "S19-DB-012",
    "S19-DB-045",
    "S19-DB-048",
    "S19-DB-057",
    "S19-DB-059",
    "S19-DB-061",
    "S19-DB-064",
    "S31-TEST-017",
    "S31-TEST-023",
  ],
  level: "DB",
  workload_or_profile: "TEST",
  fixture_version: "synthetic-v1",
  fault_id: null,
  expected_codes: ["23514", "42501", "55000"],
  evidence_class: "PR",
});

function id(serial) {
  return `00000000-0000-4000-8000-${String(serial).padStart(12, "0")}`;
}

async function transaction(client, statements, { reject } = {}) {
  await client.query("BEGIN");
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    if (reject) {
      assert.fail(`expected rejection matching ${reject}`);
    }
  } catch (error) {
    if (!reject) {
      throw error;
    }
    assert.match(`${error.message} ${error.code ?? ""}`, reject);
  } finally {
    await client.query("ROLLBACK");
  }
}

async function commitStatements(client, statements) {
  await client.query("BEGIN");
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runFactoryRoleProbe(
  loginUrls,
  { expected = "success", profile = "all" } = {},
) {
  const result = await runCommandResult(
    tsxBin,
    [path.join(repositoryRoot, "tests/database/factory-role-probe.ts")],
    {
      DB_FACTORY_PROBE_API_URL: loginUrls.api,
      DB_FACTORY_PROBE_BACKGROUND_URL: loginUrls.background,
      DB_FACTORY_PROBE_DELETION_URL: loginUrls.deletion,
      DB_FACTORY_PROBE_EXPECT: expected,
      DB_FACTORY_PROBE_PROFILE: profile,
      DB_FACTORY_PROBE_SAFETY_URL: loginUrls.safety,
    },
  );
  assert.equal(
    result.code,
    0,
    `factory role probe failed: profile=${profile}:expected=${expected}`,
  );
  assert.match(
    result.stdout,
    new RegExp(`DB_FACTORY_ROLE_PROBE_OK:${profile}:${expected}`, "u"),
  );
}

async function assertFactoryProbeRejectsSqlMutation(
  admin,
  loginUrls,
  profile,
  setupStatements,
  cleanupStatements,
) {
  try {
    for (const statement of setupStatements) {
      await admin.query(statement);
    }
    await runFactoryRoleProbe(loginUrls, {
      expected: "mismatch",
      profile,
    });
  } finally {
    for (const statement of cleanupStatements) {
      await admin.query(statement);
    }
  }
}

const accountInsert = (accountId, overrides = "") => `
  INSERT INTO ${schema}.app_user_account
    (id, "ownerScopeToken", "stableSubjectCiphertext", "stableSubjectKeyVersion", state,
     revision, "lastActiveUseAt", "inactivityDeletionDueAt", "updatedAt",
     "retentionPolicyVersion", "retentionAnchorAt", "expiresAt"${overrides ? `, ${overrides.split("=")[0].trim()}` : ""})
  VALUES
    ('${accountId}', decode(replace('${accountId}', '-', ''),'hex'), decode('02','hex'), 'synthetic-v1', 'ACTIVE',
     1, now(), now() + interval '30 days', now(), 'synthetic-v1', now(), now() + interval '30 days'${overrides ? `, ${overrides.split("=").slice(1).join("=").trim()}` : ""})`;

function generationIntentInsert(
  intentId,
  accountId,
  state = "QUEUED",
  published = "NULL",
  date = "2026-07-30",
  version = "result-v1",
) {
  return `INSERT INTO ${schema}.app_generation_intent
    (id, "accountId", "targetProductDate", "productDatePolicyVersion", "acceptedAt", revision,
     state, "resultVersion", "manifestRef", "manifestFingerprint", "inputSnapshotFingerprint",
     "rootSeedMaterialRef", "completionGrantVersion", "publishedResultRef", "updatedAt",
     "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
   VALUES ('${intentId}', '${accountId}', DATE '${date}', 'product-date-v1', now(), 1,
     '${state}', '${version}', 'manifest-v1', decode('10','hex'), decode('11','hex'),
     'seed-v1', 'grant-v1', ${published}, now(), 'synthetic-v1', now(), now() + interval '7 days')`;
}

function checkinInsert(checkinId, accountId) {
  return `INSERT INTO ${schema}.app_morning_checkin
    (id, "accountId", "productDate", "productDatePolicyVersion", revision, mood, energy, sleep,
     "firstSubmittedAt", "updatedAt", "sourceCommandRef", "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
   VALUES ('${checkinId}', '${accountId}', DATE '2026-07-30', 'product-date-v1', 1,
     'STEADY', 'STEADY', 'OKAY', now(), now(), '${id(900)}', 'synthetic-v1', now(), now() + interval '7 days')`;
}

function checkinRevisionInsert(
  checkinId,
  revision = 1,
  mood = "STEADY",
  energy = "STEADY",
  sleep = "OKAY",
) {
  return `INSERT INTO ${schema}.app_morning_checkin_revision
    (id, "checkinId", revision, mood, energy, sleep, "commandRef", "retentionPolicyVersion",
     "retentionAnchorAt", "expiresAt")
   VALUES (gen_random_uuid(), '${checkinId}', ${revision}, '${mood}', '${energy}', '${sleep}',
     '${id(901)}', 'synthetic-v1', now(), now() + interval '7 days')`;
}

function snapshotInsert(snapshotId, intentId, checkinId, checkinRevision = 1) {
  return `INSERT INTO ${schema}.app_generation_input_snapshot
    (id, "generationIntentId", "checkinId", "checkinRevision", "schemaVersion", "snapshotPayload",
     "snapshotFingerprint", "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
   VALUES ('${snapshotId}', '${intentId}', '${checkinId}', ${checkinRevision}, 'schema-v1', '{}',
     decode('12','hex'), 'synthetic-v1', now(), now() + interval '7 days')`;
}

function resultInsert(
  resultId,
  accountId,
  intentId,
  snapshotId,
  date = "2026-07-30",
  version = "result-v1",
) {
  return `INSERT INTO ${schema}.app_published_daily_result
    (id, "accountId", "generationIntentId", "inputSnapshotId", "productDate", "resultVersion",
     "schemaVersion", "generatedAt", "ruleFactsPayload", "expressionCorePayload", "provenancePayload",
     "validationReceipt", "resultFingerprint", "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
   VALUES ('${resultId}', '${accountId}', '${intentId}', '${snapshotId}', DATE '${date}', '${version}',
     'schema-v1', now(), '{}', '{}', '{}', '{}', decode('13','hex'), 'synthetic-v1', now(), now() + interval '7 days')`;
}

function dailyPublicationFixture(base, { secondAccount = false } = {}) {
  const account = id(base);
  const other = id(base + 1);
  const intent = id(base + 2);
  const checkin = id(base + 3);
  const snapshot = id(base + 4);
  const result = id(base + 5);
  return {
    account,
    other,
    intent,
    checkin,
    snapshot,
    result,
    statements: [
      accountInsert(account),
      ...(secondAccount ? [accountInsert(other)] : []),
      generationIntentInsert(intent, account),
      checkinInsert(checkin, account),
      checkinRevisionInsert(checkin),
      snapshotInsert(snapshot, intent, checkin),
    ],
  };
}

function weeklyFixture(base) {
  const account = id(base);
  const window = id(base + 1);
  const intent = id(base + 2);
  const summary = id(base + 3);
  return {
    account,
    window,
    intent,
    summary,
    statements: [
      accountInsert(account),
      `INSERT INTO ${schema}.app_weekly_window
        (id, "accountId", "endProductDate", "windowRuleVersion", revision, "updatedAt",
         "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
       VALUES ('${window}', '${account}', DATE '2026-07-30', 'window-v1', 1, now(),
         'synthetic-v1', now(), now() + interval '7 days')`,
      `INSERT INTO ${schema}.app_weekly_summary_intent
        (id, "windowId", "sourceFingerprint", revision, state, "summaryVersion", "updatedAt",
         "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
       VALUES ('${intent}', '${window}', decode('21','hex'), 1, 'SUCCEEDED', 'summary-v1', now(),
         'synthetic-v1', now(), now() + interval '7 days')`,
      `INSERT INTO ${schema}.app_published_weekly_summary_revision
        (id, "windowId", "summaryIntentId", revision, "sourceFingerprint", "schemaVersion",
         "summaryVersion", "expressionCorePayload", "provenancePayload", "validationReceipt", "publishedAt",
         "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
       VALUES ('${summary}', '${window}', '${intent}', 1, decode('21','hex'), 'schema-v1',
         'summary-v1', '{}', '{}', '{}', now(), 'synthetic-v1', now(), now() + interval '7 days')`,
    ],
  };
}

function dailyFragmentFixture(base) {
  const publication = dailyPublicationFixture(base);
  const visibility = id(base + 6);
  const slot = id(base + 7);
  const fragment = id(base + 8);
  return {
    ...publication,
    visibility,
    slot,
    fragment,
    statements: [
      ...publication.statements,
      resultInsert(
        publication.result,
        publication.account,
        publication.intent,
        publication.snapshot,
      ),
      `INSERT INTO ${schema}.app_published_result_visibility
        (id,"resultId",state,revision,"sourceFingerprint","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${visibility}','${publication.result}','AVAILABLE',1,decode('31','hex'),now(),'synthetic-v1',now(),now()+interval '7 days')`,
      `INSERT INTO ${schema}.app_result_content_slot
        (id,"resultId","segmentPath","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${slot}','${publication.result}','core','synthetic-v1',now(),now()+interval '7 days')`,
      `INSERT INTO ${schema}.app_personalized_content_fragment
        (id,"slotId","payloadCiphertext","payloadKeyVersion","payloadFingerprint","schemaVersion","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${fragment}','${slot}',decode('32','hex'),'synthetic-key-v1',decode('33','hex'),'fragment-v1','synthetic-v1',now(),now()+interval '7 days')`,
    ],
  };
}

function blockedDailyVisibilityFixture(base) {
  const publication = dailyPublicationFixture(base);
  const visibility = id(base + 6);
  const slot = id(base + 7);
  return {
    ...publication,
    visibility,
    slot,
    statements: [
      ...publication.statements,
      resultInsert(
        publication.result,
        publication.account,
        publication.intent,
        publication.snapshot,
      ),
      `INSERT INTO ${schema}.app_published_result_visibility
        (id,"resultId",state,revision,"sourceFingerprint","blockedReasonCode","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${visibility}','${publication.result}','BLOCKED',1,decode('31','hex'),'SOURCE_DELETED',now(),'synthetic-v1',now(),now()+interval '7 days')`,
      `INSERT INTO ${schema}.app_result_content_slot
        (id,"resultId","segmentPath","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${slot}','${publication.result}','core','synthetic-v1',now(),now()+interval '7 days')`,
    ],
  };
}

function weeklyFragmentFixture(base) {
  const publication = weeklyFixture(base);
  const slot = id(base + 4);
  const fragment = id(base + 5);
  return {
    ...publication,
    slot,
    fragment,
    statements: [
      ...publication.statements,
      `UPDATE ${schema}.app_weekly_window
          SET "currentSummaryRef"='${publication.summary}', "currentSourceFingerprint"=decode('21','hex')
        WHERE id='${publication.window}'`,
      `INSERT INTO ${schema}.app_weekly_content_slot
        (id,"summaryId","segmentPath","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${slot}','${publication.summary}','summary','synthetic-v1',now(),now()+interval '7 days')`,
      `INSERT INTO ${schema}.app_weekly_personalized_content_fragment
        (id,"slotId","payloadCiphertext","payloadKeyVersion","payloadFingerprint","schemaVersion","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${fragment}','${slot}',decode('34','hex'),'synthetic-key-v1',decode('35','hex'),'fragment-v1','synthetic-v1',now(),now()+interval '7 days')`,
    ],
  };
}

function dataTaskInsert(taskId, accountId, values) {
  return `INSERT INTO ${schema}.restricted_data_task
    (id, "accountId", kind, scope, "targetType", "targetKey", "activeSlot", state, revision,
     "confirmationVersion", "requestedAt", "guardedAt", "startedAt", "onlineErasedAt", "finishedAt",
     "backupPurgeDeadline", "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
   VALUES ('${taskId}', '${accountId}', 'DELETE', 'ACCOUNT', 'ACCOUNT', 'synthetic-target',
     ${values.activeSlot}, '${values.state}', 1, 'confirm-v1', now(), ${values.guardedAt ?? "NULL"},
     ${values.startedAt ?? "NULL"}, ${values.onlineErasedAt ?? "NULL"}, ${values.finishedAt ?? "NULL"},
     ${values.backupPurgeDeadline ?? "NULL"}, 'synthetic-v1', now(), now() + interval '30 days')`;
}

const evidence = [
  {
    id: "SQL-001",
    positive: [accountInsert(id(1))],
    negative: [
      accountInsert(id(2)).replace("'ACTIVE',\n     1,", "'ACTIVE',\n     0,"),
    ],
    reject: /positive_ck|23514/u,
  },
  {
    id: "SQL-002",
    positive: [accountInsert(id(10))],
    negative: [
      accountInsert(id(11)).replace(
        "now() + interval '30 days')",
        "now() - interval '1 second')",
      ),
    ],
    reject: /retention_interval_ck|23514/u,
  },
  {
    id: "SQL-003",
    positive: [
      accountInsert(id(20)),
      `INSERT INTO ${schema}.app_user_profile
       (id, "accountId", revision, "preferredNameCiphertext", "preferredNameKeyVersion", "profileSchemaVersion",
        "updatedAt", "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
       VALUES ('${id(21)}','${id(20)}',1,NULL,NULL,'profile-v1',now(),'synthetic-v1',now(),now()+interval '30 days')`,
    ],
    negative: [
      accountInsert(id(22)),
      `INSERT INTO ${schema}.app_user_profile
       (id, "accountId", revision, "preferredNameCiphertext", "preferredNameKeyVersion", "profileSchemaVersion",
        "updatedAt", "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
       VALUES ('${id(23)}','${id(22)}',1,decode('01','hex'),NULL,'profile-v1',now(),'synthetic-v1',now(),now()+interval '30 days')`,
    ],
    reject: /key_pair_ck|23514/u,
  },
  {
    id: "SQL-004",
    positive: [
      accountInsert(id(30)),
      `INSERT INTO ${schema}.app_necessary_consent_record
       (id,"accountId","noticeVersion","logicalIntent",status,"commandRef","acceptedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(31)}','${id(30)}','notice-v1','ONBOARDING','ACCEPTED','${id(32)}',now(),'synthetic-v1',now(),now()+interval '30 days')`,
    ],
    negative: [
      accountInsert(id(33)),
      `INSERT INTO ${schema}.app_necessary_consent_record
       (id,"accountId","noticeVersion","logicalIntent",status,"commandRef","acceptedAt","withdrawnAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(34)}','${id(33)}','notice-v1','ONBOARDING','WITHDRAWN','${id(35)}',now(),now()-interval '1 day','synthetic-v1',now(),now()+interval '30 days')`,
    ],
    reject: /necessary_consent_state_ck|23514/u,
  },
  {
    id: "SQL-005",
    positive: [
      accountInsert(id(40)),
      generationIntentInsert(id(41), id(40)),
      `INSERT INTO ${schema}.runtime_gateway_invocation
       (id,workload,"generationIntentId","planFingerprint","promptPackageVersion","schemaVersion","templateVersion",
        "safetyBundleVersion","routeManifestVersion","routeFingerprint","publishGuardSnapshot","deadlineAt",
        "retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(42)}','DAILY','${id(41)}',decode('01','hex'),'p','s','t','safe','route',decode('02','hex'),'{}',now()+interval '1 hour','synthetic-v1',now(),now()+interval '1 day')`,
    ],
    negative: [
      `INSERT INTO ${schema}.runtime_gateway_invocation
       (id,workload,"planFingerprint","promptPackageVersion","schemaVersion","templateVersion","safetyBundleVersion",
        "routeManifestVersion","routeFingerprint","publishGuardSnapshot","deadlineAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(43)}','DAILY',decode('01','hex'),'p','s','t','safe','route',decode('02','hex'),'{}',now()+interval '1 hour','synthetic-v1',now(),now()+interval '1 day')`,
    ],
    reject: /invocation_parent_ck|23514/u,
  },
  {
    id: "SQL-006",
    positive: [
      accountInsert(id(50)),
      generationIntentInsert(id(51), id(50), "SUCCEEDED", `'${id(52)}'`),
    ],
    negative: [
      accountInsert(id(53)),
      generationIntentInsert(id(54), id(53), "SUCCEEDED"),
    ],
    reject: /generation_intent_publication_ck|23514/u,
  },
  (() => {
    const good = dailyPublicationFixture(60);
    const bad = dailyPublicationFixture(70, { secondAccount: true });
    return {
      id: "SQL-007",
      positive: [
        ...good.statements,
        resultInsert(good.result, good.account, good.intent, good.snapshot),
      ],
      negative: [
        ...bad.statements,
        resultInsert(bad.result, bad.other, bad.intent, bad.snapshot),
      ],
      reject: /SQL-007|23514/u,
    };
  })(),
  {
    id: "SQL-008",
    positive: [
      `INSERT INTO ${schema}.system_version_catalog_entry
       (id,"catalogType",version,"compatibilityPayload",fingerprint,state)
       VALUES ('${id(80)}','TEST','v-positive','{}',decode('01','hex'),'ACTIVE')`,
    ],
    negative: [
      `INSERT INTO ${schema}.system_version_catalog_entry
       (id,"catalogType",version,"compatibilityPayload",fingerprint,state)
       VALUES ('${id(81)}','TEST','v-negative','{}',decode('01','hex'),'ACTIVE')`,
      `UPDATE ${schema}.system_version_catalog_entry SET state='RETIRED' WHERE id='${id(81)}'`,
    ],
    reject: /SQL-008|55000/u,
  },
  {
    id: "SQL-009",
    positive: [
      accountInsert(id(90)),
      `INSERT INTO ${schema}.app_relationship_cycle
       (id,"accountId",state,"activeSlot",revision,"startedAt","sourceCutoffEpoch","projectionFingerprint","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(91)}','${id(90)}','ACTIVE',true,1,now(),0,decode('01','hex'),'synthetic-v1',now(),now()+interval '30 days')`,
    ],
    negative: [
      accountInsert(id(92)),
      `INSERT INTO ${schema}.app_relationship_cycle
       (id,"accountId",state,"activeSlot",revision,"startedAt","sourceCutoffEpoch","projectionFingerprint","closedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(93)}','${id(92)}','CLOSED_BY_DELETION',true,1,now(),0,decode('01','hex'),now(),'synthetic-v1',now(),now()+interval '30 days')`,
    ],
    reject: /relationship_cycle_active_slot_ck|23514/u,
  },
  {
    id: "SQL-010",
    positive: [
      accountInsert(id(100)),
      dataTaskInsert(id(101), id(100), { activeSlot: "true", state: "FAILED" }),
    ],
    negative: [
      accountInsert(id(102)),
      dataTaskInsert(id(103), id(102), { activeSlot: "NULL", state: "FAILED" }),
    ],
    reject: /data_task_active_slot_ck|23514/u,
  },
  {
    id: "SQL-011",
    positive: [
      accountInsert(id(110)),
      dataTaskInsert(id(111), id(110), {
        activeSlot: "NULL",
        state: "SUCCEEDED",
        guardedAt: "now()",
        startedAt: "now()+interval '1 second'",
        onlineErasedAt: "now()+interval '2 seconds'",
        finishedAt: "now()+interval '3 seconds'",
        backupPurgeDeadline: "now()+interval '30 days'",
      }),
    ],
    negative: [
      accountInsert(id(112)),
      dataTaskInsert(id(113), id(112), {
        activeSlot: "NULL",
        state: "SUCCEEDED",
        guardedAt: "now()",
        startedAt: "now()+interval '1 second'",
        finishedAt: "now()+interval '3 seconds'",
        backupPurgeDeadline: "now()+interval '30 days'",
      }),
    ],
    reject: /data_task_timeline_ck|23514/u,
  },
  (() => {
    const good = weeklyFixture(120);
    const bad = weeklyFixture(130);
    return {
      id: "SQL-012",
      positive: [
        ...good.statements,
        `UPDATE ${schema}.app_weekly_window SET "currentSummaryRef"='${good.summary}', "currentSourceFingerprint"=decode('21','hex') WHERE id='${good.window}'`,
      ],
      negative: [
        ...bad.statements,
        `UPDATE ${schema}.app_weekly_window SET "currentSummaryRef"='${bad.summary}', "currentSourceFingerprint"=decode('22','hex') WHERE id='${bad.window}'`,
      ],
      reject: /SQL-012|23514/u,
    };
  })(),
  (() => {
    const good = weeklyFixture(140);
    const bad = weeklyFixture(150);
    return {
      id: "SQL-013",
      positive: [
        ...good.statements,
        `UPDATE ${schema}.app_weekly_window SET "currentSummaryRef"='${good.summary}', "currentSourceFingerprint"=decode('21','hex') WHERE id='${good.window}'`,
        `INSERT INTO ${schema}.app_weekly_content_slot
        (id,"summaryId","segmentPath","fallbackPayload","fallbackFingerprint","retentionPolicyVersion","retentionAnchorAt","expiresAt")
        VALUES ('${id(144)}','${good.summary}','summary','{}',decode('01','hex'),'synthetic-v1',now(),now()+interval '7 days')`,
      ],
      negative: [
        ...bad.statements,
        `UPDATE ${schema}.app_weekly_window SET "currentSummaryRef"='${bad.summary}', "currentSourceFingerprint"=decode('21','hex') WHERE id='${bad.window}'`,
        `INSERT INTO ${schema}.app_weekly_content_slot
        (id,"summaryId","segmentPath","retentionPolicyVersion","retentionAnchorAt","expiresAt")
        VALUES ('${id(154)}','${bad.summary}','summary','synthetic-v1',now(),now()+interval '7 days')`,
      ],
      reject: /SQL-013|23514/u,
    };
  })(),
  {
    id: "SQL-014",
    positive: [
      accountInsert(id(160)),
      `INSERT INTO ${schema}.restricted_safety_state
       (id,"accountId",state,revision,"guardEpoch","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(161)}','${id(160)}','ACTIVE',2,3,now(),'synthetic-v1',now(),now()+interval '30 days')`,
      `INSERT INTO ${schema}.restricted_safety_event
       (id,"accountId","stateRevision","guardEpoch","surfaceCode","decisionLevel","policyVersion","ruleVersion","responseVersion","resourceRegistryVersion","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(162)}','${id(160)}',2,3,'DAILY','HIGH_RISK','p','r','response','resources','synthetic-v1',now(),now()+interval '30 days')`,
      `UPDATE ${schema}.restricted_safety_state SET revision=3,"guardEpoch"=4 WHERE id='${id(161)}'`,
    ],
    negative: [
      accountInsert(id(163)),
      `INSERT INTO ${schema}.restricted_safety_state
       (id,"accountId",state,revision,"guardEpoch","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(164)}','${id(163)}','ACTIVE',2,3,now(),'synthetic-v1',now(),now()+interval '30 days')`,
      `UPDATE ${schema}.restricted_safety_state SET revision=1 WHERE id='${id(164)}'`,
    ],
    reject: /SQL-014|23514/u,
  },
  {
    id: "SQL-015",
    positive: [
      accountInsert(id(170)),
      `INSERT INTO ${schema}.app_notification_intent
       (id,"accountId","notificationType","semanticKey","plannedWindow","ruleVersion",state,"dispatchClaimToken","scheduledAt","terminalAt","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(171)}','${id(170)}','DAILY',decode('01','hex'),'MORNING','rule-v1','SENT','${id(172)}',now(),now(),now(),'synthetic-v1',now(),now()+interval '7 days')`,
    ],
    negative: [
      accountInsert(id(173)),
      `INSERT INTO ${schema}.app_notification_intent
       (id,"accountId","notificationType","semanticKey","plannedWindow","ruleVersion",state,"scheduledAt","terminalAt","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(174)}','${id(173)}','DAILY',decode('01','hex'),'MORNING','rule-v1','SENT',now(),now(),now(),'synthetic-v1',now(),now()+interval '7 days')`,
    ],
    reject: /notification_intent_claim_ck|23514/u,
  },
  {
    id: "SQL-016",
    positive: [
      `INSERT INTO ${schema}.system_provider_data_handling_profile
       (id,"profileVersion","providerCode","regionCode",subprocessors,"trainingEnabled","onlineRetentionDays","backupRetentionDays","deletionCapabilities","contractEvidenceRef","disclosureVersion",fingerprint,state)
       VALUES ('${id(180)}','p1','provider','CN','[]',false,30,30,ARRAY['DELETE'],'contract','disclosure',decode('01','hex'),'ACTIVE')`,
    ],
    negative: [
      `INSERT INTO ${schema}.system_provider_data_handling_profile
       (id,"profileVersion","providerCode","regionCode",subprocessors,"trainingEnabled","onlineRetentionDays","backupRetentionDays","deletionCapabilities","contractEvidenceRef","disclosureVersion",fingerprint,state)
       VALUES ('${id(181)}','p2','provider','CN','[]',true,31,30,ARRAY['DELETE'],'contract','disclosure',decode('01','hex'),'ACTIVE')`,
    ],
    reject: /provider_active_profile_ck|23514/u,
  },
  {
    id: "SQL-017",
    positive: [
      `INSERT INTO ${schema}.system_backup_catalog_entry
       (id,"generationCode","createdAt","expiresAt","encryptionKeyVersion","coveredDataDomains",state)
       VALUES ('${id(190)}','backup-positive',now(),now()+interval '35 days','key-v1',ARRAY['all'],'AVAILABLE')`,
      `INSERT INTO ${schema}.restricted_day_erasure_guard
       (id,"ownerScopeToken","productDate","deletionEpoch","deletionTaskRef","expiresAt")
       VALUES ('${id(191)}',decode('01','hex'),DATE '2026-07-30',1,'${id(192)}',now()+interval '45 days')`,
    ],
    negative: [
      `INSERT INTO ${schema}.system_backup_catalog_entry
       (id,"generationCode","createdAt","expiresAt","encryptionKeyVersion","coveredDataDomains",state)
       VALUES ('${id(193)}','backup-negative',now(),now()+interval '36 days','key-v1',ARRAY['all'],'AVAILABLE')`,
    ],
    reject: /system_backup_max_35_days_ck|23514/u,
  },
  {
    id: "SQL-018",
    positive: [
      `INSERT INTO ${schema}.restricted_legal_hold
       (id,"holdRef","scopeCode","legalBasisRef","approvalRef","startedAt","reviewDueAt","endsAt",state,"retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(200)}','${id(201)}','ACCOUNT','legal','approval',now(),now()+interval '90 days',now()+interval '100 days','ACTIVE','synthetic-v1',now(),now()+interval '103 days')`,
    ],
    negative: [
      `INSERT INTO ${schema}.restricted_legal_hold
       (id,"holdRef","scopeCode","legalBasisRef","approvalRef","startedAt","reviewDueAt","endsAt",state,"retentionPolicyVersion","retentionAnchorAt","expiresAt")
       VALUES ('${id(202)}','${id(203)}','ACCOUNT','legal','approval',now(),now()+interval '91 days',now()+interval '100 days','ACTIVE','synthetic-v1',now(),now()+interval '104 days')`,
    ],
    reject: /legal_hold_timeline_ck|23514/u,
  },
  {
    id: "SQL-019",
    positive: [
      `INSERT INTO ${schema}.restricted_deletion_receipt
       (id,"caseRef","taskRef",kind,scope,"targetType","confirmationVersion","policyVersion","requestedAt","guardedAt","onlineErasedAt","finishedAt","backupPurgeDeadline","providerExpiryDeadlines",outcome,"expiresAt")
       VALUES ('${id(210)}','${id(211)}','${id(212)}','DELETE','ACCOUNT','ACCOUNT','confirm','policy',now(),now(),now(),now(),now()+interval '30 days','{}','SUCCEEDED',now()+interval '1 year')`,
    ],
    negative: [
      `INSERT INTO ${schema}.restricted_deletion_receipt
       (id,"caseRef","blindedSubjectToken","taskRef",kind,scope,"targetType","confirmationVersion","policyVersion","requestedAt","guardedAt","onlineErasedAt","finishedAt","backupPurgeDeadline","providerExpiryDeadlines",outcome,"expiresAt")
       VALUES ('${id(213)}','${id(214)}',decode('01','hex'),'${id(215)}','DELETE','ACCOUNT','ACCOUNT','confirm','policy',now(),now(),now(),now(),now()+interval '30 days','{}','SUCCEEDED',now()+interval '1 year')`,
    ],
    reject: /account_receipt_deidentified_ck|23514/u,
  },
];

async function proveRoleMatrix(admin, adminUrl, Client) {
  const profiles = Object.values(TEST_DATABASE_PROFILES);
  const roles = profiles.map((profile) => profile.groupRole);

  const attributes = await admin.query(
    `
    SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolinherit
    FROM pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname`,
    [roles],
  );
  assert.equal(attributes.rowCount, roles.length);
  for (const row of attributes.rows) {
    assert.equal(row.rolsuper, false, `${row.rolname} must not be superuser`);
    assert.equal(
      row.rolcreatedb,
      false,
      `${row.rolname} must not create databases`,
    );
    assert.equal(
      row.rolcreaterole,
      false,
      `${row.rolname} must not create roles`,
    );
    assert.equal(
      row.rolinherit,
      false,
      `${row.rolname} must not inherit privileges`,
    );
  }

  const owners = await admin.query(`
    SELECT n.nspowner::regrole::text AS schema_owner,
           array_agg(DISTINCT c.relowner::regrole::text) AS table_owners
    FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid
    WHERE n.nspname='daily_energy' AND c.relkind IN ('r','p') GROUP BY n.nspowner`);
  assert.equal(owners.rows[0].schema_owner, "daily_energy_owner");
  assert.deepEqual(owners.rows[0].table_owners, ["daily_energy_owner"]);

  for (const profile of profiles) {
    const url = new URL(adminUrl);
    url.username = profile.loginRole;
    url.password = profile.password;
    const login = new Client({ connectionString: url.toString() });
    await login.connect();
    try {
      const identity = await login.query(`
        SELECT current_user, session_user,
               ARRAY(
                 SELECT role_name
                 FROM unnest(ARRAY[
                   'daily_energy_api', 'daily_energy_interactive', 'daily_energy_background',
                   'daily_energy_restricted', 'daily_energy_safety', 'daily_energy_deletion',
                   'daily_energy_migration', 'daily_energy_test'
                 ]) AS role_name
                 WHERE pg_has_role(session_user, role_name, 'MEMBER')
                 ORDER BY role_name
               ) AS memberships,
               pg_has_role(session_user, 'daily_energy_owner', 'MEMBER') AS owner_member
      `);
      assert.deepEqual(identity.rows[0], {
        current_user: profile.loginRole,
        session_user: profile.loginRole,
        memberships: [profile.groupRole],
        owner_member: profile.groupRole === "daily_energy_migration",
      });
    } finally {
      await login.end();
    }
  }

  async function asRole(
    profile,
    query,
    rejection = /permission denied|must be owner|42501/u,
  ) {
    const url = new URL(adminUrl);
    url.username = profile.loginRole;
    url.password = profile.password;
    const client = new Client({ connectionString: url.toString() });
    await client.connect();
    try {
      await assert.rejects(
        client.query(query),
        rejection,
        `${profile.groupRole}: ${query}`,
      );
    } finally {
      await client.end();
    }
  }

  for (const profile of profiles) {
    await asRole(profile, `CREATE ROLE forbidden_by_${profile.groupRole}`);
    await asRole(profile, `CREATE DATABASE forbidden_by_${profile.groupRole}`);
    await asRole(
      profile,
      `ALTER TABLE ${schema}.app_morning_checkin OWNER TO ${profile.groupRole}`,
    );
    if (profile.groupRole !== "daily_energy_migration") {
      await asRole(
        profile,
        `CREATE TABLE ${schema}.forbidden_by_${profile.groupRole}(id int)`,
      );
    }
  }

  for (const profile of profiles) {
    if (profile.groupRole !== "daily_energy_migration") {
      await asRole(profile, `TRUNCATE ${schema}.app_morning_checkin`);
    }
  }

  const migrationUrl = new URL(adminUrl);
  migrationUrl.username = TEST_DATABASE_PROFILES.migration.loginRole;
  migrationUrl.password = TEST_DATABASE_PROFILES.migration.password;
  const migration = new Client({ connectionString: migrationUrl.toString() });
  await migration.connect();
  try {
    await migration.query("SET ROLE daily_energy_owner");
    await migration.query(
      `ALTER TABLE ${schema}.app_user_account ADD CONSTRAINT migration_owner_probe_ck CHECK (revision >= 1)`,
    );
    await migration.query(
      `ALTER TABLE ${schema}.app_user_account DROP CONSTRAINT migration_owner_probe_ck`,
    );
  } finally {
    await migration.end();
  }

  for (const profile of profiles) {
    if (
      [
        "daily_energy_api",
        "daily_energy_interactive",
        "daily_energy_background",
      ].includes(profile.groupRole)
    ) {
      await asRole(
        profile,
        `SELECT * FROM ${schema}.restricted_safety_state LIMIT 1`,
      );
    }
  }
  await asRole(
    TEST_DATABASE_PROFILES.api,
    `SELECT * FROM ${schema}.app_user_profile LIMIT 1`,
  );

  const apiUrl = new URL(adminUrl);
  apiUrl.username = TEST_DATABASE_PROFILES.api.loginRole;
  apiUrl.password = TEST_DATABASE_PROFILES.api.password;
  const api = new Client({ connectionString: apiUrl.toString() });
  await api.connect();
  try {
    await api.query(`SELECT * FROM ${schema}.app_morning_checkin LIMIT 1`);
  } finally {
    await api.end();
  }

  // Legacy restricted role: empty shell, should not have access to anything useful
  const restrictedUrl = new URL(adminUrl);
  restrictedUrl.username = TEST_DATABASE_PROFILES.restricted.loginRole;
  restrictedUrl.password = TEST_DATABASE_PROFILES.restricted.password;
  const restricted = new Client({ connectionString: restrictedUrl.toString() });
  await restricted.connect();
  try {
    await assert.rejects(
      restricted.query(
        `SELECT * FROM ${schema}.restricted_safety_state LIMIT 1`,
      ),
      /permission denied/u,
      "legacy restricted role must not have SELECT on safety tables",
    );
  } finally {
    await restricted.end();
  }

  // Safety role: can write Safety-owned facts, but cannot delete Safety state,
  // touch ordinary user facts, or access evaluation data.
  const safetyUrl = new URL(adminUrl);
  safetyUrl.username = TEST_DATABASE_PROFILES.safety.loginRole;
  safetyUrl.password = TEST_DATABASE_PROFILES.safety.password;
  const safety = new Client({ connectionString: safetyUrl.toString() });
  await safety.connect();
  try {
    await safety.query(
      `SELECT * FROM ${schema}.restricted_safety_state LIMIT 1`,
    );
    await safety.query(`SELECT * FROM ${schema}.app_user_account LIMIT 1`);
    await safety.query("BEGIN");
    try {
      await safety.query(
        `INSERT INTO ${schema}.runtime_outbox_event
          (id,"aggregateType","aggregateRef","aggregateRevision","eventType","eventVersion",
           "idempotencyKey","allowlistedPayload","guardEpochs","availableAt",
           "retentionPolicyVersion","retentionAnchorAt","expiresAt")
         VALUES ('${id(710)}','SafetyState','${id(711)}',1,'SafetyActivated','v1',
           decode('7100','hex'),'{}','{"safety":1}',now(),'synthetic-v1',now(),now()+interval '7 days')`,
      );
    } finally {
      await safety.query("ROLLBACK");
    }
    await assert.rejects(
      safety.query(`DELETE FROM ${schema}.app_morning_checkin`),
      /permission denied/u,
      "safety role must not delete ordinary user facts",
    );
    await assert.rejects(
      safety.query(`DELETE FROM ${schema}.restricted_safety_state`),
      /permission denied/u,
      "safety role must not delete Safety state",
    );
    await assert.rejects(
      safety.query(`SELECT * FROM ${schema}.evaluation_run LIMIT 1`),
      /permission denied/u,
      "safety role must not access evaluation tables",
    );
  } finally {
    await safety.end();
  }

  // Deletion role: full DML on deletion tables, read-only on safety tables, no eval access
  const deletionUrl = new URL(adminUrl);
  deletionUrl.username = TEST_DATABASE_PROFILES.deletion.loginRole;
  deletionUrl.password = TEST_DATABASE_PROFILES.deletion.password;
  const deletion = new Client({ connectionString: deletionUrl.toString() });
  await deletion.connect();
  try {
    // Can read safety
    await deletion.query(
      `SELECT * FROM ${schema}.restricted_safety_state LIMIT 1`,
    );
    // Can SELECT + DELETE app tables
    await deletion.query(`SELECT * FROM ${schema}.app_morning_checkin LIMIT 1`);
    // Cannot write safety
    await assert.rejects(
      deletion.query(
        `INSERT INTO ${schema}.restricted_safety_state (id,"accountId",revision,"guardEpoch","updatedAt") VALUES ('10000000-0000-4000-8000-000000000998','10000000-0000-4000-8000-000000000001',1,1,now())`,
      ),
      /permission denied/u,
      "deletion role must not INSERT on safety state",
    );
    // Cannot access evaluation
    await assert.rejects(
      deletion.query(`SELECT * FROM ${schema}.evaluation_run LIMIT 1`),
      /permission denied/u,
      "deletion role must not access evaluation tables",
    );
    // Can atomically write TX-09 deletion facts and its outbox event.
    await admin.query(accountInsert(id(700)));
    await deletion.query("BEGIN");
    try {
      await deletion.query(
        dataTaskInsert(id(997), id(700), {
          activeSlot: "true",
          state: "FAILED",
        }),
      );
      await deletion.query(
        `INSERT INTO ${schema}.runtime_outbox_event
          (id,"aggregateType","aggregateRef","aggregateRevision","eventType","eventVersion",
           "idempotencyKey","allowlistedPayload","guardEpochs","availableAt",
           "retentionPolicyVersion","retentionAnchorAt","expiresAt")
         VALUES ('${id(712)}','DataTask','${id(997)}',1,'DeletionGuarded','v1',
           decode('7120','hex'),'{}','{"deletion":1}',now(),'synthetic-v1',now(),now()+interval '7 days')`,
      );
    } finally {
      await deletion.query("ROLLBACK");
    }
    // ACCOUNT deletion finishes by removing the now child-free UserAccount.
    await deletion.query(
      `DELETE FROM ${schema}.app_user_account WHERE id='${id(700)}'`,
    );
  } finally {
    await deletion.end();
  }

  const interactiveUrl = new URL(adminUrl);
  interactiveUrl.username = TEST_DATABASE_PROFILES.interactive.loginRole;
  interactiveUrl.password = TEST_DATABASE_PROFILES.interactive.password;
  const interactive = new Client({
    connectionString: interactiveUrl.toString(),
  });
  await interactive.connect();
  try {
    await interactive.query(`SELECT * FROM ${schema}.app_user_profile LIMIT 1`);
  } finally {
    await interactive.end();
  }

  const testUrl = new URL(adminUrl);
  testUrl.username = TEST_DATABASE_PROFILES.test.loginRole;
  testUrl.password = TEST_DATABASE_PROFILES.test.password;
  const synthetic = new Client({ connectionString: testUrl.toString() });
  await synthetic.connect();
  try {
    await synthetic.query(`SELECT * FROM ${schema}.app_user_profile LIMIT 1`);
  } finally {
    await synthetic.end();
  }
}

test(
  `${metadata.test_id} PostgreSQL 18 SQL-001..SQL-020 and role/grant evidence`,
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
      const loginUrls = await bootstrapTestDatabase(adminUrl);
      const migrationEnvironment = {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      };
      const adminEnvironment = {
        DATABASE_URL: adminUrl,
        PRISMA_BIN: prismaBin,
      };
      await runNode("tooling/database/migrate.mjs", migrationEnvironment);
      await runNode("tooling/database/seed.mjs", adminEnvironment);
      await runNode("tooling/database/check-drift.mjs", adminEnvironment);

      const { Client } = loadPg();
      const admin = new Client({ connectionString: adminUrl });
      await admin.connect();
      try {
        const version = await admin.query("SHOW server_version");
        assert.match(version.rows[0].server_version, /^18\./u);

        for (const item of evidence) {
          await t.test(`${item.id} accepts valid synthetic data`, async () => {
            await transaction(admin, item.positive);
          });
          await t.test(
            `${item.id} rejects invalid synthetic data`,
            async () => {
              await transaction(admin, item.negative, { reject: item.reject });
            },
          );
        }

        await t.test(
          "SQL-013 rejects deleting the only daily personalized fragment",
          async () => {
            const fixture = dailyFragmentFixture(240);
            await transaction(
              admin,
              [
                ...fixture.statements,
                `DELETE FROM ${schema}.app_personalized_content_fragment WHERE id='${fixture.fragment}'`,
              ],
              { reject: /SQL-013|23514/u },
            );
          },
        );

        await t.test(
          "SQL-013 accepts daily fragment deletion with BLOCKED visibility in the same transaction",
          async () => {
            const fixture = dailyFragmentFixture(250);
            await transaction(admin, [
              ...fixture.statements,
              `DELETE FROM ${schema}.app_personalized_content_fragment WHERE id='${fixture.fragment}'`,
              `UPDATE ${schema}.app_published_result_visibility SET state='BLOCKED',revision=2,"blockedReasonCode"='SOURCE_DELETED',"updatedAt"=now() WHERE id='${fixture.visibility}'`,
            ]);
          },
        );

        await t.test(
          "SQL-013 rejects deleting the only weekly personalized fragment",
          async () => {
            const fixture = weeklyFragmentFixture(260);
            await transaction(
              admin,
              [
                ...fixture.statements,
                `DELETE FROM ${schema}.app_weekly_personalized_content_fragment WHERE id='${fixture.fragment}'`,
              ],
              { reject: /SQL-013|23514/u },
            );
          },
        );

        await t.test(
          "SQL-013 accepts weekly fragment deletion when the summary is unpublished in the same transaction",
          async () => {
            const fixture = weeklyFragmentFixture(270);
            await transaction(admin, [
              ...fixture.statements,
              `DELETE FROM ${schema}.app_weekly_personalized_content_fragment WHERE id='${fixture.fragment}'`,
              `UPDATE ${schema}.app_weekly_window SET "currentSummaryRef"=NULL,"currentSourceFingerprint"=NULL,revision=2,"updatedAt"=now() WHERE id='${fixture.window}'`,
            ]);
          },
        );

        await t.test(
          "SQL-013 rejects activating daily visibility when a slot has no fragment or fallback",
          async () => {
            const fixture = dailyFragmentFixture(280);
            // Start with BLOCKED visibility and an empty slot (no fragment)
            const statements = [
              accountInsert(fixture.account),
              generationIntentInsert(fixture.intent, fixture.account),
              checkinInsert(fixture.checkin, fixture.account),
              checkinRevisionInsert(fixture.checkin),
              snapshotInsert(fixture.snapshot, fixture.intent, fixture.checkin),
              resultInsert(
                fixture.result,
                fixture.account,
                fixture.intent,
                fixture.snapshot,
              ),
              `INSERT INTO ${schema}.app_published_result_visibility
                (id,"resultId",state,revision,"sourceFingerprint","blockedReasonCode","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
               VALUES ('${fixture.visibility}','${fixture.result}','BLOCKED',1,decode('31','hex'),'SOURCE_DELETED',now(),'synthetic-v1',now(),now()+interval '7 days')`,
              `INSERT INTO ${schema}.app_result_content_slot
                (id,"resultId","segmentPath","retentionPolicyVersion","retentionAnchorAt","expiresAt")
               VALUES ('${fixture.slot}','${fixture.result}','core','synthetic-v1',now(),now()+interval '7 days')`,
              // Activate visibility — should fail because slot has no fragment or fallback
              `UPDATE ${schema}.app_published_result_visibility SET state='AVAILABLE',revision=2,"blockedReasonCode"=NULL,"updatedAt"=now() WHERE id='${fixture.visibility}'`,
            ];
            await transaction(admin, statements, { reject: /SQL-013|23514/u });
          },
        );

        await t.test(
          "SQL-013 accepts activating daily visibility when every slot has a fragment or fallback",
          async () => {
            const fixture = dailyFragmentFixture(290);
            // Start with BLOCKED visibility, slot has fragment
            const statements = [
              ...fixture.statements.filter(
                (s) => !s.includes("app_published_result_visibility"),
              ),
              `INSERT INTO ${schema}.app_published_result_visibility
                (id,"resultId",state,revision,"sourceFingerprint","blockedReasonCode","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
               VALUES ('${fixture.visibility}','${fixture.result}','BLOCKED',1,decode('31','hex'),'SOURCE_DELETED',now(),'synthetic-v1',now(),now()+interval '7 days')`,
              `UPDATE ${schema}.app_published_result_visibility SET state='AVAILABLE',revision=2,"blockedReasonCode"=NULL,"updatedAt"=now() WHERE id='${fixture.visibility}'`,
            ];
            await transaction(admin, statements);
          },
        );

        await t.test(
          "SQL-013 rejects setting weekly currentSummaryRef when a current slot has no fragment or fallback",
          async () => {
            const publication = weeklyFixture(300);
            const slot = id(304);
            // Insert empty slot first (summary is not current), then set current — should fail
            const statements = [
              ...publication.statements,
              `INSERT INTO ${schema}.app_weekly_content_slot
                (id,"summaryId","segmentPath","retentionPolicyVersion","retentionAnchorAt","expiresAt")
               VALUES ('${slot}','${publication.summary}','summary','synthetic-v1',now(),now()+interval '7 days')`,
              `UPDATE ${schema}.app_weekly_window SET "currentSummaryRef"='${publication.summary}',"currentSourceFingerprint"=decode('21','hex'),revision=2,"updatedAt"=now() WHERE id='${publication.window}'`,
            ];
            await transaction(admin, statements, { reject: /SQL-013|23514/u });
          },
        );

        await t.test(
          "SQL-013 rejects rebinding AVAILABLE visibility to an incomplete result",
          async () => {
            const blocked = dailyFragmentFixture(330);
            const available = dailyFragmentFixture(340);
            await admin.query("BEGIN");
            try {
              for (const statement of [
                accountInsert(blocked.account),
                generationIntentInsert(blocked.intent, blocked.account),
                checkinInsert(blocked.checkin, blocked.account),
                checkinRevisionInsert(blocked.checkin),
                snapshotInsert(
                  blocked.snapshot,
                  blocked.intent,
                  blocked.checkin,
                ),
                resultInsert(
                  blocked.result,
                  blocked.account,
                  blocked.intent,
                  blocked.snapshot,
                ),
                `INSERT INTO ${schema}.app_published_result_visibility
                  (id,"resultId",state,revision,"sourceFingerprint","blockedReasonCode","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
                 VALUES ('${blocked.visibility}','${blocked.result}','BLOCKED',1,decode('31','hex'),'SOURCE_DELETED',now(),'synthetic-v1',now(),now()+interval '7 days')`,
                `INSERT INTO ${schema}.app_result_content_slot
                  (id,"resultId","segmentPath","retentionPolicyVersion","retentionAnchorAt","expiresAt")
                 VALUES ('${blocked.slot}','${blocked.result}','core','synthetic-v1',now(),now()+interval '7 days')`,
                ...available.statements,
              ]) {
                await admin.query(statement);
              }
              await admin.query("COMMIT");
            } catch (error) {
              await admin.query("ROLLBACK");
              throw error;
            }

            await transaction(
              admin,
              [
                `DELETE FROM ${schema}.app_published_result_visibility WHERE id='${blocked.visibility}'`,
                `UPDATE ${schema}.app_published_result_visibility SET "resultId"='${blocked.result}',revision=2,"updatedAt"=now() WHERE id='${available.visibility}'`,
              ],
              { reject: /SQL-013|23514/u },
            );
          },
        );

        await t.test(
          "SQL-013 rejects deleting BLOCKED visibility that protects an incomplete result",
          async () => {
            const blocked = blockedDailyVisibilityFixture(400);
            await commitStatements(admin, blocked.statements);
            await transaction(
              admin,
              [
                `DELETE FROM ${schema}.app_published_result_visibility WHERE id='${blocked.visibility}'`,
              ],
              { reject: /SQL-013|23514/u },
            );
          },
        );

        await t.test(
          "SQL-013 rejects rebinding BLOCKED visibility away from an incomplete result",
          async () => {
            const blocked = blockedDailyVisibilityFixture(420);
            const replacement = dailyPublicationFixture(430);
            await commitStatements(admin, [
              ...blocked.statements,
              ...replacement.statements,
              resultInsert(
                replacement.result,
                replacement.account,
                replacement.intent,
                replacement.snapshot,
              ),
            ]);
            await transaction(
              admin,
              [
                `UPDATE ${schema}.app_published_result_visibility SET "resultId"='${replacement.result}',revision=2,"updatedAt"=now() WHERE id='${blocked.visibility}'`,
              ],
              { reject: /SQL-013|23514/u },
            );
          },
        );

        await t.test(
          "SQL-013 allows deleting BLOCKED visibility after its protected slots are removed",
          async () => {
            const blocked = blockedDailyVisibilityFixture(450);
            await commitStatements(admin, blocked.statements);
            await transaction(admin, [
              `DELETE FROM ${schema}.app_result_content_slot WHERE id='${blocked.slot}'`,
              `DELETE FROM ${schema}.app_published_result_visibility WHERE id='${blocked.visibility}'`,
            ]);
          },
        );

        await t.test(
          "SQL-007 rejects TX-02 snapshot with cross-account checkin before publication",
          async () => {
            const accountA = id(310);
            const accountB = id(311);
            const intent = id(312);
            const checkinB = id(313);
            const snapshot = id(314);
            const statements = [
              accountInsert(accountA),
              accountInsert(accountB),
              generationIntentInsert(intent, accountA),
              checkinInsert(checkinB, accountB),
              checkinRevisionInsert(checkinB),
              snapshotInsert(snapshot, intent, checkinB),
            ];
            await transaction(admin, statements, { reject: /SQL-007|23514/u });
          },
        );

        await t.test(
          "SQL-007 rejects TX-02 snapshot referencing a wrong-date checkin before publication",
          async () => {
            const account = id(320);
            const intent = id(321);
            const checkin = id(322);
            const snapshot = id(323);
            const statements = [
              accountInsert(account),
              generationIntentInsert(intent, account),
              // Checkin on a different date than the intent
              `INSERT INTO ${schema}.app_morning_checkin
                (id, "accountId", "productDate", "productDatePolicyVersion", revision, mood, energy, sleep,
                 "firstSubmittedAt", "updatedAt", "sourceCommandRef", "retentionPolicyVersion", "retentionAnchorAt", "expiresAt")
               VALUES ('${checkin}', '${account}', DATE '2026-07-29', 'product-date-v1', 1,
                 'STEADY', 'STEADY', 'OKAY', now(), now(), '${id(900)}', 'synthetic-v1', now(), now() + interval '7 days')`,
              checkinRevisionInsert(checkin),
              snapshotInsert(snapshot, intent, checkin),
            ];
            await transaction(admin, statements, { reject: /SQL-007|23514/u });
          },
        );

        await t.test(
          "SQL-007 runtime API role commits valid snapshot and rejects revision mismatch",
          async () => {
            const { Client } = loadPg();
            const api = new Client({ connectionString: loginUrls.api });
            await api.connect();
            try {
              await transaction(api, [
                accountInsert(id(360)),
                generationIntentInsert(id(361), id(360)),
                checkinInsert(id(362), id(360)),
                checkinRevisionInsert(id(362)),
                snapshotInsert(id(363), id(361), id(362)),
              ]);
              await transaction(
                api,
                [
                  accountInsert(id(364)),
                  generationIntentInsert(id(365), id(364)),
                  checkinInsert(id(366), id(364)),
                  checkinRevisionInsert(id(366)),
                  snapshotInsert(id(367), id(365), id(366), 2),
                ],
                { reject: /SQL-007|23514/u },
              );
            } finally {
              await api.end();
            }
          },
        );

        await t.test(
          "S19-DB-011 preserves a frozen snapshot after check-in correction and accepts a new weekly fingerprint",
          async () => {
            const account = id(500);
            const intent = id(501);
            const checkin = id(502);
            const snapshot = id(503);
            const result = id(504);
            const window = id(505);
            const sourceRevisionOne = id(506);
            const sourceRevisionTwo = id(507);

            await commitStatements(admin, [
              accountInsert(account),
              generationIntentInsert(intent, account),
              checkinInsert(checkin, account),
              checkinRevisionInsert(checkin),
              snapshotInsert(snapshot, intent, checkin),
              `INSERT INTO ${schema}.app_weekly_window
                (id,"accountId","endProductDate","windowRuleVersion","currentSourceFingerprint",revision,"updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
               VALUES ('${window}','${account}',DATE '2026-07-30','window-v1',decode('41','hex'),1,now(),'synthetic-v1',now(),now()+interval '7 days')`,
              `INSERT INTO ${schema}.app_weekly_source_snapshot
                (id,"windowId","sourceFingerprint","sourceSlotsPayload","aggregateFactsPayload","expressionPlanPayload","aggregateVersion","retentionPolicyVersion","retentionAnchorAt","expiresAt")
               VALUES ('${sourceRevisionOne}','${window}',decode('41','hex'),'{"checkinRevision":1}','{}','{}','aggregate-v1','synthetic-v1',now(),now()+interval '7 days')`,
            ]);

            await admin.query("BEGIN");
            try {
              for (const statement of [
                `UPDATE ${schema}.app_morning_checkin SET revision=2,mood='GOOD',energy='HIGH',sleep='GOOD',"updatedAt"=now() WHERE id='${checkin}'`,
                checkinRevisionInsert(checkin, 2, "GOOD", "HIGH", "GOOD"),
                resultInsert(result, account, intent, snapshot),
                `INSERT INTO ${schema}.app_weekly_source_snapshot
                  (id,"windowId","sourceFingerprint","sourceSlotsPayload","aggregateFactsPayload","expressionPlanPayload","aggregateVersion","retentionPolicyVersion","retentionAnchorAt","expiresAt")
                 VALUES ('${sourceRevisionTwo}','${window}',decode('42','hex'),'{"checkinRevision":2}','{}','{}','aggregate-v1','synthetic-v1',now(),now()+interval '7 days')`,
                `UPDATE ${schema}.app_weekly_window SET "currentSourceFingerprint"=decode('42','hex'),revision=2,"updatedAt"=now() WHERE id='${window}'`,
              ]) {
                await admin.query(statement);
              }
              await admin.query("SET CONSTRAINTS ALL IMMEDIATE");
              const state = await admin.query(
                `SELECT snapshot."checkinRevision" AS "snapshotRevision",
                        checkin.revision AS "currentRevision",
                        encode(weekly_window."currentSourceFingerprint", 'hex') AS "weeklyFingerprint",
                        (SELECT count(*)::int FROM ${schema}.app_weekly_source_snapshot WHERE "windowId"=$3) AS "weeklySnapshotCount"
                   FROM ${schema}.app_generation_input_snapshot snapshot
                   JOIN ${schema}.app_morning_checkin checkin ON checkin.id=snapshot."checkinId"
                   JOIN ${schema}.app_weekly_window weekly_window ON weekly_window."accountId"=$1
                  WHERE snapshot.id=$2`,
                [account, snapshot, window],
              );
              assert.deepEqual(state.rows[0], {
                currentRevision: 2,
                snapshotRevision: 1,
                weeklyFingerprint: "42",
                weeklySnapshotCount: 2,
              });
            } finally {
              await admin.query("ROLLBACK");
            }
          },
        );

        await t.test(
          "SQL-015 rejects terminal-to-scheduled regression",
          async () => {
            await transaction(
              admin,
              [
                accountInsert(id(220)),
                `INSERT INTO ${schema}.app_notification_intent
             (id,"accountId","notificationType","semanticKey","plannedWindow","ruleVersion",state,"scheduledAt","terminalAt","updatedAt","retentionPolicyVersion","retentionAnchorAt","expiresAt")
             VALUES ('${id(221)}','${id(220)}','DAILY',decode('01','hex'),'MORNING','rule-v1','CANCELLED',now(),now(),now(),'synthetic-v1',now(),now()+interval '7 days')`,
                `UPDATE ${schema}.app_notification_intent SET state='SCHEDULED' WHERE id='${id(221)}'`,
              ],
              { reject: /SQL-015|23514/u },
            );
          },
        );

        await t.test(
          "SQL-017 rejects a day-erasure guard over 45 days",
          async () => {
            await transaction(
              admin,
              [
                `INSERT INTO ${schema}.restricted_day_erasure_guard
             (id,"ownerScopeToken","productDate","deletionEpoch","deletionTaskRef","createdAt","expiresAt")
             VALUES ('${id(230)}',decode('01','hex'),DATE '2026-07-30',1,'${id(231)}',now(),now()+interval '46 days')`,
              ],
              { reject: /restricted_day_guard_max_45_days_ck|23514/u },
            );
          },
        );

        await t.test(
          "SQL-020 enforces role matrix and real factory startup rejects direct grants and extra membership",
          async () => {
            await proveRoleMatrix(admin, adminUrl, Client);
            await runFactoryRoleProbe(loginUrls);

            await admin.query(
              `GRANT SELECT ("guardEpoch") ON ${schema}.restricted_safety_state TO ${TEST_DATABASE_PROFILES.api.loginRole}`,
            );
            try {
              await runFactoryRoleProbe(loginUrls, {
                expected: "mismatch",
                profile: "api",
              });
            } finally {
              await admin.query(
                `REVOKE SELECT ("guardEpoch") ON ${schema}.restricted_safety_state FROM ${TEST_DATABASE_PROFILES.api.loginRole}`,
              );
            }

            await admin.query(
              `GRANT SELECT ON ${schema}.app_morning_checkin TO ${TEST_DATABASE_PROFILES.api.loginRole} WITH GRANT OPTION`,
            );
            try {
              await runFactoryRoleProbe(loginUrls, {
                expected: "mismatch",
                profile: "api",
              });
            } finally {
              await admin.query(
                `REVOKE SELECT ON ${schema}.app_morning_checkin FROM ${TEST_DATABASE_PROFILES.api.loginRole}`,
              );
            }

            await assertFactoryProbeRejectsSqlMutation(
              admin,
              loginUrls,
              "api",
              [
                `GRANT MAINTAIN ON ${schema}.app_morning_checkin TO ${TEST_DATABASE_PROFILES.api.loginRole}`,
              ],
              [
                `REVOKE MAINTAIN ON ${schema}.app_morning_checkin FROM ${TEST_DATABASE_PROFILES.api.loginRole}`,
              ],
            );

            await assertFactoryProbeRejectsSqlMutation(
              admin,
              loginUrls,
              "api",
              [
                `GRANT MAINTAIN ON ${schema}.app_morning_checkin TO ${TEST_DATABASE_PROFILES.api.groupRole}`,
                `GRANT MAINTAIN ON ${schema}.app_morning_checkin TO ${TEST_DATABASE_PROFILES.api.loginRole} WITH GRANT OPTION`,
              ],
              [
                `REVOKE MAINTAIN ON ${schema}.app_morning_checkin FROM ${TEST_DATABASE_PROFILES.api.loginRole}`,
                `REVOKE MAINTAIN ON ${schema}.app_morning_checkin FROM ${TEST_DATABASE_PROFILES.api.groupRole}`,
              ],
            );

            await assertFactoryProbeRejectsSqlMutation(
              admin,
              loginUrls,
              "api",
              [
                `GRANT USAGE ON SCHEMA ${schema} TO ${TEST_DATABASE_PROFILES.api.loginRole} WITH GRANT OPTION`,
              ],
              [
                `REVOKE USAGE ON SCHEMA ${schema} FROM ${TEST_DATABASE_PROFILES.api.loginRole}`,
              ],
            );

            await assertFactoryProbeRejectsSqlMutation(
              admin,
              loginUrls,
              "api",
              [
                `GRANT EXECUTE ON FUNCTION ${schema}.assert_generation_snapshot_lineage(uuid) TO ${TEST_DATABASE_PROFILES.api.loginRole} WITH GRANT OPTION`,
              ],
              [
                `REVOKE EXECUTE ON FUNCTION ${schema}.assert_generation_snapshot_lineage(uuid) FROM ${TEST_DATABASE_PROFILES.api.loginRole}`,
              ],
            );

            const databaseName = (
              await admin.query("SELECT current_database() AS name")
            ).rows[0].name;
            assert.match(databaseName, /^[a-zA-Z0-9_]+$/u);
            await assertFactoryProbeRejectsSqlMutation(
              admin,
              loginUrls,
              "api",
              [
                `GRANT CONNECT ON DATABASE "${databaseName}" TO ${TEST_DATABASE_PROFILES.api.loginRole} WITH GRANT OPTION`,
              ],
              [
                `REVOKE CONNECT ON DATABASE "${databaseName}" FROM ${TEST_DATABASE_PROFILES.api.loginRole}`,
              ],
            );

            await assertFactoryProbeRejectsSqlMutation(
              admin,
              loginUrls,
              "api",
              [
                `CREATE SEQUENCE ${schema}.factory_role_probe_sequence`,
                `GRANT USAGE ON SEQUENCE ${schema}.factory_role_probe_sequence TO ${TEST_DATABASE_PROFILES.api.loginRole} WITH GRANT OPTION`,
              ],
              [
                `REVOKE USAGE ON SEQUENCE ${schema}.factory_role_probe_sequence FROM ${TEST_DATABASE_PROFILES.api.loginRole}`,
                `DROP SEQUENCE ${schema}.factory_role_probe_sequence`,
              ],
            );

            await admin.query(
              `GRANT daily_energy_safety TO ${TEST_DATABASE_PROFILES.safety.loginRole} WITH ADMIN OPTION`,
            );
            try {
              await runFactoryRoleProbe(loginUrls, {
                expected: "mismatch",
                profile: "safety",
              });
            } finally {
              await admin.query(
                `REVOKE ADMIN OPTION FOR daily_energy_safety FROM ${TEST_DATABASE_PROFILES.safety.loginRole}`,
              );
            }

            await assertFactoryProbeRejectsSqlMutation(
              admin,
              loginUrls,
              "safety",
              [
                `GRANT daily_energy_safety TO ${TEST_DATABASE_PROFILES.safety.loginRole} WITH INHERIT FALSE`,
              ],
              [
                `GRANT daily_energy_safety TO ${TEST_DATABASE_PROFILES.safety.loginRole} WITH INHERIT TRUE`,
              ],
            );

            await assertFactoryProbeRejectsSqlMutation(
              admin,
              loginUrls,
              "safety",
              [
                `GRANT daily_energy_safety TO ${TEST_DATABASE_PROFILES.safety.loginRole} WITH SET FALSE`,
              ],
              [
                `GRANT daily_energy_safety TO ${TEST_DATABASE_PROFILES.safety.loginRole} WITH SET TRUE`,
              ],
            );

            await admin.query(
              `ALTER ROLE ${TEST_DATABASE_PROFILES.background.loginRole} REPLICATION`,
            );
            try {
              await runFactoryRoleProbe(loginUrls, {
                expected: "mismatch",
                profile: "background",
              });
            } finally {
              await admin.query(
                `ALTER ROLE ${TEST_DATABASE_PROFILES.background.loginRole} NOREPLICATION`,
              );
            }

            await admin.query(
              "CREATE ROLE daily_energy_factory_probe_rogue NOLOGIN",
            );
            try {
              await admin.query(
                `GRANT daily_energy_factory_probe_rogue TO ${TEST_DATABASE_PROFILES.safety.loginRole}`,
              );
              await runFactoryRoleProbe(loginUrls, {
                expected: "mismatch",
                profile: "safety",
              });
            } finally {
              await admin.query(
                `REVOKE daily_energy_factory_probe_rogue FROM ${TEST_DATABASE_PROFILES.safety.loginRole}`,
              );
              await admin.query("DROP ROLE daily_energy_factory_probe_rogue");
            }
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

test(
  "T-DB-LIFECYCLE-001 checksum/idempotence/upgrade/rollback/restore hooks",
  {
    skip: integrationEnabled
      ? false
      : "set DATABASE_INTEGRATION=1 to run the real PostgreSQL 18 harness",
  },
  async (t) => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const adminUrl = container.getConnectionUri();
    const adminEnvironment = { DATABASE_URL: adminUrl, PRISMA_BIN: prismaBin };
    const temporary = await mkdtemp(
      path.join(os.tmpdir(), "daily-energy-e006-"),
    );
    try {
      await t.test("actual migrate checksum gate fails closed", async () => {
        const manifest = path.join(temporary, "checksums-mutated.json");
        const source = path.join(
          repositoryRoot,
          "prisma/migrations/checksums.json",
        );
        await copyFile(source, manifest);
        const value = JSON.parse(
          await (await import("node:fs/promises")).readFile(manifest, "utf8"),
        );
        value.migrations[0].sha256 = "0".repeat(64);
        await writeFile(manifest, `${JSON.stringify(value, null, 2)}\n`);
        const result = await runNodeResult("tooling/database/migrate.mjs", {
          ...adminEnvironment,
          DB_MIGRATION_CHECKSUM_MANIFEST: manifest,
        });
        assert.notEqual(result.code, 0);
        assert.match(result.stderr, /DB_MIGRATION_CHECKSUM_MISMATCH/u);
        const { Client } = loadPg();
        const client = new Client({ connectionString: adminUrl });
        await client.connect();
        try {
          const schemaExists = await client.query(
            "SELECT to_regnamespace('daily_energy') IS NOT NULL AS present",
          );
          assert.equal(schemaExists.rows[0].present, false);
        } finally {
          await client.end();
        }
      });

      const loginUrls = await bootstrapTestDatabase(adminUrl);
      const migrationEnvironment = {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      };
      await t.test(
        "N-1 role set requires privileged bootstrap before the security migration",
        async () => {
          const { Client } = loadPg();
          const administrator = new Client({ connectionString: adminUrl });
          await administrator.connect();
          try {
            await administrator.query(
              "DROP ROLE daily_energy_safety, daily_energy_deletion",
            );
          } finally {
            await administrator.end();
          }

          const rejected = await runNodeResult(
            "tooling/database/migrate.mjs",
            migrationEnvironment,
          );
          assert.notEqual(rejected.code, 0);
          assert.match(
            rejected.stderr,
            /DB_MIGRATION_ROLE_BOOTSTRAP_REQUIRED/u,
          );

          await runNode("tooling/database/bootstrap.mjs", {
            DATABASE_ADMIN_URL: adminUrl,
          });
          const repair = new Client({ connectionString: adminUrl });
          await repair.connect();
          try {
            await repair.query(
              `GRANT daily_energy_safety TO ${TEST_DATABASE_PROFILES.safety.loginRole}`,
            );
            await repair.query(
              `GRANT daily_energy_deletion TO ${TEST_DATABASE_PROFILES.deletion.loginRole}`,
            );
          } finally {
            await repair.end();
          }
        },
      );
      await t.test(
        "migration runner rejects administrator and non-migration profile credentials",
        async () => {
          for (const databaseUrl of [adminUrl, loginUrls.api]) {
            const result = await runNodeResult("tooling/database/migrate.mjs", {
              DATABASE_URL: databaseUrl,
              PRISMA_BIN: prismaBin,
            });
            assert.notEqual(result.code, 0);
            assert.match(result.stderr, /DB_MIGRATION_ROLE_MISMATCH/u);
          }
        },
      );
      await t.test(
        "real migration login times out on locked DDL and then rolls forward",
        async () => {
          const initialConfig = await createInitialMigrationProject(temporary);
          const migrationUrl = new URL(loginUrls.migration);
          migrationUrl.searchParams.set("schema", schema);
          migrationUrl.searchParams.set(
            "options",
            "-c lock_timeout=5s -c statement_timeout=5min -c role=daily_energy_owner",
          );
          const initial = await runCommandResult(
            prismaBin,
            ["migrate", "deploy", "--config", initialConfig],
            {
              DATABASE_URL: migrationUrl.toString(),
              PGOPTIONS:
                "-c lock_timeout=5s -c statement_timeout=5min -c role=daily_energy_owner",
            },
          );
          assert.equal(initial.code, 0, initial.stderr);

          const { Client } = loadPg();
          const locker = new Client({ connectionString: adminUrl });
          await locker.connect();
          let lockedMigration;
          const startedAt = Date.now();
          try {
            await locker.query("BEGIN");
            await locker.query(
              `LOCK TABLE ${schema}.app_user_account IN ACCESS EXCLUSIVE MODE`,
            );
            lockedMigration = await runNodeResult(
              "tooling/database/migrate.mjs",
              migrationEnvironment,
            );
          } finally {
            await locker.query("ROLLBACK");
            await locker.end();
          }
          const elapsedMillis = Date.now() - startedAt;
          assert.notEqual(lockedMigration.code, 0);
          assert.match(lockedMigration.stderr, /DB_MIGRATION_DEPLOY_FAILED/u);
          assert.doesNotMatch(
            lockedMigration.stderr,
            /synthetic-migration|daily_energy_migration_test_login/u,
          );
          assert.ok(elapsedMillis >= 4_000, `elapsed=${elapsedMillis}`);
          assert.ok(elapsedMillis < 15_000, `elapsed=${elapsedMillis}`);

          const cleanup = new Client({ connectionString: adminUrl });
          await cleanup.connect();
          try {
            await cleanup.query(
              `DELETE FROM ${schema}._prisma_migrations
                WHERE migration_name='20260731000000_owner_upgrade_probe'
                  AND finished_at IS NULL`,
            );
          } finally {
            await cleanup.end();
          }
          await runNode("tooling/database/migrate.mjs", migrationEnvironment);

          const verify = new Client({ connectionString: adminUrl });
          await verify.connect();
          try {
            const upgraded = await verify.query(
              `SELECT pg_get_constraintdef(oid, true) AS definition,
                      conrelid::regclass::text AS relation
                 FROM pg_constraint
                WHERE conname='app_user_account_revision_positive_ck'`,
            );
            assert.equal(upgraded.rowCount, 1);
            assert.match(upgraded.rows[0].definition, /revision.*>= 1/u);
            assert.match(upgraded.rows[0].relation, /app_user_account/u);
          } finally {
            await verify.end();
          }
        },
      );
      await runNode("tooling/database/migrate.mjs", migrationEnvironment);
      await runNode("tooling/database/seed.mjs", adminEnvironment);
      await runNode("tooling/database/check-drift.mjs", adminEnvironment);

      await t.test(
        "semantic catalog drift rejects changed constraint, index, function, and grant",
        async (driftTest) => {
          const { Client } = loadPg();
          const client = new Client({ connectionString: adminUrl });
          await client.connect();
          await client.query("SET ROLE daily_energy_owner");

          async function expectFingerprintFailure(section, mutate, restore) {
            try {
              await client.query(mutate);
              const result = await runNodeResult(
                "tooling/database/check-drift.mjs",
                adminEnvironment,
              );
              assert.notEqual(result.code, 0);
              assert.match(
                result.stderr,
                new RegExp(`DB_DRIFT_FINGERPRINT:${section}`, "u"),
              );
            } finally {
              await client.query(restore);
            }
            await runNode("tooling/database/check-drift.mjs", adminEnvironment);
          }

          try {
            await driftTest.test("constraint definition", async () => {
              await expectFingerprintFailure(
                "constraints",
                `ALTER TABLE ${schema}.app_user_account
                   DROP CONSTRAINT app_user_account_revision_positive_ck,
                   ADD CONSTRAINT app_user_account_revision_positive_ck CHECK (revision >= 0)`,
                `ALTER TABLE ${schema}.app_user_account
                   DROP CONSTRAINT app_user_account_revision_positive_ck,
                   ADD CONSTRAINT app_user_account_revision_positive_ck CHECK (revision >= 1)`,
              );
            });
            await driftTest.test("index definition", async () => {
              await expectFingerprintFailure(
                "indexes",
                `DROP INDEX ${schema}."app_morning_checkin_accountId_productDate_idx";
                 CREATE INDEX "app_morning_checkin_accountId_productDate_idx"
                   ON ${schema}.app_morning_checkin("accountId", "productDate" ASC)`,
                `DROP INDEX ${schema}."app_morning_checkin_accountId_productDate_idx";
                 CREATE INDEX "app_morning_checkin_accountId_productDate_idx"
                   ON ${schema}.app_morning_checkin("accountId", "productDate" DESC)`,
              );
            });
            await driftTest.test("function definition", async () => {
              const originalFunction = await client.query(
                `SELECT pg_get_functiondef('${schema}.raise_integrity(text)'::regprocedure) AS definition`,
              );
              await expectFingerprintFailure(
                "functions",
                `CREATE OR REPLACE FUNCTION ${schema}.raise_integrity(code text)
                   RETURNS void LANGUAGE plpgsql AS $$
                   BEGIN
                     RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DRIFTED';
                   END
                   $$`,
                originalFunction.rows[0].definition,
              );
            });
            await driftTest.test("table grant", async () => {
              await expectFingerprintFailure(
                "relationAcl",
                `GRANT REFERENCES ON ${schema}.app_morning_checkin TO daily_energy_api`,
                `REVOKE REFERENCES ON ${schema}.app_morning_checkin FROM daily_energy_api`,
              );
            });
            await driftTest.test("column grant", async () => {
              await expectFingerprintFailure(
                "columnAcl",
                `GRANT SELECT ("guardEpoch") ON ${schema}.restricted_safety_state TO daily_energy_api`,
                `REVOKE SELECT ("guardEpoch") ON ${schema}.restricted_safety_state FROM daily_energy_api`,
              );
            });
          } finally {
            await client.query("RESET ROLE");
            await client.end();
          }
        },
      );

      await t.test("repeated migration and seed are exact no-ops", async () => {
        await runNode("tooling/database/migrate.mjs", migrationEnvironment);
        await runNode("tooling/database/seed.mjs", adminEnvironment);
        const { Client } = loadPg();
        const client = new Client({ connectionString: adminUrl });
        await client.connect();
        try {
          const migrations = await client.query(
            `SELECT count(*)::int AS count FROM ${schema}._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
          );
          const versions = await client.query(
            `SELECT count(*)::int AS count FROM ${schema}.system_version_catalog_entry WHERE "catalogType"='PRODUCT_DATE_POLICY' AND version='product-date-v1'`,
          );
          const retention = await client.query(
            `SELECT count(*)::int AS count FROM ${schema}.system_retention_policy_entry WHERE "policyVersion"='retention-policy-v1' AND "dataTypeCode"='SYNTHETIC_RUNTIME'`,
          );
          assert.equal(migrations.rows[0].count, 4);
          assert.equal(versions.rows[0].count, 1);
          assert.equal(retention.rows[0].count, 1);
        } finally {
          await client.end();
        }
      });

      await t.test("seed key conflict rolls back all seed writes", async () => {
        const conflictSeed = path.join(temporary, "seed-conflict.json");
        const seed = JSON.parse(
          await (
            await import("node:fs/promises")
          ).readFile(
            path.join(repositoryRoot, "prisma/seed/synthetic-v1.json"),
            "utf8",
          ),
        );
        seed.records.version_catalog.unshift({
          catalog_type: "SYNTHETIC_ROLLBACK_PROBE",
          version: "probe-v1",
          compatibility: { probe: true },
          fingerprint_hex: "1".repeat(64),
        });
        seed.records.retention_policy[0].purpose_code = "CONFLICTING_PURPOSE";
        await writeFile(conflictSeed, `${JSON.stringify(seed, null, 2)}\n`);
        const result = await runNodeResult("tooling/database/seed.mjs", {
          ...adminEnvironment,
          DB_SEED_FILE: conflictSeed,
        });
        assert.notEqual(result.code, 0);
        assert.match(result.stderr, /DB_SYNTHETIC_SEED_CONFLICT/u);
        const { Client } = loadPg();
        const client = new Client({ connectionString: adminUrl });
        await client.connect();
        try {
          const probe = await client.query(
            `SELECT count(*)::int AS count FROM ${schema}.system_version_catalog_entry WHERE "catalogType"='SYNTHETIC_ROLLBACK_PROBE'`,
          );
          assert.equal(probe.rows[0].count, 0);
        } finally {
          await client.end();
        }
      });

      await t.test(
        "additive migration history supports code rollback and roll-forward",
        async () => {
          const { Client } = loadPg();
          const client = new Client({ connectionString: adminUrl });
          await client.connect();
          try {
            await client.query(
              `INSERT INTO ${schema}.system_version_catalog_entry
              (id,"catalogType",version,"compatibilityPayload",fingerprint,state,"createdAt")
             VALUES (gen_random_uuid(),'SYNTHETIC_RELEASE','old-code-v1','{}',decode('22','hex'),'ACTIVE',now())`,
            );
          } finally {
            await client.end();
          }
          await runNode("tooling/database/migrate.mjs", migrationEnvironment);
          await runNode("tooling/database/check-drift.mjs", adminEnvironment);
          const verify = new Client({ connectionString: adminUrl });
          await verify.connect();
          try {
            const oldCodeFact = await verify.query(
              `SELECT count(*)::int AS count FROM ${schema}.system_version_catalog_entry WHERE "catalogType"='SYNTHETIC_RELEASE' AND version='old-code-v1'`,
            );
            const history = await verify.query(
              `SELECT migration_name FROM ${schema}._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
            );
            assert.equal(oldCodeFact.rows[0].count, 1);
            assert.deepEqual(
              history.rows.map((row) => row.migration_name),
              [
                "20260730000000_initial_application_schema",
                "20260731000000_owner_upgrade_probe",
                "20260731000001_security_fixes_sql007_sql013_roles",
                "20260802000000_e007_queue_inbox_permissions",
              ],
            );
          } finally {
            await verify.end();
          }
        },
      );

      await t.test(
        "restore ledger must precede detector and readiness",
        async () => {
          const passHook = path.join(temporary, "detector-pass.sh");
          const failHook = path.join(temporary, "detector-fail.sh");
          await writeFile(passHook, "#!/bin/sh\nexit 0\n");
          await writeFile(failHook, "#!/bin/sh\nexit 1\n");
          await chmod(passHook, 0o700);
          await chmod(failHook, 0o700);
          const recovery = {
            ...adminEnvironment,
            DB_RECOVERY_STAGE: "isolated",
            DB_RESTORE_LEDGER_CHECKPOINT: "synthetic-checkpoint-20260730",
            DB_RESTORE_LEDGER_FINGERPRINT: "synthetic-ledger-fingerprint",
            DB_DELETED_DATA_DETECTOR_HOOK: passHook,
          };
          let result = await runNodeResult(
            "tooling/database/check-recovery-ready.mjs",
            recovery,
          );
          assert.notEqual(result.code, 0);
          assert.match(result.stderr, /DB_RECOVERY_NOT_READY/u);
          result = await runNodeResult(
            "tooling/database/run-deleted-data-detector.mjs",
            recovery,
          );
          assert.notEqual(result.code, 0);
          assert.match(result.stderr, /DB_RESTORE_LEDGER_NOT_REPLAYED/u);
          await runNode("tooling/database/replay-restore-ledger.mjs", recovery);
          result = await runNodeResult(
            "tooling/database/run-deleted-data-detector.mjs",
            { ...recovery, DB_DELETED_DATA_DETECTOR_HOOK: failHook },
          );
          assert.notEqual(result.code, 0);
          assert.match(result.stderr, /DB_DELETED_DATA_DETECTOR_FAILED/u);
          result = await runNodeResult(
            "tooling/database/check-recovery-ready.mjs",
            recovery,
          );
          assert.notEqual(result.code, 0);
          await runNode(
            "tooling/database/run-deleted-data-detector.mjs",
            recovery,
          );
          await runNode("tooling/database/check-recovery-ready.mjs", recovery);
          result = await runNodeResult(
            "tooling/database/replay-restore-ledger.mjs",
            { ...recovery, DB_RESTORE_LEDGER_FINGERPRINT: "conflict" },
          );
          assert.notEqual(result.code, 0);
          assert.match(result.stderr, /DB_RESTORE_LEDGER_CONFLICT/u);
        },
      );
    } finally {
      await container.stop();
    }
  },
);
