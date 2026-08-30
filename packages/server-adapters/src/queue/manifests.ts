import type {
  HandlerCapability,
  QueueFamily,
  WorkerCapabilityManifest,
  WorkerProfile,
} from "./contracts.js";
import { handlerKey } from "./contracts.js";

function capability(
  eventType: string,
  consumerCode: string,
): HandlerCapability {
  return Object.freeze({ consumerCode, eventType, eventVersion: "v1" });
}

function manifest(value: WorkerCapabilityManifest): WorkerCapabilityManifest {
  return Object.freeze({
    ...value,
    egressAllowlist: Object.freeze([...value.egressAllowlist].sort()),
    handlers: Object.freeze([...value.handlers]),
  });
}

export const INTERACTIVE_WORKER_MANIFEST = manifest({
  contractVersion: 1,
  databaseRole: "daily_energy_interactive",
  egressAllowlist: ["ai.daily", "postgresql", "redis"],
  handlers: [
    capability("GenerationIntentAccepted", "interactive-generation"),
    capability("GenerationIntentDue", "interactive-generation"),
    capability("GenerationRecoveryRequested", "interactive-recovery"),
  ],
  profile: "worker-interactive",
  queueFamily: "interactive",
  queueName: "interactive-v1",
  queueVersion: 1,
  redisMajorVersion: 8,
});

export const BACKGROUND_WORKER_MANIFEST = manifest({
  contractVersion: 1,
  databaseRole: "daily_energy_background",
  egressAllowlist: ["ai.weekly", "postgresql", "redis", "wechat.notification"],
  handlers: [
    capability("CheckinCorrected", "background-projection"),
    capability("DailyResultPublished", "background-projection"),
    capability("DayLit", "background-relationship"),
    capability("NotificationIntentChanged", "background-notification"),
    capability("NotificationIntentDue", "background-notification"),
    capability("SafetyActivated", "background-suppression"),
    capability("WeeklySourceChanged", "background-weekly"),
    capability("WeeklySummaryDue", "background-weekly-summary"),
  ],
  profile: "worker-background",
  queueFamily: "background",
  queueName: "background-v1",
  queueVersion: 1,
  redisMajorVersion: 8,
});

export const RESTRICTED_WORKER_MANIFEST = manifest({
  contractVersion: 1,
  databaseRole: "daily_energy_deletion",
  egressAllowlist: [
    "object.cleanup",
    "postgresql",
    "provider.deletion",
    "redis",
  ],
  handlers: [
    capability("DataDeletionStarted", "restricted-data-task"),
    capability("DataTaskDue", "restricted-data-task"),
    capability("DataRightsRetentionDue", "restricted-data-task"),
    capability("DeletionGuarded", "restricted-data-task"),
  ],
  profile: "worker-restricted",
  queueFamily: "restricted",
  queueName: "restricted-v1",
  queueVersion: 1,
  redisMajorVersion: 8,
});

export const WORKER_MANIFESTS = Object.freeze({
  "worker-background": BACKGROUND_WORKER_MANIFEST,
  "worker-interactive": INTERACTIVE_WORKER_MANIFEST,
  "worker-restricted": RESTRICTED_WORKER_MANIFEST,
} satisfies Record<WorkerProfile, WorkerCapabilityManifest>);

export function routeForEvent(
  eventType: string,
  eventVersion: string,
  manifests: Readonly<
    Record<WorkerProfile, WorkerCapabilityManifest>
  > = WORKER_MANIFESTS,
): { capability: HandlerCapability; queueFamily: QueueFamily } | undefined {
  const key = handlerKey(eventType, eventVersion);
  for (const workerManifest of Object.values(manifests)) {
    const handler = workerManifest.handlers.find(
      (candidate) =>
        handlerKey(candidate.eventType, candidate.eventVersion) === key,
    );
    if (handler) {
      return { capability: handler, queueFamily: workerManifest.queueFamily };
    }
  }
  return undefined;
}
