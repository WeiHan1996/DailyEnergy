import { getMiniappAppContext } from "../../app/app-context.js";
import type { SafetyView } from "../../services/miniapp-api.js";

const SAFETY_SCREEN_ID = "SAFE-001";
type SafetyOverlay = Extract<
  SafetyView,
  { state: "ACTIVE" | "RECOVERY_PENDING" }
>;
interface SafetyResourceProjection {
  readonly action: "CALL" | "OPEN_URL" | "SHOW_TEXT";
  readonly label: string;
  readonly target: string;
}

function overlayCopy(
  view: SafetyOverlay | undefined,
  kind: string,
): string | undefined {
  return view?.blocks.find((block) => block.kind === kind)?.copy;
}

function resources(
  view: SafetyOverlay | undefined,
): readonly SafetyResourceProjection[] {
  const projected: SafetyResourceProjection[] = [];
  for (const block of view?.blocks ?? []) {
    for (const resource of block.resources) {
      projected.push({
        action: resource.action,
        label: resource.label,
        target: resource.target,
      });
    }
  }
  return projected;
}

Page({
  data: {
    emergencyActionLabel: "使用所在地紧急服务",
    immediateLabel: "如果你或他人正处于立即危险，请先联系现实帮助。",
    message: "先把注意力放回现实中的安全与支持。DailyEnergy 不会继续普通内容。",
    resourceLabels: [] as string[],
    resourcesUnavailable: true,
    screenId: SAFETY_SCREEN_ID,
    title: "现在，现实帮助更重要",
    trustedPersonLabel: "联系一位你信任的人",
  },
  onLoad() {
    const safetyView = getMiniappAppContext().onboarding.getSafetyView();
    const overlay =
      safetyView?.state === "ACTIVE" || safetyView?.state === "RECOVERY_PENDING"
        ? safetyView
        : undefined;
    const availableResources = resources(overlay);
    this.setData({
      emergencyActionLabel:
        availableResources.find((resource) => resource.action === "CALL")
          ?.label ?? "使用所在地紧急服务",
      immediateLabel:
        overlayCopy(overlay, "IMMEDIATE_ACTION") ?? this.data.immediateLabel,
      message:
        overlayCopy(overlay, "DIRECT_ACKNOWLEDGEMENT") ?? this.data.message,
      resourceLabels: availableResources.map(
        (resource) => `${resource.label} ${resource.target}`,
      ),
      resourcesUnavailable: availableResources.length === 0,
    });
  },
  emergency() {
    const safetyView = getMiniappAppContext().onboarding.getSafetyView();
    const overlay =
      safetyView?.state === "ACTIVE" || safetyView?.state === "RECOVERY_PENDING"
        ? safetyView
        : undefined;
    const call = resources(overlay).find(
      (resource) =>
        resource.action === "CALL" &&
        /^\+?[0-9 -]{2,24}$/u.test(resource.target),
    );
    if (call !== undefined) {
      wx.makePhoneCall({ phoneNumber: call.target });
      return;
    }
    wx.showModal({
      confirmText: "知道了",
      content: "请立即使用所在地紧急服务，或前往最近的急诊。",
      showCancel: false,
      title: "联系现实帮助",
    });
  },
  trustedPerson() {
    wx.showModal({
      confirmText: "知道了",
      content: "请现在联系一位你信任的、现实中的人，尽量不要独自面对立即危险。",
      showCancel: false,
      title: "联系可信任的人",
    });
  },
});
