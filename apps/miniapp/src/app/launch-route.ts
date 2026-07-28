export const LAUNCH_SCREEN_ID = "SYS-001";
export const RECOVERY_SCREEN_ID = "SYS-003";

export type LaunchRoute =
  | {
      readonly kind: "launch";
      readonly screenId: typeof LAUNCH_SCREEN_ID;
    }
  | {
      readonly kind: "recovery";
      readonly reasonCode: "STARTUP_RECOVERY_REQUIRED";
      readonly screenId: typeof RECOVERY_SCREEN_ID;
    };

export interface LaunchRouteInput {
  readonly startupRecoveryRequired: boolean;
}

export function resolveLaunchRoute(input: LaunchRouteInput): LaunchRoute {
  if (input.startupRecoveryRequired) {
    return Object.freeze({
      kind: "recovery",
      reasonCode: "STARTUP_RECOVERY_REQUIRED",
      screenId: RECOVERY_SCREEN_ID,
    });
  }

  return Object.freeze({
    kind: "launch",
    screenId: LAUNCH_SCREEN_ID,
  });
}
