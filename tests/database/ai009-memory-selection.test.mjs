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
      resources.push(interactive);

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
      });
      assert.equal(restored.status, "ACCEPTED");
      assert.equal((await memory.resolveDaily(query)).status, "SELECTED");

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
