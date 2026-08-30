import { describe, expect, it } from "vitest";

import type {
  NetworkPort,
  NetworkRequest,
  NetworkResponse,
} from "../platform/ports.js";
import { createMiniappApi } from "./miniapp-api.js";

describe("C-015 miniapp analytics transport", () => {
  it("uses one unauthenticated short-timeout request with the strict signal body", async () => {
    const requests: NetworkRequest[] = [];
    const network: NetworkPort = {
      request: async <T>(input: NetworkRequest) => {
        requests.push(input);
        return {
          data: {
            data: { accepted: true },
            ok: true,
            product_date: "2026-08-30",
            product_date_policy_version: "product-date-v1",
            request_id: "request-c015",
            server_now: "2026-08-30T08:00:00.000Z",
          },
          headers: {},
          statusCode: 202,
        } as NetworkResponse<T>;
      },
    };
    await createMiniappApi(network).submitAnalyticsSignal({
      app_version: "1.4.2",
      event_name: "faq_opened",
      event_schema_version: 1,
      faq_category_code: "PRIVACY",
      locale: "zh-CN",
    });
    expect(requests).toEqual([
      {
        body: {
          app_version: "1.4.2",
          event_name: "faq_opened",
          event_schema_version: 1,
          faq_category_code: "PRIVACY",
          locale: "zh-CN",
        },
        headers: { "Accept-Language": "zh-CN" },
        method: "POST",
        path: "/v1/analytics/signals",
        timeoutMs: 2_000,
      },
    ]);
  });
});
