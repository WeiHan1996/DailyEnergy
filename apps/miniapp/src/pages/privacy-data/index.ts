import { getMiniappAppContext } from "../../app/app-context.js";
import type { DataRightsFlowResult } from "../../features/data-rights/data-rights-flow.js";
import type {
  DataRightsSummaryView,
  DataTaskView,
} from "../../services/miniapp-api.js";

export const PRIVACY_DATA_SCREEN_ID = "SET-004";

Page({
  data: {
    analyticsPageKey: "",
    error: false,
    exporting: false,
    latestExport: undefined as DataTaskView | undefined,
    loading: true,
    offline: false,
    screenId: PRIVACY_DATA_SCREEN_ID,
    summary: undefined as DataRightsSummaryView | undefined,
    tasks: [] as readonly DataTaskView[],
  },
  async onLoad() {
    const analytics = getMiniappAppContext().analytics;
    this.setData({
      analyticsPageKey: analytics.beginPage(PRIVACY_DATA_SCREEN_ID),
    });
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
  },
  back() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: "/pages/today/index" });
    }
  },
  async load() {
    if (this.data.offline) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ error: false, loading: true });
    this.applyResult(await getMiniappAppContext().dataRights.load());
  },
  openRelationshipDeletion() {
    if (!this.data.offline) {
      wx.navigateTo({
        url: "/pages/data-deletion/index?scope=RELATIONSHIP_DATA",
      });
    }
  },
  openAccountDeletion() {
    if (!this.data.offline) {
      wx.navigateTo({ url: "/pages/data-deletion/index?scope=ACCOUNT" });
    }
  },
  openRecords() {
    wx.navigateTo({ url: "/pages/records/index" });
  },
  async startExport() {
    const summary = this.data.summary;
    if (
      this.data.offline ||
      this.data.exporting ||
      summary === undefined ||
      !summary.capabilities.export_account
    ) {
      return;
    }
    this.setData({ error: false, exporting: true });
    const result = await getMiniappAppContext().dataRights.startExport(
      summary.confirmation_versions.export_account,
    );
    if (result.kind === "task") {
      this.setData({ latestExport: result.task });
    } else if (result.kind === "offline" || result.kind === "recovery") {
      this.setData({
        error: result.kind === "recovery",
        offline: result.kind === "offline",
      });
    }
    this.setData({ exporting: false });
  },
  async downloadExport() {
    const task = this.data.latestExport;
    if (
      this.data.offline ||
      task?.kind !== "EXPORT" ||
      task.export_artifact?.state !== "READY"
    ) {
      return;
    }
    this.setData({ error: false, exporting: true });
    const result = await getMiniappAppContext().dataRights.downloadExport({
      downloadRef: task.export_artifact.download_ref,
      taskRef: task.task_ref,
    });
    if (result.kind === "download") {
      const filePath = `${wx.env.USER_DATA_PATH}/dailyenergy-export.json`;
      wx.getFileSystemManager().writeFile({
        data: JSON.stringify(result.document, null, 2),
        encoding: "utf8",
        filePath,
        fail: () => this.setData({ error: true, exporting: false }),
        success: () => {
          this.setData({ exporting: false });
          wx.openDocument({ filePath, showMenu: true });
        },
      });
      return;
    }
    this.setData({
      error: result.kind === "recovery",
      exporting: false,
      offline: result.kind === "offline",
    });
  },
  applyResult(result: DataRightsFlowResult) {
    if (result.kind !== "overview") {
      this.setData({
        error: result.kind === "recovery",
        loading: false,
        offline: result.kind === "offline",
      });
      return;
    }
    const latestExport = result.tasks.items.find(
      (task) => task.kind === "EXPORT",
    );
    this.setData({
      error: false,
      latestExport,
      loading: false,
      summary: result.summary,
      tasks: result.tasks.items,
    });
    void getMiniappAppContext().analytics.dataRightsEntryViewed(
      this.data.analyticsPageKey,
    );
  },
});
