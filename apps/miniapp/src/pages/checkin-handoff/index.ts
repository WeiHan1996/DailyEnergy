import { getMiniappAppContext } from "../../app/app-context.js";
import type { CheckinFlowResult } from "../../features/checkin/checkin-flow.js";
import {
  completeSelections,
  type CheckinSelections,
} from "../../features/checkin/checkin-draft.js";
import {
  isCheckinEnergy,
  isCheckinMood,
  isCheckinSleep,
  type CheckinEnergy,
  type CheckinMood,
  type CheckinSleep,
  type CheckinView,
} from "../../services/miniapp-api.js";

export const CHECKIN_HANDOFF_SCREEN_ID = "DLY-001";

const moodOptions = Object.freeze([
  { label: "很低落", value: "VERY_LOW" },
  { label: "有点低落", value: "LOW" },
  { label: "平稳", value: "STEADY" },
  { label: "还不错", value: "GOOD" },
  { label: "很轻松", value: "LIGHT" },
  { label: "说不准", value: "UNSURE" },
] satisfies ReadonlyArray<{ label: string; value: CheckinMood }>);
const energyOptions = Object.freeze([
  { label: "快没电", value: "EMPTY" },
  { label: "偏低", value: "LOW" },
  { label: "一般", value: "STEADY" },
  { label: "充足", value: "HIGH" },
  { label: "很充足", value: "FULL" },
  { label: "说不准", value: "UNSURE" },
] satisfies ReadonlyArray<{ label: string; value: CheckinEnergy }>);
const sleepOptions = Object.freeze([
  { label: "很差", value: "POOR" },
  { label: "不太好", value: "LOW" },
  { label: "还可以", value: "OKAY" },
  { label: "很好", value: "GOOD" },
  { label: "说不准", value: "UNSURE" },
] satisfies ReadonlyArray<{ label: string; value: CheckinSleep }>);

function isNetworkReason(reasonCode: string): boolean {
  return ["NETWORK_FAILED", "NETWORK_OFFLINE"].includes(reasonCode);
}

Page({
  data: {
    busy: false,
    canSubmit: false,
    current: undefined as CheckinView | undefined,
    dateChanged: false,
    energy: undefined as CheckinEnergy | undefined,
    energyOptions,
    error: false,
    loading: true,
    mood: undefined as CheckinMood | undefined,
    moodOptions,
    offline: false,
    productDate: "",
    saved: false,
    screenId: CHECKIN_HANDOFF_SCREEN_ID,
    sleep: undefined as CheckinSleep | undefined,
    sleepOptions,
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
    await this.applyResult(await getMiniappAppContext().checkin.load());
  },
  onUnload() {
    wx.offNetworkStatusChange();
  },
  async selectValue(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    if (this.data.busy) {
      return;
    }
    const field: unknown = event.currentTarget.dataset.field;
    const value: unknown = event.detail.value;
    if (!(
      (field === "mood" && isCheckinMood(value)) ||
      (field === "energy" && isCheckinEnergy(value)) ||
      (field === "sleep" && isCheckinSleep(value))
    )) {
      return;
    }
    const selections = {
      energy: this.data.energy,
      mood: this.data.mood,
      sleep: this.data.sleep,
      [field]: value,
    } as CheckinSelections;
    this.setSelections(selections);
    await getMiniappAppContext().checkin.saveDraft(selections);
  },
  async submit() {
    const selections = this.selections();
    if (
      this.data.busy ||
      this.data.offline ||
      completeSelections(selections) === undefined ||
      !this.data.canSubmit
    ) {
      return;
    }
    this.setData({ busy: true, error: false });
    const result = await getMiniappAppContext().checkin.save(selections);
    this.setData({ busy: false });
    await this.applyResult(result);
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
    if (completeSelections(this.selections()) !== undefined) {
      await this.submit();
      return;
    }
    this.setData({ loading: true });
    await this.applyResult(await getMiniappAppContext().checkin.load());
  },
  selections(): CheckinSelections {
    return {
      ...(this.data.energy === undefined ? {} : { energy: this.data.energy }),
      ...(this.data.mood === undefined ? {} : { mood: this.data.mood }),
      ...(this.data.sleep === undefined ? {} : { sleep: this.data.sleep }),
    };
  },
  setSelections(selections: CheckinSelections) {
    const complete = completeSelections(selections) !== undefined;
    const differs =
      this.data.current === undefined ||
      this.data.current.mood !== selections.mood ||
      this.data.current.energy !== selections.energy ||
      this.data.current.sleep !== selections.sleep;
    this.setData({
      canSubmit: complete && differs,
      energy: selections.energy,
      mood: selections.mood,
      sleep: selections.sleep,
    });
  },
  async applyResult(result: CheckinFlowResult) {
    if (result.kind === "safety") {
      wx.reLaunch({ url: "/pages/safety/index" });
      return;
    }
    if (result.kind === "recovery") {
      this.setData({
        error: !isNetworkReason(result.reasonCode),
        loading: false,
        offline: isNetworkReason(result.reasonCode),
      });
      return;
    }
    if (result.kind === "saved") {
      this.setData({
        current: result.view,
        dateChanged: false,
        error: false,
        loading: false,
        productDate: result.productDate,
        saved: true,
      });
      this.setSelections(result.view);
      return;
    }
    this.setData({
      current: result.current,
      dateChanged: result.dateChanged === true,
      error:
        result.reasonCode !== undefined &&
        ![
          "CHECKIN_INCOMPLETE",
          "PRODUCT_DATE_CHANGED",
          "REVISION_CONFLICT",
          "WRITE_IN_PROGRESS",
        ].includes(result.reasonCode),
      loading: false,
      productDate: result.productDate,
      saved: false,
    });
    this.setSelections(result.draft);
  },
});
