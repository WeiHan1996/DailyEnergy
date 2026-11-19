import {
  StyleCalibrationChoiceValues,
  type ExpressionStyle,
  type StyleCalibrationChoice,
} from "@daily-energy/shared-schemas";

export const STYLE_CALIBRATION_POLICY_VERSION =
  "style-calibration-policy-v1" as const;

/** The calibration question becomes available from the third encounter day. */
export const STYLE_CALIBRATION_MIN_ENCOUNTER_DAYS = 3;

export const STYLE_CALIBRATION_NODE_CODE =
  "STYLE_CALIBRATION_AVAILABLE" as const;

/**
 * Closed, explicit answers to "这几天我说话的方式合适吗". Nothing else — not
 * helpfulness, mood, dwell time or channel — may change the expression style.
 */
export const STYLE_CALIBRATION_CHOICES = Object.freeze([
  ...StyleCalibrationChoiceValues,
] as const);

export type { StyleCalibrationChoice };

export type StyleCalibrationOutcome = "ADJUSTED" | "DEFERRED" | "KEPT";

/** `PUBLISHED` is the only node receipt state that may prompt automatically. */
export type StyleCalibrationNodeOutcome =
  StyleCalibrationOutcome | "PUBLISHED" | undefined;

export interface StyleCalibrationResolution {
  readonly changesStyle: boolean;
  readonly nextStyle: ExpressionStyle;
  readonly outcome: StyleCalibrationOutcome;
}

const STYLE_BY_CHOICE: Readonly<
  Record<"DIRECTER" | "GENTLER" | "LIGHTER", ExpressionStyle>
> = Object.freeze({
  DIRECTER: "CLEAR_DIRECT",
  GENTLER: "GENTLE",
  LIGHTER: "LIGHT_HUMOR",
});

export class StyleCalibrationPolicyError extends Error {
  public constructor(public readonly code: "STYLE_CALIBRATION_CHOICE_INVALID") {
    super(code);
    this.name = "StyleCalibrationPolicyError";
  }
}

export function isStyleCalibrationChoice(
  value: unknown,
): value is StyleCalibrationChoice {
  return (
    typeof value === "string" &&
    (STYLE_CALIBRATION_CHOICES as readonly string[]).includes(value)
  );
}

/**
 * Maps one explicit answer to the next style. Keeping or postponing never
 * changes the stored style, and a style that already equals the answer is not
 * a change, so no needless profile revision is created.
 */
export function resolveStyleCalibrationV1(
  choice: StyleCalibrationChoice,
  currentStyle: ExpressionStyle,
): StyleCalibrationResolution {
  if (!isStyleCalibrationChoice(choice)) {
    throw new StyleCalibrationPolicyError("STYLE_CALIBRATION_CHOICE_INVALID");
  }
  if (choice === "KEEP") {
    return Object.freeze({
      changesStyle: false,
      nextStyle: currentStyle,
      outcome: "KEPT",
    });
  }
  if (choice === "LATER") {
    return Object.freeze({
      changesStyle: false,
      nextStyle: currentStyle,
      outcome: "DEFERRED",
    });
  }
  const nextStyle = STYLE_BY_CHOICE[choice];
  return Object.freeze({
    changesStyle: nextStyle !== currentStyle,
    nextStyle,
    outcome: "ADJUSTED",
  });
}

export function isStyleCalibrationEligibleV1(
  encounterDayCount: number,
): boolean {
  return (
    Number.isSafeInteger(encounterDayCount) &&
    encounterDayCount >= STYLE_CALIBRATION_MIN_ENCOUNTER_DAYS
  );
}

/**
 * The automatic prompt appears once, right after the node is published. Once
 * any outcome is recorded, or when no receipt exists, only the explicit
 * SET-002 entry remains; it never re-prompts on its own.
 */
export function shouldPromptStyleCalibrationV1(input: {
  readonly encounterDayCount: number;
  readonly nodeOutcome: StyleCalibrationNodeOutcome;
}): boolean {
  return (
    isStyleCalibrationEligibleV1(input.encounterDayCount) &&
    input.nodeOutcome === "PUBLISHED"
  );
}
