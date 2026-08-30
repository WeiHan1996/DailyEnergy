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
export type HistoryListView = components["schemas"]["HistoryListView"];
export type EveningView = components["schemas"]["EveningView"];
export type WeeklyView = components["schemas"]["WeeklyView"];
export type DataTaskView = components["schemas"]["DataTaskView"];
export type DataTaskListView = components["schemas"]["DataTaskListView"];
export type DataRightsSummaryView =
  components["schemas"]["DataRightsSummaryView"];
export type AccountDeletionAcceptedView =
  components["schemas"]["AccountDeletionAcceptedView"];
export type DataExportDocument = components["schemas"]["DataExportDocument"];
export type DeletionConfirmationView =
  components["schemas"]["DeletionConfirmationView"];
export type IdentityVerificationView =
  components["schemas"]["IdentityVerificationView"];
export type ClientAnalyticsSignalRequest =
  components["schemas"]["ClientAnalyticsSignalRequest"];
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

export interface HistoryListEnvelope {
  readonly history: HistoryListView;
  readonly productDate: string;
}

export interface DailyInteractionEnvelope {
  readonly interaction: DailyInteractionView;
  readonly productDate: string;
}

export interface EveningEnvelope {
  readonly evening: EveningView;
  readonly productDate: string;
}

export interface WeeklyEnvelope {
  readonly productDate: string;
  readonly weekly: WeeklyView;
}

export interface DataTaskEnvelope {
  readonly productDate: string;
  readonly task: DataTaskView;
}

export interface DataTaskListEnvelope {
  readonly productDate: string;
  readonly tasks: DataTaskListView;
}

export interface DataRightsSummaryEnvelope {
  readonly productDate: string;
  readonly summary: DataRightsSummaryView;
}

export interface AccountDeletionAcceptedEnvelope {
  readonly accepted: AccountDeletionAcceptedView;
  readonly productDate: string;
}

export interface DeletionConfirmationEnvelope {
  readonly confirmation: DeletionConfirmationView;
  readonly productDate: string;
}

export interface IdentityVerificationEnvelope {
  readonly productDate: string;
  readonly verification: IdentityVerificationView;
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

export interface C011Api {
  getInteraction(): Promise<DailyInteractionEnvelope>;
  lightDay(input: {
    readonly commandRef: string;
    readonly productDate: string;
    readonly resultRef: string;
  }): Promise<DailyInteractionEnvelope>;
  listHistory(): Promise<HistoryListEnvelope>;
}

export interface C012Api {
  getEvening(): Promise<EveningEnvelope>;
  saveEvening(input: {
    readonly commandRef: string;
    readonly expectedFeedbackRevision: number;
    readonly expectedHelpfulnessRevision: number;
    readonly helpfulnessRating: EveningView["options"]["helpfulness"][number];
    readonly notePatch?:
      | { readonly operation: "CLEAR" }
      | { readonly operation: "SET"; readonly value: string };
    readonly overallFeeling: EveningView["options"]["overall_feeling"][number];
    readonly productDate: string;
    readonly taskPatch?: {
      readonly expectedRevision: number;
      readonly status: EveningView["options"]["task_status"][number];
      readonly taskRef: string;
    };
  }): Promise<EveningEnvelope>;
}

export interface C013Api {
  getWeeklyCurrent(): Promise<WeeklyEnvelope>;
  getWeeklyWindow(endProductDate: string): Promise<WeeklyEnvelope>;
}

export interface C014Api {
  cancelDataTask(input: {
    readonly commandRef: string;
    readonly expectedTaskRevision: number;
    readonly taskRef: string;
  }): Promise<DataTaskEnvelope>;
  confirmAccountDeletion(input: {
    readonly challengeRef: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedAccountRevision: number;
    readonly identityVerificationRef: string;
  }): Promise<AccountDeletionAcceptedEnvelope>;
  confirmRelationshipDeletion(input: {
    readonly challengeRef: string;
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedDayRevisions: ReadonlyArray<{
      readonly expected_revision: number;
      readonly product_date: string;
    }>;
    readonly expectedRelationshipRevision: number;
    readonly identityVerificationRef?: string;
    readonly includedDayProductDates: readonly string[];
  }): Promise<DataTaskEnvelope>;
  createDataExport(input: {
    readonly commandRef: string;
    readonly confirmationVersion: string;
  }): Promise<DataTaskEnvelope>;
  downloadDataExport(input: {
    readonly downloadRef: string;
    readonly taskRef: string;
  }): Promise<DataExportDocument>;
  deleteDay(input: {
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedRevision: number;
    readonly productDate: string;
  }): Promise<DataTaskEnvelope>;
  deleteMatter(input: {
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedRevision: number;
    readonly matterRef: string;
  }): Promise<DataTaskEnvelope>;
  getDataTask(taskRef: string): Promise<DataTaskEnvelope>;
  getDataRightsSummary(): Promise<DataRightsSummaryEnvelope>;
  getDeletionStatus(input: {
    readonly statusToken: string;
    readonly taskRef: string;
  }): Promise<DataTaskEnvelope>;
  listDataTasks(): Promise<DataTaskListEnvelope>;
  prepareAccountDeletion(input: {
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedAccountRevision: number;
  }): Promise<DeletionConfirmationEnvelope>;
  prepareRelationshipDeletion(input: {
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedDayRevisions: ReadonlyArray<{
      readonly expected_revision: number;
      readonly product_date: string;
    }>;
    readonly expectedRelationshipRevision: number;
    readonly includedDayProductDates: readonly string[];
  }): Promise<DeletionConfirmationEnvelope>;
  verifyDeletionIdentity(input: {
    readonly challengeRef: string;
    readonly commandRef: string;
    readonly wechatCode: string;
  }): Promise<IdentityVerificationEnvelope>;
}

export interface C015Api {
  submitAnalyticsSignal(input: ClientAnalyticsSignalRequest): Promise<void>;
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
    public readonly currentEvening?: EveningView,
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
    (status !== 200 && status !== 202) ||
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
  const currentEvening = isRecord(error?.details)
    ? safeEveningView(error.details.current)
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
    currentEvening,
  );
}

function safeEveningView(value: unknown): EveningView | undefined {
  try {
    return projectEveningView(value);
  } catch {
    return undefined;
  }
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
    !isProductDate(data.product_date)
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
  const evening =
    data.evening === undefined ? undefined : projectEveningView(data.evening);
  if (
    (checkin === undefined &&
      content === undefined &&
      interaction === undefined) ||
    [
      checkin?.product_date,
      content?.product_date,
      interaction?.product_date,
      evening?.product_date,
    ]
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
    ...(evening === undefined ? {} : { evening }),
  });
}

export function projectHistoryListView(value: unknown): HistoryListView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["items", "next_cursor", "page_info"]) ||
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > 50 ||
    !isRecord(value.page_info) ||
    !hasOnlyKeys(value.page_info, ["has_more"]) ||
    typeof value.page_info.has_more !== "boolean" ||
    (value.next_cursor !== undefined &&
      (typeof value.next_cursor !== "string" ||
        value.next_cursor.length < 1 ||
        value.next_cursor.length > 512)) ||
    value.page_info.has_more !== (value.next_cursor !== undefined)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  let previous = "9999-12-31";
  const dates = new Set<string>();
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, [
        "product_date",
        "state",
        "is_lit",
        "has_result",
        "has_evening_feedback",
      ]) ||
      !isProductDate(item.product_date) ||
      !["RECORDED", "MISSING"].includes(String(item.state)) ||
      typeof item.is_lit !== "boolean" ||
      typeof item.has_result !== "boolean" ||
      typeof item.has_evening_feedback !== "boolean" ||
      item.product_date >= previous ||
      dates.has(item.product_date) ||
      (item.state === "MISSING" &&
        (item.is_lit || item.has_result || item.has_evening_feedback)) ||
      (item.is_lit && !item.has_result)
    ) {
      throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
    }
    previous = item.product_date;
    dates.add(item.product_date);
  }
  return freezeJson(value) as HistoryListView;
}

export function projectEveningView(value: unknown): EveningView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "contract",
      "schema_version",
      "product_date",
      "availability",
      "write_window",
      "unavailable_message",
      "feedback",
      "helpfulness",
      "task",
      "options",
      "note_max_characters",
      "primary_action",
      "completion_message",
    ]) ||
    value.contract !== "evening-feedback-view" ||
    value.schema_version !== "1.0.0" ||
    !isProductDate(value.product_date) ||
    ![
      "UNAVAILABLE",
      "EDITABLE_EMPTY",
      "EDITABLE_SUBMITTED",
      "READ_ONLY_SUBMITTED",
      "READ_ONLY_EMPTY",
    ].includes(String(value.availability)) ||
    !["OPEN", "CONTINUATION_ONLY", "CLOSED"].includes(
      String(value.write_window),
    ) ||
    !isRecord(value.helpfulness) ||
    typeof value.helpfulness.revision !== "number" ||
    !Number.isInteger(value.helpfulness.revision) ||
    value.helpfulness.revision < 0 ||
    !["UNRATED", "HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"].includes(
      String(value.helpfulness.rating),
    ) ||
    !isRecord(value.options) ||
    !Array.isArray(value.options.overall_feeling) ||
    value.options.overall_feeling.join("|") !==
      "VERY_HEAVY|SOMEWHAT_HEAVY|STEADY|PRETTY_GOOD|LIGHT|UNSURE" ||
    !Array.isArray(value.options.helpfulness) ||
    value.options.helpfulness.join("|") !==
      "HELPFUL|NEUTRAL|NOT_HELPFUL|NOT_USED" ||
    !Array.isArray(value.options.task_status) ||
    value.options.task_status.join("|") !==
      "UNMARKED|INTERESTED|COMPLETED|SKIPPED" ||
    value.note_max_characters !== 80 ||
    !["SAVE", "SAVE_CHANGES", "READ_ONLY"].includes(
      String(value.primary_action),
    ) ||
    !isText(value.completion_message)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  const feedback = value.feedback;
  const submitted = String(value.availability).endsWith("SUBMITTED");
  if (
    submitted !== isRecord(feedback) ||
    (isRecord(feedback) &&
      (!hasOnlyKeys(feedback, [
        "revision",
        "overall_feeling",
        "note",
        "first_submitted_at",
        "updated_at",
      ]) ||
        typeof feedback.revision !== "number" ||
        feedback.revision < 1 ||
        ![
          "VERY_HEAVY",
          "SOMEWHAT_HEAVY",
          "STEADY",
          "PRETTY_GOOD",
          "LIGHT",
          "UNSURE",
        ].includes(String(feedback.overall_feeling)) ||
        (feedback.note !== undefined && typeof feedback.note !== "string") ||
        !isTimestamp(feedback.first_submitted_at) ||
        !isTimestamp(feedback.updated_at))) ||
    (value.task !== undefined &&
      (!isRecord(value.task) ||
        !isOpaqueRef(value.task.task_id) ||
        !isText(value.task.instruction) ||
        typeof value.task.revision !== "number" ||
        value.task.revision < 1 ||
        !["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"].includes(
          String(value.task.status),
        )))
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as EveningView;
}

export function projectWeeklyView(value: unknown): WeeklyView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "contract",
      "schema_version",
      "window_id",
      "window_start_date",
      "window_end_date",
      "projection_version",
      "coverage",
      "days",
      "metrics",
      "activity",
      "summary",
      "summary_status",
      "data_disclosure",
      "relationship_display_token",
    ]) ||
    value.contract !== "weekly-summary-view" ||
    value.schema_version !== "1.0.0" ||
    !isOpaqueRef(value.window_id) ||
    !isProductDate(value.window_start_date) ||
    !isProductDate(value.window_end_date) ||
    !isText(value.projection_version) ||
    !isRecord(value.coverage) ||
    !Array.isArray(value.days) ||
    value.days.length !== 7 ||
    !Array.isArray(value.metrics) ||
    value.metrics.length !== 4 ||
    !isRecord(value.activity) ||
    !isText(value.data_disclosure) ||
    ![
      "NOT_ELIGIBLE",
      "ELIGIBLE",
      "GENERATING",
      "AVAILABLE",
      "INVALIDATED",
      "FAILED",
    ].includes(String(value.summary_status)) ||
    (value.relationship_display_token !== undefined &&
      !isText(value.relationship_display_token))
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  const dates = value.days.map((day) =>
    isRecord(day) && isProductDate(day.product_date)
      ? day.product_date
      : undefined,
  );
  if (
    dates.some((date) => date === undefined) ||
    dates[0] !== value.window_start_date ||
    dates[6] !== value.window_end_date ||
    dates.some(
      (date, index) =>
        index > 0 &&
        Date.parse(`${date}T00:00:00Z`) -
          Date.parse(`${dates[index - 1]}T00:00:00Z`) !==
          86_400_000,
    ) ||
    !isWeeklyCoverage(value.coverage, value.days) ||
    value.days.some((day) => !isWeeklyDay(day)) ||
    !isWeeklyMetrics(value.metrics) ||
    !isWeeklyActivity(value.activity) ||
    !isWeeklySummary(value.summary, String(value.summary_status))
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as WeeklyView;
}

function isWeeklyCoverage(
  value: Record<string, unknown>,
  days: readonly unknown[],
): boolean {
  if (
    !hasOnlyKeys(value, [
      "level",
      "window_day_count",
      "real_state_day_count",
      "checkin_day_count",
      "evening_feedback_day_count",
      "lit_day_count",
      "missing_dates",
    ]) ||
    !["EMPTY", "POINTS_ONLY", "PARTIAL", "COMPLETE"].includes(
      String(value.level),
    ) ||
    value.window_day_count !== 7 ||
    !Array.isArray(value.missing_dates) ||
    value.missing_dates.some((date) => !isProductDate(date))
  ) {
    return false;
  }
  const records = days.filter(
    (day) => isRecord(day) && day.state === "RECORDED",
  ).length;
  const checkins = days.filter(
    (day) => isRecord(day) && day.morning !== undefined,
  ).length;
  const evenings = days.filter(
    (day) => isRecord(day) && day.evening !== undefined,
  ).length;
  const lit = days.filter((day) => isRecord(day) && day.is_lit === true).length;
  return (
    value.real_state_day_count === records &&
    value.checkin_day_count === checkins &&
    value.evening_feedback_day_count === evenings &&
    value.lit_day_count === lit &&
    value.missing_dates.length === 7 - records
  );
}

function isWeeklyDay(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "product_date",
      "state",
      "morning",
      "evening",
      "is_lit",
      "helpfulness",
      "task_status",
    ]) ||
    !isProductDate(value.product_date) ||
    !["RECORDED", "MISSING"].includes(String(value.state)) ||
    typeof value.is_lit !== "boolean" ||
    (value.helpfulness !== undefined &&
      !["UNRATED", "HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"].includes(
        String(value.helpfulness),
      )) ||
    (value.task_status !== undefined &&
      !["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"].includes(
        String(value.task_status),
      ))
  ) {
    return false;
  }
  const morning = value.morning;
  const evening = value.evening;
  const validMorning =
    morning === undefined ||
    (isRecord(morning) &&
      hasOnlyKeys(morning, ["mood", "energy", "sleep"]) &&
      isCheckinMood(morning.mood) &&
      isCheckinEnergy(morning.energy) &&
      isCheckinSleep(morning.sleep));
  const validEvening =
    evening === undefined ||
    (isRecord(evening) &&
      hasOnlyKeys(evening, ["overall_feeling"]) &&
      [
        "VERY_HEAVY",
        "SOMEWHAT_HEAVY",
        "STEADY",
        "PRETTY_GOOD",
        "LIGHT",
        "UNSURE",
      ].includes(String(evening.overall_feeling)));
  const hasState = morning !== undefined || evening !== undefined;
  return (
    validMorning && validEvening && (value.state === "RECORDED") === hasState
  );
}

function isWeeklyMetrics(values: readonly unknown[]): boolean {
  const ids = new Set<string>();
  for (const value of values) {
    if (
      !isRecord(value) ||
      !hasOnlyKeys(value, [
        "id",
        "observed_count",
        "unsure_count",
        "missing_count",
        "direction",
        "direction_label",
      ]) ||
      ![
        "MORNING_MOOD",
        "MORNING_ENERGY",
        "MORNING_SLEEP",
        "EVENING_OVERALL",
      ].includes(String(value.id)) ||
      !isWeeklyCount(value.observed_count) ||
      !isWeeklyCount(value.unsure_count) ||
      !isWeeklyCount(value.missing_count) ||
      Number(value.observed_count) +
        Number(value.unsure_count) +
        Number(value.missing_count) !==
        7 ||
      ![
        "INSUFFICIENT_DATA",
        "LOWER_LATE",
        "SIMILAR",
        "HIGHER_LATE",
        "VARIABLE",
      ].includes(String(value.direction)) ||
      !isText(value.direction_label)
    ) {
      return false;
    }
    ids.add(String(value.id));
  }
  return ids.size === 4;
}

function isWeeklyActivity(value: Record<string, unknown>): boolean {
  const helpfulness = value.helpfulness;
  const tasks = value.tasks;
  if (
    !hasOnlyKeys(value, ["lit_day_count", "helpfulness", "tasks"]) ||
    !isWeeklyCount(value.lit_day_count) ||
    !isRecord(helpfulness) ||
    !isRecord(tasks)
  ) {
    return false;
  }
  const helpfulnessKeys = [
    "rated_day_count",
    "helpful_count",
    "neutral_count",
    "not_helpful_count",
    "not_used_count",
    "unrated_day_count",
    "top_helpful_action_kind",
  ];
  const taskKeys = [
    "task_offered_day_count",
    "completed_count",
    "skipped_count",
    "interested_count",
    "unmarked_count",
  ];
  return (
    hasOnlyKeys(helpfulness, helpfulnessKeys) &&
    helpfulnessKeys
      .filter((key) => key !== "top_helpful_action_kind")
      .every((key) => isWeeklyCount(helpfulness[key])) &&
    (helpfulness.top_helpful_action_kind === undefined ||
      isText(helpfulness.top_helpful_action_kind)) &&
    hasOnlyKeys(tasks, taskKeys) &&
    taskKeys.every((key) => isWeeklyCount(tasks[key]))
  );
}

function isWeeklySummary(value: unknown, status: string): boolean {
  if (status !== "AVAILABLE") {
    return value === undefined;
  }
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "summary_id",
      "revision",
      "kind",
      "title",
      "paragraphs",
    ]) &&
    isOpaqueRef(value.summary_id) &&
    typeof value.revision === "number" &&
    Number.isInteger(value.revision) &&
    value.revision >= 1 &&
    ["PARTIAL_REVIEW", "COMPLETE_REVIEW"].includes(String(value.kind)) &&
    isText(value.title) &&
    Array.isArray(value.paragraphs) &&
    value.paragraphs.length >= 2 &&
    value.paragraphs.length <= 5 &&
    value.paragraphs.every(isText)
  );
}

function isWeeklyCount(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 7
  );
}

export function projectDataRightsSummaryView(
  value: unknown,
): DataRightsSummaryView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "account",
      "relationship",
      "capabilities",
      "confirmation_versions",
      "online_erasure_sla_hours",
      "backup_max_days",
    ]) ||
    !isRecord(value.account) ||
    !hasOnlyKeys(value.account, ["expected_revision", "state"]) ||
    !Number.isInteger(value.account.expected_revision) ||
    Number(value.account.expected_revision) < 1 ||
    value.account.state !== "ACTIVE" ||
    (value.relationship !== undefined &&
      (!isRecord(value.relationship) ||
        !hasOnlyKeys(value.relationship, ["expected_revision", "state"]) ||
        !Number.isInteger(value.relationship.expected_revision) ||
        Number(value.relationship.expected_revision) < 1 ||
        value.relationship.state !== "PRESENT")) ||
    !isRecord(value.capabilities) ||
    !hasOnlyKeys(value.capabilities, [
      "export_account",
      "delete_day",
      "delete_matter",
      "delete_relationship_data",
      "delete_account",
    ]) ||
    Object.values(value.capabilities).some(
      (capability) => typeof capability !== "boolean",
    ) ||
    !isRecord(value.confirmation_versions) ||
    !hasOnlyKeys(value.confirmation_versions, [
      "export_account",
      "delete_day",
      "delete_matter",
      "delete_relationship_data",
      "delete_account",
    ]) ||
    value.confirmation_versions.export_account !== "data-export-v1" ||
    value.confirmation_versions.delete_day !== "data-rights-day-v1" ||
    value.confirmation_versions.delete_matter !== "data-rights-matter-v1" ||
    value.confirmation_versions.delete_relationship_data !==
      "data-rights-relationship-v1" ||
    value.confirmation_versions.delete_account !== "data-rights-account-v1" ||
    value.online_erasure_sla_hours !== 72 ||
    value.backup_max_days !== 35
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as DataRightsSummaryView;
}

function projectExportArtifact(value: unknown) {
  if (!isRecord(value) || value.format !== "JSON") {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  if (value.state === "PREPARING" && hasOnlyKeys(value, ["state", "format"])) {
    return freezeJson(value);
  }
  if (
    value.state === "READY" &&
    hasOnlyKeys(value, [
      "state",
      "format",
      "download_ref",
      "ready_at",
      "expires_at",
    ]) &&
    isOpaqueRef(value.download_ref) &&
    isTimestamp(value.ready_at) &&
    isTimestamp(value.expires_at)
  ) {
    return freezeJson(value);
  }
  if (
    ["EXPIRED", "INVALIDATED"].includes(String(value.state)) &&
    hasOnlyKeys(value, ["state", "format"])
  ) {
    return freezeJson(value);
  }
  throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
}

export function projectDataTaskView(value: unknown): DataTaskView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "task_ref",
      "revision",
      "kind",
      "scope",
      "target_summary",
      "status",
      "online_erased_at",
      "backup_purge_deadline",
      "export_artifact",
      "can_cancel",
      "failure_summary_code",
      "created_at",
      "updated_at",
    ]) ||
    !isOpaqueRef(value.task_ref) ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) < 1 ||
    !["EXPORT", "DELETE"].includes(String(value.kind)) ||
    !["DAY", "MATTER", "RELATIONSHIP_DATA", "ACCOUNT"].includes(
      String(value.scope),
    ) ||
    !isText(value.target_summary) ||
    String(value.target_summary).length > 120 ||
    !["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"].includes(
      String(value.status),
    ) ||
    typeof value.can_cancel !== "boolean" ||
    !isTimestamp(value.created_at) ||
    !isTimestamp(value.updated_at) ||
    (value.online_erased_at !== undefined &&
      !isTimestamp(value.online_erased_at)) ||
    (value.backup_purge_deadline !== undefined &&
      !isTimestamp(value.backup_purge_deadline)) ||
    (value.failure_summary_code !== undefined &&
      !isText(value.failure_summary_code)) ||
    (value.export_artifact !== undefined &&
      projectExportArtifact(value.export_artifact) === undefined) ||
    (value.status === "FAILED" && value.failure_summary_code === undefined) ||
    (value.kind === "DELETE" &&
      value.status === "SUCCEEDED" &&
      (value.online_erased_at === undefined ||
        value.backup_purge_deadline === undefined)) ||
    (value.kind === "DELETE" && value.export_artifact !== undefined) ||
    (value.kind === "EXPORT" &&
      (value.online_erased_at !== undefined ||
        value.backup_purge_deadline !== undefined)) ||
    (value.kind === "EXPORT" &&
      ["PENDING", "RUNNING"].includes(String(value.status)) &&
      (!isRecord(value.export_artifact) ||
        value.export_artifact.state !== "PREPARING")) ||
    (value.kind === "EXPORT" &&
      value.status === "SUCCEEDED" &&
      (!isRecord(value.export_artifact) ||
        !["READY", "EXPIRED", "INVALIDATED"].includes(
          String(value.export_artifact.state),
        ))) ||
    (value.can_cancel &&
      !(value.kind === "EXPORT" && value.status === "PENDING"))
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as DataTaskView;
}

export function projectAccountDeletionAcceptedView(
  value: unknown,
): AccountDeletionAcceptedView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["task", "status_grant"]) ||
    !isRecord(value.status_grant) ||
    !hasOnlyKeys(value.status_grant, [
      "task_ref",
      "status_token",
      "expires_at",
    ]) ||
    !isOpaqueRef(value.status_grant.task_ref) ||
    typeof value.status_grant.status_token !== "string" ||
    !/^[A-Za-z0-9_-]{32,256}$/u.test(value.status_grant.status_token) ||
    !isTimestamp(value.status_grant.expires_at)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  const task = projectDataTaskView(value.task);
  if (
    task.kind !== "DELETE" ||
    task.scope !== "ACCOUNT" ||
    task.task_ref !== value.status_grant.task_ref
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return Object.freeze({
    status_grant: Object.freeze({
      expires_at: value.status_grant.expires_at as string,
      status_token: value.status_grant.status_token as string,
      task_ref: value.status_grant.task_ref as string,
    }),
    task,
  });
}

export function projectDataExportDocument(value: unknown): DataExportDocument {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "schema_version",
      "generated_at",
      "profile",
      "consent_summary",
      "days",
      "matters",
      "relationship_summary",
      "notification_preferences",
      "safety_summary",
      "data_task_summaries",
    ]) ||
    value.schema_version !== "data-export-v1" ||
    !isTimestamp(value.generated_at) ||
    !isRecord(value.consent_summary) ||
    !Array.isArray(value.days) ||
    value.days.length > 10_000 ||
    !Array.isArray(value.matters) ||
    value.matters.length > 1_000 ||
    !isRecord(value.notification_preferences) ||
    !Array.isArray(value.data_task_summaries) ||
    value.data_task_summaries.length > 1_000 ||
    containsForbiddenExportField(value)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as DataExportDocument;
}

function containsForbiddenExportField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenExportField);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(
    ([key, item]) =>
      /^(status_token|.*ciphertext|.*key_version|.*seed.*|.*epoch.*|source_fingerprint|prompt|provider.*|checkpoint|receipt)$/iu.test(
        key,
      ) || containsForbiddenExportField(item),
  );
}

export function projectDataTaskListView(value: unknown): DataTaskListView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["items", "next_cursor", "page_info"]) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    !isRecord(value.page_info) ||
    !hasOnlyKeys(value.page_info, ["has_more"]) ||
    typeof value.page_info.has_more !== "boolean" ||
    (value.next_cursor !== undefined && !isText(value.next_cursor)) ||
    value.page_info.has_more !== (value.next_cursor !== undefined)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  const items = value.items.map(projectDataTaskView);
  return Object.freeze({
    items,
    ...(typeof value.next_cursor === "string"
      ? { next_cursor: value.next_cursor }
      : {}),
    page_info: Object.freeze({ has_more: value.page_info.has_more }),
  });
}

export function projectDeletionConfirmationView(
  value: unknown,
): DeletionConfirmationView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "confirmation_challenge_ref",
      "scope",
      "target",
      "confirmation_version",
      "expected_revision",
      "expected_day_revisions",
      "immediate_effects",
      "derived_effects",
      "online_erasure_sla_hours",
      "backup_max_days",
      "identity_reverification_required",
      "expires_at",
    ]) ||
    !isOpaqueRef(value.confirmation_challenge_ref) ||
    !["RELATIONSHIP_DATA", "ACCOUNT"].includes(String(value.scope)) ||
    !isRecord(value.target) ||
    !isText(value.confirmation_version) ||
    !Number.isInteger(value.expected_revision) ||
    Number(value.expected_revision) < 1 ||
    !Array.isArray(value.immediate_effects) ||
    value.immediate_effects.length < 1 ||
    value.immediate_effects.length > 12 ||
    !value.immediate_effects.every(isText) ||
    !Array.isArray(value.derived_effects) ||
    value.derived_effects.length > 12 ||
    !value.derived_effects.every(isText) ||
    value.online_erasure_sla_hours !== 72 ||
    value.backup_max_days !== 35 ||
    typeof value.identity_reverification_required !== "boolean" ||
    !isTimestamp(value.expires_at)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  if (value.scope === "ACCOUNT") {
    if (
      !hasOnlyKeys(value.target, ["subject"]) ||
      value.target.subject !== "SELF" ||
      value.expected_day_revisions !== undefined ||
      value.identity_reverification_required !== true
    ) {
      throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
    }
  } else {
    const dates = value.target.included_day_product_dates;
    const revisions = value.expected_day_revisions;
    if (
      !hasOnlyKeys(value.target, [
        "relationship_scope",
        "included_day_product_dates",
      ]) ||
      value.target.relationship_scope !== "CURRENT_CYCLE_AND_HISTORY" ||
      !Array.isArray(dates) ||
      dates.length > 45 ||
      !dates.every(isProductDate) ||
      !Array.isArray(revisions) ||
      revisions.length !== dates.length ||
      revisions.some(
        (item, index) =>
          !isRecord(item) ||
          item.product_date !== dates[index] ||
          !Number.isInteger(item.expected_revision) ||
          Number(item.expected_revision) < 0,
      )
    ) {
      throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
    }
  }
  return freezeJson(value) as DeletionConfirmationView;
}

export function projectIdentityVerificationView(
  value: unknown,
): IdentityVerificationView {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "identity_verification_ref",
      "confirmation_challenge_ref",
      "expires_at",
    ]) ||
    !isOpaqueRef(value.identity_verification_ref) ||
    !isOpaqueRef(value.confirmation_challenge_ref) ||
    !isTimestamp(value.expires_at)
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 200, false);
  }
  return freezeJson(value) as IdentityVerificationView;
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

function deletionStatusHeaders(statusToken: string) {
  return Object.freeze({
    "Accept-Language": "zh-CN",
    Authorization: `DeletionStatus ${statusToken}`,
  });
}

function relationshipDeletionBody(
  input: {
    readonly commandRef: string;
    readonly confirmationVersion: string;
    readonly expectedDayRevisions: ReadonlyArray<{
      readonly expected_revision: number;
      readonly product_date: string;
    }>;
    readonly expectedRelationshipRevision: number;
    readonly includedDayProductDates: readonly string[];
  },
  confirmed: boolean,
) {
  if (
    input.includedDayProductDates.length !==
      input.expectedDayRevisions.length ||
    input.includedDayProductDates.some(
      (date, index) =>
        !isProductDate(date) ||
        input.expectedDayRevisions[index]?.product_date !== date,
    )
  ) {
    throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
  }
  return {
    command_ref: input.commandRef,
    confirmation_version: input.confirmationVersion,
    expected_relationship_revision: input.expectedRelationshipRevision,
    included_day_expected_revisions: input.expectedDayRevisions,
    scope: "RELATIONSHIP_DATA" as const,
    target: {
      included_day_product_dates: input.includedDayProductDates,
      relationship_scope: "CURRENT_CYCLE_AND_HISTORY" as const,
    },
    ...(confirmed ? { confirmed: true as const } : {}),
  };
}

export function createMiniappApi(
  network: NetworkPort,
): C003Api &
  C004Api &
  C009Api &
  C010Api &
  C011Api &
  C012Api &
  C013Api &
  C014Api &
  C015Api {
  let sessionToken: string | undefined;

  const api: C003Api &
    C004Api &
    C009Api &
    C010Api &
    C011Api &
    C012Api &
    C013Api &
    C014Api &
    C015Api = {
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

    async lightDay(input): Promise<DailyInteractionEnvelope> {
      if (!isProductDate(input.productDate) || !isOpaqueRef(input.resultRef)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          product_date: input.productDate,
          result_ref: input.resultRef,
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/daily/interaction/light",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        interaction: projectInteractionView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async listHistory(): Promise<HistoryListEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/history/days",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        history: projectHistoryListView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async getEvening(): Promise<EveningEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/evening/today",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        evening: projectEveningView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async getWeeklyCurrent(): Promise<WeeklyEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/weekly/current",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        weekly: projectWeeklyView(parsed.data),
      });
    },

    async getWeeklyWindow(endProductDate): Promise<WeeklyEnvelope> {
      if (!isProductDate(endProductDate)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: `/v1/weekly/window/${encodeURIComponent(endProductDate)}`,
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        weekly: projectWeeklyView(parsed.data),
      });
    },

    async getDataRightsSummary(): Promise<DataRightsSummaryEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/data-rights/summary",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        summary: projectDataRightsSummaryView(parsed.data),
      });
    },

    async listDataTasks(): Promise<DataTaskListEnvelope> {
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: "/v1/data-rights/tasks",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        tasks: projectDataTaskListView(parsed.data),
      });
    },

    async getDataTask(taskRef): Promise<DataTaskEnvelope> {
      if (!isOpaqueRef(taskRef)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: `/v1/data-rights/tasks/${encodeURIComponent(taskRef)}`,
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        task: projectDataTaskView(parsed.data),
      });
    },

    async createDataExport(input): Promise<DataTaskEnvelope> {
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          confirmation_version: input.confirmationVersion,
          export_format: "JSON",
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/data-rights/export",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        task: projectDataTaskView(parsed.data),
      });
    },

    async downloadDataExport(input): Promise<DataExportDocument> {
      if (!isOpaqueRef(input.taskRef) || !isOpaqueRef(input.downloadRef)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        headers: headers(sessionToken),
        method: "GET",
        path: `/v1/data-rights/exports/${encodeURIComponent(input.taskRef)}/artifacts/${encodeURIComponent(input.downloadRef)}`,
      });
      if (response.statusCode !== 200) {
        throw apiError(response.data, response.statusCode);
      }
      return projectDataExportDocument(response.data);
    },

    async deleteDay(input): Promise<DataTaskEnvelope> {
      if (!isProductDate(input.productDate)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          confirmation_version: input.confirmationVersion,
          confirmed: true,
          expected_revision: input.expectedRevision,
          scope: "DAY",
          target: { product_date: input.productDate },
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/data-rights/delete/day",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        task: projectDataTaskView(parsed.data),
      });
    },

    async deleteMatter(input): Promise<DataTaskEnvelope> {
      if (!isOpaqueRef(input.matterRef)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          confirmation_version: input.confirmationVersion,
          confirmed: true,
          expected_revision: input.expectedRevision,
          scope: "MATTER",
          target: { matter_ref: input.matterRef },
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/data-rights/delete/matter",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        task: projectDataTaskView(parsed.data),
      });
    },

    async prepareRelationshipDeletion(
      input,
    ): Promise<DeletionConfirmationEnvelope> {
      const response = await network.request({
        body: relationshipDeletionBody(input, false),
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/data-rights/delete/relationship/prepare",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        confirmation: projectDeletionConfirmationView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async confirmRelationshipDeletion(input): Promise<DataTaskEnvelope> {
      const response = await network.request({
        body: {
          ...relationshipDeletionBody(input, true),
          confirmation_challenge_ref: input.challengeRef,
          ...(input.identityVerificationRef === undefined
            ? {}
            : { identity_verification_ref: input.identityVerificationRef }),
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/data-rights/delete/relationship/confirm",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        task: projectDataTaskView(parsed.data),
      });
    },

    async prepareAccountDeletion(input): Promise<DeletionConfirmationEnvelope> {
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          confirmation_version: input.confirmationVersion,
          expected_account_revision: input.expectedAccountRevision,
          scope: "ACCOUNT",
          target: { subject: "SELF" },
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/data-rights/delete/account/prepare",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        confirmation: projectDeletionConfirmationView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async verifyDeletionIdentity(input): Promise<IdentityVerificationEnvelope> {
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          confirmation_challenge_ref: input.challengeRef,
          wechat_code: input.wechatCode,
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/auth/reauth/verify",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        verification: projectIdentityVerificationView(parsed.data),
      });
    },

    async confirmAccountDeletion(
      input,
    ): Promise<AccountDeletionAcceptedEnvelope> {
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          confirmation_challenge_ref: input.challengeRef,
          confirmation_version: input.confirmationVersion,
          confirmed: true,
          expected_account_revision: input.expectedAccountRevision,
          identity_verification_ref: input.identityVerificationRef,
          scope: "ACCOUNT",
          target: { subject: "SELF" },
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/data-rights/delete/account/confirm",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        accepted: projectAccountDeletionAcceptedView(parsed.data),
        productDate: parsed.productDate,
      });
    },

    async getDeletionStatus(input): Promise<DataTaskEnvelope> {
      if (
        !isOpaqueRef(input.taskRef) ||
        !/^[A-Za-z0-9_-]{32,256}$/u.test(input.statusToken)
      ) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        headers: deletionStatusHeaders(input.statusToken),
        method: "GET",
        path: `/v1/data-rights/deletion-status/${encodeURIComponent(input.taskRef)}`,
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        task: projectDataTaskView(parsed.data),
      });
    },

    async cancelDataTask(input): Promise<DataTaskEnvelope> {
      if (!isOpaqueRef(input.taskRef)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          expected_task_revision: input.expectedTaskRevision,
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: `/v1/data-rights/tasks/${encodeURIComponent(input.taskRef)}/cancel`,
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        productDate: parsed.productDate,
        task: projectDataTaskView(parsed.data),
      });
    },

    async submitAnalyticsSignal(input): Promise<void> {
      const response = await network.request({
        body: input as StorageValue,
        headers: headers(),
        method: "POST",
        path: "/v1/analytics/signals",
        timeoutMs: 2_000,
      });
      const parsed = successData(response.data, response.statusCode);
      if (
        parsed.data.accepted !== true ||
        Object.keys(parsed.data).length !== 1
      ) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 202, false);
      }
    },

    async saveEvening(input): Promise<EveningEnvelope> {
      if (!isProductDate(input.productDate)) {
        throw new MiniappApiError("CONTRACT_VIOLATION", 0, false);
      }
      const response = await network.request({
        body: {
          command_ref: input.commandRef,
          product_date: input.productDate,
          expected_feedback_revision: input.expectedFeedbackRevision,
          expected_helpfulness_revision: input.expectedHelpfulnessRevision,
          overall_feeling: input.overallFeeling,
          helpfulness_rating: input.helpfulnessRating,
          ...(input.taskPatch === undefined
            ? {}
            : {
                task_patch: {
                  task_ref: input.taskPatch.taskRef,
                  expected_revision: input.taskPatch.expectedRevision,
                  status: input.taskPatch.status,
                },
              }),
          ...(input.notePatch === undefined
            ? {}
            : { note_patch: input.notePatch }),
          client_context: {
            entry_source: "TODAY_EVENING_CARD",
            view_schema_version: "1.0.0",
          },
        },
        headers: headers(sessionToken, input.commandRef),
        method: "POST",
        path: "/v1/evening/save",
      });
      const parsed = successData(response.data, response.statusCode);
      return Object.freeze({
        evening: projectEveningView(parsed.data),
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
