import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
  EveningGuardFailure,
  EveningSaveResult,
  EveningStore,
  StoredEveningView,
} from "@daily-energy/server-adapters/api";
import {
  ClientEveningFeedbackViewSchema,
  HelpfulnessRatingValues,
  OverallFeelingValues,
  TaskStatusValues,
  type ClientEveningFeedbackView,
  type EveningSaveRequest,
} from "@daily-energy/shared-schemas";

import type { SessionPrincipal } from "../auth/contracts.js";
import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import {
  EVENING_NOTE_CODEC,
  EVENING_SAFETY_GATE,
  EVENING_SAFETY_STORE,
  EVENING_STORE,
  PRODUCT_DATE_CLOCK,
  RUNTIME_CONFIG,
} from "../composition/tokens.js";
import {
  resolveProductDate,
  type ProductDateClock,
  type ProductDateResolution,
} from "../product-date/product-date.js";
import { ApiException } from "../transport/common/api-exception.js";
import type { EveningNoteCodec } from "./evening-note-codec.js";
import type {
  EveningSafetyInputGate,
  EveningSafetyStore,
} from "./evening-safety.js";

export interface EveningServiceResult {
  readonly resolution: ProductDateResolution;
  readonly view: ClientEveningFeedbackView;
}

@Injectable()
export class EveningService {
  public constructor(
    @Inject(EVENING_STORE) private readonly store: EveningStore,
    @Inject(EVENING_NOTE_CODEC) private readonly noteCodec: EveningNoteCodec,
    @Inject(EVENING_SAFETY_GATE)
    private readonly safetyGate: EveningSafetyInputGate,
    @Inject(EVENING_SAFETY_STORE)
    private readonly safetyStore: EveningSafetyStore,
    @Inject(PRODUCT_DATE_CLOCK) private readonly clock: ProductDateClock,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  public async getToday(
    principal: SessionPrincipal,
  ): Promise<EveningServiceResult> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.get({
        accountId: principal.accountId,
        now: resolution.now,
        openForContinuation: true,
        productDate: resolution.productDate,
        sessionId: principal.sessionId,
      }),
    );
    if (result.status !== "FOUND") {
      throw result.status === "NOT_FOUND"
        ? exception("RESOURCE_NOT_FOUND", resolution)
        : guardException(result.status, resolution);
    }
    return { resolution, view: this.projectView(result.value) };
  }

  public async getByDate(
    principal: SessionPrincipal,
    productDate: string,
  ): Promise<ClientEveningFeedbackView | undefined> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.get({
        accountId: principal.accountId,
        now: resolution.now,
        openForContinuation: false,
        productDate,
        sessionId: principal.sessionId,
      }),
    );
    if (result.status === "NOT_FOUND") {
      return undefined;
    }
    if (result.status !== "FOUND") {
      throw guardException(result.status, resolution);
    }
    return this.projectView({ ...result.value, writeWindow: "CLOSED" });
  }

  public async save(
    principal: SessionPrincipal,
    request: EveningSaveRequest,
  ): Promise<EveningServiceResult> {
    const resolution = this.#resolve();
    let note: ReturnType<EveningNoteCodec["protect"]> | undefined;
    if (request.note_patch?.operation === "SET") {
      const decision = await this.safetyGate.decide({
        note: request.note_patch.value,
        surface: "EVE-001",
      });
      if (decision.outcome === "INDETERMINATE") {
        throw exception("SAFETY_INDETERMINATE", resolution);
      }
      if (decision.outcome === "HIGH_RISK") {
        const activation = await this.#storeCall(() =>
          this.safetyStore.activate({
            accountId: principal.accountId,
            categoryCodes: decision.categoryCodes,
            classifierVersion: decision.classifierVersion,
            commandRef: request.command_ref,
            irreversibleFingerprint: decision.irreversibleFingerprint,
            now: resolution.now,
            policyVersion: decision.policyVersion,
            ruleVersion: decision.ruleVersion,
          }),
        );
        if (activation.status === "IDEMPOTENCY_CONFLICT") {
          throw exception("IDEMPOTENCY_CONFLICT", resolution);
        }
        throw new ApiException({
          code: "SAFETY_OVERLAY",
          productDate: resolution.productDate,
          safetyView: activation.view,
          serverNow: resolution.now,
        });
      }
      note = this.noteCodec.protect(request.note_patch.value);
    }
    const result = await this.#storeCall(() =>
      this.store.save({
        accountId: principal.accountId,
        normalizedPayloadFingerprint: payloadFingerprint(request),
        ...(note === undefined ? {} : { note }),
        now: resolution.now,
        productDatePolicyVersion: this.config.productDatePolicyVersion,
        request,
        sessionId: principal.sessionId,
      }),
    );
    return { resolution, view: this.mutationView(result, resolution) };
  }

  public projectView(value: StoredEveningView): ClientEveningFeedbackView {
    return ClientEveningFeedbackViewSchema.parse({
      contract: "evening-feedback-view",
      schema_version: "1.0.0",
      product_date: value.productDate,
      availability:
        value.writeWindow === "CLOSED"
          ? value.feedback === undefined
            ? "READ_ONLY_EMPTY"
            : "READ_ONLY_SUBMITTED"
          : value.feedback === undefined
            ? "EDITABLE_EMPTY"
            : "EDITABLE_SUBMITTED",
      write_window: value.writeWindow,
      ...(value.feedback === undefined
        ? {}
        : {
            feedback: {
              revision: value.feedback.revision,
              overall_feeling: value.feedback.overallFeeling,
              ...(value.feedback.note === undefined
                ? {}
                : { note: this.noteCodec.reveal(value.feedback.note) }),
              first_submitted_at: value.feedback.firstSubmittedAt.toISOString(),
              updated_at: value.feedback.updatedAt.toISOString(),
            },
          }),
      helpfulness: value.helpfulness,
      task: {
        task_id: value.task.taskId,
        instruction: value.task.instruction,
        revision: value.task.revision,
        status: value.task.status,
      },
      options: {
        overall_feeling: OverallFeelingValues,
        helpfulness: HelpfulnessRatingValues,
        task_status: TaskStatusValues,
      },
      note_max_characters: 80,
      primary_action:
        value.writeWindow === "CLOSED"
          ? "READ_ONLY"
          : value.feedback === undefined
            ? "SAVE"
            : "SAVE_CHANGES",
      completion_message: "今天先到这里，这些记录已经留下了。",
    });
  }

  private mutationView(
    result: EveningSaveResult,
    resolution: ProductDateResolution,
  ): ClientEveningFeedbackView {
    if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
      return this.projectView(result.value);
    }
    if (result.status === "REVISION_CONFLICT") {
      const current = this.projectView(result.current);
      throw new ApiException({
        code: "REVISION_CONFLICT",
        details: {
          current,
          current_revision: current.feedback?.revision ?? 0,
        },
        productDate: resolution.productDate,
        serverNow: resolution.now,
      });
    }
    if (result.status === "NOT_FOUND") {
      throw exception("RESOURCE_NOT_FOUND", resolution);
    }
    if (result.status === "IDEMPOTENCY_CONFLICT") {
      throw exception("IDEMPOTENCY_CONFLICT", resolution);
    }
    if (
      result.status === "VIEW_CONTINUATION_EXPIRED" ||
      result.status === "WRITE_WINDOW_CLOSED"
    ) {
      throw exception(result.status, resolution);
    }
    throw guardException(result.status, resolution);
  }

  #resolve(): ProductDateResolution {
    try {
      return resolveProductDate(this.clock.now());
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }

  async #storeCall<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }
}

function guardException(
  status: EveningGuardFailure,
  resolution: ProductDateResolution,
): ApiException {
  return exception(status, resolution);
}

function exception(
  code:
    | EveningGuardFailure
    | "DEPENDENCY_UNAVAILABLE"
    | "IDEMPOTENCY_CONFLICT"
    | "RESOURCE_NOT_FOUND"
    | "SAFETY_INDETERMINATE"
    | "VIEW_CONTINUATION_EXPIRED"
    | "WRITE_WINDOW_CLOSED",
  resolution: ProductDateResolution,
): ApiException {
  return new ApiException({
    code,
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}

function payloadFingerprint(request: EveningSaveRequest): Buffer {
  return createHash("sha256")
    .update(stableJson({ operation: "EVENING_SAVE", request }), "utf8")
    .digest();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
