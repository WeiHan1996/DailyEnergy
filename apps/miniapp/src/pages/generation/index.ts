import { getMiniappAppContext } from "../../app/app-context.js";
import type { DailyFlowResult } from "../../features/daily/daily-flow.js";

export const GENERATION_SCREEN_ID = "DLY-002";

let pollTimer: number | undefined;
let leaveTimer: number | undefined;

Page({
  data: {
    canLeave: false,
    error: false,
    fallback: false,
    loading: true,
    offline: false,
    productDate: "",
    screenId: GENERATION_SCREEN_ID,
    statusLabel: "正在准备",
  },
  async onLoad(query: Record<string, string | undefined>) {
    wx.getNetworkType({
      success: ({ networkType }) => {
        this.setData({ offline: networkType === "none" });
      },
    });
    wx.onNetworkStatusChange(({ isConnected }) => {
      this.setData({ error: false, offline: !isConnected });
      if (isConnected) {
        void this.retry();
      }
    });
    leaveTimer = setTimeout(() => {
      this.setData({ canLeave: true });
    }, 3_000) as unknown as number;
    const revision = Number(query.checkinRevision);
    await this.applyResult(
      await getMiniappAppContext().daily.beginGeneration(
        Number.isInteger(revision) && revision > 0 ? revision : undefined,
      ),
    );
  },
  onUnload() {
    this.clearTimers();
    wx.offNetworkStatusChange();
  },
  clearTimers() {
    if (pollTimer !== undefined) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
    if (leaveTimer !== undefined) {
      clearTimeout(leaveTimer);
      leaveTimer = undefined;
    }
  },
  schedulePoll(seconds: number) {
    if (pollTimer !== undefined) {
      clearTimeout(pollTimer);
    }
    pollTimer = setTimeout(() => {
      void this.poll();
    }, seconds * 1_000) as unknown as number;
  },
  async poll() {
    await this.applyResult(
      await getMiniappAppContext().daily.refreshGeneration(),
    );
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
    this.setData({ error: false, loading: true });
    await this.poll();
  },
  leave() {
    wx.exitMiniProgram({});
  },
  async applyResult(result: DailyFlowResult) {
    if (result.kind === "today") {
      this.clearTimers();
      wx.reLaunch({ url: "/pages/today/index" });
      return;
    }
    if (result.kind === "safety") {
      this.clearTimers();
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind === "waiting") {
      const fallback = result.intent.status === "FALLBACK_RUNNING";
      this.setData({
        error: false,
        fallback,
        loading: false,
        offline: false,
        productDate: result.productDate,
        statusLabel: fallback ? "正在完成" : "正在准备",
      });
      this.schedulePoll(result.retryAfterSeconds);
      return;
    }
    if (result.kind === "offline") {
      this.setData({
        error: false,
        loading: false,
        offline: true,
      });
      return;
    }
    this.setData({
      error: true,
      loading: false,
      offline: false,
    });
  },
});
