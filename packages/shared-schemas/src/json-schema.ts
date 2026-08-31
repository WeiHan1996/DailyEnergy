// @generated
// generator: daily-energy-contract-codegen/1.0.0
// source-fingerprint: sha256:79c5124f5ad8f698e49c3ba193a1a99f32741b3ee830d6e66dd0cc0e60d730be
// do not edit; run `pnpm codegen`.

export const JSON_SCHEMA_SOURCE_FINGERPRINT =
  "sha256:79c5124f5ad8f698e49c3ba193a1a99f32741b3ee830d6e66dd0cc0e60d730be";

export const JSON_SCHEMA_IDS = {
  generationInputSnapshot:
    "urn:dailyenergy:schema:generation-input-snapshot:1.0.0",
  ruleFacts: "urn:dailyenergy:schema:rule-facts:1.0.0",
  expressionPayload: "urn:dailyenergy:schema:expression-payload:1.0.0",
  publishedDailyResult: "urn:dailyenergy:schema:published-daily-result:1.0.0",
  clientDailyContentView:
    "urn:dailyenergy:schema:client-daily-content-view:1.0.0",
  dailyInteractionState: "urn:dailyenergy:schema:daily-interaction-state:1.0.0",
  eveningFeedbackDraft: "urn:dailyenergy:schema:evening-feedback-draft:1.0.0",
  eveningReflectionSubmission:
    "urn:dailyenergy:schema:evening-reflection-submission:1.0.0",
  eveningFeedbackRecord: "urn:dailyenergy:schema:evening-feedback-record:1.0.0",
  eveningFeedbackRevision:
    "urn:dailyenergy:schema:evening-feedback-revision:1.0.0",
  dailyHelpfulnessRecord:
    "urn:dailyenergy:schema:daily-helpfulness-record:1.0.0",
  dailyTaskState: "urn:dailyenergy:schema:daily-task-state:1.0.0",
  clientEveningFeedbackView:
    "urn:dailyenergy:schema:client-evening-feedback-view:1.0.0",
  weeklySourceSnapshot: "urn:dailyenergy:schema:weekly-source-snapshot:1.0.0",
  weeklyAggregateFacts: "urn:dailyenergy:schema:weekly-aggregate-facts:1.0.0",
  weeklyExpressionPlan: "urn:dailyenergy:schema:weekly-expression-plan:1.0.0",
  weeklyExpressionPayload:
    "urn:dailyenergy:schema:weekly-expression-payload:1.0.0",
  publishedWeeklySummary:
    "urn:dailyenergy:schema:published-weekly-summary:1.0.0",
  clientWeeklySummaryView:
    "urn:dailyenergy:schema:client-weekly-summary-view:1.0.0",
  wechatSessionRequest: "urn:dailyenergy:schema:wechat-session-request:1.0.0",
  checkinSubmitRequest: "urn:dailyenergy:schema:checkin-submit-request:1.0.0",
  checkinCorrectRequest: "urn:dailyenergy:schema:checkin-correct-request:1.0.0",
  checkinView: "urn:dailyenergy:schema:checkin-view:1.0.0",
  generationStartRequest:
    "urn:dailyenergy:schema:generation-start-request:1.0.0",
  taskStateUpdateRequest:
    "urn:dailyenergy:schema:task-state-update-request:1.0.0",
  generationIntentView: "urn:dailyenergy:schema:generation-intent-view:1.0.0",
  relationshipView: "urn:dailyenergy:schema:relationship-view:1.0.0",
  todayView: "urn:dailyenergy:schema:today-view:1.0.0",
  historyDayView: "urn:dailyenergy:schema:history-day-view:1.0.0",
  reauthVerifyRequest: "urn:dailyenergy:schema:reauth-verify-request:1.0.0",
  exportRequest: "urn:dailyenergy:schema:export-request:1.0.0",
  deleteDayRequest: "urn:dailyenergy:schema:delete-day-request:1.0.0",
  deleteMatterRequest: "urn:dailyenergy:schema:delete-matter-request:1.0.0",
  dayExpectedRevision: "urn:dailyenergy:schema:day-expected-revision:1.0.0",
  relationshipDeletionTarget:
    "urn:dailyenergy:schema:relationship-deletion-target:1.0.0",
  deleteRelationshipPrepareRequest:
    "urn:dailyenergy:schema:delete-relationship-prepare-request:1.0.0",
  deleteRelationshipConfirmRequest:
    "urn:dailyenergy:schema:delete-relationship-confirm-request:1.0.0",
  deleteAccountPrepareRequest:
    "urn:dailyenergy:schema:delete-account-prepare-request:1.0.0",
  deleteAccountConfirmRequest:
    "urn:dailyenergy:schema:delete-account-confirm-request:1.0.0",
  dataTaskCancelRequest:
    "urn:dailyenergy:schema:data-task-cancel-request:1.0.0",
  dataTaskView: "urn:dailyenergy:schema:data-task-view:1.0.0",
  dataTaskListView: "urn:dailyenergy:schema:data-task-list-view:1.0.0",
  dataRightsSummaryView:
    "urn:dailyenergy:schema:data-rights-summary-view:1.0.0",
  exportArtifactView: "urn:dailyenergy:schema:export-artifact-view:1.0.0",
  deletionStatusGrantView:
    "urn:dailyenergy:schema:deletion-status-grant-view:1.0.0",
  accountDeletionAcceptedView:
    "urn:dailyenergy:schema:account-deletion-accepted-view:1.0.0",
  dataExportDocument: "urn:dailyenergy:schema:data-export-document:1.0.0",
  deletionConfirmationView:
    "urn:dailyenergy:schema:deletion-confirmation-view:1.0.0",
  identityVerificationView:
    "urn:dailyenergy:schema:identity-verification-view:1.0.0",
  analyticsProjectionV1: "urn:dailyenergy:schema:analytics-projection-v1:1.0.0",
  anonymousDailyAggregateV1:
    "urn:dailyenergy:schema:anonymous-daily-aggregate-v1:1.0.0",
  clientAnalyticsSignalRequest:
    "urn:dailyenergy:schema:client-analytics-signal-request:1.0.0",
  clientAnalyticsSignalAcceptedView:
    "urn:dailyenergy:schema:client-analytics-signal-accepted-view:1.0.0",
  metricReportV1: "urn:dailyenergy:schema:metric-report-v1:1.0.0",
  metricGateReportV1: "urn:dailyenergy:schema:metric-gate-report-v1:1.0.0",
} as const;

export const jsonSchemas = {
  generationInputSnapshot: {
    $id: "urn:dailyenergy:schema:generation-input-snapshot:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      checkin: {
        additionalProperties: false,
        properties: {
          energy: {
            enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
            type: "string",
          },
          mood: {
            enum: ["VERY_LOW", "LOW", "STEADY", "GOOD", "LIGHT", "UNSURE"],
            type: "string",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          sleep: {
            enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
            type: "string",
          },
        },
        required: ["revision", "mood", "energy", "sleep"],
        type: "object",
      },
      permitted_context: {
        items: {
          additionalProperties: false,
          properties: {
            purpose: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            source_ref: {
              pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
              type: "string",
            },
            source_revision: {
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
              type: "integer",
            },
            source_type: {
              enum: [
                "CHECKIN",
                "RECENT_RECORD",
                "RELATIONSHIP",
                "IMPORTANT_MATTER",
              ],
              type: "string",
            },
            valid_for_product_date: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
          },
          required: [
            "source_ref",
            "source_type",
            "source_revision",
            "purpose",
            "valid_for_product_date",
          ],
          type: "object",
        },
        maxItems: 8,
        type: "array",
      },
      product: {
        additionalProperties: false,
        properties: {
          content_policy_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          experiment_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          locale: {
            const: "zh-CN",
            type: "string",
          },
          personality_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
        },
        required: ["locale", "personality_version", "content_policy_version"],
        type: "object",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      profile: {
        additionalProperties: false,
        properties: {
          expression_style: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          preferred_name: {
            type: "string",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
        },
        required: ["revision", "expression_style"],
        type: "object",
      },
      relationship: {
        additionalProperties: false,
        properties: {
          encounter_day_count: {
            maximum: 9007199254740991,
            minimum: 0,
            type: "integer",
          },
          stage: {
            enum: [
              "BEFORE_FIRST_MEETING",
              "NEWLY_MET",
              "BECOMING_FAMILIAR",
              "FIRST_WEEK_RECORDED",
            ],
            type: "string",
          },
        },
        required: ["stage", "encounter_day_count"],
        type: "object",
      },
      result_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      snapshot_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      user_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
    },
    required: [
      "snapshot_version",
      "product_date",
      "result_version",
      "checkin",
      "profile",
      "relationship",
      "permitted_context",
    ],
    type: "object",
  },
  ruleFacts: {
    $id: "urn:dailyenergy:schema:rule-facts:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      action_candidates: {
        items: {
          additionalProperties: false,
          properties: {
            action_id: {
              pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
              type: "string",
            },
            basis_refs: {
              items: {
                pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                type: "string",
              },
              maxItems: 5,
              type: "array",
            },
            constraint_token: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            effort: {
              enum: ["VERY_LIGHT", "LIGHT"],
              type: "string",
            },
            kind: {
              enum: [
                "PRIORITIZE_ONE",
                "PREPARE_ONE_STEP",
                "COMMUNICATE_CLEARLY",
                "REDUCE_SWITCHING",
                "ORGANIZE_SMALL_SCOPE",
                "PAUSE_AND_RECOVER",
                "REFLECT_BRIEFLY",
                "SEEK_REAL_SUPPORT",
              ],
              type: "string",
            },
            target_scope: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            timebox_minutes: {
              maximum: 30,
              minimum: 5,
              type: "integer",
            },
          },
          required: ["action_id", "kind", "target_scope", "effort"],
          type: "object",
        },
        maxItems: 3,
        minItems: 1,
        type: "array",
      },
      care_dimension_id: {
        enum: ["pace", "action", "connection", "resources", "recovery"],
        type: "string",
      },
      dimensions: {
        items: {
          additionalProperties: false,
          properties: {
            band: {
              enum: ["LOW", "STEADY", "HIGH"],
              type: "string",
            },
            id: {
              enum: ["pace", "action", "connection", "resources", "recovery"],
              type: "string",
            },
            label_token: {
              enum: ["TAKE_IT_GENTLY", "KEEP_IT_STEADY", "ROOM_TO_MOVE"],
              type: "string",
            },
            score: {
              maximum: 100,
              minimum: 0,
              type: "integer",
            },
          },
          required: ["score", "band", "label_token", "id"],
          type: "object",
        },
        maxItems: 5,
        minItems: 5,
        type: "array",
      },
      display_order: {
        items: {
          enum: ["pace", "action", "connection", "resources", "recovery"],
          type: "string",
        },
        maxItems: 5,
        minItems: 5,
        type: "array",
      },
      explanation_basis: {
        items: {
          additionalProperties: false,
          properties: {
            code: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            type: {
              enum: [
                "CHECKIN_SIGNAL",
                "DIMENSION_SIGNAL",
                "PROFILE_SIGNAL",
                "RELATIONSHIP_SIGNAL",
                "CONTEXT_SIGNAL",
              ],
              type: "string",
            },
          },
          required: ["type", "code"],
          type: "object",
        },
        maxItems: 5,
        type: "array",
      },
      focus_dimension_id: {
        enum: ["pace", "action", "connection", "resources", "recovery"],
        type: "string",
      },
      optional_task_plan: {
        additionalProperties: false,
        properties: {
          effort: {
            enum: ["VERY_LIGHT", "LIGHT"],
            type: "string",
          },
          kind: {
            enum: [
              "PRIORITIZE_ONE",
              "PREPARE_ONE_STEP",
              "COMMUNICATE_CLEARLY",
              "REDUCE_SWITCHING",
              "ORGANIZE_SMALL_SCOPE",
              "PAUSE_AND_RECOVER",
              "REFLECT_BRIEFLY",
              "SEEK_REAL_SUPPORT",
            ],
            type: "string",
          },
          task_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          timebox_minutes: {
            maximum: 30,
            minimum: 5,
            type: "integer",
          },
        },
        required: ["task_id", "kind", "effort"],
        type: "object",
      },
      overall: {
        additionalProperties: false,
        properties: {
          band: {
            enum: ["LOW", "STEADY", "HIGH"],
            type: "string",
          },
          label_token: {
            enum: ["TAKE_IT_GENTLY", "KEEP_IT_STEADY", "ROOM_TO_MOVE"],
            type: "string",
          },
          score: {
            maximum: 100,
            minimum: 0,
            type: "integer",
          },
        },
        required: ["score", "band", "label_token"],
        type: "object",
      },
      ritual_facts: {
        items: {
          oneOf: [
            {
              additionalProperties: false,
              properties: {
                kind: {
                  const: "COLOR",
                  type: "string",
                },
                ritual_id: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
                value: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
              },
              required: ["ritual_id", "kind", "value"],
              type: "object",
            },
            {
              additionalProperties: false,
              properties: {
                kind: {
                  const: "NUMBER",
                  type: "string",
                },
                ritual_id: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
                value: {
                  maximum: 9,
                  minimum: 1,
                  type: "integer",
                },
              },
              required: ["ritual_id", "kind", "value"],
              type: "object",
            },
          ],
        },
        maxItems: 2,
        type: "array",
      },
      selected_action_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      supporting_dimension_id: {
        enum: ["pace", "action", "connection", "resources", "recovery"],
        type: "string",
      },
    },
    required: [
      "overall",
      "dimensions",
      "focus_dimension_id",
      "display_order",
      "explanation_basis",
      "action_candidates",
      "selected_action_id",
      "optional_task_plan",
      "ritual_facts",
    ],
    type: "object",
  },
  expressionPayload: {
    $id: "urn:dailyenergy:schema:expression-payload:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      closing: {
        type: "string",
      },
      core_tip: {
        type: "string",
      },
      dimension_explanations: {
        additionalProperties: false,
        properties: {
          action: {
            type: "string",
          },
          connection: {
            type: "string",
          },
          pace: {
            type: "string",
          },
          recovery: {
            type: "string",
          },
          resources: {
            type: "string",
          },
        },
        required: ["pace", "action", "connection", "resources", "recovery"],
        type: "object",
      },
      explanation_paragraphs: {
        items: {
          type: "string",
        },
        maxItems: 2,
        minItems: 1,
        type: "array",
      },
      greeting: {
        type: "string",
      },
      optional_task: {
        additionalProperties: false,
        properties: {
          instruction: {
            type: "string",
          },
          task_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
        },
        required: ["task_id", "instruction"],
        type: "object",
      },
      overall_summary: {
        type: "string",
      },
      primary_action: {
        additionalProperties: false,
        properties: {
          action_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          constraint_label: {
            type: "string",
          },
          instruction: {
            type: "string",
          },
          rationale: {
            type: "string",
          },
        },
        required: ["action_id", "instruction"],
        type: "object",
      },
      ritual_notes: {
        additionalProperties: {
          type: "string",
        },
        propertyNames: {
          pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
          type: "string",
        },
        type: "object",
      },
      state_response: {
        type: "string",
      },
    },
    required: [
      "greeting",
      "state_response",
      "overall_summary",
      "core_tip",
      "explanation_paragraphs",
      "dimension_explanations",
      "primary_action",
      "optional_task",
      "ritual_notes",
      "closing",
    ],
    type: "object",
  },
  publishedDailyResult: {
    $id: "urn:dailyenergy:schema:published-daily-result:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      contract: {
        const: "daily-content",
        type: "string",
      },
      expression: {
        additionalProperties: false,
        properties: {
          closing: {
            type: "string",
          },
          core_tip: {
            type: "string",
          },
          dimension_explanations: {
            additionalProperties: false,
            properties: {
              action: {
                type: "string",
              },
              connection: {
                type: "string",
              },
              pace: {
                type: "string",
              },
              recovery: {
                type: "string",
              },
              resources: {
                type: "string",
              },
            },
            required: ["pace", "action", "connection", "resources", "recovery"],
            type: "object",
          },
          explanation_paragraphs: {
            items: {
              type: "string",
            },
            maxItems: 2,
            minItems: 1,
            type: "array",
          },
          greeting: {
            type: "string",
          },
          optional_task: {
            additionalProperties: false,
            properties: {
              instruction: {
                type: "string",
              },
              task_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
            },
            required: ["task_id", "instruction"],
            type: "object",
          },
          overall_summary: {
            type: "string",
          },
          primary_action: {
            additionalProperties: false,
            properties: {
              action_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
              constraint_label: {
                type: "string",
              },
              instruction: {
                type: "string",
              },
              rationale: {
                type: "string",
              },
            },
            required: ["action_id", "instruction"],
            type: "object",
          },
          ritual_notes: {
            additionalProperties: {
              type: "string",
            },
            propertyNames: {
              pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
              type: "string",
            },
            type: "object",
          },
          state_response: {
            type: "string",
          },
        },
        required: [
          "greeting",
          "state_response",
          "overall_summary",
          "core_tip",
          "explanation_paragraphs",
          "dimension_explanations",
          "primary_action",
          "optional_task",
          "ritual_notes",
          "closing",
        ],
        type: "object",
      },
      facts: {
        additionalProperties: false,
        properties: {
          action_candidates: {
            items: {
              additionalProperties: false,
              properties: {
                action_id: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
                basis_refs: {
                  items: {
                    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                    type: "string",
                  },
                  maxItems: 5,
                  type: "array",
                },
                constraint_token: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                effort: {
                  enum: ["VERY_LIGHT", "LIGHT"],
                  type: "string",
                },
                kind: {
                  enum: [
                    "PRIORITIZE_ONE",
                    "PREPARE_ONE_STEP",
                    "COMMUNICATE_CLEARLY",
                    "REDUCE_SWITCHING",
                    "ORGANIZE_SMALL_SCOPE",
                    "PAUSE_AND_RECOVER",
                    "REFLECT_BRIEFLY",
                    "SEEK_REAL_SUPPORT",
                  ],
                  type: "string",
                },
                target_scope: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                timebox_minutes: {
                  maximum: 30,
                  minimum: 5,
                  type: "integer",
                },
              },
              required: ["action_id", "kind", "target_scope", "effort"],
              type: "object",
            },
            maxItems: 3,
            minItems: 1,
            type: "array",
          },
          care_dimension_id: {
            enum: ["pace", "action", "connection", "resources", "recovery"],
            type: "string",
          },
          dimensions: {
            items: {
              additionalProperties: false,
              properties: {
                band: {
                  enum: ["LOW", "STEADY", "HIGH"],
                  type: "string",
                },
                id: {
                  enum: [
                    "pace",
                    "action",
                    "connection",
                    "resources",
                    "recovery",
                  ],
                  type: "string",
                },
                label_token: {
                  enum: ["TAKE_IT_GENTLY", "KEEP_IT_STEADY", "ROOM_TO_MOVE"],
                  type: "string",
                },
                score: {
                  maximum: 100,
                  minimum: 0,
                  type: "integer",
                },
              },
              required: ["score", "band", "label_token", "id"],
              type: "object",
            },
            maxItems: 5,
            minItems: 5,
            type: "array",
          },
          display_order: {
            items: {
              enum: ["pace", "action", "connection", "resources", "recovery"],
              type: "string",
            },
            maxItems: 5,
            minItems: 5,
            type: "array",
          },
          explanation_basis: {
            items: {
              additionalProperties: false,
              properties: {
                code: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                type: {
                  enum: [
                    "CHECKIN_SIGNAL",
                    "DIMENSION_SIGNAL",
                    "PROFILE_SIGNAL",
                    "RELATIONSHIP_SIGNAL",
                    "CONTEXT_SIGNAL",
                  ],
                  type: "string",
                },
              },
              required: ["type", "code"],
              type: "object",
            },
            maxItems: 5,
            type: "array",
          },
          focus_dimension_id: {
            enum: ["pace", "action", "connection", "resources", "recovery"],
            type: "string",
          },
          optional_task_plan: {
            additionalProperties: false,
            properties: {
              effort: {
                enum: ["VERY_LIGHT", "LIGHT"],
                type: "string",
              },
              kind: {
                enum: [
                  "PRIORITIZE_ONE",
                  "PREPARE_ONE_STEP",
                  "COMMUNICATE_CLEARLY",
                  "REDUCE_SWITCHING",
                  "ORGANIZE_SMALL_SCOPE",
                  "PAUSE_AND_RECOVER",
                  "REFLECT_BRIEFLY",
                  "SEEK_REAL_SUPPORT",
                ],
                type: "string",
              },
              task_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
              timebox_minutes: {
                maximum: 30,
                minimum: 5,
                type: "integer",
              },
            },
            required: ["task_id", "kind", "effort"],
            type: "object",
          },
          overall: {
            additionalProperties: false,
            properties: {
              band: {
                enum: ["LOW", "STEADY", "HIGH"],
                type: "string",
              },
              label_token: {
                enum: ["TAKE_IT_GENTLY", "KEEP_IT_STEADY", "ROOM_TO_MOVE"],
                type: "string",
              },
              score: {
                maximum: 100,
                minimum: 0,
                type: "integer",
              },
            },
            required: ["score", "band", "label_token"],
            type: "object",
          },
          ritual_facts: {
            items: {
              oneOf: [
                {
                  additionalProperties: false,
                  properties: {
                    kind: {
                      const: "COLOR",
                      type: "string",
                    },
                    ritual_id: {
                      pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                      type: "string",
                    },
                    value: {
                      pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                      type: "string",
                    },
                  },
                  required: ["ritual_id", "kind", "value"],
                  type: "object",
                },
                {
                  additionalProperties: false,
                  properties: {
                    kind: {
                      const: "NUMBER",
                      type: "string",
                    },
                    ritual_id: {
                      pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                      type: "string",
                    },
                    value: {
                      maximum: 9,
                      minimum: 1,
                      type: "integer",
                    },
                  },
                  required: ["ritual_id", "kind", "value"],
                  type: "object",
                },
              ],
            },
            maxItems: 2,
            type: "array",
          },
          selected_action_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          supporting_dimension_id: {
            enum: ["pace", "action", "connection", "resources", "recovery"],
            type: "string",
          },
        },
        required: [
          "overall",
          "dimensions",
          "focus_dimension_id",
          "display_order",
          "explanation_basis",
          "action_candidates",
          "selected_action_id",
          "optional_task_plan",
          "ritual_facts",
        ],
        type: "object",
      },
      identity: {
        additionalProperties: false,
        properties: {
          generated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          product_date: {
            pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
            type: "string",
          },
          result_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          result_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          user_ref: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
        },
        required: [
          "result_id",
          "user_ref",
          "product_date",
          "result_version",
          "generated_at",
        ],
        type: "object",
      },
      input_snapshot_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      privacy_fallbacks: {
        additionalProperties: {
          type: "string",
        },
        propertyNames: {
          maxLength: 160,
          minLength: 1,
          pattern: "^[A-Za-z0-9_.[\\]-]+$",
          type: "string",
        },
        type: "object",
      },
      provenance: {
        additionalProperties: false,
        properties: {
          algorithm_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          generation_mode: {
            enum: ["PRIMARY_AI", "BACKUP_AI", "CONTROLLED_TEMPLATE"],
            type: "string",
          },
          input_snapshot_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          model: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          personalization_level: {
            enum: ["FULL", "REDUCED"],
            type: "string",
          },
          prompt_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          provider: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          rule_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          safety_policy_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          template_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
        },
        required: [
          "input_snapshot_version",
          "rule_version",
          "algorithm_version",
          "generation_mode",
          "personalization_level",
          "safety_policy_version",
        ],
        type: "object",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      source_dependencies: {
        items: {
          additionalProperties: false,
          properties: {
            fallback_paths: {
              items: {
                maxLength: 160,
                minLength: 1,
                pattern: "^[A-Za-z0-9_.[\\]-]+$",
                type: "string",
              },
              maxItems: 8,
              minItems: 1,
              type: "array",
            },
            purpose: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            segment_paths: {
              items: {
                maxLength: 160,
                minLength: 1,
                pattern: "^[A-Za-z0-9_.[\\]-]+$",
                type: "string",
              },
              maxItems: 8,
              minItems: 1,
              type: "array",
            },
            source_ref: {
              pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
              type: "string",
            },
            source_revision: {
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
              type: "integer",
            },
            source_type: {
              enum: [
                "CHECKIN",
                "RECENT_RECORD",
                "RELATIONSHIP",
                "IMPORTANT_MATTER",
              ],
              type: "string",
            },
            valid_at_publish: {
              const: true,
              type: "boolean",
            },
          },
          required: [
            "source_ref",
            "source_type",
            "source_revision",
            "purpose",
            "segment_paths",
            "fallback_paths",
            "valid_at_publish",
          ],
          type: "object",
        },
        maxItems: 12,
        type: "array",
      },
      validation: {
        additionalProperties: false,
        properties: {
          status: {
            const: "PASSED",
            type: "string",
          },
          validated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: ["status", "validated_at"],
        type: "object",
      },
    },
    required: [
      "contract",
      "schema_version",
      "identity",
      "input_snapshot_ref",
      "facts",
      "expression",
      "source_dependencies",
      "privacy_fallbacks",
      "provenance",
      "validation",
    ],
    type: "object",
  },
  clientDailyContentView: {
    $id: "urn:dailyenergy:schema:client-daily-content-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      closing: {
        type: "string",
      },
      content_label: {
        const: "娱乐与行动参考",
        type: "string",
      },
      contract: {
        const: "daily-content-view",
        type: "string",
      },
      core_tip: {
        type: "string",
      },
      dimensions: {
        items: {
          additionalProperties: false,
          properties: {
            band: {
              enum: ["LOW", "STEADY", "HIGH"],
              type: "string",
            },
            band_label: {
              type: "string",
            },
            explanation: {
              type: "string",
            },
            id: {
              enum: ["pace", "action", "connection", "resources", "recovery"],
              type: "string",
            },
            is_focus: {
              type: "boolean",
            },
            label: {
              type: "string",
            },
          },
          required: [
            "id",
            "label",
            "band",
            "band_label",
            "explanation",
            "is_focus",
          ],
          type: "object",
        },
        maxItems: 5,
        minItems: 5,
        type: "array",
      },
      explanation_paragraphs: {
        items: {
          type: "string",
        },
        maxItems: 2,
        minItems: 1,
        type: "array",
      },
      focus_dimension_id: {
        enum: ["pace", "action", "connection", "resources", "recovery"],
        type: "string",
      },
      generated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      greeting: {
        type: "string",
      },
      optional_task: {
        additionalProperties: false,
        properties: {
          instruction: {
            type: "string",
          },
          task_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
        },
        required: ["task_id", "instruction"],
        type: "object",
      },
      overall: {
        additionalProperties: false,
        properties: {
          band: {
            enum: ["LOW", "STEADY", "HIGH"],
            type: "string",
          },
          band_label: {
            type: "string",
          },
          summary: {
            type: "string",
          },
        },
        required: ["band", "band_label", "summary"],
        type: "object",
      },
      personalization_notice: {
        enum: ["NONE", "PERSONALIZATION_REDUCED"],
        type: "string",
      },
      primary_action: {
        additionalProperties: false,
        properties: {
          action_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          constraint_label: {
            type: "string",
          },
          instruction: {
            type: "string",
          },
          rationale: {
            type: "string",
          },
        },
        required: ["action_id", "instruction"],
        type: "object",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      result_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      result_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      rituals: {
        items: {
          additionalProperties: false,
          properties: {
            display_value: {
              type: "string",
            },
            kind: {
              enum: ["COLOR", "NUMBER"],
              type: "string",
            },
            note: {
              type: "string",
            },
          },
          required: ["kind", "display_value", "note"],
          type: "object",
        },
        maxItems: 2,
        type: "array",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      state_response: {
        type: "string",
      },
    },
    required: [
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
    ],
    type: "object",
  },
  dailyInteractionState: {
    $id: "urn:dailyenergy:schema:daily-interaction-state:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      contract: {
        const: "daily-interaction-state",
        type: "string",
      },
      helpfulness: {
        additionalProperties: false,
        properties: {
          rating: {
            enum: ["UNRATED", "HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
            type: "string",
          },
          revision: {
            maximum: 9007199254740991,
            minimum: 0,
            type: "integer",
          },
        },
        required: ["revision", "rating"],
        type: "object",
      },
      is_lit: {
        type: "boolean",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      result_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      task: {
        additionalProperties: false,
        properties: {
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          status: {
            enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
            type: "string",
          },
          task_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
        },
        required: ["task_id", "revision", "status"],
        type: "object",
      },
      updated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "result_id",
      "product_date",
      "is_lit",
      "task",
      "helpfulness",
      "updated_at",
    ],
    type: "object",
  },
  eveningFeedbackDraft: {
    $id: "urn:dailyenergy:schema:evening-feedback-draft:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      helpfulness_rating: {
        enum: ["HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
        type: "string",
      },
      last_edited_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      note: {
        type: "string",
      },
      overall_feeling: {
        enum: [
          "VERY_HEAVY",
          "SOMEWHAT_HEAVY",
          "STEADY",
          "PRETTY_GOOD",
          "LIGHT",
          "UNSURE",
        ],
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      task_status: {
        enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
        type: "string",
      },
    },
    required: ["product_date", "last_edited_at"],
    type: "object",
  },
  eveningReflectionSubmission: {
    $id: "urn:dailyenergy:schema:evening-reflection-submission:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          entry_source: {
            enum: [
              "TODAY_SECONDARY",
              "TODAY_EVENING_CARD",
              "REMINDER_DEEP_LINK",
              "EDIT_EXISTING",
            ],
            type: "string",
          },
          view_schema_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
        },
        required: ["entry_source", "view_schema_version"],
        type: "object",
      },
      contract: {
        const: "evening-reflection-submission",
        type: "string",
      },
      expected_feedback_revision: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      expected_helpfulness_revision: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      helpfulness_rating: {
        enum: ["HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
        type: "string",
      },
      note_patch: {
        oneOf: [
          {
            additionalProperties: false,
            properties: {
              operation: {
                const: "SET",
                type: "string",
              },
              value: {
                type: "string",
              },
            },
            required: ["operation", "value"],
            type: "object",
          },
          {
            additionalProperties: false,
            properties: {
              operation: {
                const: "CLEAR",
                type: "string",
              },
            },
            required: ["operation"],
            type: "object",
          },
        ],
      },
      overall_feeling: {
        enum: [
          "VERY_HEAVY",
          "SOMEWHAT_HEAVY",
          "STEADY",
          "PRETTY_GOOD",
          "LIGHT",
          "UNSURE",
        ],
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      submission_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      task_patch: {
        additionalProperties: false,
        properties: {
          expected_revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          status: {
            enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
            type: "string",
          },
          task_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
        },
        required: ["task_id", "expected_revision", "status"],
        type: "object",
      },
    },
    required: [
      "contract",
      "schema_version",
      "submission_id",
      "product_date",
      "expected_feedback_revision",
      "expected_helpfulness_revision",
      "overall_feeling",
      "helpfulness_rating",
      "client_context",
    ],
    type: "object",
  },
  eveningFeedbackRecord: {
    $id: "urn:dailyenergy:schema:evening-feedback-record:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      contract: {
        const: "evening-feedback",
        type: "string",
      },
      feedback_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      first_submitted_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      note: {
        type: "string",
      },
      overall_feeling: {
        enum: [
          "VERY_HEAVY",
          "SOMEWHAT_HEAVY",
          "STEADY",
          "PRETTY_GOOD",
          "LIGHT",
          "UNSURE",
        ],
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      safety_policy_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      source_submission_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      updated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      user_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "feedback_id",
      "user_ref",
      "product_date",
      "revision",
      "overall_feeling",
      "first_submitted_at",
      "updated_at",
      "source_submission_id",
      "safety_policy_version",
    ],
    type: "object",
  },
  eveningFeedbackRevision: {
    $id: "urn:dailyenergy:schema:evening-feedback-revision:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      change_source: {
        enum: ["USER_SUBMISSION", "DATA_RIGHTS_PROCESS"],
        type: "string",
      },
      changed_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      changed_fields: {
        items: {
          enum: ["overall_feeling", "note"],
          type: "string",
        },
        maxItems: 2,
        minItems: 1,
        type: "array",
      },
      contract: {
        const: "evening-feedback-revision",
        type: "string",
      },
      feedback_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      safety_policy_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      source_submission_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "feedback_id",
      "revision",
      "changed_fields",
      "source_submission_id",
      "changed_at",
      "change_source",
      "safety_policy_version",
    ],
    type: "object",
  },
  dailyHelpfulnessRecord: {
    $id: "urn:dailyenergy:schema:daily-helpfulness-record:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      contract: {
        const: "daily-helpfulness",
        type: "string",
      },
      helpfulness_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      rating: {
        enum: ["HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
        type: "string",
      },
      revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      source_submission_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      updated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      user_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "helpfulness_id",
      "user_ref",
      "product_date",
      "revision",
      "rating",
      "updated_at",
      "source_submission_id",
    ],
    type: "object",
  },
  dailyTaskState: {
    $id: "urn:dailyenergy:schema:daily-task-state:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      contract: {
        const: "daily-task-state",
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      source_submission_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      status: {
        enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
        type: "string",
      },
      task_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      updated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      user_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "task_id",
      "user_ref",
      "product_date",
      "revision",
      "status",
      "updated_at",
      "source_submission_id",
    ],
    type: "object",
  },
  clientEveningFeedbackView: {
    $id: "urn:dailyenergy:schema:client-evening-feedback-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      availability: {
        enum: [
          "UNAVAILABLE",
          "EDITABLE_EMPTY",
          "EDITABLE_SUBMITTED",
          "READ_ONLY_SUBMITTED",
          "READ_ONLY_EMPTY",
        ],
        type: "string",
      },
      completion_message: {
        type: "string",
      },
      contract: {
        const: "evening-feedback-view",
        type: "string",
      },
      feedback: {
        additionalProperties: false,
        properties: {
          first_submitted_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          note: {
            type: "string",
          },
          overall_feeling: {
            enum: [
              "VERY_HEAVY",
              "SOMEWHAT_HEAVY",
              "STEADY",
              "PRETTY_GOOD",
              "LIGHT",
              "UNSURE",
            ],
            type: "string",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          updated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: [
          "revision",
          "overall_feeling",
          "first_submitted_at",
          "updated_at",
        ],
        type: "object",
      },
      helpfulness: {
        additionalProperties: false,
        properties: {
          rating: {
            enum: ["UNRATED", "HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
            type: "string",
          },
          revision: {
            maximum: 9007199254740991,
            minimum: 0,
            type: "integer",
          },
        },
        required: ["revision", "rating"],
        type: "object",
      },
      note_max_characters: {
        const: 80,
        type: "number",
      },
      options: {
        additionalProperties: false,
        properties: {
          helpfulness: {
            prefixItems: [
              {
                const: "HELPFUL",
                type: "string",
              },
              {
                const: "NEUTRAL",
                type: "string",
              },
              {
                const: "NOT_HELPFUL",
                type: "string",
              },
              {
                const: "NOT_USED",
                type: "string",
              },
            ],
            type: "array",
          },
          overall_feeling: {
            prefixItems: [
              {
                const: "VERY_HEAVY",
                type: "string",
              },
              {
                const: "SOMEWHAT_HEAVY",
                type: "string",
              },
              {
                const: "STEADY",
                type: "string",
              },
              {
                const: "PRETTY_GOOD",
                type: "string",
              },
              {
                const: "LIGHT",
                type: "string",
              },
              {
                const: "UNSURE",
                type: "string",
              },
            ],
            type: "array",
          },
          task_status: {
            prefixItems: [
              {
                const: "UNMARKED",
                type: "string",
              },
              {
                const: "INTERESTED",
                type: "string",
              },
              {
                const: "COMPLETED",
                type: "string",
              },
              {
                const: "SKIPPED",
                type: "string",
              },
            ],
            type: "array",
          },
        },
        required: ["overall_feeling", "helpfulness", "task_status"],
        type: "object",
      },
      primary_action: {
        enum: ["SAVE", "SAVE_CHANGES", "READ_ONLY"],
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      task: {
        additionalProperties: false,
        properties: {
          instruction: {
            type: "string",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          status: {
            enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
            type: "string",
          },
          task_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
        },
        required: ["task_id", "instruction", "revision", "status"],
        type: "object",
      },
      unavailable_message: {
        type: "string",
      },
      write_window: {
        enum: ["OPEN", "CONTINUATION_ONLY", "CLOSED"],
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "product_date",
      "availability",
      "write_window",
      "helpfulness",
      "options",
      "note_max_characters",
      "primary_action",
      "completion_message",
    ],
    type: "object",
  },
  weeklySourceSnapshot: {
    $id: "urn:dailyenergy:schema:weekly-source-snapshot:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      contract: {
        const: "weekly-source-snapshot",
        type: "string",
      },
      days: {
        items: {
          additionalProperties: false,
          properties: {
            checkin: {
              additionalProperties: false,
              properties: {
                energy: {
                  enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
                  type: "string",
                },
                mood: {
                  enum: [
                    "VERY_LOW",
                    "LOW",
                    "STEADY",
                    "GOOD",
                    "LIGHT",
                    "UNSURE",
                  ],
                  type: "string",
                },
                revision: {
                  exclusiveMinimum: 0,
                  maximum: 9007199254740991,
                  type: "integer",
                },
                sleep: {
                  enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
                  type: "string",
                },
                source_ref: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
              },
              required: ["source_ref", "revision", "mood", "energy", "sleep"],
              type: "object",
            },
            evening: {
              additionalProperties: false,
              properties: {
                overall_feeling: {
                  enum: [
                    "VERY_HEAVY",
                    "SOMEWHAT_HEAVY",
                    "STEADY",
                    "PRETTY_GOOD",
                    "LIGHT",
                    "UNSURE",
                  ],
                  type: "string",
                },
                revision: {
                  exclusiveMinimum: 0,
                  maximum: 9007199254740991,
                  type: "integer",
                },
                source_ref: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
              },
              required: ["source_ref", "revision", "overall_feeling"],
              type: "object",
            },
            helpfulness: {
              additionalProperties: false,
              properties: {
                action_kind: {
                  enum: [
                    "PRIORITIZE_ONE",
                    "PREPARE_ONE_STEP",
                    "COMMUNICATE_CLEARLY",
                    "REDUCE_SWITCHING",
                    "ORGANIZE_SMALL_SCOPE",
                    "PAUSE_AND_RECOVER",
                    "REFLECT_BRIEFLY",
                    "SEEK_REAL_SUPPORT",
                  ],
                  type: "string",
                },
                rating: {
                  enum: ["HELPFUL", "NEUTRAL", "NOT_HELPFUL", "NOT_USED"],
                  type: "string",
                },
                revision: {
                  exclusiveMinimum: 0,
                  maximum: 9007199254740991,
                  type: "integer",
                },
                source_ref: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
              },
              required: ["source_ref", "revision", "rating"],
              type: "object",
            },
            light: {
              additionalProperties: false,
              properties: {
                is_lit: {
                  type: "boolean",
                },
                source_ref: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
              },
              required: ["source_ref", "is_lit"],
              type: "object",
            },
            product_date: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
            source_state: {
              enum: ["RECORDED", "PARTIAL", "MISSING"],
              type: "string",
            },
            task: {
              additionalProperties: false,
              properties: {
                revision: {
                  exclusiveMinimum: 0,
                  maximum: 9007199254740991,
                  type: "integer",
                },
                source_ref: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
                status: {
                  enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
                  type: "string",
                },
              },
              required: ["source_ref", "revision", "status"],
              type: "object",
            },
          },
          required: ["product_date", "source_state"],
          type: "object",
        },
        maxItems: 7,
        minItems: 7,
        type: "array",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      source_fingerprint: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      window_end_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      window_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      window_rule_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      window_start_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "window_id",
      "window_start_date",
      "window_end_date",
      "window_rule_version",
      "days",
      "source_fingerprint",
    ],
    type: "object",
  },
  weeklyAggregateFacts: {
    $id: "urn:dailyenergy:schema:weekly-aggregate-facts:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      aggregate_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      approved_fact_catalog: {
        items: {
          pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
          type: "string",
        },
        maxItems: 32,
        minItems: 1,
        type: "array",
      },
      contract: {
        const: "weekly-aggregate-facts",
        type: "string",
      },
      coverage: {
        additionalProperties: false,
        properties: {
          checkin_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          coverage_level: {
            enum: ["EMPTY", "POINTS_ONLY", "PARTIAL", "COMPLETE"],
            type: "string",
          },
          evening_feedback_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          lit_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          missing_dates: {
            items: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
            maxItems: 7,
            type: "array",
          },
          real_state_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          window_day_count: {
            const: 7,
            type: "number",
          },
        },
        required: [
          "window_day_count",
          "real_state_day_count",
          "checkin_day_count",
          "evening_feedback_day_count",
          "lit_day_count",
          "missing_dates",
          "coverage_level",
        ],
        type: "object",
      },
      day_slots: {
        items: {
          additionalProperties: false,
          properties: {
            evening: {
              additionalProperties: false,
              properties: {
                overall_feeling: {
                  enum: [
                    "VERY_HEAVY",
                    "SOMEWHAT_HEAVY",
                    "STEADY",
                    "PRETTY_GOOD",
                    "LIGHT",
                    "UNSURE",
                  ],
                  type: "string",
                },
              },
              required: ["overall_feeling"],
              type: "object",
            },
            helpful_action_kind: {
              enum: [
                "PRIORITIZE_ONE",
                "PREPARE_ONE_STEP",
                "COMMUNICATE_CLEARLY",
                "REDUCE_SWITCHING",
                "ORGANIZE_SMALL_SCOPE",
                "PAUSE_AND_RECOVER",
                "REFLECT_BRIEFLY",
                "SEEK_REAL_SUPPORT",
              ],
              type: "string",
            },
            helpfulness: {
              enum: [
                "UNRATED",
                "HELPFUL",
                "NEUTRAL",
                "NOT_HELPFUL",
                "NOT_USED",
              ],
              type: "string",
            },
            is_lit: {
              type: "boolean",
            },
            morning: {
              additionalProperties: false,
              properties: {
                energy: {
                  enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
                  type: "string",
                },
                mood: {
                  enum: [
                    "VERY_LOW",
                    "LOW",
                    "STEADY",
                    "GOOD",
                    "LIGHT",
                    "UNSURE",
                  ],
                  type: "string",
                },
                sleep: {
                  enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
                  type: "string",
                },
              },
              required: ["mood", "energy", "sleep"],
              type: "object",
            },
            product_date: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
            state: {
              enum: ["RECORDED", "MISSING"],
              type: "string",
            },
            task_status: {
              enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
              type: "string",
            },
          },
          required: ["product_date", "state", "is_lit", "helpfulness"],
          type: "object",
        },
        maxItems: 7,
        minItems: 7,
        type: "array",
      },
      feedback_facts: {
        additionalProperties: false,
        properties: {
          evening_feedback_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
        },
        required: ["evening_feedback_day_count"],
        type: "object",
      },
      helpfulness_facts: {
        additionalProperties: false,
        properties: {
          helpful_action_kind_counts: {
            additionalProperties: {
              maximum: 7,
              minimum: 0,
              type: "integer",
            },
            propertyNames: {
              enum: [
                "PRIORITIZE_ONE",
                "PREPARE_ONE_STEP",
                "COMMUNICATE_CLEARLY",
                "REDUCE_SWITCHING",
                "ORGANIZE_SMALL_SCOPE",
                "PAUSE_AND_RECOVER",
                "REFLECT_BRIEFLY",
                "SEEK_REAL_SUPPORT",
              ],
              type: "string",
            },
            type: "object",
          },
          helpful_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          neutral_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          not_helpful_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          not_used_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          rated_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          top_helpful_action_kind: {
            enum: [
              "PRIORITIZE_ONE",
              "PREPARE_ONE_STEP",
              "COMMUNICATE_CLEARLY",
              "REDUCE_SWITCHING",
              "ORGANIZE_SMALL_SCOPE",
              "PAUSE_AND_RECOVER",
              "REFLECT_BRIEFLY",
              "SEEK_REAL_SUPPORT",
            ],
            type: "string",
          },
          unrated_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
        },
        required: [
          "rated_day_count",
          "helpful_count",
          "neutral_count",
          "not_helpful_count",
          "not_used_count",
          "unrated_day_count",
          "helpful_action_kind_counts",
        ],
        type: "object",
      },
      light_facts: {
        additionalProperties: false,
        properties: {
          lit_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
        },
        required: ["lit_day_count"],
        type: "object",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      source_fingerprint: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      state_metrics: {
        items: {
          oneOf: [
            {
              additionalProperties: false,
              properties: {
                direction: {
                  enum: [
                    "INSUFFICIENT_DATA",
                    "LOWER_LATE",
                    "SIMILAR",
                    "HIGHER_LATE",
                    "VARIABLE",
                  ],
                  type: "string",
                },
                direction_basis_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                distribution: {
                  additionalProperties: false,
                  properties: {
                    GOOD: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    LIGHT: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    LOW: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    STEADY: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    VERY_LOW: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                  },
                  required: ["VERY_LOW", "LOW", "STEADY", "GOOD", "LIGHT"],
                  type: "object",
                },
                metric_id: {
                  const: "MORNING_MOOD",
                  type: "string",
                },
                missing_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                mode_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                mode_value: {
                  enum: ["VERY_LOW", "LOW", "STEADY", "GOOD", "LIGHT"],
                  type: "string",
                },
                observed_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                summary_token: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                unsure_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
              },
              required: [
                "metric_id",
                "observed_count",
                "unsure_count",
                "missing_count",
                "direction",
                "direction_basis_count",
                "distribution",
              ],
              type: "object",
            },
            {
              additionalProperties: false,
              properties: {
                direction: {
                  enum: [
                    "INSUFFICIENT_DATA",
                    "LOWER_LATE",
                    "SIMILAR",
                    "HIGHER_LATE",
                    "VARIABLE",
                  ],
                  type: "string",
                },
                direction_basis_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                distribution: {
                  additionalProperties: false,
                  properties: {
                    EMPTY: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    FULL: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    HIGH: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    LOW: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    STEADY: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                  },
                  required: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL"],
                  type: "object",
                },
                metric_id: {
                  const: "MORNING_ENERGY",
                  type: "string",
                },
                missing_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                mode_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                mode_value: {
                  enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL"],
                  type: "string",
                },
                observed_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                summary_token: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                unsure_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
              },
              required: [
                "metric_id",
                "observed_count",
                "unsure_count",
                "missing_count",
                "direction",
                "direction_basis_count",
                "distribution",
              ],
              type: "object",
            },
            {
              additionalProperties: false,
              properties: {
                direction: {
                  enum: [
                    "INSUFFICIENT_DATA",
                    "LOWER_LATE",
                    "SIMILAR",
                    "HIGHER_LATE",
                    "VARIABLE",
                  ],
                  type: "string",
                },
                direction_basis_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                distribution: {
                  additionalProperties: false,
                  properties: {
                    GOOD: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    LOW: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    OKAY: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    POOR: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                  },
                  required: ["POOR", "LOW", "OKAY", "GOOD"],
                  type: "object",
                },
                metric_id: {
                  const: "MORNING_SLEEP",
                  type: "string",
                },
                missing_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                mode_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                mode_value: {
                  enum: ["POOR", "LOW", "OKAY", "GOOD"],
                  type: "string",
                },
                observed_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                summary_token: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                unsure_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
              },
              required: [
                "metric_id",
                "observed_count",
                "unsure_count",
                "missing_count",
                "direction",
                "direction_basis_count",
                "distribution",
              ],
              type: "object",
            },
            {
              additionalProperties: false,
              properties: {
                direction: {
                  enum: [
                    "INSUFFICIENT_DATA",
                    "LOWER_LATE",
                    "SIMILAR",
                    "HIGHER_LATE",
                    "VARIABLE",
                  ],
                  type: "string",
                },
                direction_basis_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                distribution: {
                  additionalProperties: false,
                  properties: {
                    LIGHT: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    PRETTY_GOOD: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    SOMEWHAT_HEAVY: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    STEADY: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                    VERY_HEAVY: {
                      maximum: 7,
                      minimum: 0,
                      type: "integer",
                    },
                  },
                  required: [
                    "VERY_HEAVY",
                    "SOMEWHAT_HEAVY",
                    "STEADY",
                    "PRETTY_GOOD",
                    "LIGHT",
                  ],
                  type: "object",
                },
                metric_id: {
                  const: "EVENING_OVERALL",
                  type: "string",
                },
                missing_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                mode_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                mode_value: {
                  enum: [
                    "VERY_HEAVY",
                    "SOMEWHAT_HEAVY",
                    "STEADY",
                    "PRETTY_GOOD",
                    "LIGHT",
                  ],
                  type: "string",
                },
                observed_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
                summary_token: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                unsure_count: {
                  maximum: 7,
                  minimum: 0,
                  type: "integer",
                },
              },
              required: [
                "metric_id",
                "observed_count",
                "unsure_count",
                "missing_count",
                "direction",
                "direction_basis_count",
                "distribution",
              ],
              type: "object",
            },
          ],
        },
        maxItems: 4,
        minItems: 4,
        type: "array",
      },
      task_facts: {
        additionalProperties: false,
        properties: {
          completed_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          interested_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          skipped_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          task_offered_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          unmarked_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
        },
        required: [
          "task_offered_day_count",
          "completed_count",
          "skipped_count",
          "interested_count",
          "unmarked_count",
        ],
        type: "object",
      },
      window_end_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      window_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      window_start_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "window_id",
      "window_start_date",
      "window_end_date",
      "coverage",
      "day_slots",
      "state_metrics",
      "light_facts",
      "feedback_facts",
      "helpfulness_facts",
      "task_facts",
      "approved_fact_catalog",
      "source_fingerprint",
      "aggregate_version",
    ],
    type: "object",
  },
  weeklyExpressionPlan: {
    $id: "urn:dailyenergy:schema:weekly-expression-plan:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      approved_fact_ids: {
        items: {
          pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
          type: "string",
        },
        maxItems: 12,
        minItems: 3,
        type: "array",
      },
      coverage_fact_id: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      coverage_level: {
        enum: ["PARTIAL", "COMPLETE"],
        type: "string",
      },
      headline_fact_id: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      helpful_pattern_fact_id: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      next_observation_fact_id: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      next_observation_plan: {
        enum: [
          "NOTICE_ENERGY_TIMING",
          "NOTICE_MOOD_SHIFTS",
          "NOTICE_SLEEP_AND_ENERGY",
          "NOTICE_HELPFUL_ACTIONS",
          "KEEP_ONE_SMALL_NOTE",
          "CONTINUE_WITHOUT_PRESSURE",
        ],
        type: "string",
      },
      observation_fact_ids: {
        items: {
          pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
          type: "string",
        },
        maxItems: 2,
        minItems: 1,
        type: "array",
      },
      source_disclosure_fact_id: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
    },
    required: [
      "coverage_level",
      "approved_fact_ids",
      "headline_fact_id",
      "observation_fact_ids",
      "next_observation_plan",
      "next_observation_fact_id",
      "coverage_fact_id",
      "source_disclosure_fact_id",
    ],
    type: "object",
  },
  weeklyExpressionPayload: {
    $id: "urn:dailyenergy:schema:weekly-expression-payload:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      closing: {
        additionalProperties: false,
        properties: {
          fact_refs: {
            items: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            maxItems: 1,
            minItems: 1,
            type: "array",
          },
          text: {
            type: "string",
          },
        },
        required: ["text", "fact_refs"],
        type: "object",
      },
      helpful_pattern: {
        additionalProperties: false,
        properties: {
          fact_refs: {
            items: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            maxItems: 1,
            minItems: 1,
            type: "array",
          },
          text: {
            type: "string",
          },
        },
        required: ["text", "fact_refs"],
        type: "object",
      },
      next_week: {
        additionalProperties: false,
        properties: {
          fact_refs: {
            items: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            maxItems: 1,
            minItems: 1,
            type: "array",
          },
          text: {
            type: "string",
          },
        },
        required: ["text", "fact_refs"],
        type: "object",
      },
      observations: {
        items: {
          additionalProperties: false,
          properties: {
            fact_refs: {
              items: {
                pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                type: "string",
              },
              maxItems: 2,
              minItems: 1,
              type: "array",
            },
            text: {
              type: "string",
            },
          },
          required: ["text", "fact_refs"],
          type: "object",
        },
        maxItems: 2,
        minItems: 1,
        type: "array",
      },
      opening: {
        additionalProperties: false,
        properties: {
          fact_refs: {
            items: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            maxItems: 2,
            minItems: 1,
            type: "array",
          },
          text: {
            type: "string",
          },
        },
        required: ["text", "fact_refs"],
        type: "object",
      },
      title: {
        type: "string",
      },
    },
    required: ["title", "opening", "observations", "next_week", "closing"],
    type: "object",
  },
  publishedWeeklySummary: {
    $id: "urn:dailyenergy:schema:published-weekly-summary:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      aggregate_facts_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      contract: {
        const: "weekly-summary",
        type: "string",
      },
      expression: {
        additionalProperties: false,
        properties: {
          closing: {
            additionalProperties: false,
            properties: {
              fact_refs: {
                items: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                maxItems: 1,
                minItems: 1,
                type: "array",
              },
              text: {
                type: "string",
              },
            },
            required: ["text", "fact_refs"],
            type: "object",
          },
          helpful_pattern: {
            additionalProperties: false,
            properties: {
              fact_refs: {
                items: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                maxItems: 1,
                minItems: 1,
                type: "array",
              },
              text: {
                type: "string",
              },
            },
            required: ["text", "fact_refs"],
            type: "object",
          },
          next_week: {
            additionalProperties: false,
            properties: {
              fact_refs: {
                items: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                maxItems: 1,
                minItems: 1,
                type: "array",
              },
              text: {
                type: "string",
              },
            },
            required: ["text", "fact_refs"],
            type: "object",
          },
          observations: {
            items: {
              additionalProperties: false,
              properties: {
                fact_refs: {
                  items: {
                    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                    type: "string",
                  },
                  maxItems: 2,
                  minItems: 1,
                  type: "array",
                },
                text: {
                  type: "string",
                },
              },
              required: ["text", "fact_refs"],
              type: "object",
            },
            maxItems: 2,
            minItems: 1,
            type: "array",
          },
          opening: {
            additionalProperties: false,
            properties: {
              fact_refs: {
                items: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                maxItems: 2,
                minItems: 1,
                type: "array",
              },
              text: {
                type: "string",
              },
            },
            required: ["text", "fact_refs"],
            type: "object",
          },
          title: {
            type: "string",
          },
        },
        required: ["title", "opening", "observations", "next_week", "closing"],
        type: "object",
      },
      expression_plan: {
        additionalProperties: false,
        properties: {
          approved_fact_ids: {
            items: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            maxItems: 12,
            minItems: 3,
            type: "array",
          },
          coverage_fact_id: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          coverage_level: {
            enum: ["PARTIAL", "COMPLETE"],
            type: "string",
          },
          headline_fact_id: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          helpful_pattern_fact_id: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          next_observation_fact_id: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          next_observation_plan: {
            enum: [
              "NOTICE_ENERGY_TIMING",
              "NOTICE_MOOD_SHIFTS",
              "NOTICE_SLEEP_AND_ENERGY",
              "NOTICE_HELPFUL_ACTIONS",
              "KEEP_ONE_SMALL_NOTE",
              "CONTINUE_WITHOUT_PRESSURE",
            ],
            type: "string",
          },
          observation_fact_ids: {
            items: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            maxItems: 2,
            minItems: 1,
            type: "array",
          },
          source_disclosure_fact_id: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
        },
        required: [
          "coverage_level",
          "approved_fact_ids",
          "headline_fact_id",
          "observation_fact_ids",
          "next_observation_plan",
          "next_observation_fact_id",
          "coverage_fact_id",
          "source_disclosure_fact_id",
        ],
        type: "object",
      },
      expression_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      privacy_fallbacks: {
        additionalProperties: {
          type: "string",
        },
        propertyNames: {
          pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
          type: "string",
        },
        type: "object",
      },
      provenance: {
        additionalProperties: false,
        properties: {
          generation_mode: {
            enum: ["PRIMARY_AI", "BACKUP_AI", "CONTROLLED_TEMPLATE"],
            type: "string",
          },
          model: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          personalization_level: {
            enum: ["FULL", "REDUCED"],
            type: "string",
          },
          prompt_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          provider: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          safety_policy_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          template_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
        },
        required: [
          "generation_mode",
          "personalization_level",
          "safety_policy_version",
        ],
        type: "object",
      },
      published_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      source_dependencies: {
        items: {
          additionalProperties: false,
          properties: {
            purpose: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            source_ref: {
              pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
              type: "string",
            },
            source_revision: {
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
              type: "integer",
            },
          },
          required: ["source_ref", "source_revision", "purpose"],
          type: "object",
        },
        maxItems: 24,
        type: "array",
      },
      source_fingerprint: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      summary_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      summary_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      supersedes_summary_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      validation: {
        additionalProperties: false,
        properties: {
          status: {
            const: "PASSED",
            type: "string",
          },
          validated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: ["status", "validated_at"],
        type: "object",
      },
      window_end_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      window_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      window_start_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
    },
    required: [
      "contract",
      "schema_version",
      "summary_id",
      "summary_revision",
      "window_id",
      "window_start_date",
      "window_end_date",
      "source_fingerprint",
      "aggregate_facts_ref",
      "expression_version",
      "expression_plan",
      "expression",
      "source_dependencies",
      "privacy_fallbacks",
      "provenance",
      "validation",
      "published_at",
    ],
    type: "object",
  },
  clientWeeklySummaryView: {
    $id: "urn:dailyenergy:schema:client-weekly-summary-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      activity: {
        additionalProperties: false,
        properties: {
          helpfulness: {
            additionalProperties: false,
            properties: {
              helpful_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              neutral_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              not_helpful_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              not_used_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              rated_day_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              top_helpful_action_kind: {
                enum: [
                  "PRIORITIZE_ONE",
                  "PREPARE_ONE_STEP",
                  "COMMUNICATE_CLEARLY",
                  "REDUCE_SWITCHING",
                  "ORGANIZE_SMALL_SCOPE",
                  "PAUSE_AND_RECOVER",
                  "REFLECT_BRIEFLY",
                  "SEEK_REAL_SUPPORT",
                ],
                type: "string",
              },
              unrated_day_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
            },
            required: [
              "rated_day_count",
              "helpful_count",
              "neutral_count",
              "not_helpful_count",
              "not_used_count",
              "unrated_day_count",
            ],
            type: "object",
          },
          lit_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          tasks: {
            additionalProperties: false,
            properties: {
              completed_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              interested_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              skipped_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              task_offered_day_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
              unmarked_count: {
                maximum: 7,
                minimum: 0,
                type: "integer",
              },
            },
            required: [
              "task_offered_day_count",
              "completed_count",
              "skipped_count",
              "interested_count",
              "unmarked_count",
            ],
            type: "object",
          },
        },
        required: ["lit_day_count", "helpfulness", "tasks"],
        type: "object",
      },
      contract: {
        const: "weekly-summary-view",
        type: "string",
      },
      coverage: {
        additionalProperties: false,
        properties: {
          checkin_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          evening_feedback_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          level: {
            enum: ["EMPTY", "POINTS_ONLY", "PARTIAL", "COMPLETE"],
            type: "string",
          },
          lit_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          missing_dates: {
            items: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
            maxItems: 7,
            type: "array",
          },
          real_state_day_count: {
            maximum: 7,
            minimum: 0,
            type: "integer",
          },
          window_day_count: {
            const: 7,
            type: "number",
          },
        },
        required: [
          "level",
          "window_day_count",
          "real_state_day_count",
          "checkin_day_count",
          "evening_feedback_day_count",
          "lit_day_count",
          "missing_dates",
        ],
        type: "object",
      },
      data_disclosure: {
        type: "string",
      },
      days: {
        items: {
          additionalProperties: false,
          properties: {
            evening: {
              additionalProperties: false,
              properties: {
                overall_feeling: {
                  enum: [
                    "VERY_HEAVY",
                    "SOMEWHAT_HEAVY",
                    "STEADY",
                    "PRETTY_GOOD",
                    "LIGHT",
                    "UNSURE",
                  ],
                  type: "string",
                },
              },
              required: ["overall_feeling"],
              type: "object",
            },
            helpfulness: {
              enum: [
                "UNRATED",
                "HELPFUL",
                "NEUTRAL",
                "NOT_HELPFUL",
                "NOT_USED",
              ],
              type: "string",
            },
            is_lit: {
              type: "boolean",
            },
            morning: {
              additionalProperties: false,
              properties: {
                energy: {
                  enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
                  type: "string",
                },
                mood: {
                  enum: [
                    "VERY_LOW",
                    "LOW",
                    "STEADY",
                    "GOOD",
                    "LIGHT",
                    "UNSURE",
                  ],
                  type: "string",
                },
                sleep: {
                  enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
                  type: "string",
                },
              },
              required: ["mood", "energy", "sleep"],
              type: "object",
            },
            product_date: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
            state: {
              enum: ["RECORDED", "MISSING"],
              type: "string",
            },
            task_status: {
              enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
              type: "string",
            },
          },
          required: ["product_date", "state", "is_lit"],
          type: "object",
        },
        maxItems: 7,
        minItems: 7,
        type: "array",
      },
      metrics: {
        items: {
          additionalProperties: false,
          properties: {
            direction: {
              enum: [
                "INSUFFICIENT_DATA",
                "LOWER_LATE",
                "SIMILAR",
                "HIGHER_LATE",
                "VARIABLE",
              ],
              type: "string",
            },
            direction_label: {
              type: "string",
            },
            id: {
              enum: [
                "MORNING_MOOD",
                "MORNING_ENERGY",
                "MORNING_SLEEP",
                "EVENING_OVERALL",
              ],
              type: "string",
            },
            missing_count: {
              maximum: 7,
              minimum: 0,
              type: "integer",
            },
            observed_count: {
              maximum: 7,
              minimum: 0,
              type: "integer",
            },
            unsure_count: {
              maximum: 7,
              minimum: 0,
              type: "integer",
            },
          },
          required: [
            "id",
            "observed_count",
            "unsure_count",
            "missing_count",
            "direction",
            "direction_label",
          ],
          type: "object",
        },
        maxItems: 4,
        minItems: 4,
        type: "array",
      },
      projection_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      relationship_display_token: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      schema_version: {
        pattern:
          "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
        type: "string",
      },
      summary: {
        additionalProperties: false,
        properties: {
          kind: {
            enum: ["PARTIAL_REVIEW", "COMPLETE_REVIEW"],
            type: "string",
          },
          paragraphs: {
            items: {
              type: "string",
            },
            maxItems: 5,
            minItems: 2,
            type: "array",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          summary_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          title: {
            type: "string",
          },
        },
        required: ["summary_id", "revision", "kind", "title", "paragraphs"],
        type: "object",
      },
      summary_status: {
        enum: [
          "NOT_ELIGIBLE",
          "ELIGIBLE",
          "GENERATING",
          "AVAILABLE",
          "INVALIDATED",
          "FAILED",
        ],
        type: "string",
      },
      window_end_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      window_id: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      window_start_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
    },
    required: [
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
      "summary_status",
      "data_disclosure",
    ],
    type: "object",
  },
  wechatSessionRequest: {
    $id: "urn:dailyenergy:schema:wechat-session-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      channel: {
        maxLength: 64,
        minLength: 1,
        type: "string",
      },
      code: {
        maxLength: 256,
        minLength: 1,
        type: "string",
      },
    },
    required: ["code"],
    type: "object",
  },
  checkinSubmitRequest: {
    $id: "urn:dailyenergy:schema:checkin-submit-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      energy: {
        enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
        type: "string",
      },
      expected_revision: {
        const: 0,
        type: "number",
      },
      mood: {
        enum: ["VERY_LOW", "LOW", "STEADY", "GOOD", "LIGHT", "UNSURE"],
        type: "string",
      },
      sleep: {
        enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
        type: "string",
      },
    },
    required: ["command_ref", "expected_revision", "energy", "mood", "sleep"],
    type: "object",
  },
  checkinCorrectRequest: {
    $id: "urn:dailyenergy:schema:checkin-correct-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      energy: {
        enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
        type: "string",
      },
      expected_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      mood: {
        enum: ["VERY_LOW", "LOW", "STEADY", "GOOD", "LIGHT", "UNSURE"],
        type: "string",
      },
      sleep: {
        enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
        type: "string",
      },
    },
    required: ["command_ref", "expected_revision", "energy", "mood", "sleep"],
    type: "object",
  },
  checkinView: {
    $id: "urn:dailyenergy:schema:checkin-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      checkin_ref: {
        format: "uuid",
        pattern:
          "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
        type: "string",
      },
      energy: {
        enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
        type: "string",
      },
      mood: {
        enum: ["VERY_LOW", "LOW", "STEADY", "GOOD", "LIGHT", "UNSURE"],
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      sleep: {
        enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
        type: "string",
      },
      updated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      write_window: {
        enum: ["OPEN", "CONTINUATION_ONLY", "CLOSED"],
        type: "string",
      },
    },
    required: [
      "checkin_ref",
      "product_date",
      "revision",
      "energy",
      "mood",
      "sleep",
      "write_window",
      "updated_at",
    ],
    type: "object",
  },
  generationStartRequest: {
    $id: "urn:dailyenergy:schema:generation-start-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      expected_checkin_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
    },
    required: ["command_ref", "expected_checkin_revision"],
    type: "object",
  },
  taskStateUpdateRequest: {
    $id: "urn:dailyenergy:schema:task-state-update-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      expected_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      status: {
        enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
        type: "string",
      },
      task_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
    },
    required: [
      "command_ref",
      "expected_revision",
      "product_date",
      "status",
      "task_ref",
    ],
    type: "object",
  },
  generationIntentView: {
    $id: "urn:dailyenergy:schema:generation-intent-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      intent_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      result_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      retry_after_seconds: {
        maximum: 3600,
        minimum: 0,
        type: "integer",
      },
      status: {
        enum: [
          "QUEUED",
          "RUNNING",
          "FALLBACK_RUNNING",
          "RETRYABLE_FAILED",
          "SUCCEEDED",
          "TERMINAL_FAILED",
          "CANCELLED",
        ],
        type: "string",
      },
      updated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
    },
    required: ["intent_ref", "product_date", "status", "updated_at"],
    type: "object",
  },
  relationshipView: {
    $id: "urn:dailyenergy:schema:relationship-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      display_token: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      encounter_day_count: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      stage: {
        enum: [
          "BEFORE_FIRST_MEETING",
          "NEWLY_MET",
          "BECOMING_FAMILIAR",
          "FIRST_WEEK_RECORDED",
        ],
        type: "string",
      },
    },
    required: ["stage", "encounter_day_count"],
    type: "object",
  },
  todayView: {
    $id: "urn:dailyenergy:schema:today-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      content: {
        additionalProperties: false,
        properties: {
          closing: {
            type: "string",
          },
          content_label: {
            const: "娱乐与行动参考",
            type: "string",
          },
          contract: {
            const: "daily-content-view",
            type: "string",
          },
          core_tip: {
            type: "string",
          },
          dimensions: {
            items: {
              additionalProperties: false,
              properties: {
                band: {
                  enum: ["LOW", "STEADY", "HIGH"],
                  type: "string",
                },
                band_label: {
                  type: "string",
                },
                explanation: {
                  type: "string",
                },
                id: {
                  enum: [
                    "pace",
                    "action",
                    "connection",
                    "resources",
                    "recovery",
                  ],
                  type: "string",
                },
                is_focus: {
                  type: "boolean",
                },
                label: {
                  type: "string",
                },
              },
              required: [
                "id",
                "label",
                "band",
                "band_label",
                "explanation",
                "is_focus",
              ],
              type: "object",
            },
            maxItems: 5,
            minItems: 5,
            type: "array",
          },
          explanation_paragraphs: {
            items: {
              type: "string",
            },
            maxItems: 2,
            minItems: 1,
            type: "array",
          },
          focus_dimension_id: {
            enum: ["pace", "action", "connection", "resources", "recovery"],
            type: "string",
          },
          generated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          greeting: {
            type: "string",
          },
          optional_task: {
            additionalProperties: false,
            properties: {
              instruction: {
                type: "string",
              },
              task_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
            },
            required: ["task_id", "instruction"],
            type: "object",
          },
          overall: {
            additionalProperties: false,
            properties: {
              band: {
                enum: ["LOW", "STEADY", "HIGH"],
                type: "string",
              },
              band_label: {
                type: "string",
              },
              summary: {
                type: "string",
              },
            },
            required: ["band", "band_label", "summary"],
            type: "object",
          },
          personalization_notice: {
            enum: ["NONE", "PERSONALIZATION_REDUCED"],
            type: "string",
          },
          primary_action: {
            additionalProperties: false,
            properties: {
              action_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
              constraint_label: {
                type: "string",
              },
              instruction: {
                type: "string",
              },
              rationale: {
                type: "string",
              },
            },
            required: ["action_id", "instruction"],
            type: "object",
          },
          product_date: {
            pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
            type: "string",
          },
          result_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          result_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          rituals: {
            items: {
              additionalProperties: false,
              properties: {
                display_value: {
                  type: "string",
                },
                kind: {
                  enum: ["COLOR", "NUMBER"],
                  type: "string",
                },
                note: {
                  type: "string",
                },
              },
              required: ["kind", "display_value", "note"],
              type: "object",
            },
            maxItems: 2,
            type: "array",
          },
          schema_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          state_response: {
            type: "string",
          },
        },
        required: [
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
        ],
        type: "object",
      },
      interaction: {
        additionalProperties: false,
        properties: {
          contract: {
            const: "daily-interaction-state",
            type: "string",
          },
          helpfulness: {
            additionalProperties: false,
            properties: {
              rating: {
                enum: [
                  "UNRATED",
                  "HELPFUL",
                  "NEUTRAL",
                  "NOT_HELPFUL",
                  "NOT_USED",
                ],
                type: "string",
              },
              revision: {
                maximum: 9007199254740991,
                minimum: 0,
                type: "integer",
              },
            },
            required: ["revision", "rating"],
            type: "object",
          },
          is_lit: {
            type: "boolean",
          },
          product_date: {
            pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
            type: "string",
          },
          result_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          schema_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          task: {
            additionalProperties: false,
            properties: {
              revision: {
                exclusiveMinimum: 0,
                maximum: 9007199254740991,
                type: "integer",
              },
              status: {
                enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
                type: "string",
              },
              task_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
            },
            required: ["task_id", "revision", "status"],
            type: "object",
          },
          updated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: [
          "contract",
          "schema_version",
          "result_id",
          "product_date",
          "is_lit",
          "task",
          "helpfulness",
          "updated_at",
        ],
        type: "object",
      },
      relationship: {
        additionalProperties: false,
        properties: {
          display_token: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          encounter_day_count: {
            maximum: 9007199254740991,
            minimum: 0,
            type: "integer",
          },
          stage: {
            enum: [
              "BEFORE_FIRST_MEETING",
              "NEWLY_MET",
              "BECOMING_FAMILIAR",
              "FIRST_WEEK_RECORDED",
            ],
            type: "string",
          },
        },
        required: ["stage", "encounter_day_count"],
        type: "object",
      },
    },
    required: ["content", "interaction", "relationship"],
    type: "object",
  },
  historyDayView: {
    $id: "urn:dailyenergy:schema:history-day-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      checkin: {
        additionalProperties: false,
        properties: {
          checkin_ref: {
            format: "uuid",
            pattern:
              "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
            type: "string",
          },
          energy: {
            enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
            type: "string",
          },
          mood: {
            enum: ["VERY_LOW", "LOW", "STEADY", "GOOD", "LIGHT", "UNSURE"],
            type: "string",
          },
          product_date: {
            pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
            type: "string",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          sleep: {
            enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
            type: "string",
          },
          updated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          write_window: {
            enum: ["OPEN", "CONTINUATION_ONLY", "CLOSED"],
            type: "string",
          },
        },
        required: [
          "checkin_ref",
          "product_date",
          "revision",
          "energy",
          "mood",
          "sleep",
          "write_window",
          "updated_at",
        ],
        type: "object",
      },
      content: {
        additionalProperties: false,
        properties: {
          closing: {
            type: "string",
          },
          content_label: {
            const: "娱乐与行动参考",
            type: "string",
          },
          contract: {
            const: "daily-content-view",
            type: "string",
          },
          core_tip: {
            type: "string",
          },
          dimensions: {
            items: {
              additionalProperties: false,
              properties: {
                band: {
                  enum: ["LOW", "STEADY", "HIGH"],
                  type: "string",
                },
                band_label: {
                  type: "string",
                },
                explanation: {
                  type: "string",
                },
                id: {
                  enum: [
                    "pace",
                    "action",
                    "connection",
                    "resources",
                    "recovery",
                  ],
                  type: "string",
                },
                is_focus: {
                  type: "boolean",
                },
                label: {
                  type: "string",
                },
              },
              required: [
                "id",
                "label",
                "band",
                "band_label",
                "explanation",
                "is_focus",
              ],
              type: "object",
            },
            maxItems: 5,
            minItems: 5,
            type: "array",
          },
          explanation_paragraphs: {
            items: {
              type: "string",
            },
            maxItems: 2,
            minItems: 1,
            type: "array",
          },
          focus_dimension_id: {
            enum: ["pace", "action", "connection", "resources", "recovery"],
            type: "string",
          },
          generated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          greeting: {
            type: "string",
          },
          optional_task: {
            additionalProperties: false,
            properties: {
              instruction: {
                type: "string",
              },
              task_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
            },
            required: ["task_id", "instruction"],
            type: "object",
          },
          overall: {
            additionalProperties: false,
            properties: {
              band: {
                enum: ["LOW", "STEADY", "HIGH"],
                type: "string",
              },
              band_label: {
                type: "string",
              },
              summary: {
                type: "string",
              },
            },
            required: ["band", "band_label", "summary"],
            type: "object",
          },
          personalization_notice: {
            enum: ["NONE", "PERSONALIZATION_REDUCED"],
            type: "string",
          },
          primary_action: {
            additionalProperties: false,
            properties: {
              action_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
              constraint_label: {
                type: "string",
              },
              instruction: {
                type: "string",
              },
              rationale: {
                type: "string",
              },
            },
            required: ["action_id", "instruction"],
            type: "object",
          },
          product_date: {
            pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
            type: "string",
          },
          result_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          result_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          rituals: {
            items: {
              additionalProperties: false,
              properties: {
                display_value: {
                  type: "string",
                },
                kind: {
                  enum: ["COLOR", "NUMBER"],
                  type: "string",
                },
                note: {
                  type: "string",
                },
              },
              required: ["kind", "display_value", "note"],
              type: "object",
            },
            maxItems: 2,
            type: "array",
          },
          schema_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          state_response: {
            type: "string",
          },
        },
        required: [
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
        ],
        type: "object",
      },
      evening: {
        additionalProperties: false,
        properties: {
          availability: {
            enum: [
              "UNAVAILABLE",
              "EDITABLE_EMPTY",
              "EDITABLE_SUBMITTED",
              "READ_ONLY_SUBMITTED",
              "READ_ONLY_EMPTY",
            ],
            type: "string",
          },
          completion_message: {
            type: "string",
          },
          contract: {
            const: "evening-feedback-view",
            type: "string",
          },
          feedback: {
            additionalProperties: false,
            properties: {
              first_submitted_at: {
                pattern:
                  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                type: "string",
              },
              note: {
                type: "string",
              },
              overall_feeling: {
                enum: [
                  "VERY_HEAVY",
                  "SOMEWHAT_HEAVY",
                  "STEADY",
                  "PRETTY_GOOD",
                  "LIGHT",
                  "UNSURE",
                ],
                type: "string",
              },
              revision: {
                exclusiveMinimum: 0,
                maximum: 9007199254740991,
                type: "integer",
              },
              updated_at: {
                pattern:
                  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                type: "string",
              },
            },
            required: [
              "revision",
              "overall_feeling",
              "first_submitted_at",
              "updated_at",
            ],
            type: "object",
          },
          helpfulness: {
            additionalProperties: false,
            properties: {
              rating: {
                enum: [
                  "UNRATED",
                  "HELPFUL",
                  "NEUTRAL",
                  "NOT_HELPFUL",
                  "NOT_USED",
                ],
                type: "string",
              },
              revision: {
                maximum: 9007199254740991,
                minimum: 0,
                type: "integer",
              },
            },
            required: ["revision", "rating"],
            type: "object",
          },
          note_max_characters: {
            const: 80,
            type: "number",
          },
          options: {
            additionalProperties: false,
            properties: {
              helpfulness: {
                prefixItems: [
                  {
                    const: "HELPFUL",
                    type: "string",
                  },
                  {
                    const: "NEUTRAL",
                    type: "string",
                  },
                  {
                    const: "NOT_HELPFUL",
                    type: "string",
                  },
                  {
                    const: "NOT_USED",
                    type: "string",
                  },
                ],
                type: "array",
              },
              overall_feeling: {
                prefixItems: [
                  {
                    const: "VERY_HEAVY",
                    type: "string",
                  },
                  {
                    const: "SOMEWHAT_HEAVY",
                    type: "string",
                  },
                  {
                    const: "STEADY",
                    type: "string",
                  },
                  {
                    const: "PRETTY_GOOD",
                    type: "string",
                  },
                  {
                    const: "LIGHT",
                    type: "string",
                  },
                  {
                    const: "UNSURE",
                    type: "string",
                  },
                ],
                type: "array",
              },
              task_status: {
                prefixItems: [
                  {
                    const: "UNMARKED",
                    type: "string",
                  },
                  {
                    const: "INTERESTED",
                    type: "string",
                  },
                  {
                    const: "COMPLETED",
                    type: "string",
                  },
                  {
                    const: "SKIPPED",
                    type: "string",
                  },
                ],
                type: "array",
              },
            },
            required: ["overall_feeling", "helpfulness", "task_status"],
            type: "object",
          },
          primary_action: {
            enum: ["SAVE", "SAVE_CHANGES", "READ_ONLY"],
            type: "string",
          },
          product_date: {
            pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
            type: "string",
          },
          schema_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          task: {
            additionalProperties: false,
            properties: {
              instruction: {
                type: "string",
              },
              revision: {
                exclusiveMinimum: 0,
                maximum: 9007199254740991,
                type: "integer",
              },
              status: {
                enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
                type: "string",
              },
              task_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
            },
            required: ["task_id", "instruction", "revision", "status"],
            type: "object",
          },
          unavailable_message: {
            type: "string",
          },
          write_window: {
            enum: ["OPEN", "CONTINUATION_ONLY", "CLOSED"],
            type: "string",
          },
        },
        required: [
          "contract",
          "schema_version",
          "product_date",
          "availability",
          "write_window",
          "helpfulness",
          "options",
          "note_max_characters",
          "primary_action",
          "completion_message",
        ],
        type: "object",
      },
      interaction: {
        additionalProperties: false,
        properties: {
          contract: {
            const: "daily-interaction-state",
            type: "string",
          },
          helpfulness: {
            additionalProperties: false,
            properties: {
              rating: {
                enum: [
                  "UNRATED",
                  "HELPFUL",
                  "NEUTRAL",
                  "NOT_HELPFUL",
                  "NOT_USED",
                ],
                type: "string",
              },
              revision: {
                maximum: 9007199254740991,
                minimum: 0,
                type: "integer",
              },
            },
            required: ["revision", "rating"],
            type: "object",
          },
          is_lit: {
            type: "boolean",
          },
          product_date: {
            pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
            type: "string",
          },
          result_id: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          schema_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          task: {
            additionalProperties: false,
            properties: {
              revision: {
                exclusiveMinimum: 0,
                maximum: 9007199254740991,
                type: "integer",
              },
              status: {
                enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
                type: "string",
              },
              task_id: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
            },
            required: ["task_id", "revision", "status"],
            type: "object",
          },
          updated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: [
          "contract",
          "schema_version",
          "result_id",
          "product_date",
          "is_lit",
          "task",
          "helpfulness",
          "updated_at",
        ],
        type: "object",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
    },
    required: ["product_date"],
    type: "object",
  },
  reauthVerifyRequest: {
    $id: "urn:dailyenergy:schema:reauth-verify-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      confirmation_challenge_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      wechat_code: {
        maxLength: 256,
        minLength: 1,
        type: "string",
      },
    },
    required: ["command_ref", "confirmation_challenge_ref", "wechat_code"],
    type: "object",
  },
  exportRequest: {
    $id: "urn:dailyenergy:schema:export-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      confirmation_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      export_format: {
        const: "JSON",
        type: "string",
      },
    },
    required: ["command_ref", "export_format", "confirmation_version"],
    type: "object",
  },
  deleteDayRequest: {
    $id: "urn:dailyenergy:schema:delete-day-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      confirmation_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      confirmed: {
        const: true,
        type: "boolean",
      },
      expected_revision: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      scope: {
        const: "DAY",
        type: "string",
      },
      target: {
        additionalProperties: false,
        properties: {
          product_date: {
            pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
            type: "string",
          },
        },
        required: ["product_date"],
        type: "object",
      },
    },
    required: [
      "command_ref",
      "scope",
      "target",
      "confirmation_version",
      "confirmed",
      "expected_revision",
    ],
    type: "object",
  },
  deleteMatterRequest: {
    $id: "urn:dailyenergy:schema:delete-matter-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      confirmation_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      confirmed: {
        const: true,
        type: "boolean",
      },
      expected_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      scope: {
        const: "MATTER",
        type: "string",
      },
      target: {
        additionalProperties: false,
        properties: {
          matter_ref: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
        },
        required: ["matter_ref"],
        type: "object",
      },
    },
    required: [
      "command_ref",
      "scope",
      "target",
      "confirmation_version",
      "confirmed",
      "expected_revision",
    ],
    type: "object",
  },
  dayExpectedRevision: {
    $id: "urn:dailyenergy:schema:day-expected-revision:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      expected_revision: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
    },
    required: ["product_date", "expected_revision"],
    type: "object",
  },
  relationshipDeletionTarget: {
    $id: "urn:dailyenergy:schema:relationship-deletion-target:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      included_day_product_dates: {
        items: {
          pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
          type: "string",
        },
        maxItems: 45,
        type: "array",
      },
      relationship_scope: {
        const: "CURRENT_CYCLE_AND_HISTORY",
        type: "string",
      },
    },
    required: ["relationship_scope", "included_day_product_dates"],
    type: "object",
  },
  deleteRelationshipPrepareRequest: {
    $id: "urn:dailyenergy:schema:delete-relationship-prepare-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      confirmation_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      expected_relationship_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      included_day_expected_revisions: {
        items: {
          additionalProperties: false,
          properties: {
            expected_revision: {
              maximum: 9007199254740991,
              minimum: 0,
              type: "integer",
            },
            product_date: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
          },
          required: ["product_date", "expected_revision"],
          type: "object",
        },
        maxItems: 45,
        type: "array",
      },
      scope: {
        const: "RELATIONSHIP_DATA",
        type: "string",
      },
      target: {
        additionalProperties: false,
        properties: {
          included_day_product_dates: {
            items: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
            maxItems: 45,
            type: "array",
          },
          relationship_scope: {
            const: "CURRENT_CYCLE_AND_HISTORY",
            type: "string",
          },
        },
        required: ["relationship_scope", "included_day_product_dates"],
        type: "object",
      },
    },
    required: [
      "command_ref",
      "scope",
      "target",
      "expected_relationship_revision",
      "included_day_expected_revisions",
      "confirmation_version",
    ],
    type: "object",
  },
  deleteRelationshipConfirmRequest: {
    $id: "urn:dailyenergy:schema:delete-relationship-confirm-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      confirmation_challenge_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      confirmation_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      confirmed: {
        const: true,
        type: "boolean",
      },
      expected_relationship_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      identity_verification_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      included_day_expected_revisions: {
        items: {
          additionalProperties: false,
          properties: {
            expected_revision: {
              maximum: 9007199254740991,
              minimum: 0,
              type: "integer",
            },
            product_date: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
          },
          required: ["product_date", "expected_revision"],
          type: "object",
        },
        maxItems: 45,
        type: "array",
      },
      scope: {
        const: "RELATIONSHIP_DATA",
        type: "string",
      },
      target: {
        additionalProperties: false,
        properties: {
          included_day_product_dates: {
            items: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
            maxItems: 45,
            type: "array",
          },
          relationship_scope: {
            const: "CURRENT_CYCLE_AND_HISTORY",
            type: "string",
          },
        },
        required: ["relationship_scope", "included_day_product_dates"],
        type: "object",
      },
    },
    required: [
      "command_ref",
      "confirmation_challenge_ref",
      "scope",
      "target",
      "expected_relationship_revision",
      "included_day_expected_revisions",
      "confirmation_version",
      "confirmed",
    ],
    type: "object",
  },
  deleteAccountPrepareRequest: {
    $id: "urn:dailyenergy:schema:delete-account-prepare-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      confirmation_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      expected_account_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      scope: {
        const: "ACCOUNT",
        type: "string",
      },
      target: {
        additionalProperties: false,
        properties: {
          subject: {
            const: "SELF",
            type: "string",
          },
        },
        required: ["subject"],
        type: "object",
      },
    },
    required: [
      "command_ref",
      "scope",
      "target",
      "expected_account_revision",
      "confirmation_version",
    ],
    type: "object",
  },
  deleteAccountConfirmRequest: {
    $id: "urn:dailyenergy:schema:delete-account-confirm-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      confirmation_challenge_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      confirmation_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      confirmed: {
        const: true,
        type: "boolean",
      },
      expected_account_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      identity_verification_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      scope: {
        const: "ACCOUNT",
        type: "string",
      },
      target: {
        additionalProperties: false,
        properties: {
          subject: {
            const: "SELF",
            type: "string",
          },
        },
        required: ["subject"],
        type: "object",
      },
    },
    required: [
      "command_ref",
      "confirmation_challenge_ref",
      "scope",
      "target",
      "expected_account_revision",
      "confirmation_version",
      "confirmed",
      "identity_verification_ref",
    ],
    type: "object",
  },
  dataTaskCancelRequest: {
    $id: "urn:dailyenergy:schema:data-task-cancel-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      client_context: {
        additionalProperties: false,
        properties: {
          app_version: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
          scene: {
            maxLength: 64,
            minLength: 1,
            type: "string",
          },
        },
        type: "object",
      },
      command_ref: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        type: "string",
      },
      expected_task_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
    },
    required: ["command_ref", "expected_task_revision"],
    type: "object",
  },
  dataTaskView: {
    $id: "urn:dailyenergy:schema:data-task-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      backup_purge_deadline: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      can_cancel: {
        type: "boolean",
      },
      created_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      export_artifact: {
        oneOf: [
          {
            additionalProperties: false,
            properties: {
              format: {
                const: "JSON",
                type: "string",
              },
              state: {
                const: "PREPARING",
                type: "string",
              },
            },
            required: ["state", "format"],
            type: "object",
          },
          {
            additionalProperties: false,
            properties: {
              download_ref: {
                pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                type: "string",
              },
              expires_at: {
                pattern:
                  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                type: "string",
              },
              format: {
                const: "JSON",
                type: "string",
              },
              ready_at: {
                pattern:
                  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                type: "string",
              },
              state: {
                const: "READY",
                type: "string",
              },
            },
            required: [
              "state",
              "format",
              "download_ref",
              "ready_at",
              "expires_at",
            ],
            type: "object",
          },
          {
            additionalProperties: false,
            properties: {
              format: {
                const: "JSON",
                type: "string",
              },
              state: {
                enum: ["EXPIRED", "INVALIDATED"],
                type: "string",
              },
            },
            required: ["state", "format"],
            type: "object",
          },
        ],
      },
      failure_summary_code: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      kind: {
        enum: ["EXPORT", "DELETE"],
        type: "string",
      },
      online_erased_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      scope: {
        enum: ["DAY", "MATTER", "RELATIONSHIP_DATA", "ACCOUNT"],
        type: "string",
      },
      status: {
        enum: ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"],
        type: "string",
      },
      target_summary: {
        type: "string",
      },
      task_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      updated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
    },
    required: [
      "task_ref",
      "revision",
      "kind",
      "scope",
      "target_summary",
      "status",
      "can_cancel",
      "created_at",
      "updated_at",
    ],
    type: "object",
  },
  dataTaskListView: {
    $id: "urn:dailyenergy:schema:data-task-list-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      items: {
        items: {
          additionalProperties: false,
          properties: {
            backup_purge_deadline: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
            can_cancel: {
              type: "boolean",
            },
            created_at: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
            export_artifact: {
              oneOf: [
                {
                  additionalProperties: false,
                  properties: {
                    format: {
                      const: "JSON",
                      type: "string",
                    },
                    state: {
                      const: "PREPARING",
                      type: "string",
                    },
                  },
                  required: ["state", "format"],
                  type: "object",
                },
                {
                  additionalProperties: false,
                  properties: {
                    download_ref: {
                      pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                      type: "string",
                    },
                    expires_at: {
                      pattern:
                        "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                      type: "string",
                    },
                    format: {
                      const: "JSON",
                      type: "string",
                    },
                    ready_at: {
                      pattern:
                        "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                      type: "string",
                    },
                    state: {
                      const: "READY",
                      type: "string",
                    },
                  },
                  required: [
                    "state",
                    "format",
                    "download_ref",
                    "ready_at",
                    "expires_at",
                  ],
                  type: "object",
                },
                {
                  additionalProperties: false,
                  properties: {
                    format: {
                      const: "JSON",
                      type: "string",
                    },
                    state: {
                      enum: ["EXPIRED", "INVALIDATED"],
                      type: "string",
                    },
                  },
                  required: ["state", "format"],
                  type: "object",
                },
              ],
            },
            failure_summary_code: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            kind: {
              enum: ["EXPORT", "DELETE"],
              type: "string",
            },
            online_erased_at: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
            revision: {
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
              type: "integer",
            },
            scope: {
              enum: ["DAY", "MATTER", "RELATIONSHIP_DATA", "ACCOUNT"],
              type: "string",
            },
            status: {
              enum: ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"],
              type: "string",
            },
            target_summary: {
              type: "string",
            },
            task_ref: {
              pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
              type: "string",
            },
            updated_at: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
          },
          required: [
            "task_ref",
            "revision",
            "kind",
            "scope",
            "target_summary",
            "status",
            "can_cancel",
            "created_at",
            "updated_at",
          ],
          type: "object",
        },
        maxItems: 50,
        type: "array",
      },
      next_cursor: {
        maxLength: 512,
        minLength: 1,
        type: "string",
      },
      page_info: {
        additionalProperties: false,
        properties: {
          has_more: {
            type: "boolean",
          },
        },
        required: ["has_more"],
        type: "object",
      },
    },
    required: ["items", "page_info"],
    type: "object",
  },
  dataRightsSummaryView: {
    $id: "urn:dailyenergy:schema:data-rights-summary-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      account: {
        additionalProperties: false,
        properties: {
          expected_revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          state: {
            const: "ACTIVE",
            type: "string",
          },
        },
        required: ["expected_revision", "state"],
        type: "object",
      },
      backup_max_days: {
        const: 35,
        type: "number",
      },
      capabilities: {
        additionalProperties: false,
        properties: {
          delete_account: {
            type: "boolean",
          },
          delete_day: {
            type: "boolean",
          },
          delete_matter: {
            type: "boolean",
          },
          delete_relationship_data: {
            type: "boolean",
          },
          export_account: {
            type: "boolean",
          },
        },
        required: [
          "export_account",
          "delete_day",
          "delete_matter",
          "delete_relationship_data",
          "delete_account",
        ],
        type: "object",
      },
      confirmation_versions: {
        additionalProperties: false,
        properties: {
          delete_account: {
            const: "data-rights-account-v1",
            type: "string",
          },
          delete_day: {
            const: "data-rights-day-v1",
            type: "string",
          },
          delete_matter: {
            const: "data-rights-matter-v1",
            type: "string",
          },
          delete_relationship_data: {
            const: "data-rights-relationship-v1",
            type: "string",
          },
          export_account: {
            const: "data-export-v1",
            type: "string",
          },
        },
        required: [
          "export_account",
          "delete_day",
          "delete_matter",
          "delete_relationship_data",
          "delete_account",
        ],
        type: "object",
      },
      online_erasure_sla_hours: {
        const: 72,
        type: "number",
      },
      relationship: {
        additionalProperties: false,
        properties: {
          expected_revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          state: {
            const: "PRESENT",
            type: "string",
          },
        },
        required: ["expected_revision", "state"],
        type: "object",
      },
    },
    required: [
      "account",
      "capabilities",
      "confirmation_versions",
      "online_erasure_sla_hours",
      "backup_max_days",
    ],
    type: "object",
  },
  exportArtifactView: {
    $id: "urn:dailyenergy:schema:export-artifact-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    oneOf: [
      {
        additionalProperties: false,
        properties: {
          format: {
            const: "JSON",
            type: "string",
          },
          state: {
            const: "PREPARING",
            type: "string",
          },
        },
        required: ["state", "format"],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          download_ref: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          expires_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          format: {
            const: "JSON",
            type: "string",
          },
          ready_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          state: {
            const: "READY",
            type: "string",
          },
        },
        required: ["state", "format", "download_ref", "ready_at", "expires_at"],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          format: {
            const: "JSON",
            type: "string",
          },
          state: {
            enum: ["EXPIRED", "INVALIDATED"],
            type: "string",
          },
        },
        required: ["state", "format"],
        type: "object",
      },
    ],
  },
  deletionStatusGrantView: {
    $id: "urn:dailyenergy:schema:deletion-status-grant-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      expires_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      status_token: {
        maxLength: 256,
        minLength: 32,
        pattern: "^[A-Za-z0-9_-]+$",
        type: "string",
      },
      task_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
    },
    required: ["task_ref", "status_token", "expires_at"],
    type: "object",
  },
  accountDeletionAcceptedView: {
    $id: "urn:dailyenergy:schema:account-deletion-accepted-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      status_grant: {
        additionalProperties: false,
        properties: {
          expires_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          status_token: {
            maxLength: 256,
            minLength: 32,
            pattern: "^[A-Za-z0-9_-]+$",
            type: "string",
          },
          task_ref: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
        },
        required: ["task_ref", "status_token", "expires_at"],
        type: "object",
      },
      task: {
        additionalProperties: false,
        properties: {
          backup_purge_deadline: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          can_cancel: {
            type: "boolean",
          },
          created_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          export_artifact: {
            oneOf: [
              {
                additionalProperties: false,
                properties: {
                  format: {
                    const: "JSON",
                    type: "string",
                  },
                  state: {
                    const: "PREPARING",
                    type: "string",
                  },
                },
                required: ["state", "format"],
                type: "object",
              },
              {
                additionalProperties: false,
                properties: {
                  download_ref: {
                    pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                    type: "string",
                  },
                  expires_at: {
                    pattern:
                      "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                    type: "string",
                  },
                  format: {
                    const: "JSON",
                    type: "string",
                  },
                  ready_at: {
                    pattern:
                      "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                    type: "string",
                  },
                  state: {
                    const: "READY",
                    type: "string",
                  },
                },
                required: [
                  "state",
                  "format",
                  "download_ref",
                  "ready_at",
                  "expires_at",
                ],
                type: "object",
              },
              {
                additionalProperties: false,
                properties: {
                  format: {
                    const: "JSON",
                    type: "string",
                  },
                  state: {
                    enum: ["EXPIRED", "INVALIDATED"],
                    type: "string",
                  },
                },
                required: ["state", "format"],
                type: "object",
              },
            ],
          },
          failure_summary_code: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          kind: {
            enum: ["EXPORT", "DELETE"],
            type: "string",
          },
          online_erased_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          scope: {
            enum: ["DAY", "MATTER", "RELATIONSHIP_DATA", "ACCOUNT"],
            type: "string",
          },
          status: {
            enum: ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"],
            type: "string",
          },
          target_summary: {
            type: "string",
          },
          task_ref: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          updated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: [
          "task_ref",
          "revision",
          "kind",
          "scope",
          "target_summary",
          "status",
          "can_cancel",
          "created_at",
          "updated_at",
        ],
        type: "object",
      },
    },
    required: ["task", "status_grant"],
    type: "object",
  },
  dataExportDocument: {
    $id: "urn:dailyenergy:schema:data-export-document:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      consent_summary: {
        additionalProperties: false,
        properties: {
          accepted_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          notice_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          state: {
            enum: ["MISSING", "ACCEPTED", "WITHDRAWN"],
            type: "string",
          },
        },
        required: ["state", "notice_version"],
        type: "object",
      },
      data_task_summaries: {
        items: {
          additionalProperties: false,
          properties: {
            backup_purge_deadline: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
            created_at: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
            failure_summary_code: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
            kind: {
              enum: ["EXPORT", "DELETE"],
              type: "string",
            },
            online_erased_at: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
            revision: {
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
              type: "integer",
            },
            scope: {
              enum: ["DAY", "MATTER", "RELATIONSHIP_DATA", "ACCOUNT"],
              type: "string",
            },
            status: {
              enum: ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"],
              type: "string",
            },
            target_summary: {
              type: "string",
            },
            updated_at: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
          },
          required: [
            "revision",
            "kind",
            "scope",
            "target_summary",
            "status",
            "created_at",
            "updated_at",
          ],
          type: "object",
        },
        maxItems: 1000,
        type: "array",
      },
      days: {
        items: {
          additionalProperties: false,
          properties: {
            checkin: {
              additionalProperties: false,
              properties: {
                energy: {
                  enum: ["EMPTY", "LOW", "STEADY", "HIGH", "FULL", "UNSURE"],
                  type: "string",
                },
                mood: {
                  enum: [
                    "VERY_LOW",
                    "LOW",
                    "STEADY",
                    "GOOD",
                    "LIGHT",
                    "UNSURE",
                  ],
                  type: "string",
                },
                revision: {
                  exclusiveMinimum: 0,
                  maximum: 9007199254740991,
                  type: "integer",
                },
                sleep: {
                  enum: ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"],
                  type: "string",
                },
                updated_at: {
                  pattern:
                    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                  type: "string",
                },
              },
              required: ["revision", "mood", "energy", "sleep", "updated_at"],
              type: "object",
            },
            content: {
              additionalProperties: false,
              properties: {
                closing: {
                  type: "string",
                },
                content_label: {
                  const: "娱乐与行动参考",
                  type: "string",
                },
                contract: {
                  const: "daily-content-view",
                  type: "string",
                },
                core_tip: {
                  type: "string",
                },
                dimensions: {
                  items: {
                    additionalProperties: false,
                    properties: {
                      band: {
                        enum: ["LOW", "STEADY", "HIGH"],
                        type: "string",
                      },
                      band_label: {
                        type: "string",
                      },
                      explanation: {
                        type: "string",
                      },
                      id: {
                        enum: [
                          "pace",
                          "action",
                          "connection",
                          "resources",
                          "recovery",
                        ],
                        type: "string",
                      },
                      is_focus: {
                        type: "boolean",
                      },
                      label: {
                        type: "string",
                      },
                    },
                    required: [
                      "id",
                      "label",
                      "band",
                      "band_label",
                      "explanation",
                      "is_focus",
                    ],
                    type: "object",
                  },
                  maxItems: 5,
                  minItems: 5,
                  type: "array",
                },
                explanation_paragraphs: {
                  items: {
                    type: "string",
                  },
                  maxItems: 2,
                  minItems: 1,
                  type: "array",
                },
                focus_dimension_id: {
                  enum: [
                    "pace",
                    "action",
                    "connection",
                    "resources",
                    "recovery",
                  ],
                  type: "string",
                },
                generated_at: {
                  pattern:
                    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                  type: "string",
                },
                greeting: {
                  type: "string",
                },
                optional_task: {
                  additionalProperties: false,
                  properties: {
                    instruction: {
                      type: "string",
                    },
                    task_id: {
                      pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                      type: "string",
                    },
                  },
                  required: ["task_id", "instruction"],
                  type: "object",
                },
                overall: {
                  additionalProperties: false,
                  properties: {
                    band: {
                      enum: ["LOW", "STEADY", "HIGH"],
                      type: "string",
                    },
                    band_label: {
                      type: "string",
                    },
                    summary: {
                      type: "string",
                    },
                  },
                  required: ["band", "band_label", "summary"],
                  type: "object",
                },
                personalization_notice: {
                  enum: ["NONE", "PERSONALIZATION_REDUCED"],
                  type: "string",
                },
                primary_action: {
                  additionalProperties: false,
                  properties: {
                    action_id: {
                      pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                      type: "string",
                    },
                    constraint_label: {
                      type: "string",
                    },
                    instruction: {
                      type: "string",
                    },
                    rationale: {
                      type: "string",
                    },
                  },
                  required: ["action_id", "instruction"],
                  type: "object",
                },
                product_date: {
                  pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
                  type: "string",
                },
                result_id: {
                  pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
                  type: "string",
                },
                result_version: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                rituals: {
                  items: {
                    additionalProperties: false,
                    properties: {
                      display_value: {
                        type: "string",
                      },
                      kind: {
                        enum: ["COLOR", "NUMBER"],
                        type: "string",
                      },
                      note: {
                        type: "string",
                      },
                    },
                    required: ["kind", "display_value", "note"],
                    type: "object",
                  },
                  maxItems: 2,
                  type: "array",
                },
                schema_version: {
                  pattern:
                    "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
                  type: "string",
                },
                state_response: {
                  type: "string",
                },
              },
              required: [
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
              ],
              type: "object",
            },
            evening: {
              additionalProperties: false,
              properties: {
                note: {
                  maxLength: 80,
                  type: "string",
                },
                overall_feeling: {
                  enum: [
                    "VERY_HEAVY",
                    "SOMEWHAT_HEAVY",
                    "STEADY",
                    "PRETTY_GOOD",
                    "LIGHT",
                    "UNSURE",
                  ],
                  type: "string",
                },
                revision: {
                  exclusiveMinimum: 0,
                  maximum: 9007199254740991,
                  type: "integer",
                },
                updated_at: {
                  pattern:
                    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                  type: "string",
                },
              },
              required: ["revision", "overall_feeling", "updated_at"],
              type: "object",
            },
            interaction: {
              additionalProperties: false,
              properties: {
                helpfulness: {
                  additionalProperties: false,
                  properties: {
                    rating: {
                      enum: [
                        "UNRATED",
                        "HELPFUL",
                        "NEUTRAL",
                        "NOT_HELPFUL",
                        "NOT_USED",
                      ],
                      type: "string",
                    },
                    revision: {
                      maximum: 9007199254740991,
                      minimum: 0,
                      type: "integer",
                    },
                  },
                  required: ["revision", "rating"],
                  type: "object",
                },
                is_lit: {
                  type: "boolean",
                },
                task: {
                  additionalProperties: false,
                  properties: {
                    revision: {
                      exclusiveMinimum: 0,
                      maximum: 9007199254740991,
                      type: "integer",
                    },
                    status: {
                      enum: ["UNMARKED", "INTERESTED", "COMPLETED", "SKIPPED"],
                      type: "string",
                    },
                  },
                  required: ["revision", "status"],
                  type: "object",
                },
                updated_at: {
                  pattern:
                    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                  type: "string",
                },
              },
              required: ["is_lit", "task", "helpfulness", "updated_at"],
              type: "object",
            },
            product_date: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
          },
          required: ["product_date"],
          type: "object",
        },
        maxItems: 10000,
        type: "array",
      },
      generated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      matters: {
        items: {
          additionalProperties: false,
          properties: {
            daily_use_granted: {
              type: "boolean",
            },
            revision: {
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
              type: "integer",
            },
            status: {
              enum: ["ACTIVE", "PAUSED", "COMPLETED", "EXPIRED"],
              type: "string",
            },
            target_date: {
              pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
              type: "string",
            },
            title: {
              type: "string",
            },
            updated_at: {
              pattern:
                "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
              type: "string",
            },
            weekly_use_granted: {
              type: "boolean",
            },
          },
          required: [
            "revision",
            "title",
            "status",
            "daily_use_granted",
            "weekly_use_granted",
            "updated_at",
          ],
          type: "object",
        },
        maxItems: 1000,
        type: "array",
      },
      notification_preferences: {
        additionalProperties: false,
        properties: {
          items: {
            items: {
              additionalProperties: false,
              properties: {
                enabled: {
                  type: "boolean",
                },
                notification_type: {
                  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
                  type: "string",
                },
                revision: {
                  exclusiveMinimum: 0,
                  maximum: 9007199254740991,
                  type: "integer",
                },
                updated_at: {
                  pattern:
                    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
                  type: "string",
                },
              },
              required: [
                "notification_type",
                "enabled",
                "revision",
                "updated_at",
              ],
              type: "object",
            },
            maxItems: 50,
            type: "array",
          },
        },
        required: ["items"],
        type: "object",
      },
      profile: {
        additionalProperties: false,
        properties: {
          expression_style: {
            enum: ["BALANCED", "GENTLE", "LIGHT_HUMOR", "CLEAR_DIRECT"],
            type: "string",
          },
          onboarding_completed: {
            type: "boolean",
          },
          preferred_name: {
            type: "string",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          updated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: [
          "revision",
          "expression_style",
          "onboarding_completed",
          "updated_at",
        ],
        type: "object",
      },
      relationship_summary: {
        additionalProperties: false,
        properties: {
          encounter_day_count: {
            maximum: 9007199254740991,
            minimum: 0,
            type: "integer",
          },
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          stage: {
            enum: [
              "BEFORE_FIRST_MEETING",
              "NEWLY_MET",
              "BECOMING_FAMILIAR",
              "FIRST_WEEK_RECORDED",
            ],
            type: "string",
          },
          state: {
            const: "PRESENT",
            type: "string",
          },
          updated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: [
          "revision",
          "state",
          "stage",
          "encounter_day_count",
          "updated_at",
        ],
        type: "object",
      },
      safety_summary: {
        additionalProperties: false,
        properties: {
          revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          state: {
            enum: ["CLEAR", "ACTIVE", "RECOVERY_PENDING"],
            type: "string",
          },
          updated_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
        },
        required: ["state", "revision", "updated_at"],
        type: "object",
      },
      schema_version: {
        const: "data-export-v1",
        type: "string",
      },
    },
    required: [
      "schema_version",
      "generated_at",
      "consent_summary",
      "days",
      "matters",
      "notification_preferences",
      "data_task_summaries",
    ],
    type: "object",
  },
  deletionConfirmationView: {
    $id: "urn:dailyenergy:schema:deletion-confirmation-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    oneOf: [
      {
        additionalProperties: false,
        properties: {
          backup_max_days: {
            const: 35,
            type: "number",
          },
          confirmation_challenge_ref: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          confirmation_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          derived_effects: {
            items: {
              type: "string",
            },
            maxItems: 12,
            type: "array",
          },
          expected_day_revisions: {
            items: {
              additionalProperties: false,
              properties: {
                expected_revision: {
                  maximum: 9007199254740991,
                  minimum: 0,
                  type: "integer",
                },
                product_date: {
                  pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
                  type: "string",
                },
              },
              required: ["product_date", "expected_revision"],
              type: "object",
            },
            maxItems: 45,
            type: "array",
          },
          expected_revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          expires_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          identity_reverification_required: {
            type: "boolean",
          },
          immediate_effects: {
            items: {
              type: "string",
            },
            maxItems: 12,
            minItems: 1,
            type: "array",
          },
          online_erasure_sla_hours: {
            const: 72,
            type: "number",
          },
          scope: {
            const: "RELATIONSHIP_DATA",
            type: "string",
          },
          target: {
            additionalProperties: false,
            properties: {
              included_day_product_dates: {
                items: {
                  pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
                  type: "string",
                },
                maxItems: 45,
                type: "array",
              },
              relationship_scope: {
                const: "CURRENT_CYCLE_AND_HISTORY",
                type: "string",
              },
            },
            required: ["relationship_scope", "included_day_product_dates"],
            type: "object",
          },
        },
        required: [
          "confirmation_challenge_ref",
          "confirmation_version",
          "expected_revision",
          "immediate_effects",
          "derived_effects",
          "online_erasure_sla_hours",
          "backup_max_days",
          "identity_reverification_required",
          "expires_at",
          "scope",
          "target",
          "expected_day_revisions",
        ],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          backup_max_days: {
            const: 35,
            type: "number",
          },
          confirmation_challenge_ref: {
            pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
            type: "string",
          },
          confirmation_version: {
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
            type: "string",
          },
          derived_effects: {
            items: {
              type: "string",
            },
            maxItems: 12,
            type: "array",
          },
          expected_day_revisions: {
            not: {},
          },
          expected_revision: {
            exclusiveMinimum: 0,
            maximum: 9007199254740991,
            type: "integer",
          },
          expires_at: {
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
            type: "string",
          },
          identity_reverification_required: {
            const: true,
            type: "boolean",
          },
          immediate_effects: {
            items: {
              type: "string",
            },
            maxItems: 12,
            minItems: 1,
            type: "array",
          },
          online_erasure_sla_hours: {
            const: 72,
            type: "number",
          },
          scope: {
            const: "ACCOUNT",
            type: "string",
          },
          target: {
            additionalProperties: false,
            properties: {
              subject: {
                const: "SELF",
                type: "string",
              },
            },
            required: ["subject"],
            type: "object",
          },
        },
        required: [
          "confirmation_challenge_ref",
          "confirmation_version",
          "expected_revision",
          "immediate_effects",
          "derived_effects",
          "online_erasure_sla_hours",
          "backup_max_days",
          "identity_reverification_required",
          "expires_at",
          "scope",
          "target",
        ],
        type: "object",
      },
    ],
  },
  identityVerificationView: {
    $id: "urn:dailyenergy:schema:identity-verification-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      confirmation_challenge_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
      expires_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      identity_verification_ref: {
        pattern: "^[^\\s\\u0000-\\u001f\\u007f]{1,128}$",
        type: "string",
      },
    },
    required: [
      "identity_verification_ref",
      "confirmation_challenge_ref",
      "expires_at",
    ],
    type: "object",
  },
  analyticsProjectionV1: {
    $id: "urn:dailyenergy:schema:analytics-projection-v1:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      app_version_bucket: {
        anyOf: [
          {
            const: "OTHER",
            type: "string",
          },
          {
            pattern: "^\\d+\\.\\d+$",
            type: "string",
          },
        ],
      },
      environment: {
        enum: ["PROD", "STAGING", "TEST", "DEV"],
        type: "string",
      },
      event_name: {
        enum: [
          "app_launch_resolved",
          "landing_viewed",
          "landing_primary_action_clicked",
          "consent_accepted",
          "consent_withdrawn",
          "onboarding_completed",
          "checkin_submitted",
          "checkin_corrected",
          "checkin_rebuilt",
          "generation_started",
          "daily_result_available",
          "daily_result_read",
          "main_action_reached",
          "dimensions_expanded",
          "day_lit",
          "task_status_updated",
          "helpfulness_updated",
          "evening_saved",
          "evening_updated",
          "evening_skipped",
          "weekly_view_read",
          "weekly_summary_read",
          "history_day_read",
          "settings_viewed",
          "faq_opened",
          "profile_updated",
          "style_calibration_saved",
          "matter_created",
          "matter_updated",
          "matter_status_changed",
          "matter_deleted",
          "notification_settings_updated",
          "notification_permission_observed",
          "notification_intent_outcome",
          "notification_deeplink_resolved",
          "share_preview_created",
          "share_intent_created",
          "support_feedback_submitted",
          "data_rights_entry_viewed",
          "data_task_created",
          "data_task_stage_changed",
          "data_task_sla_outcome",
          "deleted_data_reactivation_blocked",
          "api_operation_outcome",
          "product_date_resolution_outcome",
          "generation_runtime_outcome",
          "cache_lookup_outcome",
          "queue_stage_outcome",
          "gateway_usage_aggregate",
          "notification_dispatch_outcome",
          "raw_content_detector_outcome",
          "provider_profile_conformance_outcome",
          "release_contract_outcome",
          "safety_input_gate_outcome",
          "safety_fixed_response_outcome",
          "safety_resource_registry_outcome",
          "safety_resource_action_aggregate",
          "safety_recovery_outcome",
        ],
        type: "string",
      },
      event_properties: {
        additionalProperties: {},
        propertyNames: {
          maxLength: 64,
          minLength: 1,
          type: "string",
        },
        type: "object",
      },
      event_schema_version: {
        const: 1,
        type: "number",
      },
      locale_bucket: {
        enum: ["ZH_CN", "OTHER"],
        type: "string",
      },
      plane: {
        enum: ["PRODUCT", "RUNTIME", "GOVERNANCE", "SAFETY_CONTROL"],
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      product_date_policy_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      server_received_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
    },
    required: [
      "environment",
      "event_name",
      "event_schema_version",
      "plane",
      "product_date",
      "product_date_policy_version",
      "server_received_at",
    ],
    type: "object",
  },
  anonymousDailyAggregateV1: {
    $id: "urn:dailyenergy:schema:anonymous-daily-aggregate-v1:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      aggregate_schema_version: {
        const: "anonymous-daily-aggregate-v1",
        type: "string",
      },
      aggregation_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      dimensions: {
        items: {
          additionalProperties: false,
          properties: {
            code: {
              anyOf: [
                {
                  maxLength: 32,
                  minLength: 1,
                  pattern: "^(?:[A-Z][A-Z0-9_]{0,30}|OTHER)$",
                  type: "string",
                },
                {
                  anyOf: [
                    {
                      const: "OTHER",
                      type: "string",
                    },
                    {
                      pattern: "^\\d+\\.\\d+$",
                      type: "string",
                    },
                  ],
                },
                {
                  pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
                  type: "string",
                },
              ],
            },
            name: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
          },
          required: ["code", "name"],
          type: "object",
        },
        maxItems: 2,
        type: "array",
      },
      environment: {
        enum: ["PROD", "STAGING", "TEST", "DEV"],
        type: "string",
      },
      event_count: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      event_name: {
        enum: [
          "app_launch_resolved",
          "landing_viewed",
          "landing_primary_action_clicked",
          "consent_accepted",
          "consent_withdrawn",
          "onboarding_completed",
          "checkin_submitted",
          "checkin_corrected",
          "checkin_rebuilt",
          "generation_started",
          "daily_result_available",
          "daily_result_read",
          "main_action_reached",
          "dimensions_expanded",
          "day_lit",
          "task_status_updated",
          "helpfulness_updated",
          "evening_saved",
          "evening_updated",
          "evening_skipped",
          "weekly_view_read",
          "weekly_summary_read",
          "history_day_read",
          "settings_viewed",
          "faq_opened",
          "profile_updated",
          "style_calibration_saved",
          "matter_created",
          "matter_updated",
          "matter_status_changed",
          "matter_deleted",
          "notification_settings_updated",
          "notification_permission_observed",
          "notification_intent_outcome",
          "notification_deeplink_resolved",
          "share_preview_created",
          "share_intent_created",
          "support_feedback_submitted",
          "data_rights_entry_viewed",
          "data_task_created",
          "data_task_stage_changed",
          "data_task_sla_outcome",
          "deleted_data_reactivation_blocked",
          "api_operation_outcome",
          "product_date_resolution_outcome",
          "generation_runtime_outcome",
          "cache_lookup_outcome",
          "queue_stage_outcome",
          "gateway_usage_aggregate",
          "notification_dispatch_outcome",
          "raw_content_detector_outcome",
          "provider_profile_conformance_outcome",
          "release_contract_outcome",
          "safety_input_gate_outcome",
          "safety_fixed_response_outcome",
          "safety_resource_registry_outcome",
          "safety_resource_action_aggregate",
          "safety_recovery_outcome",
        ],
        type: "string",
      },
      event_schema_version: {
        const: 1,
        type: "number",
      },
      expires_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      generated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      plane: {
        enum: ["PRODUCT", "RUNTIME", "GOVERNANCE", "SAFETY_CONTROL"],
        type: "string",
      },
      product_date: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      source_contract_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      sum_value: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      unique_owner_count: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
    },
    required: [
      "aggregate_schema_version",
      "aggregation_revision",
      "dimensions",
      "environment",
      "event_count",
      "event_name",
      "event_schema_version",
      "expires_at",
      "generated_at",
      "plane",
      "product_date",
      "source_contract_version",
    ],
    type: "object",
  },
  clientAnalyticsSignalRequest: {
    $id: "urn:dailyenergy:schema:client-analytics-signal-request:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    oneOf: [
      {
        additionalProperties: false,
        properties: {
          app_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          event_name: {
            const: "landing_viewed",
            type: "string",
          },
          event_schema_version: {
            const: 1,
            type: "number",
          },
          locale: {
            enum: ["zh-CN", "other"],
            type: "string",
          },
          scene_code: {
            enum: [
              "DIRECT",
              "CHANNEL_LANDING",
              "SHARE",
              "NOTIFICATION",
              "OTHER",
            ],
            type: "string",
          },
          surface_version_bucket: {
            enum: ["LANDING_V1"],
            type: "string",
          },
        },
        required: [
          "app_version",
          "event_schema_version",
          "locale",
          "event_name",
          "scene_code",
          "surface_version_bucket",
        ],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          app_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          event_name: {
            const: "landing_primary_action_clicked",
            type: "string",
          },
          event_schema_version: {
            const: 1,
            type: "number",
          },
          locale: {
            enum: ["zh-CN", "other"],
            type: "string",
          },
          scene_code: {
            enum: [
              "DIRECT",
              "CHANNEL_LANDING",
              "SHARE",
              "NOTIFICATION",
              "OTHER",
            ],
            type: "string",
          },
          surface_version_bucket: {
            enum: ["LANDING_V1"],
            type: "string",
          },
        },
        required: [
          "app_version",
          "event_schema_version",
          "locale",
          "event_name",
          "scene_code",
          "surface_version_bucket",
        ],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          app_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          event_name: {
            const: "main_action_reached",
            type: "string",
          },
          event_schema_version: {
            const: 1,
            type: "number",
          },
          locale: {
            enum: ["zh-CN", "other"],
            type: "string",
          },
        },
        required: [
          "app_version",
          "event_schema_version",
          "locale",
          "event_name",
        ],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          app_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          event_name: {
            const: "dimensions_expanded",
            type: "string",
          },
          event_schema_version: {
            const: 1,
            type: "number",
          },
          locale: {
            enum: ["zh-CN", "other"],
            type: "string",
          },
        },
        required: [
          "app_version",
          "event_schema_version",
          "locale",
          "event_name",
        ],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          app_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          event_name: {
            const: "weekly_summary_read",
            type: "string",
          },
          event_schema_version: {
            const: 1,
            type: "number",
          },
          locale: {
            enum: ["zh-CN", "other"],
            type: "string",
          },
        },
        required: [
          "app_version",
          "event_schema_version",
          "locale",
          "event_name",
        ],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          app_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          event_name: {
            const: "settings_viewed",
            type: "string",
          },
          event_schema_version: {
            const: 1,
            type: "number",
          },
          locale: {
            enum: ["zh-CN", "other"],
            type: "string",
          },
        },
        required: [
          "app_version",
          "event_schema_version",
          "locale",
          "event_name",
        ],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          app_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          event_name: {
            const: "faq_opened",
            type: "string",
          },
          event_schema_version: {
            const: 1,
            type: "number",
          },
          faq_category_code: {
            enum: [
              "PRODUCT",
              "PRIVACY",
              "SAFETY",
              "DATA_RIGHTS",
              "ACCOUNT",
              "NOTIFICATIONS",
              "SUPPORT",
              "OTHER",
            ],
            type: "string",
          },
          locale: {
            enum: ["zh-CN", "other"],
            type: "string",
          },
        },
        required: [
          "app_version",
          "event_schema_version",
          "locale",
          "event_name",
          "faq_category_code",
        ],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {
          app_version: {
            pattern:
              "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
            type: "string",
          },
          event_name: {
            const: "data_rights_entry_viewed",
            type: "string",
          },
          event_schema_version: {
            const: 1,
            type: "number",
          },
          locale: {
            enum: ["zh-CN", "other"],
            type: "string",
          },
        },
        required: [
          "app_version",
          "event_schema_version",
          "locale",
          "event_name",
        ],
        type: "object",
      },
    ],
  },
  clientAnalyticsSignalAcceptedView: {
    $id: "urn:dailyenergy:schema:client-analytics-signal-accepted-view:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      accepted: {
        const: true,
        type: "boolean",
      },
    },
    required: ["accepted"],
    type: "object",
  },
  metricReportV1: {
    $id: "urn:dailyenergy:schema:metric-report-v1:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      aggregation_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      denominator: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      dimensions: {
        items: {
          additionalProperties: false,
          properties: {
            code: {
              anyOf: [
                {
                  maxLength: 32,
                  minLength: 1,
                  pattern: "^(?:[A-Z][A-Z0-9_]{0,30}|OTHER)$",
                  type: "string",
                },
                {
                  anyOf: [
                    {
                      const: "OTHER",
                      type: "string",
                    },
                    {
                      pattern: "^\\d+\\.\\d+$",
                      type: "string",
                    },
                  ],
                },
                {
                  pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
                  type: "string",
                },
              ],
            },
            name: {
              pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
              type: "string",
            },
          },
          required: ["code", "name"],
          type: "object",
        },
        maxItems: 2,
        type: "array",
      },
      expires_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      generated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      metric_id: {
        enum: [
          "S25-M01",
          "S25-M02",
          "S25-M03",
          "S25-M04",
          "S25-M05",
          "S25-M06",
          "S25-M07",
          "S25-M08",
          "S25-M09",
          "S25-M10",
          "S25-M11",
          "S25-M12",
          "S25-M13",
          "S25-M14",
          "S25-M15",
          "S25-M16",
          "S25-M17",
          "S25-M18",
          "S25-M19",
          "S25-M20",
          "S25-M21",
          "S25-M22",
          "S25-M23",
        ],
        type: "string",
      },
      metric_version: {
        const: 1,
        type: "number",
      },
      notes_code: {
        items: {
          enum: [
            "PROVISIONAL",
            "TEMPLATE_INCLUDED",
            "BEST_EFFORT_SIGNAL",
            "POST_AGGREGATION_DELETION_NOT_RESTATED",
            "CHANNEL_UNAVAILABLE",
            "SOURCE_INCOMPLETE",
            "SOURCE_UNAVAILABLE",
          ],
          type: "string",
        },
        maxItems: 5,
        type: "array",
      },
      numerator: {
        maximum: 9007199254740991,
        minimum: 0,
        type: "integer",
      },
      period_or_cohort: {
        pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$",
        type: "string",
      },
      source_contract_version: {
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
        type: "string",
      },
      status: {
        enum: [
          "PROVISIONAL",
          "FINALIZED",
          "SUPPRESSED",
          "BLOCKED",
          "UNAVAILABLE",
        ],
        type: "string",
      },
      value: {
        minimum: 0,
        type: "number",
      },
      wilson_high: {
        maximum: 1,
        minimum: 0,
        type: "number",
      },
      wilson_low: {
        maximum: 1,
        minimum: 0,
        type: "number",
      },
    },
    required: [
      "aggregation_revision",
      "dimensions",
      "expires_at",
      "generated_at",
      "metric_id",
      "metric_version",
      "notes_code",
      "period_or_cohort",
      "source_contract_version",
      "status",
    ],
    type: "object",
  },
  metricGateReportV1: {
    $id: "urn:dailyenergy:schema:metric-gate-report-v1:1.0.0",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    additionalProperties: false,
    properties: {
      aggregation_revision: {
        exclusiveMinimum: 0,
        maximum: 9007199254740991,
        type: "integer",
      },
      gate_id: {
        enum: ["S25-G01", "S25-G02", "S25-G03", "S25-G04"],
        type: "string",
      },
      generated_at: {
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
        type: "string",
      },
      reason_codes: {
        items: {
          enum: [
            "CONTRACT_FAILURE",
            "RAW_CONTENT_MATCH",
            "SMALL_CELL_OR_JOIN_PATH",
            "DELETION_OR_TTL_BREACH",
          ],
          type: "string",
        },
        maxItems: 4,
        type: "array",
      },
      status: {
        enum: ["PASS", "BLOCKED"],
        type: "string",
      },
    },
    required: [
      "aggregation_revision",
      "gate_id",
      "generated_at",
      "reason_codes",
      "status",
    ],
    type: "object",
  },
} as const;

export type JsonSchemaName = keyof typeof jsonSchemas;
