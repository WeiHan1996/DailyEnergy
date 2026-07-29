// @generated
// generator: daily-energy-contract-codegen/1.0.0
// source-fingerprint: sha256:133257cc7336ea5bc217cf713d14c85bfe6a3661d3ea3168406c53ceb41c092a
// do not edit; run `pnpm codegen`.

export const MINIAPP_CONTRACT_SOURCE_FINGERPRINT =
  "sha256:133257cc7336ea5bc217cf713d14c85bfe6a3661d3ea3168406c53ceb41c092a";

export interface paths {
  "/auth/reauth/verify": {
    post: operations["verifyDeletionIdentity"];
  };
  "/auth/session/logout": {
    post: operations["logoutSession"];
  };
  "/auth/session/refresh": {
    post: operations["refreshSession"];
  };
  "/auth/wechat/session": {
    post: operations["createWechatSession"];
  };
  "/bootstrap/launch": {
    get: operations["getLaunchState"];
  };
  "/consent/accept": {
    post: operations["acceptConsent"];
  };
  "/consent/current": {
    get: operations["getCurrentConsent"];
  };
  "/consent/withdraw": {
    post: operations["withdrawConsent"];
  };
  "/daily/by-date/{product_date}": {
    get: operations["getDailyByDate"];
  };
  "/daily/checkin/correct": {
    post: operations["correctCheckin"];
  };
  "/daily/checkin/rebuild": {
    post: operations["rebuildCheckinAfterErasure"];
  };
  "/daily/checkin/submit": {
    post: operations["submitCheckin"];
  };
  "/daily/generation/{intent_ref}": {
    get: operations["getGenerationIntent"];
  };
  "/daily/generation/start": {
    post: operations["startGeneration"];
  };
  "/daily/interaction": {
    get: operations["getDailyInteraction"];
  };
  "/daily/interaction/helpfulness": {
    post: operations["updateHelpfulness"];
  };
  "/daily/interaction/light": {
    post: operations["lightDay"];
  };
  "/daily/interaction/task": {
    post: operations["updateTaskState"];
  };
  "/daily/today": {
    get: operations["getTodayView"];
  };
  "/daily/today/checkin": {
    get: operations["getTodayCheckin"];
  };
  "/data-rights/delete/account/confirm": {
    post: operations["confirmAccountDeletion"];
  };
  "/data-rights/delete/account/prepare": {
    post: operations["prepareAccountDeletion"];
  };
  "/data-rights/delete/day": {
    post: operations["deleteDay"];
  };
  "/data-rights/delete/matter": {
    post: operations["deleteMatterScope"];
  };
  "/data-rights/delete/relationship/confirm": {
    post: operations["confirmRelationshipDeletion"];
  };
  "/data-rights/delete/relationship/prepare": {
    post: operations["prepareRelationshipDeletion"];
  };
  "/data-rights/export": {
    post: operations["createExportTask"];
  };
  "/data-rights/tasks": {
    get: operations["listDataTasks"];
  };
  "/data-rights/tasks/{task_ref}": {
    get: operations["getDataTask"];
  };
  "/data-rights/tasks/{task_ref}/cancel": {
    post: operations["cancelDataTask"];
  };
  "/evening/save": {
    post: operations["saveEveningCoordinated"];
  };
  "/evening/skip": {
    post: operations["skipEvening"];
  };
  "/evening/today": {
    get: operations["getEveningToday"];
  };
  "/history/days": {
    get: operations["listHistoryDays"];
  };
  "/history/days/{product_date}": {
    get: operations["getHistoryDay"];
  };
  "/matters": {
    get: operations["listMatters"];
    post: operations["createMatter"];
  };
  "/matters/{matter_ref}": {
    patch: operations["updateMatter"];
  };
  "/matters/{matter_ref}/complete": {
    post: operations["completeMatter"];
  };
  "/matters/{matter_ref}/delete": {
    post: operations["deleteMatter"];
  };
  "/matters/{matter_ref}/pause": {
    post: operations["pauseMatter"];
  };
  "/matters/{matter_ref}/resume": {
    post: operations["resumeMatter"];
  };
  "/memory/preferences": {
    get: operations["getMemoryPreferences"];
    post: operations["updateMemoryPreferences"];
  };
  "/notifications/permission-sync": {
    post: operations["syncNotificationPermission"];
  };
  "/notifications/settings": {
    get: operations["getNotificationSettings"];
    post: operations["updateNotificationSettings"];
  };
  "/onboarding/complete": {
    post: operations["completeOnboarding"];
  };
  "/profile": {
    get: operations["getProfile"];
  };
  "/profile/style-calibration": {
    post: operations["submitStyleCalibration"];
  };
  "/profile/update": {
    post: operations["updateProfile"];
  };
  "/safety/current": {
    get: operations["getSafetyCurrent"];
  };
  "/safety/recovery/confirm": {
    post: operations["confirmSafetyRecovery"];
  };
  "/safety/recovery/start": {
    post: operations["startSafetyRecovery"];
  };
  "/share/intent": {
    post: operations["recordShareIntent"];
  };
  "/share/preview": {
    post: operations["createSharePreview"];
  };
  "/support/faq": {
    get: operations["getFaq"];
  };
  "/support/feedback": {
    post: operations["submitFeedback"];
  };
  "/weekly/current": {
    get: operations["getWeeklyCurrent"];
  };
  "/weekly/window/{end_date}": {
    get: operations["getWeeklyWindow"];
  };
}

export interface components {
  schemas: {
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
    ApiSuccessCheckin: {
      data: components["schemas"]["CheckinView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessCommand: {
      data: components["schemas"]["CommandReceiptView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessConsent: {
      data: components["schemas"]["ConsentView"];
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
    ApiSuccessDeletionConfirmation: {
      data: components["schemas"]["DeletionConfirmationView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessEvening: {
      data: components["schemas"]["EveningView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessFaq: {
      data: components["schemas"]["FaqView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessGenerationIntent: {
      data: components["schemas"]["GenerationIntentView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessHistoryDay: {
      data: components["schemas"]["HistoryDayView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessHistoryList: {
      data: components["schemas"]["HistoryListView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessIdentityVerification: {
      data: components["schemas"]["IdentityVerificationView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessInteraction: {
      data: components["schemas"]["DailyInteractionView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessLaunch: {
      data: components["schemas"]["LaunchStateSnapshot"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessMatter: {
      data: components["schemas"]["MatterView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessMatterList: {
      data: components["schemas"]["MatterListView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessMemoryPreferences: {
      data: components["schemas"]["MemoryPreferencesView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessNotificationSettings: {
      data: components["schemas"]["NotificationSettingsView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessProfile: {
      data: components["schemas"]["ProfileView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessSafety: {
      data: components["schemas"]["SafetyView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessSession: {
      data: components["schemas"]["SessionView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessSharePreview: {
      data: components["schemas"]["SharePreviewView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessToday: {
      data: components["schemas"]["TodayView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    ApiSuccessWeekly: {
      data: components["schemas"]["WeeklyView"];
      ok: true;
      product_date: components["schemas"]["ProductDate"];
      product_date_policy_version: components["schemas"]["VersionToken"];
      request_id: components["schemas"]["RequestId"];
      server_now: string;
    };
    CheckinCorrectRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      energy: components["schemas"]["Energy"];
      expected_revision: components["schemas"]["PositiveRevision"];
      mood: components["schemas"]["Mood"];
      sleep: components["schemas"]["Sleep"];
    };
    CheckinRebuildRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      confirmed: true;
      deletion_task_ref: components["schemas"]["OpaqueRef"];
      energy: components["schemas"]["Energy"];
      expected_revision: 0;
      mood: components["schemas"]["Mood"];
      sleep: components["schemas"]["Sleep"];
    };
    CheckinSubmitRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      energy: components["schemas"]["Energy"];
      expected_revision: 0;
      mood: components["schemas"]["Mood"];
      sleep: components["schemas"]["Sleep"];
    };
    CheckinView: {
      checkin_ref: components["schemas"]["OpaqueRef"];
      energy: components["schemas"]["Energy"];
      mood: components["schemas"]["Mood"];
      product_date: components["schemas"]["ProductDate"];
      revision: components["schemas"]["PositiveRevision"];
      sleep: components["schemas"]["Sleep"];
      updated_at: string;
      write_window: components["schemas"]["WriteWindow"];
    };
    ClientContext: {
      app_version?: string;
      scene?: string;
    };
    ClientDailyContentView: {
      closing: string;
      content_label: "娱乐与行动参考";
      contract: "daily-content-view";
      core_tip: string;
      dimensions: Array<{
        band: "LOW" | "STEADY" | "HIGH";
        band_label: string;
        explanation: string;
        id: "pace" | "action" | "connection" | "resources" | "recovery";
        is_focus: boolean;
        label: string;
      }>;
      explanation_paragraphs: Array<string>;
      focus_dimension_id:
        "pace" | "action" | "connection" | "resources" | "recovery";
      generated_at: string;
      greeting: string;
      optional_task: {
        instruction: string;
        task_id: string;
      };
      overall: {
        band: "LOW" | "STEADY" | "HIGH";
        band_label: string;
        summary: string;
      };
      personalization_notice: "NONE" | "PERSONALIZATION_REDUCED";
      primary_action: {
        action_id: string;
        constraint_label?: string;
        instruction: string;
        rationale?: string;
      };
      product_date: string;
      result_id: string;
      result_version: string;
      rituals: Array<{
        display_value: string;
        kind: "COLOR" | "NUMBER";
        note: string;
      }>;
      schema_version: string;
      state_response: string;
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
    ConsentAcceptRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      notice_version: components["schemas"]["VersionToken"];
    };
    ConsentView: {
      accepted_at?: string;
      notice_version: components["schemas"]["VersionToken"];
      state: "MISSING" | "ACCEPTED" | "WITHDRAWN";
    };
    ConsentWithdrawRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      notice_version: components["schemas"]["VersionToken"];
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
    DataTaskCancelRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_task_revision: components["schemas"]["PositiveRevision"];
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
    DayExpectedRevision: {
      expected_revision: components["schemas"]["Revision"];
      product_date: components["schemas"]["ProductDate"];
    };
    DeleteAccountConfirmRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_challenge_ref: components["schemas"]["OpaqueRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      confirmed: true;
      expected_account_revision: components["schemas"]["PositiveRevision"];
      identity_verification_ref: components["schemas"]["OpaqueRef"];
      scope: "ACCOUNT";
      target: {
        subject: "SELF";
      };
    };
    DeleteAccountPrepareRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      expected_account_revision: components["schemas"]["PositiveRevision"];
      scope: "ACCOUNT";
      target: {
        subject: "SELF";
      };
    };
    DeleteDayRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      confirmed: true;
      expected_revision: components["schemas"]["Revision"];
      scope: "DAY";
      target: {
        product_date: components["schemas"]["ProductDate"];
      };
    };
    DeleteMatterRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      confirmed: true;
      expected_revision: components["schemas"]["PositiveRevision"];
      scope: "MATTER";
      target: {
        matter_ref: components["schemas"]["OpaqueRef"];
      };
    };
    DeleteRelationshipConfirmRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_challenge_ref: components["schemas"]["OpaqueRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      confirmed: true;
      expected_relationship_revision: components["schemas"]["PositiveRevision"];
      identity_verification_ref?: components["schemas"]["OpaqueRef"];
      included_day_expected_revisions: Array<
        components["schemas"]["DayExpectedRevision"]
      >;
      scope: "RELATIONSHIP_DATA";
      target: components["schemas"]["RelationshipDeletionTarget"];
    };
    DeleteRelationshipPrepareRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      expected_relationship_revision: components["schemas"]["PositiveRevision"];
      included_day_expected_revisions: Array<
        components["schemas"]["DayExpectedRevision"]
      >;
      scope: "RELATIONSHIP_DATA";
      target: {
        included_day_product_dates: Array<components["schemas"]["ProductDate"]>;
        relationship_scope: "CURRENT_CYCLE_AND_HISTORY";
      };
    };
    DeletionConfirmationView: {
      backup_max_days: 35;
      confirmation_challenge_ref: components["schemas"]["OpaqueRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      derived_effects: Array<string>;
      expected_day_revisions?: Array<
        components["schemas"]["DayExpectedRevision"]
      >;
      expected_revision: components["schemas"]["PositiveRevision"];
      expires_at: string;
      identity_reverification_required: boolean;
      immediate_effects: Array<string>;
      online_erasure_sla_hours: 72;
      scope: "RELATIONSHIP_DATA" | "ACCOUNT";
      target:
        | components["schemas"]["RelationshipDeletionTarget"]
        | {
            subject: "SELF";
          };
    };
    Energy: "EMPTY" | "LOW" | "STEADY" | "HIGH" | "FULL" | "UNSURE";
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
    EveningSaveRequest: {
      client_context: {
        app_version?: string;
        entry_source: components["schemas"]["VersionToken"];
        view_schema_version: components["schemas"]["Semver"];
      };
      command_ref: components["schemas"]["CommandRef"];
      expected_feedback_revision: components["schemas"]["Revision"];
      expected_helpfulness_revision: components["schemas"]["Revision"];
      helpfulness_rating: components["schemas"]["HelpfulnessRating"];
      note_patch?: components["schemas"]["NotePatch"];
      overall_feeling: components["schemas"]["OverallFeeling"];
      product_date: components["schemas"]["ProductDate"];
      task_patch?: components["schemas"]["EveningTaskPatch"];
    };
    EveningSkipRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      product_date: components["schemas"]["ProductDate"];
    };
    EveningTaskPatch: {
      expected_revision: components["schemas"]["PositiveRevision"];
      status: components["schemas"]["TaskStatus"];
      task_ref: components["schemas"]["OpaqueRef"];
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
    ExportRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      export_format: "JSON";
    };
    ExpressionStyle: "BALANCED" | "GENTLE" | "LIGHT_HUMOR" | "CLEAR_DIRECT";
    FaqEntryView: {
      body: string;
      entry_id: components["schemas"]["VersionToken"];
      title: string;
    };
    FaqView: {
      entries: Array<components["schemas"]["FaqEntryView"]>;
      version: components["schemas"]["VersionToken"];
    };
    FieldError: {
      field: string;
      reason: components["schemas"]["VersionToken"];
    };
    GenerationIntentView: {
      intent_ref: components["schemas"]["OpaqueRef"];
      product_date: components["schemas"]["ProductDate"];
      result_ref?: components["schemas"]["OpaqueRef"];
      retry_after_seconds?: number;
      status:
        | "QUEUED"
        | "RUNNING"
        | "FALLBACK_RUNNING"
        | "RETRYABLE_FAILED"
        | "SUCCEEDED"
        | "TERMINAL_FAILED"
        | "CANCELLED";
      updated_at: string;
    };
    GenerationStartRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_checkin_revision: components["schemas"]["PositiveRevision"];
    };
    HelpfulnessRating: "HELPFUL" | "NEUTRAL" | "NOT_HELPFUL" | "NOT_USED";
    HelpfulnessUpdateRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_revision: components["schemas"]["Revision"];
      rating: components["schemas"]["HelpfulnessRating"];
    };
    HistoryDaySummaryView: {
      has_evening_feedback: boolean;
      has_result: boolean;
      is_lit: boolean;
      product_date: components["schemas"]["ProductDate"];
      state: "RECORDED" | "MISSING";
    };
    HistoryDayView: {
      checkin?: components["schemas"]["CheckinView"];
      content?: components["schemas"]["ClientDailyContentView"];
      evening?: components["schemas"]["EveningView"];
      interaction?: components["schemas"]["DailyInteractionView"];
      product_date: components["schemas"]["ProductDate"];
    };
    HistoryListView: {
      items: Array<components["schemas"]["HistoryDaySummaryView"]>;
      next_cursor?: string;
      page_info: {
        has_more: boolean;
      };
    };
    IdentityVerificationView: {
      confirmation_challenge_ref: components["schemas"]["OpaqueRef"];
      expires_at: string;
      identity_verification_ref: components["schemas"]["OpaqueRef"];
    };
    LaunchStateSnapshot: {
      account_state: "ACTIVE" | "RESTRICTED" | "DELETING" | "DELETED";
      active_data_task?: components["schemas"]["OpaqueRef"];
      consent_state: "MISSING" | "ACCEPTED" | "WITHDRAWN";
      daily_state:
        | "CHECKIN_REQUIRED"
        | "GENERATION_PENDING"
        | "RESULT_AVAILABLE"
        | "TERMINAL_FAILURE";
      maintenance_state: "NORMAL" | "DEGRADED" | "BLOCKING";
      onboarding_completed: boolean;
      route:
        | "SAFE_001"
        | "SET_006_COMPLETED"
        | "SYS_003_DELETING"
        | "SYS_003_BLOCKED"
        | "ENT_002"
        | "ENT_001"
        | "ONB_001"
        | "EVE_001"
        | "DLY_003"
        | "DLY_002"
        | "DLY_001";
      safety?: components["schemas"]["SafetyView"];
      session_state: "VALID" | "REFRESHING" | "RECOVERABLE_FAILURE" | "INVALID";
    };
    LightDayRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      result_ref: components["schemas"]["OpaqueRef"];
    };
    LogoutRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
    };
    MatterCreateRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      daily_use_granted: boolean;
      target_date?: components["schemas"]["ProductDate"];
      title: string;
      weekly_use_granted: boolean;
    };
    MatterDeleteRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_version: components["schemas"]["VersionToken"];
      confirmed: true;
      expected_revision: components["schemas"]["PositiveRevision"];
    };
    MatterListView: {
      items: Array<components["schemas"]["MatterView"]>;
      next_cursor?: string;
      page_info: {
        has_more: boolean;
      };
    };
    MatterTransitionRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_revision: components["schemas"]["PositiveRevision"];
    };
    MatterUpdateRequest: {
      clear_target_date?: boolean;
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_revision: components["schemas"]["PositiveRevision"];
      target_date?: components["schemas"]["ProductDate"];
      title?: string;
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
    MemoryPreferencesUpdateRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      daily_use_enabled: boolean;
      expected_revision: components["schemas"]["PositiveRevision"];
      master_enabled: boolean;
      weekly_use_enabled: boolean;
    };
    MemoryPreferencesView: {
      daily_use_enabled: boolean;
      master_enabled: boolean;
      revision: components["schemas"]["PositiveRevision"];
      updated_at: string;
      weekly_use_enabled: boolean;
    };
    Mood: "VERY_LOW" | "LOW" | "STEADY" | "GOOD" | "LIGHT" | "UNSURE";
    NotePatch:
      | {
          operation: "SET";
          value: string;
        }
      | {
          operation: "CLEAR";
        };
    NotificationPermissionSyncRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      observed_at: string;
      observed_permission: "UNKNOWN" | "GRANTED" | "DENIED" | "REVOKED";
    };
    NotificationSettingsUpdateRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      evening_enabled: boolean;
      expected_revision: components["schemas"]["PositiveRevision"];
      morning_enabled: boolean;
    };
    NotificationSettingsView: {
      evening_enabled: boolean;
      morning_enabled: boolean;
      observed_permission: "UNKNOWN" | "GRANTED" | "DENIED" | "REVOKED";
      revision: components["schemas"]["PositiveRevision"];
      updated_at: string;
    };
    OnboardingCompleteRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expression_style: components["schemas"]["ExpressionStyle"];
      preferred_name?: string;
    };
    OpaqueRef: string;
    OverallFeeling:
      | "VERY_HEAVY"
      | "SOMEWHAT_HEAVY"
      | "STEADY"
      | "PRETTY_GOOD"
      | "LIGHT"
      | "UNSURE";
    PositiveRevision: number;
    ProductDate: string;
    ProfileUpdateRequest: {
      clear_preferred_name?: boolean;
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_revision: components["schemas"]["PositiveRevision"];
      expression_style?: components["schemas"]["ExpressionStyle"];
      preferred_name?: string;
    };
    ProfileView: {
      expression_style: components["schemas"]["ExpressionStyle"];
      onboarding_completed: boolean;
      preferred_name?: string;
      revision: components["schemas"]["PositiveRevision"];
      updated_at: string;
    };
    ReauthVerifyRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      confirmation_challenge_ref: components["schemas"]["OpaqueRef"];
      wechat_code: string;
    };
    RelationshipDeletionTarget: {
      included_day_product_dates: Array<components["schemas"]["ProductDate"]>;
      relationship_scope: "CURRENT_CYCLE_AND_HISTORY";
    };
    RelationshipStage:
      | "BEFORE_FIRST_MEETING"
      | "NEWLY_MET"
      | "BECOMING_FAMILIAR"
      | "FIRST_WEEK_RECORDED";
    RelationshipView: {
      display_token?: components["schemas"]["VersionToken"];
      encounter_day_count: number;
      stage: components["schemas"]["RelationshipStage"];
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
    SafetyRecoveryConfirmRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_safety_revision: components["schemas"]["PositiveRevision"];
      recovery_action_version: components["schemas"]["VersionToken"];
      recovery_ref: components["schemas"]["OpaqueRef"];
    };
    SafetyRecoveryStartRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_safety_revision: components["schemas"]["PositiveRevision"];
      recovery_action_version: components["schemas"]["VersionToken"];
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
    Semver: string;
    SessionView: {
      account_state: "ACTIVE" | "RESTRICTED" | "DELETING" | "DELETED";
      consent_required: boolean;
      expires_at: string;
      onboarding_required: boolean;
      refresh_after: string;
      safety_continuation_token?: string;
      session_token: string;
    };
    ShareIntentRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      preview_ref: components["schemas"]["OpaqueRef"];
    };
    SharePreviewRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      kind: "TODAY" | "WEEKLY";
      source_ref: components["schemas"]["OpaqueRef"];
      template_version: components["schemas"]["VersionToken"];
    };
    SharePreviewView: {
      expires_at: string;
      image_url: string;
      kind: "TODAY" | "WEEKLY";
      preview_ref: components["schemas"]["OpaqueRef"];
      visible_fields: Array<components["schemas"]["VersionToken"]>;
    };
    Sleep: "POOR" | "LOW" | "OKAY" | "GOOD" | "UNSURE";
    StyleCalibrationRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_revision: components["schemas"]["PositiveRevision"];
      expression_style: components["schemas"]["ExpressionStyle"];
    };
    SupportFeedbackRequest: {
      category: "BUG" | "CONTENT" | "PRIVACY" | "ACCOUNT" | "OTHER";
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      description?: string;
    };
    TaskStateUpdateRequest: {
      client_context?: components["schemas"]["ClientContext"];
      command_ref: components["schemas"]["CommandRef"];
      expected_revision: components["schemas"]["PositiveRevision"];
      status: components["schemas"]["TaskStatus"];
      task_ref: components["schemas"]["OpaqueRef"];
    };
    TaskStatus: "UNMARKED" | "INTERESTED" | "COMPLETED" | "SKIPPED";
    TodayView: {
      content: components["schemas"]["ClientDailyContentView"];
      interaction: components["schemas"]["DailyInteractionView"];
      relationship: components["schemas"]["RelationshipView"];
    };
    VersionToken: string;
    WechatSessionRequest: {
      channel?: string;
      code: string;
    };
    WeeklyView: {
      activity: {
        helpfulness: {
          helpful_count: number;
          neutral_count: number;
          not_helpful_count: number;
          not_used_count: number;
          rated_day_count: number;
          top_helpful_action_kind?:
            | "PRIORITIZE_ONE"
            | "PREPARE_ONE_STEP"
            | "COMMUNICATE_CLEARLY"
            | "REDUCE_SWITCHING"
            | "ORGANIZE_SMALL_SCOPE"
            | "PAUSE_AND_RECOVER"
            | "REFLECT_BRIEFLY"
            | "SEEK_REAL_SUPPORT";
          unrated_day_count: number;
        };
        lit_day_count: number;
        tasks: {
          completed_count: number;
          interested_count: number;
          skipped_count: number;
          task_offered_day_count: number;
          unmarked_count: number;
        };
      };
      contract: "weekly-summary-view";
      coverage: {
        checkin_day_count: number;
        evening_feedback_day_count: number;
        level: "EMPTY" | "POINTS_ONLY" | "PARTIAL" | "COMPLETE";
        lit_day_count: number;
        missing_dates: Array<string>;
        real_state_day_count: number;
        window_day_count: 7;
      };
      data_disclosure: string;
      days: Array<{
        evening?: {
          overall_feeling:
            | "VERY_HEAVY"
            | "SOMEWHAT_HEAVY"
            | "STEADY"
            | "PRETTY_GOOD"
            | "LIGHT"
            | "UNSURE";
        };
        helpfulness?:
          "UNRATED" | "HELPFUL" | "NEUTRAL" | "NOT_HELPFUL" | "NOT_USED";
        is_lit: boolean;
        morning?: {
          energy: "EMPTY" | "LOW" | "STEADY" | "HIGH" | "FULL" | "UNSURE";
          mood: "VERY_LOW" | "LOW" | "STEADY" | "GOOD" | "LIGHT" | "UNSURE";
          sleep: "POOR" | "LOW" | "OKAY" | "GOOD" | "UNSURE";
        };
        product_date: string;
        state: "RECORDED" | "MISSING";
        task_status?: "UNMARKED" | "INTERESTED" | "COMPLETED" | "SKIPPED";
      }>;
      metrics: Array<{
        direction:
          | "INSUFFICIENT_DATA"
          | "LOWER_LATE"
          | "SIMILAR"
          | "HIGHER_LATE"
          | "VARIABLE";
        direction_label: string;
        id:
          | "MORNING_MOOD"
          | "MORNING_ENERGY"
          | "MORNING_SLEEP"
          | "EVENING_OVERALL";
        missing_count: number;
        observed_count: number;
        unsure_count: number;
      }>;
      projection_version: string;
      relationship_display_token?: string;
      schema_version: string;
      summary?: {
        kind: "PARTIAL_REVIEW" | "COMPLETE_REVIEW";
        paragraphs: Array<string>;
        revision: number;
        summary_id: string;
        title: string;
      };
      summary_status:
        | "NOT_ELIGIBLE"
        | "ELIGIBLE"
        | "GENERATING"
        | "AVAILABLE"
        | "INVALIDATED"
        | "FAILED";
      window_end_date: string;
      window_id: string;
      window_start_date: string;
    };
    WriteWindow: "OPEN" | "CONTINUATION_ONLY" | "CLOSED";
  };
}

export interface operations {
  acceptConsent: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ConsentAcceptRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCommand"];
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
  cancelDataTask: {
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
        "application/json": components["schemas"]["DataTaskCancelRequest"];
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
  completeMatter: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        matter_ref: components["schemas"]["OpaqueRef"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MatterTransitionRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessMatter"];
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
  completeOnboarding: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["OnboardingCompleteRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessProfile"];
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
  confirmAccountDeletion: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DeleteAccountConfirmRequest"];
      };
    };
    responses: {
      "202": {
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
  confirmRelationshipDeletion: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DeleteRelationshipConfirmRequest"];
      };
    };
    responses: {
      "202": {
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
  confirmSafetyRecovery: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SafetyRecoveryConfirmRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessSafety"];
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
  correctCheckin: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CheckinCorrectRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCheckin"];
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
  createExportTask: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ExportRequest"];
      };
    };
    responses: {
      "202": {
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
  createMatter: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MatterCreateRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessMatter"];
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
  createSharePreview: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SharePreviewRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessSharePreview"];
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
  createWechatSession: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["WechatSessionRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessSession"];
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
  deleteDay: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DeleteDayRequest"];
      };
    };
    responses: {
      "202": {
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
  deleteMatter: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        matter_ref: components["schemas"]["OpaqueRef"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MatterDeleteRequest"];
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
  deleteMatterScope: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DeleteMatterRequest"];
      };
    };
    responses: {
      "202": {
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
  getCurrentConsent: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessConsent"];
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
  getDailyByDate: {
    parameters: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        product_date: components["schemas"]["ProductDate"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessHistoryDay"];
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
  getDailyInteraction: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessInteraction"];
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
  getDataTask: {
    parameters: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        task_ref: components["schemas"]["OpaqueRef"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessDataTask"];
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
  getEveningToday: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessEvening"];
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
  getFaq: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessFaq"];
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
  getGenerationIntent: {
    parameters: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        intent_ref: components["schemas"]["OpaqueRef"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessGenerationIntent"];
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
  getHistoryDay: {
    parameters: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        product_date: components["schemas"]["ProductDate"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessHistoryDay"];
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
  getLaunchState: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessLaunch"];
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
  getMemoryPreferences: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessMemoryPreferences"];
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
  getNotificationSettings: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessNotificationSettings"];
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
  getProfile: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessProfile"];
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
  getSafetyCurrent: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessSafety"];
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
  getTodayCheckin: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCheckin"];
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
  getTodayView: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessToday"];
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
  getWeeklyCurrent: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessWeekly"];
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
  getWeeklyWindow: {
    parameters: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        end_date: components["schemas"]["ProductDate"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessWeekly"];
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
  lightDay: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["LightDayRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessInteraction"];
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
  listDataTasks: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
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
  listHistoryDays: {
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
          "application/json": components["schemas"]["ApiSuccessHistoryList"];
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
  listMatters: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessMatterList"];
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
  logoutSession: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["LogoutRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCommand"];
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
  pauseMatter: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        matter_ref: components["schemas"]["OpaqueRef"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MatterTransitionRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessMatter"];
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
  prepareAccountDeletion: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DeleteAccountPrepareRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessDeletionConfirmation"];
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
  prepareRelationshipDeletion: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DeleteRelationshipPrepareRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessDeletionConfirmation"];
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
  rebuildCheckinAfterErasure: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CheckinRebuildRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCheckin"];
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
  recordShareIntent: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ShareIntentRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCommand"];
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
  refreshSession: {
    parameters?: {
      header?: {
        "Accept-Language"?: "zh-CN";
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };

    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessSession"];
        };
      };
      "401": {
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
  resumeMatter: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        matter_ref: components["schemas"]["OpaqueRef"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MatterTransitionRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessMatter"];
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
  saveEveningCoordinated: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["EveningSaveRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessEvening"];
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
  skipEvening: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["EveningSkipRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCommand"];
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
  startGeneration: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["GenerationStartRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessGenerationIntent"];
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
  startSafetyRecovery: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SafetyRecoveryStartRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessSafety"];
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
  submitCheckin: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CheckinSubmitRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCheckin"];
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
  submitFeedback: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SupportFeedbackRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCommand"];
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
  submitStyleCalibration: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["StyleCalibrationRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessProfile"];
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
  syncNotificationPermission: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["NotificationPermissionSyncRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessNotificationSettings"];
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
  updateHelpfulness: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["HelpfulnessUpdateRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessInteraction"];
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
  updateMatter: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
      path: {
        matter_ref: components["schemas"]["OpaqueRef"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MatterUpdateRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessMatter"];
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
  updateMemoryPreferences: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MemoryPreferencesUpdateRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessMemoryPreferences"];
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
  updateNotificationSettings: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["NotificationSettingsUpdateRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessNotificationSettings"];
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
  updateProfile: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ProfileUpdateRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessProfile"];
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
  updateTaskState: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["TaskStateUpdateRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessInteraction"];
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
  verifyDeletionIdentity: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ReauthVerifyRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessIdentityVerification"];
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
  withdrawConsent: {
    parameters: {
      header: {
        "Accept-Language"?: "zh-CN";
        "Idempotency-Key": components["schemas"]["CommandRef"];
        "X-Request-Id"?: components["schemas"]["RequestId"];
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ConsentWithdrawRequest"];
      };
    };
    responses: {
      "200": {
        content: {
          "application/json": components["schemas"]["ApiSuccessCommand"];
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
}

export const MINIAPP_OPERATIONS = {
  acceptConsent: { method: "POST", path: "/v1/consent/accept" },
  cancelDataTask: {
    method: "POST",
    path: "/v1/data-rights/tasks/{task_ref}/cancel",
  },
  completeMatter: { method: "POST", path: "/v1/matters/{matter_ref}/complete" },
  completeOnboarding: { method: "POST", path: "/v1/onboarding/complete" },
  confirmAccountDeletion: {
    method: "POST",
    path: "/v1/data-rights/delete/account/confirm",
  },
  confirmRelationshipDeletion: {
    method: "POST",
    path: "/v1/data-rights/delete/relationship/confirm",
  },
  confirmSafetyRecovery: {
    method: "POST",
    path: "/v1/safety/recovery/confirm",
  },
  correctCheckin: { method: "POST", path: "/v1/daily/checkin/correct" },
  createExportTask: { method: "POST", path: "/v1/data-rights/export" },
  createMatter: { method: "POST", path: "/v1/matters" },
  createSharePreview: { method: "POST", path: "/v1/share/preview" },
  createWechatSession: { method: "POST", path: "/v1/auth/wechat/session" },
  deleteDay: { method: "POST", path: "/v1/data-rights/delete/day" },
  deleteMatter: { method: "POST", path: "/v1/matters/{matter_ref}/delete" },
  deleteMatterScope: { method: "POST", path: "/v1/data-rights/delete/matter" },
  getCurrentConsent: { method: "GET", path: "/v1/consent/current" },
  getDailyByDate: { method: "GET", path: "/v1/daily/by-date/{product_date}" },
  getDailyInteraction: { method: "GET", path: "/v1/daily/interaction" },
  getDataTask: { method: "GET", path: "/v1/data-rights/tasks/{task_ref}" },
  getEveningToday: { method: "GET", path: "/v1/evening/today" },
  getFaq: { method: "GET", path: "/v1/support/faq" },
  getGenerationIntent: {
    method: "GET",
    path: "/v1/daily/generation/{intent_ref}",
  },
  getHistoryDay: { method: "GET", path: "/v1/history/days/{product_date}" },
  getLaunchState: { method: "GET", path: "/v1/bootstrap/launch" },
  getMemoryPreferences: { method: "GET", path: "/v1/memory/preferences" },
  getNotificationSettings: {
    method: "GET",
    path: "/v1/notifications/settings",
  },
  getProfile: { method: "GET", path: "/v1/profile" },
  getSafetyCurrent: { method: "GET", path: "/v1/safety/current" },
  getTodayCheckin: { method: "GET", path: "/v1/daily/today/checkin" },
  getTodayView: { method: "GET", path: "/v1/daily/today" },
  getWeeklyCurrent: { method: "GET", path: "/v1/weekly/current" },
  getWeeklyWindow: { method: "GET", path: "/v1/weekly/window/{end_date}" },
  lightDay: { method: "POST", path: "/v1/daily/interaction/light" },
  listDataTasks: { method: "GET", path: "/v1/data-rights/tasks" },
  listHistoryDays: { method: "GET", path: "/v1/history/days" },
  listMatters: { method: "GET", path: "/v1/matters" },
  logoutSession: { method: "POST", path: "/v1/auth/session/logout" },
  pauseMatter: { method: "POST", path: "/v1/matters/{matter_ref}/pause" },
  prepareAccountDeletion: {
    method: "POST",
    path: "/v1/data-rights/delete/account/prepare",
  },
  prepareRelationshipDeletion: {
    method: "POST",
    path: "/v1/data-rights/delete/relationship/prepare",
  },
  rebuildCheckinAfterErasure: {
    method: "POST",
    path: "/v1/daily/checkin/rebuild",
  },
  recordShareIntent: { method: "POST", path: "/v1/share/intent" },
  refreshSession: { method: "POST", path: "/v1/auth/session/refresh" },
  resumeMatter: { method: "POST", path: "/v1/matters/{matter_ref}/resume" },
  saveEveningCoordinated: { method: "POST", path: "/v1/evening/save" },
  skipEvening: { method: "POST", path: "/v1/evening/skip" },
  startGeneration: { method: "POST", path: "/v1/daily/generation/start" },
  startSafetyRecovery: { method: "POST", path: "/v1/safety/recovery/start" },
  submitCheckin: { method: "POST", path: "/v1/daily/checkin/submit" },
  submitFeedback: { method: "POST", path: "/v1/support/feedback" },
  submitStyleCalibration: {
    method: "POST",
    path: "/v1/profile/style-calibration",
  },
  syncNotificationPermission: {
    method: "POST",
    path: "/v1/notifications/permission-sync",
  },
  updateHelpfulness: {
    method: "POST",
    path: "/v1/daily/interaction/helpfulness",
  },
  updateMatter: { method: "PATCH", path: "/v1/matters/{matter_ref}" },
  updateMemoryPreferences: { method: "POST", path: "/v1/memory/preferences" },
  updateNotificationSettings: {
    method: "POST",
    path: "/v1/notifications/settings",
  },
  updateProfile: { method: "POST", path: "/v1/profile/update" },
  updateTaskState: { method: "POST", path: "/v1/daily/interaction/task" },
  verifyDeletionIdentity: { method: "POST", path: "/v1/auth/reauth/verify" },
  withdrawConsent: { method: "POST", path: "/v1/consent/withdraw" },
} as const;
