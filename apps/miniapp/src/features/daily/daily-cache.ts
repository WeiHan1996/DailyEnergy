import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  isProductDate,
  projectHistoryDayView,
  projectTodayView,
  type HistoryDayView,
  type TodayView,
} from "../../services/miniapp-api.js";

const VIEW_CACHE_KEY = "daily:views";
const GENERATION_KEY = "daily:generation";
export const DAILY_VIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

export interface PendingGeneration {
  readonly commandRef: string;
  readonly expectedCheckinRevision: number;
  readonly intentRef?: string;
  readonly productDate: string;
}

interface StoredViews extends Record<string, StorageValue> {
  readonly expiresAt: number;
  readonly histories: Readonly<Record<string, StorageValue>>;
  readonly scope: string;
  readonly today?: StorageValue;
  readonly version: 1;
}

interface StoredGeneration extends Record<string, StorageValue> {
  readonly commandRef: string;
  readonly expectedCheckinRevision: number;
  readonly expiresAt: number;
  readonly intentRef?: string;
  readonly productDate: string;
  readonly scope: string;
  readonly version: 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storageValue(value: unknown): StorageValue {
  return JSON.parse(JSON.stringify(value)) as StorageValue;
}

export class DailyViewCache {
  public constructor(
    private readonly storage: StoragePort,
    private readonly scope: string,
    private readonly now: () => number = Date.now,
  ) {}

  public async loadToday(): Promise<TodayView | undefined> {
    return (await this.#load())?.today;
  }

  public async loadHistory(
    productDate: string,
  ): Promise<HistoryDayView | undefined> {
    return (await this.#load())?.histories[productDate];
  }

  public async saveToday(view: TodayView): Promise<void> {
    const current = await this.#load();
    await this.#save({
      histories: current?.histories ?? {},
      today: view,
    });
  }

  public async saveHistory(view: HistoryDayView): Promise<void> {
    const current = await this.#load();
    const histories = {
      ...(current?.histories ?? {}),
      [view.product_date]: view,
    };
    const dates = Object.keys(histories).sort().slice(-7);
    const retained: Record<string, HistoryDayView> = {};
    for (const date of dates) {
      retained[date] = histories[date]!;
    }
    await this.#save({
      histories: retained,
      ...(current?.today === undefined ? {} : { today: current.today }),
    });
  }

  public async removeHistory(productDate: string): Promise<void> {
    const current = await this.#load();
    if (current === undefined || current.histories[productDate] === undefined) {
      return;
    }
    const histories = { ...current.histories };
    delete histories[productDate];
    await this.#save({
      histories,
      ...(current.today === undefined ? {} : { today: current.today }),
    });
  }

  public clear(): Promise<void> {
    return this.storage.remove(VIEW_CACHE_KEY);
  }

  async #load(): Promise<
    | {
        readonly histories: Readonly<Record<string, HistoryDayView>>;
        readonly today?: TodayView;
      }
    | undefined
  > {
    const value = await this.storage.get(VIEW_CACHE_KEY);
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      value.scope !== this.scope ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= this.now() ||
      !isRecord(value.histories)
    ) {
      if (value !== undefined) {
        await this.storage.remove(VIEW_CACHE_KEY);
      }
      return undefined;
    }
    try {
      const histories: Record<string, HistoryDayView> = {};
      for (const [date, history] of Object.entries(value.histories)) {
        if (!isProductDate(date) || !isRecord(history)) {
          throw new Error("DAILY_HISTORY_CACHE_INVALID");
        }
        histories[date] = projectHistoryDayView(history);
      }
      const today = isRecord(value.today)
        ? projectTodayView(value.today)
        : undefined;
      return Object.freeze({
        histories: Object.freeze(histories),
        ...(today === undefined ? {} : { today }),
      });
    } catch {
      await this.storage.remove(VIEW_CACHE_KEY);
      return undefined;
    }
  }

  async #save(input: {
    readonly histories: Readonly<Record<string, HistoryDayView>>;
    readonly today?: TodayView;
  }): Promise<void> {
    const stored: StoredViews = {
      expiresAt: this.now() + DAILY_VIEW_CACHE_TTL_MS,
      histories: storageValue(input.histories) as Readonly<
        Record<string, StorageValue>
      >,
      scope: this.scope,
      ...(input.today === undefined
        ? {}
        : { today: storageValue(input.today) }),
      version: 1,
    };
    await this.storage.set(VIEW_CACHE_KEY, stored);
  }
}

export class PendingGenerationStore {
  public constructor(
    private readonly storage: StoragePort,
    private readonly scope: string,
    private readonly now: () => number = Date.now,
  ) {}

  public async load(): Promise<PendingGeneration | undefined> {
    const value = await this.storage.get(GENERATION_KEY);
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      value.scope !== this.scope ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= this.now() ||
      !isProductDate(value.productDate) ||
      typeof value.commandRef !== "string" ||
      typeof value.expectedCheckinRevision !== "number" ||
      !Number.isInteger(value.expectedCheckinRevision) ||
      value.expectedCheckinRevision < 1 ||
      (value.intentRef !== undefined && typeof value.intentRef !== "string")
    ) {
      if (value !== undefined) {
        await this.clear();
      }
      return undefined;
    }
    return Object.freeze({
      commandRef: value.commandRef,
      expectedCheckinRevision: value.expectedCheckinRevision,
      ...(typeof value.intentRef === "string"
        ? { intentRef: value.intentRef }
        : {}),
      productDate: value.productDate,
    });
  }

  public async save(value: PendingGeneration): Promise<void> {
    const stored: StoredGeneration = {
      commandRef: value.commandRef,
      expectedCheckinRevision: value.expectedCheckinRevision,
      expiresAt: this.now() + DAILY_VIEW_CACHE_TTL_MS,
      ...(value.intentRef === undefined ? {} : { intentRef: value.intentRef }),
      productDate: value.productDate,
      scope: this.scope,
      version: 1,
    };
    await this.storage.set(GENERATION_KEY, stored);
  }

  public clear(): Promise<void> {
    return this.storage.remove(GENERATION_KEY);
  }
}
