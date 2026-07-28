import {
  LAUNCH_SCREEN_ID,
  resolveLaunchRoute,
} from "../../app/launch-route.js";
import { parsePublicBuildConfig } from "../../app/public-build-config.js";
import { PUBLIC_BUILD_CONFIG } from "../../generated/public-build-config.js";

const publicConfig = parsePublicBuildConfig(PUBLIC_BUILD_CONFIG);

Page({
  data: {
    environment: publicConfig.environment,
    screenId: LAUNCH_SCREEN_ID,
    statusText: "正在准备今天的一分钟",
  },
  onLoad(query: Record<string, string | undefined>) {
    const route = resolveLaunchRoute({
      startupRecoveryRequired: query.recovery === "1",
    });
    if (route.kind === "recovery") {
      wx.reLaunch({ url: "/pages/recovery/index" });
    }
  },
});
