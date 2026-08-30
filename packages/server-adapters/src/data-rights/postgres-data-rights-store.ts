import { Pool } from "pg";

import {
  DataTaskListViewSchema,
  DataTaskViewSchema,
  DataRightsSummaryViewSchema,
  DeletionConfirmationViewSchema,
  IdentityVerificationViewSchema,
  type DataTaskListView,
  type DataTaskView,
  type DataRightsSummaryView,
  type DeletionConfirmationView,
  type IdentityVerificationView,
} from "@daily-energy/shared-schemas";
import { z } from "zod";

import { commandRefStorageUuid } from "../commands/command-ref.js";
import { createClosedDatabaseFactory } from "../db/internal/create-closed-database-factory.js";
import { prismaRuntime } from "../db/internal/prisma-runtime.js";
import {
  parseExportArtifactReadResult,
  type ExportArtifactReadResult,
} from "./data-export-source.js";

const StoredAccountDeletionAcceptedSchema = z
  .object({
    task: DataTaskViewSchema,
    status_grant: z
      .object({
        task_ref: z.string().uuid(),
        expires_at: z.iso.datetime({ offset: true }),
      })
      .strict(),
  })
  .strict();

export interface StoredAccountDeletionAccepted {
  readonly task: DataTaskView;
  readonly statusGrant: {
    readonly expiresAt: Date;
    readonly taskRef: string;
  };
}

export type DataRightsStoreErrorCode =
  | "ACCOUNT_DELETED"
  | "ACCOUNT_DELETING"
  | "ACCOUNT_RESTRICTED"
  | "CHALLENGE_INVALID"
  | "IDENTITY_MISMATCH"
  | "IDENTITY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "NOT_FOUND"
  | "REVISION_CONFLICT"
  | "STATE_PRECONDITION";

export class DataRightsStoreError extends Error {
  public constructor(public readonly code: DataRightsStoreErrorCode) {
    super(code);
    this.name = "DataRightsStoreError";
  }
}

export interface DataRightsStore {
  cancelTask(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly expectedTaskRevision: number;
    readonly fingerprint: Buffer;
    readonly now: Date;
    readonly taskRef: string;
  }): Promise<DataTaskView>;
  close(): Promise<void>;
  confirmAccountDeletion(input: {
    readonly accountId: string;
    readonly challengeRef: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedAccountRevision: number;
    readonly fingerprint: Buffer;
    readonly identityVerificationRef: string;
    readonly now: Date;
    readonly statusTokenHash: Buffer;
  }): Promise<StoredAccountDeletionAccepted>;
  confirmRelationshipDeletion(input: {
    readonly accountId: string;
    readonly challengeRef: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedRelationshipRevision: number;
    readonly fingerprint: Buffer;
    readonly frozenPayload: Readonly<Record<string, unknown>>;
    readonly identityVerificationRef?: string;
    readonly now: Date;
  }): Promise<DataTaskView>;
  createExport(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly fingerprint: Buffer;
    readonly now: Date;
  }): Promise<DataTaskView>;
  deleteDay(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedRevision: number;
    readonly fingerprint: Buffer;
    readonly now: Date;
    readonly productDate: string;
  }): Promise<DataTaskView>;
  deleteMatter(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedRevision: number;
    readonly fingerprint: Buffer;
    readonly matterRef: string;
    readonly now: Date;
  }): Promise<DataTaskView>;
  getTask(
    accountId: string,
    taskRef: string,
    now: Date,
  ): Promise<DataTaskView | undefined>;
  getSummary(accountId: string, now: Date): Promise<DataRightsSummaryView>;
  getDeletionStatus(
    taskRef: string,
    statusTokenHash: Buffer,
    now: Date,
  ): Promise<DataTaskView | undefined>;
  listTasks(accountId: string, now: Date): Promise<DataTaskListView>;
  readExportArtifact(input: {
    readonly accountId: string;
    readonly downloadRef: string;
    readonly now: Date;
    readonly taskRef: string;
  }): Promise<ExportArtifactReadResult>;
  prepareAccountDeletion(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedAccountRevision: number;
    readonly fingerprint: Buffer;
    readonly now: Date;
  }): Promise<DeletionConfirmationView>;
  prepareRelationshipDeletion(input: {
    readonly accountId: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedRelationshipRevision: number;
    readonly fingerprint: Buffer;
    readonly frozenPayload: Readonly<Record<string, unknown>>;
    readonly now: Date;
  }): Promise<DeletionConfirmationView>;
  verifyIdentity(input: {
    readonly accountId: string;
    readonly challengeRef: string;
    readonly commandRef: string;
    readonly fingerprint: Buffer;
    readonly now: Date;
    readonly subjectLookupToken: Buffer;
  }): Promise<IdentityVerificationView>;
}

export interface PostgresDataRightsStoreConfig {
  readonly applicationName: string;
  readonly connectionLimit?: number;
  readonly connectionString: string;
  readonly expectedDatabaseRole: string;
}

interface ViewRow {
  readonly view: unknown;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class PostgresDataRightsStore implements DataRightsStore {
  readonly #pool: Pool;
  #closed = false;

  private constructor(pool: Pool) {
    this.#pool = pool;
  }

  public static async connect(
    config: PostgresDataRightsStoreConfig,
  ): Promise<PostgresDataRightsStore> {
    const roleProbe = createClosedDatabaseFactory(
      {
        databaseRole: config.expectedDatabaseRole,
        defaultConnectionLimit: 1,
        profile: "api",
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
      max: config.connectionLimit ?? 4,
    });
    try {
      const identity = await pool.query<{
        currentUser: string;
        expectedMember: boolean;
        sessionUser: string;
      }>(
        `SELECT current_user AS "currentUser",session_user AS "sessionUser",
                pg_has_role(session_user,$1,'MEMBER') AS "expectedMember"`,
        [config.expectedDatabaseRole],
      );
      const row = identity.rows[0];
      if (!row || row.currentUser !== row.sessionUser || !row.expectedMember) {
        throw new Error("DATA_RIGHTS_DB_ROLE_MISMATCH");
      }
      return new PostgresDataRightsStore(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  public async listTasks(
    accountId: string,
    now: Date,
  ): Promise<DataTaskListView> {
    return DataTaskListViewSchema.parse(
      await this.#view(
        "SELECT daily_energy.list_c014_data_tasks($1,$2) AS view",
        [accountId, now],
      ),
    );
  }

  public async getSummary(
    accountId: string,
    now: Date,
  ): Promise<DataRightsSummaryView> {
    return DataRightsSummaryViewSchema.parse(
      await this.#view(
        "SELECT daily_energy.get_c014_data_rights_summary($1,$2) AS view",
        [accountId, now],
      ),
    );
  }

  public async getTask(
    accountId: string,
    taskRef: string,
    now: Date,
  ): Promise<DataTaskView | undefined> {
    if (!UUID_PATTERN.test(taskRef)) {
      return undefined;
    }
    const view = await this.#view(
      "SELECT daily_energy.get_c014_data_task($1,$2,$3) AS view",
      [accountId, taskRef, now],
    );
    return view === null ? undefined : DataTaskViewSchema.parse(view);
  }

  public createExport(
    input: Parameters<DataRightsStore["createExport"]>[0],
  ): Promise<DataTaskView> {
    return this.#taskView(
      `SELECT daily_energy.create_c014_export_task($1,$2,$3,$4,$5) AS view`,
      [
        input.accountId,
        commandRefStorageUuid(input.commandRef),
        input.confirmationVersion,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public deleteDay(
    input: Parameters<DataRightsStore["deleteDay"]>[0],
  ): Promise<DataTaskView> {
    return this.#taskView(
      `SELECT daily_energy.create_c014_day_deletion($1,$2,$3::date,$4,$5,$6,$7) AS view`,
      [
        input.accountId,
        commandRefStorageUuid(input.commandRef),
        input.productDate,
        input.expectedRevision,
        input.confirmationVersion,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public deleteMatter(
    input: Parameters<DataRightsStore["deleteMatter"]>[0],
  ): Promise<DataTaskView> {
    if (!UUID_PATTERN.test(input.matterRef)) {
      return Promise.reject(new DataRightsStoreError("NOT_FOUND"));
    }
    return this.#taskView(
      `SELECT daily_energy.create_c014_matter_deletion($1,$2,$3,$4,$5,$6,$7) AS view`,
      [
        input.accountId,
        commandRefStorageUuid(input.commandRef),
        input.matterRef,
        input.expectedRevision,
        input.confirmationVersion,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public prepareRelationshipDeletion(
    input: Parameters<DataRightsStore["prepareRelationshipDeletion"]>[0],
  ): Promise<DeletionConfirmationView> {
    return this.#confirmationView(
      `SELECT daily_energy.prepare_c014_relationship_deletion(
        $1,$2,$3::jsonb,$4,$5,$6,$7) AS view`,
      [
        input.accountId,
        commandRefStorageUuid(input.commandRef),
        JSON.stringify(input.frozenPayload),
        input.expectedRelationshipRevision,
        input.confirmationVersion,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public prepareAccountDeletion(
    input: Parameters<DataRightsStore["prepareAccountDeletion"]>[0],
  ): Promise<DeletionConfirmationView> {
    return this.#confirmationView(
      `SELECT daily_energy.prepare_c014_account_deletion(
        $1,$2,$3,$4,$5,$6) AS view`,
      [
        input.accountId,
        commandRefStorageUuid(input.commandRef),
        input.expectedAccountRevision,
        input.confirmationVersion,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public verifyIdentity(
    input: Parameters<DataRightsStore["verifyIdentity"]>[0],
  ): Promise<IdentityVerificationView> {
    if (!UUID_PATTERN.test(input.challengeRef)) {
      return Promise.reject(new DataRightsStoreError("CHALLENGE_INVALID"));
    }
    return this.#identityView(
      `SELECT daily_energy.verify_c014_deletion_identity(
        $1,$2,$3,$4,$5,$6) AS view`,
      [
        input.accountId,
        input.challengeRef,
        commandRefStorageUuid(input.commandRef),
        input.subjectLookupToken,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public confirmRelationshipDeletion(
    input: Parameters<DataRightsStore["confirmRelationshipDeletion"]>[0],
  ): Promise<DataTaskView> {
    if (
      !UUID_PATTERN.test(input.challengeRef) ||
      (input.identityVerificationRef !== undefined &&
        !UUID_PATTERN.test(input.identityVerificationRef))
    ) {
      return Promise.reject(new DataRightsStoreError("CHALLENGE_INVALID"));
    }
    return this.#taskView(
      `SELECT daily_energy.confirm_c014_relationship_deletion(
        $1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9) AS view`,
      [
        input.accountId,
        commandRefStorageUuid(input.commandRef),
        input.challengeRef,
        JSON.stringify(input.frozenPayload),
        input.expectedRelationshipRevision,
        input.confirmationVersion,
        input.identityVerificationRef ?? null,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public confirmAccountDeletion(
    input: Parameters<DataRightsStore["confirmAccountDeletion"]>[0],
  ): Promise<StoredAccountDeletionAccepted> {
    if (
      !UUID_PATTERN.test(input.challengeRef) ||
      !UUID_PATTERN.test(input.identityVerificationRef)
    ) {
      return Promise.reject(new DataRightsStoreError("CHALLENGE_INVALID"));
    }
    return this.#accountDeletionAccepted(
      `SELECT daily_energy.confirm_c014_account_deletion(
        $1,$2,$3,$4,$5,$6,$7,$8,$9) AS view`,
      [
        input.accountId,
        commandRefStorageUuid(input.commandRef),
        input.challengeRef,
        input.expectedAccountRevision,
        input.confirmationVersion,
        input.identityVerificationRef,
        input.statusTokenHash,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public async getDeletionStatus(
    taskRef: string,
    statusTokenHash: Buffer,
    now: Date,
  ): Promise<DataTaskView | undefined> {
    if (!UUID_PATTERN.test(taskRef)) {
      return undefined;
    }
    const view = await this.#view(
      "SELECT daily_energy.get_c014_deletion_status($1,$2,$3) AS view",
      [taskRef, statusTokenHash, now],
    );
    return view === null ? undefined : DataTaskViewSchema.parse(view);
  }

  public async readExportArtifact(
    input: Parameters<DataRightsStore["readExportArtifact"]>[0],
  ): Promise<ExportArtifactReadResult> {
    if (
      !UUID_PATTERN.test(input.taskRef) ||
      !UUID_PATTERN.test(input.downloadRef)
    ) {
      return { status: "INVALID" };
    }
    const value = await this.#view(
      "SELECT daily_energy.read_c014_export_artifact($1,$2,$3,$4) AS view",
      [input.accountId, input.taskRef, input.downloadRef, input.now],
    );
    return parseExportArtifactReadResult(value, input.accountId);
  }

  public cancelTask(
    input: Parameters<DataRightsStore["cancelTask"]>[0],
  ): Promise<DataTaskView> {
    if (!UUID_PATTERN.test(input.taskRef)) {
      return Promise.reject(new DataRightsStoreError("NOT_FOUND"));
    }
    return this.#taskView(
      `SELECT daily_energy.cancel_c014_data_task($1,$2,$3,$4,$5,$6) AS view`,
      [
        input.accountId,
        input.taskRef,
        commandRefStorageUuid(input.commandRef),
        input.expectedTaskRevision,
        input.fingerprint,
        input.now,
      ],
    );
  }

  public async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#pool.end();
  }

  async #taskView(statement: string, values: readonly unknown[]) {
    return DataTaskViewSchema.parse(await this.#view(statement, values));
  }

  async #accountDeletionAccepted(
    statement: string,
    values: readonly unknown[],
  ): Promise<StoredAccountDeletionAccepted> {
    const parsed = StoredAccountDeletionAcceptedSchema.parse(
      await this.#view(statement, values),
    );
    return {
      task: parsed.task,
      statusGrant: {
        expiresAt: new Date(parsed.status_grant.expires_at),
        taskRef: parsed.status_grant.task_ref,
      },
    };
  }

  async #confirmationView(statement: string, values: readonly unknown[]) {
    return DeletionConfirmationViewSchema.parse(
      await this.#view(statement, values),
    );
  }

  async #identityView(statement: string, values: readonly unknown[]) {
    return IdentityVerificationViewSchema.parse(
      await this.#view(statement, values),
    );
  }

  async #view(statement: string, values: readonly unknown[]): Promise<unknown> {
    if (this.#closed) {
      throw new Error("DATA_RIGHTS_STORE_CLOSED");
    }
    try {
      const result = await this.#pool.query<ViewRow>(statement, [...values]);
      return result.rows[0]?.view ?? null;
    } catch (error) {
      const code = storeErrorCode(error);
      if (code !== undefined) {
        throw new DataRightsStoreError(code);
      }
      throw error;
    }
  }
}

function storeErrorCode(error: unknown): DataRightsStoreErrorCode | undefined {
  if (error === null || typeof error !== "object") {
    return undefined;
  }
  const message = "message" in error ? String(error.message) : "";
  const suffix = /^C014_([A-Z_]+)$/u.exec(message)?.[1];
  return suffix === undefined
    ? undefined
    : suffix === "ACCOUNT_DELETED" ||
        suffix === "ACCOUNT_DELETING" ||
        suffix === "ACCOUNT_RESTRICTED" ||
        suffix === "CHALLENGE_INVALID" ||
        suffix === "IDENTITY_MISMATCH" ||
        suffix === "IDENTITY_REQUIRED" ||
        suffix === "IDEMPOTENCY_CONFLICT" ||
        suffix === "NOT_FOUND" ||
        suffix === "REVISION_CONFLICT" ||
        suffix === "STATE_PRECONDITION"
      ? suffix
      : undefined;
}

export const UNAVAILABLE_DATA_RIGHTS_STORE: DataRightsStore = {
  cancelTask: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  close: async () => undefined,
  confirmAccountDeletion: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  confirmRelationshipDeletion: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  createExport: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  deleteDay: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  deleteMatter: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  getTask: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  getSummary: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  getDeletionStatus: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  listTasks: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  prepareAccountDeletion: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  prepareRelationshipDeletion: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  readExportArtifact: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
  verifyIdentity: async () =>
    Promise.reject(new Error("DATA_RIGHTS_STORE_UNAVAILABLE")),
};
