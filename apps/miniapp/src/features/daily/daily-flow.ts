import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C004Api,
  type C009Api,
  type GenerationIntentView,
  type HistoryDayView,
  type SafetyView,
  type TodayView,
} from "../../services/miniapp-api.js";
import { createCommandRef } from "../onboarding/onboarding-flow.js";
import {
  DailyViewCache,
  PendingGenerationStore,
  type PendingGeneration,
} from "./daily-cache.js";

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
      readonly productDate: string;
      readonly view: TodayView;
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
  #busy = false;
  #safetyView?: SafetyView;

  public constructor(
    storage: StoragePort,
    private readonly api: C004Api & C009Api,
    sessionScope: string,
    now: () => number = Date.now,
    private readonly commandRef: (prefix: string) => string = createCommandRef,
  ) {
    this.#cache = new DailyViewCache(storage, sessionScope, now);
    this.#pending = new PendingGenerationStore(storage, sessionScope, now);
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
        return available;
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
      return (await this.#readToday(true))!;
    } catch (error) {
      return this.#failure(error, true);
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
        await Promise.all([this.#cache.clear(), this.#pending.clear()]);
        return { kind: "safety", reasonCode: error.code };
      }
      if (guardCodes.has(error.code)) {
        await Promise.all([this.#cache.clear(), this.#pending.clear()]);
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
