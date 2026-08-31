import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  isCheckinEnergy,
  isCheckinMood,
  isCheckinSleep,
  type CheckinEnergy,
  type CheckinMood,
  type CheckinSleep,
} from "../../services/miniapp-api.js";

const DRAFT_KEY = "checkin:draft";
export const CHECKIN_DRAFT_TTL_MS = 24 * 60 * 60 * 1_000;

export interface CheckinSelections {
  readonly energy?: CheckinEnergy;
  readonly mood?: CheckinMood;
  readonly sleep?: CheckinSleep;
}

export interface CheckinDraft extends CheckinSelections {
  readonly pendingCommandRef?: string;
  readonly pendingExpectedRevision?: number;
}

interface StoredCheckinDraft extends Record<string, StorageValue> {
  readonly energy?: CheckinEnergy;
  readonly expiresAt: number;
  readonly mood?: CheckinMood;
  readonly pendingCommandRef?: string;
  readonly pendingExpectedRevision?: number;
  readonly productDate: string;
  readonly scope: string;
  readonly sleep?: CheckinSleep;
  readonly version: 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDraft(
  value: StorageValue | undefined,
): StoredCheckinDraft | undefined {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.scope !== "string" ||
    typeof value.productDate !== "string" ||
    typeof value.expiresAt !== "number" ||
    (value.mood !== undefined && !isCheckinMood(value.mood)) ||
    (value.energy !== undefined && !isCheckinEnergy(value.energy)) ||
    (value.sleep !== undefined && !isCheckinSleep(value.sleep)) ||
    (value.pendingCommandRef !== undefined &&
      typeof value.pendingCommandRef !== "string") ||
    (value.pendingExpectedRevision !== undefined &&
      (typeof value.pendingExpectedRevision !== "number" ||
        !Number.isInteger(value.pendingExpectedRevision) ||
        value.pendingExpectedRevision < 0))
  ) {
    return undefined;
  }
  return value as StoredCheckinDraft;
}

function publicDraft(value: StoredCheckinDraft): CheckinDraft {
  return Object.freeze({
    ...(value.energy === undefined ? {} : { energy: value.energy }),
    ...(value.mood === undefined ? {} : { mood: value.mood }),
    ...(value.pendingCommandRef === undefined
      ? {}
      : { pendingCommandRef: value.pendingCommandRef }),
    ...(value.pendingExpectedRevision === undefined
      ? {}
      : { pendingExpectedRevision: value.pendingExpectedRevision }),
    ...(value.sleep === undefined ? {} : { sleep: value.sleep }),
  });
}

export class CheckinDraftStore {
  #productDate?: string;

  public constructor(
    private readonly storage: StoragePort,
    private readonly scope: string,
    private readonly now: () => number = Date.now,
  ) {}

  public async activate(productDate: string): Promise<boolean> {
    const changed =
      this.#productDate !== undefined && this.#productDate !== productDate;
    this.#productDate = productDate;
    const stored = await this.storage.get(DRAFT_KEY);
    const current = parseDraft(stored);
    if (
      stored !== undefined &&
      (current === undefined ||
        current.scope !== this.scope ||
        current.productDate !== productDate ||
        current.expiresAt <= this.now())
    ) {
      await this.storage.remove(DRAFT_KEY);
    }
    return changed;
  }

  public async load(): Promise<CheckinDraft> {
    const current = await this.#loadCurrent();
    return current === undefined ? Object.freeze({}) : publicDraft(current);
  }

  public async update(selections: CheckinSelections): Promise<CheckinDraft> {
    const productDate = this.#requireProductDate();
    const current = await this.#loadCurrent();
    if (current?.pendingCommandRef !== undefined) {
      return publicDraft(current);
    }
    const next: StoredCheckinDraft = {
      expiresAt: this.now() + CHECKIN_DRAFT_TTL_MS,
      productDate,
      scope: this.scope,
      version: 1,
      ...selections,
    };
    await this.storage.set(DRAFT_KEY, next);
    return publicDraft(next);
  }

  public async beginPending(
    selections: Required<CheckinSelections>,
    commandRef: string,
    expectedRevision: number,
  ): Promise<CheckinDraft> {
    const productDate = this.#requireProductDate();
    const current = await this.#loadCurrent();
    if (current?.pendingCommandRef !== undefined) {
      return publicDraft(current);
    }
    const next: StoredCheckinDraft = {
      ...selections,
      expiresAt: this.now() + CHECKIN_DRAFT_TTL_MS,
      pendingCommandRef: commandRef,
      pendingExpectedRevision: expectedRevision,
      productDate,
      scope: this.scope,
      version: 1,
    };
    await this.storage.set(DRAFT_KEY, next);
    return publicDraft(next);
  }

  public async clearPending(
    selections?: CheckinSelections,
  ): Promise<CheckinDraft> {
    const productDate = this.#requireProductDate();
    const current = await this.#loadCurrent();
    const retained =
      selections ?? (current === undefined ? {} : pickSelections(current));
    const next: StoredCheckinDraft = {
      expiresAt: this.now() + CHECKIN_DRAFT_TTL_MS,
      productDate,
      scope: this.scope,
      version: 1,
      ...retained,
    };
    await this.storage.set(DRAFT_KEY, next);
    return publicDraft(next);
  }

  public async clear(): Promise<void> {
    await this.storage.remove(DRAFT_KEY);
  }

  async #loadCurrent(): Promise<StoredCheckinDraft | undefined> {
    const productDate = this.#requireProductDate();
    const stored = await this.storage.get(DRAFT_KEY);
    const current = parseDraft(stored);
    if (
      current === undefined ||
      current.scope !== this.scope ||
      current.productDate !== productDate ||
      current.expiresAt <= this.now()
    ) {
      if (stored !== undefined) {
        await this.storage.remove(DRAFT_KEY);
      }
      return undefined;
    }
    return current;
  }

  #requireProductDate(): string {
    if (this.#productDate === undefined) {
      throw new Error("CHECKIN_DRAFT_SCOPE_NOT_ACTIVE");
    }
    return this.#productDate;
  }
}

function pickSelections(input: CheckinSelections): CheckinSelections {
  return {
    ...(input.energy === undefined ? {} : { energy: input.energy }),
    ...(input.mood === undefined ? {} : { mood: input.mood }),
    ...(input.sleep === undefined ? {} : { sleep: input.sleep }),
  };
}

export function completeSelections(
  input: CheckinSelections,
): Required<CheckinSelections> | undefined {
  return input.mood === undefined ||
    input.energy === undefined ||
    input.sleep === undefined
    ? undefined
    : { energy: input.energy, mood: input.mood, sleep: input.sleep };
}
