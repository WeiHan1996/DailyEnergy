import { getMiniappAppContext } from "../../app/app-context.js";
import {
  MatterInputError,
  normalizeMatterTitle,
  type MatterFlowResult,
} from "../../features/matter/matter-flow.js";
import type { MatterView } from "../../services/miniapp-api.js";

export const MATTER_EDITOR_SCREEN_ID = "MEM-002";

Page({
  data: {
    busy: false,
    confirmDeleteOpen: false,
    dailyUseGranted: false,
    error: false,
    hasDate: false,
    inputError: "",
    loading: true,
    matter: undefined as MatterView | undefined,
    matterRef: "",
    minDate: "",
    notice: "",
    offline: false,
    screenId: MATTER_EDITOR_SCREEN_ID,
    targetDate: "",
    title: "",
    titleCount: 0,
    weeklyUseGranted: false,
  },
  async onLoad(options: Record<string, string | undefined>) {
    this.setData({ matterRef: options.matter_ref ?? "" });
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
  onUnload() {
    wx.offNetworkStatusChange();
    this.setData({ matter: undefined, title: "" });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  },
  inputTitle(event: WechatMiniprogram.Input) {
    const title = event.detail.value;
    const titleCount = Array.from(title).length;
    this.setData({
      inputError: titleCount > 80 ? "事项请保持在 80 个字以内。" : "",
      title,
      titleCount,
    });
  },
  chooseDate(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ hasDate: true, targetDate: event.detail.value });
  },
  clearDate() {
    this.setData({ hasDate: false, targetDate: "" });
  },
  toggleDailyUse(event: WechatMiniprogram.SwitchChange) {
    this.setData({ dailyUseGranted: event.detail.value });
  },
  async load() {
    if (this.data.offline) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ error: false, loading: true });
    const result = await getMiniappAppContext().matters.load();
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind !== "list") {
      this.setData({
        error: result.kind === "recovery",
        loading: false,
        offline: result.kind === "offline",
      });
      return;
    }
    const matter = result.view.items.find(
      (item) => item.matter_ref === this.data.matterRef,
    );
    if (this.data.matterRef && matter === undefined) {
      this.setData({
        error: true,
        loading: false,
        minDate: result.productDate,
      });
      return;
    }
    this.setData({
      dailyUseGranted: matter?.daily_use_granted ?? false,
      hasDate: matter?.target_date !== undefined,
      loading: false,
      matter,
      minDate: result.productDate,
      targetDate: matter?.target_date ?? "",
      title: matter?.title ?? "",
      titleCount: Array.from(matter?.title ?? "").length,
      weeklyUseGranted: matter?.weekly_use_granted ?? false,
    });
  },
  async save() {
    if (this.data.busy || this.data.offline) {
      return;
    }
    let title: string;
    try {
      title = normalizeMatterTitle(this.data.title);
    } catch (error) {
      this.setData({
        inputError:
          error instanceof MatterInputError &&
          error.code === "MATTER_TITLE_TOO_LONG"
            ? "事项请保持在 80 个字以内。"
            : "请填写一件简短、单行的事项。",
      });
      return;
    }
    this.setData({ busy: true, error: false, inputError: "", notice: "" });
    await this.applyResult(
      await getMiniappAppContext().matters.save(this.data.matter, {
        dailyUseGranted: this.data.dailyUseGranted,
        ...(this.data.hasDate ? { targetDate: this.data.targetDate } : {}),
        title,
        weeklyUseGranted: this.data.weeklyUseGranted,
      }),
    );
    this.setData({ busy: false });
  },
  pause() {
    void this.runTransition("pause");
  },
  resume() {
    void this.runTransition("resume");
  },
  complete() {
    void this.runTransition("complete");
  },
  async runTransition(transition: "pause" | "resume" | "complete") {
    if (this.data.busy || this.data.offline || this.data.matter === undefined) {
      return;
    }
    this.setData({ busy: true, notice: "" });
    await this.applyResult(
      await getMiniappAppContext().matters.transition(
        this.data.matter,
        transition,
      ),
    );
    this.setData({ busy: false });
  },
  openDelete() {
    if (!this.data.offline && this.data.matter !== undefined) {
      this.setData({ confirmDeleteOpen: true });
    }
  },
  closeDelete() {
    if (!this.data.busy) {
      this.setData({ confirmDeleteOpen: false });
    }
  },
  async confirmDelete() {
    if (this.data.busy || this.data.matter === undefined) {
      return;
    }
    this.setData({ busy: true });
    const result = await getMiniappAppContext().matters.delete(
      this.data.matter,
    );
    if (result.kind === "task") {
      this.setData({ confirmDeleteOpen: false, matter: undefined, title: "" });
      wx.navigateBack({ delta: 1 });
      return;
    }
    await this.applyResult(result);
    this.setData({ busy: false });
  },
  retry() {
    if (this.data.offline) {
      wx.getNetworkType({
        success: ({ networkType }) =>
          this.setData({ offline: networkType === "none" }),
      });
      return;
    }
    void getMiniappAppContext()
      .matters.retry()
      .then((result) => this.applyResult(result));
  },
  async applyResult(result: MatterFlowResult) {
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind === "matter") {
      this.setData({
        dailyUseGranted: result.view.daily_use_granted,
        error: false,
        hasDate: result.view.target_date !== undefined,
        matter: result.view,
        matterRef: result.view.matter_ref,
        notice:
          result.noticeCode === "MATTER_CONFLICT"
            ? "事项已在另一处更新，已显示最新内容。"
            : result.noticeCode === "MATTER_SAVED_PRIVATE"
              ? "事项已私有保存，未开启每日或七天内容用途。"
              : "事项已保存。",
        targetDate: result.view.target_date ?? "",
        title: result.view.title,
        titleCount: Array.from(result.view.title).length,
        weeklyUseGranted: result.view.weekly_use_granted,
      });
      return;
    }
    if (result.kind === "task") {
      this.setData({
        confirmDeleteOpen: false,
        matter: undefined,
        title: "",
      });
      wx.navigateBack({ delta: 1 });
      return;
    }
    this.setData({
      error: result.kind === "recovery",
      notice:
        result.kind === "offline" ? "连接中断，重试会继续同一次保存。" : "",
      offline: result.kind === "offline",
    });
  },
});
