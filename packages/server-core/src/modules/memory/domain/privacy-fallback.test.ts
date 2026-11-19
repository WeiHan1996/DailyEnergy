import { describe, expect, it } from "vitest";

import { resolveDailyMemoryStateResponseV2 } from "./privacy-fallback.js";

describe("Daily v2 memory privacy fallback", () => {
  it("uses personalized text only while the dependency remains valid", () => {
    expect(
      resolveDailyMemoryStateResponseV2({
        dependencyValid: true,
        personalizedStateResponse:
          "你还留着一件在意的事，今天先给它一个不着急的小位置。",
        fallbackStateResponse: "今天先按自己的节奏，稳稳放下一个清楚的小步骤。",
      }),
    ).toMatchObject({
      mode: "PERSONALIZED",
      sourceExplanation: "USER_SAVED_DAILY_MATTER",
    });
  });

  it("uses the prevalidated fallback for missing, revoked or deleted sources", () => {
    for (const personalizedStateResponse of [
      undefined,
      "你还留着一件在意的事，今天只往前放一个轻一点的步骤。",
    ]) {
      expect(
        resolveDailyMemoryStateResponseV2({
          dependencyValid: false,
          ...(personalizedStateResponse === undefined
            ? {}
            : { personalizedStateResponse }),
          fallbackStateResponse:
            "今天先按自己的节奏，稳稳放下一个清楚的小步骤。",
        }),
      ).toEqual({
        mode: "FALLBACK",
        stateResponse: "今天先按自己的节奏，稳稳放下一个清楚的小步骤。",
      });
    }
  });

  it("rejects fallback text that leaks deletion history", () => {
    expect(() =>
      resolveDailyMemoryStateResponseV2({
        dependencyValid: false,
        fallbackStateResponse: "你删除了那件事，所以我不再记得。",
      }),
    ).toThrow("MEMORY_SEGMENT_TEXT_INVALID");
  });
});
