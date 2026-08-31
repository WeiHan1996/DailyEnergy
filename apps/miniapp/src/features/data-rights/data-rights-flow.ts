import { createCommandRef } from "../onboarding/onboarding-flow.js";
import { MiniappPlatformError } from "../../platform/errors.js";
import type {
  LoginPort,
  StoragePort,
  StorageValue,
} from "../../platform/ports.js";
import {
  MiniappApiError,
  type C014Api,
  type DataExportDocument,
  type DataRightsSummaryView,
  type DataTaskListView,
  type DataTaskView,
  type DeletionConfirmationView,
  type IdentityVerificationView,
} from "../../services/miniapp-api.js";

const DAY_CACHE_KEYS = [
  "daily:views",
  "daily:generation",
  "daily:task-command",
  "daily:light-command",
  "evening:view",
  "weekly:view",
] as const;
const DELETION_STATUS_STORAGE_KEY = "data-rights:deletion-status-v1";
const ACCOUNT_CACHE_KEYS = [
  ...DAY_CACHE_KEYS,
  "checkin:draft",
  "onboarding:draft",
] as const;

export type DataRightsFlowResult =
  | {
      readonly kind: "overview";
      readonly summary: DataRightsSummaryView;
      readonly tasks: DataTaskListView;
    }
  | { readonly kind: "task"; readonly task: DataTaskView }
  | { readonly document: DataExportDocument; readonly kind: "download" }
  | {
      readonly confirmation: DeletionConfirmationView;
      readonly kind: "confirmation";
    }
  | {
      readonly kind: "verification";
      readonly verification: IdentityVerificationView;
    }
  | {
      readonly kind: "offline" | "recovery";
      readonly reasonCode: string;
    };

export class DataRightsCoordinator {
  public constructor(
    private readonly login: LoginPort,
    private readonly storage: StoragePort,
    private readonly api: C014Api,
  ) {}

  public load(): Promise<DataRightsFlowResult> {
    return this.#run(async () => {
      const [summary, tasks] = await Promise.all([
        this.api.getDataRightsSummary(),
        this.api.listDataTasks(),
      ]);
      return {
        kind: "overview",
        summary: summary.summary,
        tasks: tasks.tasks,
      };
    });
  }

  public refreshTask(taskRef: string): Promise<DataRightsFlowResult> {
    return this.#run(async () => ({
      kind: "task",
      task: (await this.api.getDataTask(taskRef)).task,
    }));
  }

  public startExport(
    confirmationVersion: string,
  ): Promise<DataRightsFlowResult> {
    return this.#run(async () => ({
      kind: "task",
      task: (
        await this.api.createDataExport({
          commandRef: createCommandRef("export"),
          confirmationVersion,
        })
      ).task,
    }));
  }

  public downloadExport(input: {
    readonly downloadRef: string;
    readonly taskRef: string;
  }): Promise<DataRightsFlowResult> {
    return this.#run(async () => ({
      document: await this.api.downloadDataExport(input),
      kind: "download",
    }));
  }

  public async deleteDay(input: {
    readonly expectedRevision: number;
    readonly productDate: string;
  }): Promise<DataRightsFlowResult> {
    const result = await this.#run(async () => ({
      kind: "task" as const,
      task: (
        await this.api.deleteDay({
          commandRef: createCommandRef("delete-day"),
          confirmationVersion: "data-rights-day-v1",
          expectedRevision: input.expectedRevision,
          productDate: input.productDate,
        })
      ).task,
    }));
    if (result.kind === "task") {
      await this.#clear(DAY_CACHE_KEYS);
    }
    return result;
  }

  public prepareAccountDeletion(
    expectedAccountRevision: number,
    confirmationVersion: string,
  ): Promise<DataRightsFlowResult> {
    return this.#run(async () => ({
      confirmation: (
        await this.api.prepareAccountDeletion({
          commandRef: createCommandRef("prepare-account-delete"),
          confirmationVersion,
          expectedAccountRevision,
        })
      ).confirmation,
      kind: "confirmation",
    }));
  }

  public prepareRelationshipDeletion(
    expectedRelationshipRevision: number,
    confirmationVersion: string,
  ): Promise<DataRightsFlowResult> {
    return this.#run(async () => ({
      confirmation: (
        await this.api.prepareRelationshipDeletion({
          commandRef: createCommandRef("prepare-relationship-delete"),
          confirmationVersion,
          expectedDayRevisions: [],
          expectedRelationshipRevision,
          includedDayProductDates: [],
        })
      ).confirmation,
      kind: "confirmation",
    }));
  }

  public async verifyIdentity(
    challengeRef: string,
  ): Promise<DataRightsFlowResult> {
    return this.#run(async () => {
      const login = await this.login.login();
      return {
        kind: "verification",
        verification: (
          await this.api.verifyDeletionIdentity({
            challengeRef,
            commandRef: createCommandRef("reauth"),
            wechatCode: login.code,
          })
        ).verification,
      };
    });
  }

  public async confirmAccountDeletion(input: {
    readonly confirmation: DeletionConfirmationView;
    readonly identityVerificationRef: string;
  }): Promise<DataRightsFlowResult> {
    if (input.confirmation.scope !== "ACCOUNT") {
      return { kind: "recovery", reasonCode: "DELETION_SCOPE_MISMATCH" };
    }
    const result = await this.#run(async () => {
      const accepted = (
        await this.api.confirmAccountDeletion({
          challengeRef: input.confirmation.confirmation_challenge_ref,
          commandRef: createCommandRef("confirm-account-delete"),
          confirmationVersion: input.confirmation.confirmation_version,
          expectedAccountRevision: input.confirmation.expected_revision,
          identityVerificationRef: input.identityVerificationRef,
        })
      ).accepted;
      await this.storage.set(DELETION_STATUS_STORAGE_KEY, {
        expiresAt: accepted.status_grant.expires_at,
        statusToken: accepted.status_grant.status_token,
        taskRef: accepted.status_grant.task_ref,
      });
      return { kind: "task" as const, task: accepted.task };
    });
    if (result.kind === "task") {
      await this.#clear(ACCOUNT_CACHE_KEYS);
    }
    return result;
  }

  public async confirmRelationshipDeletion(input: {
    readonly confirmation: DeletionConfirmationView;
  }): Promise<DataRightsFlowResult> {
    const confirmation = input.confirmation;
    if (confirmation.scope !== "RELATIONSHIP_DATA") {
      return { kind: "recovery", reasonCode: "DELETION_SCOPE_MISMATCH" };
    }
    const result = await this.#run(async () => ({
      kind: "task" as const,
      task: (
        await this.api.confirmRelationshipDeletion({
          challengeRef: confirmation.confirmation_challenge_ref,
          commandRef: createCommandRef("confirm-relationship-delete"),
          confirmationVersion: confirmation.confirmation_version,
          expectedDayRevisions: confirmation.expected_day_revisions,
          expectedRelationshipRevision: confirmation.expected_revision,
          includedDayProductDates:
            confirmation.target.included_day_product_dates,
        })
      ).task,
    }));
    if (result.kind === "task") {
      await this.#clear(DAY_CACHE_KEYS);
    }
    return result;
  }

  public async loadDeletionStatus(): Promise<DataRightsFlowResult> {
    const stored = deletionStatusGrant(
      await this.storage.get(DELETION_STATUS_STORAGE_KEY),
    );
    if (stored === undefined) {
      await this.storage.remove(DELETION_STATUS_STORAGE_KEY);
      return { kind: "recovery", reasonCode: "DELETION_STATUS_GRANT_INVALID" };
    }
    const result = await this.#run(async () => ({
      kind: "task" as const,
      task: (
        await this.api.getDeletionStatus({
          statusToken: stored.statusToken,
          taskRef: stored.taskRef,
        })
      ).task,
    }));
    if (result.kind === "task" && result.task.status === "SUCCEEDED") {
      await this.storage.remove(DELETION_STATUS_STORAGE_KEY);
    }
    if (
      result.kind === "recovery" &&
      result.reasonCode === "DELETION_STATUS_GRANT_INVALID"
    ) {
      await this.storage.remove(DELETION_STATUS_STORAGE_KEY);
    }
    return result;
  }

  async #run(
    operation: () => Promise<DataRightsFlowResult>,
  ): Promise<DataRightsFlowResult> {
    try {
      return await operation();
    } catch (error) {
      if (isNetworkFailure(error)) {
        return { kind: "offline", reasonCode: reasonCode(error) };
      }
      return {
        kind: "recovery",
        reasonCode:
          error instanceof MiniappApiError
            ? error.code
            : "DATA_RIGHTS_RECOVERY_REQUIRED",
      };
    }
  }

  async #clear(keys: readonly string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.storage.remove(key)));
  }
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof MiniappPlatformError ||
    (error instanceof MiniappApiError &&
      ["DEPENDENCY_UNAVAILABLE", "UPSTREAM_TRANSIENT"].includes(error.code))
  );
}

function reasonCode(error: unknown): string {
  return error instanceof MiniappPlatformError ||
    error instanceof MiniappApiError
    ? error.code
    : "NETWORK_FAILED";
}

function deletionStatusGrant(value: StorageValue | undefined):
  | {
      readonly expiresAt: string;
      readonly statusToken: string;
      readonly taskRef: string;
    }
  | undefined {
  if (
    !isStorageRecord(value) ||
    typeof value.expiresAt !== "string" ||
    typeof value.statusToken !== "string" ||
    typeof value.taskRef !== "string" ||
    !/^[A-Za-z0-9_-]{32,256}$/u.test(value.statusToken)
  ) {
    return undefined;
  }
  const expiresAt = Date.parse(value.expiresAt);
  if (
    !Number.isFinite(expiresAt) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value.expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return undefined;
  }
  return {
    expiresAt: value.expiresAt,
    statusToken: value.statusToken,
    taskRef: value.taskRef,
  };
}

function isStorageRecord(
  value: StorageValue | undefined,
): value is { readonly [key: string]: StorageValue } {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}
