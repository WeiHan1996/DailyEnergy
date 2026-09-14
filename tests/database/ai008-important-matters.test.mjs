#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const baseNow = new Date("2026-09-14T04:00:00.000Z");

function bytes(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

function protectedTitle(label) {
  return {
    ciphertext: Buffer.concat([Buffer.alloc(28, 7), Buffer.from(label)]),
    keyVersion: "synthetic-matter-key-v1",
  };
}

function command(accountId, commandRef, label, productDate, now = baseNow) {
  return {
    accountId,
    commandRef,
    normalizedPayloadFingerprint: bytes(label),
    now,
    productDate,
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

async function createReadyAccount(auth, consent, label, now = baseNow) {
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
    now,
    session: {
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
      issuedAt: now,
      tokenHash: bytes(`${label}:session`),
    },
  });
  assert.equal(established.status, "ACTIVE");
  const accountId = established.session.accountId;
  assert.equal(
    (
      await consent.acceptConsent({
        ...command(
          accountId,
          `${label}-consent-command`,
          `${label}:consent`,
          "2026-09-14",
          now,
        ),
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
          "2026-09-14",
          now,
        ),
        expressionStyle: "BALANCED",
      })
    ).status,
    "ACCEPTED",
  );
  return accountId;
}

test(
  "AI-008 real PostgreSQL Matter encryption, grants, CAS, expiry, Safety and deletion guard",
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
      const admin = await connect(Client, adminUrl, "ai008-admin");
      resources.push(admin);
      const api =
        await import("../../packages/server-adapters/dist/api/index.js");
      const restricted =
        await import("../../packages/server-adapters/dist/api-restricted/index.js");
      const auth = await api.PostgresAuthStore.connect({
        applicationName: "ai008-auth",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const consent = await api.PostgresConsentProfileStore.connect({
        applicationName: "ai008-consent",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const matters = await api.PostgresMatterStore.connect({
        applicationName: "ai008-matters",
        connectionLimit: 8,
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const rights = await api.PostgresDataRightsStore.connect({
        applicationName: "ai008-rights",
        connectionString: loginUrls.api,
        expectedDatabaseRole: "daily_energy_api",
      });
      const safety = await restricted.PostgresEveningSafetyStore.connect({
        applicationName: "ai008-safety",
        connectionString: loginUrls.safety,
        expectedDatabaseRole: "daily_energy_safety",
      });
      resources.push(auth, consent, matters, rights, safety);

      const owner = await createReadyAccount(auth, consent, "ai008-owner");
      const other = await createReadyAccount(auth, consent, "ai008-other");
      const createInput = {
        ...command(
          owner,
          "ai008-create-command-0001",
          "ai008:create:one",
          "2026-09-14",
        ),
        dailyUseGranted: true,
        targetProductDate: "2026-09-20",
        title: protectedTitle("encrypted-title-one"),
        weeklyUseGranted: false,
      };
      const created = await matters.create(createInput);
      assert.equal(created.status, "ACCEPTED");
      assert.equal((await matters.create(createInput)).status, "DUPLICATE");
      assert.equal(
        (
          await matters.create({
            ...createInput,
            normalizedPayloadFingerprint: bytes("ai008:create:changed"),
          })
        ).status,
        "IDEMPOTENCY_CONFLICT",
      );
      assert.equal(created.status === "ACCEPTED" && created.value.revision, 1);
      if (created.status !== "ACCEPTED") {
        throw new Error("AI008_CREATE_FAILED");
      }
      const matterRef = created.value.matterRef;
      assert.equal(
        (
          await matters.get({
            accountId: other,
            matterRef,
            now: baseNow,
            productDate: "2026-09-14",
          })
        ).status,
        "NOT_FOUND",
      );

      const persisted = (
        await admin.query(
          `SELECT "titleCiphertext","titleKeyVersion",revision,
             (SELECT count(*)::int FROM app_memory_purpose_grant grant_row
               WHERE grant_row."accountId"=$1 AND grant_row."sourceRef"=$2
                 AND grant_row."sourceType"='MATTER'
                 AND grant_row.purpose='DAILY_EXPRESSION'
                 AND grant_row.state='ACTIVE') AS daily_grants,
             (SELECT count(*)::int FROM app_memory_purpose_grant grant_row
               WHERE grant_row."accountId"=$1 AND grant_row."sourceRef"=$2
                 AND grant_row."sourceType"='MATTER'
                 AND grant_row.purpose='WEEKLY_SUMMARY'
                 AND grant_row.state='ACTIVE') AS weekly_grants
           FROM app_important_matter WHERE id=$2`,
          [owner, matterRef],
        )
      ).rows[0];
      assert.equal(persisted.titleKeyVersion, "synthetic-matter-key-v1");
      assert.equal(
        persisted.titleCiphertext.equals(createInput.title.ciphertext),
        true,
      );
      assert.deepEqual(
        { daily: persisted.daily_grants, weekly: persisted.weekly_grants },
        { daily: 1, weekly: 0 },
      );

      const contenderInputs = [
        {
          ...command(
            owner,
            "ai008-update-command-a",
            "ai008:update:a",
            "2026-09-14",
          ),
          dailyUseGranted: false,
          clearTargetDate: false,
          expectedRevision: 1,
          matterRef,
          title: protectedTitle("encrypted-title-a"),
        },
        {
          ...command(
            owner,
            "ai008-update-command-b",
            "ai008:update:b",
            "2026-09-14",
          ),
          clearTargetDate: false,
          expectedRevision: 1,
          matterRef,
          title: protectedTitle("encrypted-title-b"),
          weeklyUseGranted: true,
        },
      ];
      const contenders = await Promise.all(
        contenderInputs.map((input) => matters.update(input)),
      );
      assert.deepEqual(contenders.map((result) => result.status).sort(), [
        "ACCEPTED",
        "REVISION_CONFLICT",
      ]);
      const acceptedIndex = contenders.findIndex(
        (result) => result.status === "ACCEPTED",
      );
      const acceptedInput = contenderInputs[acceptedIndex];
      assert.notEqual(acceptedInput, undefined);
      assert.equal((await matters.update(acceptedInput)).status, "DUPLICATE");
      assert.equal(
        (
          await matters.update({
            ...acceptedInput,
            normalizedPayloadFingerprint: bytes("ai008:update:changed"),
          })
        ).status,
        "IDEMPOTENCY_CONFLICT",
      );
      const current = await matters.get({
        accountId: owner,
        matterRef,
        now: baseNow,
        productDate: "2026-09-14",
      });
      assert.equal(current.status, "FOUND");
      if (current.status !== "FOUND") {
        throw new Error("AI008_CURRENT_MISSING");
      }
      assert.equal(current.value.revision, 2);

      const undated = await matters.create({
        ...command(
          owner,
          "ai008-create-undated-0001",
          "ai008:create:undated",
          "2026-09-01",
          new Date("2026-09-01T04:00:00.000Z"),
        ),
        dailyUseGranted: false,
        title: protectedTitle("encrypted-undated"),
        weeklyUseGranted: false,
      });
      assert.equal(undated.status, "ACCEPTED");
      const expiredList = await matters.list({
        accountId: owner,
        now: new Date("2026-09-08T04:00:00.000Z"),
        productDate: "2026-09-08",
      });
      assert.equal(expiredList.status, "FOUND");
      const expired =
        expiredList.status === "FOUND"
          ? expiredList.value.find(
              (matter) =>
                undated.status === "ACCEPTED" &&
                matter.matterRef === undated.value.matterRef,
            )
          : undefined;
      assert.deepEqual(
        { revision: expired?.revision, state: expired?.state },
        { revision: 2, state: "EXPIRED" },
      );

      const datedPast = await matters.create({
        ...command(
          owner,
          "ai008-create-dated-past-0001",
          "ai008:create:dated-past",
          "2026-09-01",
          new Date("2026-09-01T04:00:00.000Z"),
        ),
        dailyUseGranted: false,
        targetProductDate: "2026-09-02",
        title: protectedTitle("encrypted-dated-past"),
        weeklyUseGranted: false,
      });
      assert.equal(datedPast.status, "ACCEPTED");
      if (datedPast.status !== "ACCEPTED") {
        throw new Error("AI008_DATED_CREATE_FAILED");
      }
      await matters.list({
        accountId: owner,
        now: new Date("2026-09-03T04:00:00.000Z"),
        productDate: "2026-09-03",
      });
      assert.equal(
        (
          await matters.transition({
            ...command(
              owner,
              "ai008-invalid-resume-0001",
              "ai008:invalid-resume",
              "2026-09-03",
              new Date("2026-09-03T04:00:01.000Z"),
            ),
            expectedRevision: 2,
            matterRef: datedPast.value.matterRef,
            revokeUseGrants: false,
            transition: "RESUME",
          })
        ).status,
        "STATE_PRECONDITION_FAILED",
      );
      assert.equal(
        Number(
          (
            await admin.query(
              `SELECT count(*) AS count FROM runtime_command_receipt
                WHERE "accountId"=$1 AND "operationCode"='MATTER_RESUME'`,
              [owner],
            )
          ).rows[0].count,
        ),
        0,
      );

      if (undated.status !== "ACCEPTED") {
        throw new Error("AI008_UNDATED_CREATE_FAILED");
      }
      const resumeInput = {
        ...command(
          owner,
          "ai008-resume-undated-0001",
          "ai008:resume:undated",
          "2026-09-08",
          new Date("2026-09-08T04:00:02.000Z"),
        ),
        expectedRevision: 2,
        matterRef: undated.value.matterRef,
        revokeUseGrants: false,
        transition: "RESUME",
      };
      const resumed = await matters.transition(resumeInput);
      assert.equal(resumed.status, "ACCEPTED");
      assert.equal((await matters.transition(resumeInput)).status, "DUPLICATE");
      assert.deepEqual(
        resumed.status === "ACCEPTED"
          ? { revision: resumed.value.revision, state: resumed.value.state }
          : undefined,
        { revision: 3, state: "ACTIVE" },
      );

      const safetyOwner = await createReadyAccount(
        auth,
        consent,
        "ai008-safety-owner",
      );
      const safetyInput = {
        accountId: safetyOwner,
        categoryCodes: ["SELF_HARM_OR_SUICIDE"],
        classifierVersion: "synthetic-classifier-v1",
        commandRef: "ai008-safety-command-0001",
        irreversibleFingerprint: bytes("ai008:safety"),
        now: baseNow,
        policyVersion: "safety-v1",
        ruleVersion: "safety-rules-v1",
        surfaceCode: "MEM-002",
      };
      assert.equal((await safety.activate(safetyInput)).status, "ACCEPTED");
      assert.equal((await safety.activate(safetyInput)).status, "DUPLICATE");
      assert.equal(
        (
          await matters.create({
            ...command(
              safetyOwner,
              "ai008-blocked-create-0001",
              "ai008:blocked",
              "2026-09-14",
            ),
            dailyUseGranted: false,
            title: protectedTitle("never-written"),
            weeklyUseGranted: false,
          })
        ).status,
        "SAFETY_BLOCKED",
      );
      assert.equal(
        Number(
          (
            await admin.query(
              `SELECT count(*) AS count FROM app_important_matter
                WHERE "accountId"=$1`,
              [safetyOwner],
            )
          ).rows[0].count,
        ),
        0,
      );
      assert.equal(
        Number(
          (
            await admin.query(
              `SELECT count(*) AS count FROM restricted_safety_decision
                WHERE "accountId"=$1 AND "surfaceCode"='MEM-002'`,
              [safetyOwner],
            )
          ).rows[0].count,
        ),
        1,
      );

      const deletion = await rights.deleteMatter({
        accountId: owner,
        commandRef: "ai008-delete-command-0001",
        confirmationVersion: "data-rights-matter-v1",
        expectedRevision: current.value.revision,
        fingerprint: bytes("ai008:delete"),
        matterRef,
        now: baseNow,
      });
      assert.equal(deletion.scope, "MATTER");
      assert.equal(
        (
          await matters.get({
            accountId: owner,
            matterRef,
            now: baseNow,
            productDate: "2026-09-14",
          })
        ).status,
        "STATE_PRECONDITION_FAILED",
      );
      const visibleAfterDelete = await matters.list({
        accountId: owner,
        now: baseNow,
        productDate: "2026-09-14",
      });
      assert.equal(visibleAfterDelete.status, "FOUND");
      assert.equal(
        visibleAfterDelete.status === "FOUND" &&
          visibleAfterDelete.value.some(
            (matter) => matter.matterRef === matterRef,
          ),
        false,
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
