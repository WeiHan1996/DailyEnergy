import { describe, expect, it, vi } from "vitest";

import {
  DataRightsStoreError,
  type DataRightsStore,
  type StoredDataExportSource,
} from "@daily-energy/server-adapters/api";
import type { DataTaskView } from "@daily-energy/shared-schemas";

import type { AuthService } from "../auth/auth.service.js";
import type { SessionPrincipal } from "../auth/contracts.js";
import { DataRightsService } from "./data-rights.service.js";

const now = new Date("2026-08-25T12:00:00.000Z");
const principal: SessionPrincipal = {
  accountId: "10000000-0000-4000-8000-000000000001",
  accountState: "ACTIVE",
  expiresAt: new Date("2026-09-25T12:00:00.000Z"),
  sessionId: "10000000-0000-4000-8000-000000000002",
};
const task: DataTaskView = {
  can_cancel: false,
  created_at: now.toISOString(),
  kind: "DELETE",
  revision: 1,
  scope: "DAY",
  status: "PENDING",
  target_summary: "2026-08-24 日记录",
  task_ref: "10000000-0000-4000-8000-000000000003",
  updated_at: now.toISOString(),
};

function service(
  storeOverrides: Partial<DataRightsStore> = {},
  codecOverrides: {
    readonly note?: string;
  } = {},
) {
  const store = {
    close: async () => undefined,
    deleteDay: vi.fn(async () => task),
    ...storeOverrides,
  } as unknown as DataRightsStore;
  const auth = {
    reverifyWechatIdentity: vi.fn(async () => ({
      keyVersion: "synthetic-v1",
      providerCode: "WECHAT_MINIAPP",
      subjectCiphertext: Buffer.from("ciphertext"),
      subjectLookupToken: Buffer.from("lookup"),
    })),
  } as unknown as AuthService;
  return {
    api: new DataRightsService(
      store,
      { issue: () => "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG" },
      { protect: vi.fn(), reveal: vi.fn(() => "小能") },
      {
        protect: vi.fn(),
        reveal: vi.fn(() => codecOverrides.note ?? "今天保持真实。"),
      },
      { reveal: vi.fn(() => "准备发布的事项") },
      { now: () => now },
      auth,
    ),
    auth,
    store,
  };
}

describe("C-014 data-rights service", () => {
  it("binds a DAY deletion to the session owner and server time", async () => {
    const fixture = service();
    await expect(
      fixture.api.deleteDay(principal, {
        command_ref: "delete-day-command-0001",
        confirmation_version: "data-rights-day-v1",
        confirmed: true,
        expected_revision: 2,
        scope: "DAY",
        target: { product_date: "2026-08-24" },
      }),
    ).resolves.toMatchObject({
      resolution: { now, productDate: "2026-08-25" },
      view: task,
    });
    expect(fixture.store.deleteDay).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: principal.accountId,
        expectedRevision: 2,
        now,
        productDate: "2026-08-24",
      }),
    );
    expect(
      JSON.stringify(
        (fixture.store.deleteDay as ReturnType<typeof vi.fn>).mock.calls,
      ),
    ).not.toMatch(/sessionId|token|openid/iu);
  });

  it("maps closed store conflicts without exposing database details", async () => {
    const fixture = service({
      deleteDay: async () =>
        Promise.reject(new DataRightsStoreError("REVISION_CONFLICT")),
    });
    await expect(
      fixture.api.deleteDay(principal, {
        command_ref: "delete-day-command-0002",
        confirmation_version: "data-rights-day-v1",
        confirmed: true,
        expected_revision: 1,
        scope: "DAY",
        target: { product_date: "2026-08-24" },
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("passes only the protected lookup token into challenge verification", async () => {
    const verifyIdentity = vi.fn(async () => ({
      confirmation_challenge_ref: "10000000-0000-4000-8000-000000000004",
      expires_at: "2026-08-25T12:05:00.000Z",
      identity_verification_ref: "10000000-0000-4000-8000-000000000005",
    }));
    const fixture = service({ verifyIdentity });
    await fixture.api.verifyIdentity(principal, {
      command_ref: "reauth-command-0001",
      confirmation_challenge_ref: "10000000-0000-4000-8000-000000000004",
      wechat_code: "one-time-code",
    });
    expect(verifyIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: principal.accountId,
        subjectLookupToken: Buffer.from("lookup"),
      }),
    );
    expect(JSON.stringify(verifyIdentity.mock.calls)).not.toMatch(
      /one-time-code|ciphertext|openid/iu,
    );
  });

  it("serializes a READY export deterministically without an envelope", async () => {
    const source: StoredDataExportSource = {
      consentSummary: {
        notice_version: "necessary-consent-v1",
        state: "MISSING",
      },
      dataTaskSummaries: [],
      days: [],
      matters: [],
      notificationPreferences: { items: [] },
    };
    const readExportArtifact = vi.fn(async () => ({
      readyAt: now,
      source,
      status: "READY" as const,
    }));
    const fixture = service({ readExportArtifact });
    const first = await fixture.api.downloadExport(
      principal,
      "10000000-0000-4000-8000-000000000006",
      "10000000-0000-4000-8000-000000000007",
    );
    const second = await fixture.api.downloadExport(
      principal,
      "10000000-0000-4000-8000-000000000006",
      "10000000-0000-4000-8000-000000000007",
    );
    expect(first.body).toBe(second.body);
    expect(first.byteLength).toBe(Buffer.byteLength(first.body, "utf8"));
    expect(JSON.parse(first.body)).toMatchObject({
      generated_at: now.toISOString(),
      schema_version: "data-export-v1",
    });
    expect(first.body).not.toMatch(
      /prompt|provider|epoch|source_fingerprint/iu,
    );
  });

  it("rejects an export above 2 MiB as a whole without truncation", async () => {
    const protectedNote = {
      ciphertext: Buffer.alloc(32, 1),
      keyVersion: "synthetic-note-v1",
    };
    const source: StoredDataExportSource = {
      consentSummary: {
        notice_version: "necessary-consent-v1",
        state: "MISSING",
      },
      dataTaskSummaries: [],
      days: Array.from({ length: 10_000 }, () => ({
        checkin: {
          energy: "STEADY" as const,
          mood: "STEADY" as const,
          revision: 1,
          sleep: "OKAY" as const,
          updated_at: now.toISOString(),
        },
        evening: {
          note: protectedNote,
          overall_feeling: "STEADY" as const,
          revision: 1,
          updated_at: now.toISOString(),
        },
        product_date: "2026-08-24",
      })),
      matters: [],
      notificationPreferences: { items: [] },
    };
    const fixture = service(
      {
        readExportArtifact: async () => ({
          readyAt: now,
          source,
          status: "READY",
        }),
      },
      { note: "x".repeat(80) },
    );
    await expect(
      fixture.api.downloadExport(
        principal,
        "10000000-0000-4000-8000-000000000006",
        "10000000-0000-4000-8000-000000000007",
      ),
    ).rejects.toMatchObject({ code: "EXPORT_TOO_LARGE" });
  });
});
