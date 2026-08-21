import type { C003Route } from "../features/onboarding/onboarding-flow.js";

export function c003RouteUrl(route: C003Route): string {
  const path =
    route.kind === "landing"
      ? "/pages/landing/index"
      : route.kind === "onboarding"
        ? "/pages/onboarding/index"
        : route.kind === "checkin"
          ? "/pages/checkin-handoff/index"
          : route.kind === "safety"
            ? "/pages/safety/index"
            : "/pages/recovery/index";
  return route.reasonCode === undefined
    ? path
    : `${path}?reason=${encodeURIComponent(route.reasonCode)}`;
}

export function reLaunchC003Route(route: C003Route): void {
  wx.reLaunch({ url: c003RouteUrl(route) });
}
