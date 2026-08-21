import { RECOVERY_SCREEN_ID } from "../../app/launch-route.js";

Page({
  data: {
    reasonCode: "STARTUP_RECOVERY_REQUIRED",
    screenId: RECOVERY_SCREEN_ID,
  },
  onLoad(query: Record<string, string | undefined>) {
    this.setData({
      reasonCode: query.reason ?? "STARTUP_RECOVERY_REQUIRED",
    });
  },
  retry() {
    wx.reLaunch({ url: "/pages/launch/index" });
  },
});
