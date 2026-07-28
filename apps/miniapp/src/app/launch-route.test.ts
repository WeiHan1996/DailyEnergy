import { describe, expect, it } from "vitest";

import {
  LAUNCH_SCREEN_ID,
  RECOVERY_SCREEN_ID,
  resolveLaunchRoute,
} from "./launch-route.js";

describe("launch route placeholder", () => {
  it("keeps normal startup in SYS-001", () => {
    expect(resolveLaunchRoute({ startupRecoveryRequired: false })).toEqual({
      kind: "launch",
      screenId: LAUNCH_SCREEN_ID,
    });
  });

  it("routes explicit startup failure to SYS-003", () => {
    expect(resolveLaunchRoute({ startupRecoveryRequired: true })).toEqual({
      kind: "recovery",
      reasonCode: "STARTUP_RECOVERY_REQUIRED",
      screenId: RECOVERY_SCREEN_ID,
    });
  });
});
