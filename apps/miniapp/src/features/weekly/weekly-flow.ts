import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  MiniappApiError,
  projectWeeklyView,
  type C013Api,
  type SafetyView,
  type WeeklyView,
} from "../../services/miniapp-api.js";

const CACHE_KEY = "weekly:view";
const CACHE_TTL_MS = 24 * 60 * 60_000;

export type WeeklyFlowResult =
  | {
      readonly kind: "weekly";
      readonly offline: boolean;
      readonly view: WeeklyView;
    }
  | {
      readonly kind: "offline" | "recovery" | "safety";
      readonly reasonCode: string;
    };

export class WeeklyCoordinator {
  readonly #cache: WeeklyViewCache;
  #safetyView: SafetyView | undefined;

  public constructor(
    storage: StoragePort,
    private readonly api: C013Api,
    sessionScope: string,
    now: () => number = Date.now,
  ) {
    this.#cache = new WeeklyViewCache(storage, sessionScope, now);
  }

  public async load(endProductDate?: string): Promise<WeeklyFlowResult> {
    try {
      const envelope =
        endProductDate === undefined
          ? await this.api.getWeeklyCurrent()
          : await this.api.getWeeklyWindow(endProductDate);
      await this.#cache.save(envelope.weekly);
      return { kind: "weekly", offline: false, view: envelope.weekly };
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        (error.safetyView !== undefined || error.code.startsWith("SAFETY_"))
      ) {
        this.#safetyView = error.safetyView;
        await this.#cache.clear();
        return { kind: "safety", reasonCode: error.code };
      }
      if (isNetworkFailure(error)) {
        const cached = await this.#cache.load();
        if (
          cached !== undefined &&
          (endProductDate === undefined ||
            cached.window_end_date === endProductDate)
        ) {
          return { kind: "weekly", offline: true, view: cached };
        }
        return { kind: "offline", reasonCode: networkReason(error) };
      }
      return {
        kind: "recovery",
        reasonCode:
          error instanceof MiniappApiError
            ? error.code
            : "WEEKLY_RECOVERY_REQUIRED",
      };
    }
  }

  public getSafetyView(): SafetyView | undefined {
    return this.#safetyView;
  }
}

class WeeklyViewCache {
  public constructor(
    private readonly storage: StoragePort,
    private readonly scope: string,
    private readonly now: () => number,
  ) {}

  public async load(): Promise<WeeklyView | undefined> {
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
      return projectWeeklyView(value.view);
    } catch {
      await this.clear();
      return undefined;
    }
  }

  public save(view: WeeklyView): Promise<void> {
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
