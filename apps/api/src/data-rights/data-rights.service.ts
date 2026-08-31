import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  DataRightsStoreError,
  type DataRightsStore,
  type StoredDataExportSource,
} from "@daily-energy/server-adapters/api";
import {
  AccountDeletionAcceptedViewSchema,
  DataExportDocumentSchema,
  type AccountDeletionAcceptedView,
  type DataExportDocument,
  type DataTaskCancelRequest,
  type DataTaskListView,
  type DataTaskView,
  type DataRightsSummaryView,
  type DeleteAccountConfirmRequest,
  type DeleteAccountPrepareRequest,
  type DeleteDayRequest,
  type DeleteMatterRequest,
  type DeleteRelationshipConfirmRequest,
  type DeleteRelationshipPrepareRequest,
  type DeletionConfirmationView,
  type ExportRequest,
  type IdentityVerificationView,
  type ReauthVerifyRequest,
} from "@daily-energy/shared-schemas";

import { AuthService } from "../auth/auth.service.js";
import type { SessionPrincipal } from "../auth/contracts.js";
import type { PreferredNameCodec } from "../consent-profile/preferred-name-codec.js";
import {
  DATA_RIGHTS_STORE,
  DELETION_STATUS_TOKEN_ISSUER,
  EVENING_NOTE_CODEC,
  MATTER_TITLE_CODEC,
  PREFERRED_NAME_CODEC,
  PRODUCT_DATE_CLOCK,
} from "../composition/tokens.js";
import type { EveningNoteCodec } from "../evening/evening-note-codec.js";
import {
  resolveProductDate,
  type ProductDateClock,
  type ProductDateResolution,
} from "../product-date/product-date.js";
import { ApiException } from "../transport/common/api-exception.js";
import {
  deletionStatusTokenFromAuthorization,
  deletionStatusTokenHash,
  type DeletionStatusTokenIssuer,
  type MatterTitleCodec,
} from "./data-rights-codec.js";

const DATA_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

export interface DataRightsServiceResult<View> {
  readonly resolution: ProductDateResolution;
  readonly view: View;
}

export interface DataExportDownloadResult {
  readonly body: string;
  readonly byteLength: number;
  readonly resolution: ProductDateResolution;
}

@Injectable()
export class DataRightsService {
  public constructor(
    @Inject(DATA_RIGHTS_STORE) private readonly store: DataRightsStore,
    @Inject(DELETION_STATUS_TOKEN_ISSUER)
    private readonly statusTokenIssuer: DeletionStatusTokenIssuer,
    @Inject(PREFERRED_NAME_CODEC)
    private readonly preferredNameCodec: PreferredNameCodec,
    @Inject(EVENING_NOTE_CODEC)
    private readonly eveningNoteCodec: EveningNoteCodec,
    @Inject(MATTER_TITLE_CODEC)
    private readonly matterTitleCodec: MatterTitleCodec,
    @Inject(PRODUCT_DATE_CLOCK) private readonly clock: ProductDateClock,
    private readonly auth: AuthService,
  ) {}

  public getSummary(
    principal: SessionPrincipal,
  ): Promise<DataRightsServiceResult<DataRightsSummaryView>> {
    return this.#run((resolution) =>
      this.store.getSummary(principal.accountId, resolution.now),
    );
  }

  public listTasks(
    principal: SessionPrincipal,
  ): Promise<DataRightsServiceResult<DataTaskListView>> {
    return this.#run((resolution) =>
      this.store.listTasks(principal.accountId, resolution.now),
    );
  }

  public async getTask(
    principal: SessionPrincipal,
    taskRef: string,
  ): Promise<DataRightsServiceResult<DataTaskView>> {
    return this.#run(async (resolution) => {
      const view = await this.store.getTask(
        principal.accountId,
        taskRef,
        resolution.now,
      );
      if (view === undefined) {
        throw new ApiException({ code: "RESOURCE_NOT_FOUND" });
      }
      return view;
    });
  }

  public createExport(
    principal: SessionPrincipal,
    request: ExportRequest,
  ): Promise<DataRightsServiceResult<DataTaskView>> {
    return this.#run((resolution) =>
      this.store.createExport({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        confirmationVersion: request.confirmation_version,
        fingerprint: fingerprint(request),
        now: resolution.now,
      }),
    );
  }

  public async downloadExport(
    principal: SessionPrincipal,
    taskRef: string,
    downloadRef: string,
  ): Promise<DataExportDownloadResult> {
    const result = await this.#run((resolution) =>
      this.store.readExportArtifact({
        accountId: principal.accountId,
        downloadRef,
        now: resolution.now,
        taskRef,
      }),
    );
    if (result.view.status !== "READY") {
      throw exportReadException(result.view.status, result.resolution);
    }
    const document = this.#projectExport(
      result.view.source,
      result.view.readyAt,
    );
    const body = `${stableJson(document)}\n`;
    const byteLength = Buffer.byteLength(body, "utf8");
    if (byteLength > DATA_EXPORT_MAX_BYTES) {
      throw new ApiException({
        code: "EXPORT_TOO_LARGE",
        productDate: result.resolution.productDate,
        serverNow: result.resolution.now,
      });
    }
    return { body, byteLength, resolution: result.resolution };
  }

  public deleteDay(
    principal: SessionPrincipal,
    request: DeleteDayRequest,
  ): Promise<DataRightsServiceResult<DataTaskView>> {
    return this.#run((resolution) =>
      this.store.deleteDay({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        confirmationVersion: request.confirmation_version,
        expectedRevision: request.expected_revision,
        fingerprint: fingerprint(request),
        now: resolution.now,
        productDate: request.target.product_date,
      }),
    );
  }

  public deleteMatter(
    principal: SessionPrincipal,
    request: DeleteMatterRequest,
  ): Promise<DataRightsServiceResult<DataTaskView>> {
    return this.#run((resolution) =>
      this.store.deleteMatter({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        confirmationVersion: request.confirmation_version,
        expectedRevision: request.expected_revision,
        fingerprint: fingerprint(request),
        matterRef: request.target.matter_ref,
        now: resolution.now,
      }),
    );
  }

  public prepareRelationshipDeletion(
    principal: SessionPrincipal,
    request: DeleteRelationshipPrepareRequest,
  ): Promise<DataRightsServiceResult<DeletionConfirmationView>> {
    return this.#run((resolution) =>
      this.store.prepareRelationshipDeletion({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        confirmationVersion: request.confirmation_version,
        expectedRelationshipRevision: request.expected_relationship_revision,
        fingerprint: fingerprint(request),
        frozenPayload: relationshipPayload(request),
        now: resolution.now,
      }),
    );
  }

  public confirmRelationshipDeletion(
    principal: SessionPrincipal,
    request: DeleteRelationshipConfirmRequest,
  ): Promise<DataRightsServiceResult<DataTaskView>> {
    return this.#run((resolution) =>
      this.store.confirmRelationshipDeletion({
        accountId: principal.accountId,
        challengeRef: request.confirmation_challenge_ref,
        commandRef: request.command_ref,
        confirmationVersion: request.confirmation_version,
        expectedRelationshipRevision: request.expected_relationship_revision,
        fingerprint: fingerprint(request),
        frozenPayload: relationshipPayload(request),
        ...(request.identity_verification_ref === undefined
          ? {}
          : { identityVerificationRef: request.identity_verification_ref }),
        now: resolution.now,
      }),
    );
  }

  public prepareAccountDeletion(
    principal: SessionPrincipal,
    request: DeleteAccountPrepareRequest,
  ): Promise<DataRightsServiceResult<DeletionConfirmationView>> {
    return this.#run((resolution) =>
      this.store.prepareAccountDeletion({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        confirmationVersion: request.confirmation_version,
        expectedAccountRevision: request.expected_account_revision,
        fingerprint: fingerprint(request),
        now: resolution.now,
      }),
    );
  }

  public confirmAccountDeletion(
    principal: SessionPrincipal,
    request: DeleteAccountConfirmRequest,
  ): Promise<DataRightsServiceResult<AccountDeletionAcceptedView>> {
    return this.#run(async (resolution) => {
      const statusToken = this.statusTokenIssuer.issue({
        accountId: principal.accountId,
        challengeRef: request.confirmation_challenge_ref,
        commandRef: request.command_ref,
      });
      const accepted = await this.store.confirmAccountDeletion({
        accountId: principal.accountId,
        challengeRef: request.confirmation_challenge_ref,
        commandRef: request.command_ref,
        confirmationVersion: request.confirmation_version,
        expectedAccountRevision: request.expected_account_revision,
        fingerprint: fingerprint(request),
        identityVerificationRef: request.identity_verification_ref,
        now: resolution.now,
        statusTokenHash: deletionStatusTokenHash(statusToken),
      });
      return AccountDeletionAcceptedViewSchema.parse({
        task: accepted.task,
        status_grant: {
          task_ref: accepted.statusGrant.taskRef,
          status_token: statusToken,
          expires_at: accepted.statusGrant.expiresAt.toISOString(),
        },
      });
    });
  }

  public getDeletionStatus(
    authorization: string | undefined,
    taskRef: string,
  ): Promise<DataRightsServiceResult<DataTaskView>> {
    const statusToken = deletionStatusTokenFromAuthorization(authorization);
    if (statusToken === undefined) {
      throw new ApiException({ code: "DELETION_STATUS_GRANT_INVALID" });
    }
    return this.#run(async (resolution) => {
      const task = await this.store.getDeletionStatus(
        taskRef,
        deletionStatusTokenHash(statusToken),
        resolution.now,
      );
      if (task === undefined) {
        throw new ApiException({ code: "DELETION_STATUS_GRANT_INVALID" });
      }
      return task;
    });
  }

  public cancelTask(
    principal: SessionPrincipal,
    taskRef: string,
    request: DataTaskCancelRequest,
  ): Promise<DataRightsServiceResult<DataTaskView>> {
    return this.#run((resolution) =>
      this.store.cancelTask({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        expectedTaskRevision: request.expected_task_revision,
        fingerprint: fingerprint({ ...request, task_ref: taskRef }),
        now: resolution.now,
        taskRef,
      }),
    );
  }

  public verifyIdentity(
    principal: SessionPrincipal,
    request: ReauthVerifyRequest,
  ): Promise<DataRightsServiceResult<IdentityVerificationView>> {
    return this.#run(async (resolution) => {
      const identity = await this.auth.reverifyWechatIdentity(
        request.wechat_code,
      );
      return this.store.verifyIdentity({
        accountId: principal.accountId,
        challengeRef: request.confirmation_challenge_ref,
        commandRef: request.command_ref,
        fingerprint: fingerprint({
          confirmation_challenge_ref: request.confirmation_challenge_ref,
        }),
        now: resolution.now,
        subjectLookupToken: identity.subjectLookupToken,
      });
    });
  }

  async #run<View>(
    operation: (resolution: ProductDateResolution) => Promise<View>,
  ): Promise<DataRightsServiceResult<View>> {
    let resolution: ProductDateResolution;
    try {
      resolution = resolveProductDate(this.clock.now());
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
    try {
      return { resolution, view: await operation(resolution) };
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      if (error instanceof DataRightsStoreError) {
        throw storeException(error);
      }
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }

  #projectExport(
    source: StoredDataExportSource,
    readyAt: Date,
  ): DataExportDocument {
    try {
      return DataExportDocumentSchema.parse({
        schema_version: "data-export-v1",
        generated_at: readyAt.toISOString(),
        ...(source.profile === undefined
          ? {}
          : {
              profile: {
                expression_style: source.profile.expression_style,
                onboarding_completed: source.profile.onboarding_completed,
                ...(source.profile.preferredName === undefined
                  ? {}
                  : {
                      preferred_name: this.preferredNameCodec.reveal(
                        source.profile.preferredName,
                      ),
                    }),
                revision: source.profile.revision,
                updated_at: source.profile.updated_at,
              },
            }),
        consent_summary: source.consentSummary,
        days: source.days.map((day) => ({
          ...day,
          ...(day.evening === undefined
            ? {}
            : {
                evening: {
                  overall_feeling: day.evening.overall_feeling,
                  revision: day.evening.revision,
                  ...(day.evening.note === undefined
                    ? {}
                    : {
                        note: this.eveningNoteCodec.reveal(day.evening.note),
                      }),
                  updated_at: day.evening.updated_at,
                },
              }),
        })),
        matters: source.matters.map((matter) => ({
          ...matter,
          title: this.matterTitleCodec.reveal(matter.title),
        })),
        ...(source.relationshipSummary === undefined
          ? {}
          : { relationship_summary: source.relationshipSummary }),
        notification_preferences: source.notificationPreferences,
        ...(source.safetySummary === undefined
          ? {}
          : { safety_summary: source.safetySummary }),
        data_task_summaries: source.dataTaskSummaries,
      });
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }
}

function relationshipPayload(
  request: DeleteRelationshipPrepareRequest | DeleteRelationshipConfirmRequest,
): Readonly<Record<string, unknown>> {
  return {
    expected_day_revisions: request.included_day_expected_revisions,
    target: request.target,
  };
}

function fingerprint(value: unknown): Buffer {
  return createHash("sha256").update(stableJson(value), "utf8").digest();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function storeException(error: DataRightsStoreError): ApiException {
  switch (error.code) {
    case "ACCOUNT_DELETED":
      return new ApiException({ code: "ACCOUNT_DELETED" });
    case "ACCOUNT_DELETING":
      return new ApiException({ code: "ACCOUNT_DELETING" });
    case "ACCOUNT_RESTRICTED":
      return new ApiException({ code: "ACCOUNT_RESTRICTED" });
    case "IDEMPOTENCY_CONFLICT":
      return new ApiException({ code: "IDEMPOTENCY_CONFLICT" });
    case "NOT_FOUND":
      return new ApiException({ code: "RESOURCE_NOT_FOUND" });
    case "REVISION_CONFLICT":
      return new ApiException({ code: "REVISION_CONFLICT" });
    case "IDENTITY_MISMATCH":
      return new ApiException({ code: "AUTH_INVALID" });
    case "CHALLENGE_INVALID":
    case "IDENTITY_REQUIRED":
    case "STATE_PRECONDITION":
      return new ApiException({ code: "STATE_PRECONDITION_FAILED" });
  }
  return new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
}

function exportReadException(
  status: "EXPIRED" | "INVALID" | "NOT_READY" | "SOURCE_CHANGED",
  resolution: ProductDateResolution,
): ApiException {
  const code =
    status === "EXPIRED"
      ? "EXPORT_ARTIFACT_EXPIRED"
      : status === "SOURCE_CHANGED"
        ? "EXPORT_SOURCE_CHANGED"
        : status === "NOT_READY"
          ? "EXPORT_NOT_READY"
          : "RESOURCE_NOT_FOUND";
  return new ApiException({
    code,
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}
