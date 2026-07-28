import { RECOVERY_SCREEN_ID } from "../../app/launch-route.js";

Page({
  data: {
    reasonCode: "STARTUP_RECOVERY_REQUIRED",
    screenId: RECOVERY_SCREEN_ID,
  },
  retry() {
    wx.reLaunch({ url: "/pages/launch/index" });
  },
});
