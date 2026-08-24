import { getMiniappAppContext } from "../../app/app-context.js";
import type {
  DailyFlowResult,
  DailyNoticeCode,
} from "../../features/daily/daily-flow.js";
import type { TodayView } from "../../services/miniapp-api.js";

export const TODAY_SCREEN_ID = "DLY-003";

let actionObserver: WechatMiniprogram.IntersectionObserver | undefined;

const taskOptions = Object.freeze([
  { label: "还没决定", value: "UNMARKED" },
  { label: "想试试", value: "INTERESTED" },
  { label: "已完成", value: "COMPLETED" },
  { label: "今天先不做", value: "SKIPPED" },
]);

Page({
  data: {
    error: false,
    actionReason: "",
    expanded: false,
    explanationText: "",
    focus: undefined as TodayView["content"]["dimensions"][number] | undefined,
    loading: true,
    lightBusy: false,
    lightEligible: false,
    lightNotice: "",
    lightNoticeAction: "",
    lightPending: false,
    lightReadOnly: false,
    offline: false,
    otherDimensions: [] as TodayView["content"]["dimensions"],
    screenId: TODAY_SCREEN_ID,
    taskBusy: false,
    taskError: "",
    taskNotice: "",
    taskNoticeAction: "",
    taskOptions,
    taskPending: false,
    taskReadOnly: false,
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
    actionObserver?.disconnect();
    actionObserver = undefined;
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
  observePrimaryAction() {
    if (actionObserver !== undefined || this.data.view?.interaction.is_lit) {
      return;
    }
    actionObserver = this.createIntersectionObserver({ thresholds: [0.8] });
    actionObserver
      .relativeToViewport()
      .observe("#today-action", ({ intersectionRatio }) => {
        if (intersectionRatio >= 0.8) {
          this.setData({ lightEligible: true });
          actionObserver?.disconnect();
          actionObserver = undefined;
        }
      });
  },
  async lightDay() {
    const view = this.data.view;
    if (
      view === undefined ||
      view.interaction.is_lit ||
      !this.data.lightEligible ||
      this.data.offline ||
      this.data.lightBusy ||
      this.data.lightPending ||
      this.data.lightReadOnly ||
      this.data.taskPending
    ) {
      return;
    }
    this.setData({ lightBusy: true, lightNotice: "" });
    await this.applyResult(
      await getMiniappAppContext().daily.lightDay({
        productDate: view.interaction.product_date,
        resultRef: view.interaction.result_id,
      }),
    );
    this.setData({ lightBusy: false });
  },
  async retryLight() {
    if (this.data.offline || this.data.lightBusy) {
      return;
    }
    this.setData({ lightBusy: true });
    await this.applyResult(await getMiniappAppContext().daily.retryLight());
    this.setData({ lightBusy: false });
  },
  openRecords() {
    wx.navigateTo({ url: "/pages/records/index" });
  },
  async updateTask(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const view = this.data.view;
    const status = event.detail.value;
    if (
      view === undefined ||
      this.data.offline ||
      this.data.taskBusy ||
      this.data.lightPending ||
      this.data.taskPending ||
      this.data.taskReadOnly ||
      !["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"].includes(status)
    ) {
      return;
    }
    this.setData({ taskBusy: true, taskError: "", taskNotice: "" });
    await this.applyResult(
      await getMiniappAppContext().daily.updateTask({
        expectedRevision: view.interaction.task.revision,
        productDate: view.interaction.product_date,
        status: status as TodayView["interaction"]["task"]["status"],
        taskRef: view.interaction.task.task_id,
      }),
    );
    this.setData({ taskBusy: false });
  },
  async retryTask() {
    if (this.data.taskBusy) {
      return;
    }
    this.setData({ taskBusy: true, taskError: "" });
    await this.applyResult(await getMiniappAppContext().daily.retryTask());
    this.setData({ taskBusy: false });
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
    const taskState = taskPresentation(result.noticeCode);
    const lightState = lightPresentation(result.noticeCode);
    this.setData(
      {
        error: false,
        actionReason: result.view.content.primary_action.rationale ?? "",
        explanationText:
          result.view.content.explanation_paragraphs.join("\n\n"),
        focus,
        loading: false,
        lightNotice: lightState.notice,
        lightNoticeAction: lightState.action,
        lightPending: lightState.pending,
        lightReadOnly: lightState.readOnly,
        offline: result.offline,
        otherDimensions: result.view.content.dimensions.slice(1),
        taskError: taskState.error,
        taskNotice: taskState.notice,
        taskNoticeAction: taskState.action,
        taskPending: taskState.pending,
        taskReadOnly: taskState.readOnly,
        view: result.view,
      },
      () => this.observePrimaryAction(),
    );
  },
});

function lightPresentation(noticeCode: DailyNoticeCode | undefined) {
  switch (noticeCode) {
    case "LIGHT_CONFIRMED":
      return {
        action: "",
        notice: "今天已点亮。任务是否完成不会改变这份记录。",
        pending: false,
        readOnly: false,
      };
    case "LIGHT_OUTCOME_PENDING":
      return {
        action: "确认状态",
        notice: "刚才的点亮结果还不确定。确认时会继续同一个请求。",
        pending: true,
        readOnly: false,
      };
    case "LIGHT_WINDOW_CLOSED":
      return {
        action: "",
        notice: "新的一天已经开始，这一天现在只读。",
        pending: false,
        readOnly: true,
      };
    default:
      return { action: "", notice: "", pending: false, readOnly: false };
  }
}

function taskPresentation(noticeCode: DailyNoticeCode | undefined) {
  switch (noticeCode) {
    case "TASK_CONFLICT":
      return {
        action: "",
        error: "状态已在别处更新，已显示最新结果。请确认后再选择。",
        notice: "",
        pending: false,
        readOnly: false,
      };
    case "TASK_OUTCOME_PENDING":
      return {
        action: "确认状态",
        error: "",
        notice: "刚才的选择可能已经保存。确认后会继续同一个请求。",
        pending: true,
        readOnly: false,
      };
    case "TASK_UPDATED":
      return {
        action: "",
        error: "",
        notice: "已保存。之后仍可以在允许时间内修改。",
        pending: false,
        readOnly: false,
      };
    case "TASK_WINDOW_CLOSED":
      return {
        action: "",
        error: "",
        notice: "新的一天已经开始，这一天的任务状态现在只读。",
        pending: false,
        readOnly: true,
      };
    default:
      return {
        action: "",
        error: "",
        notice: "",
        pending: false,
        readOnly: false,
      };
  }
}
