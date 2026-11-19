import { MiniappPlatformError } from "../../platform/errors.js";
import {
  MiniappApiError,
  type AI010Api,
  type C003Api,
  type ProfileEnvelope,
  type StyleCalibrationChoice,
} from "../../services/miniapp-api.js";
import { createCommandRef } from "../onboarding/onboarding-flow.js";

/** CMP-001 copy: one question, five closed answers, never free text. */
export const STYLE_CALIBRATION_QUESTION = "这几天我说话的方式合适吗？";

export const STYLE_CALIBRATION_OPTIONS: readonly {
  readonly choice: StyleCalibrationChoice;
  readonly label: string;
}[] = Object.freeze([
  Object.freeze({ choice: "KEEP" as const, label: "正合适" }),
  Object.freeze({ choice: "GENTLER" as const, label: "再温柔一点" }),
  Object.freeze({ choice: "LIGHTER" as const, label: "更轻松一点" }),
  Object.freeze({ choice: "DIRECTER" as const, label: "更直接一点" }),
  Object.freeze({ choice: "LATER" as const, label: "稍后再说" }),
]);

export type StyleCalibrationResult =
  /** Saved or acknowledged; the card closes and the choice is not shown again. */
  | { readonly kind: "done"; readonly profile: ProfileEnvelope["profile"] }
  /** Network or transient failure; the same command ref is kept for retry. */
  | { readonly kind: "retry"; readonly reasonCode: string }
  /** Profile changed elsewhere; re-read happens on the next attempt. */
  | { readonly kind: "conflict" }
  /** The relationship does not yet allow calibration; nothing was changed. */
  | { readonly kind: "unavailable" }
  /** Another submission is already running. */
  | { readonly kind: "busy" };

export class StyleCalibrationCoordinator {
  #busy = false;
  #pending:
    | { readonly choice: StyleCalibrationChoice; readonly ref: string }
    | undefined;

  public constructor(
    private readonly api: AI010Api & Pick<C003Api, "getProfile">,
    private readonly commandRef: (prefix: string) => string = createCommandRef,
  ) {}

  /**
   * Submits one explicit answer. A retry of the same answer reuses its command
   * ref so a lost response cannot apply the answer twice; a different answer
   * starts a new command.
   */
  public async submit(
    choice: StyleCalibrationChoice,
  ): Promise<StyleCalibrationResult> {
    if (this.#busy) {
      return { kind: "busy" };
    }
    this.#busy = true;
    try {
      const pending =
        this.#pending?.choice === choice
          ? this.#pending
          : { choice, ref: this.commandRef("style-calibration") };
      this.#pending = pending;
      const current = await this.api.getProfile();
      const result = await this.api.submitStyleCalibration({
        choice,
        commandRef: pending.ref,
        expectedRevision: current.profile.revision,
      });
      this.#pending = undefined;
      return { kind: "done", profile: result.profile };
    } catch (error) {
      return this.#failure(error);
    } finally {
      this.#busy = false;
    }
  }

  #failure(error: unknown): StyleCalibrationResult {
    if (error instanceof MiniappApiError) {
      if (error.code === "REVISION_CONFLICT") {
        this.#pending = undefined;
        return { kind: "conflict" };
      }
      if (error.code === "STATE_PRECONDITION_FAILED") {
        this.#pending = undefined;
        return { kind: "unavailable" };
      }
      if (
        ["DEPENDENCY_UNAVAILABLE", "UPSTREAM_TRANSIENT"].includes(error.code)
      ) {
        return { kind: "retry", reasonCode: error.code };
      }
      this.#pending = undefined;
      return { kind: "retry", reasonCode: error.code };
    }
    if (error instanceof MiniappPlatformError) {
      return { kind: "retry", reasonCode: error.code };
    }
    return { kind: "retry", reasonCode: "NETWORK_FAILED" };
  }
}
