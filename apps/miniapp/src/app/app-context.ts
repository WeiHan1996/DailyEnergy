import { PUBLIC_BUILD_CONFIG } from "../generated/public-build-config.js";
import type { MiniappPlatform } from "../platform/ports.js";
import {
  createWechatPlatform,
  type WechatRuntime,
} from "../platform/wechat/index.js";
import {
  parsePublicBuildConfig,
  type PublicBuildConfig,
} from "./public-build-config.js";

export interface MiniappAppContext {
  readonly config: PublicBuildConfig;
  readonly platform: MiniappPlatform;
}

export function createMiniappAppContext(
  runtime: WechatRuntime,
): MiniappAppContext {
  const config = parsePublicBuildConfig(PUBLIC_BUILD_CONFIG);
  return Object.freeze({
    config,
    platform: createWechatPlatform(runtime, config),
  });
}
