import type { GenerationIntentView } from "../../services/miniapp-api.js";

export const GENERATION_FALLBACK_TITLE = "今天先用简洁版本";
export const GENERATION_FALLBACK_MESSAGE =
  "核心结果和行动不变，内容准备好后会直接进入今天。";

export function generationWaitingPresentation(
  status: GenerationIntentView["status"],
): {
  readonly fallback: boolean;
  readonly statusLabel: string;
} {
  return status === "FALLBACK_RUNNING"
    ? Object.freeze({ fallback: true, statusLabel: "正在完成" })
    : Object.freeze({ fallback: false, statusLabel: "正在准备" });
}
