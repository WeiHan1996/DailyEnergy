import { describe, expect, it } from "vitest";

import {
  STYLE_CALIBRATION_CHOICES,
  StyleCalibrationPolicyError,
  isStyleCalibrationChoice,
  isStyleCalibrationEligibleV1,
  resolveStyleCalibrationV1,
  shouldPromptStyleCalibrationV1,
  type StyleCalibrationChoice,
} from "./style-calibration.js";

describe("AI-010 style calibration policy", () => {
  it("maps each explicit answer to a bounded style and outcome", () => {
    expect(resolveStyleCalibrationV1("GENTLER", "BALANCED")).toEqual({
      changesStyle: true,
      nextStyle: "GENTLE",
      outcome: "ADJUSTED",
    });
    expect(resolveStyleCalibrationV1("LIGHTER", "BALANCED")).toEqual({
      changesStyle: true,
      nextStyle: "LIGHT_HUMOR",
      outcome: "ADJUSTED",
    });
    expect(resolveStyleCalibrationV1("DIRECTER", "GENTLE")).toEqual({
      changesStyle: true,
      nextStyle: "CLEAR_DIRECT",
      outcome: "ADJUSTED",
    });
  });

  it("never changes the stored style when the user keeps or postpones", () => {
    for (const current of [
      "BALANCED",
      "GENTLE",
      "LIGHT_HUMOR",
      "CLEAR_DIRECT",
    ] as const) {
      expect(resolveStyleCalibrationV1("KEEP", current)).toEqual({
        changesStyle: false,
        nextStyle: current,
        outcome: "KEPT",
      });
      expect(resolveStyleCalibrationV1("LATER", current)).toEqual({
        changesStyle: false,
        nextStyle: current,
        outcome: "DEFERRED",
      });
    }
  });

  it("does not create a revision when the answer equals the current style", () => {
    expect(resolveStyleCalibrationV1("GENTLER", "GENTLE")).toEqual({
      changesStyle: false,
      nextStyle: "GENTLE",
      outcome: "ADJUSTED",
    });
  });

  it("accepts only the five closed choices", () => {
    expect([...STYLE_CALIBRATION_CHOICES]).toEqual([
      "KEEP",
      "GENTLER",
      "LIGHTER",
      "DIRECTER",
      "LATER",
    ]);
    for (const value of ["", "gentle", "GENTLE", "BALANCED", 1, null]) {
      expect(isStyleCalibrationChoice(value)).toBe(false);
    }
    expect(() =>
      resolveStyleCalibrationV1("GENTLE" as StyleCalibrationChoice, "BALANCED"),
    ).toThrow(StyleCalibrationPolicyError);
  });

  it("opens only from the third encounter day", () => {
    expect([0, 1, 2].map(isStyleCalibrationEligibleV1)).toEqual([
      false,
      false,
      false,
    ]);
    expect([3, 4, 7, 30].map(isStyleCalibrationEligibleV1)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isStyleCalibrationEligibleV1(Number.NaN)).toBe(false);
    expect(isStyleCalibrationEligibleV1(-1)).toBe(false);
  });

  it("prompts once: only while the published node is still unhandled", () => {
    const prompt = (
      encounterDayCount: number,
      nodeOutcome: Parameters<
        typeof shouldPromptStyleCalibrationV1
      >[0]["nodeOutcome"],
    ) => shouldPromptStyleCalibrationV1({ encounterDayCount, nodeOutcome });
    expect(prompt(3, "PUBLISHED")).toBe(true);
    expect(prompt(2, "PUBLISHED")).toBe(false);
    expect(prompt(3, undefined)).toBe(false);
    for (const handled of ["ADJUSTED", "KEPT", "DEFERRED"] as const) {
      expect(prompt(3, handled)).toBe(false);
      expect(prompt(9, handled)).toBe(false);
    }
  });
});
