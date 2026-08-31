// @generated
// generator: daily-energy-contract-codegen/1.0.0
// source-fingerprint: sha256:f0d7840a96f4a66fe0a833bc9ea4fdd40c80ed02837adfe9ff706c3ad66a1b47
// do not edit; run `pnpm codegen`.

export const ADMIN_CONTRACT_SOURCE_FINGERPRINT =
  "sha256:f0d7840a96f4a66fe0a833bc9ea4fdd40c80ed02837adfe9ff706c3ad66a1b47";

export interface paths {
  "/admin/auth/login": {
    post: operations["adminLogin"];
  };
  "/admin/data-rights/tasks": {
    get: operations["adminListDataTasks"];
  };
  "/admin/data-rights/tasks/{task_ref}/advance": {
    post: operations["adminAdvanceDataTask"];
  };
  "/admin/ops/overview": {
    get: operations["adminOpsOverview"];
  };
  "/admin/safety/events": {
    get: operations["adminListSafetyEvents"];
  };
}

export interface components {
  schemas: {
    AdminAdvanceDataTaskRequest: {
      checkpoint: components["schemas"]["VersionToken"];
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_task_revision: components["schemas"]["PositiveRevision"];
      reason_code: components["schemas"]["VersionToken"];
    };
    AdminLoginRequest: {
      authorization_code: string;
      mfa_code: string;
    };
    AdminOpsOverviewView: {
      cost_minor_units: number;
      degraded_count: number;
      p95_latency_ms: number;
      queue_depth: number;
      request_success_rate: number;
      safety_alert_count: number;
      window_end: string;
      window_start: string;
    };
    AdminSafetyEventListView: {
      items: Array<components["schemas"]["AdminSafetyEventView"]>;
      next_cursor?: string;
      page_info: {
        has_more: boolean;
      };
    };
    AdminSafetyEventView: {
      category_bucket: components["schemas"]["VersionToken"];
      created_at: string;
      event_ref: components["schemas"]["OpaqueRef"];
      policy_version: components["schemas"]["VersionToken"];
    };
    AdminSessionView: {
      admin_session_token: string;
      expires_at: string;
      roles: Array<components["schemas"]["VersionToken"]>;
    };
    ApiError: {
      category:
        | "AUTH"
        | "GUARD"
        | "VALIDATION"
        | "CONFLICT"
        | "NOT_FOUND"
        | "RATE_LIMIT"
        | "TRANSIENT"
        | "TERMINAL"
        | "SAFETY";
      code:
        | "ACCOUNT_DELETED"
        | "ACCOUNT_DELETING"
        | "ACCOUNT_RESTRICTED"
        | "AUTH_ADMIN_REQUIRED"
        | "AUTH_INVALID"
        | "AUTH_REQUIRED"
        | "AUTH_REVERIFICATION_FAILED"
        | "AUTH_REVERIFICATION_REQUIRED"
        | "AUTH_SESSION_EXPIRED"
        | "AUTH_WECHAT_CODE_INVALID"
        | "CHECKIN_ALREADY_EXISTS"
        | "CHECKIN_INCOMPLETE"
        | "COMMAND_NOT_FOUND"
        | "CONFIRMATION_CHALLENGE_EXPIRED"
        | "CONFIRMATION_CHALLENGE_USED"
        | "CONFIRMATION_MISMATCH"
        | "CONFIRMATION_REQUIRED"
        | "CONSENT_REQUIRED"
        | "CONTRACT_VIOLATION"
        | "DATA_TASK_NOT_CANCELLABLE"
        | "DATA_TASK_SCOPE_INVALID"
        | "DAY_REBUILD_GUARD_UNAVAILABLE"
        | "DAY_REBUILD_NOT_CURRENT"
        | "DAY_REBUILD_TASK_FAILED"
        | "DAY_REBUILD_TASK_PENDING"
        | "DAY_REBUILD_VERSION_UNAVAILABLE"
        | "DEPENDENCY_UNAVAILABLE"
        | "EXPORT_NOT_READY"
        | "FEATURE_DISABLED"
        | "GENERATION_FAILED_RETRYABLE"
        | "GENERATION_FAILED_TERMINAL"
        | "GENERATION_PENDING"
        | "IDEMPOTENCY_CONFLICT"
        | "INTERNAL_TERMINAL"
        | "INVALID_COMMAND_REF"
        | "MAINTENANCE_BLOCKING"
        | "MAINTENANCE_DEGRADED"
        | "NOTE_OPERATION_INVALID"
        | "ONBOARDING_REQUIRED"
        | "PAYLOAD_TOO_LARGE"
        | "RATE_LIMITED"
        | "RESOURCE_NOT_FOUND"
        | "REVISION_CONFLICT"
        | "SAFETY_BLOCKED"
        | "SAFETY_INDETERMINATE"
        | "SAFETY_OVERLAY"
        | "SAFETY_RECOVERY_PRECONDITION"
        | "SOURCE_CHANGED"
        | "STATE_PRECONDITION_FAILED"
        | "TASK_NOT_FOUND"
        | "UNIQUE_ALREADY_EXISTS"
        | "UNSUPPORTED_LOCALE"
        | "UPSTREAM_TRANSIENT"
        | "VALIDATION_FAILED"
        | "VIEW_CONTINUATION_EXPIRED"
        | "WRITE_WINDOW_CLOSED";
      command_receipt?: components["schemas"]["CommandReceiptView"];
      details?: components["schemas"]["ErrorDetails"];
      message: string;
      message_key: components["schemas"]["VersionToken"];
      retryable: boolean;
      safety_view?: components["schemas"]["SafetyView"];
    };
    ApiErrorBody: {
      error: components["schemas"]["ApiError"];
      ok: false;
      product_date?: components["schemas"]["ProductDate"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessAdminOps: {
      data: components["schemas"]["AdminOpsOverviewView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessAdminSafetyEvents: {
      data: components["schemas"]["AdminSafetyEventListView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessAdminSession: {
      data: components["schemas"]["AdminSessionView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessDataTask: {
      data: components["schemas"]["DataTaskView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessDataTaskList: {
      data: components["schemas"]["DataTaskListView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    CheckinView: {
      checkin_ref: string;
      energy: "EMPTY" | "LOW" | "STEADY" | "HIGH" | "FULL" | "UNSURE";
      mood: "VERY_LOW" | "LOW" | "STEADY" | "GOOD" | "LIGHT" | "UNSURE";
      product_date: string;
      revision: number;
      sleep: "POOR" | "LOW" | "OKAY" | "GOOD" | "UNSURE";
      updated_at: string;
      write_window: "OPEN" | "CONTINUATION_ONLY" | "CLOSED";
    };
    ClientContext: {
      app_version?: string;
      scene?: string;
    };
    CommandReceiptView: {
      command_ref: components["schemas"]["CommandRef"];
      operation: components["schemas"]["VersionToken"];
      outcome:
        "ACCEPTED" | "DUPLICATE" | "CONFLICT" | "REJECTED" | "UNKNOWN_PENDING";
      resource_refs?: components["schemas"]["CommandResourceRefs"];
    };
    CommandRef: string;
    CommandResourceRefs: {
      checkin_ref?: components["schemas"]["OpaqueRef"];
      feedback_ref?: components["schemas"]["OpaqueRef"];
      intent_ref?: components["schemas"]["OpaqueRef"];
      matter_ref?: components["schemas"]["OpaqueRef"];
      recovery_ref?: components["schemas"]["OpaqueRef"];
      result_ref?: components["schemas"]["OpaqueRef"];
      share_ref?: components["schemas"]["OpaqueRef"];
      task_ref?: components["schemas"]["OpaqueRef"];
    };
    DailyInteractionView: {
      contract: "daily-interaction-state";
      helpfulness: {
        rating: "UNRATED" | "HELPFUL" | "NEUTRAL" | "NOT_HELPFUL" | "NOT_USED";
        revision: number;
      };
      is_lit: boolean;
      product_date: string;
      result_id: string;
      schema_version: string;
      task: {
        revision: number;
        status: "UNMARKED" | "INTERESTED" | "COMPLETED" | "SKIPPED";
        task_id: string;
      };
      updated_at: string;
    };
    DataTaskListView: {
      items: Array<components["schemas"]["DataTaskView"]>;
      next_cursor?: string;
      page_info: {
        has_more: boolean;
      };
    };
    DataTaskView: {
      backup_purge_deadline?: string;
      can_cancel: boolean;
      created_at: string;
      failure_summary_code?: components["schemas"]["VersionToken"];
      kind: "EXPORT" | "DELETE";
      online_erased_at?: string;
      revision: components["schemas"]["PositiveRevision"];
      scope: "DAY" | "MATTER" | "RELATIONSHIP_DATA" | "ACCOUNT";
      status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
      target_summary: string;
      task_ref: components["schemas"]["OpaqueRef"];
      updated_at: string;
    };
    ErrorCurrentView:
      | components["schemas"]["CheckinView"]
      | components["schemas"]["ProfileView"]
      | components["schemas"]["DailyInteractionView"]
      | components["schemas"]["EveningView"]
      | components["schemas"]["MatterView"]
      | components["schemas"]["MemoryPreferencesView"]
      | components["schemas"]["NotificationSettingsView"]
      | components["schemas"]["SafetyView"]
      | components["schemas"]["DataTaskView"];
    ErrorDetails: {
      current?: components["schemas"]["ErrorCurrentView"];
      current_product_date?: components["schemas"]["ProductDate"];
      current_revision?: components["schemas"]["Revision"];
      fields?: Array<components["schemas"]["FieldError"]>;
      reason?: components["schemas"]["VersionToken"];
      retry_after_seconds?: number;
    };
    EveningView: {
      availability:
        | "UNAVAILABLE"
        | "EDITABLE_EMPTY"
        | "EDITABLE_SUBMITTED"
        | "READ_ONLY_SUBMITTED"
        | "READ_ONLY_EMPTY";
      completion_message: string;
      contract: "evening-feedback-view";
      feedback?: {
        first_submitted_at: string;
        note?: string;
        overall_feeling:
          | "VERY_HEAVY"
          | "SOMEWHAT_HEAVY"
          | "STEADY"
          | "PRETTY_GOOD"
          | "LIGHT"
          | "UNSURE";
        revision: number;
        updated_at: string;
      };
      helpfulness: {
        rating: "UNRATED" | "HELPFUL" | "NEUTRAL" | "NOT_HELPFUL" | "NOT_USED";
        revision: number;
      };
      note_max_characters: 80;
      options: {
        helpfulness: Array<"HELPFUL" | "NEUTRAL" | "NOT_HELPFUL" | "NOT_USED">;
        overall_feeling: Array<
          | "VERY_HEAVY"
          | "SOMEWHAT_HEAVY"
          | "STEADY"
          | "PRETTY_GOOD"
          | "LIGHT"
          | "UNSURE"
        >;
        task_status: Array<"UNMARKED" | "INTERESTED" | "COMPLETED" | "SKIPPED">;
      };
      primary_action: "SAVE" | "SAVE_CHANGES" | "READ_ONLY";
      product_date: string;
      schema_version: string;
      task?: {
        instruction: string;
        revision: number;
        status: "UNMARKED" | "INTERESTED" | "COMPLETED" | "SKIPPED";
        task_id: string;
      };
      unavailable_message?: string;
      write_window: "OPEN" | "CONTINUATION_ONLY" | "CLOSED";
    };
    ExpressionStyle: "BALANCED" | "GENTLE" | "LIGHT_HUMOR" | "CLEAR_DIRECT";
    FieldError: {
      field: string;
      reason: components["schemas"]["VersionToken"];
    };
    MatterView: {
      daily_use_granted: boolean;
      matter_ref: components["schemas"]["OpaqueRef"];
      revision: components["schemas"]["PositiveRevision"];
      status: "ACTIVE" | "PAUSED" | "COMPLETED" | "EXPIRED";
      target_date?: components["schemas"]["ProductDate"];
      title: string;
      updated_at: string;
      weekly_use_granted: boolean;
    };
    MemoryPreferencesView: {
      daily_use_enabled: boolean;
      master_enabled: boolean;
      revision: components["schemas"]["PositiveRevision"];
      updated_at: string;
      weekly_use_enabled: boolean;
    };
    NotificationSettingsView: {
      evening_enabled: boolean;
      morning_enabled: boolean;
      observed_permission: "UNKNOWN" | "GRANTED" | "DENIED" | "REVOKED";
      revision: components["schemas"]["PositiveRevision"];
      updated_at: string;
    };
    OpaqueRef: string;
    PositiveRevision: number;
    ProductDate: string;
    ProfileView: {
      expression_style: components["schemas"]["ExpressionStyle"];
      onboarding_completed: boolean;
      preferred_name?: string;
      revision: components["schemas"]["PositiveRevision"];
      updated_at: string;
    };
    RequestId: string;
    Revision: number;
    SafetyBlockView: {
      block_id: components["schemas"]["VersionToken"];
      copy: string;
      kind:
        | "DIRECT_ACKNOWLEDGEMENT"
        | "IMMEDIATE_ACTION"
        | "EMERGENCY_RESOURCE"
        | "TRUSTED_PERSON"
        | "SUPPORT_RESOURCE"
        | "PRODUCT_LIMIT"
        | "RECOVERY_ACTION";
      resources: Array<components["schemas"]["SafetyResourceView"]>;
    };
    SafetyClearView: {
      revision: components["schemas"]["Revision"];
      state: "CLEAR";
      updated_at: string;
    };
    SafetyOverlayView: {
      blocks: Array<components["schemas"]["SafetyBlockView"]>;
      recovery_ref?: components["schemas"]["OpaqueRef"];
      response_bundle_version: components["schemas"]["VersionToken"];
      revision: components["schemas"]["PositiveRevision"];
      safety_continuation_token?: string;
      state: "ACTIVE" | "RECOVERY_PENDING";
      updated_at: string;
    };
    SafetyResourceView: {
      action: "CALL" | "OPEN_URL" | "SHOW_TEXT";
      label: string;
      resource_ref: components["schemas"]["OpaqueRef"];
      target: string;
    };
    SafetyView:
      | components["schemas"]["SafetyClearView"]
      | components["schemas"]["SafetyOverlayView"];
    VersionToken: string;
  };
}

export interface operations {
  adminAdvanceDataTask: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        task_ref: components["schemas"]["OpaqueRef"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["AdminAdvanceDataTaskRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessDataTask"];
        };
      };
      "400": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "401": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "403": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "404": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "409": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "422": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "429": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "503": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
    };
  };
  adminListDataTasks: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      query?: {
        cursor?: string;
        limit?: number;
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessDataTaskList"];
        };
      };
      "401": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "403": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "429": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "503": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
    };
  };
  adminListSafetyEvents: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      query?: {
        cursor?: string;
        limit?: number;
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessAdminSafetyEvents"];
        };
      };
      "401": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "403": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "429": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "503": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
    };
  };
  adminLogin: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["AdminLoginRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessAdminSession"];
        };
      };
      "400": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "422": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "429": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "503": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
    };
  };
  adminOpsOverview: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessAdminOps"];
        };
      };
      "401": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "403": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "429": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
      "503": {
        content: {
          "application/json": components["schemas"]["ApiErrorBody"];
        };
      };
    };
  };
}

export const ADMIN_OPERATIONS = {
  adminAdvanceDataTask: {
    method: "POST",
    path: "/v1/admin/data-rights/tasks/{task_ref}/advance",
  },
  adminListDataTasks: { method: "GET", path: "/v1/admin/data-rights/tasks" },
  adminListSafetyEvents: { method: "GET", path: "/v1/admin/safety/events" },
  adminLogin: { method: "POST", path: "/v1/admin/auth/login" },
  adminOpsOverview: { method: "GET", path: "/v1/admin/ops/overview" },
} as const;
