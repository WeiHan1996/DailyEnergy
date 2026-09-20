import { createHash } from "node:crypto";

import type {
  MatterStore,
  StoredMatterView,
} from "@daily-energy/server-adapters/api";
import { describe, expect, it, vi } from "vitest";

import type { SessionPrincipal } from "../auth/contracts.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "../bootstrap/runtime-config.js";
import {
  developmentMatterTitleCodec,
  type MatterTitleCodec,
} from "../data-rights/data-rights-codec.js";
import type {
  EveningSafetyInputGate,
  EveningSafetyStore,
} from "../evening/evening-safety.js";
import { ApiException } from "../transport/common/api-exception.js";
import { MatterService } from "./matter.service.js";

const now = new Date("2026-09-14T04:00:00.000Z");
const principal: SessionPrincipal = {
  accountId: "11111111-1111-4111-8111-111111111111",
  accountState: "ACTIVE",
  expiresAt: new Date("2026-10-14T04:00:00.000Z"),
  sessionId: "22222222-2222-4222-8222-222222222222",
};

function config() {
  return loadRuntimeConfig({
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_ENVIRONMENT: "CI",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "ai008-service-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

function store(overrides: Partial<MatterStore>): MatterStore {
  return {
    close: async () => undefined,
    create: async () => Promise.reject(new Error("UNEXPECTED_CREATE")),
    get: async () => ({ status: "NOT_FOUND" }),
    list: async () => ({ status: "FOUND", value: [] }),
    transition: async () => Promise.reject(new Error("UNEXPECTED_TRANSITION")),
    update: async () => Promise.reject(new Error("UNEXPECTED_UPDATE")),
    ...overrides,
  };
}

function service(input: {
  readonly codec?: MatterTitleCodec;
  readonly gate?: EveningSafetyInputGate;
  readonly safetyStore?: EveningSafetyStore;
  readonly store: MatterStore;
}) {
  return new MatterService(
    input.store,
    input.codec ?? developmentMatterTitleCodec(),
    input.gate ?? {
      decide: async ({ note }) => ({
        classifierVersion: "synthetic-classifier-v1",
        irreversibleFingerprint: createHash("sha256").update(note).digest(),
        outcome: "CLEAR",
        policyVersion: "safety-v1",
        ruleVersion: "rules-v1",
      }),
    },
    input.safetyStore ?? {
      activate: async () => Promise.reject(new Error("UNEXPECTED_SAFETY")),
      close: async () => undefined,
    },
    { now: () => now },
    config(),
  );
}

function stored(
  codec: MatterTitleCodec,
  overrides: Partial<StoredMatterView> = {},
): StoredMatterView {
  return {
    dailyUseGranted: true,
    matterRef: "33333333-3333-4333-8333-333333333333",
    revision: 1,
    state: "ACTIVE",
    targetProductDate: "2026-09-18",
    title: codec.protect("周五做项目汇报"),
    updatedAt: now,
    weeklyUseGranted: false,
    ...overrides,
  };
}

const createRequest = {
  command_ref: "matter-command-create-0001",
  daily_use_granted: true,
  target_date: "2026-09-18",
  title: "周五做项目汇报",
  weekly_use_granted: false,
} as const;

describe("AI-008 matter service", () => {
  it("checks MEM-002 Safety, encrypts the title, and binds the owner", async () => {
    const codec = developmentMatterTitleCodec();
    const create = vi.fn<MatterStore["create"]>(async (input) => ({
      status: "ACCEPTED",
      value: {
        ...stored(codec),
        dailyUseGranted: input.dailyUseGranted,
        ...(input.targetProductDate === undefined
          ? {}
          : { targetProductDate: input.targetProductDate }),
        title: input.title,
        weeklyUseGranted: input.weeklyUseGranted,
      },
    }));
    const gate = vi.fn<EveningSafetyInputGate["decide"]>(async () => ({
      classifierVersion: "synthetic-classifier-v1",
      irreversibleFingerprint: Buffer.alloc(32, 1),
      outcome: "CLEAR",
      policyVersion: "safety-v1",
      ruleVersion: "rules-v1",
    }));
    const result = await service({
      codec,
      gate: { decide: gate },
      store: store({ create }),
    }).create(principal, createRequest);
    expect(result.view).toMatchObject({
      daily_use_granted: true,
      title: createRequest.title,
      weekly_use_granted: false,
    });
    expect(gate).toHaveBeenCalledWith({
      note: createRequest.title,
      surface: "MEM-002",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: principal.accountId,
        memorySafetyProof: {
          classifierVersion: "synthetic-classifier-v1",
          irreversibleFingerprint: Buffer.alloc(32, 1),
          policyVersion: "safety-v1",
          ruleVersion: "rules-v1",
        },
        title: expect.objectContaining({ ciphertext: expect.any(Buffer) }),
      }),
    );
    expect(
      create.mock.calls[0]?.[0].normalizedPayloadFingerprint.toString("hex"),
    ).not.toContain(Buffer.from(createRequest.title).toString("hex"));
  });

  it("saves professional-boundary titles privately with both grants closed", async () => {
    const codec = developmentMatterTitleCodec();
    const create = vi.fn<MatterStore["create"]>(async (input) => ({
      status: "ACCEPTED",
      value: {
        ...stored(codec),
        dailyUseGranted: input.dailyUseGranted,
        title: input.title,
        weeklyUseGranted: input.weeklyUseGranted,
      },
    }));
    const result = await service({
      codec,
      gate: {
        decide: async () => ({
          classifierVersion: "synthetic-classifier-v1",
          irreversibleFingerprint: Buffer.alloc(32, 2),
          outcome: "PROFESSIONAL_BOUNDARY",
          policyVersion: "safety-v1",
          ruleVersion: "rules-v1",
        }),
      },
      store: store({ create }),
    }).create(principal, { ...createRequest, weekly_use_granted: true });
    expect(result.view).toMatchObject({
      daily_use_granted: false,
      weekly_use_granted: false,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ memorySafetyProof: null }),
    );
  });

  it("diverts high-risk titles before ordinary Matter persistence", async () => {
    const create = vi.fn<MatterStore["create"]>();
    const activate = vi.fn<EveningSafetyStore["activate"]>(async () => ({
      status: "ACCEPTED",
      view: {
        blocks: [
          {
            block_id: "DIRECT_ACKNOWLEDGEMENT_V1",
            copy: "这里先停止普通流程，请优先联系现实中的帮助。",
            kind: "DIRECT_ACKNOWLEDGEMENT",
            resources: [],
          },
        ],
        response_bundle_version: "safety-response-v1",
        revision: 1,
        state: "ACTIVE",
        updated_at: now.toISOString(),
      },
    }));
    await expect(
      service({
        gate: {
          decide: async () => ({
            categoryCodes: ["SELF_HARM_OR_SUICIDE"],
            classifierVersion: "synthetic-classifier-v1",
            irreversibleFingerprint: Buffer.alloc(32, 3),
            outcome: "HIGH_RISK",
            policyVersion: "safety-v1",
            ruleVersion: "rules-v1",
          }),
        },
        safetyStore: { activate, close: async () => undefined },
        store: store({ create }),
      }).create(principal, { ...createRequest, title: "synthetic high risk" }),
    ).rejects.toMatchObject({ code: "SAFETY_OVERLAY" });
    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({ surfaceCode: "MEM-002" }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the current projection when the authoritative store rejects the revision", async () => {
    const codec = developmentMatterTitleCodec();
    const current = stored(codec, { revision: 4 });
    const update = vi.fn<MatterStore["update"]>(async () => ({
      current,
      status: "REVISION_CONFLICT",
    }));
    let error: unknown;
    try {
      await service({
        codec,
        store: store({
          get: async () => ({ status: "FOUND", value: current }),
          update,
        }),
      }).update(principal, current.matterRef, {
        command_ref: "matter-command-update-0001",
        expected_revision: 3,
        title: "更新后的汇报",
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: { current_revision: 4 },
    });
    expect(update).toHaveBeenCalledOnce();
  });

  it("fails closed when the title classifier is unavailable", async () => {
    await expect(
      service({
        gate: { decide: async () => ({ outcome: "INDETERMINATE" }) },
        store: store({}),
      }).create(principal, createRequest),
    ).rejects.toMatchObject({ code: "SAFETY_INDETERMINATE" });
  });
});
