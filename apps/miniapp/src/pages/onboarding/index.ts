import { getMiniappAppContext } from "../../app/app-context.js";
import { reLaunchC003Route } from "../../app/c003-navigation.js";
import {
  normalizePreferredName,
  OnboardingInputError,
  type C003Route,
} from "../../features/onboarding/onboarding-flow.js";
import {
  isExpressionStyle,
  type ExpressionStyle,
} from "../../services/miniapp-api.js";

const ONBOARDING_SCREEN_ID = "ONB-001";
let draftWrite: Promise<unknown> = Promise.resolve();

const styleOptions = Object.freeze([
  {
    example: "睡眠少了一点，今天先把最重要的那件事照顾好，别把力气分得太散。",
    label: "温柔一点",
    value: "GENTLE",
  },
  {
    example: "昨晚的电量没充满，今天就开省电模式：先拿下一件最重要的事。",
    label: "轻松幽默",
    value: "LIGHT_HUMOR",
  },
  {
    example: "睡眠不足。今天只保留一个优先项，先完成它，再处理其它事情。",
    label: "清醒直接",
    value: "CLEAR_DIRECT",
  },
] as const);

function isNetworkFailure(route: C003Route): boolean {
  return route.reasonCode === "NETWORK_FAILED";
}

Page({
  data: {
    busy: false,
    dateChanged: false,
    error: false,
    inputError: false,
    loading: true,
    offline: false,
    preferredName: "",
    screenId: ONBOARDING_SCREEN_ID,
    selectedStyle: "BALANCED" as ExpressionStyle,
    styleOptions,
  },
  async onLoad() {
    wx.getNetworkType({
      success: ({ networkType }) => {
        this.setData({ offline: networkType === "none" });
      },
    });
    wx.onNetworkStatusChange(({ isConnected }) => {
      this.setData({ error: false, offline: !isConnected });
    });
    try {
      const draft = await getMiniappAppContext().onboarding.loadDraft();
      this.setData({
        loading: false,
        preferredName: draft.preferredName ?? "",
        selectedStyle: draft.expressionStyle,
      });
    } catch {
      this.setData({ error: true, loading: false });
    }
  },
  onUnload() {
    wx.offNetworkStatusChange();
  },
  inputName(event: WechatMiniprogram.Input) {
    const preferredName = event.detail.value;
    let inputError = false;
    try {
      normalizePreferredName(preferredName);
    } catch (error) {
      inputError = error instanceof OnboardingInputError;
    }
    this.setData({ inputError, preferredName });
    if (!inputError) {
      this.queueDraftWrite();
    }
  },
  selectStyle(event: WechatMiniprogram.TouchEvent) {
    const selectedStyle: unknown = event.currentTarget.dataset.style;
    if (!isExpressionStyle(selectedStyle)) {
      return;
    }
    this.setData({ selectedStyle });
    this.queueDraftWrite();
  },
  clearName() {
    this.setData({ inputError: false, preferredName: "" });
    this.queueDraftWrite();
  },
  resetStyle() {
    this.setData({ selectedStyle: "BALANCED" });
    this.queueDraftWrite();
  },
  queueDraftWrite() {
    const input = {
      expressionStyle: this.data.selectedStyle,
      preferredName: this.data.preferredName,
    };
    draftWrite = draftWrite
      .then(() => getMiniappAppContext().onboarding.saveDraft(input))
      .catch(() => {
        this.setData({ error: true });
      });
  },
  async complete() {
    if (this.data.busy || this.data.inputError || this.data.offline) {
      return;
    }
    this.setData({ busy: true, error: false });
    await draftWrite;
    const route = await getMiniappAppContext().onboarding.completeOnboarding({
      expressionStyle: this.data.selectedStyle,
      preferredName: this.data.preferredName,
    });
    if (route.kind === "onboarding") {
      if (route.reasonCode === "PRODUCT_DATE_CHANGED") {
        const draft = await getMiniappAppContext().onboarding.loadDraft();
        this.setData({
          busy: false,
          dateChanged: true,
          error: false,
          preferredName: draft.preferredName ?? "",
          selectedStyle: draft.expressionStyle,
        });
        return;
      }
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
    void this.complete();
  },
});
