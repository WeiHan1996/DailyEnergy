-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "daily_energy";
SET search_path TO "daily_energy", pg_catalog;

-- CreateEnum
CREATE TYPE "AccountState" AS ENUM ('ACTIVE', 'RESTRICTED', 'DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACCEPTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ExpressionStyle" AS ENUM ('BALANCED', 'GENTLE', 'LIGHT_HUMOR', 'CLEAR_DIRECT');

-- CreateEnum
CREATE TYPE "CheckinMood" AS ENUM ('VERY_LOW', 'LOW', 'STEADY', 'GOOD', 'LIGHT', 'UNSURE');

-- CreateEnum
CREATE TYPE "CheckinEnergy" AS ENUM ('EMPTY', 'LOW', 'STEADY', 'HIGH', 'FULL', 'UNSURE');

-- CreateEnum
CREATE TYPE "CheckinSleep" AS ENUM ('POOR', 'LOW', 'OKAY', 'GOOD', 'UNSURE');

-- CreateEnum
CREATE TYPE "GenerationState" AS ENUM ('QUEUED', 'RUNNING', 'FALLBACK_RUNNING', 'RETRYABLE_FAILED', 'SUCCEEDED', 'TERMINAL_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvocationWorkload" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "GatewayRouteRole" AS ENUM ('PRIMARY', 'BACKUP', 'CONTROLLED_TEMPLATE');

-- CreateEnum
CREATE TYPE "GatewayAttemptOutcome" AS ENUM ('SUCCEEDED', 'TIMEOUT', 'PROVIDER_ERROR', 'INVALID_SCHEMA', 'UNSAFE', 'BUDGET_EXHAUSTED', 'CIRCUIT_OPEN', 'CANCELLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ContentDisplayState" AS ENUM ('AVAILABLE', 'FALLBACK_ONLY', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DailyTaskStatus" AS ENUM ('UNMARKED', 'INTERESTED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "HelpfulnessRating" AS ENUM ('HELPFUL', 'NEUTRAL', 'NOT_HELPFUL', 'NOT_USED');

-- CreateEnum
CREATE TYPE "OverallFeeling" AS ENUM ('VERY_HEAVY', 'SOMEWHAT_HEAVY', 'STEADY', 'PRETTY_GOOD', 'LIGHT', 'UNSURE');

-- CreateEnum
CREATE TYPE "RelationshipCycleState" AS ENUM ('ACTIVE', 'CLOSED_BY_DELETION');

-- CreateEnum
CREATE TYPE "MatterState" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "MemoryGrantState" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "MemoryPurpose" AS ENUM ('DAILY_EXPRESSION', 'WEEKLY_SUMMARY', 'REMINDER', 'RELATIONSHIP_EXPRESSION');

-- CreateEnum
CREATE TYPE "SafetyStatus" AS ENUM ('CLEAR', 'ACTIVE', 'RECOVERY_PENDING');

-- CreateEnum
CREATE TYPE "SafetyDecisionLevel" AS ENUM ('CLEAR', 'PROFESSIONAL_BOUNDARY', 'HIGH_RISK');

-- CreateEnum
CREATE TYPE "NotificationIntentState" AS ENUM ('SCHEDULED', 'CANCELLED', 'SUPPRESSED', 'SENT', 'OPENED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DataTaskKind" AS ENUM ('DELETE', 'EXPORT');

-- CreateEnum
CREATE TYPE "DataTaskScope" AS ENUM ('DAY', 'MATTER', 'RELATIONSHIP_DATA', 'ACCOUNT', 'EXPORT_ACCOUNT', 'EXPORT_DATE_RANGE');

-- CreateEnum
CREATE TYPE "DataTaskState" AS ENUM ('QUEUED', 'RUNNING', 'FAILED', 'SUCCEEDED');

-- CreateEnum
CREATE TYPE "DeletionStepState" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'SUCCEEDED');

-- CreateEnum
CREATE TYPE "DeletionOutcome" AS ENUM ('SUCCEEDED', 'FAILED', 'RESTRICTED_EXCEPTION');

-- CreateEnum
CREATE TYPE "RetentionDataClass" AS ENUM ('T0_TRANSIENT', 'T1_ACTIVE_PRODUCT', 'T2_RESTRICTED_EVIDENCE', 'T3_ISOLATED_BACKUP', 'T4_ANONYMOUS_SYSTEM');

-- CreateEnum
CREATE TYPE "RetentionScope" AS ENUM ('ACCOUNT', 'DAY', 'MATTER', 'RELATIONSHIP_DATA', 'SAFETY', 'NOTIFICATION', 'EXPORT', 'RUNTIME', 'EVALUATION', 'LEGAL_EVIDENCE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RetentionTerminalAction" AS ENUM ('DELETE', 'ANONYMIZE', 'RESTRICTED_FREEZE');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('STAGED', 'ACTIVE', 'DISABLED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ProviderDeletionState" AS ENUM ('QUEUED', 'SENT', 'ACKNOWLEDGED', 'TTL_ONLY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BackupState" AS ENUM ('AVAILABLE', 'RESTORING_ISOLATED', 'EXPIRED', 'PURGED');

-- CreateEnum
CREATE TYPE "LegalHoldState" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OutboxState" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "EvaluationRunState" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "app_user_account" (
    "id" UUID NOT NULL,
    "ownerScopeToken" BYTEA NOT NULL,
    "stableSubjectCiphertext" BYTEA NOT NULL,
    "stableSubjectKeyVersion" VARCHAR(64) NOT NULL,
    "state" "AccountState" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "restrictionCode" VARCHAR(64),
    "lastActiveUseAt" TIMESTAMPTZ(3) NOT NULL,
    "inactivityDeletionDueAt" TIMESTAMPTZ(3) NOT NULL,
    "activeDeletionTaskRef" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'ACCOUNT',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_external_identity" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "providerCode" VARCHAR(32) NOT NULL,
    "subjectLookupToken" BYTEA NOT NULL,
    "subjectCiphertext" BYTEA NOT NULL,
    "keyVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'ACCOUNT',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_external_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_session_credential" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "deviceRef" VARCHAR(128),
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'ACCOUNT',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_session_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_necessary_consent_record" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "noticeVersion" VARCHAR(64) NOT NULL,
    "logicalIntent" VARCHAR(64) NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "commandRef" UUID NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "withdrawnAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'ACCOUNT',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_necessary_consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user_profile" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "preferredNameCiphertext" BYTEA,
    "preferredNameKeyVersion" VARCHAR(64),
    "expressionStyle" "ExpressionStyle" NOT NULL DEFAULT 'BALANCED',
    "profileSchemaVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'ACCOUNT',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user_profile_revision" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "preferredNameCiphertext" BYTEA,
    "preferredNameKeyVersion" VARCHAR(64),
    "expressionStyle" "ExpressionStyle" NOT NULL,
    "changedFieldNames" TEXT[],
    "commandRef" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'ACCOUNT',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_user_profile_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_onboarding_completion" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "profileRevision" INTEGER NOT NULL,
    "consentRecordId" UUID NOT NULL,
    "completionCommandRef" UUID NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'ACCOUNT',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_onboarding_completion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_view_continuation_grant" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "surfaceCode" VARCHAR(32) NOT NULL,
    "productDate" DATE NOT NULL,
    "resultRef" UUID,
    "feedbackRevision" INTEGER,
    "boundaryAt" TIMESTAMPTZ(3) NOT NULL,
    "allowedOperations" TEXT[],
    "revision" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "invalidatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_view_continuation_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_command_receipt" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "commandRef" UUID NOT NULL,
    "operationCode" VARCHAR(64) NOT NULL,
    "targetScope" VARCHAR(32) NOT NULL,
    "targetKey" VARCHAR(160) NOT NULL,
    "productDatePolicyVersion" VARCHAR(64),
    "normalizedPayloadFingerprint" BYTEA NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "terminalAt" TIMESTAMPTZ(3),
    "responseRef" UUID,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "runtime_command_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_morning_checkin" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productDate" DATE NOT NULL,
    "productDatePolicyVersion" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "mood" "CheckinMood" NOT NULL,
    "energy" "CheckinEnergy" NOT NULL,
    "sleep" "CheckinSleep" NOT NULL,
    "firstSubmittedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceCommandRef" UUID NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_morning_checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_morning_checkin_revision" (
    "id" UUID NOT NULL,
    "checkinId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "mood" "CheckinMood" NOT NULL,
    "energy" "CheckinEnergy" NOT NULL,
    "sleep" "CheckinSleep" NOT NULL,
    "commandRef" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_morning_checkin_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_generation_intent" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "targetProductDate" DATE NOT NULL,
    "productDatePolicyVersion" VARCHAR(64) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "state" "GenerationState" NOT NULL,
    "resultVersion" VARCHAR(64) NOT NULL,
    "manifestRef" VARCHAR(128) NOT NULL,
    "manifestFingerprint" BYTEA NOT NULL,
    "inputSnapshotFingerprint" BYTEA NOT NULL,
    "rootSeedMaterialRef" VARCHAR(128) NOT NULL,
    "completionGrantVersion" VARCHAR(64) NOT NULL,
    "publishedResultRef" UUID,
    "terminalReasonCode" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_generation_intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_generation_input_snapshot" (
    "id" UUID NOT NULL,
    "generationIntentId" UUID NOT NULL,
    "checkinId" UUID NOT NULL,
    "checkinRevision" INTEGER NOT NULL,
    "schemaVersion" VARCHAR(64) NOT NULL,
    "snapshotPayload" JSONB NOT NULL,
    "snapshotFingerprint" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_generation_input_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_gateway_invocation" (
    "id" UUID NOT NULL,
    "workload" "InvocationWorkload" NOT NULL,
    "generationIntentId" UUID,
    "weeklySummaryIntentId" UUID,
    "planFingerprint" BYTEA NOT NULL,
    "promptPackageVersion" VARCHAR(64) NOT NULL,
    "schemaVersion" VARCHAR(64) NOT NULL,
    "templateVersion" VARCHAR(64) NOT NULL,
    "safetyBundleVersion" VARCHAR(64) NOT NULL,
    "routeManifestVersion" VARCHAR(64) NOT NULL,
    "routeFingerprint" BYTEA NOT NULL,
    "publishGuardSnapshot" JSONB NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "runtime_gateway_invocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_gateway_attempt" (
    "id" UUID NOT NULL,
    "invocationId" UUID NOT NULL,
    "routeRole" "GatewayRouteRole" NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "requestFingerprint" BYTEA NOT NULL,
    "adapterVersion" VARCHAR(64) NOT NULL,
    "providerProfileVersion" VARCHAR(64) NOT NULL,
    "endpointCode" VARCHAR(64) NOT NULL,
    "modelVersion" VARCHAR(128) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "outcome" "GatewayAttemptOutcome",
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costMicros" BIGINT,
    "providerRequestRef" VARCHAR(160),
    "candidateFingerprint" BYTEA,
    "failureCode" VARCHAR(64),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "runtime_gateway_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_gateway_candidate" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "schemaVersion" VARCHAR(64) NOT NULL,
    "completePayloadCiphertext" BYTEA NOT NULL,
    "payloadKeyVersion" VARCHAR(64) NOT NULL,
    "candidateFingerprint" BYTEA NOT NULL,
    "validationReceipt" JSONB NOT NULL,
    "validatedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "runtime_gateway_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_published_daily_result" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "generationIntentId" UUID NOT NULL,
    "inputSnapshotId" UUID NOT NULL,
    "productDate" DATE NOT NULL,
    "resultVersion" VARCHAR(64) NOT NULL,
    "schemaVersion" VARCHAR(64) NOT NULL,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ruleFactsPayload" JSONB NOT NULL,
    "expressionCorePayload" JSONB NOT NULL,
    "provenancePayload" JSONB NOT NULL,
    "validationReceipt" JSONB NOT NULL,
    "resultFingerprint" BYTEA NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_published_daily_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_published_result_visibility" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "state" "ContentDisplayState" NOT NULL DEFAULT 'AVAILABLE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceFingerprint" BYTEA NOT NULL,
    "blockedReasonCode" VARCHAR(64),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_published_result_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_result_content_slot" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "segmentPath" VARCHAR(160) NOT NULL,
    "fallbackPayload" JSONB,
    "fallbackFingerprint" BYTEA,
    "fallbackSchemaVersion" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_result_content_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_personalized_content_fragment" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "payloadCiphertext" BYTEA NOT NULL,
    "payloadKeyVersion" VARCHAR(64) NOT NULL,
    "payloadFingerprint" BYTEA NOT NULL,
    "schemaVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_personalized_content_fragment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_source_dependency" (
    "id" UUID NOT NULL,
    "fragmentId" UUID NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "sourceRef" UUID NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "purpose" "MemoryPurpose" NOT NULL,
    "grantRef" UUID,
    "grantRevision" INTEGER,
    "policyVersion" VARCHAR(64) NOT NULL,
    "segmentPaths" TEXT[],
    "fallbackPaths" TEXT[],
    "validAtPublish" BOOLEAN NOT NULL,
    "invalidatedAt" TIMESTAMPTZ(3),
    "invalidationReasonCode" VARCHAR(64),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_source_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_daily_interaction" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productDate" DATE NOT NULL,
    "resultId" UUID NOT NULL,
    "aggregateRevision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_daily_interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_daily_light_fact" (
    "id" UUID NOT NULL,
    "interactionId" UUID NOT NULL,
    "sourceCommandRef" UUID NOT NULL,
    "litAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceValidityRevision" INTEGER NOT NULL DEFAULT 1,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_daily_light_fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_daily_task_state" (
    "id" UUID NOT NULL,
    "interactionId" UUID NOT NULL,
    "taskDefinitionId" VARCHAR(128) NOT NULL,
    "taskKind" VARCHAR(64) NOT NULL,
    "status" "DailyTaskStatus" NOT NULL DEFAULT 'UNMARKED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_daily_task_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_daily_helpfulness_record" (
    "id" UUID NOT NULL,
    "interactionId" UUID NOT NULL,
    "rating" "HelpfulnessRating" NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_daily_helpfulness_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_evening_feedback_record" (
    "id" UUID NOT NULL,
    "interactionId" UUID NOT NULL,
    "overallFeeling" "OverallFeeling" NOT NULL,
    "noteCiphertext" BYTEA,
    "noteKeyVersion" VARCHAR(64),
    "firstSubmittedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_evening_feedback_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_evening_feedback_revision" (
    "id" UUID NOT NULL,
    "feedbackId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "changedFieldNames" TEXT[],
    "noteChanged" BOOLEAN NOT NULL,
    "commandRef" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_evening_feedback_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_relationship_cycle" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceCutoffEpoch" BIGINT NOT NULL DEFAULT 0,
    "state" "RelationshipCycleState" NOT NULL DEFAULT 'ACTIVE',
    "activeSlot" BOOLEAN DEFAULT true,
    "projectionFingerprint" BYTEA NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RELATIONSHIP_DATA',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_relationship_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_relationship_encounter_link" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "sourceLightId" UUID NOT NULL,
    "productDate" DATE NOT NULL,
    "sourceValidityRevision" INTEGER NOT NULL,
    "sourceEventId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RELATIONSHIP_DATA',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_relationship_encounter_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_relationship_node_receipt" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "nodeCode" VARCHAR(64) NOT NULL,
    "sourceFingerprint" BYTEA NOT NULL,
    "outcomeCode" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RELATIONSHIP_DATA',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_relationship_node_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_important_matter" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "titleCiphertext" BYTEA NOT NULL,
    "titleKeyVersion" VARCHAR(64) NOT NULL,
    "targetProductDate" DATE,
    "state" "MatterState" NOT NULL DEFAULT 'ACTIVE',
    "createdProductDate" DATE NOT NULL,
    "terminalAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'MATTER',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_important_matter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_important_matter_revision" (
    "id" UUID NOT NULL,
    "matterId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "titleCiphertext" BYTEA NOT NULL,
    "titleKeyVersion" VARCHAR(64) NOT NULL,
    "targetProductDate" DATE,
    "state" "MatterState" NOT NULL,
    "commandRef" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'MATTER',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_important_matter_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_memory_purpose_grant" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "sourceRef" UUID NOT NULL,
    "purpose" "MemoryPurpose" NOT NULL,
    "state" "MemoryGrantState" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "policyVersion" VARCHAR(64) NOT NULL,
    "consentSurfaceVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'MATTER',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_memory_purpose_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_memory_master_preference" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "dailyExpressionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "continuityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'ACCOUNT',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_memory_master_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_memory_mention_receipt" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "sourceRef" UUID NOT NULL,
    "productDate" DATE NOT NULL,
    "purpose" "MemoryPurpose" NOT NULL,
    "resultId" UUID NOT NULL,
    "policyVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_memory_mention_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_memory_context_snapshot" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "invocationId" UUID NOT NULL,
    "factsPayload" JSONB NOT NULL,
    "segmentContracts" JSONB NOT NULL,
    "policyVersion" VARCHAR(64) NOT NULL,
    "resolverVersion" VARCHAR(64) NOT NULL,
    "registryVersion" VARCHAR(64) NOT NULL,
    "grantRevisionVector" JSONB NOT NULL,
    "snapshotFingerprint" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_memory_context_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_weekly_window" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "endProductDate" DATE NOT NULL,
    "windowRuleVersion" VARCHAR(64) NOT NULL,
    "currentSourceFingerprint" BYTEA,
    "currentSummaryRef" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_weekly_window_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_weekly_source_snapshot" (
    "id" UUID NOT NULL,
    "windowId" UUID NOT NULL,
    "sourceFingerprint" BYTEA NOT NULL,
    "sourceSlotsPayload" JSONB NOT NULL,
    "aggregateFactsPayload" JSONB NOT NULL,
    "expressionPlanPayload" JSONB NOT NULL,
    "aggregateVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" TIMESTAMPTZ(3),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_weekly_source_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_weekly_summary_intent" (
    "id" UUID NOT NULL,
    "windowId" UUID NOT NULL,
    "sourceFingerprint" BYTEA NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "state" "GenerationState" NOT NULL,
    "summaryVersion" VARCHAR(64) NOT NULL,
    "terminalReasonCode" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_weekly_summary_intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_published_weekly_summary_revision" (
    "id" UUID NOT NULL,
    "windowId" UUID NOT NULL,
    "summaryIntentId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "sourceFingerprint" BYTEA NOT NULL,
    "schemaVersion" VARCHAR(64) NOT NULL,
    "summaryVersion" VARCHAR(64) NOT NULL,
    "expressionCorePayload" JSONB NOT NULL,
    "provenancePayload" JSONB NOT NULL,
    "validationReceipt" JSONB NOT NULL,
    "supersedesRef" UUID,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_published_weekly_summary_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_weekly_content_slot" (
    "id" UUID NOT NULL,
    "summaryId" UUID NOT NULL,
    "segmentPath" VARCHAR(160) NOT NULL,
    "fallbackPayload" JSONB,
    "fallbackFingerprint" BYTEA,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_weekly_content_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_weekly_personalized_content_fragment" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "payloadCiphertext" BYTEA NOT NULL,
    "payloadKeyVersion" VARCHAR(64) NOT NULL,
    "payloadFingerprint" BYTEA NOT NULL,
    "schemaVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_weekly_personalized_content_fragment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_weekly_source_dependency" (
    "id" UUID NOT NULL,
    "fragmentId" UUID NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "sourceRef" UUID NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "purpose" "MemoryPurpose" NOT NULL,
    "grantRef" UUID,
    "grantRevision" INTEGER,
    "policyVersion" VARCHAR(64) NOT NULL,
    "segmentPaths" TEXT[],
    "fallbackPaths" TEXT[],
    "validAtPublish" BOOLEAN NOT NULL,
    "invalidatedAt" TIMESTAMPTZ(3),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'DAY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_weekly_source_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_safety_state" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "state" "SafetyStatus" NOT NULL DEFAULT 'CLEAR',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "guardEpoch" BIGINT NOT NULL DEFAULT 0,
    "latestEventRef" UUID,
    "responsePlanRef" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'SAFETY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "restricted_safety_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_safety_decision" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "surfaceCode" VARCHAR(32) NOT NULL,
    "commandRef" UUID NOT NULL,
    "level" "SafetyDecisionLevel" NOT NULL,
    "categoryCodes" TEXT[],
    "policyVersion" VARCHAR(64) NOT NULL,
    "ruleVersion" VARCHAR(64) NOT NULL,
    "classifierVersion" VARCHAR(64),
    "irreversibleFingerprint" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'SAFETY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "restricted_safety_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_safety_event" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "stateRevision" INTEGER NOT NULL,
    "guardEpoch" BIGINT NOT NULL,
    "surfaceCode" VARCHAR(32) NOT NULL,
    "decisionLevel" "SafetyDecisionLevel" NOT NULL,
    "categoryCodes" TEXT[],
    "policyVersion" VARCHAR(64) NOT NULL,
    "ruleVersion" VARCHAR(64) NOT NULL,
    "classifierVersion" VARCHAR(64),
    "responseVersion" VARCHAR(64) NOT NULL,
    "resourceRegistryVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'SAFETY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "restricted_safety_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_safety_response_plan" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "stateRevision" INTEGER NOT NULL,
    "blockIds" TEXT[],
    "resourceEntryRefs" JSONB NOT NULL,
    "localeCode" VARCHAR(16) NOT NULL,
    "regionCode" VARCHAR(16) NOT NULL,
    "fallbackCode" VARCHAR(32) NOT NULL,
    "viewVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'SAFETY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "restricted_safety_response_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_safety_resource_entry" (
    "id" UUID NOT NULL,
    "registryVersion" VARCHAR(64) NOT NULL,
    "entryCode" VARCHAR(64) NOT NULL,
    "regionCode" VARCHAR(16) NOT NULL,
    "localeCode" VARCHAR(16) NOT NULL,
    "contentPayload" JSONB NOT NULL,
    "contentFingerprint" BYTEA NOT NULL,
    "state" "CatalogStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_safety_resource_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_recovery_command_receipt" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "expectedStateRevision" INTEGER NOT NULL,
    "commandRef" UUID NOT NULL,
    "intentCode" VARCHAR(32) NOT NULL,
    "outcomeCode" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'SAFETY',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "restricted_recovery_command_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notification_preference" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "notificationType" VARCHAR(64) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "preferredWindow" VARCHAR(32),
    "autoPauseCode" VARCHAR(64),
    "ruleVersion" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'NOTIFICATION',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_platform_permission_snapshot" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "platformCode" VARCHAR(32) NOT NULL,
    "deviceRef" VARCHAR(128) NOT NULL,
    "permissionType" VARCHAR(64) NOT NULL,
    "observedStatus" VARCHAR(32) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'NOTIFICATION',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_platform_permission_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notification_intent" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "notificationType" VARCHAR(64) NOT NULL,
    "semanticKey" BYTEA NOT NULL,
    "targetProductDate" DATE,
    "matterRef" UUID,
    "plannedWindow" VARCHAR(64) NOT NULL,
    "ruleVersion" VARCHAR(64) NOT NULL,
    "state" "NotificationIntentState" NOT NULL DEFAULT 'SCHEDULED',
    "dispatchClaimToken" UUID,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "terminalAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'NOTIFICATION',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "app_notification_intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_notification_delivery_attempt" (
    "id" UUID NOT NULL,
    "intentId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "channelCredentialRef" VARCHAR(128) NOT NULL,
    "requestFingerprint" BYTEA NOT NULL,
    "platformOpaqueRef" VARCHAR(160),
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "outcomeCode" VARCHAR(64),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'NOTIFICATION',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "runtime_notification_delivery_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_data_task" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "kind" "DataTaskKind" NOT NULL,
    "scope" "DataTaskScope" NOT NULL,
    "targetType" VARCHAR(64) NOT NULL,
    "targetKey" VARCHAR(160) NOT NULL,
    "activeSlot" BOOLEAN DEFAULT true,
    "state" "DataTaskState" NOT NULL DEFAULT 'QUEUED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "confirmationVersion" VARCHAR(64) NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "guardedAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "onlineErasedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "failureScopeCodes" TEXT[],
    "backupPurgeDeadline" TIMESTAMPTZ(3),
    "providerExpiryDeadlines" JSONB,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "restricted_data_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_deletion_guard" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "scope" "DataTaskScope" NOT NULL,
    "targetKey" VARCHAR(160) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "deletionEpoch" BIGINT NOT NULL DEFAULT 1,
    "taskRef" UUID NOT NULL,
    "semanticBlockedAt" TIMESTAMPTZ(3) NOT NULL,
    "releasedAt" TIMESTAMPTZ(3),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "restricted_deletion_guard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_deletion_step_checkpoint" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "subsystemCode" VARCHAR(64) NOT NULL,
    "state" "DeletionStepState" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastStableFailureCode" VARCHAR(64),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "restricted_deletion_step_checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_day_erasure_guard" (
    "id" UUID NOT NULL,
    "ownerScopeToken" BYTEA NOT NULL,
    "productDate" DATE NOT NULL,
    "deletionEpoch" BIGINT NOT NULL,
    "originalResultVersion" VARCHAR(64),
    "deletionTaskRef" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "restricted_day_erasure_guard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_deletion_receipt" (
    "id" UUID NOT NULL,
    "caseRef" UUID NOT NULL,
    "blindedSubjectToken" BYTEA,
    "taskRef" UUID NOT NULL,
    "kind" "DataTaskKind" NOT NULL,
    "scope" "DataTaskScope" NOT NULL,
    "targetType" VARCHAR(64) NOT NULL,
    "confirmationVersion" VARCHAR(64) NOT NULL,
    "policyVersion" VARCHAR(64) NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "guardedAt" TIMESTAMPTZ(3) NOT NULL,
    "onlineErasedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3) NOT NULL,
    "backupPurgeDeadline" TIMESTAMPTZ(3) NOT NULL,
    "providerExpiryDeadlines" JSONB NOT NULL,
    "outcome" "DeletionOutcome" NOT NULL,
    "failureScopeCodes" TEXT[],
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "restricted_deletion_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_provider_deletion_request" (
    "id" UUID NOT NULL,
    "taskRef" UUID NOT NULL,
    "providerProfileVersion" VARCHAR(64) NOT NULL,
    "opaqueProviderRef" VARCHAR(160),
    "state" "ProviderDeletionState" NOT NULL DEFAULT 'QUEUED',
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "providerExpiryAt" TIMESTAMPTZ(3) NOT NULL,
    "evidenceRef" VARCHAR(160),
    "stableFailureCode" VARCHAR(64),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'LEGAL_EVIDENCE',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "restricted_provider_deletion_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_backup_catalog_entry" (
    "id" UUID NOT NULL,
    "generationCode" VARCHAR(96) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "encryptionKeyVersion" VARCHAR(64) NOT NULL,
    "coveredDataDomains" TEXT[],
    "state" "BackupState" NOT NULL DEFAULT 'AVAILABLE',
    "purgedAt" TIMESTAMPTZ(3),

    CONSTRAINT "system_backup_catalog_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_restore_deny_record" (
    "id" UUID NOT NULL,
    "caseRef" UUID NOT NULL,
    "blindedSubjectToken" BYTEA NOT NULL,
    "scope" "DataTaskScope" NOT NULL,
    "targetToken" BYTEA,
    "deletionEpoch" BIGINT NOT NULL,
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'LEGAL_EVIDENCE',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "restricted_restore_deny_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_retention_policy_entry" (
    "id" UUID NOT NULL,
    "policyVersion" VARCHAR(64) NOT NULL,
    "dataTypeCode" VARCHAR(96) NOT NULL,
    "dataClass" "RetentionDataClass" NOT NULL,
    "purposeCode" VARCHAR(96) NOT NULL,
    "anchorCode" VARCHAR(64) NOT NULL,
    "maxDurationIso8601" VARCHAR(32) NOT NULL,
    "terminalAction" "RetentionTerminalAction" NOT NULL,
    "scopeBehavior" JSONB NOT NULL,
    "backupDurationIso8601" VARCHAR(32) NOT NULL,
    "legalBasisRef" VARCHAR(160),
    "fingerprint" BYTEA NOT NULL,
    "state" "CatalogStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_retention_policy_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_provider_data_handling_profile" (
    "id" UUID NOT NULL,
    "profileVersion" VARCHAR(64) NOT NULL,
    "providerCode" VARCHAR(64) NOT NULL,
    "purposeCodes" TEXT[],
    "dataTypeCodes" TEXT[],
    "regionCode" VARCHAR(32) NOT NULL,
    "subprocessors" JSONB NOT NULL,
    "trainingEnabled" BOOLEAN NOT NULL,
    "onlineRetentionDays" INTEGER NOT NULL,
    "backupRetentionDays" INTEGER NOT NULL,
    "deletionCapabilities" TEXT[],
    "contractEvidenceRef" VARCHAR(160) NOT NULL,
    "disclosureVersion" VARCHAR(64) NOT NULL,
    "fingerprint" BYTEA NOT NULL,
    "state" "CatalogStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_provider_data_handling_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_legal_hold" (
    "id" UUID NOT NULL,
    "holdRef" UUID NOT NULL,
    "blindedSubjectToken" BYTEA,
    "scopeCode" VARCHAR(64) NOT NULL,
    "dataCategoryCodes" TEXT[],
    "legalBasisRef" VARCHAR(160) NOT NULL,
    "approvalRef" VARCHAR(160) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "reviewDueAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "releasedAt" TIMESTAMPTZ(3),
    "state" "LegalHoldState" NOT NULL DEFAULT 'ACTIVE',
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'LEGAL_EVIDENCE',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "restricted_legal_hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_audit_event" (
    "id" UUID NOT NULL,
    "actorType" VARCHAR(32) NOT NULL,
    "serviceCode" VARCHAR(64) NOT NULL,
    "privilegedRoleCode" VARCHAR(64),
    "actionCode" VARCHAR(64) NOT NULL,
    "scopeCode" VARCHAR(64) NOT NULL,
    "purposeCode" VARCHAR(64) NOT NULL,
    "policyVersion" VARCHAR(64) NOT NULL,
    "opaqueObjectToken" BYTEA,
    "ticketRef" VARCHAR(160),
    "holdRef" UUID,
    "outcomeCode" VARCHAR(64) NOT NULL,
    "stableReasonCode" VARCHAR(64),
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'LEGAL_EVIDENCE',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "restricted_audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_outbox_event" (
    "id" UUID NOT NULL,
    "aggregateType" VARCHAR(64) NOT NULL,
    "aggregateRef" UUID NOT NULL,
    "aggregateRevision" INTEGER NOT NULL,
    "eventType" VARCHAR(96) NOT NULL,
    "eventVersion" VARCHAR(32) NOT NULL,
    "idempotencyKey" BYTEA NOT NULL,
    "allowlistedPayload" JSONB NOT NULL,
    "guardEpochs" JSONB NOT NULL,
    "state" "OutboxState" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "runtime_outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_inbox_receipt" (
    "id" UUID NOT NULL,
    "consumerCode" VARCHAR(64) NOT NULL,
    "eventId" UUID NOT NULL,
    "eventFingerprint" BYTEA NOT NULL,
    "processedAt" TIMESTAMPTZ(3) NOT NULL,
    "outcomeCode" VARCHAR(32) NOT NULL,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'RUNTIME',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "runtime_inbox_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_version_catalog_entry" (
    "id" UUID NOT NULL,
    "catalogType" VARCHAR(64) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "compatibilityPayload" JSONB NOT NULL,
    "fingerprint" BYTEA NOT NULL,
    "state" "CatalogStatus" NOT NULL,
    "activatedAt" TIMESTAMPTZ(3),
    "retiredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_version_catalog_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_run" (
    "id" UUID NOT NULL,
    "syntheticSubjectRef" VARCHAR(128) NOT NULL,
    "corpusFingerprint" BYTEA NOT NULL,
    "codeCommit" VARCHAR(64) NOT NULL,
    "schemaVersions" JSONB NOT NULL,
    "promptVersion" VARCHAR(64) NOT NULL,
    "safetyVersion" VARCHAR(64) NOT NULL,
    "routeVersion" VARCHAR(64) NOT NULL,
    "candidateParameters" JSONB NOT NULL,
    "state" "EvaluationRunState" NOT NULL DEFAULT 'PLANNED',
    "aggregateScores" JSONB,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'EVALUATION',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "evaluation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_sample" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "caseId" VARCHAR(96) NOT NULL,
    "sampleOrdinal" INTEGER NOT NULL,
    "syntheticInputPayload" JSONB NOT NULL,
    "responseCiphertext" BYTEA,
    "responseKeyVersion" VARCHAR(64),
    "normalizedEvidence" JSONB NOT NULL,
    "hardGateResults" JSONB NOT NULL,
    "humanScores" JSONB,
    "providerRequestRef" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionPolicyVersion" VARCHAR(64) NOT NULL,
    "retentionScope" "RetentionScope" NOT NULL DEFAULT 'EVALUATION',
    "retentionAnchorAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "evaluation_sample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_account_ownerScopeToken_key" ON "app_user_account"("ownerScopeToken");

-- CreateIndex
CREATE INDEX "app_user_account_state_inactivityDeletionDueAt_idx" ON "app_user_account"("state", "inactivityDeletionDueAt");

-- CreateIndex
CREATE INDEX "app_user_account_expiresAt_idx" ON "app_user_account"("expiresAt");

-- CreateIndex
CREATE INDEX "app_external_identity_accountId_idx" ON "app_external_identity"("accountId");

-- CreateIndex
CREATE INDEX "app_external_identity_expiresAt_idx" ON "app_external_identity"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_external_identity_providerCode_subjectLookupToken_key" ON "app_external_identity"("providerCode", "subjectLookupToken");

-- CreateIndex
CREATE UNIQUE INDEX "app_session_credential_tokenHash_key" ON "app_session_credential"("tokenHash");

-- CreateIndex
CREATE INDEX "app_session_credential_accountId_expiresAt_idx" ON "app_session_credential"("accountId", "expiresAt");

-- CreateIndex
CREATE INDEX "app_necessary_consent_record_accountId_logicalIntent_create_idx" ON "app_necessary_consent_record"("accountId", "logicalIntent", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "app_necessary_consent_record_expiresAt_idx" ON "app_necessary_consent_record"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_necessary_consent_record_accountId_commandRef_key" ON "app_necessary_consent_record"("accountId", "commandRef");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_profile_accountId_key" ON "app_user_profile"("accountId");

-- CreateIndex
CREATE INDEX "app_user_profile_expiresAt_idx" ON "app_user_profile"("expiresAt");

-- CreateIndex
CREATE INDEX "app_user_profile_revision_expiresAt_idx" ON "app_user_profile_revision"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_profile_revision_profileId_revision_key" ON "app_user_profile_revision"("profileId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "app_onboarding_completion_accountId_key" ON "app_onboarding_completion"("accountId");

-- CreateIndex
CREATE INDEX "app_onboarding_completion_expiresAt_idx" ON "app_onboarding_completion"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_onboarding_completion_accountId_completionCommandRef_key" ON "app_onboarding_completion"("accountId", "completionCommandRef");

-- CreateIndex
CREATE INDEX "app_view_continuation_grant_accountId_productDate_expiresAt_idx" ON "app_view_continuation_grant"("accountId", "productDate", "expiresAt");

-- CreateIndex
CREATE INDEX "app_view_continuation_grant_sessionId_expiresAt_idx" ON "app_view_continuation_grant"("sessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "runtime_command_receipt_accountId_operationCode_targetKey_idx" ON "runtime_command_receipt"("accountId", "operationCode", "targetKey");

-- CreateIndex
CREATE INDEX "runtime_command_receipt_expiresAt_idx" ON "runtime_command_receipt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_command_receipt_accountId_commandRef_key" ON "runtime_command_receipt"("accountId", "commandRef");

-- CreateIndex
CREATE INDEX "app_morning_checkin_accountId_productDate_idx" ON "app_morning_checkin"("accountId", "productDate" DESC);

-- CreateIndex
CREATE INDEX "app_morning_checkin_expiresAt_idx" ON "app_morning_checkin"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_morning_checkin_accountId_productDate_key" ON "app_morning_checkin"("accountId", "productDate");

-- CreateIndex
CREATE INDEX "app_morning_checkin_revision_expiresAt_idx" ON "app_morning_checkin_revision"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_morning_checkin_revision_checkinId_revision_key" ON "app_morning_checkin_revision"("checkinId", "revision");

-- CreateIndex
CREATE INDEX "app_generation_intent_state_updatedAt_idx" ON "app_generation_intent"("state", "updatedAt");

-- CreateIndex
CREATE INDEX "app_generation_intent_expiresAt_idx" ON "app_generation_intent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_generation_intent_accountId_targetProductDate_key" ON "app_generation_intent"("accountId", "targetProductDate");

-- CreateIndex
CREATE UNIQUE INDEX "app_generation_input_snapshot_generationIntentId_key" ON "app_generation_input_snapshot"("generationIntentId");

-- CreateIndex
CREATE INDEX "app_generation_input_snapshot_checkinId_checkinRevision_idx" ON "app_generation_input_snapshot"("checkinId", "checkinRevision");

-- CreateIndex
CREATE INDEX "app_generation_input_snapshot_expiresAt_idx" ON "app_generation_input_snapshot"("expiresAt");

-- CreateIndex
CREATE INDEX "runtime_gateway_invocation_generationIntentId_idx" ON "runtime_gateway_invocation"("generationIntentId");

-- CreateIndex
CREATE INDEX "runtime_gateway_invocation_weeklySummaryIntentId_idx" ON "runtime_gateway_invocation"("weeklySummaryIntentId");

-- CreateIndex
CREATE INDEX "runtime_gateway_invocation_expiresAt_idx" ON "runtime_gateway_invocation"("expiresAt");

-- CreateIndex
CREATE INDEX "runtime_gateway_attempt_providerProfileVersion_startedAt_idx" ON "runtime_gateway_attempt"("providerProfileVersion", "startedAt");

-- CreateIndex
CREATE INDEX "runtime_gateway_attempt_expiresAt_idx" ON "runtime_gateway_attempt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_gateway_attempt_invocationId_routeRole_ordinal_key" ON "runtime_gateway_attempt"("invocationId", "routeRole", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_gateway_candidate_attemptId_key" ON "runtime_gateway_candidate"("attemptId");

-- CreateIndex
CREATE INDEX "runtime_gateway_candidate_expiresAt_idx" ON "runtime_gateway_candidate"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_published_daily_result_generationIntentId_key" ON "app_published_daily_result"("generationIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "app_published_daily_result_inputSnapshotId_key" ON "app_published_daily_result"("inputSnapshotId");

-- CreateIndex
CREATE INDEX "app_published_daily_result_accountId_productDate_idx" ON "app_published_daily_result"("accountId", "productDate" DESC);

-- CreateIndex
CREATE INDEX "app_published_daily_result_expiresAt_idx" ON "app_published_daily_result"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_published_daily_result_accountId_productDate_key" ON "app_published_daily_result"("accountId", "productDate");

-- CreateIndex
CREATE UNIQUE INDEX "app_published_result_visibility_resultId_key" ON "app_published_result_visibility"("resultId");

-- CreateIndex
CREATE INDEX "app_published_result_visibility_expiresAt_idx" ON "app_published_result_visibility"("expiresAt");

-- CreateIndex
CREATE INDEX "app_result_content_slot_expiresAt_idx" ON "app_result_content_slot"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_result_content_slot_resultId_segmentPath_key" ON "app_result_content_slot"("resultId", "segmentPath");

-- CreateIndex
CREATE UNIQUE INDEX "app_personalized_content_fragment_slotId_key" ON "app_personalized_content_fragment"("slotId");

-- CreateIndex
CREATE INDEX "app_personalized_content_fragment_expiresAt_idx" ON "app_personalized_content_fragment"("expiresAt");

-- CreateIndex
CREATE INDEX "app_source_dependency_sourceType_sourceRef_idx" ON "app_source_dependency"("sourceType", "sourceRef");

-- CreateIndex
CREATE INDEX "app_source_dependency_grantRef_idx" ON "app_source_dependency"("grantRef");

-- CreateIndex
CREATE INDEX "app_source_dependency_expiresAt_idx" ON "app_source_dependency"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_daily_interaction_resultId_key" ON "app_daily_interaction"("resultId");

-- CreateIndex
CREATE INDEX "app_daily_interaction_accountId_productDate_idx" ON "app_daily_interaction"("accountId", "productDate" DESC);

-- CreateIndex
CREATE INDEX "app_daily_interaction_expiresAt_idx" ON "app_daily_interaction"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_daily_interaction_accountId_productDate_key" ON "app_daily_interaction"("accountId", "productDate");

-- CreateIndex
CREATE UNIQUE INDEX "app_daily_light_fact_interactionId_key" ON "app_daily_light_fact"("interactionId");

-- CreateIndex
CREATE INDEX "app_daily_light_fact_expiresAt_idx" ON "app_daily_light_fact"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_daily_task_state_interactionId_key" ON "app_daily_task_state"("interactionId");

-- CreateIndex
CREATE INDEX "app_daily_task_state_expiresAt_idx" ON "app_daily_task_state"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_daily_helpfulness_record_interactionId_key" ON "app_daily_helpfulness_record"("interactionId");

-- CreateIndex
CREATE INDEX "app_daily_helpfulness_record_expiresAt_idx" ON "app_daily_helpfulness_record"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_evening_feedback_record_interactionId_key" ON "app_evening_feedback_record"("interactionId");

-- CreateIndex
CREATE INDEX "app_evening_feedback_record_expiresAt_idx" ON "app_evening_feedback_record"("expiresAt");

-- CreateIndex
CREATE INDEX "app_evening_feedback_revision_expiresAt_idx" ON "app_evening_feedback_revision"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_evening_feedback_revision_feedbackId_revision_key" ON "app_evening_feedback_revision"("feedbackId", "revision");

-- CreateIndex
CREATE INDEX "app_relationship_cycle_accountId_state_idx" ON "app_relationship_cycle"("accountId", "state");

-- CreateIndex
CREATE INDEX "app_relationship_cycle_expiresAt_idx" ON "app_relationship_cycle"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_relationship_cycle_accountId_activeSlot_key" ON "app_relationship_cycle"("accountId", "activeSlot");

-- CreateIndex
CREATE INDEX "app_relationship_encounter_link_sourceLightId_idx" ON "app_relationship_encounter_link"("sourceLightId");

-- CreateIndex
CREATE INDEX "app_relationship_encounter_link_expiresAt_idx" ON "app_relationship_encounter_link"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_relationship_encounter_link_cycleId_sourceLightId_key" ON "app_relationship_encounter_link"("cycleId", "sourceLightId");

-- CreateIndex
CREATE UNIQUE INDEX "app_relationship_encounter_link_cycleId_productDate_key" ON "app_relationship_encounter_link"("cycleId", "productDate");

-- CreateIndex
CREATE INDEX "app_relationship_node_receipt_expiresAt_idx" ON "app_relationship_node_receipt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_relationship_node_receipt_cycleId_nodeCode_sourceFinger_key" ON "app_relationship_node_receipt"("cycleId", "nodeCode", "sourceFingerprint");

-- CreateIndex
CREATE INDEX "app_important_matter_accountId_state_targetProductDate_idx" ON "app_important_matter"("accountId", "state", "targetProductDate");

-- CreateIndex
CREATE INDEX "app_important_matter_expiresAt_idx" ON "app_important_matter"("expiresAt");

-- CreateIndex
CREATE INDEX "app_important_matter_revision_expiresAt_idx" ON "app_important_matter_revision"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_important_matter_revision_matterId_revision_key" ON "app_important_matter_revision"("matterId", "revision");

-- CreateIndex
CREATE INDEX "app_memory_purpose_grant_accountId_purpose_state_idx" ON "app_memory_purpose_grant"("accountId", "purpose", "state");

-- CreateIndex
CREATE INDEX "app_memory_purpose_grant_expiresAt_idx" ON "app_memory_purpose_grant"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_memory_purpose_grant_accountId_sourceType_sourceRef_pur_key" ON "app_memory_purpose_grant"("accountId", "sourceType", "sourceRef", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "app_memory_master_preference_accountId_key" ON "app_memory_master_preference"("accountId");

-- CreateIndex
CREATE INDEX "app_memory_master_preference_expiresAt_idx" ON "app_memory_master_preference"("expiresAt");

-- CreateIndex
CREATE INDEX "app_memory_mention_receipt_accountId_productDate_idx" ON "app_memory_mention_receipt"("accountId", "productDate");

-- CreateIndex
CREATE INDEX "app_memory_mention_receipt_expiresAt_idx" ON "app_memory_mention_receipt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_memory_mention_receipt_sourceRef_productDate_purpose_re_key" ON "app_memory_mention_receipt"("sourceRef", "productDate", "purpose", "resultId");

-- CreateIndex
CREATE UNIQUE INDEX "app_memory_context_snapshot_invocationId_key" ON "app_memory_context_snapshot"("invocationId");

-- CreateIndex
CREATE INDEX "app_memory_context_snapshot_expiresAt_idx" ON "app_memory_context_snapshot"("expiresAt");

-- CreateIndex
CREATE INDEX "app_weekly_window_accountId_endProductDate_idx" ON "app_weekly_window"("accountId", "endProductDate" DESC);

-- CreateIndex
CREATE INDEX "app_weekly_window_expiresAt_idx" ON "app_weekly_window"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_weekly_window_accountId_endProductDate_windowRuleVersio_key" ON "app_weekly_window"("accountId", "endProductDate", "windowRuleVersion");

-- CreateIndex
CREATE INDEX "app_weekly_source_snapshot_expiresAt_idx" ON "app_weekly_source_snapshot"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_weekly_source_snapshot_windowId_sourceFingerprint_key" ON "app_weekly_source_snapshot"("windowId", "sourceFingerprint");

-- CreateIndex
CREATE INDEX "app_weekly_summary_intent_state_updatedAt_idx" ON "app_weekly_summary_intent"("state", "updatedAt");

-- CreateIndex
CREATE INDEX "app_weekly_summary_intent_expiresAt_idx" ON "app_weekly_summary_intent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_weekly_summary_intent_windowId_sourceFingerprint_key" ON "app_weekly_summary_intent"("windowId", "sourceFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "app_published_weekly_summary_revision_summaryIntentId_key" ON "app_published_weekly_summary_revision"("summaryIntentId");

-- CreateIndex
CREATE INDEX "app_published_weekly_summary_revision_windowId_sourceFinger_idx" ON "app_published_weekly_summary_revision"("windowId", "sourceFingerprint");

-- CreateIndex
CREATE INDEX "app_published_weekly_summary_revision_expiresAt_idx" ON "app_published_weekly_summary_revision"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_published_weekly_summary_revision_windowId_revision_key" ON "app_published_weekly_summary_revision"("windowId", "revision");

-- CreateIndex
CREATE INDEX "app_weekly_content_slot_expiresAt_idx" ON "app_weekly_content_slot"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_weekly_content_slot_summaryId_segmentPath_key" ON "app_weekly_content_slot"("summaryId", "segmentPath");

-- CreateIndex
CREATE UNIQUE INDEX "app_weekly_personalized_content_fragment_slotId_key" ON "app_weekly_personalized_content_fragment"("slotId");

-- CreateIndex
CREATE INDEX "app_weekly_personalized_content_fragment_expiresAt_idx" ON "app_weekly_personalized_content_fragment"("expiresAt");

-- CreateIndex
CREATE INDEX "app_weekly_source_dependency_sourceType_sourceRef_idx" ON "app_weekly_source_dependency"("sourceType", "sourceRef");

-- CreateIndex
CREATE INDEX "app_weekly_source_dependency_grantRef_idx" ON "app_weekly_source_dependency"("grantRef");

-- CreateIndex
CREATE INDEX "app_weekly_source_dependency_expiresAt_idx" ON "app_weekly_source_dependency"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_safety_state_accountId_key" ON "restricted_safety_state"("accountId");

-- CreateIndex
CREATE INDEX "restricted_safety_state_state_updatedAt_idx" ON "restricted_safety_state"("state", "updatedAt");

-- CreateIndex
CREATE INDEX "restricted_safety_state_expiresAt_idx" ON "restricted_safety_state"("expiresAt");

-- CreateIndex
CREATE INDEX "restricted_safety_decision_expiresAt_idx" ON "restricted_safety_decision"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_safety_decision_accountId_surfaceCode_commandRef_key" ON "restricted_safety_decision"("accountId", "surfaceCode", "commandRef");

-- CreateIndex
CREATE INDEX "restricted_safety_event_expiresAt_idx" ON "restricted_safety_event"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_safety_event_accountId_stateRevision_key" ON "restricted_safety_event"("accountId", "stateRevision");

-- CreateIndex
CREATE INDEX "restricted_safety_response_plan_expiresAt_idx" ON "restricted_safety_response_plan"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_safety_response_plan_accountId_stateRevision_key" ON "restricted_safety_response_plan"("accountId", "stateRevision");

-- CreateIndex
CREATE INDEX "system_safety_resource_entry_state_regionCode_localeCode_idx" ON "system_safety_resource_entry"("state", "regionCode", "localeCode");

-- CreateIndex
CREATE UNIQUE INDEX "system_safety_resource_entry_registryVersion_entryCode_regi_key" ON "system_safety_resource_entry"("registryVersion", "entryCode", "regionCode", "localeCode");

-- CreateIndex
CREATE INDEX "restricted_recovery_command_receipt_expiresAt_idx" ON "restricted_recovery_command_receipt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_recovery_command_receipt_accountId_commandRef_key" ON "restricted_recovery_command_receipt"("accountId", "commandRef");

-- CreateIndex
CREATE INDEX "app_notification_preference_expiresAt_idx" ON "app_notification_preference"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_notification_preference_accountId_notificationType_key" ON "app_notification_preference"("accountId", "notificationType");

-- CreateIndex
CREATE INDEX "app_platform_permission_snapshot_accountId_deviceRef_permis_idx" ON "app_platform_permission_snapshot"("accountId", "deviceRef", "permissionType", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "app_platform_permission_snapshot_expiresAt_idx" ON "app_platform_permission_snapshot"("expiresAt");

-- CreateIndex
CREATE INDEX "app_notification_intent_state_scheduledAt_idx" ON "app_notification_intent"("state", "scheduledAt");

-- CreateIndex
CREATE INDEX "app_notification_intent_accountId_notificationType_targetPr_idx" ON "app_notification_intent"("accountId", "notificationType", "targetProductDate");

-- CreateIndex
CREATE INDEX "app_notification_intent_expiresAt_idx" ON "app_notification_intent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_notification_intent_accountId_semanticKey_key" ON "app_notification_intent"("accountId", "semanticKey");

-- CreateIndex
CREATE INDEX "runtime_notification_delivery_attempt_expiresAt_idx" ON "runtime_notification_delivery_attempt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_notification_delivery_attempt_intentId_ordinal_key" ON "runtime_notification_delivery_attempt"("intentId", "ordinal");

-- CreateIndex
CREATE INDEX "restricted_data_task_state_requestedAt_idx" ON "restricted_data_task"("state", "requestedAt");

-- CreateIndex
CREATE INDEX "restricted_data_task_accountId_kind_requestedAt_idx" ON "restricted_data_task"("accountId", "kind", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "restricted_data_task_expiresAt_idx" ON "restricted_data_task"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_data_task_accountId_kind_scope_targetKey_activeS_key" ON "restricted_data_task"("accountId", "kind", "scope", "targetKey", "activeSlot");

-- CreateIndex
CREATE INDEX "restricted_deletion_guard_taskRef_idx" ON "restricted_deletion_guard"("taskRef");

-- CreateIndex
CREATE INDEX "restricted_deletion_guard_expiresAt_idx" ON "restricted_deletion_guard"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_deletion_guard_accountId_scope_targetKey_key" ON "restricted_deletion_guard"("accountId", "scope", "targetKey");

-- CreateIndex
CREATE INDEX "restricted_deletion_step_checkpoint_state_updatedAt_idx" ON "restricted_deletion_step_checkpoint"("state", "updatedAt");

-- CreateIndex
CREATE INDEX "restricted_deletion_step_checkpoint_expiresAt_idx" ON "restricted_deletion_step_checkpoint"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_deletion_step_checkpoint_taskId_subsystemCode_key" ON "restricted_deletion_step_checkpoint"("taskId", "subsystemCode");

-- CreateIndex
CREATE INDEX "restricted_day_erasure_guard_deletionTaskRef_idx" ON "restricted_day_erasure_guard"("deletionTaskRef");

-- CreateIndex
CREATE INDEX "restricted_day_erasure_guard_expiresAt_idx" ON "restricted_day_erasure_guard"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_day_erasure_guard_ownerScopeToken_productDate_key" ON "restricted_day_erasure_guard"("ownerScopeToken", "productDate");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_deletion_receipt_caseRef_key" ON "restricted_deletion_receipt"("caseRef");

-- CreateIndex
CREATE INDEX "restricted_deletion_receipt_taskRef_idx" ON "restricted_deletion_receipt"("taskRef");

-- CreateIndex
CREATE INDEX "restricted_deletion_receipt_blindedSubjectToken_idx" ON "restricted_deletion_receipt"("blindedSubjectToken");

-- CreateIndex
CREATE INDEX "restricted_deletion_receipt_expiresAt_idx" ON "restricted_deletion_receipt"("expiresAt");

-- CreateIndex
CREATE INDEX "restricted_provider_deletion_request_state_providerExpiryAt_idx" ON "restricted_provider_deletion_request"("state", "providerExpiryAt");

-- CreateIndex
CREATE INDEX "restricted_provider_deletion_request_expiresAt_idx" ON "restricted_provider_deletion_request"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_provider_deletion_request_taskRef_providerProfil_key" ON "restricted_provider_deletion_request"("taskRef", "providerProfileVersion");

-- CreateIndex
CREATE UNIQUE INDEX "system_backup_catalog_entry_generationCode_key" ON "system_backup_catalog_entry"("generationCode");

-- CreateIndex
CREATE INDEX "system_backup_catalog_entry_state_expiresAt_idx" ON "system_backup_catalog_entry"("state", "expiresAt");

-- CreateIndex
CREATE INDEX "restricted_restore_deny_record_blindedSubjectToken_scope_idx" ON "restricted_restore_deny_record"("blindedSubjectToken", "scope");

-- CreateIndex
CREATE INDEX "restricted_restore_deny_record_expiresAt_idx" ON "restricted_restore_deny_record"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_restore_deny_record_caseRef_scope_deletionEpoch_key" ON "restricted_restore_deny_record"("caseRef", "scope", "deletionEpoch");

-- CreateIndex
CREATE INDEX "system_retention_policy_entry_state_dataTypeCode_idx" ON "system_retention_policy_entry"("state", "dataTypeCode");

-- CreateIndex
CREATE UNIQUE INDEX "system_retention_policy_entry_policyVersion_dataTypeCode_key" ON "system_retention_policy_entry"("policyVersion", "dataTypeCode");

-- CreateIndex
CREATE UNIQUE INDEX "system_provider_data_handling_profile_profileVersion_key" ON "system_provider_data_handling_profile"("profileVersion");

-- CreateIndex
CREATE INDEX "system_provider_data_handling_profile_providerCode_state_idx" ON "system_provider_data_handling_profile"("providerCode", "state");

-- CreateIndex
CREATE UNIQUE INDEX "restricted_legal_hold_holdRef_key" ON "restricted_legal_hold"("holdRef");

-- CreateIndex
CREATE INDEX "restricted_legal_hold_state_reviewDueAt_idx" ON "restricted_legal_hold"("state", "reviewDueAt");

-- CreateIndex
CREATE INDEX "restricted_legal_hold_blindedSubjectToken_idx" ON "restricted_legal_hold"("blindedSubjectToken");

-- CreateIndex
CREATE INDEX "restricted_legal_hold_expiresAt_idx" ON "restricted_legal_hold"("expiresAt");

-- CreateIndex
CREATE INDEX "restricted_audit_event_actionCode_requestedAt_idx" ON "restricted_audit_event"("actionCode", "requestedAt");

-- CreateIndex
CREATE INDEX "restricted_audit_event_opaqueObjectToken_idx" ON "restricted_audit_event"("opaqueObjectToken");

-- CreateIndex
CREATE INDEX "restricted_audit_event_expiresAt_idx" ON "restricted_audit_event"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_outbox_event_idempotencyKey_key" ON "runtime_outbox_event"("idempotencyKey");

-- CreateIndex
CREATE INDEX "runtime_outbox_event_state_availableAt_idx" ON "runtime_outbox_event"("state", "availableAt");

-- CreateIndex
CREATE INDEX "runtime_outbox_event_aggregateType_aggregateRef_aggregateRe_idx" ON "runtime_outbox_event"("aggregateType", "aggregateRef", "aggregateRevision");

-- CreateIndex
CREATE INDEX "runtime_outbox_event_expiresAt_idx" ON "runtime_outbox_event"("expiresAt");

-- CreateIndex
CREATE INDEX "runtime_inbox_receipt_expiresAt_idx" ON "runtime_inbox_receipt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_inbox_receipt_consumerCode_eventId_key" ON "runtime_inbox_receipt"("consumerCode", "eventId");

-- CreateIndex
CREATE INDEX "system_version_catalog_entry_catalogType_state_idx" ON "system_version_catalog_entry"("catalogType", "state");

-- CreateIndex
CREATE UNIQUE INDEX "system_version_catalog_entry_catalogType_version_key" ON "system_version_catalog_entry"("catalogType", "version");

-- CreateIndex
CREATE INDEX "evaluation_run_corpusFingerprint_codeCommit_idx" ON "evaluation_run"("corpusFingerprint", "codeCommit");

-- CreateIndex
CREATE INDEX "evaluation_run_expiresAt_idx" ON "evaluation_run"("expiresAt");

-- CreateIndex
CREATE INDEX "evaluation_sample_expiresAt_idx" ON "evaluation_sample"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_sample_runId_caseId_sampleOrdinal_key" ON "evaluation_sample"("runId", "caseId", "sampleOrdinal");



-- DailyEnergy E-006 reviewed PostgreSQL additions.
-- All objects are intentionally kept in one application schema.
SET search_path TO "daily_energy", pg_catalog;

-- SQL-001: revisions are positive; epochs, ordinals, and attempt counters are non-negative.
DO $sql001$
DECLARE r record; constraint_name text;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'daily_energy'
      AND (column_name = 'revision' OR column_name LIKE '%Revision' OR column_name LIKE '%revision')
      AND data_type IN ('smallint', 'integer', 'bigint')
  LOOP
    constraint_name := left(r.table_name || '_' || r.column_name || '_positive_ck', 63);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (%I >= 1)', 'daily_energy', r.table_name, constraint_name, r.column_name);
  END LOOP;

  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'daily_energy'
      AND (
        column_name ILIKE '%epoch' OR column_name ILIKE '%ordinal' OR
        column_name ILIKE '%attemptcount' OR column_name IN ('inputTokens', 'outputTokens', 'costMicros', 'sampleOrdinal')
      )
      AND data_type IN ('smallint', 'integer', 'bigint')
  LOOP
    constraint_name := left(r.table_name || '_' || r.column_name || '_nonnegative_ck', 63);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (%I >= 0)', 'daily_energy', r.table_name, constraint_name, r.column_name);
  END LOOP;
END
$sql001$;

-- SQL-002: every retention row has a non-inverted retention interval.
DO $sql002$
DECLARE r record; constraint_name text;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'daily_energy' AND column_name = 'retentionAnchorAt'
    INTERSECT
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'daily_energy' AND column_name = 'expiresAt'
  LOOP
    constraint_name := left(r.table_name || '_retention_interval_ck', 63);
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (%I IS NULL OR %I <= %I)',
      'daily_energy', r.table_name, constraint_name, 'expiresAt', 'retentionAnchorAt', 'expiresAt'
    );
  END LOOP;
END
$sql002$;

-- SQL-003: nullable ciphertext/key pairs are atomic and all ciphertext/key values are non-empty.
DO $sql003$
DECLARE
  r record;
  key_column text;
  constraint_name text;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'daily_energy' AND column_name ILIKE '%ciphertext'
  LOOP
    SELECT c.column_name INTO key_column
    FROM information_schema.columns c
    WHERE c.table_schema = 'daily_energy' AND c.table_name = r.table_name
      AND c.column_name IN (
        regexp_replace(r.column_name, 'Ciphertext$', 'KeyVersion'),
        regexp_replace(r.column_name, 'Ciphertext$', 'keyVersion'),
        'keyVersion', 'payloadKeyVersion', 'responseKeyVersion', 'stableSubjectKeyVersion'
      )
    ORDER BY CASE WHEN c.column_name = regexp_replace(r.column_name, 'Ciphertext$', 'KeyVersion') THEN 0 ELSE 1 END
    LIMIT 1;

    IF key_column IS NULL THEN
      RAISE EXCEPTION 'SQL-003 missing key-version pair for %.%', r.table_name, r.column_name;
    END IF;

    constraint_name := left(r.table_name || '_' || r.column_name || '_key_pair_ck', 63);
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (((%I IS NULL) = (%I IS NULL)) AND (%I IS NULL OR octet_length(%I) > 0) AND (%I IS NULL OR btrim(%I) <> ''''))',
      'daily_energy', r.table_name, constraint_name,
      r.column_name, key_column, r.column_name, r.column_name, key_column, key_column
    );
  END LOOP;
END
$sql003$;

-- SQL-004: consent status and timestamps form one valid state.
ALTER TABLE "daily_energy"."app_necessary_consent_record"
  ADD CONSTRAINT "app_necessary_consent_state_ck" CHECK (
    ("status" = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "withdrawnAt" IS NULL) OR
    ("status" = 'WITHDRAWN' AND "acceptedAt" IS NOT NULL AND "withdrawnAt" IS NOT NULL AND "withdrawnAt" >= "acceptedAt")
  );

-- SQL-005: an invocation has exactly one workload-compatible parent.
ALTER TABLE "daily_energy"."runtime_gateway_invocation"
  ADD CONSTRAINT "runtime_gateway_invocation_parent_ck" CHECK (
    ("workload" = 'DAILY' AND "generationIntentId" IS NOT NULL AND "weeklySummaryIntentId" IS NULL) OR
    ("workload" = 'WEEKLY' AND "generationIntentId" IS NULL AND "weeklySummaryIntentId" IS NOT NULL)
  );

-- SQL-006: only a succeeded generation intent may reference a published result.
ALTER TABLE "daily_energy"."app_generation_intent"
  ADD CONSTRAINT "app_generation_intent_publication_ck" CHECK (
    ("state" = 'SUCCEEDED' AND "publishedResultRef" IS NOT NULL) OR
    ("state" <> 'SUCCEEDED' AND "publishedResultRef" IS NULL)
  );

-- Shared helper for deferred cross-table assertions (SQL-007, SQL-012, SQL-013, SQL-014).
CREATE OR REPLACE FUNCTION "daily_energy"."raise_integrity"(code text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = code;
END
$$;
REVOKE ALL ON FUNCTION "daily_energy"."raise_integrity"(text) FROM PUBLIC;

-- SQL-007: published daily facts and interactions must agree on owner/date/version.
CREATE OR REPLACE FUNCTION "daily_energy"."check_daily_publication_consistency"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE intent_row record; snapshot_row record; result_row record;
BEGIN
  IF TG_TABLE_NAME = 'app_published_daily_result' THEN
    SELECT * INTO intent_row FROM app_generation_intent WHERE id = NEW."generationIntentId";
    SELECT * INTO snapshot_row FROM app_generation_input_snapshot WHERE id = NEW."inputSnapshotId";
    IF intent_row.id IS NULL OR snapshot_row.id IS NULL OR
       intent_row."accountId" <> NEW."accountId" OR intent_row."targetProductDate" <> NEW."productDate" OR
       intent_row."resultVersion" <> NEW."resultVersion" OR snapshot_row."generationIntentId" <> intent_row.id THEN
      PERFORM raise_integrity('SQL-007');
    END IF;
  ELSE
    SELECT * INTO result_row FROM app_published_daily_result WHERE id = NEW."resultId";
    IF result_row.id IS NULL OR result_row."accountId" <> NEW."accountId" OR result_row."productDate" <> NEW."productDate" THEN
      PERFORM raise_integrity('SQL-007');
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE CONSTRAINT TRIGGER "sql_007_daily_result_consistency"
AFTER INSERT OR UPDATE ON "daily_energy"."app_published_daily_result"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_daily_publication_consistency"();
CREATE CONSTRAINT TRIGGER "sql_007_interaction_consistency"
AFTER INSERT OR UPDATE ON "daily_energy"."app_daily_interaction"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_daily_publication_consistency"();

-- SQL-008: published results, snapshots, and catalog facts are immutable.
CREATE OR REPLACE FUNCTION "daily_energy"."reject_immutable_change"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SQL-008';
END
$$;
DO $sql008$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'app_generation_input_snapshot', 'app_published_daily_result',
    'app_published_weekly_summary_revision', 'system_retention_policy_entry',
    'system_safety_resource_entry', 'system_version_catalog_entry'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION %I.%I()',
      left('sql_008_' || table_name || '_immutable', 63), 'daily_energy', table_name,
      'daily_energy', 'reject_immutable_change'
    );
  END LOOP;
END
$sql008$;

-- SQL-009: relationship active slot is true only for ACTIVE cycles and null for closed cycles.
ALTER TABLE "daily_energy"."app_relationship_cycle"
  ADD CONSTRAINT "app_relationship_cycle_active_slot_ck" CHECK (
    ("state" = 'ACTIVE' AND "activeSlot" IS TRUE AND "closedAt" IS NULL) OR
    ("state" = 'CLOSED_BY_DELETION' AND "activeSlot" IS NULL AND "closedAt" IS NOT NULL)
  );

-- SQL-010: failed deletion/export tasks remain blocking; only success releases the active slot.
ALTER TABLE "daily_energy"."restricted_data_task"
  ADD CONSTRAINT "restricted_data_task_active_slot_ck" CHECK (
    ("state" IN ('QUEUED', 'RUNNING', 'FAILED') AND "activeSlot" IS TRUE) OR
    ("state" = 'SUCCEEDED' AND "activeSlot" IS NULL)
  );

-- SQL-011: deletion task timestamps are monotonic and success has erasure/deadline evidence.
ALTER TABLE "daily_energy"."restricted_data_task"
  ADD CONSTRAINT "restricted_data_task_timeline_ck" CHECK (
    ("guardedAt" IS NULL OR "guardedAt" >= "requestedAt") AND
    ("startedAt" IS NULL OR ("guardedAt" IS NOT NULL AND "startedAt" >= "guardedAt")) AND
    ("onlineErasedAt" IS NULL OR ("startedAt" IS NOT NULL AND "onlineErasedAt" >= "startedAt")) AND
    ("finishedAt" IS NULL OR ("startedAt" IS NOT NULL AND "finishedAt" >= "startedAt")) AND
    ("state" <> 'SUCCEEDED' OR ("onlineErasedAt" IS NOT NULL AND "backupPurgeDeadline" IS NOT NULL AND "finishedAt" IS NOT NULL))
  );

-- SQL-012: a weekly current pointer names a complete summary for the same window/fingerprint.
CREATE OR REPLACE FUNCTION "daily_energy"."check_weekly_current_summary"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE summary_row record;
BEGIN
  IF NEW."currentSummaryRef" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO summary_row FROM app_published_weekly_summary_revision WHERE id = NEW."currentSummaryRef";
  IF summary_row.id IS NULL OR summary_row."windowId" <> NEW.id OR
     NEW."currentSourceFingerprint" IS NULL OR summary_row."sourceFingerprint" <> NEW."currentSourceFingerprint" THEN
    PERFORM raise_integrity('SQL-012');
  END IF;
  RETURN NEW;
END
$$;
CREATE CONSTRAINT TRIGGER "sql_012_weekly_current_summary"
AFTER INSERT OR UPDATE ON "daily_energy"."app_weekly_window"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_weekly_current_summary"();

-- SQL-013: every published slot has a personalized fragment or a prevalidated fallback unless blocked.
CREATE OR REPLACE FUNCTION "daily_energy"."check_daily_content_slot"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE visibility_state "ContentDisplayState"; fragment_exists boolean;
BEGIN
  SELECT v.state INTO visibility_state
  FROM app_published_result_visibility v WHERE v."resultId" = NEW."resultId";
  SELECT EXISTS(SELECT 1 FROM app_personalized_content_fragment f WHERE f."slotId" = NEW.id) INTO fragment_exists;
  IF NOT fragment_exists AND (NEW."fallbackPayload" IS NULL OR NEW."fallbackFingerprint" IS NULL OR NEW."fallbackSchemaVersion" IS NULL)
     AND visibility_state IS DISTINCT FROM 'BLOCKED' THEN
    PERFORM raise_integrity('SQL-013');
  END IF;
  RETURN NEW;
END
$$;
CREATE OR REPLACE FUNCTION "daily_energy"."check_weekly_content_slot"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE fragment_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM app_weekly_personalized_content_fragment f WHERE f."slotId" = NEW.id) INTO fragment_exists;
  IF NOT fragment_exists AND (NEW."fallbackPayload" IS NULL OR NEW."fallbackFingerprint" IS NULL) THEN
    PERFORM raise_integrity('SQL-013');
  END IF;
  RETURN NEW;
END
$$;
CREATE CONSTRAINT TRIGGER "sql_013_daily_content_slot"
AFTER INSERT OR UPDATE ON "daily_energy"."app_result_content_slot"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_daily_content_slot"();
CREATE CONSTRAINT TRIGGER "sql_013_weekly_content_slot"
AFTER INSERT OR UPDATE ON "daily_energy"."app_weekly_content_slot"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_weekly_content_slot"();

-- SQL-014: Safety state revision/epoch are monotonic and dependent rows cannot cross owner/revision.
CREATE OR REPLACE FUNCTION "daily_energy"."check_safety_state_monotonic"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."revision" < OLD."revision" OR NEW."guardEpoch" < OLD."guardEpoch" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SQL-014';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER "sql_014_safety_state_monotonic"
BEFORE UPDATE ON "daily_energy"."restricted_safety_state"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_safety_state_monotonic"();
CREATE OR REPLACE FUNCTION "daily_energy"."check_safety_child"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE state_row record;
BEGIN
  SELECT * INTO state_row FROM restricted_safety_state WHERE "accountId" = NEW."accountId";
  IF state_row.id IS NULL OR NEW."stateRevision" > state_row.revision THEN
    PERFORM raise_integrity('SQL-014');
  END IF;
  IF TG_TABLE_NAME = 'restricted_safety_event' AND
     ((to_jsonb(NEW) ->> 'guardEpoch')::bigint > state_row."guardEpoch") THEN
    PERFORM raise_integrity('SQL-014');
  END IF;
  RETURN NEW;
END
$$;
CREATE CONSTRAINT TRIGGER "sql_014_safety_event_parent"
AFTER INSERT OR UPDATE ON "daily_energy"."restricted_safety_event"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_safety_child"();
CREATE CONSTRAINT TRIGGER "sql_014_safety_plan_parent"
AFTER INSERT OR UPDATE ON "daily_energy"."restricted_safety_response_plan"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_safety_child"();

-- SQL-015: SENT requires a dispatch claim and terminal states never return to SCHEDULED.
ALTER TABLE "daily_energy"."app_notification_intent"
  ADD CONSTRAINT "app_notification_intent_claim_ck" CHECK (
    "state" <> 'SENT' OR ("dispatchClaimToken" IS NOT NULL AND "terminalAt" IS NOT NULL)
  );
CREATE UNIQUE INDEX "app_notification_intent_dispatch_claim_key"
  ON "daily_energy"."app_notification_intent" ("dispatchClaimToken") WHERE "dispatchClaimToken" IS NOT NULL;
CREATE OR REPLACE FUNCTION "daily_energy"."check_notification_transition"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" IN ('CANCELLED', 'SUPPRESSED', 'SENT', 'OPENED', 'EXPIRED') AND NEW."state" = 'SCHEDULED' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SQL-015';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER "sql_015_notification_transition"
BEFORE UPDATE ON "daily_energy"."app_notification_intent"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_notification_transition"();

-- SQL-016: ACTIVE provider profiles are training-off, <=30-day, evidence-complete profiles.
ALTER TABLE "daily_energy"."system_provider_data_handling_profile"
  ADD CONSTRAINT "system_provider_active_profile_ck" CHECK (
    "state" <> 'ACTIVE' OR (
      "trainingEnabled" IS FALSE AND "onlineRetentionDays" BETWEEN 0 AND 30 AND
      "backupRetentionDays" >= 0 AND btrim("regionCode") <> '' AND
      jsonb_typeof("subprocessors") IS NOT NULL AND cardinality("deletionCapabilities") > 0 AND
      btrim("contractEvidenceRef") <> '' AND btrim("disclosureVersion") <> ''
    )
  );

-- SQL-017: backup and day-erasure guards have hard maximum lifetimes.
ALTER TABLE "daily_energy"."system_backup_catalog_entry"
  ADD CONSTRAINT "system_backup_max_35_days_ck" CHECK ("expiresAt" <= "createdAt" + interval '35 days');
ALTER TABLE "daily_energy"."restricted_day_erasure_guard"
  ADD CONSTRAINT "restricted_day_guard_max_45_days_ck" CHECK ("expiresAt" <= "createdAt" + interval '45 days');

-- SQL-018: legal holds are reviewed within 90 days and expose cleanup within 72 hours after release/end.
ALTER TABLE "daily_energy"."restricted_legal_hold"
  ADD CONSTRAINT "restricted_legal_hold_timeline_ck" CHECK (
    "reviewDueAt" >= "startedAt" AND "reviewDueAt" <= "startedAt" + interval '90 days' AND
    "endsAt" >= "startedAt" AND ("releasedAt" IS NULL OR "releasedAt" >= "startedAt") AND
    "expiresAt" <= COALESCE("releasedAt", "endsAt") + interval '72 hours'
  );

-- SQL-019: ACCOUNT deletion receipts are de-identified and contain no target identity.
ALTER TABLE "daily_energy"."restricted_deletion_receipt"
  ADD CONSTRAINT "restricted_account_receipt_deidentified_ck" CHECK (
    "scope" <> 'ACCOUNT' OR ("blindedSubjectToken" IS NULL AND "targetType" = 'ACCOUNT')
  );

-- SQL-020: least-privilege role/grant baseline for runtime profiles.
DO $roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'daily_energy_api', 'daily_energy_interactive', 'daily_energy_background',
    'daily_energy_restricted', 'daily_energy_migration', 'daily_energy_test'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', role_name);
    END IF;
  END LOOP;
END
$roles$;

REVOKE ALL ON SCHEMA "daily_energy" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "daily_energy" FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "daily_energy" FROM PUBLIC;
GRANT USAGE ON SCHEMA "daily_energy" TO "daily_energy_api", "daily_energy_interactive", "daily_energy_background", "daily_energy_restricted", "daily_energy_test";
GRANT ALL ON SCHEMA "daily_energy" TO "daily_energy_migration";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "daily_energy" TO "daily_energy_migration";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "daily_energy" TO "daily_energy_migration";

-- API: ordinary application facts and redacted runtime/system metadata; no restricted/evaluation tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "daily_energy" TO "daily_energy_api";
REVOKE ALL ON TABLE
  "daily_energy"."restricted_safety_state", "daily_energy"."restricted_safety_decision",
  "daily_energy"."restricted_safety_event", "daily_energy"."restricted_safety_response_plan",
  "daily_energy"."restricted_recovery_command_receipt", "daily_energy"."restricted_data_task",
  "daily_energy"."restricted_deletion_guard", "daily_energy"."restricted_deletion_step_checkpoint",
  "daily_energy"."restricted_day_erasure_guard", "daily_energy"."restricted_deletion_receipt",
  "daily_energy"."restricted_provider_deletion_request", "daily_energy"."restricted_restore_deny_record",
  "daily_energy"."restricted_legal_hold", "daily_energy"."restricted_audit_event",
  "daily_energy"."evaluation_run", "daily_energy"."evaluation_sample"
FROM "daily_energy_api";

-- Ciphertext-bearing tables are not directly readable by the ordinary API role.
DO $cipher_grants$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema = 'daily_energy' AND column_name ILIKE '%ciphertext'
  LOOP
    EXECUTE format('REVOKE SELECT ON TABLE %I.%I FROM %I', 'daily_energy', r.table_name, 'daily_energy_api');
  END LOOP;
END
$cipher_grants$;

-- Interactive/background workers share ordinary processing data but not restricted evidence.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "daily_energy" TO "daily_energy_interactive", "daily_energy_background";
DO $worker_revoke$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'daily_energy' AND (tablename LIKE 'restricted_%' OR tablename LIKE 'evaluation_%')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I, %I', 'daily_energy', r.tablename, 'daily_energy_interactive', 'daily_energy_background');
  END LOOP;
END
$worker_revoke$;

-- Restricted worker receives deletion/Safety data and the minimum application facts needed to erase by ref.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "daily_energy" TO "daily_energy_restricted";
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA "daily_energy" FROM
  "daily_energy_api", "daily_energy_interactive", "daily_energy_background", "daily_energy_restricted", "daily_energy_test";

-- Test role can exercise synthetic fixtures but cannot create roles/databases or bypass immutable triggers.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "daily_energy" TO "daily_energy_test";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "daily_energy" TO "daily_energy_test";

-- Immutable facts cannot be updated/deleted by ordinary runtime roles even if a broad future grant is added.
REVOKE UPDATE, DELETE ON TABLE
  "daily_energy"."app_generation_input_snapshot", "daily_energy"."app_published_daily_result",
  "daily_energy"."app_published_weekly_summary_revision", "daily_energy"."system_retention_policy_entry",
  "daily_energy"."system_safety_resource_entry", "daily_energy"."system_version_catalog_entry"
FROM "daily_energy_api", "daily_energy_interactive", "daily_energy_background", "daily_energy_restricted", "daily_energy_test";

ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA "daily_energy" REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA "daily_energy" REVOKE ALL ON SEQUENCES FROM PUBLIC;

COMMENT ON SCHEMA "daily_energy" IS 'DailyEnergy single application schema; E-006 PostgreSQL 18 baseline';


-- AddForeignKey
ALTER TABLE "app_external_identity" ADD CONSTRAINT "app_external_identity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_session_credential" ADD CONSTRAINT "app_session_credential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_necessary_consent_record" ADD CONSTRAINT "app_necessary_consent_record_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user_profile" ADD CONSTRAINT "app_user_profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user_profile_revision" ADD CONSTRAINT "app_user_profile_revision_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "app_user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_onboarding_completion" ADD CONSTRAINT "app_onboarding_completion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_onboarding_completion" ADD CONSTRAINT "app_onboarding_completion_consentRecordId_fkey" FOREIGN KEY ("consentRecordId") REFERENCES "app_necessary_consent_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_view_continuation_grant" ADD CONSTRAINT "app_view_continuation_grant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_view_continuation_grant" ADD CONSTRAINT "app_view_continuation_grant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "app_session_credential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_command_receipt" ADD CONSTRAINT "runtime_command_receipt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_morning_checkin" ADD CONSTRAINT "app_morning_checkin_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_morning_checkin_revision" ADD CONSTRAINT "app_morning_checkin_revision_checkinId_fkey" FOREIGN KEY ("checkinId") REFERENCES "app_morning_checkin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_generation_intent" ADD CONSTRAINT "app_generation_intent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_generation_input_snapshot" ADD CONSTRAINT "app_generation_input_snapshot_generationIntentId_fkey" FOREIGN KEY ("generationIntentId") REFERENCES "app_generation_intent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_generation_input_snapshot" ADD CONSTRAINT "app_generation_input_snapshot_checkinId_fkey" FOREIGN KEY ("checkinId") REFERENCES "app_morning_checkin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_gateway_invocation" ADD CONSTRAINT "runtime_gateway_invocation_generationIntentId_fkey" FOREIGN KEY ("generationIntentId") REFERENCES "app_generation_intent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_gateway_invocation" ADD CONSTRAINT "runtime_gateway_invocation_weeklySummaryIntentId_fkey" FOREIGN KEY ("weeklySummaryIntentId") REFERENCES "app_weekly_summary_intent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_gateway_attempt" ADD CONSTRAINT "runtime_gateway_attempt_invocationId_fkey" FOREIGN KEY ("invocationId") REFERENCES "runtime_gateway_invocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_gateway_candidate" ADD CONSTRAINT "runtime_gateway_candidate_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "runtime_gateway_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_published_daily_result" ADD CONSTRAINT "app_published_daily_result_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_published_daily_result" ADD CONSTRAINT "app_published_daily_result_generationIntentId_fkey" FOREIGN KEY ("generationIntentId") REFERENCES "app_generation_intent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_published_daily_result" ADD CONSTRAINT "app_published_daily_result_inputSnapshotId_fkey" FOREIGN KEY ("inputSnapshotId") REFERENCES "app_generation_input_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_published_result_visibility" ADD CONSTRAINT "app_published_result_visibility_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "app_published_daily_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_result_content_slot" ADD CONSTRAINT "app_result_content_slot_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "app_published_daily_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_personalized_content_fragment" ADD CONSTRAINT "app_personalized_content_fragment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "app_result_content_slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_source_dependency" ADD CONSTRAINT "app_source_dependency_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "app_personalized_content_fragment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_daily_interaction" ADD CONSTRAINT "app_daily_interaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_daily_interaction" ADD CONSTRAINT "app_daily_interaction_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "app_published_daily_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_daily_light_fact" ADD CONSTRAINT "app_daily_light_fact_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "app_daily_interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_daily_task_state" ADD CONSTRAINT "app_daily_task_state_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "app_daily_interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_daily_helpfulness_record" ADD CONSTRAINT "app_daily_helpfulness_record_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "app_daily_interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_evening_feedback_record" ADD CONSTRAINT "app_evening_feedback_record_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "app_daily_interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_evening_feedback_revision" ADD CONSTRAINT "app_evening_feedback_revision_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "app_evening_feedback_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_relationship_cycle" ADD CONSTRAINT "app_relationship_cycle_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_relationship_encounter_link" ADD CONSTRAINT "app_relationship_encounter_link_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "app_relationship_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_relationship_encounter_link" ADD CONSTRAINT "app_relationship_encounter_link_sourceLightId_fkey" FOREIGN KEY ("sourceLightId") REFERENCES "app_daily_light_fact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_relationship_node_receipt" ADD CONSTRAINT "app_relationship_node_receipt_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "app_relationship_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_important_matter" ADD CONSTRAINT "app_important_matter_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_important_matter_revision" ADD CONSTRAINT "app_important_matter_revision_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "app_important_matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_memory_purpose_grant" ADD CONSTRAINT "app_memory_purpose_grant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_memory_master_preference" ADD CONSTRAINT "app_memory_master_preference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_memory_mention_receipt" ADD CONSTRAINT "app_memory_mention_receipt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_memory_mention_receipt" ADD CONSTRAINT "app_memory_mention_receipt_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "app_published_daily_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_memory_context_snapshot" ADD CONSTRAINT "app_memory_context_snapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_memory_context_snapshot" ADD CONSTRAINT "app_memory_context_snapshot_invocationId_fkey" FOREIGN KEY ("invocationId") REFERENCES "runtime_gateway_invocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_weekly_window" ADD CONSTRAINT "app_weekly_window_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_weekly_source_snapshot" ADD CONSTRAINT "app_weekly_source_snapshot_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "app_weekly_window"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_weekly_summary_intent" ADD CONSTRAINT "app_weekly_summary_intent_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "app_weekly_window"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_published_weekly_summary_revision" ADD CONSTRAINT "app_published_weekly_summary_revision_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "app_weekly_window"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_published_weekly_summary_revision" ADD CONSTRAINT "app_published_weekly_summary_revision_summaryIntentId_fkey" FOREIGN KEY ("summaryIntentId") REFERENCES "app_weekly_summary_intent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_weekly_content_slot" ADD CONSTRAINT "app_weekly_content_slot_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "app_published_weekly_summary_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_weekly_personalized_content_fragment" ADD CONSTRAINT "app_weekly_personalized_content_fragment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "app_weekly_content_slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_weekly_source_dependency" ADD CONSTRAINT "app_weekly_source_dependency_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "app_weekly_personalized_content_fragment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_safety_state" ADD CONSTRAINT "restricted_safety_state_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_safety_decision" ADD CONSTRAINT "restricted_safety_decision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_safety_event" ADD CONSTRAINT "restricted_safety_event_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_safety_response_plan" ADD CONSTRAINT "restricted_safety_response_plan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_recovery_command_receipt" ADD CONSTRAINT "restricted_recovery_command_receipt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notification_preference" ADD CONSTRAINT "app_notification_preference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_platform_permission_snapshot" ADD CONSTRAINT "app_platform_permission_snapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notification_intent" ADD CONSTRAINT "app_notification_intent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_notification_delivery_attempt" ADD CONSTRAINT "runtime_notification_delivery_attempt_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "app_notification_intent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_data_task" ADD CONSTRAINT "restricted_data_task_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_deletion_guard" ADD CONSTRAINT "restricted_deletion_guard_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_deletion_step_checkpoint" ADD CONSTRAINT "restricted_deletion_step_checkpoint_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "restricted_data_task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_sample" ADD CONSTRAINT "evaluation_sample_runId_fkey" FOREIGN KEY ("runId") REFERENCES "evaluation_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
