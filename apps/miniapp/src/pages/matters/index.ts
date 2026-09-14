import { getMiniappAppContext } from "../../app/app-context.js";
import type { MatterFlowResult } from "../../features/matter/matter-flow.js";
import type { MatterView } from "../../services/miniapp-api.js";

export const MATTERS_SCREEN_ID = "MEM-001";

Page({
  data: {
    activeMatters: [] as readonly MatterView[],
    error: false,
    inactiveMatters: [] as readonly MatterView[],
    initialized: false,
    loading: true,
    offline: false,
    screenId: MATTERS_SCREEN_ID,
  },
  async onLoad() {
    wx.getNetworkType({
      success: ({ networkType }) =>
        this.setData({ offline: networkType === "none" }),
    });
    wx.onNetworkStatusChange(({ isConnected }) => {
      this.setData({ offline: !isConnected });
      if (isConnected && this.data.error) {
        void this.load();
      }
    });
    await this.load();
  },
  onShow() {
    if (this.data.initialized && !this.data.offline) {
      void this.load();
    }
  },
  onUnload() {
    wx.offNetworkStatusChange();
    this.setData({ activeMatters: [], inactiveMatters: [] });
  },
  back() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: "/pages/today/index" });
    }
  },
  addMatter() {
    if (!this.data.offline) {
      wx.navigateTo({ url: "/pages/matter-editor/index" });
    }
  },
  editMatter(event: WechatMiniprogram.TouchEvent) {
    const matterRef: unknown = event.currentTarget.dataset.matterRef;
    if (typeof matterRef === "string") {
      wx.navigateTo({
        url: `/pages/matter-editor/index?matter_ref=${encodeURIComponent(matterRef)}`,
      });
    }
  },
  async load() {
    if (this.data.offline && !this.data.initialized) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ error: false, loading: !this.data.initialized });
    await this.applyResult(await getMiniappAppContext().matters.load());
  },
  retry() {
    if (this.data.offline) {
      wx.getNetworkType({
        success: ({ networkType }) =>
          this.setData({ offline: networkType === "none" }),
      });
      return;
    }
    void this.load();
  },
  async applyResult(result: MatterFlowResult) {
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind !== "list") {
      this.setData({
        error: result.kind === "recovery",
        initialized: true,
        loading: false,
        offline: result.kind === "offline",
      });
      return;
    }
    this.setData({
      activeMatters: result.view.items.filter(
        (matter) => matter.status === "ACTIVE",
      ),
      error: false,
      inactiveMatters: result.view.items.filter(
        (matter) => matter.status !== "ACTIVE",
      ),
      initialized: true,
      loading: false,
    });
  },
});
