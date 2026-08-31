import { describe, expect, it } from "vitest";

import {
  MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
  parsePublicBuildConfig,
} from "../../app/public-build-config.js";
import { MiniappPlatformError } from "../errors.js";
import { createWechatPlatform } from "./index.js";
import type { WechatRuntime } from "./runtime.js";

function unsupported(): never {
  throw new Error("Synthetic runtime method was not configured.");
}

function createRuntime(overrides: Partial<WechatRuntime> = {}): WechatRuntime {
  return {
    getStorage: unsupported,
    login: unsupported,
    removeStorage: unsupported,
    request: unsupported,
    requestSubscribeMessage: unsupported,
    setStorage: unsupported,
    ...overrides,
  };
}

const config = parsePublicBuildConfig({
  apiOrigin: "http://127.0.0.1:3000",
  appVersion: "0.1.0",
  environment: "LOCAL",
  schemaVersion: MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
});

describe("wechat platform adapters", () => {
  it("normalizes login success and failure", async () => {
    const successful = createWechatPlatform(
      createRuntime({
        login: ({ success }) => {
          success({ code: "synthetic-code" });
        },
      }),
      config,
    );
    await expect(successful.login.login()).resolves.toEqual({
      code: "synthetic-code",
    });

    const failed = createWechatPlatform(
      createRuntime({
        login: ({ fail }) => {
          fail({ errMsg: "synthetic failure detail" });
        },
      }),
      config,
    );
    await expect(failed.login.login()).rejects.toEqual(
      new MiniappPlatformError("LOGIN_FAILED"),
    );
  });

  it("namespaces storage without making it authoritative", async () => {
    const keys: string[] = [];
    const platform = createWechatPlatform(
      createRuntime({
        getStorage: ({ key, success }) => {
          keys.push(key);
          success({ data: { draft: true } });
        },
        removeStorage: ({ key, success }) => {
          keys.push(key);
          success();
        },
        setStorage: ({ key, success }) => {
          keys.push(key);
          success();
        },
      }),
      config,
    );

    await platform.storage.set("draft:today", { draft: true });
    await expect(platform.storage.get("draft:today")).resolves.toEqual({
      draft: true,
    });
    await platform.storage.remove("draft:today");
    expect(keys).toEqual([
      "daily-energy:draft:today",
      "daily-energy:draft:today",
      "daily-energy:draft:today",
    ]);
    expect(() => platform.storage.get("../private")).toThrow(
      MiniappPlatformError,
    );
  });

  it("limits network requests to the configured public v1 origin", async () => {
    let requestedUrl = "";
    const platform = createWechatPlatform(
      createRuntime({
        request: ({ success, url }) => {
          requestedUrl = url;
          success({
            data: { enabled: false },
            header: { "x-request-id": "synthetic-request" },
            statusCode: 503,
          });
        },
      }),
      config,
    );

    await expect(
      platform.network.request({
        method: "GET",
        path: "/v1/bootstrap/launch",
      }),
    ).resolves.toEqual({
      data: { enabled: false },
      headers: { "x-request-id": "synthetic-request" },
      statusCode: 503,
    });
    expect(requestedUrl).toBe("http://127.0.0.1:3000/v1/bootstrap/launch");
    expect(() =>
      platform.network.request({
        method: "GET",
        path: "https://unreviewed.example/v1",
      }),
    ).toThrow(new MiniappPlatformError("NETWORK_PATH_INVALID"));
  });

  it("creates a bounded native share payload", () => {
    const platform = createWechatPlatform(createRuntime(), config);
    expect(
      platform.share.createAppMessage({
        path: "/pages/launch/index?source=synthetic",
        title: " 今天，留一分钟给自己 ",
      }),
    ).toEqual({
      path: "/pages/launch/index?source=synthetic",
      title: "今天，留一分钟给自己",
    });
    expect(() =>
      platform.share.createAppMessage({
        path: "https://unreviewed.example",
        title: "Invalid",
      }),
    ).toThrow(new MiniappPlatformError("SHARE_PAYLOAD_INVALID"));
  });

  it("normalizes subscription decisions without making rejection fatal", async () => {
    const platform = createWechatPlatform(
      createRuntime({
        requestSubscribeMessage: ({ success, tmplIds }) => {
          success({
            [tmplIds[0] ?? "missing"]: "accept",
            [tmplIds[1] ?? "missing"]: "reject",
          });
        },
      }),
      config,
    );

    await expect(
      platform.subscription.request(["template-one", "template-two"]),
    ).resolves.toEqual({
      decisions: {
        "template-one": "accept",
        "template-two": "reject",
      },
    });
    expect(() =>
      platform.subscription.request(["duplicate", "duplicate"]),
    ).toThrow(new MiniappPlatformError("SUBSCRIPTION_REQUEST_INVALID"));
  });
});
