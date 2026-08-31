import { describe, expect, it, vi } from "vitest";

import { todayFixture } from "../features/daily/daily-fixture.test.js";
import type { WechatRuntime } from "../platform/wechat/index.js";
import { createMiniappAppContext } from "./app-context.js";

vi.mock("../generated/public-build-config.js", () => ({
  PUBLIC_BUILD_CONFIG: {
    apiOrigin: "http://127.0.0.1:3000",
    appVersion: "0.1.0",
    environment: "LOCAL",
    schemaVersion: "miniapp-public-build-config-v1",
  },
}));

function runtime() {
  const storage = new Map<string, unknown>();
  let offline = false;
  const value: WechatRuntime = {
    getStorage({ key, success }) {
      success({ data: storage.get(key) });
    },
    login({ success }) {
      success({ code: "synthetic-wechat-code" });
    },
    removeStorage({ key, success }) {
      storage.delete(key);
      success();
    },
    request({ fail, success, url }) {
      if (offline) {
        fail({ errMsg: "offline" });
        return;
      }
      if (!url.endsWith("/v1/daily/today")) {
        fail({ errMsg: "unexpected request" });
        return;
      }
      success({
        data: {
          data: todayFixture,
          ok: true,
          product_date: todayFixture.content.product_date,
          request_id: "cold-start-cache-request",
          server_now: "2026-08-24T02:00:00.000Z",
        },
        statusCode: 200,
      });
    },
    requestSubscribeMessage({ success }) {
      success({});
    },
    setStorage({ data, key, success }) {
      storage.set(key, JSON.parse(JSON.stringify(data)) as unknown);
      success();
    },
  };
  return {
    goOffline() {
      offline = true;
    },
    value,
  };
}

describe("Mini Program app context cache scope", () => {
  it("recovers the same validated cache after a cold context rebuild", async () => {
    const fake = runtime();
    const first = createMiniappAppContext(fake.value);
    await expect(first.daily.loadToday()).resolves.toMatchObject({
      kind: "today",
      offline: false,
    });

    fake.goOffline();
    const rebuilt = createMiniappAppContext(fake.value);
    await expect(rebuilt.daily.loadToday()).resolves.toMatchObject({
      kind: "today",
      offline: true,
      view: todayFixture,
    });
  });
});
