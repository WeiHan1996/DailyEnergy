import type { StoragePort, StorageValue } from "../../platform/ports.js";
import {
  isExpressionStyle,
  type ExpressionStyle,
} from "../../services/miniapp-api.js";

const draftKey = "onboarding:draft";
export const ONBOARDING_DRAFT_TTL_MS = 30 * 60 * 1_000;

export interface OnboardingDraft {
  readonly expressionStyle: ExpressionStyle;
  readonly pendingConsentCommandRef?: string;
  readonly pendingConsentNoticeVersion?: string;
  readonly pendingOnboardingCommandRef?: string;
  readonly preferredName?: string;
}

export interface OnboardingDraftPatch {
  readonly expressionStyle?: ExpressionStyle;
  readonly pendingConsentCommandRef?: string;
  readonly pendingConsentNoticeVersion?: string;
  readonly pendingOnboardingCommandRef?: string;
  readonly preferredName?: string | null;
}

interface StoredOnboardingDraft extends Record<string, StorageValue> {
  readonly expiresAt: number;
  readonly expressionStyle: ExpressionStyle;
  readonly pendingConsentCommandRef?: string;
  readonly pendingConsentNoticeVersion?: string;
  readonly pendingOnboardingCommandRef?: string;
  readonly preferredName?: string;
  readonly productDate: string;
  readonly scope: string;
  readonly version: 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDraft(
  value: StorageValue | undefined,
): StoredOnboardingDraft | undefined {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.scope !== "string" ||
    typeof value.productDate !== "string" ||
    typeof value.expiresAt !== "number" ||
    !isExpressionStyle(value.expressionStyle) ||
    (value.preferredName !== undefined &&
      typeof value.preferredName !== "string") ||
    (value.pendingConsentCommandRef !== undefined &&
      typeof value.pendingConsentCommandRef !== "string") ||
    (value.pendingConsentNoticeVersion !== undefined &&
      typeof value.pendingConsentNoticeVersion !== "string") ||
    (value.pendingOnboardingCommandRef !== undefined &&
      typeof value.pendingOnboardingCommandRef !== "string")
  ) {
    return undefined;
  }
  return value as StoredOnboardingDraft;
}

function publicDraft(value: StoredOnboardingDraft): OnboardingDraft {
  return Object.freeze({
    expressionStyle: value.expressionStyle,
    ...(value.preferredName === undefined
      ? {}
      : { preferredName: value.preferredName }),
    ...(value.pendingConsentCommandRef === undefined
      ? {}
      : { pendingConsentCommandRef: value.pendingConsentCommandRef }),
    ...(value.pendingConsentNoticeVersion === undefined
      ? {}
      : { pendingConsentNoticeVersion: value.pendingConsentNoticeVersion }),
    ...(value.pendingOnboardingCommandRef === undefined
      ? {}
      : { pendingOnboardingCommandRef: value.pendingOnboardingCommandRef }),
  });
}

export class OnboardingDraftStore {
  #productDate?: string;

  public constructor(
    private readonly storage: StoragePort,
    private readonly scope: string,
    private readonly now: () => number = Date.now,
  ) {}

  public async activate(productDate: string): Promise<void> {
    this.#productDate = productDate;
    const stored = await this.storage.get(draftKey);
    const current = parseDraft(stored);
    if (
      stored !== undefined &&
      (current === undefined ||
        current.scope !== this.scope ||
        current.productDate !== productDate ||
        current.expiresAt <= this.now())
    ) {
      await this.storage.remove(draftKey);
    }
  }

  public async load(): Promise<OnboardingDraft> {
    const current = await this.#loadCurrent();
    return current === undefined
      ? Object.freeze({ expressionStyle: "BALANCED" })
      : publicDraft(current);
  }

  public async update(patch: OnboardingDraftPatch): Promise<OnboardingDraft> {
    const productDate = this.#requireProductDate();
    const current = await this.#loadCurrent();
    const next: StoredOnboardingDraft = {
      expiresAt: this.now() + ONBOARDING_DRAFT_TTL_MS,
      expressionStyle:
        patch.expressionStyle ?? current?.expressionStyle ?? "BALANCED",
      productDate,
      scope: this.scope,
      version: 1,
      ...optionalString(
        "preferredName",
        patch.preferredName === null
          ? undefined
          : (patch.preferredName ?? current?.preferredName),
      ),
      ...optionalString(
        "pendingConsentCommandRef",
        patch.pendingConsentCommandRef ?? current?.pendingConsentCommandRef,
      ),
      ...optionalString(
        "pendingConsentNoticeVersion",
        patch.pendingConsentNoticeVersion ??
          current?.pendingConsentNoticeVersion,
      ),
      ...optionalString(
        "pendingOnboardingCommandRef",
        patch.pendingOnboardingCommandRef ??
          current?.pendingOnboardingCommandRef,
      ),
    };
    await this.storage.set(draftKey, next);
    return publicDraft(next);
  }

  public async clearPending(kind: "consent" | "onboarding"): Promise<void> {
    const current = await this.#loadCurrent();
    if (current === undefined) {
      return;
    }
    const next = { ...current };
    if (kind === "consent") {
      delete next.pendingConsentCommandRef;
      delete next.pendingConsentNoticeVersion;
    } else {
      delete next.pendingOnboardingCommandRef;
    }
    next.expiresAt = this.now() + ONBOARDING_DRAFT_TTL_MS;
    await this.storage.set(draftKey, next);
  }

  public async clear(): Promise<void> {
    await this.storage.remove(draftKey);
  }

  async #loadCurrent(): Promise<StoredOnboardingDraft | undefined> {
    const productDate = this.#requireProductDate();
    const stored = await this.storage.get(draftKey);
    const current = parseDraft(stored);
    if (current === undefined) {
      if (stored !== undefined) {
        await this.storage.remove(draftKey);
      }
      return undefined;
    }
    if (
      current.scope !== this.scope ||
      current.productDate !== productDate ||
      current.expiresAt <= this.now()
    ) {
      await this.storage.remove(draftKey);
      return undefined;
    }
    return current;
  }

  #requireProductDate(): string {
    if (this.#productDate === undefined) {
      throw new Error("ONBOARDING_DRAFT_SCOPE_NOT_ACTIVE");
    }
    return this.#productDate;
  }
}

function optionalString<Key extends string>(
  key: Key,
  value: string | undefined,
) {
  return value === undefined ? {} : { [key]: value };
}
