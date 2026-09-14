import { MiniappPlatformError } from "../../platform/errors.js";
import {
  MiniappApiError,
  type AI008Api,
  type DataTaskView,
  type MatterListView,
  type MatterView,
  type SafetyView,
} from "../../services/miniapp-api.js";
import { createCommandRef } from "../onboarding/onboarding-flow.js";

export interface MatterDraft {
  readonly dailyUseGranted: boolean;
  readonly targetDate?: string;
  readonly title: string;
  readonly weeklyUseGranted: boolean;
}

export type MatterNoticeCode =
  "MATTER_CONFLICT" | "MATTER_SAVED" | "MATTER_SAVED_PRIVATE";

export type MatterFlowResult =
  | {
      readonly kind: "list";
      readonly productDate: string;
      readonly view: MatterListView;
    }
  | {
      readonly kind: "matter";
      readonly noticeCode?: MatterNoticeCode;
      readonly view: MatterView;
    }
  | { readonly kind: "task"; readonly task: DataTaskView }
  | {
      readonly kind: "offline" | "recovery" | "safety";
      readonly reasonCode: string;
    };

type PendingOperation =
  | {
      readonly kind: "create";
      readonly input: Parameters<AI008Api["createMatter"]>[0];
    }
  | {
      readonly kind: "update";
      readonly input: Parameters<AI008Api["updateMatter"]>[0];
    }
  | {
      readonly kind: "pause" | "resume" | "complete";
      readonly input: Parameters<AI008Api["pauseMatter"]>[0];
    }
  | {
      readonly kind: "delete";
      readonly input: Parameters<AI008Api["deleteManagedMatter"]>[0];
    };

export class MatterInputError extends Error {
  public constructor(
    public readonly code:
      "MATTER_TITLE_EMPTY" | "MATTER_TITLE_INVALID" | "MATTER_TITLE_TOO_LONG",
  ) {
    super(code);
    this.name = "MatterInputError";
  }
}

export class MatterCoordinator {
  #busy = false;
  #pending: PendingOperation | undefined;
  #safetyView: SafetyView | undefined;

  public constructor(
    private readonly api: AI008Api,
    private readonly commandRef: (prefix: string) => string = createCommandRef,
  ) {}

  public async load(): Promise<MatterFlowResult> {
    try {
      const result = await this.api.listMatters();
      return {
        kind: "list",
        productDate: result.productDate,
        view: result.matters,
      };
    } catch (error) {
      return this.#failure(error);
    }
  }

  public save(
    current: MatterView | undefined,
    draft: MatterDraft,
  ): Promise<MatterFlowResult> {
    if (this.#busy) {
      return Promise.resolve({
        kind: "recovery",
        reasonCode: "WRITE_IN_PROGRESS",
      });
    }
    const title = normalizeMatterTitle(draft.title);
    const pending =
      this.#pending ??
      (current === undefined
        ? {
            kind: "create" as const,
            input: {
              commandRef: this.commandRef("matter-create"),
              dailyUseGranted: draft.dailyUseGranted,
              ...(draft.targetDate === undefined
                ? {}
                : { targetDate: draft.targetDate }),
              title,
              weeklyUseGranted: draft.weeklyUseGranted,
            },
          }
        : {
            kind: "update" as const,
            input: {
              clearTargetDate:
                draft.targetDate === undefined &&
                current.target_date !== undefined,
              commandRef: this.commandRef("matter-update"),
              dailyUseGranted: draft.dailyUseGranted,
              expectedRevision: current.revision,
              matterRef: current.matter_ref,
              ...(draft.targetDate === undefined
                ? {}
                : { targetDate: draft.targetDate }),
              title,
              weeklyUseGranted: draft.weeklyUseGranted,
            },
          });
    return this.#submit(pending);
  }

  public transition(
    matter: MatterView,
    transition: "pause" | "resume" | "complete",
  ): Promise<MatterFlowResult> {
    if (this.#busy) {
      return Promise.resolve({
        kind: "recovery",
        reasonCode: "WRITE_IN_PROGRESS",
      });
    }
    return this.#submit(
      this.#pending ?? {
        kind: transition,
        input: {
          commandRef: this.commandRef(`matter-${transition}`),
          expectedRevision: matter.revision,
          matterRef: matter.matter_ref,
        },
      },
    );
  }

  public delete(matter: MatterView): Promise<MatterFlowResult> {
    if (this.#busy) {
      return Promise.resolve({
        kind: "recovery",
        reasonCode: "WRITE_IN_PROGRESS",
      });
    }
    return this.#submit(
      this.#pending ?? {
        kind: "delete",
        input: {
          commandRef: this.commandRef("matter-delete"),
          confirmationVersion: "data-rights-matter-v1",
          expectedRevision: matter.revision,
          matterRef: matter.matter_ref,
        },
      },
    );
  }

  public retry(): Promise<MatterFlowResult> {
    return this.#pending === undefined
      ? this.load()
      : this.#submit(this.#pending);
  }

  public getSafetyView(): SafetyView | undefined {
    return this.#safetyView;
  }

  async #submit(pending: PendingOperation): Promise<MatterFlowResult> {
    if (this.#busy) {
      return { kind: "recovery", reasonCode: "WRITE_IN_PROGRESS" };
    }
    this.#busy = true;
    this.#pending = pending;
    try {
      if (pending.kind === "delete") {
        const result = await this.api.deleteManagedMatter(pending.input);
        this.#pending = undefined;
        return { kind: "task", task: result.task };
      }
      const result =
        pending.kind === "create"
          ? await this.api.createMatter(pending.input)
          : pending.kind === "update"
            ? await this.api.updateMatter(pending.input)
            : pending.kind === "pause"
              ? await this.api.pauseMatter(pending.input)
              : pending.kind === "resume"
                ? await this.api.resumeMatter(pending.input)
                : await this.api.completeMatter(pending.input);
      this.#pending = undefined;
      const savedPrivately =
        (pending.kind === "create" || pending.kind === "update") &&
        ((pending.input.dailyUseGranted === true &&
          result.matter.daily_use_granted === false) ||
          (pending.input.weeklyUseGranted === true &&
            result.matter.weekly_use_granted === false));
      return {
        kind: "matter",
        noticeCode: savedPrivately ? "MATTER_SAVED_PRIVATE" : "MATTER_SAVED",
        view: result.matter,
      };
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        error.code === "REVISION_CONFLICT" &&
        error.currentMatter !== undefined
      ) {
        this.#pending = undefined;
        return {
          kind: "matter",
          noticeCode: "MATTER_CONFLICT",
          view: error.currentMatter,
        };
      }
      if (!isNetworkFailure(error)) {
        this.#pending = undefined;
      }
      return this.#failure(error);
    } finally {
      this.#busy = false;
    }
  }

  #failure(error: unknown): MatterFlowResult {
    if (
      error instanceof MiniappApiError &&
      (error.safetyView !== undefined || error.code.startsWith("SAFETY_"))
    ) {
      this.#safetyView = error.safetyView;
      this.#pending = undefined;
      return { kind: "safety", reasonCode: error.code };
    }
    if (isNetworkFailure(error)) {
      return { kind: "offline", reasonCode: reasonCode(error) };
    }
    return {
      kind: "recovery",
      reasonCode:
        error instanceof MiniappApiError
          ? error.code
          : "MATTER_RECOVERY_REQUIRED",
    };
  }
}

export function normalizeMatterTitle(value: string): string {
  const normalized = value
    .normalize("NFC")
    .replace(/[\r\n]+/gu, " ")
    .trim();
  if (normalized.length === 0) {
    throw new MatterInputError("MATTER_TITLE_EMPTY");
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new MatterInputError("MATTER_TITLE_INVALID");
  }
  if (Array.from(normalized).length > 80 || utf8ByteLength(normalized) > 320) {
    throw new MatterInputError("MATTER_TITLE_TOO_LONG");
  }
  return normalized;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof MiniappPlatformError ||
    (error instanceof MiniappApiError &&
      ["DEPENDENCY_UNAVAILABLE", "UPSTREAM_TRANSIENT"].includes(error.code))
  );
}

function reasonCode(error: unknown): string {
  return error instanceof MiniappApiError ||
    error instanceof MiniappPlatformError
    ? error.code
    : "NETWORK_FAILED";
}
