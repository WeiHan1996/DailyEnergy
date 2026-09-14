import {
  addProductDateDays,
  parseProductDate,
} from "../../product-time/public/index.js";

export const MATTER_POLICY_VERSION = "matter-policy-v1" as const;

export type MatterState =
  "ACTIVE" | "PAUSED" | "COMPLETED" | "EXPIRED" | "DELETED";

export type MatterTransition = "PAUSE" | "RESUME" | "COMPLETE";

export class MatterPolicyError extends Error {
  public constructor(
    public readonly code:
      "MATTER_STATE_PRECONDITION" | "MATTER_TARGET_DATE_PAST",
  ) {
    super(code);
    this.name = "MatterPolicyError";
  }
}

export interface MatterLifecycleSnapshot {
  readonly createdProductDate: string;
  readonly state: MatterState;
  readonly targetProductDate?: string;
}

export function effectiveMatterState(
  matter: MatterLifecycleSnapshot,
  currentProductDate: string,
): MatterState {
  const current = parseProductDate(currentProductDate);
  const created = parseProductDate(matter.createdProductDate);
  const target =
    matter.targetProductDate === undefined
      ? undefined
      : parseProductDate(matter.targetProductDate);
  if (matter.state !== "ACTIVE") {
    return matter.state;
  }
  if (target !== undefined) {
    return target < current ? "EXPIRED" : "ACTIVE";
  }
  return current >= addProductDateDays(created, 7) ? "EXPIRED" : "ACTIVE";
}

export function assertMatterTargetDate(
  targetProductDate: string | undefined,
  currentProductDate: string,
): void {
  if (
    targetProductDate !== undefined &&
    parseProductDate(targetProductDate) < parseProductDate(currentProductDate)
  ) {
    throw new MatterPolicyError("MATTER_TARGET_DATE_PAST");
  }
}

export function transitionMatterState(input: {
  readonly currentProductDate: string;
  readonly matter: MatterLifecycleSnapshot;
  readonly transition: MatterTransition;
}): {
  readonly createdProductDate: string;
  readonly state: Exclude<MatterState, "DELETED">;
} {
  const state = effectiveMatterState(input.matter, input.currentProductDate);
  if (state === "DELETED") {
    throw new MatterPolicyError("MATTER_STATE_PRECONDITION");
  }
  if (input.transition === "PAUSE") {
    if (state !== "ACTIVE") {
      throw new MatterPolicyError("MATTER_STATE_PRECONDITION");
    }
    return {
      createdProductDate: input.matter.createdProductDate,
      state: "PAUSED",
    };
  }
  if (input.transition === "COMPLETE") {
    if (!["ACTIVE", "PAUSED", "EXPIRED"].includes(state)) {
      throw new MatterPolicyError("MATTER_STATE_PRECONDITION");
    }
    return {
      createdProductDate: input.matter.createdProductDate,
      state: "COMPLETED",
    };
  }
  if (!["PAUSED", "COMPLETED", "EXPIRED"].includes(state)) {
    throw new MatterPolicyError("MATTER_STATE_PRECONDITION");
  }
  assertMatterTargetDate(
    input.matter.targetProductDate,
    input.currentProductDate,
  );
  return {
    createdProductDate:
      input.matter.targetProductDate === undefined
        ? input.currentProductDate
        : input.matter.createdProductDate,
    state: "ACTIVE",
  };
}

export function matterStateAfterPatch(input: {
  readonly clearTargetDate: boolean;
  readonly currentProductDate: string;
  readonly matter: MatterLifecycleSnapshot;
  readonly targetProductDate?: string;
}): {
  readonly createdProductDate: string;
  readonly state: Exclude<MatterState, "DELETED">;
  readonly targetProductDate?: string;
} {
  const nextTarget = input.clearTargetDate
    ? undefined
    : (input.targetProductDate ?? input.matter.targetProductDate);
  if (input.targetProductDate !== undefined || input.clearTargetDate) {
    assertMatterTargetDate(nextTarget, input.currentProductDate);
  }
  const effective = effectiveMatterState(
    input.matter,
    input.currentProductDate,
  );
  if (effective === "DELETED") {
    throw new MatterPolicyError("MATTER_STATE_PRECONDITION");
  }
  const reactivatesExpired =
    effective === "EXPIRED" &&
    (input.targetProductDate !== undefined || input.clearTargetDate);
  return {
    createdProductDate:
      reactivatesExpired && nextTarget === undefined
        ? input.currentProductDate
        : input.matter.createdProductDate,
    state: reactivatesExpired ? "ACTIVE" : effective,
    ...(nextTarget === undefined ? {} : { targetProductDate: nextTarget }),
  };
}
