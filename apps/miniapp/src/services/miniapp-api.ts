import type { components } from "@daily-energy/api-client/miniapp" with {
  "resolution-mode": "import",
};

import type { NetworkPort, StorageValue } from "../platform/ports.js";

type ApiErrorBody = components["schemas"]["ApiErrorBody"];
type CommandReceiptView = components["schemas"]["CommandReceiptView"];
type ConsentView = components["schemas"]["ConsentView"];
export type ExpressionStyle = components["schemas"]["ExpressionStyle"];
type ProfileView = components["schemas"]["ProfileView"];
export type SafetyView = components["schemas"]["SafetyView"];
type SessionView = components["schemas"]["SessionView"];
type SafetyOverlayView = Exclude<SafetyView, { state: "CLEAR" }>;
type SafetyBlockView = SafetyOverlayView["blocks"][number];
type SafetyResourceView = SafetyBlockView["resources"][number];

const expressionStyles: Readonly<Record<ExpressionStyle, true>> = Object.freeze(
  {
    BALANCED: true,
    CLEAR_DIRECT: true,
    GENTLE: true,
    LIGHT_HUMOR: true,
  },
);

export interface SessionEnvelope {
  readonly productDate: string;
  readonly session: SessionView;
}

export interface ConsentEnvelope {
  readonly consent: ConsentView;
  readonly productDate: string;
}

export interface ProfileEnvelope {
  readonly productDate: string;
  readonly profile: ProfileView;
}

export interface C003Api {
  acceptConsent(input: {
    readonly commandRef: string;
    readonly noticeVersion: string;
  }): Promise<CommandReceiptView>;
  completeOnboarding(input: {
    readonly commandRef: string;
    readonly expressionStyle: ExpressionStyle;
    readonly preferredName?: string;
  }): Promise<ProfileEnvelope>;
  createSession(input: {
    readonly channel?: string;
    readonly code: string;
  }): Promise<SessionEnvelope>;
  getConsent(): Promise<ConsentEnvelope>;
  getProfile(): Promise<ProfileEnvelope>;
}

export class MiniappApiError extends Error {
  public constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly requestId?: string,
    public readonly safetyView?: SafetyView,
  ) {
    super(code);
    this.name = "MiniappApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProductDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

export function isExpressionStyle(value: unknown): value is ExpressionStyle {
  return typeof value === "string" && value in expressionStyles;
}

function successData(
  body: unknown,
  status: number,
): { readonly data: Record<string, unknown>; readonly productDate: string } {
  if (
    status !== 200 ||
    !isRecord(body) ||
    body.ok !== true ||
    !isRecord(body.data) ||
    !isProductDate(body.product_date) ||
    typeof body.request_id !== "string" ||
    typeof body.server_now !== "string"
  ) {
    throw apiError(body, status);
  }
  return { data: body.data, productDate: body.product_date };
}

function apiError(body: unknown, status: number): MiniappApiError {
  const envelope = isRecord(body) ? body : undefined;
  const error = isRecord(envelope?.error) ? envelope.error : undefined;
  const code =
    typeof error?.code === "string" ? error.code : "CONTRACT_VIOLATION";
  const retryable = typeof error?.retryable === "boolean" && error.retryable;
  const requestId =
    typeof envelope?.request_id === "string" ? envelope.request_id : undefined;
  const safetyCandidate = error === undefined ? undefined : error.safety_view;
  const safetyView = projectSafetyView(safetyCandidate);
  return new MiniappApiError(code, status, retryable, requestId, safetyView);
}

function projectSafetyView(value: unknown): SafetyView | undefined {
  if (!isRecord(value) || typeof value.state !== "string") {
    return undefined;
  }
  if (value.state === "CLEAR") {
    if (
      typeof value.revision !== "number" ||
      typeof value.updated_at !== "string"
    ) {
      return undefined;
    }
    return Object.freeze({
      revision: value.revision,
      state: "CLEAR",
      updated_at: value.updated_at,
    });
  }
  if (
    (value.state !== "ACTIVE" && value.state !== "RECOVERY_PENDING") ||
    !Array.isArray(value.blocks) ||
    typeof value.response_bundle_version !== "string" ||
    typeof value.revision !== "number" ||
    typeof value.updated_at !== "string"
  ) {
    return undefined;
  }
  const blocks = value.blocks.map(projectSafetyBlock);
  if (blocks.some((block) => block === undefined)) {
    return undefined;
  }
  return Object.freeze({
    blocks: blocks as SafetyOverlayView["blocks"],
    ...(typeof value.recovery_ref === "string"
      ? { recovery_ref: value.recovery_ref }
      : {}),
    response_bundle_version: value.response_bundle_version,
    revision: value.revision,
    ...(typeof value.safety_continuation_token === "string"
      ? { safety_continuation_token: value.safety_continuation_token }
      : {}),
    state: value.state,
    updated_at: value.updated_at,
  });
}

function projectSafetyBlock(value: unknown): SafetyBlockView | undefined {
  if (
    !isRecord(value) ||
    typeof value.block_id !== "string" ||
    typeof value.copy !== "string" ||
    ![
      "DIRECT_ACKNOWLEDGEMENT",
      "IMMEDIATE_ACTION",
      "EMERGENCY_RESOURCE",
      "TRUSTED_PERSON",
      "SUPPORT_RESOURCE",
      "PRODUCT_LIMIT",
      "RECOVERY_ACTION",
    ].includes(String(value.kind)) ||
    !Array.isArray(value.resources)
  ) {
    return undefined;
  }
  const resources = value.resources.map(projectSafetyResource);
  if (resources.some((resource) => resource === undefined)) {
    return undefined;
  }
  return Object.freeze({
    block_id: value.block_id,
    copy: value.copy,
    kind: value.kind as SafetyBlockView["kind"],
    resources: resources as SafetyBlockView["resources"],
  });
}

function projectSafetyResource(value: unknown): SafetyResourceView | undefined {
  if (
    !isRecord(value) ||
    !["CALL", "OPEN_URL", "SHOW_TEXT"].includes(String(value.action)) ||
    typeof value.label !== "string" ||
    typeof value.resource_ref !== "string" ||
    typeof value.target !== "string"
  ) {
    return undefined;
  }
  return Object.freeze({
    action: value.action as "CALL" | "OPEN_URL" | "SHOW_TEXT",
    label: value.label,
    resource_ref: value.resource_ref,
    target: value.target,
  });
}

function sessionView(data: Record<string, unknown>): SessionView {
  if (
    typeof data.session_token !== "string" ||
    typeof data.expires_at !== "string" ||
    typeof data.refresh_after !== "string" ||
    typeof data.consent_required !== "boolean" ||
    typeof data.onboarding_required !== "boolean" ||
    !["ACTIVE", "RESTRICTED", "DELETING", "DELETED"].includes(
      String(data.account_state),
    )
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return Object.freeze({
    account_state: data.account_state as SessionView["account_state"],
    consent_required: data.consent_required,
    expires_at: data.expires_at,
    onboarding_required: data.onboarding_required,
    refresh_after: data.refresh_after,
    ...(typeof data.safety_continuation_token === "string"
      ? { safety_continuation_token: data.safety_continuation_token }
      : {}),
    session_token: data.session_token,
  });
}

function consentView(data: Record<string, unknown>): ConsentView {
  if (
    !["MISSING", "ACCEPTED", "WITHDRAWN"].includes(String(data.state)) ||
    typeof data.notice_version !== "string"
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return Object.freeze({
    ...(typeof data.accepted_at === "string"
      ? { accepted_at: data.accepted_at }
      : {}),
    notice_version: data.notice_version,
    state: data.state as ConsentView["state"],
  });
}

function profileView(data: Record<string, unknown>): ProfileView {
  if (
    typeof data.onboarding_completed !== "boolean" ||
    typeof data.revision !== "number" ||
    typeof data.updated_at !== "string" ||
    !isExpressionStyle(data.expression_style) ||
    (data.preferred_name !== undefined &&
      typeof data.preferred_name !== "string")
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return Object.freeze({
    expression_style: data.expression_style,
    onboarding_completed: data.onboarding_completed,
    ...(typeof data.preferred_name === "string"
      ? { preferred_name: data.preferred_name }
      : {}),
    revision: data.revision,
    updated_at: data.updated_at,
  });
}

function commandReceipt(data: Record<string, unknown>): CommandReceiptView {
  if (
    typeof data.command_ref !== "string" ||
    typeof data.operation !== "string" ||
    ![
      "ACCEPTED",
      "DUPLICATE",
      "CONFLICT",
      "REJECTED",
      "UNKNOWN_PENDING",
    ].includes(String(data.outcome))
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return Object.freeze({
    command_ref: data.command_ref,
    operation: data.operation,
    outcome: data.outcome as CommandReceiptView["outcome"],
  });
}

function headers(sessionToken?: string, commandRef?: string) {
  return Object.freeze({
    "Accept-Language": "zh-CN",
    ...(sessionToken === undefined
      ? {}
      : { Authorization: `Bearer ${sessionToken}` }),
    ...(commandRef === undefined ? {} : { "Idempotency-Key": commandRef }),
  });
}

export function createMiniappApi(network: NetworkPort): C003Api {
  let sessionToken: string | undefined;

  const api: C003Api = {
    async createSession(input): Promise<SessionEnvelope> {
      const response = await network.request({
        body: input as StorageValue,
        headers: headers(),
        method: "POST",
        path: "/v1/auth/wechat/session",
      });
      const parsed = successData(response.data, response.statusCode);
      const session = sessionView(parsed.data);
      sessionToken = session.session_token;
      return Object.freeze({ productDate: parsed.productDate, session });
    },

    async getConsent(): Promise<ConsentEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/consent/current",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        consent: consentView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async acceptConsent(input): Promise<CommandReceiptView> {
      const body = {
        command_ref: input.commandRef,
        notice_version: input.noticeVersion,
      };
      const response = await network.request({
        body,
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/consent/accept",
      });
      const parsed = successData(response.data, response.statusCode);
      return commandReceipt(parsed.data);
    },

    async getProfile(): Promise<ProfileEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/profile",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        profile: profileView(parsed.data),
      });
    },

    async completeOnboarding(input): Promise<ProfileEnvelope> {
      const body = {
        command_ref: input.commandRef,
        expression_style: input.expressionStyle,
        ...(input.preferredName === undefined
          ? {}
          : { preferred_name: input.preferredName }),
      };
      const response = await network.request({
        body,
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/onboarding/complete",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        profile: profileView(parsed.data),
      });
    },
  };
  return Object.freeze(api);
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return isRecord(value) && value.ok === false && isRecord(value.error);
}
