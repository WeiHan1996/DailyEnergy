import { createMiniappAppContext } from "./app/app-context.js";
import type { WechatRuntime } from "./platform/wechat/index.js";

App({
  globalData: Object.freeze({
    context: createMiniappAppContext(wx as unknown as WechatRuntime),
  }),
});
