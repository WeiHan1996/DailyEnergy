import { describe, expect, it } from "vitest";

import {
  MatterPolicyError,
  effectiveMatterState,
  matterStateAfterPatch,
  transitionMatterState,
} from "./matter.js";

describe("matter-policy-v1", () => {
  it("expires dated matters after the target day and undated matters on day eight", () => {
    expect(
      effectiveMatterState(
        {
          createdProductDate: "2026-09-01",
          state: "ACTIVE",
          targetProductDate: "2026-09-07",
        },
        "2026-09-07",
      ),
    ).toBe("ACTIVE");
    expect(
      effectiveMatterState(
        {
          createdProductDate: "2026-09-01",
          state: "ACTIVE",
          targetProductDate: "2026-09-07",
        },
        "2026-09-08",
      ),
    ).toBe("EXPIRED");
    expect(
      effectiveMatterState(
        { createdProductDate: "2026-09-01", state: "ACTIVE" },
        "2026-09-07",
      ),
    ).toBe("ACTIVE");
    expect(
      effectiveMatterState(
        { createdProductDate: "2026-09-01", state: "ACTIVE" },
        "2026-09-08",
      ),
    ).toBe("EXPIRED");
  });

  it("keeps paused and completed user facts distinct from date expiry", () => {
    expect(
      effectiveMatterState(
        { createdProductDate: "2026-09-01", state: "PAUSED" },
        "2026-10-01",
      ),
    ).toBe("PAUSED");
    expect(
      effectiveMatterState(
        { createdProductDate: "2026-09-01", state: "COMPLETED" },
        "2026-10-01",
      ),
    ).toBe("COMPLETED");
  });

  it("supports explicit pause, complete, and undated reactivation", () => {
    const matter = {
      createdProductDate: "2026-09-01",
      state: "ACTIVE" as const,
    };
    expect(
      transitionMatterState({
        currentProductDate: "2026-09-02",
        matter,
        transition: "PAUSE",
      }).state,
    ).toBe("PAUSED");
    expect(
      transitionMatterState({
        currentProductDate: "2026-09-08",
        matter,
        transition: "COMPLETE",
      }).state,
    ).toBe("COMPLETED");
    expect(
      transitionMatterState({
        currentProductDate: "2026-09-08",
        matter: { ...matter, state: "EXPIRED" },
        transition: "RESUME",
      }),
    ).toEqual({ createdProductDate: "2026-09-08", state: "ACTIVE" });
  });

  it("requires a new valid date before a dated expired matter can resume", () => {
    expect(() =>
      transitionMatterState({
        currentProductDate: "2026-09-08",
        matter: {
          createdProductDate: "2026-09-01",
          state: "EXPIRED",
          targetProductDate: "2026-09-07",
        },
        transition: "RESUME",
      }),
    ).toThrowError(new MatterPolicyError("MATTER_TARGET_DATE_PAST"));
  });

  it("reactivates an expired matter only through an explicit date patch", () => {
    const matter = {
      createdProductDate: "2026-09-01",
      state: "ACTIVE" as const,
    };
    expect(
      matterStateAfterPatch({
        clearTargetDate: false,
        currentProductDate: "2026-09-08",
        matter,
      }).state,
    ).toBe("EXPIRED");
    expect(
      matterStateAfterPatch({
        clearTargetDate: true,
        currentProductDate: "2026-09-08",
        matter,
      }),
    ).toEqual({
      createdProductDate: "2026-09-08",
      state: "ACTIVE",
    });
  });
});
