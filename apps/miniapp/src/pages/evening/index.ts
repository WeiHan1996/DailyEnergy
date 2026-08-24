import { getMiniappAppContext } from "../../app/app-context.js";
import type {
  EveningFlowResult,
  EveningNoticeCode,
} from "../../features/evening/evening-flow.js";
import type { EveningView } from "../../services/miniapp-api.js";

export const EVENING_SCREEN_ID = "EVE-001";

const overallOptions = Object.freeze([
  { label: "很费力", value: "VERY_HEAVY" },
  { label: "有点费力", value: "SOMEWHAT_HEAVY" },
  { label: "平稳", value: "STEADY" },
  { label: "还不错", value: "PRETTY_GOOD" },
  { label: "很轻松", value: "LIGHT" },
  { label: "说不准", value: "UNSURE" },
]);
const helpfulnessOptions = Object.freeze([
  { label: "有帮助", value: "HELPFUL" },
  { label: "一般", value: "NEUTRAL" },
  { label: "没帮助", value: "NOT_HELPFUL" },
  { label: "未使用", value: "NOT_USED" },
]);
const taskOptions = Object.freeze([
  { label: "还没决定", value: "UNMARKED" },
  { label: "想试试", value: "INTERESTED" },
  { label: "已完成", value: "COMPLETED" },
  { label: "今天先不做", value: "SKIPPED" },
]);

Page({
  data: {
    busy: false,
    error: false,
    fieldError: "",
    helpfulnessOptions,
    helpfulnessRating: "",
    loading: true,
    note: "",
    noteTouched: false,
    notice: "",
    noticeAction: "",
    offline: false,
    overallFeeling: "",
    overallOptions,
    screenId: EVENING_SCREEN_ID,
    taskOptions,
    taskStatus: "",
    view: undefined as EveningView | undefined,
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
    await this.applyResult(await getMiniappAppContext().evening.load());
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
  chooseOverall(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ fieldError: "", overallFeeling: event.detail.value });
  },
  chooseHelpfulness(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ fieldError: "", helpfulnessRating: event.detail.value });
  },
  chooseTask(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ taskStatus: event.detail.value });
  },
  inputNote(event: WechatMiniprogram.Input) {
    this.setData({ note: event.detail.value, noteTouched: true });
  },
  async save() {
    const view = this.data.view;
    if (
      view === undefined ||
      this.data.busy ||
      this.data.offline ||
      view.primary_action === "READ_ONLY"
    ) {
      return;
    }
    if (!this.data.overallFeeling || !this.data.helpfulnessRating) {
      this.setData({ fieldError: "请选择整体感受和建议帮助度。" });
      return;
    }
    this.setData({ busy: true, fieldError: "", notice: "" });
    await this.applyResult(
      await getMiniappAppContext().evening.save(view, {
        helpfulnessRating: this.data
          .helpfulnessRating as EveningView["options"]["helpfulness"][number],
        note: this.data.note,
        noteTouched: this.data.noteTouched,
        overallFeeling: this.data
          .overallFeeling as EveningView["options"]["overall_feeling"][number],
        ...(this.data.taskStatus
          ? {
              taskStatus: this.data
                .taskStatus as EveningView["options"]["task_status"][number],
            }
          : {}),
      }),
    );
    this.setData({ busy: false });
  },
  async retry() {
    if (this.data.busy || this.data.offline) {
      return;
    }
    this.setData({ busy: true, error: false });
    await this.applyResult(await getMiniappAppContext().evening.retry());
    this.setData({ busy: false });
  },
  async applyResult(result: EveningFlowResult) {
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind !== "evening") {
      const hasView = this.data.view !== undefined;
      this.setData({
        error: result.kind !== "offline",
        loading: false,
        ...(hasView
          ? {
              notice:
                result.kind === "offline"
                  ? "当前离线，内容没有保存。恢复网络后请主动确认。"
                  : "暂时无法安全处理这次提交，整份记录都没有保存。可以稍后重试，或清空可选短句后再主动保存。",
              noticeAction: "重试",
            }
          : {}),
        offline: result.kind === "offline",
      });
      return;
    }
    const presentation = noticePresentation(result.noticeCode);
    this.setData({
      error: false,
      helpfulnessRating:
        result.view.helpfulness.rating === "UNRATED"
          ? ""
          : result.view.helpfulness.rating,
      loading: false,
      note: result.view.feedback?.note ?? "",
      noteTouched: false,
      notice: presentation.notice,
      noticeAction: presentation.action,
      offline: result.offline,
      overallFeeling: result.view.feedback?.overall_feeling ?? "",
      taskStatus: result.view.task?.status ?? "",
      view: result.view,
    });
  },
});

function noticePresentation(code: EveningNoticeCode | undefined) {
  switch (code) {
    case "EVENING_SAVED":
      return { action: "", notice: "今天的真实记录已经留下了。" };
    case "EVENING_CONFLICT":
      return { action: "", notice: "记录已在别处更新，已显示最新内容。" };
    case "EVENING_OUTCOME_PENDING":
      return {
        action: "确认状态",
        notice: "刚才的保存结果还不确定。确认时会继续同一个请求。",
      };
    case "EVENING_WINDOW_CLOSED":
      return { action: "", notice: "这一天现在只能查看，不能再修改。" };
    default:
      return { action: "", notice: "" };
  }
}
