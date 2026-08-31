import { Pool } from "pg";

import {
  DeterministicGenerationError,
  parseManifestFingerprint,
  type GenerationManifestRecord,
} from "@daily-energy/server-core/generation";
import type { GenerationManifestStore } from "@daily-energy/server-core/generation/spi";

import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";

export interface PostgresGenerationManifestStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface ManifestRow {
  readonly activatedAt: Date;
  readonly compatibilityPayload: unknown;
  readonly createdAt: Date;
  readonly fingerprint: Buffer;
  readonly manifestRef: string;
  readonly version: string;
}

export class PostgresGenerationManifestStore implements GenerationManifestStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresGenerationManifestStoreConfig,
  ): Promise<PostgresGenerationManifestStore> {
    const roleProbe = createClosedDatabaseFactory(
      {
        databaseRole: config.expectedDatabaseRole,
        defaultConnectionLimit: 1,
        profile: "worker-interactive",
      },
      prismaRuntime,
    );
    const verified = await roleProbe.connect({
      applicationName: `${config.applicationName}:role-probe`,
      connectionLimit: 1,
      connectionString: config.connectionString,
    });
    await verified.disconnect();
    const pool = new Pool({
      application_name: config.applicationName,
      connectionString: config.connectionString,
      max: config.connectionLimit ?? 2,
    });
    await assertRole(pool, config.expectedDatabaseRole);
    return new PostgresGenerationManifestStore(pool);
  }

  public async findByVersion(
    resultVersion: string,
  ): Promise<GenerationManifestRecord | undefined> {
    this.#assertOpen();
    return recordFromRow(
      (
        await this.#pool.query<ManifestRow>(
          `${manifestSelect()}
            WHERE "catalogType"='GENERATION_MANIFEST' AND version=$1`,
          [resultVersion],
        )
      ).rows[0],
    );
  }

  public async selectActive(
    acceptedAt: Date,
  ): Promise<GenerationManifestRecord | undefined> {
    this.#assertOpen();
    const rows = (
      await this.#pool.query<ManifestRow>(
        `${manifestSelect()}
          WHERE "catalogType"='GENERATION_MANIFEST' AND state='ACTIVE'
            AND "activatedAt" IS NOT NULL AND "activatedAt" <= $1::timestamptz
          ORDER BY "activatedAt" DESC, "createdAt" DESC, version ASC
          LIMIT 2`,
        [acceptedAt],
      )
    ).rows;
    if (
      rows.length === 2 &&
      rows[0]!.activatedAt.getTime() === rows[1]!.activatedAt.getTime() &&
      rows[0]!.createdAt.getTime() === rows[1]!.createdAt.getTime()
    ) {
      throw new DeterministicGenerationError("CATALOG_ORDER_INVALID");
    }
    return recordFromRow(rows[0]);
  }

  public async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#pool.end();
    }
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("GENERATION_MANIFEST_STORE_CLOSED");
    }
  }
}

function manifestSelect(): string {
  return `SELECT id AS "manifestRef", version, "compatibilityPayload",
    fingerprint, "activatedAt", "createdAt"
    FROM daily_energy.system_version_catalog_entry`;
}

function recordFromRow(
  row: ManifestRow | undefined,
): GenerationManifestRecord | undefined {
  if (row === undefined) {
    return undefined;
  }
  return Object.freeze({
    activatedAt: new Date(row.activatedAt.getTime()),
    fingerprintHex: parseManifestFingerprint(row.fingerprint),
    manifest: row.compatibilityPayload as GenerationManifestRecord["manifest"],
    manifestRef: row.manifestRef,
  });
}

async function assertRole(pool: Pool, expectedRole: string): Promise<void> {
  try {
    const row = (
      await pool.query<{
        currentUser: string;
        expectedMember: boolean;
        sessionUser: string;
      }>(
        `SELECT current_user AS "currentUser", session_user AS "sessionUser",
                pg_has_role(current_user,$1,'MEMBER') AS "expectedMember"`,
        [expectedRole],
      )
    ).rows[0];
    if (!row || row.currentUser !== row.sessionUser || !row.expectedMember) {
      throw new Error("GENERATION_MANIFEST_DB_ROLE_MISMATCH");
    }
  } catch (error) {
    await pool.end();
    throw error;
  }
}
