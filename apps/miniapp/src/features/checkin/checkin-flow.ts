import { MiniappPlatformError } from "../../platform/errors.js";
import type { StoragePort } from "../../platform/ports.js";
import {
  MiniappApiError,
  type C004Api,
  type CheckinView,
  type SafetyView,
} from "../../services/miniapp-api.js";
import { createCommandRef } from "../onboarding/onboarding-flow.js";
import {
  CheckinDraftStore,
  completeSelections,
  type CheckinDraft,
  type CheckinSelections,
} from "./checkin-draft.js";

export type CheckinFlowResult =
  | {
      readonly kind: "ready";
      readonly current?: CheckinView;
      readonly dateChanged?: boolean;
      readonly draft: CheckinDraft;
      readonly productDate: string;
      readonly reasonCode?: string;
    }
  | {
      readonly kind: "saved";
      readonly productDate: string;
      readonly view: CheckinView;
    }
  | {
      readonly kind: "recovery";
      readonly reasonCode: string;
    }
  | {
      readonly kind: "safety";
      readonly reasonCode: string;
    };

export class CheckinCoordinator {
  readonly #drafts: CheckinDraftStore;
  #busy = false;
  #productDate?: string;
  #safetyView?: SafetyView;

  public constructor(
    storage: StoragePort,
    private readonly api: C004Api,
    sessionScope: string,
    now: () => number = Date.now,
    private readonly commandRef: (prefix: string) => string = createCommandRef,
  ) {
    this.#drafts = new CheckinDraftStore(storage, sessionScope, now);
  }

  public async load(): Promise<CheckinFlowResult> {
    try {
      const envelope = await this.api.getTodayCheckin();
      await this.#activate(envelope.productDate);
      await this.#drafts.clear();
      return {
        kind: "saved",
        productDate: envelope.productDate,
        view: envelope.checkin,
      };
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        error.code === "RESOURCE_NOT_FOUND" &&
        error.productDate !== undefined
      ) {
        const dateChanged = await this.#activate(error.productDate);
        return {
          dateChanged,
          draft: await this.#drafts.load(),
          kind: "ready",
          productDate: error.productDate,
        };
      }
      return this.#failure(error);
    }
  }

  public async saveDraft(selections: CheckinSelections): Promise<CheckinDraft> {
    return this.#drafts.update(selections);
  }

  public async save(selections: CheckinSelections): Promise<CheckinFlowResult> {
    const complete = completeSelections(selections);
    if (complete === undefined) {
      return this.#ready("CHECKIN_INCOMPLETE");
    }
    if (this.#busy) {
      return this.#ready("WRITE_IN_PROGRESS");
    }
    this.#busy = true;
    try {
      const authoritative = await this.#readAuthoritative();
      if (authoritative.kind !== "resolved") {
        return authoritative.result;
      }
      const { current, dateChanged, productDate } = authoritative;
      if (dateChanged) {
        return {
          dateChanged: true,
          draft: await this.#drafts.load(),
          kind: "ready",
          productDate,
          reasonCode: "PRODUCT_DATE_CHANGED",
        };
      }

      let draft = await this.#drafts.load();
      if (draft.pendingCommandRef !== undefined) {
        const desired = completeSelections(draft);
        if (desired === undefined) {
          await this.#drafts.clearPending();
          return this.#ready("CHECKIN_PENDING_INVALID");
        }
        const expected = draft.pendingExpectedRevision ?? 0;
        if (current !== undefined) {
          if (sameSelections(current, desired)) {
            await this.#drafts.clear();
            return { kind: "saved", productDate, view: current };
          }
          if (expected === 0 || current.revision !== expected) {
            await this.#drafts.clearPending(desired);
            return {
              current,
              draft: await this.#drafts.load(),
              kind: "ready",
              productDate,
              reasonCode: "REVISION_CONFLICT",
            };
          }
        } else if (expected > 0) {
          await this.#drafts.clearPending(desired);
          return this.#ready("RESOURCE_NOT_FOUND");
        }
        return await this.#executePending(draft, desired, current, productDate);
      }

      await this.#drafts.update(complete);
      draft = await this.#drafts.beginPending(
        complete,
        this.commandRef(current === undefined ? "checkin" : "checkin-correct"),
        current?.revision ?? 0,
      );
      return await this.#executePending(draft, complete, current, productDate);
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        ["CHECKIN_ALREADY_EXISTS", "REVISION_CONFLICT"].includes(error.code)
      ) {
        return await this.#resolveConflict(error.code);
      }
      return this.#failure(error);
    } finally {
      this.#busy = false;
    }
  }

  public getSafetyView(): SafetyView | undefined {
    return this.#safetyView;
  }

  async #executePending(
    draft: CheckinDraft,
    desired: Required<CheckinSelections>,
    current: CheckinView | undefined,
    productDate: string,
  ): Promise<CheckinFlowResult> {
    const commandRef = draft.pendingCommandRef;
    const expectedRevision = draft.pendingExpectedRevision;
    if (commandRef === undefined || expectedRevision === undefined) {
      throw new Error("CHECKIN_PENDING_COMMAND_MISSING");
    }
    const envelope =
      current === undefined
        ? await this.api.submitCheckin({ commandRef, ...desired })
        : await this.api.correctCheckin({
            commandRef,
            ...desired,
            expectedRevision,
          });
    const changed = await this.#activate(envelope.productDate);
    if (changed || envelope.productDate !== productDate) {
      return {
        dateChanged: true,
        draft: await this.#drafts.load(),
        kind: "ready",
        productDate: envelope.productDate,
        reasonCode: "PRODUCT_DATE_CHANGED",
      };
    }
    await this.#drafts.clear();
    return {
      kind: "saved",
      productDate: envelope.productDate,
      view: envelope.checkin,
    };
  }

  async #readAuthoritative(): Promise<
    | {
        readonly kind: "resolved";
        readonly current?: CheckinView;
        readonly dateChanged: boolean;
        readonly productDate: string;
      }
    | { readonly kind: "failed"; readonly result: CheckinFlowResult }
  > {
    try {
      const envelope = await this.api.getTodayCheckin();
      return {
        current: envelope.checkin,
        dateChanged: await this.#activate(envelope.productDate),
        kind: "resolved",
        productDate: envelope.productDate,
      };
    } catch (error) {
      if (
        error instanceof MiniappApiError &&
        error.code === "RESOURCE_NOT_FOUND" &&
        error.productDate !== undefined
      ) {
        return {
          dateChanged: await this.#activate(error.productDate),
          kind: "resolved",
          productDate: error.productDate,
        };
      }
      return { kind: "failed", result: this.#failure(error) };
    }
  }

  async #resolveConflict(reasonCode: string): Promise<CheckinFlowResult> {
    try {
      const latest = await this.api.getTodayCheckin();
      await this.#activate(latest.productDate);
      const desired = completeSelections(await this.#drafts.load());
      await this.#drafts.clearPending(desired);
      return {
        current: latest.checkin,
        draft: await this.#drafts.load(),
        kind: "ready",
        productDate: latest.productDate,
        reasonCode,
      };
    } catch (error) {
      return this.#failure(error);
    }
  }

  async #activate(productDate: string): Promise<boolean> {
    const changed =
      this.#productDate !== undefined && this.#productDate !== productDate;
    this.#productDate = productDate;
    await this.#drafts.activate(productDate);
    return changed;
  }

  async #ready(reasonCode: string): Promise<CheckinFlowResult> {
    if (this.#productDate === undefined) {
      return { kind: "recovery", reasonCode };
    }
    return {
      draft: await this.#drafts.load(),
      kind: "ready",
      productDate: this.#productDate,
      reasonCode,
    };
  }

  #failure(error: unknown): CheckinFlowResult {
    if (error instanceof MiniappApiError) {
      if (error.safetyView !== undefined || error.code.startsWith("SAFETY_")) {
        if (error.safetyView !== undefined) {
          this.#safetyView = error.safetyView;
        }
        return { kind: "safety", reasonCode: error.code };
      }
      return { kind: "recovery", reasonCode: error.code };
    }
    if (error instanceof MiniappPlatformError) {
      return { kind: "recovery", reasonCode: error.code };
    }
    return { kind: "recovery", reasonCode: "CHECKIN_RECOVERY_REQUIRED" };
  }
}

function sameSelections(
  view: CheckinView,
  values: Required<CheckinSelections>,
): boolean {
  return (
    view.mood === values.mood &&
    view.energy === values.energy &&
    view.sleep === values.sleep
  );
}
