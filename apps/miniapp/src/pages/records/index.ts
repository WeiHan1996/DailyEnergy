import { getMiniappAppContext } from "../../app/app-context.js";
import type { WeeklyFlowResult } from "../../features/weekly/weekly-flow.js";
import type { WeeklyView } from "../../services/miniapp-api.js";

export const RECORDS_SCREEN_ID = "REC-001";

const METRIC_META = {
  EVENING_OVERALL: { title: "晚间整体感受" },
  MORNING_ENERGY: { title: "精力" },
  MORNING_MOOD: { title: "情绪" },
  MORNING_SLEEP: { title: "睡眠" },
} as const;

const VALUE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  EMPTY: "空",
  FULL: "很足",
  GOOD: "不错",
  HIGH: "充足",
  LIGHT: "轻松",
  LOW: "偏低",
  OKAY: "尚可",
  POOR: "较差",
  PRETTY_GOOD: "不错",
  SOMEWHAT_HEAVY: "有点沉",
  STEADY: "平稳",
  UNSURE: "说不准",
  VERY_HEAVY: "很沉",
  VERY_LOW: "很低",
});

const VALUE_LEVELS: Readonly<Record<string, number>> = Object.freeze({
  EMPTY: 0,
  FULL: 4,
  GOOD: 3,
  HIGH: 3,
  LIGHT: 4,
  LOW: 1,
  OKAY: 2,
  POOR: 0,
  PRETTY_GOOD: 3,
  SOMEWHAT_HEAVY: 1,
  STEADY: 2,
  UNSURE: 2,
  VERY_HEAVY: 0,
  VERY_LOW: 0,
});

interface ChartDayView {
  readonly date_label: string;
  readonly level_class: string;
  readonly missing: boolean;
  readonly unsure: boolean;
  readonly value_label: string;
}

interface ChartView {
  readonly days: readonly ChartDayView[];
  readonly id: string;
  readonly summary: string;
  readonly title: string;
}

interface DayRowView {
  readonly can_open: boolean;
  readonly date_label: string;
  readonly detail_text: string;
  readonly product_date: string;
  readonly state_text: string;
}

export interface RecordsViewModel {
  readonly activity_text: string;
  readonly charts: readonly ChartView[];
  readonly coverage_level: WeeklyView["coverage"]["level"];
  readonly coverage_text: string;
  readonly data_disclosure: string;
  readonly empty: boolean;
  readonly range_text: string;
  readonly rows: readonly DayRowView[];
  readonly show_charts: boolean;
  readonly show_state_notice: boolean;
  readonly state_message: string;
  readonly state_title: string;
  readonly state_tone: "info" | "warning";
  readonly summary_message: string;
  readonly summary_paragraphs: readonly string[];
  readonly summary_title: string;
}

Page({
  data: {
    error: false,
    loading: true,
    model: undefined as RecordsViewModel | undefined,
    noCacheOffline: false,
    offline: false,
    retrying: false,
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
      if (isConnected && (this.data.error || this.data.noCacheOffline)) {
        void this.retry();
      }
    });
    await this.load();
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
  goToday() {
    wx.reLaunch({ url: "/pages/today/index" });
  },
  async load() {
    await this.applyResult(await getMiniappAppContext().weekly.load());
  },
  async retry() {
    if (this.data.offline || this.data.retrying) {
      return;
    }
    this.setData({ error: false, loading: true, retrying: true });
    try {
      await this.load();
    } finally {
      this.setData({ retrying: false });
    }
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
  async applyResult(result: WeeklyFlowResult) {
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind !== "weekly") {
      this.setData({
        error: result.kind === "recovery",
        loading: false,
        model: undefined,
        noCacheOffline: result.kind === "offline",
      });
      return;
    }
    this.setData({
      error: false,
      loading: false,
      model: createRecordsViewModel(result.view),
      noCacheOffline: false,
      offline: result.offline,
    });
  },
});

export function createRecordsViewModel(view: WeeklyView): RecordsViewModel {
  const coverageText =
    view.coverage.level === "EMPTY"
      ? "这七天还没有可用记录"
      : view.coverage.level === "POINTS_ONLY"
        ? `基于 ${view.coverage.real_state_day_count} 天记录，只展示离散观察`
        : view.coverage.level === "PARTIAL"
          ? `基于 ${view.coverage.real_state_day_count} 天记录的阶段回望`
          : "七个日期都有真实状态，字段缺失仍会单独标注";
  const state = summaryState(view);
  return Object.freeze({
    activity_text: `点亮 ${view.activity.lit_day_count} 天 · 晚间反馈 ${view.coverage.evening_feedback_day_count} 天 · 建议反馈 ${view.activity.helpfulness.rated_day_count} 天`,
    charts: view.metrics.map((metric) => ({
      days: view.days.map((day) => chartDay(day, metric.id)),
      id: metric.id,
      summary: `${metric.direction_label}；基于 ${metric.observed_count} 次可用观察，${metric.unsure_count} 次说不准，${metric.missing_count} 次缺失。`,
      title: METRIC_META[metric.id].title,
    })),
    coverage_level: view.coverage.level,
    coverage_text: coverageText,
    data_disclosure: view.data_disclosure,
    empty: view.coverage.level === "EMPTY",
    range_text: `${formatDate(view.window_start_date)} - ${formatDate(view.window_end_date)}`,
    rows: view.days
      .slice()
      .reverse()
      .map((day) => ({
        can_open: day.state === "RECORDED",
        date_label: formatDate(day.product_date),
        detail_text: dayDetail(day),
        product_date: day.product_date,
        state_text:
          day.state === "MISSING"
            ? "缺失"
            : day.is_lit
              ? "已点亮"
              : "已留下状态",
      })),
    show_charts: view.coverage.level !== "EMPTY",
    show_state_notice: state.show,
    state_message: state.message,
    state_title: state.title,
    state_tone: state.tone,
    summary_message: state.summaryMessage,
    summary_paragraphs: view.summary?.paragraphs ?? [],
    summary_title: view.summary?.title ?? "七天回望",
  });
}

function chartDay(
  day: WeeklyView["days"][number],
  metricId: WeeklyView["metrics"][number]["id"],
): ChartDayView {
  const value = metricValue(day, metricId);
  if (value === undefined) {
    return {
      date_label: formatDay(day.product_date),
      level_class: "records__point--missing",
      missing: true,
      unsure: false,
      value_label: "缺失",
    };
  }
  return {
    date_label: formatDay(day.product_date),
    level_class: `records__point--level-${VALUE_LEVELS[value] ?? 2}`,
    missing: false,
    unsure: value === "UNSURE",
    value_label: VALUE_LABELS[value] ?? value,
  };
}

function metricValue(
  day: WeeklyView["days"][number],
  metricId: WeeklyView["metrics"][number]["id"],
): string | undefined {
  switch (metricId) {
    case "MORNING_MOOD":
      return day.morning?.mood;
    case "MORNING_ENERGY":
      return day.morning?.energy;
    case "MORNING_SLEEP":
      return day.morning?.sleep;
    case "EVENING_OVERALL":
      return day.evening?.overall_feeling;
  }
}

function summaryState(view: WeeklyView) {
  switch (view.summary_status) {
    case "AVAILABLE":
      return {
        message: "",
        show: false,
        summaryMessage: "",
        title: "",
        tone: "info" as const,
      };
    case "NOT_ELIGIBLE":
      return {
        message: "",
        show: false,
        summaryMessage:
          view.coverage.level === "EMPTY"
            ? "想开始时，从今天留下第一条真实记录就可以。"
            : "记录还不多，先把这些点如实放在这里，暂时不下趋势结论。",
        title: "",
        tone: "info" as const,
      };
    case "ELIGIBLE":
    case "GENERATING":
      return {
        message: "真实记录已经可读，回望文字准备好后会自动出现在这里。",
        show: true,
        summaryMessage: "总结文字正在准备，图表和计数不受影响。",
        title: "正在准备七天回望",
        tone: "info" as const,
      };
    case "INVALIDATED":
      return {
        message: "记录刚刚发生变化，旧总结已失效；重建期间只展示仍有效的事实。",
        show: true,
        summaryMessage: "正在按新的样本数重新整理，旧总结不会继续展示。",
        title: "记录正在重新整理",
        tone: "warning" as const,
      };
    case "FAILED":
      return {
        message: "总结文字暂时不可用，真实记录、图表和计数仍然保留。",
        show: true,
        summaryMessage: "稍后刷新可以重试总结，当前数据不会被替换。",
        title: "先看真实记录",
        tone: "warning" as const,
      };
  }
}

function dayDetail(day: WeeklyView["days"][number]): string {
  if (day.state === "MISSING") {
    return "没有记录，不向前补位";
  }
  const parts = [
    day.morning === undefined ? undefined : "有晨间状态",
    day.evening === undefined ? undefined : "有晚间回看",
    day.helpfulness === undefined || day.helpfulness === "UNRATED"
      ? undefined
      : "有建议反馈",
  ].filter((part): part is string => part !== undefined);
  return parts.join(" · ") || "有真实记录";
}

function formatDate(value: string): string {
  return value.replace(/-/gu, ".");
}

function formatDay(value: string): string {
  return value.slice(5).replace("-", "/");
}
