import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
  MatterMutationResult,
  MatterQueryResult,
  MatterStore,
  StoredMatterView,
} from "@daily-energy/server-adapters/api";
import {
  assertMatterTargetDate,
  MatterPolicyError,
} from "@daily-energy/server-core/matter";
import {
  MatterListViewSchema,
  MatterViewSchema,
  type MatterCreateRequest,
  type MatterListView,
  type MatterTransitionRequest,
  type MatterUpdateRequest,
  type MatterView,
} from "@daily-energy/shared-schemas";

import type { SessionPrincipal } from "../auth/contracts.js";
import type { RuntimeConfig } from "../bootstrap/runtime-config.js";
import {
  EVENING_SAFETY_GATE,
  EVENING_SAFETY_STORE,
  MATTER_STORE,
  MATTER_TITLE_CODEC,
  PRODUCT_DATE_CLOCK,
  RUNTIME_CONFIG,
} from "../composition/tokens.js";
import type { MatterTitleCodec } from "../data-rights/data-rights-codec.js";
import type {
  EveningSafetyDecision,
  EveningSafetyInputGate,
  EveningSafetyStore,
} from "../evening/evening-safety.js";
import {
  resolveProductDate,
  type ProductDateClock,
  type ProductDateResolution,
} from "../product-date/product-date.js";
import { ApiException } from "../transport/common/api-exception.js";

export interface MatterServiceResult<View> {
  readonly resolution: ProductDateResolution;
  readonly view: View;
}

type MatterTransitionOperation = "PAUSE" | "RESUME" | "COMPLETE";

@Injectable()
export class MatterService {
  public constructor(
    @Inject(MATTER_STORE) private readonly store: MatterStore,
    @Inject(MATTER_TITLE_CODEC) private readonly codec: MatterTitleCodec,
    @Inject(EVENING_SAFETY_GATE)
    private readonly safetyGate: EveningSafetyInputGate,
    @Inject(EVENING_SAFETY_STORE)
    private readonly safetyStore: EveningSafetyStore,
    @Inject(PRODUCT_DATE_CLOCK) private readonly clock: ProductDateClock,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  public async list(
    principal: SessionPrincipal,
  ): Promise<MatterServiceResult<MatterListView>> {
    const resolution = this.#resolve();
    const result = await this.#storeCall(() =>
      this.store.list({
        accountId: principal.accountId,
        now: resolution.now,
        productDate: resolution.productDate,
      }),
    );
    if (result.status !== "FOUND") {
      throw queryException(result, resolution);
    }
    return {
      resolution,
      view: MatterListViewSchema.parse({
        items: result.value.map((matter) => this.#view(matter)),
        page_info: { has_more: false },
      }),
    };
  }

  public async create(
    principal: SessionPrincipal,
    request: MatterCreateRequest,
  ): Promise<MatterServiceResult<MatterView>> {
    const resolution = this.#resolve();
    this.#assertTargetDate(request.target_date, resolution);
    const decision = await this.#safetyDecision(request.title, resolution);
    if (decision.outcome === "HIGH_RISK") {
      await this.#activateSafety(
        principal,
        request.command_ref,
        decision,
        resolution,
      );
    }
    const restricted = decision.outcome === "PROFESSIONAL_BOUNDARY";
    const result = await this.#storeCall(() =>
      this.store.create({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        dailyUseGranted: restricted ? false : request.daily_use_granted,
        normalizedPayloadFingerprint: this.#payloadFingerprint(
          "MATTER_CREATE",
          request,
        ),
        now: resolution.now,
        productDate: resolution.productDate,
        ...(request.target_date === undefined
          ? {}
          : { targetProductDate: request.target_date }),
        title: this.#protect(request.title, resolution),
        weeklyUseGranted: restricted ? false : request.weekly_use_granted,
      }),
    );
    return { resolution, view: this.#mutationView(result, resolution) };
  }

  public async update(
    principal: SessionPrincipal,
    matterRef: string,
    request: MatterUpdateRequest,
  ): Promise<MatterServiceResult<MatterView>> {
    const resolution = this.#resolve();
    this.#assertTargetDate(request.target_date, resolution);
    const current = await this.#current(principal, matterRef, resolution);
    const currentTitle = this.#reveal(current, resolution);
    const nextTitle = request.title ?? currentTitle;
    const decision = await this.#safetyDecision(nextTitle, resolution);
    if (decision.outcome === "HIGH_RISK") {
      await this.#activateSafety(
        principal,
        request.command_ref,
        decision,
        resolution,
      );
    }
    const restricted = decision.outcome === "PROFESSIONAL_BOUNDARY";
    const result = await this.#storeCall(() =>
      this.store.update({
        accountId: principal.accountId,
        clearTargetDate: request.clear_target_date === true,
        commandRef: request.command_ref,
        ...(restricted
          ? { dailyUseGranted: false, weeklyUseGranted: false }
          : {
              ...(request.daily_use_granted === undefined
                ? {}
                : { dailyUseGranted: request.daily_use_granted }),
              ...(request.weekly_use_granted === undefined
                ? {}
                : { weeklyUseGranted: request.weekly_use_granted }),
            }),
        expectedRevision: request.expected_revision,
        matterRef,
        normalizedPayloadFingerprint: this.#payloadFingerprint(
          "MATTER_UPDATE",
          request,
        ),
        now: resolution.now,
        productDate: resolution.productDate,
        ...(request.target_date === undefined
          ? {}
          : { targetProductDate: request.target_date }),
        ...(request.title === undefined || request.title === currentTitle
          ? {}
          : { title: this.#protect(request.title, resolution) }),
      }),
    );
    return { resolution, view: this.#mutationView(result, resolution) };
  }

  public async transition(
    principal: SessionPrincipal,
    matterRef: string,
    request: MatterTransitionRequest,
    transition: MatterTransitionOperation,
  ): Promise<MatterServiceResult<MatterView>> {
    const resolution = this.#resolve();
    let revokeUseGrants = false;
    if (transition === "RESUME") {
      const current = await this.#current(principal, matterRef, resolution);
      const decision = await this.#safetyDecision(
        this.#reveal(current, resolution),
        resolution,
      );
      if (decision.outcome === "HIGH_RISK") {
        await this.#activateSafety(
          principal,
          request.command_ref,
          decision,
          resolution,
        );
      }
      revokeUseGrants = decision.outcome === "PROFESSIONAL_BOUNDARY";
    }
    const result = await this.#storeCall(() =>
      this.store.transition({
        accountId: principal.accountId,
        commandRef: request.command_ref,
        expectedRevision: request.expected_revision,
        matterRef,
        normalizedPayloadFingerprint: this.#payloadFingerprint(
          `MATTER_${transition}`,
          request,
        ),
        now: resolution.now,
        productDate: resolution.productDate,
        revokeUseGrants,
        transition,
      }),
    );
    return { resolution, view: this.#mutationView(result, resolution) };
  }

  async #current(
    principal: SessionPrincipal,
    matterRef: string,
    resolution: ProductDateResolution,
  ): Promise<StoredMatterView> {
    const result = await this.#storeCall(() =>
      this.store.get({
        accountId: principal.accountId,
        matterRef,
        now: resolution.now,
        productDate: resolution.productDate,
      }),
    );
    if (result.status !== "FOUND") {
      throw queryException(result, resolution);
    }
    return result.value;
  }

  async #safetyDecision(
    title: string,
    resolution: ProductDateResolution,
  ): Promise<EveningSafetyDecision> {
    try {
      const decision = await this.safetyGate.decide({
        note: title,
        surface: "MEM-002",
      });
      if (decision.outcome === "INDETERMINATE") {
        throw new ApiException({
          code: "SAFETY_INDETERMINATE",
          productDate: resolution.productDate,
          serverNow: resolution.now,
        });
      }
      return decision;
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException({
        code: "SAFETY_INDETERMINATE",
        productDate: resolution.productDate,
        serverNow: resolution.now,
      });
    }
  }

  async #activateSafety(
    principal: SessionPrincipal,
    commandRef: string,
    decision: Extract<EveningSafetyDecision, { outcome: "HIGH_RISK" }>,
    resolution: ProductDateResolution,
  ): Promise<never> {
    const activation = await this.#storeCall(() =>
      this.safetyStore.activate({
        accountId: principal.accountId,
        categoryCodes: decision.categoryCodes,
        classifierVersion: decision.classifierVersion,
        commandRef,
        irreversibleFingerprint: decision.irreversibleFingerprint,
        now: resolution.now,
        policyVersion: decision.policyVersion,
        ruleVersion: decision.ruleVersion,
        surfaceCode: "MEM-002",
      }),
    );
    if (activation.status === "IDEMPOTENCY_CONFLICT") {
      throw new ApiException({
        code: "IDEMPOTENCY_CONFLICT",
        productDate: resolution.productDate,
        serverNow: resolution.now,
      });
    }
    throw new ApiException({
      code: "SAFETY_OVERLAY",
      productDate: resolution.productDate,
      safetyView: activation.view,
      serverNow: resolution.now,
    });
  }

  #mutationView(
    result: MatterMutationResult,
    resolution: ProductDateResolution,
  ): MatterView {
    if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
      return this.#view(result.value);
    }
    if (result.status === "REVISION_CONFLICT" && result.current !== undefined) {
      throw revisionException(this.#view(result.current), resolution);
    }
    throw mutationException(result.status, resolution);
  }

  #view(value: StoredMatterView): MatterView {
    return MatterViewSchema.parse({
      daily_use_granted: value.dailyUseGranted,
      matter_ref: value.matterRef,
      revision: value.revision,
      status: value.state,
      ...(value.targetProductDate === undefined
        ? {}
        : { target_date: value.targetProductDate }),
      title: this.#reveal(value),
      updated_at: value.updatedAt.toISOString(),
      weekly_use_granted: value.weeklyUseGranted,
    });
  }

  #protect(title: string, resolution: ProductDateResolution) {
    try {
      return this.codec.protect(title);
    } catch {
      throw dependencyException(resolution);
    }
  }

  #reveal(value: StoredMatterView, resolution?: ProductDateResolution): string {
    try {
      return this.codec.reveal(value.title);
    } catch {
      if (resolution === undefined) {
        throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
      }
      throw dependencyException(resolution);
    }
  }

  #payloadFingerprint(operation: string, request: unknown): Buffer {
    const record = request as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title : undefined;
    return createHash("sha256")
      .update(
        stableJson({
          operation,
          ...record,
          ...(title === undefined
            ? {}
            : {
                title: undefined,
                title_fingerprint: this.codec
                  .fingerprint(title)
                  .toString("hex"),
              }),
        }),
        "utf8",
      )
      .digest();
  }

  #resolve(): ProductDateResolution {
    try {
      const resolution = resolveProductDate(this.clock.now());
      if (resolution.policyVersion !== this.config.productDatePolicyVersion) {
        throw new Error("MATTER_PRODUCT_DATE_POLICY_MISMATCH");
      }
      return resolution;
    } catch {
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }

  async #storeCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      if (error instanceof MatterPolicyError) {
        throw new ApiException({ code: "STATE_PRECONDITION_FAILED" });
      }
      throw new ApiException({ code: "DEPENDENCY_UNAVAILABLE" });
    }
  }

  #assertTargetDate(
    targetDate: string | undefined,
    resolution: ProductDateResolution,
  ): void {
    try {
      assertMatterTargetDate(targetDate, resolution.productDate);
    } catch {
      throw new ApiException({
        code: "STATE_PRECONDITION_FAILED",
        productDate: resolution.productDate,
        serverNow: resolution.now,
      });
    }
  }
}

function queryException(
  result: Exclude<MatterQueryResult<unknown>, { status: "FOUND" }>,
  resolution: ProductDateResolution,
): ApiException {
  return mutationException(result.status, resolution);
}

function mutationException(
  status:
    | Exclude<MatterMutationResult["status"], "ACCEPTED" | "DUPLICATE">
    | "NOT_FOUND",
  resolution: ProductDateResolution,
): ApiException {
  const code =
    status === "NOT_FOUND"
      ? "RESOURCE_NOT_FOUND"
      : status === "ACCOUNT_DELETED"
        ? "ACCOUNT_DELETED"
        : status === "ACCOUNT_DELETING"
          ? "ACCOUNT_DELETING"
          : status === "ACCOUNT_RESTRICTED"
            ? "ACCOUNT_RESTRICTED"
            : status === "CONSENT_REQUIRED"
              ? "CONSENT_REQUIRED"
              : status === "ONBOARDING_REQUIRED"
                ? "ONBOARDING_REQUIRED"
                : status === "SAFETY_BLOCKED"
                  ? "SAFETY_BLOCKED"
                  : status === "IDEMPOTENCY_CONFLICT"
                    ? "IDEMPOTENCY_CONFLICT"
                    : "STATE_PRECONDITION_FAILED";
  return new ApiException({
    code,
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}

function revisionException(
  current: MatterView,
  resolution: ProductDateResolution,
): ApiException {
  return new ApiException({
    code: "REVISION_CONFLICT",
    details: { current, current_revision: current.revision },
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}

function dependencyException(resolution: ProductDateResolution): ApiException {
  return new ApiException({
    code: "DEPENDENCY_UNAVAILABLE",
    productDate: resolution.productDate,
    serverNow: resolution.now,
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
