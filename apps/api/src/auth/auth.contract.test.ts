import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { WechatSessionRequestSchema } from "@daily-energy/shared-schemas";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { API_ERROR_CATALOG } from "../transport/common/api-exception.js";

describe("C-001 auth transport contract", () => {
  it("keeps the WeChat request closed and forbids client-supplied owner/provider fields", () => {
    expect(
      WechatSessionRequestSchema.safeParse({ code: "opaque-code" }).success,
    ).toBe(true);
    for (const forbidden of ["account_id", "openid", "unionid", "provider"]) {
      expect(
        WechatSessionRequestSchema.safeParse({
          code: "opaque-code",
          [forbidden]: "forged",
        }).success,
      ).toBe(false);
    }
  });

  it("locks the OpenAPI session surface to opaque tokens and stable auth failures", async () => {
    const document = parse(
      await readFile(
        resolve(import.meta.dirname, "../../../../openapi/openapi.yaml"),
        "utf8",
      ),
    ) as {
      paths: Record<
        string,
        Record<string, { responses: Record<string, unknown> }>
      >;
      components: {
        schemas: Record<string, { properties?: Record<string, unknown> }>;
      };
    };

    const sessionProperties = Object.keys(
      document.components.schemas.SessionView?.properties ?? {},
    );
    expect(sessionProperties).toEqual(
      expect.arrayContaining([
        "session_token",
        "expires_at",
        "refresh_after",
        "account_state",
        "consent_required",
        "onboarding_required",
      ]),
    );
    expect(sessionProperties.join(" ")).not.toMatch(
      /openid|unionid|subject|ciphertext|lookup|account_id/iu,
    );

    expect(
      document.paths["/auth/wechat/session"]?.post?.responses,
    ).toMatchObject({
      "200": expect.anything(),
      "400": expect.anything(),
      "429": expect.anything(),
      "503": expect.anything(),
    });
    expect(
      document.paths["/auth/session/refresh"]?.post?.responses,
    ).toMatchObject({ "200": expect.anything(), "401": expect.anything() });
    expect(API_ERROR_CATALOG.AUTH_WECHAT_CODE_INVALID).toMatchObject({
      category: "AUTH",
      retryable: false,
      status: 400,
    });
    expect(API_ERROR_CATALOG.AUTH_SESSION_EXPIRED).toMatchObject({
      category: "AUTH",
      retryable: false,
      status: 401,
    });
    expect(API_ERROR_CATALOG.RATE_LIMITED).toMatchObject({
      category: "RATE_LIMIT",
      retryable: true,
      status: 429,
    });
  });
});
