import type {
  ConsentProfileStore,
  StoredProfileView,
} from "@daily-energy/server-adapters/api";
import { describe, expect, it, vi } from "vitest";

import type { SessionPrincipal } from "../auth/contracts.js";
import { ApiException } from "../transport/common/api-exception.js";
import { ConsentProfileService } from "./consent-profile.service.js";
import { developmentPreferredNameCodec } from "./preferred-name-codec.js";

const principal: SessionPrincipal = {
  accountId: "11111111-1111-4111-8111-111111111111",
  accountState: "ACTIVE",
  expiresAt: new Date("2026-09-20T00:00:00.000Z"),
  sessionId: "22222222-2222-4222-8222-222222222222",
};
const command_ref = "01JABCDEFGHJKMNPQRSTVWXYZ";
const now = new Date("2026-08-20T00:00:00.000Z");

function unavailable(): Promise<never> {
  return Promise.reject(new Error("UNEXPECTED_STORE_CALL"));
}

function fakeStore(
  overrides: Partial<ConsentProfileStore>,
): ConsentProfileStore {
  return {
    acceptConsent: unavailable,
    close: async () => undefined,
    completeOnboarding: unavailable,
    getConsent: unavailable,
    getMemoryPreferences: unavailable,
    getNotificationSettings: unavailable,
    getProfile: unavailable,
    syncNotificationPermission: unavailable,
    updateMemoryPreferences: unavailable,
    updateNotificationSettings: unavailable,
    updateProfile: unavailable,
    withdrawConsent: unavailable,
    ...overrides,
  };
}

function profile(revision = 1): StoredProfileView {
  return {
    expressionStyle: "BALANCED",
    onboardingCompleted: true,
    revision,
    updatedAt: now,
  };
}

describe("C-002 consent/profile application service", () => {
  it("binds consent writes to SessionPrincipal and rejects a stale notice version", async () => {
    const acceptConsent = vi.fn<ConsentProfileStore["acceptConsent"]>(
      async () => ({
        status: "ACCEPTED",
        value: {
          acceptedAt: now,
          noticeVersion: "necessary-consent-v1",
          state: "ACCEPTED",
        },
      }),
    );
    const service = new ConsentProfileService(
      fakeStore({ acceptConsent }),
      developmentPreferredNameCodec(),
    );

    await expect(
      service.acceptConsent(principal, {
        command_ref,
        notice_version: "retired-notice-v0",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(acceptConsent).not.toHaveBeenCalled();

    await expect(
      service.acceptConsent(principal, {
        command_ref,
        notice_version: "necessary-consent-v1",
      }),
    ).resolves.toMatchObject({ outcome: "ACCEPTED" });
    expect(acceptConsent).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: principal.accountId }),
    );
    expect(JSON.stringify(acceptConsent.mock.calls[0]?.[0])).not.toContain(
      "owner_id",
    );
  });

  it("keeps preferred name optional and returns a decryptable allowlisted profile", async () => {
    const codec = developmentPreferredNameCodec();
    const completeOnboarding = vi.fn<ConsentProfileStore["completeOnboarding"]>(
      async (input) => ({
        status: "ACCEPTED",
        value: {
          expressionStyle: input.expressionStyle,
          onboardingCompleted: true,
          ...(input.preferredName === undefined
            ? {}
            : { preferredName: input.preferredName }),
          revision: 1,
          updatedAt: now,
        },
      }),
    );
    const service = new ConsentProfileService(
      fakeStore({ completeOnboarding }),
      codec,
    );

    await expect(
      service.completeOnboarding(principal, {
        command_ref,
        expression_style: "GENTLE",
      }),
    ).resolves.toMatchObject({
      expression_style: "GENTLE",
      onboarding_completed: true,
      revision: 1,
    });
    expect(completeOnboarding.mock.calls[0]?.[0].preferredName).toBeUndefined();

    await expect(
      service.completeOnboarding(principal, {
        command_ref: `${command_ref}-2`,
        expression_style: "BALANCED",
        preferred_name: "小晨",
      }),
    ).resolves.toMatchObject({ preferred_name: "小晨" });
    expect(
      completeOnboarding.mock.calls[1]?.[0].preferredName?.ciphertext.toString(
        "utf8",
      ),
    ).not.toContain("小晨");
  });

  it("projects a CAS conflict with only the current client view", async () => {
    const service = new ConsentProfileService(
      fakeStore({
        updateProfile: async () => ({
          current: profile(2),
          status: "REVISION_CONFLICT",
        }),
      }),
      developmentPreferredNameCodec(),
    );

    let error: unknown;
    try {
      await service.updateProfile(principal, {
        command_ref,
        expected_revision: 1,
        expression_style: "CLEAR_DIRECT",
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: {
        current: { revision: 2 },
        current_revision: 2,
      },
    });
    expect(JSON.stringify(error)).not.toMatch(/account|cipher|keyVersion/iu);
  });

  it("treats optional enablement as consent-gated and permission as observation only", async () => {
    const updateMemoryPreferences = vi.fn<
      ConsentProfileStore["updateMemoryPreferences"]
    >(async (input) => ({
      status: "ACCEPTED",
      value: {
        dailyUseEnabled: input.dailyUseEnabled,
        masterEnabled: input.masterEnabled,
        revision: 2,
        updatedAt: now,
        weeklyUseEnabled: input.weeklyUseEnabled,
      },
    }));
    const syncNotificationPermission = vi.fn<
      ConsentProfileStore["syncNotificationPermission"]
    >(async (input) => ({
      status: "ACCEPTED",
      value: {
        eveningEnabled: false,
        morningEnabled: false,
        observedPermission: input.observedPermission,
        revision: 1,
        updatedAt: now,
      },
    }));
    const service = new ConsentProfileService(
      fakeStore({ updateMemoryPreferences, syncNotificationPermission }),
      developmentPreferredNameCodec(),
    );

    await service.updateMemoryPreferences(principal, {
      command_ref,
      daily_use_enabled: true,
      expected_revision: 1,
      master_enabled: true,
      weekly_use_enabled: false,
    });
    expect(updateMemoryPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ requiresConsent: true }),
    );

    await expect(
      service.syncNotificationPermission(principal, {
        command_ref: `${command_ref}-3`,
        observed_at: now.toISOString(),
        observed_permission: "GRANTED",
      }),
    ).resolves.toMatchObject({
      evening_enabled: false,
      morning_enabled: false,
      observed_permission: "GRANTED",
    });
    expect(syncNotificationPermission).toHaveBeenCalledWith(
      expect.objectContaining({ deviceRef: principal.sessionId }),
    );
  });
});
