import { describe, expect, it, vi } from "vitest";

import {
  createAdminApiClient,
  type operations,
} from "@daily-energy/api-client/admin";

import { createAdminFetchTransport } from "./admin-api-transport";

describe("Admin API transport boundary", () => {
  it("routes through the generated Admin client with server-owned origin and session", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            data: {
              cost_minor_units: 0,
              degraded_count: 0,
              p95_latency_ms: 0,
              queue_depth: 0,
              request_success_rate: 1,
              safety_alert_count: 0,
              window_end: "2026-07-29T09:00:00Z",
              window_start: "2026-07-29T08:00:00Z",
            },
            ok: true,
            product_date: "2026-07-29",
            product_date_policy_version: "product-date-v1",
            request_id: "request-admin-synthetic",
            server_now: "2026-07-29T09:00:00Z",
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
            status: 200,
          },
        );
      },
    );
    const client = createAdminApiClient(
      createAdminFetchTransport({
        apiOrigin: "https://admin-api.dailyenergy.example",
        fetcher,
        sessionToken: "session-synthetic",
      }),
    );

    const response = await client.request("adminOpsOverview", {
      parameters: {
        header: {
          "Accept-Language": "zh-CN",
          "X-Request-Id": "request-admin-synthetic",
        },
      },
    });

    expect(response.status).toBe(200);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://admin-api.dailyenergy.example/v1/admin/ops/overview",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer session-synthetic",
    );
  });

  it("does not permit an authenticated Admin operation without a server session", async () => {
    const client = createAdminApiClient(
      createAdminFetchTransport({
        apiOrigin: "https://admin-api.dailyenergy.example",
        fetcher: vi.fn(),
      }),
    );

    await expect(client.request("adminOpsOverview")).rejects.toThrow(
      "ADMIN_SESSION_REQUIRED",
    );
  });

  it("rejects malformed raw responses before they reach the typed client", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
      });
    });
    const client = createAdminApiClient(
      createAdminFetchTransport({
        apiOrigin: "https://admin-api.dailyenergy.example",
        fetcher,
      }),
    );
    const loginBody = {
      authorization_code: "authorization-synthetic",
      mfa_code: "mfa-synthetic",
    } satisfies operations["adminLogin"]["requestBody"]["content"]["application/json"];

    await expect(
      client.request("adminLogin", {
        body: loginBody,
      }),
    ).rejects.toThrow("ADMIN_API_RESPONSE_ENVELOPE_INVALID");
  });
});
