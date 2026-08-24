import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C004Api,
  type C009Api,
  type C010Api,
  type C011Api,
  type DailyInteractionView,
  type GenerationIntentView,
  type HistoryDayView,
  type HistoryListView,
  type SafetyView,
  type TodayView,
} from "../../services/miniapp-api.js";
import { createCommandRef } from "../onboarding/onboarding-flow.js";
import {
  DailyViewCache,
  PendingGenerationStore,
  PendingLightCommandStore,
  PendingTaskUpdateStore,
  type PendingLightCommand,
  type PendingGeneration,
  type PendingTaskUpdate,
} from "./daily-cache.js";

export type DailyNoticeCode =
  | "LIGHT_CONFIRMED"
  | "LIGHT_OUTCOME_PENDING"
  | "LIGHT_WINDOW_CLOSED"
  | "TASK_CONFLICT"
  | "TASK_OUTCOME_PENDING"
  | "TASK_UPDATED"
  | "TASK_WINDOW_CLOSED";

export type DailyFlowResult =
  | {
      readonly kind: "waiting";
      readonly intent: GenerationIntentView;
      readonly productDate: string;
      readonly retryAfterSeconds: number;
    }
  | {
      readonly kind: "today";
      readonly offline: boolean;
      readonly noticeCode?: DailyNoticeCode;
      readonly productDate: string;
      readonly view: TodayView;
    }
  | {
      readonly kind: "records";
      readonly offline: boolean;
      readonly productDate: string;
      readonly view: HistoryListView;
    }
  | {
      readonly kind: "history";
      readonly offline: boolean;
      readonly productDate: string;
      readonly view: HistoryDayView;
    }
  | {
      readonly kind: "missing";
      readonly productDate: string;
    }
  | {
      readonly kind: "offline" | "recovery" | "safety";
      readonly reasonCode: string;
    };

const guardCodes = new Set([
  "ACCOUNT_DELETED",
  "ACCOUNT_DELETING",
  "ACCOUNT_RESTRICTED",
  "CONSENT_REQUIRED",
  "ONBOARDING_REQUIRED",
  "STATE_PRECONDITION_FAILED",
]);

export class DailyCoordinator {
  readonly #cache: DailyViewCache;
  readonly #pending: PendingGenerationStore;
  readonly #pendingLight: PendingLightCommandStore;
  readonly #pendingTask: PendingTaskUpdateStore;
  #busy = false;
  #lightBusy = false;
  #taskBusy = false;
  #safetyView?: SafetyView;

  public constructor(
    storage: StoragePort,
    private readonly api: C004Api & C009Api & C010Api & C011Api,
    sessionScope: string,
    now: () => number = Date.now,
    private readonly commandRef: (prefix: string) => string = createCommandRef,
  ) {
    this.#cache = new DailyViewCache(storage, sessionScope, now);
    this.#pending = new PendingGenerationStore(storage, sessionScope, now);
    this.#pendingLight = new PendingLightCommandStore(
      storage,
      sessionScope,
      now,
    );
    this.#pendingTask = new PendingTaskUpdateStore(storage, sessionScope, now);
  }

  public async beginGeneration(
    expectedCheckinRevision?: number,
  ): Promise<DailyFlowResult> {
    if (this.#busy) {
      return { kind: "recovery", reasonCode: "WRITE_IN_PROGRESS" };
    }
    this.#busy = true;
    try {
      const available = await this.#readToday(false);
      if (available !== undefined) {
        return this.#withPendingInteractionState(available);
      }
      return await this.#resumeOrStart(expectedCheckinRevision);
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        ["GENERATION_PENDING", "RESOURCE_NOT_FOUND"].includes(error.code)
      ) {
        try {
          return await this.#resumeOrStart(expectedCheckinRevision);
        } catch (resumeError) {
          return this.#failure(resumeError, true);
        }
      }
      return await this.#failure(error, true);
    } finally {
      this.#busy = false;
    }
  }

  public async refreshGeneration(): Promise<DailyFlowResult> {
    return this.beginGeneration();
  }

  public async loadToday(): Promise<DailyFlowResult> {
    try {
      return await this.#withPendingInteractionState(
        (await this.#readToday(true))!,
      );
    } catch (error) {
      return this.#failure(error, true);
    }
  }

  public async updateTask(input: {
    readonly expectedRevision: number;
    readonly productDate: string;
    readonly status: DailyInteractionView["task"]["status"];
    readonly taskRef: string;
  }): Promise<DailyFlowResult> {
    if (this.#taskBusy) {
      return { kind: "recovery", reasonCode: "WRITE_IN_PROGRESS" };
    }
    this.#taskBusy = true;
    try {
      const existing = await this.#pendingTask.load();
      const pending =
        existing ??
        ({
          commandRef: this.commandRef("task"),
          expectedRevision: input.expectedRevision,
          productDate: input.productDate,
          status: input.status,
          taskRef: input.taskRef,
        } satisfies PendingTaskUpdate);
      if (
        existing !== undefined &&
        (existing.expectedRevision !== input.expectedRevision ||
          existing.productDate !== input.productDate ||
          existing.status !== input.status ||
          existing.taskRef !== input.taskRef)
      ) {
        return this.#cachedToday("TASK_OUTCOME_PENDING", false);
      }
      await this.#pendingTask.save(pending);
      return await this.#submitPendingTask(pending);
    } finally {
      this.#taskBusy = false;
    }
  }

  public async retryTask(): Promise<DailyFlowResult> {
    const pending = await this.#pendingTask.load();
    if (pending === undefined) {
      return this.loadToday();
    }
    if (this.#taskBusy) {
      return { kind: "recovery", reasonCode: "WRITE_IN_PROGRESS" };
    }
    this.#taskBusy = true;
    try {
      return await this.#submitPendingTask(pending);
    } finally {
      this.#taskBusy = false;
    }
  }

  public async lightDay(input: {
    readonly productDate: string;
    readonly resultRef: string;
  }): Promise<DailyFlowResult> {
    if (this.#lightBusy) {
      return { kind: "recovery", reasonCode: "WRITE_IN_PROGRESS" };
    }
    this.#lightBusy = true;
    try {
      const existing = await this.#pendingLight.load();
      const pending =
        existing ??
        ({
          commandRef: this.commandRef("light"),
          productDate: input.productDate,
          resultRef: input.resultRef,
        } satisfies PendingLightCommand);
      if (
        existing !== undefined &&
        (existing.productDate !== input.productDate ||
          existing.resultRef !== input.resultRef)
      ) {
        return this.#cachedToday("LIGHT_OUTCOME_PENDING", false);
      }
      await this.#pendingLight.save(pending);
      return await this.#submitPendingLight(pending);
    } finally {
      this.#lightBusy = false;
    }
  }

  public async retryLight(): Promise<DailyFlowResult> {
    const pending = await this.#pendingLight.load();
    if (pending === undefined) {
      return this.loadToday();
    }
    if (this.#lightBusy) {
      return { kind: "recovery", reasonCode: "WRITE_IN_PROGRESS" };
    }
    this.#lightBusy = true;
    try {
      const current = await this.api.getInteraction();
      if (
        current.interaction.product_date === pending.productDate &&
        current.interaction.result_id === pending.resultRef &&
        current.interaction.is_lit
      ) {
        await this.#pendingLight.clear();
        return this.#cachedTodayWithInteraction(
          current.interaction,
          "LIGHT_CONFIRMED",
          false,
        );
      }
      return await this.#submitPendingLight(pending);
    } catch (error) {
      if (isNetworkFailure(error)) {
        return this.#cachedToday("LIGHT_OUTCOME_PENDING", true);
      }
      await this.#pendingLight.clear();
      return this.#failure(error, true);
    } finally {
      this.#lightBusy = false;
    }
  }

  public async loadHistoryList(): Promise<DailyFlowResult> {
    try {
      const envelope = await this.api.listHistory();
      await this.#cache.saveHistoryList(envelope.history);
      return {
        kind: "records",
        offline: false,
        productDate: envelope.productDate,
        view: envelope.history,
      };
    } catch (error) {
      const cached = await this.#cache.loadHistoryList();
      if (isNetworkFailure(error) && cached !== undefined) {
        return {
          kind: "records",
          offline: true,
          productDate: cached.items[0]?.product_date ?? "",
          view: cached,
        };
      }
      return this.#failure(error, false);
    }
  }

  public async loadHistory(productDate: string): Promise<DailyFlowResult> {
    try {
      const envelope = await this.api.getHistoryDay(productDate);
      await this.#cache.saveHistory(envelope.history);
      return {
        kind: "history",
        offline: false,
        productDate: envelope.history.product_date,
        view: envelope.history,
      };
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        error.code === "RESOURCE_NOT_FOUND"
      ) {
        await this.#cache.removeHistory(productDate);
        return { kind: "missing", productDate };
      }
      const cached = await this.#cache.loadHistory(productDate);
      if (isNetworkFailure(error) && cached !== undefined) {
        return {
          kind: "history",
          offline: true,
          productDate,
          view: cached,
        };
      }
      return this.#failure(error, false);
    }
  }

  public getSafetyView(): SafetyView | undefined {
    return this.#safetyView;
  }

  async #readToday(required: boolean): Promise<DailyFlowResult | undefined> {
    try {
      const envelope = await this.api.getToday();
      await this.#pending.clear();
      await this.#cache.saveToday(envelope.today);
      return {
        kind: "today",
        offline: false,
        productDate: envelope.today.content.product_date,
        view: envelope.today,
      };
    } catch (error) {
      const cached = await this.#cache.loadToday();
      if (isNetworkFailure(error) && cached !== undefined) {
        return {
          kind: "today",
          offline: true,
          productDate: cached.content.product_date,
          view: cached,
        };
      }
      if (!required) {
        throw error;
      }
      throw error;
    }
  }

  async #withPendingTaskState(
    result: DailyFlowResult,
  ): Promise<DailyFlowResult> {
    if (result.kind !== "today") {
      return result;
    }
    const pending = await this.#pendingTask.load();
    if (pending === undefined) {
      return result;
    }
    const task = result.view.interaction.task;
    if (pending.productDate !== result.view.interaction.product_date) {
      await this.#pendingTask.clear();
      return result;
    }
    if (
      task.task_id === pending.taskRef &&
      task.status === pending.status &&
      task.revision >= pending.expectedRevision
    ) {
      await this.#pendingTask.clear();
      return { ...result, noticeCode: "TASK_UPDATED" };
    }
    return { ...result, noticeCode: "TASK_OUTCOME_PENDING" };
  }

  async #withPendingInteractionState(
    result: DailyFlowResult,
  ): Promise<DailyFlowResult> {
    return this.#withPendingTaskState(
      await this.#withPendingLightState(result),
    );
  }

  async #withPendingLightState(
    result: DailyFlowResult,
  ): Promise<DailyFlowResult> {
    if (result.kind !== "today") {
      return result;
    }
    const pending = await this.#pendingLight.load();
    if (pending === undefined) {
      return result;
    }
    if (
      pending.productDate !== result.view.interaction.product_date ||
      pending.resultRef !== result.view.interaction.result_id
    ) {
      await this.#pendingLight.clear();
      return result;
    }
    if (result.view.interaction.is_lit) {
      await this.#pendingLight.clear();
      return {
        ...result,
        noticeCode: result.noticeCode ?? "LIGHT_CONFIRMED",
      };
    }
    return {
      ...result,
      noticeCode: result.noticeCode ?? "LIGHT_OUTCOME_PENDING",
    };
  }

  async #submitPendingLight(
    pending: PendingLightCommand,
  ): Promise<DailyFlowResult> {
    try {
      const envelope = await this.api.lightDay(pending);
      if (
        envelope.interaction.product_date !== pending.productDate ||
        envelope.interaction.result_id !== pending.resultRef ||
        !envelope.interaction.is_lit
      ) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
      }
      await this.#pendingLight.clear();
      return this.#cachedTodayWithInteraction(
        envelope.interaction,
        "LIGHT_CONFIRMED",
        false,
      );
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        ["VIEW_CONTINUATION_EXPIRED", "WRITE_WINDOW_CLOSED"].includes(
          error.code,
        )
      ) {
        await this.#pendingLight.clear();
        return this.#cachedToday("LIGHT_WINDOW_CLOSED", false);
      }
      if (isNetworkFailure(error)) {
        return this.#cachedToday("LIGHT_OUTCOME_PENDING", true);
      }
      await this.#pendingLight.clear();
      return this.#failure(error, true);
    }
  }

  async #submitPendingTask(
    pending: PendingTaskUpdate,
  ): Promise<DailyFlowResult> {
    try {
      const envelope = await this.api.updateTask(pending);
      if (
        envelope.interaction.product_date !== pending.productDate ||
        envelope.interaction.task.task_id !== pending.taskRef
      ) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
      }
      await this.#pendingTask.clear();
      return this.#cachedTodayWithInteraction(
        envelope.interaction,
        "TASK_UPDATED",
        false,
      );
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        error.code === "REVISION_CONFLICT" &&
        error.currentInteraction !== undefined
      ) {
        await this.#pendingTask.clear();
        return this.#cachedTodayWithInteraction(
          error.currentInteraction,
          "TASK_CONFLICT",
          false,
        );
      }
      if (
        error instanceof MiniappApiError &&
        ["VIEW_CONTINUATION_EXPIRED", "WRITE_WINDOW_CLOSED"].includes(
          error.code,
        )
      ) {
        await this.#pendingTask.clear();
        return this.#cachedToday("TASK_WINDOW_CLOSED", false);
      }
      if (isNetworkFailure(error)) {
        return this.#cachedToday("TASK_OUTCOME_PENDING", true);
      }
      await this.#pendingTask.clear();
      return this.#failure(error, true);
    }
  }

  async #cachedToday(
    noticeCode: DailyNoticeCode,
    offline: boolean,
  ): Promise<DailyFlowResult> {
    const cached = await this.#cache.loadToday();
    return cached === undefined
      ? { kind: "recovery", reasonCode: "DAILY_CACHE_REQUIRED" }
      : {
          kind: "today",
          noticeCode,
          offline,
          productDate: cached.content.product_date,
          view: cached,
        };
  }

  async #cachedTodayWithInteraction(
    interaction: DailyInteractionView,
    noticeCode: DailyNoticeCode,
    offline: boolean,
  ): Promise<DailyFlowResult> {
    const cached = await this.#cache.loadToday();
    if (
      cached === undefined ||
      cached.content.result_id !== interaction.result_id ||
      cached.content.product_date !== interaction.product_date
    ) {
      return { kind: "recovery", reasonCode: "DAILY_CACHE_REQUIRED" };
    }
    const view = Object.freeze({ ...cached, interaction });
    await this.#cache.saveToday(view);
    return {
      kind: "today",
      noticeCode,
      offline,
      productDate: interaction.product_date,
      view,
    };
  }

  async #resumeOrStart(
    expectedCheckinRevision?: number,
  ): Promise<DailyFlowResult> {
    let pending = await this.#pending.load();
    if (pending?.intentRef !== undefined) {
      try {
        return await this.#handleIntent(
          await this.api.getGeneration(pending.intentRef),
          pending,
        );
      } catch (error) {
        if (
          !(error instanceof MiniappApiError) ||
          error.code !== "RESOURCE_NOT_FOUND"
        ) {
          throw error;
        }
      }
    }
    if (pending === undefined) {
      const checkin = await this.api.getTodayCheckin();
      pending = {
        commandRef: this.commandRef("generation"),
        expectedCheckinRevision:
          expectedCheckinRevision ?? checkin.checkin.revision,
        productDate: checkin.productDate,
      };
      await this.#pending.save(pending);
    }
    const envelope = await this.api.startGeneration({
      commandRef: pending.commandRef,
      expectedCheckinRevision: pending.expectedCheckinRevision,
    });
    return this.#handleIntent(envelope, pending);
  }

  async #handleIntent(
    envelope: Awaited<ReturnType<C009Api["getGeneration"]>>,
    pending: PendingGeneration,
  ): Promise<DailyFlowResult> {
    if (envelope.productDate !== pending.productDate) {
      await this.#pending.clear();
      return { kind: "recovery", reasonCode: "PRODUCT_DATE_CHANGED" };
    }
    const intent = envelope.intent;
    if (intent.status === "SUCCEEDED") {
      return (await this.#readToday(true))!;
    }
    if (intent.status === "TERMINAL_FAILED" || intent.status === "CANCELLED") {
      await this.#pending.clear();
      return { kind: "recovery", reasonCode: intent.status };
    }
    await this.#pending.save({
      ...pending,
      intentRef: intent.intent_ref,
    });
    return {
      intent,
      kind: "waiting",
      productDate: envelope.productDate,
      retryAfterSeconds: Math.min(
        Math.max(intent.retry_after_seconds ?? 2, 1),
        5,
      ),
    };
  }

  async #failure(
    error: unknown,
    allowTodayCache: boolean,
  ): Promise<DailyFlowResult> {
    if (error instanceof MiniappApiError) {
      if (error.safetyView !== undefined || error.code.startsWith("SAFETY_")) {
        if (error.safetyView !== undefined) {
          this.#safetyView = error.safetyView;
        }
        await Promise.all([
          this.#cache.clear(),
          this.#pending.clear(),
          this.#pendingLight.clear(),
          this.#pendingTask.clear(),
        ]);
        return { kind: "safety", reasonCode: error.code };
      }
      if (guardCodes.has(error.code)) {
        await Promise.all([
          this.#cache.clear(),
          this.#pending.clear(),
          this.#pendingLight.clear(),
          this.#pendingTask.clear(),
        ]);
        return { kind: "recovery", reasonCode: error.code };
      }
    }
    if (isNetworkFailure(error)) {
      if (allowTodayCache) {
        const cached = await this.#cache.loadToday();
        if (cached !== undefined) {
          return {
            kind: "today",
            offline: true,
            productDate: cached.content.product_date,
            view: cached,
          };
        }
      }
      return { kind: "offline", reasonCode: networkReason(error) };
    }
    return {
      kind: "recovery",
      reasonCode:
        error instanceof MiniappApiError
          ? error.code
          : "DAILY_RECOVERY_REQUIRED",
    };
  }
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
