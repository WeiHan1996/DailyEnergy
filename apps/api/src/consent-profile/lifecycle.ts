export const CONSENT_PROFILE_LIFECYCLE = {
  consent: {
    deletionScopes: ["ACCOUNT", "CONSENT_WITHDRAWAL"],
    exportFields: ["notice_version", "state", "accepted_at"],
    replacedReceiptDeadline: "P6M",
    withdrawalEffect: "BLOCK_ORDINARY_WRITES_IMMEDIATELY",
  },
  memoryPreferences: {
    default: "OFF",
    deletionScopes: ["ACCOUNT", "PREFERENCE_WITHDRAWAL"],
    exportFields: [
      "master_enabled",
      "daily_use_enabled",
      "weekly_use_enabled",
      "revision",
    ],
    withdrawalEffect: "STOP_NEW_OPTIONAL_USE_IMMEDIATELY",
  },
  notifications: {
    default: "OFF",
    deletionScopes: ["ACCOUNT", "PREFERENCE_WITHDRAWAL"],
    exportFields: [
      "morning_enabled",
      "evening_enabled",
      "observed_permission",
      "revision",
    ],
    permissionIsConsent: false,
    withdrawalEffect: "STOP_NEW_NOTIFICATION_INTENTS_IMMEDIATELY",
  },
  profile: {
    deletionScopes: ["ACCOUNT", "PROFILE_SOURCE_CLEAR"],
    exportFields: [
      "preferred_name",
      "expression_style",
      "revision",
      "onboarding_completed",
    ],
    preferredNameReplacementDeadline: "PT72H",
    structuredRevisionReplacementDeadline: "P30D",
  },
} as const;
