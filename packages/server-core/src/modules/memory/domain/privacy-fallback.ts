export type DailyMemorySegmentResolutionV2 =
  | {
      readonly mode: "PERSONALIZED";
      readonly stateResponse: string;
      readonly sourceExplanation: "USER_SAVED_DAILY_MATTER";
    }
  | {
      readonly mode: "FALLBACK";
      readonly stateResponse: string;
    };

export function resolveDailyMemoryStateResponseV2(input: {
  readonly dependencyValid: boolean;
  readonly personalizedStateResponse?: string;
  readonly fallbackStateResponse: string;
}): DailyMemorySegmentResolutionV2 {
  assertText(input.fallbackStateResponse);
  if (input.dependencyValid && input.personalizedStateResponse !== undefined) {
    assertText(input.personalizedStateResponse);
    return Object.freeze({
      mode: "PERSONALIZED" as const,
      stateResponse: input.personalizedStateResponse,
      sourceExplanation: "USER_SAVED_DAILY_MATTER" as const,
    });
  }
  return Object.freeze({
    mode: "FALLBACK" as const,
    stateResponse: input.fallbackStateResponse,
  });
}

function assertText(value: string): void {
  if (
    value.length < 1 ||
    value.length > 140 ||
    /(?:删除|不再记得|曾经记得|source|grant|revision)/iu.test(value)
  ) {
    throw new Error("MEMORY_SEGMENT_TEXT_INVALID");
  }
}
