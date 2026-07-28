import type { PublicBuildConfig } from "../../app/public-build-config.js";
import type { MiniappPlatform } from "../ports.js";
import { createWechatLoginPort } from "./login.js";
import { createWechatNetworkPort } from "./network.js";
import type { WechatRuntime } from "./runtime.js";
import { createWechatSharePort } from "./share.js";
import { createWechatStoragePort } from "./storage.js";
import { createWechatSubscriptionPort } from "./subscription.js";

export type { WechatRuntime } from "./runtime.js";

export function createWechatPlatform(
  runtime: WechatRuntime,
  config: PublicBuildConfig,
): MiniappPlatform {
  return Object.freeze({
    login: createWechatLoginPort(runtime),
    network: createWechatNetworkPort(runtime, config.apiOrigin),
    share: createWechatSharePort(),
    storage: createWechatStoragePort(runtime),
    subscription: createWechatSubscriptionPort(runtime),
  });
}
