import { MiniappPlatformError } from "../errors.js";
import type {
  SubscriptionDecision,
  SubscriptionPort,
  SubscriptionResult,
} from "../ports.js";
import type { WechatRuntime, WechatSubscriptionSuccess } from "./runtime.js";

const templateIdPattern = /^[a-zA-Z0-9_-]{1,128}$/u;
const acceptedDecisions = new Set<SubscriptionDecision>([
  "accept",
  "ban",
  "filter",
  "reject",
]);

function normalizeDecision(value: string | undefined): SubscriptionDecision {
  if (
    value !== undefined &&
    acceptedDecisions.has(value as SubscriptionDecision)
  ) {
    return value as SubscriptionDecision;
  }
  return "unknown";
}

function normalizeResult(
  templateIds: readonly string[],
  result: WechatSubscriptionSuccess,
): SubscriptionResult {
  const decisions: Record<string, SubscriptionDecision> = {};
  for (const templateId of templateIds) {
    decisions[templateId] = normalizeDecision(result[templateId]);
  }
  return Object.freeze({
    decisions: Object.freeze(decisions),
  });
}

export function createWechatSubscriptionPort(
  runtime: WechatRuntime,
): SubscriptionPort {
  return Object.freeze({
    request(templateIds: readonly string[]): Promise<SubscriptionResult> {
      const uniqueTemplateIds = [...new Set(templateIds)];
      if (
        uniqueTemplateIds.length === 0 ||
        uniqueTemplateIds.length > 3 ||
        uniqueTemplateIds.length !== templateIds.length ||
        uniqueTemplateIds.some(
          (templateId) => !templateIdPattern.test(templateId),
        )
      ) {
        throw new MiniappPlatformError("SUBSCRIPTION_REQUEST_INVALID");
      }

      return new Promise((resolve, reject) => {
        runtime.requestSubscribeMessage({
          fail: () => {
            reject(new MiniappPlatformError("SUBSCRIPTION_FAILED"));
          },
          success: (result) => {
            resolve(normalizeResult(uniqueTemplateIds, result));
          },
          tmplIds: uniqueTemplateIds,
        });
      });
    },
  });
}
