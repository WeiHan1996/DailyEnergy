import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  CURRENT_NECESSARY_CONSENT_NOTICE_VERSION,
  type ConsentProfileStore,
  type StoreMutation,
  type StoredMemoryPreferencesView,
  type StoredNotificationSettingsView,
  type StoredProfileView,
} from "@daily-energy/server-adapters/api";
import type {
  CommandReceiptView,
  ConsentAcceptRequest,
  ConsentView,
  ConsentWithdrawRequest,
  MemoryPreferencesUpdateRequest,
  MemoryPreferencesView,
  NotificationPermissionSyncRequest,
  NotificationSettingsUpdateRequest,
  NotificationSettingsView,
  OnboardingCompleteRequest,
  ProfileUpdateRequest,
  ProfileView,
  StyleCalibrationRequest,
} from "@daily-energy/shared-schemas";

import type { SessionPrincipal } from "../auth/contracts.js";
import {
  CONSENT_PROFILE_STORE,
  PREFERRED_NAME_CODEC,
} from "../composition/tokens.js";
import { ApiException } from "../transport/common/api-exception.js";
import type { PreferredNameCodec } from "./preferred-name-codec.js";

@Injectable()
export class ConsentProfileService {
  public constructor(
    @Inject(CONSENT_PROFILE_STORE) private readonly store: ConsentProfileStore,
    @Inject(PREFERRED_NAME_CODEC) private readonly codec: PreferredNameCodec,
  ) {}

  public async getConsent(principal: SessionPrincipal): Promise<ConsentView> {
    return this.#storeCall(async () => {
      const stored = await this.store.getConsent(principal.accountId);
      return {
        ...(stored.acceptedAt === undefined
          ? {}
          : { accepted_at: stored.acceptedAt.toISOString() }),
        notice_version: stored.noticeVersion,
        state: stored.state,
      };
    });
  }

  public async acceptConsent(
    principal: SessionPrincipal,
    request: ConsentAcceptRequest,
  ): Promise<CommandReceiptView> {
    this.#assertCurrentNotice(request.notice_version);
    const result = await this.#storeCall(() =>
      this.store.acceptConsent({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        normalizedPayloadFingerprint: payloadFingerprint("CONSENT_ACCEPT", {
          notice_version: request.notice_version,
        }),
        noticeVersion: request.notice_version,
        now: new Date(),
      }),
    );
    return commandReceipt(request.command_ref, "CONSENT_ACCEPT", result);
  }

  public async withdrawConsent(
    principal: SessionPrincipal,
    request: ConsentWithdrawRequest,
  ): Promise<CommandReceiptView> {
    this.#assertCurrentNotice(request.notice_version);
    const result = await this.#storeCall(() =>
      this.store.withdrawConsent({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        normalizedPayloadFingerprint: payloadFingerprint("CONSENT_WITHDRAW", {
          notice_version: request.notice_version,
        }),
        noticeVersion: request.notice_version,
        now: new Date(),
      }),
    );
    return commandReceipt(request.command_ref, "CONSENT_WITHDRAW", result);
  }

  public async getProfile(principal: SessionPrincipal): Promise<ProfileView> {
    return this.#storeCall(async () => {
      const stored = await this.store.getProfile(principal.accountId);
      if (stored === undefined) {
        throw new ApiException({ code: "ONBOARDING_REQUIRED" });
      }
      return this.#profileView(stored);
    });
  }

  public async completeOnboarding(
    principal: SessionPrincipal,
    request: OnboardingCompleteRequest,
  ): Promise<ProfileView> {
    const result = await this.#storeCall(() =>
      this.store.completeOnboarding({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        expressionStyle: request.expression_style,
        normalizedPayloadFingerprint: payloadFingerprint(
          "ONBOARDING_COMPLETE",
          {
            expression_style: request.expression_style,
            preferred_name: request.preferred_name ?? null,
          },
        ),
        now: new Date(),
        ...(request.preferred_name === undefined
          ? {}
          : { preferredName: this.#protectName(request.preferred_name) }),
      }),
    );
    return this.#profileMutation(result);
  }

  public async updateProfile(
    principal: SessionPrincipal,
    request: ProfileUpdateRequest,
  ): Promise<ProfileView> {
    const preferredName =
      request.preferred_name !== undefined
        ? this.#protectName(request.preferred_name)
        : request.clear_preferred_name === true
          ? null
          : undefined;
    const result = await this.#storeCall(() =>
      this.store.updateProfile({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        expectedRevision: request.expected_revision,
        normalizedPayloadFingerprint: payloadFingerprint("PROFILE_UPDATE", {
          clear_preferred_name: request.clear_preferred_name ?? false,
          expected_revision: request.expected_revision,
          expression_style: request.expression_style ?? null,
          preferred_name: request.preferred_name ?? null,
        }),
        now: new Date(),
        operationCode: "PROFILE_UPDATE",
        ...(request.expression_style === undefined
          ? {}
          : { expressionStyle: request.expression_style }),
        ...(preferredName === undefined ? {} : { preferredName }),
      }),
    );
    return this.#profileMutation(result);
  }

  public async calibrateStyle(
    principal: SessionPrincipal,
    request: StyleCalibrationRequest,
  ): Promise<ProfileView> {
    const result = await this.#storeCall(() =>
      this.store.updateProfile({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        expectedRevision: request.expected_revision,
        expressionStyle: request.expression_style,
        normalizedPayloadFingerprint: payloadFingerprint("STYLE_CALIBRATION", {
          expected_revision: request.expected_revision,
          expression_style: request.expression_style,
        }),
        now: new Date(),
        operationCode: "STYLE_CALIBRATION",
      }),
    );
    return this.#profileMutation(result);
  }

  public async getMemoryPreferences(
    principal: SessionPrincipal,
  ): Promise<MemoryPreferencesView> {
    return this.#storeCall(async () => {
      const stored = await this.store.getMemoryPreferences(principal.accountId);
      if (stored === undefined) {
        throw new ApiException({ code: "ONBOARDING_REQUIRED" });
      }
      return memoryView(stored);
    });
  }

  public async updateMemoryPreferences(
    principal: SessionPrincipal,
    request: MemoryPreferencesUpdateRequest,
  ): Promise<MemoryPreferencesView> {
    const result = await this.#storeCall(() =>
      this.store.updateMemoryPreferences({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        dailyUseEnabled: request.daily_use_enabled,
        expectedRevision: request.expected_revision,
        masterEnabled: request.master_enabled,
        normalizedPayloadFingerprint: payloadFingerprint(
          "MEMORY_PREFERENCES_UPDATE",
          {
            daily_use_enabled: request.daily_use_enabled,
            expected_revision: request.expected_revision,
            master_enabled: request.master_enabled,
            weekly_use_enabled: request.weekly_use_enabled,
          },
        ),
        now: new Date(),
        requiresConsent:
          request.master_enabled ||
          request.daily_use_enabled ||
          request.weekly_use_enabled,
        weeklyUseEnabled: request.weekly_use_enabled,
      }),
    );
    return memoryMutation(result);
  }

  public async getNotificationSettings(
    principal: SessionPrincipal,
  ): Promise<NotificationSettingsView> {
    return this.#storeCall(async () => {
      const stored = await this.store.getNotificationSettings(
        principal.accountId,
        principal.sessionId,
        new Date(),
      );
      if (stored === undefined) {
        throw new ApiException({ code: "ONBOARDING_REQUIRED" });
      }
      return notificationView(stored);
    });
  }

  public async updateNotificationSettings(
    principal: SessionPrincipal,
    request: NotificationSettingsUpdateRequest,
  ): Promise<NotificationSettingsView> {
    const result = await this.#storeCall(() =>
      this.store.updateNotificationSettings({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        deviceRef: principal.sessionId,
        eveningEnabled: request.evening_enabled,
        expectedRevision: request.expected_revision,
        morningEnabled: request.morning_enabled,
        normalizedPayloadFingerprint: payloadFingerprint(
          "NOTIFICATION_SETTINGS_UPDATE",
          {
            evening_enabled: request.evening_enabled,
            expected_revision: request.expected_revision,
            morning_enabled: request.morning_enabled,
          },
        ),
        now: new Date(),
        requiresConsent: request.morning_enabled || request.evening_enabled,
      }),
    );
    return notificationMutation(result);
  }

  public async syncNotificationPermission(
    principal: SessionPrincipal,
    request: NotificationPermissionSyncRequest,
  ): Promise<NotificationSettingsView> {
    const observedAt = new Date(request.observed_at);
    const result = await this.#storeCall(() =>
      this.store.syncNotificationPermission({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        deviceRef: principal.sessionId,
        normalizedPayloadFingerprint: payloadFingerprint(
          "NOTIFICATION_PERMISSION_SYNC",
          {
            observed_at: request.observed_at,
            observed_permission: request.observed_permission,
          },
        ),
        now: new Date(),
        observedAt,
        observedPermission: request.observed_permission,
      }),
    );
    return notificationMutation(result);
  }

  #assertCurrentNotice(noticeVersion: string): void {
    if (noticeVersion !== CURRENT_NECESSARY_CONSENT_NOTICE_VERSION) {
      throw new ApiException({
        code: "VALIDATION_FAILED",
        details: {
          fields: [
            { field: "notice_version", reason: "CURRENT_VERSION_REQUIRED" },
          ],
        },
      });
    }
  }

  #profileMutation(result: StoreMutation<StoredProfileView>): ProfileView {
    if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
      return this.#profileView(result.value);
    }
    throw mutationException(
      result,
      result.current === undefined
        ? undefined
        : this.#profileView(result.current),
    );
  }

  #profileView(stored: StoredProfileView): ProfileView {
    return {
      expression_style: stored.expressionStyle,
      onboarding_completed: stored.onboardingCompleted,
      ...(stored.preferredName === undefined
        ? {}
        : { preferred_name: this.#revealName(stored.preferredName) }),
      revision: stored.revision,
      updated_at: stored.updatedAt.toISOString(),
    };
  }

  #protectName(value: string) {
    try {
      return this.codec.protect(value);
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }

  #revealName(value: Parameters<PreferredNameCodec["reveal"]>[0]): string {
    try {
      return this.codec.reveal(value);
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }

  async #storeCall<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }
}

function commandReceipt<T>(
  commandRef: string,
  operation: string,
  result: StoreMutation<T>,
): CommandReceiptView {
  if (result.status !== "ACCEPTED" && result.status !== "DUPLICATE") {
    throw mutationException(result);
  }
  return {
    command_ref: commandRef,
    operation,
    outcome: result.status,
  };
}

function memoryMutation(
  result: StoreMutation<StoredMemoryPreferencesView>,
): MemoryPreferencesView {
  if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
    return memoryView(result.value);
  }
  throw mutationException(
    result,
    result.current === undefined ? undefined : memoryView(result.current),
  );
}

function memoryView(
  stored: StoredMemoryPreferencesView,
): MemoryPreferencesView {
  return {
    daily_use_enabled: stored.dailyUseEnabled,
    master_enabled: stored.masterEnabled,
    revision: stored.revision,
    updated_at: stored.updatedAt.toISOString(),
    weekly_use_enabled: stored.weeklyUseEnabled,
  };
}

function notificationMutation(
  result: StoreMutation<StoredNotificationSettingsView>,
): NotificationSettingsView {
  if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
    return notificationView(result.value);
  }
  throw mutationException(
    result,
    result.current === undefined ? undefined : notificationView(result.current),
  );
}

function notificationView(
  stored: StoredNotificationSettingsView,
): NotificationSettingsView {
  return {
    evening_enabled: stored.eveningEnabled,
    morning_enabled: stored.morningEnabled,
    observed_permission: stored.observedPermission,
    revision: stored.revision,
    updated_at: stored.updatedAt.toISOString(),
  };
}

function mutationException(
  result: Exclude<
    StoreMutation<unknown>,
    { readonly status: "ACCEPTED" | "DUPLICATE" }
  >,
  current?: ProfileView | MemoryPreferencesView | NotificationSettingsView,
): ApiException {
  if (result.status === "IDEMPOTENCY_CONFLICT") {
    return new ApiException({ code: "IDEMPOTENCY_CONFLICT" });
  }
  if (result.status === "CONSENT_REQUIRED") {
    return new ApiException({ code: "CONSENT_REQUIRED" });
  }
  if (result.status === "ONBOARDING_REQUIRED") {
    return new ApiException({ code: "ONBOARDING_REQUIRED" });
  }
  if (result.status === "ACCOUNT_BLOCKED") {
    return new ApiException({ code: "ACCOUNT_RESTRICTED" });
  }
  return new ApiException({
    code: "REVISION_CONFLICT",
    ...(current === undefined
      ? {}
      : { details: { current, current_revision: current.revision } }),
  });
}

function payloadFingerprint(operation: string, payload: unknown): Buffer {
  return createHash("sha256")
    .update(JSON.stringify({ operation, payload }), "utf8")
    .digest();
}
