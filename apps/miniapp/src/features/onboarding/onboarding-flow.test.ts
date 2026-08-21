import { describe, expect, it } from "vitest";

import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C003Api,
  type ProfileEnvelope,
  type SafetyView,
  type SessionEnvelope,
} from "../../services/miniapp-api.js";
import {
  createCommandRef,
  normalizePreferredName,
  OnboardingCoordinator,
  OnboardingInputError,
} from "./onboarding-flow.js";

function storage(): StoragePort {
  const values = new Map<string, StorageValue>();
  return {
    get: async (key) => values.get(key),
    remove: async (key) => {
      values.delete(key);
    },
    set: async (key, value) => {
      values.set(key, value);
    },
  };
}

function session(
  overrides: Partial<SessionEnvelope["session"]> = {},
): SessionEnvelope {
  return {
    productDate: "2026-08-21",
    session: {
      account_state: "ACTIVE",
      consent_required: true,
      expires_at: "2026-09-20T00:00:00.000Z",
      onboarding_required: true,
      refresh_after: "2026-09-05T00:00:00.000Z",
      session_token: "s".repeat(43),
      ...overrides,
    },
  };
}

function profile(
  onboardingCompleted: boolean,
  preferredName?: string,
): ProfileEnvelope {
  return {
    productDate: "2026-08-21",
    profile: {
      expression_style: "GENTLE",
      onboarding_completed: onboardingCompleted,
      ...(preferredName === undefined ? {} : { preferred_name: preferredName }),
      revision: 1,
      updated_at: "2026-08-21T00:00:00.000Z",
    },
  };
}

function incompleteProfile(): never {
  throw new MiniappApiError("ONBOARDING_REQUIRED", 403, false);
}

function api(overrides: Partial<C003Api> = {}): C003Api {
  return {
    acceptConsent: async ({ commandRef }) => ({
      command_ref: commandRef,
      operation: "CONSENT_ACCEPT",
      outcome: "ACCEPTED",
    }),
    completeOnboarding: async ({ preferredName }) =>
      profile(true, preferredName),
    createSession: async () => session(),
    getConsent: async () => ({
      consent: { notice_version: "notice-v1", state: "MISSING" },
      productDate: "2026-08-21",
    }),
    getProfile: async () => incompleteProfile(),
    ...overrides,
  };
}

function coordinator(apiPort: C003Api, refs: string[] = []) {
  let sequence = 0;
  return new OnboardingCoordinator(
    { login: async () => ({ code: "wechat-code" }) },
    storage(),
    apiPort,
    "scope-one",
    () => 1_000,
    (prefix) => refs[sequence++] ?? `${prefix}-command-${sequence}`,
  );
}

describe("C-003 onboarding coordinator", () => {
  it("requires explicit current consent before entering onboarding", async () => {
    let accepted = false;
    const calls: string[] = [];
    const flow = coordinator(
      api({
        acceptConsent: async ({ commandRef }) => {
          calls.push(commandRef);
          accepted = true;
          return {
            command_ref: commandRef,
            operation: "CONSENT_ACCEPT",
            outcome: "ACCEPTED",
          };
        },
        getConsent: async () => ({
          consent: {
            notice_version: "notice-v1",
            state: accepted ? "ACCEPTED" : "MISSING",
          },
          productDate: "2026-08-21",
        }),
      }),
      ["consent-command-one"],
    );

    await expect(flow.start("xiaohongshu")).resolves.toEqual({
      kind: "landing",
    });
    await expect(flow.acceptConsent()).resolves.toEqual({ kind: "onboarding" });
    expect(calls).toEqual(["consent-command-one"]);
  });

  it("allows an empty preferred name and routes only after authoritative completion", async () => {
    const writes: Array<Parameters<C003Api["completeOnboarding"]>[0]> = [];
    const flow = coordinator(
      api({
        completeOnboarding: async (input) => {
          writes.push(input);
          return profile(true);
        },
        getConsent: async () => ({
          consent: { notice_version: "notice-v1", state: "ACCEPTED" },
          productDate: "2026-08-21",
        }),
      }),
      ["onboarding-command-one"],
    );
    await expect(flow.start()).resolves.toEqual({ kind: "onboarding" });
    await expect(
      flow.completeOnboarding({
        expressionStyle: "BALANCED",
        preferredName: "   ",
      }),
    ).resolves.toEqual({ kind: "checkin" });
    expect(writes).toEqual([
      {
        commandRef: "onboarding-command-one",
        expressionStyle: "BALANCED",
      },
    ]);
  });

  it("recovers an unknown outcome with the same command and original payload", async () => {
    const writes: Array<Parameters<C003Api["completeOnboarding"]>[0]> = [];
    let attempt = 0;
    const flow = coordinator(
      api({
        completeOnboarding: async (input) => {
          writes.push(input);
          attempt += 1;
          if (attempt === 1) {
            throw new MiniappPlatformError("NETWORK_FAILED");
          }
          return profile(true, input.preferredName);
        },
        getConsent: async () => ({
          consent: { notice_version: "notice-v1", state: "ACCEPTED" },
          productDate: "2026-08-21",
        }),
      }),
      ["onboarding-command-one"],
    );
    await flow.start();
    await expect(
      flow.completeOnboarding({
        expressionStyle: "GENTLE",
        preferredName: "小晨",
      }),
    ).resolves.toEqual({ kind: "recovery", reasonCode: "NETWORK_FAILED" });

    await flow.saveDraft({
      expressionStyle: "CLEAR_DIRECT",
      preferredName: "被修改的称呼",
    });
    await expect(
      flow.completeOnboarding({
        expressionStyle: "CLEAR_DIRECT",
        preferredName: "被修改的称呼",
      }),
    ).resolves.toEqual({ kind: "checkin" });
    expect(writes).toEqual([
      {
        commandRef: "onboarding-command-one",
        expressionStyle: "GENTLE",
        preferredName: "小晨",
      },
      {
        commandRef: "onboarding-command-one",
        expressionStyle: "GENTLE",
        preferredName: "小晨",
      },
    ]);
  });

  it("clears and stops an old-date draft before onboarding is written", async () => {
    let consentReads = 0;
    const writes: Array<Parameters<C003Api["completeOnboarding"]>[0]> = [];
    const flow = coordinator(
      api({
        completeOnboarding: async (input) => {
          writes.push(input);
          return profile(true, input.preferredName);
        },
        getConsent: async () => {
          consentReads += 1;
          return {
            consent: { notice_version: "notice-v1", state: "ACCEPTED" },
            productDate: consentReads === 1 ? "2026-08-21" : "2026-08-22",
          };
        },
      }),
      ["onboarding-command-one"],
    );

    await expect(flow.start()).resolves.toEqual({ kind: "onboarding" });
    await flow.saveDraft({
      expressionStyle: "GENTLE",
      preferredName: "不应跨日提交",
    });
    await expect(
      flow.completeOnboarding({
        expressionStyle: "GENTLE",
        preferredName: "不应跨日提交",
      }),
    ).resolves.toEqual({
      kind: "onboarding",
      reasonCode: "PRODUCT_DATE_CHANGED",
    });
    await expect(flow.loadDraft()).resolves.toEqual({
      expressionStyle: "BALANCED",
    });
    expect(writes).toEqual([]);
  });

  it("routes Safety before account recovery and retains only the fixed view", async () => {
    const safetyView: SafetyView = {
      blocks: [
        {
          block_id: "direct-v1",
          copy: "请先联系现实帮助。",
          kind: "DIRECT_ACKNOWLEDGEMENT",
          resources: [],
        },
      ],
      response_bundle_version: "response-v1",
      revision: 1,
      state: "ACTIVE",
      updated_at: "2026-08-21T00:00:00.000Z",
    };
    const flow = coordinator(
      api({
        createSession: async () =>
          session({
            account_state: "DELETING",
            safety_continuation_token: "safety-continuation",
          }),
      }),
    );
    await expect(flow.start()).resolves.toEqual({
      kind: "safety",
      reasonCode: "SAFETY_CONTROL_REQUIRED",
    });

    const diverted = coordinator(
      api({
        completeOnboarding: async () => {
          throw new MiniappApiError(
            "SAFETY_OVERLAY",
            409,
            false,
            "request-one",
            safetyView,
          );
        },
        getConsent: async () => ({
          consent: { notice_version: "notice-v1", state: "ACCEPTED" },
          productDate: "2026-08-21",
        }),
      }),
    );
    await diverted.start();
    await expect(
      diverted.completeOnboarding({
        expressionStyle: "GENTLE",
        preferredName: "测试",
      }),
    ).resolves.toEqual({
      kind: "safety",
      reasonCode: "SAFETY_CONTROL_REQUIRED",
    });
    expect(diverted.getSafetyView()).toEqual(safetyView);
  });

  it("validates the optional name and creates a bounded opaque command ref", () => {
    expect(normalizePreferredName("  小晨  ")).toBe("小晨");
    expect(normalizePreferredName("  ")).toBeUndefined();
    expect(() => normalizePreferredName("a".repeat(25))).toThrow(
      OnboardingInputError,
    );
    expect(
      createCommandRef(
        "onboarding",
        () => 42,
        () => 0.5,
      ),
    ).toMatch(/^onboarding-16-[a-z0-9]{30}$/u);
  });
});
