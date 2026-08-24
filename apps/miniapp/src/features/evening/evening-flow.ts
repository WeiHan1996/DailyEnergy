import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  MiniappApiError,
  projectEveningView,
  type C012Api,
  type EveningView,
  type SafetyView,
} from "../../services/miniapp-api.js";
import { createCommandRef } from "../onboarding/onboarding-flow.js";

const CACHE_KEY = "evening:view";
const CACHE_TTL_MS = 24 * 60 * 60_000;

export type EveningNoticeCode =
  | "EVENING_CONFLICT"
  | "EVENING_OUTCOME_PENDING"
  | "EVENING_SAVED"
  | "EVENING_WINDOW_CLOSED";

export type EveningFlowResult =
  | {
      readonly kind: "evening";
      readonly noticeCode?: EveningNoticeCode;
      readonly offline: boolean;
      readonly view: EveningView;
    }
  | {
      readonly kind: "offline" | "recovery" | "safety";
      readonly reasonCode: string;
    };

export interface EveningDraft {
  readonly helpfulnessRating: EveningView["options"]["helpfulness"][number];
  readonly note: string;
  readonly noteTouched: boolean;
  readonly overallFeeling: EveningView["options"]["overall_feeling"][number];
  readonly taskStatus?: EveningView["options"]["task_status"][number];
}

type PendingSave = Parameters<C012Api["saveEvening"]>[0];

export class EveningCoordinator {
  readonly #cache: EveningViewCache;
  #pending: PendingSave | undefined;
  #safetyView: SafetyView | undefined;
  #busy = false;

  public constructor(
    storage: StoragePort,
    private readonly api: C012Api,
    sessionScope: string,
    now: () => number = Date.now,
    private readonly commandRef: (prefix: string) => string = createCommandRef,
  ) {
    this.#cache = new EveningViewCache(storage, sessionScope, now);
  }

  public async load(): Promise<EveningFlowResult> {
    try {
      const envelope = await this.api.getEvening();
      this.#pending = undefined;
      await this.#cache.save(envelope.evening);
      return { kind: "evening", offline: false, view: envelope.evening };
    } catch (error) {
      return this.#failure(error, true);
    }
  }

  public async save(
    view: EveningView,
    draft: EveningDraft,
  ): Promise<EveningFlowResult> {
    if (this.#busy) {
      return { kind: "recovery", reasonCode: "WRITE_IN_PROGRESS" };
    }
    if (view.write_window === "CLOSED" || view.primary_action === "READ_ONLY") {
      return {
        kind: "evening",
        noticeCode: "EVENING_WINDOW_CLOSED",
        offline: false,
        view,
      };
    }
    this.#busy = true;
    try {
      const pending =
        this.#pending ??
        this.#pendingFrom(view, draft, this.commandRef("evening"));
      this.#pending = pending;
      return await this.#submit(pending);
    } finally {
      this.#busy = false;
    }
  }

  public async retry(): Promise<EveningFlowResult> {
    const pending = this.#pending;
    if (pending === undefined) {
      return this.load();
    }
    if (this.#busy) {
      return { kind: "recovery", reasonCode: "WRITE_IN_PROGRESS" };
    }
    this.#busy = true;
    try {
      const envelope = await this.api.getEvening();
      if (matchesPending(envelope.evening, pending)) {
        this.#pending = undefined;
        await this.#cache.save(envelope.evening);
        return {
          kind: "evening",
          noticeCode: "EVENING_SAVED",
          offline: false,
          view: envelope.evening,
        };
      }
      return await this.#submit(pending);
    } catch (error) {
      return this.#failure(error, true);
    } finally {
      this.#busy = false;
    }
  }

  public getSafetyView(): SafetyView | undefined {
    return this.#safetyView;
  }

  #pendingFrom(
    view: EveningView,
    draft: EveningDraft,
    commandRef: string,
  ): PendingSave {
    const existingNote = view.feedback?.note ?? "";
    return {
      commandRef,
      expectedFeedbackRevision: view.feedback?.revision ?? 0,
      expectedHelpfulnessRevision: view.helpfulness.revision,
      helpfulnessRating: draft.helpfulnessRating,
      ...(draft.noteTouched
        ? draft.note.length === 0 && existingNote.length > 0
          ? { notePatch: { operation: "CLEAR" as const } }
          : draft.note.length > 0
            ? { notePatch: { operation: "SET" as const, value: draft.note } }
            : {}
        : {}),
      overallFeeling: draft.overallFeeling,
      productDate: view.product_date,
      ...(view.task === undefined ||
      draft.taskStatus === undefined ||
      draft.taskStatus === view.task.status
        ? {}
        : {
            taskPatch: {
              expectedRevision: view.task.revision,
              status: draft.taskStatus,
              taskRef: view.task.task_id,
            },
          }),
    };
  }

  async #submit(pending: PendingSave): Promise<EveningFlowResult> {
    try {
      const envelope = await this.api.saveEvening(pending);
      this.#pending = undefined;
      await this.#cache.save(envelope.evening);
      return {
        kind: "evening",
        noticeCode: "EVENING_SAVED",
        offline: false,
        view: envelope.evening,
      };
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        error.code === "REVISION_CONFLICT" &&
        error.currentEvening !== undefined
      ) {
        this.#pending = undefined;
        await this.#cache.save(error.currentEvening);
        return {
          kind: "evening",
          noticeCode: "EVENING_CONFLICT",
          offline: false,
          view: error.currentEvening,
        };
      }
      if (
        error instanceof MiniappApiError &&
        ["VIEW_CONTINUATION_EXPIRED", "WRITE_WINDOW_CLOSED"].includes(
          error.code,
        )
      ) {
        this.#pending = undefined;
        const cached = await this.#cache.load();
        return cached === undefined
          ? { kind: "recovery", reasonCode: error.code }
          : {
              kind: "evening",
              noticeCode: "EVENING_WINDOW_CLOSED",
              offline: false,
              view: {
                ...cached,
                write_window: "CLOSED",
                primary_action: "READ_ONLY",
              },
            };
      }
      if (isNetworkFailure(error)) {
        const cached = await this.#cache.load();
        return cached === undefined
          ? { kind: "offline", reasonCode: networkReason(error) }
          : {
              kind: "evening",
              noticeCode: "EVENING_OUTCOME_PENDING",
              offline: true,
              view: cached,
            };
      }
      this.#pending = undefined;
      return this.#failure(error, true);
    }
  }

  async #failure(
    error: unknown,
    allowCache: boolean,
  ): Promise<EveningFlowResult> {
    if (
      error instanceof MiniappApiError &&
      (error.safetyView !== undefined || error.code.startsWith("SAFETY_"))
    ) {
      this.#safetyView = error.safetyView;
      this.#pending = undefined;
      await this.#cache.clear();
      return { kind: "safety", reasonCode: error.code };
    }
    if (isNetworkFailure(error)) {
      const cached = allowCache ? await this.#cache.load() : undefined;
      return cached === undefined
        ? { kind: "offline", reasonCode: networkReason(error) }
        : { kind: "evening", offline: true, view: cached };
    }
    return {
      kind: "recovery",
      reasonCode:
        error instanceof MiniappApiError
          ? error.code
          : "EVENING_RECOVERY_REQUIRED",
    };
  }
}

class EveningViewCache {
  public constructor(
    private readonly storage: StoragePort,
    private readonly scope: string,
    private readonly now: () => number,
  ) {}

  public async load(): Promise<EveningView | undefined> {
    const value = await this.storage.get(CACHE_KEY);
    if (
      !isRecord(value) ||
      value.scope !== this.scope ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= this.now() ||
      !isRecord(value.view)
    ) {
      if (value !== undefined) {
        await this.clear();
      }
      return undefined;
    }
    try {
      return projectEveningView(value.view);
    } catch {
      await this.clear();
      return undefined;
    }
  }

  public save(view: EveningView): Promise<void> {
    return this.storage.set(CACHE_KEY, {
      expiresAt: this.now() + CACHE_TTL_MS,
      scope: this.scope,
      view: JSON.parse(JSON.stringify(view)) as StorageValue,
    });
  }

  public clear(): Promise<void> {
    return this.storage.remove(CACHE_KEY);
  }
}

function isRecord(value: unknown): value is Record<string, StorageValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesPending(view: EveningView, pending: PendingSave): boolean {
  const noteMatches =
    pending.notePatch === undefined ||
    (pending.notePatch.operation === "CLEAR"
      ? view.feedback?.note === undefined
      : view.feedback?.note === pending.notePatch.value);
  return (
    view.feedback?.overall_feeling === pending.overallFeeling &&
    view.helpfulness.rating === pending.helpfulnessRating &&
    (pending.taskPatch === undefined ||
      view.task?.status === pending.taskPatch.status) &&
    noteMatches
  );
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof MiniappPlatformError ||
    (error instanceof MiniappApiError &&
      ["DEPENDENCY_UNAVAILABLE", "UPSTREAM_TRANSIENT"].includes(error.code))
  );
}

function networkReason(error: unknown): string {
  return error instanceof MiniappApiError ||
    error instanceof MiniappPlatformError
    ? error.code
    : "NETWORK_FAILED";
}
