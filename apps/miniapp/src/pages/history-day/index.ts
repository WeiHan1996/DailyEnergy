import { getMiniappAppContext } from "../../app/app-context.js";
import type { DailyFlowResult } from "../../features/daily/daily-flow.js";
import type {
  CheckinView,
  HistoryDayView,
} from "../../services/miniapp-api.js";
import { isProductDate } from "../../services/miniapp-api.js";

export const HISTORY_DAY_SCREEN_ID = "REC-002";

const moodLabels: Readonly<Record<CheckinView["mood"], string>> = {
  VERY_LOW: "很低落",
  LOW: "有点低落",
  STEADY: "平稳",
  GOOD: "还不错",
  LIGHT: "很轻松",
  UNSURE: "说不准",
};
const energyLabels: Readonly<Record<CheckinView["energy"], string>> = {
  EMPTY: "快没电",
  LOW: "偏低",
  STEADY: "一般",
  HIGH: "充足",
  FULL: "很充足",
  UNSURE: "说不准",
};
const sleepLabels: Readonly<Record<CheckinView["sleep"], string>> = {
  POOR: "很差",
  LOW: "不太好",
  OKAY: "还可以",
  GOOD: "很好",
  UNSURE: "说不准",
};
const taskLabels = {
  UNMARKED: "未标记",
  INTERESTED: "想试试",
  COMPLETED: "已完成",
  SKIPPED: "今天先不做",
} as const;
const overallFeelingLabels = {
  VERY_HEAVY: "很费力",
  SOMEWHAT_HEAVY: "有点费力",
  STEADY: "平稳",
  PRETTY_GOOD: "还不错",
  LIGHT: "很轻松",
  UNSURE: "说不准",
} as const;
const helpfulnessLabels = {
  UNRATED: "未评分",
  HELPFUL: "有帮助",
  NEUTRAL: "一般",
  NOT_HELPFUL: "没帮助",
  NOT_USED: "未使用",
} as const;

Page({
  data: {
    actionReason: "",
    checkinRows: [] as ReadonlyArray<{ label: string; value: string }>,
    error: false,
    explanationText: "",
    loading: true,
    eveningFeelingLabel: "",
    eveningHelpfulnessLabel: "",
    missing: false,
    offline: false,
    productDate: "",
    screenId: HISTORY_DAY_SCREEN_ID,
    taskStatusLabel: "",
    view: undefined as HistoryDayView | undefined,
  },
  async onLoad(query: Record<string, string | undefined>) {
    const productDate = query.date ?? "";
    this.setData({ productDate });
    wx.getNetworkType({
      success: ({ networkType }) => {
        this.setData({ offline: networkType === "none" });
      },
    });
    wx.onNetworkStatusChange(({ isConnected }) => {
      this.setData({ offline: !isConnected });
      if (isConnected && (this.data.error || this.data.missing)) {
        void this.retry();
      }
    });
    if (!isProductDate(productDate)) {
      this.setData({ error: true, loading: false });
      return;
    }
    await this.applyResult(
      await getMiniappAppContext().daily.loadHistory(productDate),
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
      wx.getNetworkType({
        success: ({ networkType }) => {
          this.setData({ offline: networkType === "none" });
        },
      });
      return;
    }
    this.setData({ error: false, loading: true, missing: false });
    await this.applyResult(
      await getMiniappAppContext().daily.loadHistory(this.data.productDate),
    );
  },
  async applyResult(result: DailyFlowResult) {
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind === "missing") {
      this.setData({
        error: false,
        loading: false,
        missing: true,
        offline: false,
      });
      return;
    }
    if (result.kind !== "history") {
      this.setData({
        error: result.kind !== "offline",
        loading: false,
        missing: false,
        offline: result.kind === "offline",
      });
      return;
    }
    const checkin = result.view.checkin;
    const content = result.view.content;
    this.setData({
      actionReason: content?.primary_action.rationale ?? "",
      checkinRows:
        checkin === undefined
          ? []
          : [
              { label: "情绪", value: moodLabels[checkin.mood] },
              { label: "精力", value: energyLabels[checkin.energy] },
              { label: "睡眠", value: sleepLabels[checkin.sleep] },
            ],
      error: false,
      explanationText: content?.explanation_paragraphs.join("\n\n") ?? "",
      eveningFeelingLabel:
        result.view.evening?.feedback === undefined
          ? ""
          : overallFeelingLabels[result.view.evening.feedback.overall_feeling],
      eveningHelpfulnessLabel:
        result.view.evening === undefined
          ? ""
          : helpfulnessLabels[result.view.evening.helpfulness.rating],
      loading: false,
      missing: false,
      offline: result.offline,
      productDate: result.productDate,
      taskStatusLabel:
        result.view.interaction === undefined
          ? ""
          : taskLabels[result.view.interaction.task.status],
      view: result.view,
    });
  },
});
