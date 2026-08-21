import { PUBLIC_BUILD_CONFIG } from "../generated/public-build-config.js";
import {
  createCommandRef,
  OnboardingCoordinator,
} from "../features/onboarding/onboarding-flow.js";
import { CheckinCoordinator } from "../features/checkin/checkin-flow.js";
import type { MiniappPlatform } from "../platform/ports.js";
import {
  createWechatPlatform,
  type WechatRuntime,
} from "../platform/wechat/index.js";
import { createMiniappApi } from "../services/miniapp-api.js";
import type { SafetyView } from "../services/miniapp-api.js";
import {
  parsePublicBuildConfig,
  type PublicBuildConfig,
} from "./public-build-config.js";

export interface MiniappAppContext {
  readonly checkin: CheckinCoordinator;
  readonly config: PublicBuildConfig;
  getSafetyView(): SafetyView | undefined;
  readonly onboarding: OnboardingCoordinator;
  readonly platform: MiniappPlatform;
}

export function createMiniappAppContext(
  runtime: WechatRuntime,
): MiniappAppContext {
  const config = parsePublicBuildConfig(PUBLIC_BUILD_CONFIG);
  const platform = createWechatPlatform(runtime, config);
  const api = createMiniappApi(platform.network);
  const sessionScope = createCommandRef("scope");
  const onboarding = new OnboardingCoordinator(
    platform.login,
    platform.storage,
    api,
    sessionScope,
  );
  const checkin = new CheckinCoordinator(platform.storage, api, sessionScope);
  return Object.freeze({
    checkin,
    config,
    getSafetyView: () => checkin.getSafetyView() ?? onboarding.getSafetyView(),
    onboarding,
    platform,
  });
}

export function getMiniappAppContext(): MiniappAppContext {
  return getApp<{ globalData: { context: MiniappAppContext } }>().globalData
    .context;
}
