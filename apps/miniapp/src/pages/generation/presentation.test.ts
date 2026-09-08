import { describe, expect, it } from "vitest";

import {
  GENERATION_FALLBACK_MESSAGE,
  GENERATION_FALLBACK_TITLE,
  generationWaitingPresentation,
} from "./presentation.js";

describe("AI-006 controlled template presentation", () => {
  it("uses one restrained fallback state without exposing implementation details", () => {
    expect(generationWaitingPresentation("FALLBACK_RUNNING")).toEqual({
      fallback: true,
      statusLabel: "正在完成",
    });
    const visibleCopy = [
      GENERATION_FALLBACK_TITLE,
      GENERATION_FALLBACK_MESSAGE,
    ].join(" ");
    expect(visibleCopy).not.toMatch(/AI|模型|供应商|错误|失败|重试|成本/iu);
  });

  it.each(["QUEUED", "RUNNING", "RETRYABLE_FAILED"] as const)(
    "keeps %s on the neutral preparation state",
    (status) => {
      expect(generationWaitingPresentation(status)).toEqual({
        fallback: false,
        statusLabel: "正在准备",
      });
    },
  );
});
