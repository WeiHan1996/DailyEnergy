import { MiniappPlatformError } from "../errors.js";
import type { LoginPort } from "../ports.js";
import type { WechatRuntime } from "./runtime.js";

const LOGIN_TIMEOUT_MS = 8_000;

export function createWechatLoginPort(runtime: WechatRuntime): LoginPort {
  return Object.freeze({
    login(): Promise<{ readonly code: string }> {
      return new Promise((resolve, reject) => {
        runtime.login({
          fail: () => {
            reject(new MiniappPlatformError("LOGIN_FAILED"));
          },
          success: ({ code }) => {
            if (code.trim().length === 0) {
              reject(new MiniappPlatformError("LOGIN_FAILED"));
              return;
            }
            resolve(Object.freeze({ code }));
          },
          timeout: LOGIN_TIMEOUT_MS,
        });
      });
    },
  });
}
