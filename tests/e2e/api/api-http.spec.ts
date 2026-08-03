import { expect, test } from "@playwright/test";

function apiUrl(path: string): string {
  const baseUrl = process.env.DAILYENERGY_API_E2E_BASE_URL;
  if (baseUrl === undefined || baseUrl.length === 0) {
    throw new Error("API_E2E_BASE_URL_MISSING");
  }
  return new URL(path, baseUrl).href;
}

test("T-E010-HTTP-E2E-001 exposes real Nest health over HTTP", async ({
  request,
}) => {
  const response = await request.get(apiUrl("/health/ready"));

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  await expect(response.json()).resolves.toEqual({ status: "READY" });
});

test("T-E010-HTTP-E2E-001 rejects unknown fields with a closed error envelope", async ({
  request,
}) => {
  const response = await request.post(apiUrl("/v1/auth/wechat/session"), {
    data: {
      code: "synthetic-wechat-code-0001",
      unknown: "must-fail",
    },
    headers: { "X-Request-Id": "synthetic_request_0001" },
  });
  const body = await response.json();

  expect(response.status()).toBe(400);
  expect(response.headers()["x-request-id"]).toBe("synthetic_request_0001");
  expect(body).toMatchObject({
    error: {
      category: "VALIDATION",
      code: "VALIDATION_FAILED",
      retryable: false,
    },
    ok: false,
    request_id: "synthetic_request_0001",
  });
  expect(JSON.stringify(body)).not.toMatch(
    /stack|prisma|sql|provider|model|prompt|openid|ciphertext/iu,
  );
});

test("T-E010-HTTP-E2E-002 keeps public and Admin audiences separate", async ({
  request,
}) => {
  const publicResponse = await request.get(apiUrl("/v1/bootstrap/launch"), {
    headers: { Authorization: "Bearer synthetic-admin" },
  });
  const adminResponse = await request.get(apiUrl("/v1/admin/ops/overview"), {
    headers: { Authorization: "Bearer synthetic-public" },
  });

  expect(publicResponse.status()).toBe(401);
  expect((await publicResponse.json()).error.code).toBe("AUTH_REQUIRED");
  expect(adminResponse.status()).toBe(401);
  expect((await adminResponse.json()).error.code).toBe("AUTH_ADMIN_REQUIRED");
});

test("T-E010-HTTP-E2E-001 normalizes unknown routes without framework detail", async ({
  request,
}) => {
  const response = await request.get(apiUrl("/v1/synthetic-missing"));
  const body = await response.json();

  expect(response.status()).toBe(404);
  expect(body.error.code).toBe("RESOURCE_NOT_FOUND");
  expect(JSON.stringify(body)).not.toMatch(/express|nest|stack|route/iu);
});
