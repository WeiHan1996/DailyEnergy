import { MiniappPlatformError } from "../errors.js";
import type { StoragePort, StorageValue } from "../ports.js";
import type { WechatRuntime } from "./runtime.js";

const storageKeyPattern = /^[a-z0-9][a-z0-9:-]{0,79}$/u;
const storagePrefix = "daily-energy:";

function scopedKey(key: string): string {
  if (!storageKeyPattern.test(key)) {
    throw new MiniappPlatformError("STORAGE_KEY_INVALID");
  }
  return `${storagePrefix}${key}`;
}

export function createWechatStoragePort(runtime: WechatRuntime): StoragePort {
  return Object.freeze({
    get(key: string): Promise<StorageValue | undefined> {
      const resolvedKey = scopedKey(key);
      return new Promise((resolve, reject) => {
        runtime.getStorage({
          fail: () => {
            reject(new MiniappPlatformError("STORAGE_FAILED"));
          },
          key: resolvedKey,
          success: ({ data }) => {
            resolve(data as StorageValue | undefined);
          },
        });
      });
    },
    remove(key: string): Promise<void> {
      const resolvedKey = scopedKey(key);
      return new Promise((resolve, reject) => {
        runtime.removeStorage({
          fail: () => {
            reject(new MiniappPlatformError("STORAGE_FAILED"));
          },
          key: resolvedKey,
          success: resolve,
        });
      });
    },
    set(key: string, value: StorageValue): Promise<void> {
      const resolvedKey = scopedKey(key);
      return new Promise((resolve, reject) => {
        runtime.setStorage({
          data: value,
          fail: () => {
            reject(new MiniappPlatformError("STORAGE_FAILED"));
          },
          key: resolvedKey,
          success: resolve,
        });
      });
    },
  });
}
