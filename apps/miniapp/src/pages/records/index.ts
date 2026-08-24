import { getMiniappAppContext } from "../../app/app-context.js";
import type { DailyFlowResult } from "../../features/daily/daily-flow.js";
import type { HistoryListView } from "../../services/miniapp-api.js";

export const RECORDS_SCREEN_ID = "REC-001";

type RecordRow = HistoryListView["items"][number] & {
  readonly status_text: string;
};

Page({
  data: {
    error: false,
    items: [] as readonly RecordRow[],
    loading: true,
    offline: false,
    screenId: RECORDS_SCREEN_ID,
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
    await this.applyResult(
      await getMiniappAppContext().daily.loadHistoryList(),
    );
  },
  onUnload() {
    wx.offNetworkStatusChange();
  },
  back() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.reLaunch({ url: "/pages/today/index" });
  },
  async retry() {
    if (this.data.offline) {
      return;
    }
    this.setData({ error: false, loading: true });
    await this.applyResult(
      await getMiniappAppContext().daily.loadHistoryList(),
    );
  },
  openDay(event: WechatMiniprogram.TouchEvent) {
    const date = event.currentTarget.dataset.date;
    const canOpen = event.currentTarget.dataset.canOpen;
    if (typeof date === "string" && (canOpen === true || canOpen === "true")) {
      wx.navigateTo({
        url: `/pages/history-day/index?date=${encodeURIComponent(date)}`,
      });
    }
  },
  applyResult(result: DailyFlowResult) {
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind !== "records") {
      this.setData({
        error: result.kind !== "offline",
        loading: false,
        offline: result.kind === "offline",
      });
      return;
    }
    this.setData({
      error: false,
      items: result.view.items.map((item) => ({
        ...item,
        status_text:
          item.state === "MISSING"
            ? "没有记录"
            : item.is_lit
              ? "已点亮"
              : item.has_result
                ? "已留下内容"
                : "已留下状态",
      })),
      loading: false,
      offline: result.offline,
    });
  },
});
