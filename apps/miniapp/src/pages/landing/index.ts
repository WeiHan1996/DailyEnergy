import { getMiniappAppContext } from "../../app/app-context.js";
import { reLaunchC003Route } from "../../app/c003-navigation.js";
import type { C003Route } from "../../features/onboarding/onboarding-flow.js";

const LANDING_SCREEN_ID = "ENT-001";

function isNetworkFailure(route: C003Route): boolean {
  return route.reasonCode === "NETWORK_FAILED";
}

Page({
  data: {
    busy: false,
    consentChecked: false,
    consentExpanded: false,
    error: false,
    offline: false,
    screenId: LANDING_SCREEN_ID,
  },
  onLoad() {
    wx.getNetworkType({
      success: ({ networkType }) => {
        this.setData({ offline: networkType === "none" });
      },
    });
    wx.onNetworkStatusChange(({ isConnected }) => {
      this.setData({ error: false, offline: !isConnected });
    });
  },
  onUnload() {
    wx.offNetworkStatusChange();
  },
  begin() {
    if (this.data.offline) {
      return;
    }
    this.setData({ consentExpanded: true, error: false });
  },
  toggleConsent() {
    this.setData({ consentChecked: !this.data.consentChecked });
  },
  async confirmConsent() {
    if (!this.data.consentChecked || this.data.busy || this.data.offline) {
      return;
    }
    this.setData({ busy: true, error: false });
    const route = await getMiniappAppContext().onboarding.acceptConsent();
    if (route.kind === "landing") {
      this.setData({
        busy: false,
        error: route.reasonCode !== "WRITE_IN_PROGRESS",
      });
      return;
    }
    if (route.kind === "recovery" && isNetworkFailure(route)) {
      this.setData({ busy: false, offline: true });
      return;
    }
    reLaunchC003Route(route);
  },
  retry() {
    if (this.data.offline) {
      wx.getNetworkType({
        success: ({ networkType }) => {
          this.setData({ offline: networkType === "none" });
        },
      });
      return;
    }
    void this.confirmConsent();
  },
  showAbout() {
    wx.showModal({
      confirmText: "知道了",
      content:
        "选一选现在的状态，听一句适合今天的话，再做一件小事。整个过程大约一分钟。",
      showCancel: false,
      title: "每天一分钟的数字朋友",
    });
  },
  showPrivacy() {
    wx.showModal({
      confirmText: "知道了",
      content:
        "只收集完成当前体验所需的信息。称呼可以留空，也可以之后修改或删除。",
      showCancel: false,
      title: "隐私说明",
    });
  },
});
