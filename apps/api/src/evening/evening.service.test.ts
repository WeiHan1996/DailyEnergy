import { createHash } from "node:crypto";

import type { EveningStore } from "@daily-energy/server-adapters/api";
import { describe, expect, it, vi } from "vitest";

import type { SessionPrincipal } from "../auth/contracts.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "../bootstrap/runtime-config.js";
import { ApiException } from "../transport/common/api-exception.js";
import {
  developmentEveningNoteCodec,
  type EveningNoteCodec,
} from "./evening-note-codec.js";
import { EveningService } from "./evening.service.js";
import type {
  EveningSafetyInputGate,
  EveningSafetyStore,
} from "./evening-safety.js";

const now = new Date("2026-08-24T12:00:00.000Z");
const principal: SessionPrincipal = {
  accountId: "11111111-1111-4111-8111-111111111111",
  accountState: "ACTIVE",
  expiresAt: new Date("2026-09-24T12:00:00.000Z"),
  sessionId: "22222222-2222-4222-8222-222222222222",
};
const base = {
  helpfulness: { rating: "UNRATED" as const, revision: 0 },
  productDate: "2026-08-24",
  resultId: "33333333-3333-4333-8333-333333333333",
  task: {
    instruction: "现在关闭一个会分散注意力的页面。",
    revision: 1,
    status: "UNMARKED" as const,
    taskId: "task.close-one-distraction.v1",
  },
  writeWindow: "OPEN" as const,
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
    DAILYENERGY_RELEASE_ID: "c012-service-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

function store(overrides: Partial<EveningStore>): EveningStore {
  return {
    close: async () => undefined,
    get: async () => ({ status: "FOUND", value: base }),
    save: async () => Promise.reject(new Error("UNEXPECTED_SAVE")),
    ...overrides,
  };
}

function service(input: {
  readonly gate?: EveningSafetyInputGate;
  readonly noteCodec?: EveningNoteCodec;
  readonly safetyStore?: EveningSafetyStore;
  readonly store: EveningStore;
}) {
  return new EveningService(
    input.store,
    input.noteCodec ?? developmentEveningNoteCodec(),
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

const request = {
  command_ref: "evening-command-0001",
  product_date: "2026-08-24",
  expected_feedback_revision: 0,
  expected_helpfulness_revision: 0,
  overall_feeling: "STEADY" as const,
  helpfulness_rating: "HELPFUL" as const,
  client_context: {
    entry_source: "TODAY_EVENING_CARD" as const,
    view_schema_version: "1.0.0",
  },
};

describe("C-012 evening service", () => {
  it("protects a CLEAR note and binds all component revisions", async () => {
    const save = vi.fn<EveningStore["save"]>(async (input) => ({
      status: "ACCEPTED",
      value: {
        ...base,
        feedback: {
          feedbackId: "44444444-4444-4444-8444-444444444444",
          firstSubmittedAt: now,
          ...(input.note === undefined ? {} : { note: input.note }),
          overallFeeling: "STEADY",
          revision: 1,
          updatedAt: now,
        },
        helpfulness: { rating: "HELPFUL", revision: 1 },
      },
    }));
    const result = await service({ store: store({ save }) }).save(principal, {
      ...request,
      note_patch: { operation: "SET", value: "今天把最难的一步拆小了。" },
    });
    expect(result.view).toMatchObject({
      availability: "EDITABLE_SUBMITTED",
      feedback: { note: "今天把最难的一步拆小了。", revision: 1 },
      helpfulness: { rating: "HELPFUL", revision: 1 },
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: principal.accountId,
        note: expect.objectContaining({ ciphertext: expect.any(Buffer) }),
        sessionId: principal.sessionId,
      }),
    );
  });

  it("diverts HIGH_RISK before ordinary store save", async () => {
    const save = vi.fn<EveningStore["save"]>();
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
    let error: unknown;
    try {
      await service({
        gate: {
          decide: async () => ({
            categoryCodes: ["SELF_HARM"],
            classifierVersion: "synthetic-classifier-v1",
            irreversibleFingerprint: Buffer.alloc(32, 1),
            outcome: "HIGH_RISK",
            policyVersion: "safety-v1",
            ruleVersion: "rules-v1",
          }),
        },
        safetyStore: { activate, close: async () => undefined },
        store: store({ save }),
      }).save(principal, {
        ...request,
        note_patch: { operation: "SET", value: "synthetic high risk" },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({ code: "SAFETY_OVERLAY" });
    expect(activate).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("fails closed when free-text classification is indeterminate", async () => {
    await expect(
      service({
        gate: { decide: async () => ({ outcome: "INDETERMINATE" }) },
        store: store({}),
      }).save(principal, {
        ...request,
        note_patch: { operation: "SET", value: "一条尚未完成审核的短记。" },
      }),
    ).rejects.toMatchObject({ code: "SAFETY_INDETERMINATE" });
  });
});
