import {
  LAUNCH_SCREEN_ID,
  resolveLaunchRoute,
} from "../../app/launch-route.js";
import { getMiniappAppContext } from "../../app/app-context.js";
import { reLaunchC003Route } from "../../app/c003-navigation.js";

Page({
  data: {
    screenId: LAUNCH_SCREEN_ID,
    statusText: "正在准备今天的一分钟",
  },
  async onLoad(query: Record<string, string | undefined>) {
    const route = resolveLaunchRoute({
      startupRecoveryRequired: query.recovery === "1",
    });
    if (route.kind === "recovery") {
      wx.reLaunch({ url: "/pages/recovery/index" });
      return;
    }
    const context = getMiniappAppContext();
    reLaunchC003Route(await context.onboarding.start(query.channel));
  },
});
