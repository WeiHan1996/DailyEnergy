import { getMiniappAppContext } from "../../app/app-context.js";
import type { DataRightsFlowResult } from "../../features/data-rights/data-rights-flow.js";
import type {
  DataRightsSummaryView,
  DataTaskView,
  DeletionConfirmationView,
} from "../../services/miniapp-api.js";

export const DATA_DELETION_SCREEN_ID = "SET-006";

Page({
  data: {
    confirmation: undefined as DeletionConfirmationView | undefined,
    error: false,
    loading: true,
    offline: false,
    scope: "ACCOUNT" as "ACCOUNT" | "RELATIONSHIP_DATA",
    screenId: DATA_DELETION_SCREEN_ID,
    state: "NORMAL" as
      "COMPLETED" | "DELETING" | "DISABLED" | "FAILED" | "NORMAL" | "VERIFYING",
    submitting: false,
    summary: undefined as DataRightsSummaryView | undefined,
    task: undefined as DataTaskView | undefined,
  },
  async onLoad(query: Record<string, string | undefined>) {
    this.setData({
      scope:
        query.scope === "RELATIONSHIP_DATA" ? "RELATIONSHIP_DATA" : "ACCOUNT",
    });
    wx.getNetworkType({
      success: ({ networkType }) =>
        this.setData({ offline: networkType === "none" }),
    });
    wx.onNetworkStatusChange(({ isConnected }) => {
      this.setData({ offline: !isConnected });
      if (isConnected && (this.data.error || this.data.state === "DELETING")) {
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
      wx.reLaunch({ url: "/pages/privacy-data/index" });
    }
  },
  async load() {
    if (this.data.offline) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ error: false, loading: true });
    const coordinator = getMiniappAppContext().dataRights;
    if (this.data.scope === "ACCOUNT") {
      const status = await coordinator.loadDeletionStatus();
      if (status.kind === "task") {
        this.applyTask(status.task);
        return;
      }
      if (status.kind === "offline") {
        this.applyFailure(status);
        return;
      }
    }
    const overview = await coordinator.load();
    if (overview.kind !== "overview") {
      this.applyFailure(overview);
      return;
    }
    const activeTask = overview.tasks.items.find(
      (task) => task.kind === "DELETE" && task.scope === this.data.scope,
    );
    this.setData({
      error: false,
      loading: false,
      state:
        this.data.scope === "RELATIONSHIP_DATA" &&
        overview.summary.relationship === undefined
          ? "DISABLED"
          : "NORMAL",
      summary: overview.summary,
      task: activeTask,
    });
    if (activeTask !== undefined) {
      this.applyTask(activeTask);
    }
  },
  async submit() {
    const summary = this.data.summary;
    if (summary === undefined || this.data.offline || this.data.submitting) {
      return;
    }
    this.setData({ error: false, state: "VERIFYING", submitting: true });
    const coordinator = getMiniappAppContext().dataRights;
    if (this.data.scope === "ACCOUNT") {
      const prepared = await coordinator.prepareAccountDeletion(
        summary.account.expected_revision,
        summary.confirmation_versions.delete_account,
      );
      if (prepared.kind !== "confirmation") {
        this.applyFailure(prepared);
        return;
      }
      this.setData({ confirmation: prepared.confirmation });
      const verified = await coordinator.verifyIdentity(
        prepared.confirmation.confirmation_challenge_ref,
      );
      if (verified.kind !== "verification") {
        this.applyFailure(verified);
        return;
      }
      this.applyResult(
        await coordinator.confirmAccountDeletion({
          confirmation: prepared.confirmation,
          identityVerificationRef:
            verified.verification.identity_verification_ref,
        }),
      );
      return;
    }
    if (summary.relationship === undefined) {
      this.setData({ loading: false, state: "DISABLED", submitting: false });
      return;
    }
    const prepared = await coordinator.prepareRelationshipDeletion(
      summary.relationship.expected_revision,
      summary.confirmation_versions.delete_relationship_data,
    );
    if (prepared.kind !== "confirmation") {
      this.applyFailure(prepared);
      return;
    }
    this.setData({ confirmation: prepared.confirmation });
    this.applyResult(
      await coordinator.confirmRelationshipDeletion({
        confirmation: prepared.confirmation,
      }),
    );
  },
  async refreshStatus() {
    const task = this.data.task;
    if (this.data.offline || this.data.submitting) {
      return;
    }
    this.setData({ submitting: true });
    const result =
      this.data.scope === "ACCOUNT"
        ? await getMiniappAppContext().dataRights.loadDeletionStatus()
        : task === undefined
          ? await getMiniappAppContext().dataRights.load()
          : await getMiniappAppContext().dataRights.refreshTask(task.task_ref);
    this.applyResult(result);
  },
  applyResult(result: DataRightsFlowResult) {
    if (result.kind === "task") {
      this.applyTask(result.task);
      return;
    }
    this.applyFailure(result);
  },
  applyTask(task: DataTaskView) {
    const state =
      task.status === "SUCCEEDED"
        ? "COMPLETED"
        : task.status === "FAILED"
          ? "FAILED"
          : "DELETING";
    this.setData({
      error: false,
      loading: false,
      state,
      submitting: false,
      task,
    });
  },
  applyFailure(result: DataRightsFlowResult) {
    this.setData({
      error: result.kind === "recovery",
      loading: false,
      offline: result.kind === "offline",
      state: result.kind === "recovery" ? "FAILED" : this.data.state,
      submitting: false,
    });
  },
});
