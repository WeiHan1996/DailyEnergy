import { MiniappPlatformError } from "../../platform/errors.js";
import type { LoginPort, StoragePort } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C003Api,
  type ExpressionStyle,
  type ProfileEnvelope,
} from "../../services/miniapp-api.js";
import {
  OnboardingDraftStore,
  type OnboardingDraft,
} from "./onboarding-draft.js";

export type C003RouteKind =
  "landing" | "onboarding" | "checkin" | "recovery" | "safety";

export interface C003Route {
  readonly kind: C003RouteKind;
  readonly reasonCode?: string;
}

export class OnboardingInputError extends Error {
  public readonly code = "PREFERRED_NAME_INVALID";

  public constructor() {
    super("PREFERRED_NAME_INVALID");
    this.name = "OnboardingInputError";
  }
}

export function normalizePreferredName(value: string): string | undefined {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  if (
    Array.from(normalized).length > 24 ||
    /[\u0000-\u001f\u007f\r\n]/u.test(normalized)
  ) {
    throw new OnboardingInputError();
  }
  return normalized;
}

export function createCommandRef(
  prefix: string,
  now = Date.now,
  random = Math.random,
): string {
  const entropy = Array.from({ length: 3 }, () =>
    random().toString(36).slice(2).padEnd(10, "0").slice(0, 10),
  ).join("");
  return `${prefix}-${now().toString(36)}-${entropy}`;
}

function route(kind: C003RouteKind, reasonCode?: string): C003Route {
  return Object.freeze({
    kind,
    ...(reasonCode === undefined ? {} : { reasonCode }),
  });
}

export class OnboardingCoordinator {
  readonly #drafts: OnboardingDraftStore;
  #consentNoticeVersion?: string;
  #consentBusy = false;
  #onboardingBusy = false;
  #productDate?: string;
  #safetyView?: NonNullable<MiniappApiError["safetyView"]>;

  public constructor(
    private readonly login: LoginPort,
    storage: StoragePort,
    private readonly api: C003Api,
    sessionScope: string,
    now: () => number = Date.now,
    private readonly commandRef: (prefix: string) => string = createCommandRef,
  ) {
    this.#drafts = new OnboardingDraftStore(storage, sessionScope, now);
  }

  public async start(channel?: string): Promise<C003Route> {
    try {
      const login = await this.login.login();
      const session = await this.api.createSession({
        ...(channel === undefined ? {} : { channel }),
        code: login.code,
      });
      await this.#activateProductDate(session.productDate);
      if (session.session.safety_continuation_token !== undefined) {
        return route("safety", "SAFETY_CONTROL_REQUIRED");
      }
      if (session.session.account_state !== "ACTIVE") {
        return route("recovery", `ACCOUNT_${session.session.account_state}`);
      }
      const consent = await this.api.getConsent();
      await this.#activateProductDate(consent.productDate);
      this.#consentNoticeVersion = consent.consent.notice_version;
      if (consent.consent.state !== "ACCEPTED") {
        return route("landing");
      }
      return await this.#resolveProfile();
    } catch (error) {
      return this.#recoveryRoute(error);
    }
  }

  public async acceptConsent(): Promise<C003Route> {
    if (this.#consentBusy) {
      return route("landing", "WRITE_IN_PROGRESS");
    }
    if (this.#consentNoticeVersion === undefined) {
      return route("recovery", "CONSENT_STATE_UNAVAILABLE");
    }
    this.#consentBusy = true;
    try {
      let draft = await this.#drafts.load();
      if (draft.pendingConsentCommandRef !== undefined) {
        const current = await this.api.getConsent();
        await this.#activateProductDate(current.productDate);
        draft = await this.#drafts.load();
        this.#consentNoticeVersion = current.consent.notice_version;
        if (current.consent.state === "ACCEPTED") {
          await this.#drafts.clearPending("consent");
          return await this.#resolveProfile();
        }
        if (
          draft.pendingConsentNoticeVersion !== current.consent.notice_version
        ) {
          await this.#drafts.clearPending("consent");
          draft = await this.#drafts.load();
        }
      }
      if (draft.pendingConsentCommandRef === undefined) {
        draft = await this.#drafts.update({
          pendingConsentCommandRef: this.commandRef("consent"),
          pendingConsentNoticeVersion: this.#consentNoticeVersion!,
        });
      }
      await this.api.acceptConsent({
        commandRef: draft.pendingConsentCommandRef!,
        noticeVersion: draft.pendingConsentNoticeVersion!,
      });
      const current = await this.api.getConsent();
      await this.#activateProductDate(current.productDate);
      this.#consentNoticeVersion = current.consent.notice_version;
      if (current.consent.state !== "ACCEPTED") {
        return route("landing", "CONSENT_NOT_ACCEPTED");
      }
      await this.#drafts.clearPending("consent");
      return await this.#resolveProfile();
    } catch (error) {
      if (error instanceof MiniappApiError && !error.retryable) {
        await this.#drafts.clearPending("consent");
      }
      return this.#recoveryRoute(error);
    } finally {
      this.#consentBusy = false;
    }
  }

  public async loadDraft(): Promise<OnboardingDraft> {
    return this.#drafts.load();
  }

  public async saveDraft(input: {
    readonly expressionStyle: ExpressionStyle;
    readonly preferredName: string;
  }): Promise<OnboardingDraft> {
    const preferredName = normalizePreferredName(input.preferredName);
    const current = await this.#drafts.load();
    if (current.pendingOnboardingCommandRef !== undefined) {
      return current;
    }
    return this.#drafts.update({
      expressionStyle: input.expressionStyle,
      preferredName: preferredName ?? null,
    });
  }

  public async completeOnboarding(input: {
    readonly expressionStyle: ExpressionStyle;
    readonly preferredName: string;
  }): Promise<C003Route> {
    if (this.#onboardingBusy) {
      return route("onboarding", "WRITE_IN_PROGRESS");
    }
    this.#onboardingBusy = true;
    try {
      const consent = await this.api.getConsent();
      const productDateChanged = await this.#activateProductDate(
        consent.productDate,
      );
      this.#consentNoticeVersion = consent.consent.notice_version;
      if (productDateChanged) {
        return route("onboarding", "PRODUCT_DATE_CHANGED");
      }
      if (consent.consent.state !== "ACCEPTED") {
        await this.#drafts.clearPending("onboarding");
        return route("landing", "CONSENT_REQUIRED");
      }
      let draft = await this.#drafts.load();
      if (draft.pendingOnboardingCommandRef !== undefined) {
        const existing = await this.#getProfileIfCompleted();
        if (existing !== undefined) {
          await this.#drafts.clear();
          return route("checkin");
        }
        if (this.#productDate !== consent.productDate) {
          return route("onboarding", "PRODUCT_DATE_CHANGED");
        }
      } else {
        draft = await this.saveDraft(input);
      }
      if (draft.pendingOnboardingCommandRef === undefined) {
        draft = await this.#drafts.update({
          pendingOnboardingCommandRef: this.commandRef("onboarding"),
        });
      }
      const completed = await this.api.completeOnboarding({
        commandRef: draft.pendingOnboardingCommandRef!,
        expressionStyle: draft.expressionStyle,
        ...(draft.preferredName === undefined
          ? {}
          : { preferredName: draft.preferredName }),
      });
      await this.#activateProductDate(completed.productDate);
      if (!completed.profile.onboarding_completed) {
        return route("recovery", "ONBOARDING_OUTCOME_UNKNOWN");
      }
      await this.#drafts.clear();
      return route("checkin");
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        !error.retryable &&
        error.safetyView === undefined &&
        !error.code.startsWith("SAFETY_")
      ) {
        await this.#drafts.clearPending("onboarding");
      }
      return this.#recoveryRoute(error);
    } finally {
      this.#onboardingBusy = false;
    }
  }

  async #getProfileIfCompleted(): Promise<ProfileEnvelope | undefined> {
    try {
      const profile = await this.api.getProfile();
      await this.#activateProductDate(profile.productDate);
      return profile.profile.onboarding_completed ? profile : undefined;
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        error.code === "ONBOARDING_REQUIRED"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async #resolveProfile(): Promise<C003Route> {
    const profile = await this.#getProfileIfCompleted();
    return profile === undefined ? route("onboarding") : route("checkin");
  }

  public getSafetyView(): MiniappApiError["safetyView"] {
    return this.#safetyView;
  }

  async #activateProductDate(productDate: string): Promise<boolean> {
    const changed =
      this.#productDate !== undefined && this.#productDate !== productDate;
    this.#productDate = productDate;
    await this.#drafts.activate(productDate);
    return changed;
  }

  #recoveryRoute(error: unknown): C003Route {
    if (error instanceof MiniappApiError) {
      if (error.safetyView !== undefined || error.code.startsWith("SAFETY_")) {
        if (error.safetyView !== undefined) {
          this.#safetyView = error.safetyView;
        }
        return route("safety", "SAFETY_CONTROL_REQUIRED");
      }
      return route("recovery", error.code);
    }
    if (error instanceof MiniappPlatformError) {
      return route("recovery", error.code);
    }
    return route("recovery", "STARTUP_RECOVERY_REQUIRED");
  }
}
