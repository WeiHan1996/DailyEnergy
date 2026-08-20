import {
  ConsentAcceptRequestSchema,
  MemoryPreferencesUpdateRequestSchema,
  NotificationPermissionSyncRequestSchema,
  OnboardingCompleteRequestSchema,
  ProfileUpdateRequestSchema,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("C-002 public transport schemas", () => {
  const command_ref = "01JABCDEFGHJKMNPQRSTVWXYZ";

  it("accepts only the consent/profile allowlist and rejects owner injection", () => {
    expect(
      ConsentAcceptRequestSchema.safeParse({
        command_ref,
        notice_version: "necessary-consent-v1",
      }).success,
    ).toBe(true);
    expect(
      OnboardingCompleteRequestSchema.safeParse({
        command_ref,
        expression_style: "GENTLE",
      }).success,
    ).toBe(true);
    for (const forbidden of [
      "account_id",
      "owner_id",
      "openid",
      "birth_date",
    ]) {
      expect(
        OnboardingCompleteRequestSchema.safeParse({
          command_ref,
          expression_style: "BALANCED",
          [forbidden]: "forged",
        }).success,
      ).toBe(false);
    }
  });

  it("keeps preferred name optional and rejects ambiguous or empty profile patches", () => {
    expect(
      OnboardingCompleteRequestSchema.safeParse({
        command_ref,
        expression_style: "CLEAR_DIRECT",
      }).success,
    ).toBe(true);
    expect(
      ProfileUpdateRequestSchema.safeParse({
        command_ref,
        expected_revision: 1,
      }).success,
    ).toBe(false);
    expect(
      ProfileUpdateRequestSchema.safeParse({
        clear_preferred_name: true,
        command_ref,
        expected_revision: 1,
        preferred_name: "小晨",
      }).success,
    ).toBe(false);
  });

  it("requires closed, complete preference commands and an RFC3339 observation", () => {
    expect(
      MemoryPreferencesUpdateRequestSchema.safeParse({
        command_ref,
        daily_use_enabled: false,
        expected_revision: 1,
        master_enabled: false,
        weekly_use_enabled: false,
      }).success,
    ).toBe(true);
    expect(
      NotificationPermissionSyncRequestSchema.safeParse({
        command_ref,
        observed_at: "2026-08-20T12:00:00+08:00",
        observed_permission: "GRANTED",
      }).success,
    ).toBe(true);
    expect(
      NotificationPermissionSyncRequestSchema.safeParse({
        account_id: "forged",
        command_ref,
        observed_at: "not-a-date",
        observed_permission: "GRANTED",
      }).success,
    ).toBe(false);
  });
});
