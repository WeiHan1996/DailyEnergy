import { PUBLIC_BUILD_CONFIG } from "../generated/public-build-config.js";
import {
  createCommandRef,
  OnboardingCoordinator,
} from "../features/onboarding/onboarding-flow.js";
import type { MiniappPlatform } from "../platform/ports.js";
import {
  createWechatPlatform,
  type WechatRuntime,
} from "../platform/wechat/index.js";
import { createMiniappApi } from "../services/miniapp-api.js";
import {
  parsePublicBuildConfig,
  type PublicBuildConfig,
} from "./public-build-config.js";

export interface MiniappAppContext {
  readonly config: PublicBuildConfig;
  readonly onboarding: OnboardingCoordinator;
  readonly platform: MiniappPlatform;
}

export function createMiniappAppContext(
  runtime: WechatRuntime,
): MiniappAppContext {
  const config = parsePublicBuildConfig(PUBLIC_BUILD_CONFIG);
  const platform = createWechatPlatform(runtime, config);
  return Object.freeze({
    config,
    onboarding: new OnboardingCoordinator(
      platform.login,
      platform.storage,
      createMiniappApi(platform.network),
      createCommandRef("scope"),
    ),
    platform,
  });
}

export function getMiniappAppContext(): MiniappAppContext {
  return getApp<{ globalData: { context: MiniappAppContext } }>().globalData
    .context;
}
