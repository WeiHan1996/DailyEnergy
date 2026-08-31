import { PUBLIC_BUILD_CONFIG } from "../generated/public-build-config.js";
import {
  createCommandRef,
  OnboardingCoordinator,
} from "../features/onboarding/onboarding-flow.js";
import { CheckinCoordinator } from "../features/checkin/checkin-flow.js";
import { DailyCoordinator } from "../features/daily/daily-flow.js";
import { EveningCoordinator } from "../features/evening/evening-flow.js";
import { WeeklyCoordinator } from "../features/weekly/weekly-flow.js";
import { DataRightsCoordinator } from "../features/data-rights/data-rights-flow.js";
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
  readonly daily: DailyCoordinator;
  readonly dataRights: DataRightsCoordinator;
  readonly evening: EveningCoordinator;
  getSafetyView(): SafetyView | undefined;
  readonly onboarding: OnboardingCoordinator;
  readonly platform: MiniappPlatform;
  readonly weekly: WeeklyCoordinator;
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
  const daily = new DailyCoordinator(platform.storage, api, sessionScope);
  const dataRights = new DataRightsCoordinator(
    platform.login,
    platform.storage,
    api,
  );
  const evening = new EveningCoordinator(platform.storage, api, sessionScope);
  const weekly = new WeeklyCoordinator(platform.storage, api, sessionScope);
  return Object.freeze({
    checkin,
    config,
    daily,
    dataRights,
    evening,
    getSafetyView: () =>
      daily.getSafetyView() ??
      evening.getSafetyView() ??
      weekly.getSafetyView() ??
      checkin.getSafetyView() ??
      onboarding.getSafetyView(),
    onboarding,
    platform,
    weekly,
  });
}

export function getMiniappAppContext(): MiniappAppContext {
  return getApp<{ globalData: { context: MiniappAppContext } }>().globalData
    .context;
}
