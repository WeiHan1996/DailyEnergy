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

const enabled = process.env.DATABASE_INTEGRATION === "1";
const prismaBin = path.resolve("node_modules/.bin/prisma");
const productDate = "2026-09-18";
const now = new Date("2026-09-18T05:00:00Z");
const bytes = (value) => createHash("sha256").update(value).digest();

function command(accountId, ref) {
  return {
    accountId,
    commandRef: ref,
    normalizedPayloadFingerprint: bytes(ref),
    now,
    productDate,
  };
}

async function createAccount(auth, consent, label) {
  const session = await auth.establishSession({
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
    now,
    session: {
      expiresAt: new Date(now.getTime() + 30 * 86_400_000),
      issuedAt: now,
      tokenHash: bytes(`${label}:session`),
    },
  });
  assert.equal(session.status, "ACTIVE");
  const accountId = session.session.accountId;
  assert.equal(
    (
      await consent.acceptConsent({
        ...command(accountId, `${label}-consent`),
        noticeVersion: "necessary-consent-v1",
      })
    ).status,
    "ACCEPTED",
  );
  assert.equal(
    (
      await consent.completeOnboarding({
        ...command(accountId, `${label}-onboarding`),
        expressionStyle: "BALANCED",
      })
    ).status,
    "ACCEPTED",
  );
  return accountId;
}

async function createPublishedResult(admin, accountId) {
  const checkinId = randomUUID();
  const intentId = randomUUID();
  const snapshotId = randomUUID();
  const resultId = randomUUID();
  await admin.query("BEGIN");
  try {
    await admin.query(
      `INSERT INTO app_morning_checkin
        (id,"accountId","productDate","productDatePolicyVersion",revision,
         mood,energy,sleep,"firstSubmittedAt","updatedAt","sourceCommandRef",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES ($1,$2,$3::date,'product-date-v1',1,'STEADY','STEADY','OKAY',
         $4,$4,$5,'retention-policy-v1','DAY',$4)`,
      [checkinId, accountId, productDate, now, randomUUID()],
    );
    await admin.query(
      `INSERT INTO app_morning_checkin_revision
        (id,"checkinId",revision,mood,energy,sleep,"commandRef",
         "retentionPolicyVersion","retentionScope","retentionAnchorAt")
       VALUES (gen_random_uuid(),$1,1,'STEADY','STEADY','OKAY',$2,
         'retention-policy-v1','DAY',$3)`,
      [checkinId, randomUUID(), now],
    );
    await admin.query(
      `INSERT INTO app_generation_intent
        (id,"accountId","targetProductDate","productDatePolicyVersion",
         "acceptedAt",revision,state,"resultVersion","manifestRef",
         "manifestFingerprint","inputSnapshotFingerprint","rootSeedMaterialRef",
         "completionGrantVersion","createdAt","updatedAt","retentionPolicyVersion",
         "retentionScope","retentionAnchorAt")
       VALUES ($1,$2,$3::date,'product-date-v1',$4,1,'RUNNING','daily-v2',
         'manifest-v2',$5,$6,'seed-v1','grant-v1',$4,$4,'retention-policy-v1',
         'DAY',$4)`,
      [
        intentId,
        accountId,
        productDate,
        now,
        bytes("manifest"),
        bytes("input"),
      ],
    );
    await admin.query(
      `INSERT INTO app_generation_input_snapshot
        (id,"generationIntentId","checkinId","checkinRevision","schemaVersion",
         "snapshotPayload","snapshotFingerprint","createdAt","retentionPolicyVersion",
         "retentionScope","retentionAnchorAt")
       VALUES ($1,$2,$3,1,'snapshot-v1','{}',$4,$5,
         'retention-policy-v1','DAY',$5)`,
      [snapshotId, intentId, checkinId, bytes("snapshot"), now],
    );
    await admin.query(
      `INSERT INTO app_published_daily_result
        (id,"accountId","generationIntentId","inputSnapshotId","productDate",
         "resultVersion","schemaVersion","generatedAt","ruleFactsPayload",
         "expressionCorePayload","provenancePayload","validationReceipt",
         "resultFingerprint","retentionPolicyVersion","retentionScope",
         "retentionAnchorAt")
       VALUES ($1,$2,$3,$4,$5::date,'daily-v2','2.0.0',$6,
         '{}','{}','{}','{}',$7,'retention-policy-v1','DAY',$6)`,
      [
        resultId,
        accountId,
        intentId,
        snapshotId,
        productDate,
        now,
        bytes("result"),
      ],
    );
    await admin.query(
      `UPDATE app_generation_intent
       SET state='SUCCEEDED',"publishedResultRef"=$2,revision=2,"updatedAt"=$3
       WHERE id=$1`,
      [intentId, resultId, now],
    );
    await admin.query("COMMIT");
    return resultId;
  } catch (error) {
    await admin.query("ROLLBACK");
    throw error;
  }
}

test(
  "AI-009 PostgreSQL owner-scoped memory selection, revision recheck and worker least privilege",
  { skip: enabled ? false : "requires DATABASE_INTEGRATION=1" },
  async () => {
    const { PostgreSqlContainer } = await loadTestcontainers();
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const resources = [];
    try {
      const loginUrls = await bootstrapTestDatabase(
        container.getConnectionUri(),
      );
      await runNode("tooling/database/migrate.mjs", {
        DATABASE_URL: loginUrls.migration,
        PRISMA_BIN: prismaBin,
      });
      const { Client } = loadPg();
      const interactive = new Client({
        connectionString: loginUrls.interactive,
      });
      await interactive.connect();
      const admin = new Client({
        connectionString: container.getConnectionUri(),
      });
      await admin.connect();
      await admin.query("SET search_path TO daily_energy, pg_catalog");
      resources.push(interactive, admin);

      const api =
        await import("../../packages/server-adapters/dist/api/index.js");
      const workers =
        await import("../../packages/server-adapters/dist/worker-interactive/index.js");
      const restricted =
        await import("../../packages/server-adapters/dist/api-restricted/index.js");
      const auth = await api.PostgresAuthStore.connect({
        applicationName: "ai009-auth",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const consent = await api.PostgresConsentProfileStore.connect({
        applicationName: "ai009-consent",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const matters = await api.PostgresMatterStore.connect({
        applicationName: "ai009-matters",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const memory = await workers.PostgresMemoryStore.connect({
        applicationName: "ai009-memory",
        connectionString: loginUrls.interactive,
        expectedDatabaseRole: "daily_energy_interactive",
      });
      const rights = await api.PostgresDataRightsStore.connect({
        applicationName: "ai009-rights",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const safety = await restricted.PostgresEveningSafetyStore.connect({
        applicationName: "ai009-safety",
        connectionString: loginUrls.safety,
        expectedDatabaseRole: "daily_energy_safety",
      });
      resources.push(auth, consent, matters, memory, rights, safety);

      const owner = await createAccount(auth, consent, "ai009-owner");
      const other = await createAccount(auth, consent, "ai009-other");
      const created = await matters.create({
        ...command(owner, "ai009-create-matter"),
        dailyUseGranted: true,
        targetProductDate: "2026-09-20",
        title: {
          ciphertext: Buffer.concat([
            Buffer.alloc(28, 7),
            Buffer.from("synthetic-private-title"),
          ]),
          keyVersion: "synthetic-matter-key-v1",
        },
        weeklyUseGranted: false,
      });
      assert.equal(created.status, "ACCEPTED");
      if (created.status !== "ACCEPTED") {
        throw new Error("AI009_CREATE_FAILED");
      }
      const sourceRef = created.value.matterRef;
      await assert.rejects(
        admin.query(
          `UPDATE app_important_matter
              SET "memorySafetySourceRevision"=revision+1,
                  "memorySafetyPolicyVersion"='safety-v1',
                  "memorySafetyRuleVersion"='rules-v1',
                  "memorySafetyClassifierVersion"='classifier-v1',
                  "memorySafetyFingerprint"=$2,"memorySafetyClearedAt"=$3
            WHERE id=$1`,
          [sourceRef, bytes("invalid-proof"), now],
        ),
        /app_matter_memory_safety_complete_check/u,
      );
      const query = { ownerRef: owner, productDate };
      assert.equal(
        (await memory.resolveDaily(query)).status,
        "NO_ELIGIBLE_MEMORY",
      );
      assert.equal(
        (await memory.resolveDaily({ ownerRef: other, productDate })).status,
        "NO_ELIGIBLE_MEMORY",
      );

      const preferences = await consent.getMemoryPreferences(owner);
      assert.ok(preferences);
      assert.equal(
        (
          await consent.updateMemoryPreferences({
            ...command(owner, "ai009-enable-memory"),
            expectedRevision: preferences.revision,
            masterEnabled: true,
            dailyUseEnabled: true,
            weeklyUseEnabled: false,
            requiresConsent: true,
          })
        ).status,
        "ACCEPTED",
      );
      assert.equal(
        (await memory.resolveDaily(query)).status,
        "NO_ELIGIBLE_MEMORY",
      );
      const confirmed = await matters.update({
        ...command(owner, "ai009-confirm-current-safety"),
        clearTargetDate: false,
        expectedRevision: created.value.revision,
        matterRef: sourceRef,
        memorySafetyProof: {
          classifierVersion: "synthetic-classifier-v1",
          irreversibleFingerprint: bytes("ai009:source-clear"),
          policyVersion: "safety-v1",
          ruleVersion: "safety-rules-v1",
        },
      });
      assert.equal(confirmed.status, "ACCEPTED");
      const selected = await memory.resolveDaily(query);
      assert.equal(selected.status, "SELECTED");
      if (selected.status !== "SELECTED") {
        throw new Error("AI009_SELECTION_FAILED");
      }
      assert.equal(selected.candidate.sourceRef, sourceRef);
      assert.equal(
        JSON.stringify(selected).includes("synthetic-private-title"),
        false,
      );
      assert.equal(
        await memory.recheckDaily(selected.candidate, productDate),
        true,
      );
      const currentPreference = await consent.getMemoryPreferences(owner);
      assert.ok(currentPreference);
      assert.equal(
        (
          await consent.updateMemoryPreferences({
            ...command(owner, "ai009-disable-memory"),
            expectedRevision: currentPreference.revision,
            masterEnabled: false,
            dailyUseEnabled: true,
            weeklyUseEnabled: false,
            requiresConsent: true,
          })
        ).status,
        "ACCEPTED",
      );
      assert.equal(
        await memory.recheckDaily(selected.candidate, productDate),
        false,
      );
      const disabledPreference = await consent.getMemoryPreferences(owner);
      assert.ok(disabledPreference);
      assert.equal(
        (
          await consent.updateMemoryPreferences({
            ...command(owner, "ai009-reenable-memory"),
            expectedRevision: disabledPreference.revision,
            masterEnabled: true,
            dailyUseEnabled: true,
            weeklyUseEnabled: false,
            requiresConsent: true,
          })
        ).status,
        "ACCEPTED",
      );
      assert.equal(
        await memory.recheckDaily(selected.candidate, productDate),
        false,
      );
      const reenabled = await memory.resolveDaily(query);
      assert.equal(reenabled.status, "SELECTED");
      if (reenabled.status !== "SELECTED") {
        throw new Error("AI009_REENABLE_FAILED");
      }

      await assert.rejects(
        interactive.query(
          'SELECT "titleCiphertext" FROM daily_energy.app_important_matter LIMIT 1',
        ),
        /permission denied/u,
      );
      await assert.rejects(
        interactive.query(
          "DELETE FROM daily_energy.app_important_matter WHERE id=$1",
          [sourceRef],
        ),
        /permission denied/u,
      );
      const revoked = await matters.update({
        ...command(owner, "ai009-revoke-daily"),
        clearTargetDate: false,
        expectedRevision: created.value.revision,
        matterRef: sourceRef,
        dailyUseGranted: false,
      });
      assert.equal(revoked.status, "ACCEPTED");
      assert.equal(
        await memory.recheckDaily(reenabled.candidate, productDate),
        false,
      );
      assert.equal(
        (await memory.resolveDaily(query)).status,
        "NO_ELIGIBLE_MEMORY",
      );
      if (revoked.status !== "ACCEPTED") {
        throw new Error("AI009_REVOKE_FAILED");
      }
      const restored = await matters.update({
        ...command(owner, "ai009-restore-daily"),
        clearTargetDate: false,
        expectedRevision: revoked.value.revision,
        matterRef: sourceRef,
        dailyUseGranted: true,
        memorySafetyProof: {
          classifierVersion: "synthetic-classifier-v1",
          irreversibleFingerprint: bytes("ai009:source-clear-restored"),
          policyVersion: "safety-v1",
          ruleVersion: "safety-rules-v1",
        },
      });
      assert.equal(restored.status, "ACCEPTED");
      const publishable = await memory.resolveDaily(query);
      assert.equal(publishable.status, "SELECTED");
      if (publishable.status !== "SELECTED") {
        throw new Error("AI009_PUBLISHABLE_SELECTION_FAILED");
      }
      const resultId = await createPublishedResult(admin, owner);
      let commitFailureDiagnostic;
      const commitOutcome = await memory.commitDailyUse({
        selected: publishable.candidate,
        productDate,
        resultId,
        protectedStateResponse: {
          ciphertext: Buffer.concat([
            Buffer.alloc(28, 9),
            Buffer.from("synthetic-memory-state-response"),
          ]),
          keyVersion: "synthetic-memory-key-v1",
          fingerprint: bytes("ai009:memory-fragment"),
        },
        fallbackStateResponse: "今天先按自己的节奏，稳稳放下一个清楚的小步骤。",
        now,
        hooks: {
          onFailure: async (diagnostic) => {
            commitFailureDiagnostic = diagnostic;
          },
        },
      });
      assert.equal(
        commitOutcome,
        "COMMITTED",
        `memory publication failed: ${JSON.stringify(commitFailureDiagnostic ?? {})}`,
      );
      assert.equal(
        await memory.commitDailyUse({
          selected: publishable.candidate,
          productDate,
          resultId,
          protectedStateResponse: {
            ciphertext: Buffer.concat([
              Buffer.alloc(28, 9),
              Buffer.from("synthetic-memory-state-response"),
            ]),
            keyVersion: "synthetic-memory-key-v1",
            fingerprint: bytes("ai009:memory-fragment"),
          },
          fallbackStateResponse:
            "今天先按自己的节奏，稳稳放下一个清楚的小步骤。",
          now,
        }),
        "DUPLICATE",
      );
      const attachmentCounts = (
        await admin.query(
          `SELECT
            (SELECT count(*)::int FROM app_result_content_slot
              WHERE "resultId"=$1) AS slots,
            (SELECT count(*)::int FROM app_memory_mention_receipt
              WHERE "resultId"=$1) AS mentions,
            (SELECT count(*)::int FROM app_source_dependency dependency
              JOIN app_personalized_content_fragment fragment
                ON fragment.id=dependency."fragmentId"
              JOIN app_result_content_slot slot ON slot.id=fragment."slotId"
              WHERE slot."resultId"=$1) AS dependencies`,
          [resultId],
        )
      ).rows[0];
      assert.deepEqual(attachmentCounts, {
        dependencies: 1,
        mentions: 1,
        slots: 1,
      });
      await assert.rejects(
        interactive.query(
          'SELECT "payloadCiphertext" FROM daily_energy.app_personalized_content_fragment LIMIT 1',
        ),
        /permission denied/u,
      );
      await assert.rejects(
        interactive.query(
          'DELETE FROM daily_energy.app_source_dependency WHERE "sourceRef"=$1',
          [sourceRef],
        ),
        /permission denied/u,
      );
      assert.equal(
        await memory.isDailyDependencyValid({
          ownerRef: owner,
          productDate,
          resultId,
        }),
        true,
      );
      assert.equal(
        (await memory.resolveDaily(query)).status,
        "NO_ELIGIBLE_MEMORY",
      );
      const otherPreferences = await consent.getMemoryPreferences(other);
      assert.ok(otherPreferences);
      assert.equal(
        (
          await consent.updateMemoryPreferences({
            ...command(other, "ai009-enable-other-memory"),
            expectedRevision: otherPreferences.revision,
            masterEnabled: true,
            dailyUseEnabled: true,
            weeklyUseEnabled: false,
            requiresConsent: true,
          })
        ).status,
        "ACCEPTED",
      );
      const secondMatter = await matters.create({
        ...command(other, "ai009-create-second-matter"),
        dailyUseGranted: true,
        memorySafetyProof: {
          classifierVersion: "synthetic-classifier-v1",
          irreversibleFingerprint: bytes("ai009:second-source-clear"),
          policyVersion: "safety-v1",
          ruleVersion: "safety-rules-v1",
        },
        targetProductDate: "2026-09-21",
        title: {
          ciphertext: Buffer.concat([
            Buffer.alloc(28, 8),
            Buffer.from("synthetic-second-private-title"),
          ]),
          keyVersion: "synthetic-matter-key-v1",
        },
        weeklyUseGranted: false,
      });
      assert.equal(secondMatter.status, "ACCEPTED");
      const secondSelection = await memory.resolveDaily({
        ownerRef: other,
        productDate,
      });
      assert.equal(secondSelection.status, "SELECTED");
      if (secondSelection.status !== "SELECTED") {
        throw new Error("AI009_SECOND_SELECTION_FAILED");
      }
      const failedResultId = await createPublishedResult(admin, other);
      assert.equal(
        await memory.commitDailyUse({
          selected: secondSelection.candidate,
          productDate,
          resultId: failedResultId,
          protectedStateResponse: {
            ciphertext: Buffer.concat([
              Buffer.alloc(28, 6),
              Buffer.from("synthetic-failed-memory-fragment"),
            ]),
            keyVersion: "synthetic-memory-key-v1",
            fingerprint: bytes("ai009:failed-memory-fragment"),
          },
          fallbackStateResponse:
            "今天先按自己的节奏，稳稳放下一个清楚的小步骤。",
          now,
          hooks: {
            beforeCommit: async () => {
              throw new Error("SYNTHETIC_BEFORE_COMMIT_FAILURE");
            },
          },
        }),
        "FALLBACK_REQUIRED",
      );
      const rolledBack = (
        await admin.query(
          `SELECT
            (SELECT count(*)::int FROM app_result_content_slot
              WHERE "resultId"=$1) AS slots,
            (SELECT count(*)::int FROM app_memory_mention_receipt
              WHERE "resultId"=$1) AS mentions`,
          [failedResultId],
        )
      ).rows[0];
      assert.deepEqual(rolledBack, { mentions: 0, slots: 0 });

      assert.equal(
        (
          await safety.activate({
            accountId: owner,
            categoryCodes: ["SELF_HARM_OR_SUICIDE"],
            classifierVersion: "synthetic-classifier-v1",
            commandRef: "ai009-safety-activation",
            irreversibleFingerprint: bytes("ai009:safety"),
            now,
            policyVersion: "safety-v1",
            ruleVersion: "safety-rules-v1",
            surfaceCode: "MEM-002",
          })
        ).status,
        "ACCEPTED",
      );
      assert.equal(
        (await memory.resolveDaily(query)).status,
        "NO_ELIGIBLE_MEMORY",
      );
      assert.equal(
        await memory.isDailyDependencyValid({
          ownerRef: owner,
          productDate,
          resultId,
        }),
        false,
      );
      if (restored.status !== "ACCEPTED") {
        throw new Error("AI009_RESTORE_FAILED");
      }
      const deletion = await rights.deleteMatter({
        accountId: owner,
        commandRef: "ai009-delete-matter",
        confirmationVersion: "data-rights-matter-v1",
        expectedRevision: restored.value.revision,
        fingerprint: bytes("ai009:delete"),
        matterRef: sourceRef,
        now,
      });
      assert.equal(deletion.scope, "MATTER");
      assert.equal(
        (await memory.resolveDaily(query)).status,
        "NO_ELIGIBLE_MEMORY",
      );
      assert.equal(
        await memory.isDailyDependencyValid({
          ownerRef: owner,
          productDate,
          resultId,
        }),
        false,
      );
      await memory.close();
      assert.equal(
        (await memory.resolveDaily(query)).status,
        "NO_ELIGIBLE_MEMORY",
      );
      assert.equal(
        await memory.recheckDaily(selected.candidate, productDate),
        false,
      );
    } finally {
      for (const resource of resources.reverse()) {
        if (typeof resource.close === "function") {
          await resource.close();
        } else {
          await resource.end();
        }
      }
      await container.stop();
    }
  },
);
