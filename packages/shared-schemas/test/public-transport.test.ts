import {
  CheckinCorrectRequestSchema,
  CheckinSubmitRequestSchema,
  CheckinViewSchema,
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

describe("C-004 check-in transport schemas", () => {
  const command_ref = "01JABCDEFGHJKMNPQRSTVWXYZ";
  const values = {
    energy: "UNSURE" as const,
    mood: "UNSURE" as const,
    sleep: "UNSURE" as const,
  };

  it("accepts all three explicit values, including UNSURE", () => {
    expect(
      CheckinSubmitRequestSchema.safeParse({
        command_ref,
        expected_revision: 0,
        ...values,
      }).success,
    ).toBe(true);
    expect(
      CheckinCorrectRequestSchema.safeParse({
        command_ref,
        expected_revision: 1,
        ...values,
      }).success,
    ).toBe(true);
  });

  it("rejects missing, forged owner/date and invalid revision fields", () => {
    for (const input of [
      { command_ref, expected_revision: 0, mood: "STEADY", sleep: "OKAY" },
      {
        account_id: "forged-owner",
        command_ref,
        expected_revision: 0,
        product_date: "2026-08-21",
        ...values,
      },
      { command_ref, expected_revision: 1, ...values },
    ]) {
      expect(CheckinSubmitRequestSchema.safeParse(input).success).toBe(false);
    }
    expect(
      CheckinCorrectRequestSchema.safeParse({
        command_ref,
        expected_revision: 0,
        ...values,
      }).success,
    ).toBe(false);
  });

  it("keeps the check-in client view closed and date-bound", () => {
    const view = {
      checkin_ref: "11111111-1111-4111-8111-111111111111",
      energy: "STEADY" as const,
      mood: "GOOD" as const,
      product_date: "2026-08-21",
      revision: 2,
      sleep: "OKAY" as const,
      updated_at: "2026-08-21T01:00:00.000Z",
      write_window: "OPEN" as const,
    };
    expect(CheckinViewSchema.safeParse(view).success).toBe(true);
    expect(
      CheckinViewSchema.safeParse({ ...view, account_id: "internal" }).success,
    ).toBe(false);
  });
});
