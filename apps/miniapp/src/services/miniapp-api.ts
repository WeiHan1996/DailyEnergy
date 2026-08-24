import type { components } from "@daily-energy/api-client/miniapp" with {
  "resolution-mode": "import",
};

import type { NetworkPort, StorageValue } from "../platform/ports.js";

type ApiErrorBody = components["schemas"]["ApiErrorBody"];
type CommandReceiptView = components["schemas"]["CommandReceiptView"];
export type CheckinView = components["schemas"]["CheckinView"];
export type CheckinMood = components["schemas"]["Mood"];
export type CheckinEnergy = components["schemas"]["Energy"];
export type CheckinSleep = components["schemas"]["Sleep"];
export type GenerationIntentView =
  components["schemas"]["GenerationIntentView"];
export type TodayView = components["schemas"]["TodayView"];
export type DailyInteractionView = TodayView["interaction"];
export type HistoryDayView = components["schemas"]["HistoryDayView"];
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

export interface CheckinEnvelope {
  readonly checkin: CheckinView;
  readonly productDate: string;
}

export interface GenerationIntentEnvelope {
  readonly intent: GenerationIntentView;
  readonly productDate: string;
}

export interface TodayEnvelope {
  readonly productDate: string;
  readonly today: TodayView;
}

export interface HistoryDayEnvelope {
  readonly history: HistoryDayView;
  readonly productDate: string;
}

export interface DailyInteractionEnvelope {
  readonly interaction: DailyInteractionView;
  readonly productDate: string;
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

export interface C004Api {
  correctCheckin(input: {
    readonly commandRef: string;
    readonly energy: CheckinEnergy;
    readonly expectedRevision: number;
    readonly mood: CheckinMood;
    readonly sleep: CheckinSleep;
  }): Promise<CheckinEnvelope>;
  getTodayCheckin(): Promise<CheckinEnvelope>;
  submitCheckin(input: {
    readonly commandRef: string;
    readonly energy: CheckinEnergy;
    readonly mood: CheckinMood;
    readonly sleep: CheckinSleep;
  }): Promise<CheckinEnvelope>;
}

export interface C009Api {
  getGeneration(intentRef: string): Promise<GenerationIntentEnvelope>;
  getHistoryDay(productDate: string): Promise<HistoryDayEnvelope>;
  getToday(): Promise<TodayEnvelope>;
  startGeneration(input: {
    readonly commandRef: string;
    readonly expectedCheckinRevision: number;
  }): Promise<GenerationIntentEnvelope>;
}

export interface C010Api {
  getInteraction(): Promise<DailyInteractionEnvelope>;
  updateTask(input: {
    readonly commandRef: string;
    readonly expectedRevision: number;
    readonly productDate: string;
    readonly status: DailyInteractionView["task"]["status"];
    readonly taskRef: string;
  }): Promise<DailyInteractionEnvelope>;
}

export class MiniappApiError extends Error {
  public constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly requestId?: string,
    public readonly safetyView?: SafetyView,
    public readonly productDate?: string,
    public readonly retryAfterSeconds?: number,
    public readonly currentInteraction?: DailyInteractionView,
  ) {
    super(code);
    this.name = "MiniappApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isProductDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
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
  const productDate = isProductDate(envelope?.product_date)
    ? envelope.product_date
    : undefined;
  const retryAfterSeconds = isRecord(error?.details)
    ? error.details.retry_after_seconds
    : undefined;
  const currentInteraction = isRecord(error?.details)
    ? safeInteractionView(error.details.current)
    : undefined;
  return new MiniappApiError(
    code,
    status,
    retryable,
    requestId,
    safetyView,
    productDate,
    typeof retryAfterSeconds === "number" &&
      Number.isInteger(retryAfterSeconds) &&
      retryAfterSeconds >= 0
      ? retryAfterSeconds
      : undefined,
    currentInteraction,
  );
}

function safeInteractionView(value: unknown): DailyInteractionView | undefined {
  try {
    return projectInteractionView(value);
  } catch {
    return undefined;
  }
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

const checkinMoods = new Set<CheckinMood>([
  "VERY_LOW",
  "LOW",
  "STEADY",
  "GOOD",
  "LIGHT",
  "UNSURE",
]);
const checkinEnergies = new Set<CheckinEnergy>([
  "EMPTY",
  "LOW",
  "STEADY",
  "HIGH",
  "FULL",
  "UNSURE",
]);
const checkinSleeps = new Set<CheckinSleep>([
  "POOR",
  "LOW",
  "OKAY",
  "GOOD",
  "UNSURE",
]);

export function isCheckinMood(value: unknown): value is CheckinMood {
  return typeof value === "string" && checkinMoods.has(value as CheckinMood);
}

export function isCheckinEnergy(value: unknown): value is CheckinEnergy {
  return (
    typeof value === "string" && checkinEnergies.has(value as CheckinEnergy)
  );
}

export function isCheckinSleep(value: unknown): value is CheckinSleep {
  return typeof value === "string" && checkinSleeps.has(value as CheckinSleep);
}

function checkinView(data: Record<string, unknown>): CheckinView {
  const allowedKeys = new Set([
    "checkin_ref",
    "energy",
    "mood",
    "product_date",
    "revision",
    "sleep",
    "updated_at",
    "write_window",
  ]);
  if (
    Object.keys(data).some((key) => !allowedKeys.has(key)) ||
    typeof data.checkin_ref !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
      data.checkin_ref,
    ) ||
    !isProductDate(data.product_date) ||
    typeof data.revision !== "number" ||
    !Number.isInteger(data.revision) ||
    data.revision < 1 ||
    !isCheckinMood(data.mood) ||
    !isCheckinEnergy(data.energy) ||
    !isCheckinSleep(data.sleep) ||
    !["OPEN", "CONTINUATION_ONLY", "CLOSED"].includes(
      String(data.write_window),
    ) ||
    typeof data.updated_at !== "string"
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return Object.freeze({
    checkin_ref: data.checkin_ref,
    energy: data.energy,
    mood: data.mood,
    product_date: data.product_date,
    revision: data.revision,
    sleep: data.sleep,
    updated_at: data.updated_at,
    write_window: data.write_window as CheckinView["write_window"],
  });
}

const generationStatuses = new Set<GenerationIntentView["status"]>([
  "QUEUED",
  "RUNNING",
  "FALLBACK_RUNNING",
  "RETRYABLE_FAILED",
  "SUCCEEDED",
  "TERMINAL_FAILED",
  "CANCELLED",
]);
const dimensionIds = [
  "pace",
  "action",
  "connection",
  "resources",
  "recovery",
] as const;

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    /(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
  );
}

function isOpaqueRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    !/[\s\u0000-\u001f\u007f]/u.test(value)
  );
}

function projectGenerationIntentView(
  data: Record<string, unknown>,
): GenerationIntentView {
  if (
    !hasOnlyKeys(data, [
      "intent_ref",
      "product_date",
      "status",
      "result_ref",
      "retry_after_seconds",
      "updated_at",
    ]) ||
    !isOpaqueRef(data.intent_ref) ||
    !isProductDate(data.product_date) ||
    !generationStatuses.has(data.status as GenerationIntentView["status"]) ||
    !isTimestamp(data.updated_at) ||
    (data.result_ref !== undefined && !isOpaqueRef(data.result_ref)) ||
    (data.retry_after_seconds !== undefined &&
      (typeof data.retry_after_seconds !== "number" ||
        !Number.isInteger(data.retry_after_seconds) ||
        data.retry_after_seconds < 0)) ||
    (data.status === "SUCCEEDED") !== (data.result_ref !== undefined)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(data) as unknown as GenerationIntentView;
}

function isDimension(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "label",
      "band",
      "band_label",
      "explanation",
      "is_focus",
    ]) &&
    dimensionIds.includes(value.id as (typeof dimensionIds)[number]) &&
    isText(value.label) &&
    ["LOW", "STEADY", "HIGH"].includes(String(value.band)) &&
    isText(value.band_label) &&
    isText(value.explanation) &&
    typeof value.is_focus === "boolean"
  );
}

function isPrimaryAction(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "action_id",
      "instruction",
      "rationale",
      "constraint_label",
    ]) &&
    isOpaqueRef(value.action_id) &&
    isText(value.instruction) &&
    (value.rationale === undefined || isText(value.rationale)) &&
    (value.constraint_label === undefined || isText(value.constraint_label))
  );
}

function isOptionalTask(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["task_id", "instruction"]) &&
    isOpaqueRef(value.task_id) &&
    isText(value.instruction)
  );
}

function isRitual(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["kind", "display_value", "note"]) &&
    ["COLOR", "NUMBER"].includes(String(value.kind)) &&
    isText(value.display_value) &&
    isText(value.note)
  );
}

function projectDailyContentView(value: unknown) {
  if (!isRecord(value)) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  const dimensions = value.dimensions;
  const overall = value.overall;
  const paragraphs = value.explanation_paragraphs;
  const rituals = value.rituals;
  if (
    !hasOnlyKeys(value, [
      "contract",
      "schema_version",
      "result_id",
      "product_date",
      "result_version",
      "generated_at",
      "content_label",
      "greeting",
      "state_response",
      "overall",
      "focus_dimension_id",
      "dimensions",
      "core_tip",
      "explanation_paragraphs",
      "primary_action",
      "optional_task",
      "rituals",
      "closing",
      "personalization_notice",
    ]) ||
    value.contract !== "daily-content-view" ||
    value.schema_version !== "1.0.0" ||
    !isOpaqueRef(value.result_id) ||
    !isProductDate(value.product_date) ||
    !isText(value.result_version) ||
    !isTimestamp(value.generated_at) ||
    value.content_label !== "娱乐与行动参考" ||
    !isText(value.greeting) ||
    !isText(value.state_response) ||
    !isRecord(overall) ||
    !hasOnlyKeys(overall, ["band", "band_label", "summary"]) ||
    !["LOW", "STEADY", "HIGH"].includes(String(overall.band)) ||
    !isText(overall.band_label) ||
    !isText(overall.summary) ||
    !dimensionIds.includes(
      value.focus_dimension_id as (typeof dimensionIds)[number],
    ) ||
    !Array.isArray(dimensions) ||
    dimensions.length !== dimensionIds.length ||
    dimensions.some((item) => !isDimension(item)) ||
    dimensions[0]?.id !== value.focus_dimension_id ||
    new Set(dimensions.map((item) => item.id)).size !== dimensionIds.length ||
    !isText(value.core_tip) ||
    !Array.isArray(paragraphs) ||
    paragraphs.length < 1 ||
    paragraphs.length > 2 ||
    paragraphs.some((item) => !isText(item)) ||
    !isPrimaryAction(value.primary_action) ||
    !isOptionalTask(value.optional_task) ||
    !Array.isArray(rituals) ||
    rituals.length > 2 ||
    rituals.some((item) => !isRitual(item)) ||
    !isText(value.closing) ||
    !["NONE", "PERSONALIZATION_REDUCED"].includes(
      String(value.personalization_notice),
    )
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as TodayView["content"];
}

function projectInteractionView(value: unknown) {
  if (!isRecord(value)) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  const task = value.task;
  const helpfulness = value.helpfulness;
  if (
    !hasOnlyKeys(value, [
      "contract",
      "schema_version",
      "result_id",
      "product_date",
      "is_lit",
      "task",
      "helpfulness",
      "updated_at",
    ]) ||
    value.contract !== "daily-interaction-state" ||
    value.schema_version !== "1.0.0" ||
    !isOpaqueRef(value.result_id) ||
    !isProductDate(value.product_date) ||
    typeof value.is_lit !== "boolean" ||
    !isRecord(task) ||
    !hasOnlyKeys(task, ["task_id", "revision", "status"]) ||
    !isOpaqueRef(task.task_id) ||
    typeof task.revision !== "number" ||
    !Number.isInteger(task.revision) ||
    task.revision < 1 ||
    !["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"].includes(
      String(task.status),
    ) ||
    !isRecord(helpfulness) ||
    !hasOnlyKeys(helpfulness, ["revision", "rating"]) ||
    typeof helpfulness.revision !== "number" ||
    !Number.isInteger(helpfulness.revision) ||
    helpfulness.revision < 0 ||
    !["UNRATED", "HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"].includes(
      String(helpfulness.rating),
    ) ||
    (helpfulness.rating === "UNRATED") !== (helpfulness.revision === 0) ||
    !isTimestamp(value.updated_at)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as TodayView["interaction"];
}

function projectRelationshipView(value: unknown) {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["stage", "encounter_day_count", "display_token"]) ||
    ![
      "BEFORE_FIRST_MEETING",
      "NEWLY_MET",
      "BECOMING_FAMILIAR",
      "FIRST_WEEK_RECORDED",
    ].includes(String(value.stage)) ||
    typeof value.encounter_day_count !== "number" ||
    !Number.isInteger(value.encounter_day_count) ||
    value.encounter_day_count < 0 ||
    (value.display_token !== undefined && !isText(value.display_token))
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as TodayView["relationship"];
}

export function projectTodayView(data: Record<string, unknown>): TodayView {
  if (!hasOnlyKeys(data, ["content", "interaction", "relationship"])) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  const content = projectDailyContentView(data.content);
  const interaction = projectInteractionView(data.interaction);
  const relationship = projectRelationshipView(data.relationship);
  if (
    content.product_date !== interaction.product_date ||
    content.result_id !== interaction.result_id
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return Object.freeze({ content, interaction, relationship });
}

export function projectHistoryDayView(
  data: Record<string, unknown>,
): HistoryDayView {
  if (
    !hasOnlyKeys(data, [
      "product_date",
      "checkin",
      "content",
      "interaction",
      "evening",
    ]) ||
    !isProductDate(data.product_date) ||
    data.evening !== undefined
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  const checkin = isRecord(data.checkin)
    ? checkinView(data.checkin)
    : undefined;
  const content =
    data.content === undefined
      ? undefined
      : projectDailyContentView(data.content);
  const interaction =
    data.interaction === undefined
      ? undefined
      : projectInteractionView(data.interaction);
  if (
    (checkin === undefined &&
      content === undefined &&
      interaction === undefined) ||
    [checkin?.product_date, content?.product_date, interaction?.product_date]
      .filter((item): item is string => item !== undefined)
      .some((item) => item !== data.product_date) ||
    (content !== undefined &&
      interaction !== undefined &&
      content.result_id !== interaction.result_id)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return Object.freeze({
    product_date: data.product_date,
    ...(checkin === undefined ? {} : { checkin }),
    ...(content === undefined ? {} : { content }),
    ...(interaction === undefined ? {} : { interaction }),
  });
}

function freezeJson<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      freezeJson(entry);
    }
  }
  return value;
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

export function createMiniappApi(
  network: NetworkPort,
): C003Api & C004Api & C009Api & C010Api {
  let sessionToken: string | undefined;

  const api: C003Api & C004Api & C009Api & C010Api = {
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

    async getTodayCheckin(): Promise<CheckinEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/daily/today/checkin",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        checkin: checkinView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async submitCheckin(input): Promise<CheckinEnvelope> {
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          energy: input.energy,
          expected_revision: 0,
          mood: input.mood,
          sleep: input.sleep,
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/daily/checkin/submit",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        checkin: checkinView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async correctCheckin(input): Promise<CheckinEnvelope> {
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          energy: input.energy,
          expected_revision: input.expectedRevision,
          mood: input.mood,
          sleep: input.sleep,
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/daily/checkin/correct",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        checkin: checkinView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async startGeneration(input): Promise<GenerationIntentEnvelope> {
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          expected_checkin_revision: input.expectedCheckinRevision,
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/daily/generation/start",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        intent: projectGenerationIntentView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async getGeneration(intentRef): Promise<GenerationIntentEnvelope> {
      if (!isOpaqueRef(intentRef)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: `/v1/daily/generation/${encodeURIComponent(intentRef)}`,
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        intent: projectGenerationIntentView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async getToday(): Promise<TodayEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/daily/today",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        today: projectTodayView(parsed.data),
      });
    },

    async getHistoryDay(productDate): Promise<HistoryDayEnvelope> {
      if (!isProductDate(productDate)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: `/v1/daily/by-date/${encodeURIComponent(productDate)}`,
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        history: projectHistoryDayView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async getInteraction(): Promise<DailyInteractionEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/daily/interaction",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        interaction: projectInteractionView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async updateTask(input): Promise<DailyInteractionEnvelope> {
      if (!isProductDate(input.productDate) || !isOpaqueRef(input.taskRef)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          expected_revision: input.expectedRevision,
          product_date: input.productDate,
          status: input.status,
          task_ref: input.taskRef,
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/daily/interaction/task",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        interaction: projectInteractionView(parsed.data),
        productDate: parsed.productDate,
      });
    },
  };
  return Object.freeze(api);
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return isRecord(value) && value.ok === false && isRecord(value.error);
}
