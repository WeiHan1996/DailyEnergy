import { describe, expect, it, vi } from "vitest";

import { MiniappPlatformError } from "../../platform/errors.js";
import {
  MiniappApiError,
  type AI010Api,
  type C003Api,
  type ProfileEnvelope,
} from "../../services/miniapp-api.js";
import {
  STYLE_CALIBRATION_OPTIONS,
  StyleCalibrationCoordinator,
} from "./style-calibration-flow.js";

function envelope(revision: number, style = "BALANCED"): ProfileEnvelope {
  return {
    productDate: "2026-11-12",
    profile: {
      expression_style: style,
      onboarding_completed: true,
      revision,
      updated_at: "2026-11-12T04:00:00.000Z",
    },
  } as ProfileEnvelope;
}

function build(submit: AI010Api["submitStyleCalibration"]) {
  const getProfile = vi.fn<C003Api["getProfile"]>(async () => envelope(3));
  const refs: string[] = [];
  let counter = 0;
  const coordinator = new StyleCalibrationCoordinator(
    { getProfile, submitStyleCalibration: submit },
    (prefix) => {
      counter += 1;
      const ref = `${prefix}-${counter}`;
      refs.push(ref);
      return ref;
    },
  );
  return { coordinator, getProfile, refs };
}

describe("AI-010 CMP-001 style calibration flow", () => {
  it("offers exactly the five closed answers in the Accepted order", () => {
    expect(STYLE_CALIBRATION_OPTIONS.map((option) => option.label)).toEqual([
      "正合适",
      "再温柔一点",
      "更轻松一点",
      "更直接一点",
      "稍后再说",
    ]);
    expect(STYLE_CALIBRATION_OPTIONS.map((option) => option.choice)).toEqual([
      "KEEP",
      "GENTLER",
      "LIGHTER",
      "DIRECTER",
      "LATER",
    ]);
  });

  it("reads the current revision and submits the closed choice", async () => {
    const submit = vi.fn<AI010Api["submitStyleCalibration"]>(async () =>
      envelope(4, "GENTLE"),
    );
    const { coordinator, getProfile } = build(submit);
    const result = await coordinator.submit("GENTLER");
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      choice: "GENTLER",
      commandRef: "style-calibration-1",
      expectedRevision: 3,
    });
    expect(result).toMatchObject({
      kind: "done",
      profile: { expression_style: "GENTLE", revision: 4 },
    });
  });

  it("reuses the command ref when the same answer is retried after a network failure", async () => {
    const submit = vi
      .fn<AI010Api["submitStyleCalibration"]>()
      .mockRejectedValueOnce(new MiniappPlatformError("NETWORK_REQUEST_FAILED"))
      .mockResolvedValueOnce(envelope(4));
    const { coordinator, refs } = build(submit);
    expect(await coordinator.submit("KEEP")).toMatchObject({ kind: "retry" });
    expect(await coordinator.submit("KEEP")).toMatchObject({ kind: "done" });
    expect(submit.mock.calls.map((call) => call[0].commandRef)).toEqual([
      "style-calibration-1",
      "style-calibration-1",
    ]);
    expect(refs).toHaveLength(1);
  });

  it("starts a new command when the user changes the answer", async () => {
    const submit = vi
      .fn<AI010Api["submitStyleCalibration"]>()
      .mockRejectedValueOnce(
        new MiniappApiError("DEPENDENCY_UNAVAILABLE", 503, true),
      )
      .mockResolvedValueOnce(envelope(4));
    const { coordinator } = build(submit);
    await coordinator.submit("LATER");
    await coordinator.submit("LIGHTER");
    expect(submit.mock.calls.map((call) => call[0].commandRef)).toEqual([
      "style-calibration-1",
      "style-calibration-2",
    ]);
  });

  it("maps stale revision and ineligibility to calm, terminal results", async () => {
    const conflict = build(async () => {
      throw new MiniappApiError("REVISION_CONFLICT", 409, false);
    });
    expect(await conflict.coordinator.submit("KEEP")).toEqual({
      kind: "conflict",
    });
    const unavailable = build(async () => {
      throw new MiniappApiError("STATE_PRECONDITION_FAILED", 422, false);
    });
    expect(await unavailable.coordinator.submit("GENTLER")).toEqual({
      kind: "unavailable",
    });
  });

  it("rejects a second submission while one is running", async () => {
    let release: (value: ProfileEnvelope) => void = () => undefined;
    const submit = vi.fn<AI010Api["submitStyleCalibration"]>(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { coordinator } = build(submit);
    const first = coordinator.submit("KEEP");
    await Promise.resolve();
    await Promise.resolve();
    expect(await coordinator.submit("KEEP")).toEqual({ kind: "busy" });
    release(envelope(3));
    expect(await first).toMatchObject({ kind: "done" });
  });
});
