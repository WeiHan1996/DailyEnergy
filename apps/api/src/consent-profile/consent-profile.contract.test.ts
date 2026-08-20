import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ConsentAcceptRequestSchema,
  MemoryPreferencesViewSchema,
  NotificationSettingsViewSchema,
  OnboardingCompleteRequestSchema,
  ProfileUpdateRequestSchema,
  ProfileViewSchema,
} from "@daily-energy/shared-schemas";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { API_ERROR_CATALOG } from "../transport/common/api-exception.js";
import { CONSENT_PROFILE_LIFECYCLE } from "./lifecycle.js";

describe("C-002 consent/profile transport contract", () => {
  const command_ref = "01JABCDEFGHJKMNPQRSTVWXYZ";

  it("rejects client owner fields and exposes closed client views", () => {
    for (const schema of [
      ConsentAcceptRequestSchema,
      OnboardingCompleteRequestSchema,
      ProfileUpdateRequestSchema,
    ]) {
      expect(
        schema.safeParse({
          account_id: "forged-owner",
          command_ref,
          expected_revision: 1,
          expression_style: "BALANCED",
          notice_version: "necessary-consent-v1",
        }).success,
      ).toBe(false);
    }

    expect(
      ProfileViewSchema.safeParse({
        account_id: "internal",
        expression_style: "BALANCED",
        onboarding_completed: true,
        revision: 1,
        updated_at: "2026-08-20T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      MemoryPreferencesViewSchema.safeParse({
        daily_use_enabled: false,
        master_enabled: false,
        revision: 1,
        updated_at: "2026-08-20T00:00:00.000Z",
        weekly_use_enabled: false,
      }).success,
    ).toBe(true);
    expect(NotificationSettingsViewSchema.keyof().options).not.toContain(
      "platform_ref",
    );
  });

  it("keeps every C-002 OpenAPI path on the authenticated closed surface", async () => {
    const document = parse(
      await readFile(
        resolve(import.meta.dirname, "../../../../openapi/openapi.yaml"),
        "utf8",
      ),
    ) as {
      paths: Record<
        string,
        Record<
          string,
          { responses: Record<string, unknown>; security?: unknown[] }
        >
      >;
      components: {
        schemas: Record<string, { additionalProperties?: boolean }>;
      };
    };
    for (const [path, method] of [
      ["/consent/current", "get"],
      ["/consent/accept", "post"],
      ["/consent/withdraw", "post"],
      ["/profile", "get"],
      ["/onboarding/complete", "post"],
      ["/profile/update", "post"],
      ["/profile/style-calibration", "post"],
      ["/memory/preferences", "get"],
      ["/memory/preferences", "post"],
      ["/notifications/settings", "get"],
      ["/notifications/settings", "post"],
      ["/notifications/permission-sync", "post"],
    ] as const) {
      const operation = document.paths[path]?.[method];
      expect(operation?.security).toEqual([{ userBearerAuth: [] }]);
      expect(operation?.responses["200"]).toBeDefined();
      expect(operation?.responses["401"]).toBeDefined();
      expect(operation?.responses["403"]).toBeDefined();
    }
    for (const schemaName of [
      "ConsentView",
      "ProfileView",
      "MemoryPreferencesView",
      "NotificationSettingsView",
    ]) {
      expect(
        document.components.schemas[schemaName]?.additionalProperties,
      ).toBe(false);
    }
  });

  it("registers withdrawal/export/deletion deadlines without claiming worker completion", () => {
    expect(CONSENT_PROFILE_LIFECYCLE.consent).toMatchObject({
      replacedReceiptDeadline: "P6M",
      withdrawalEffect: "BLOCK_ORDINARY_WRITES_IMMEDIATELY",
    });
    expect(CONSENT_PROFILE_LIFECYCLE.profile).toMatchObject({
      preferredNameReplacementDeadline: "PT72H",
      structuredRevisionReplacementDeadline: "P30D",
    });
    expect(CONSENT_PROFILE_LIFECYCLE.notifications).toMatchObject({
      default: "OFF",
      permissionIsConsent: false,
    });
    expect(API_ERROR_CATALOG.REVISION_CONFLICT.status).toBe(409);
    expect(API_ERROR_CATALOG.IDEMPOTENCY_CONFLICT.status).toBe(409);
    expect(API_ERROR_CATALOG.CONSENT_REQUIRED.status).toBe(403);
  });
});
