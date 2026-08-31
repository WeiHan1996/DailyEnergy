import type { Pool, PoolClient } from "pg";

import type { GenerationGuardSnapshotV1 } from "@daily-energy/server-core/generation";

import { CURRENT_NECESSARY_CONSENT_NOTICE_VERSION } from "../consent-profile/postgres-consent-profile-store.js";

export async function resolveGenerationGuardSnapshot(
  client: Pick<Pool, "query"> | Pick<PoolClient, "query">,
  accountId: string,
  productDate: string,
): Promise<GenerationGuardSnapshotV1> {
  const result = await client.query<{ snapshot: unknown }>(
    `SELECT daily_energy.resolve_generation_guard_snapshot(
       $1::uuid,$2::date,$3::text
     ) AS snapshot`,
    [accountId, productDate, CURRENT_NECESSARY_CONSENT_NOTICE_VERSION],
  );
  return parseGenerationGuardSnapshot(result.rows[0]?.snapshot);
}

export function parseGenerationGuardSnapshot(
  value: unknown,
): GenerationGuardSnapshotV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATION_GUARD_INVALID");
  }
  const row = value as Record<string, unknown>;
  const status = row.status;
  if (
    status !== "ALLOWED" &&
    status !== "ACCOUNT_DELETED" &&
    status !== "ACCOUNT_DELETING" &&
    status !== "ACCOUNT_RESTRICTED" &&
    status !== "CONSENT_REQUIRED" &&
    status !== "ONBOARDING_REQUIRED" &&
    status !== "SAFETY_BLOCKED" &&
    status !== "STATE_PRECONDITION_FAILED"
  ) {
    throw new Error("GENERATION_GUARD_INVALID");
  }
  return Object.freeze({
    accountRevision: positiveOrZero(row.account_revision),
    deletionEpoch: bigintOrZero(row.deletion_epoch),
    deletionRevision: positiveOrZero(row.deletion_revision),
    safetyEpoch: bigintOrZero(row.safety_epoch),
    safetyRevision: positiveOrZero(row.safety_revision),
    status,
  });
}

export function sameGenerationGuardSnapshot(
  left: GenerationGuardSnapshotV1,
  right: GenerationGuardSnapshotV1,
): boolean {
  return (
    left.status === right.status &&
    left.accountRevision === right.accountRevision &&
    left.safetyRevision === right.safetyRevision &&
    left.safetyEpoch === right.safetyEpoch &&
    left.deletionRevision === right.deletionRevision &&
    left.deletionEpoch === right.deletionEpoch
  );
}

function positiveOrZero(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("GENERATION_GUARD_INVALID");
  }
  return value;
}

function bigintOrZero(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error("GENERATION_GUARD_INVALID");
  }
  return BigInt(value);
}
