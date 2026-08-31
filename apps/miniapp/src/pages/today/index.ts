import { getMiniappAppContext } from "../../app/app-context.js";
import type { DailyFlowResult } from "../../features/daily/daily-flow.js";
import type { TodayView } from "../../services/miniapp-api.js";

export const TODAY_SCREEN_ID = "DLY-003";

Page({
  data: {
    error: false,
    actionReason: "",
    expanded: false,
    explanationText: "",
    focus: undefined as TodayView["content"]["dimensions"][number] | undefined,
    loading: true,
    offline: false,
    otherDimensions: [] as TodayView["content"]["dimensions"],
    screenId: TODAY_SCREEN_ID,
    view: undefined as TodayView | undefined,
  },
  async onLoad() {
    wx.getNetworkType({
      success: ({ networkType }) => {
        this.setData({ offline: networkType === "none" });
      },
    });
    wx.onNetworkStatusChange(({ isConnected }) => {
      this.setData({ offline: !isConnected });
      if (isConnected && this.data.error) {
        void this.retry();
      }
    });
    await this.applyResult(await getMiniappAppContext().daily.loadToday());
  },
  onUnload() {
    wx.offNetworkStatusChange();
  },
  async retry() {
    if (this.data.offline) {
      wx.getNetworkType({
        success: ({ networkType }) => {
          this.setData({ offline: networkType === "none" });
        },
      });
      return;
    }
    this.setData({ error: false, loading: this.data.view === undefined });
    await this.applyResult(await getMiniappAppContext().daily.loadToday());
  },
  toggleDimensions() {
    this.setData({ expanded: !this.data.expanded });
  },
  showAction() {
    wx.pageScrollTo({
      duration: 160,
      selector: "#today-action",
    });
  },
  async applyResult(result: DailyFlowResult) {
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind === "waiting") {
      wx.reLaunch({ url: "/pages/generation/index" });
      return;
    }
    if (result.kind !== "today") {
      this.setData({
        error: result.kind !== "offline",
        loading: false,
        offline: result.kind === "offline",
      });
      return;
    }
    const focus = result.view.content.dimensions[0];
    this.setData({
      error: false,
      actionReason: result.view.content.primary_action.rationale ?? "",
      explanationText: result.view.content.explanation_paragraphs.join("\n\n"),
      focus,
      loading: false,
      offline: result.offline,
      otherDimensions: result.view.content.dimensions.slice(1),
      view: result.view,
    });
  },
});
