import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "./bootstrap/create-api-application.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
  type MaintenanceMode,
} from "./bootstrap/runtime-config.js";
import type { AudienceVerifier, ReadinessCheck } from "./composition/types.js";
import type {
  OrdinaryLogEvent,
  OrdinaryLogSink,
} from "./observability/ordinary-logger.js";
import type { SafetyContinuationVerifier } from "./composition/types.js";
import { HealthService } from "./transport/public/health.service.js";

function syntheticEnvironment(
  maintenanceMode: MaintenanceMode = "OFF",
): NodeJS.ProcessEnv {
  return {
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_ENVIRONMENT: "CI",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: maintenanceMode,
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "synthetic-release-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  };
}

function exactBearer(token: string): AudienceVerifier {
  return {
    verify: (authorization) => authorization === `Bearer ${token}`,
  };
}

function exactSafetyContinuation(token: string): SafetyContinuationVerifier {
  return {
    verify: (continuation) => continuation === token,
  };
}

const applications: INestApplication[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map(async (application) => {
      await application.close();
    }),
  );
  vi.restoreAllMocks();
});

async function createTestApplication(options?: {
  readonly adminAudienceVerifier?: AudienceVerifier;
  readonly maintenanceMode?: MaintenanceMode;
  readonly ordinaryLogSink?: OrdinaryLogSink;
  readonly publicAudienceVerifier?: AudienceVerifier;
  readonly readinessChecks?: readonly ReadinessCheck[];
  readonly safetyContinuationVerifier?: SafetyContinuationVerifier;
}): Promise<INestApplication> {
  const silentLogSink: OrdinaryLogSink = {
    write: () => undefined,
  };
  const application = await createApiApplication(
    loadRuntimeConfig(syntheticEnvironment(options?.maintenanceMode)),
    {
      ...(options?.adminAudienceVerifier === undefined
        ? {}
        : {
            adminAudienceVerifier: options.adminAudienceVerifier,
          }),
      ...(options?.ordinaryLogSink === undefined
        ? { ordinaryLogSink: silentLogSink }
        : { ordinaryLogSink: options.ordinaryLogSink }),
      ...(options?.publicAudienceVerifier === undefined
        ? {}
        : {
            publicAudienceVerifier: options.publicAudienceVerifier,
          }),
      ...(options?.readinessChecks === undefined
        ? {}
        : { readinessChecks: options.readinessChecks }),
      ...(options?.safetyContinuationVerifier === undefined
        ? {}
        : {
            safetyContinuationVerifier: options.safetyContinuationVerifier,
          }),
    },
  );
  await application.listen(0, "127.0.0.1");
  applications.push(application);
  return application;
}

describe("API HTTP baseline", () => {
  it("exposes detail-free startup, liveness, and readiness probes", async () => {
    const application = await createTestApplication();
    const server = application.getHttpServer();

    await request(server)
      .get("/health/startup")
      .expect(200, { status: "STARTED" });
    await request(server).get("/health/live").expect(200, { status: "UP" });
    await request(server).get("/health/ready").expect(200, { status: "READY" });
  });

  it("reports a required dependency failure without dependency details", async () => {
    const application = await createTestApplication({
      readinessChecks: [
        {
          check: () => ({
            reasonCode: "REQUIRED_DEPENDENCY_UNAVAILABLE",
            status: "DOWN",
          }),
        },
      ],
    });

    const response = await request(application.getHttpServer())
      .get("/health/ready")
      .expect(503);

    expect(response.body).toEqual({
      reason_code: "REQUIRED_DEPENDENCY_UNAVAILABLE",
      status: "NOT_READY",
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /host|url|credential|provider|database/iu,
    );
  });

  it("reports not-ready after shutdown draining begins", async () => {
    const application = await createTestApplication();
    application.get(HealthService).markDraining();

    await request(application.getHttpServer())
      .get("/health/ready")
      .expect(503, {
        reason_code: "REQUIRED_DEPENDENCY_UNAVAILABLE",
        status: "NOT_READY",
      });
  });

  it("returns a stable error envelope and echoes a safe request id", async () => {
    const application = await createTestApplication();
    const response = await request(application.getHttpServer())
      .post("/v1/auth/wechat/session")
      .set("X-Request-Id", "request_12345678")
      .send({
        code: "synthetic-code",
        unknown: "must-fail",
      })
      .expect(400);

    expect(response.headers["x-request-id"]).toBe("request_12345678");
    expect(response.body).toMatchObject({
      error: {
        category: "VALIDATION",
        code: "VALIDATION_FAILED",
        message_key: "error.validation_failed",
        retryable: false,
      },
      ok: false,
      request_id: "request_12345678",
    });
    expect(response.body.server_now).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toMatch(
      /stack|prisma|sql|provider|prompt|openid|ciphertext/iu,
    );
  });

  it("normalizes malformed JSON without exposing parser details", async () => {
    const application = await createTestApplication();
    const response = await request(application.getHttpServer())
      .post("/v1/auth/wechat/session")
      .set("Content-Type", "application/json")
      .send('{"code":')
      .expect(400);

    expect(response.body.error).toMatchObject({
      category: "VALIDATION",
      code: "VALIDATION_FAILED",
      retryable: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /syntax|unexpected|express|stack/iu,
    );
  });

  it("normalizes parser 413 to the Accepted contract 400", async () => {
    const application = await createTestApplication();
    const response = await request(application.getHttpServer())
      .post("/v1/auth/wechat/session")
      .send({
        code: "x".repeat(40_000),
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      category: "VALIDATION",
      code: "PAYLOAD_TOO_LARGE",
      retryable: false,
    });
  });

  it("keeps public and Admin audience verifiers non-interchangeable", async () => {
    const application = await createTestApplication({
      adminAudienceVerifier: exactBearer("admin-synthetic"),
      publicAudienceVerifier: exactBearer("public-synthetic"),
    });
    const server = application.getHttpServer();

    await request(server)
      .get("/v1/bootstrap/launch")
      .set("Authorization", "Bearer admin-synthetic")
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("AUTH_REQUIRED");
      });
    await request(server)
      .get("/v1/admin/ops/overview")
      .set("Authorization", "Bearer public-synthetic")
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("AUTH_ADMIN_REQUIRED");
      });
    await request(server)
      .get("/v1/bootstrap/launch")
      .set("Authorization", "Bearer public-synthetic")
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("FEATURE_DISABLED");
      });
    await request(server)
      .get("/v1/admin/ops/overview")
      .set("Authorization", "Bearer admin-synthetic")
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("FEATURE_DISABLED");
      });
  });

  it("applies blocking maintenance before ordinary audience checks", async () => {
    const application = await createTestApplication({
      maintenanceMode: "BLOCKING",
    });

    const response = await request(application.getHttpServer())
      .get("/v1/bootstrap/launch")
      .expect(403);

    expect(response.body.error).toMatchObject({
      category: "GUARD",
      code: "MAINTENANCE_BLOCKING",
      retryable: true,
    });
  });

  it("keeps an accepted Safety continuation reachable during blocking maintenance", async () => {
    const application = await createTestApplication({
      maintenanceMode: "BLOCKING",
      safetyContinuationVerifier: exactSafetyContinuation("safety-synthetic"),
    });
    const server = application.getHttpServer();

    await request(server)
      .get("/v1/bootstrap/launch")
      .set("X-Safety-Continuation", "safety-synthetic")
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("FEATURE_DISABLED");
      });
    await request(server)
      .get("/v1/bootstrap/launch")
      .set("X-Safety-Continuation", "invalid-safety")
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("MAINTENANCE_BLOCKING");
      });
  });

  it("does not let a Safety continuation enter Admin or ordinary routes", async () => {
    const application = await createTestApplication({
      maintenanceMode: "BLOCKING",
      safetyContinuationVerifier: exactSafetyContinuation("safety-synthetic"),
    });
    const server = application.getHttpServer();

    await request(server)
      .get("/v1/admin/ops/overview")
      .set("X-Safety-Continuation", "safety-synthetic")
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("MAINTENANCE_BLOCKING");
      });
    await request(server)
      .post("/v1/auth/wechat/session")
      .set("X-Safety-Continuation", "safety-synthetic")
      .send({ code: "synthetic-code" })
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("MAINTENANCE_BLOCKING");
      });

    const ordinaryApplication = await createTestApplication({
      safetyContinuationVerifier: exactSafetyContinuation("safety-synthetic"),
    });
    await request(ordinaryApplication.getHttpServer())
      .get("/v1/admin/ops/overview")
      .set("X-Safety-Continuation", "safety-synthetic")
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("AUTH_ADMIN_REQUIRED");
      });
  });

  it("normalizes unknown routes without exposing framework details", async () => {
    const application = await createTestApplication();
    const response = await request(application.getHttpServer())
      .get("/v1/does-not-exist")
      .expect(404);

    expect(response.body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toMatch(
      /cannot get|nestjs|express|stack/iu,
    );
  });

  it("logs only allowlisted metadata, not credentials or request bodies", async () => {
    const events: OrdinaryLogEvent[] = [];
    const application = await createTestApplication({
      ordinaryLogSink: {
        write: (event) => {
          events.push(event);
        },
      },
    });

    await request(application.getHttpServer())
      .post("/v1/auth/wechat/session")
      .set("Authorization", "Bearer never-log-this")
      .send({
        code: "never-log-this-code",
        unknown: "never-log-this-field",
      })
      .expect(400);

    const serialized = JSON.stringify(events);
    expect(events).not.toHaveLength(0);
    expect(serialized).not.toContain("never-log-this");
    expect(serialized).not.toContain("unknown");
    expect(events[0]).toMatchObject({
      message_code: "HTTP_REQUEST_COMPLETED",
      operation_code: "PUBLIC_WECHAT_SESSION_PLACEHOLDER",
      outcome_code: "EXPECTED_REJECT",
      reason_code: "VALIDATION_FAILED",
    });
  });
});

async function waitForOutput(
  child: { readonly stdout: NodeJS.ReadableStream },
  output: { value: string },
  marker: string,
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      rejectPromise(new Error(`Timed out waiting for ${marker}`));
    }, 5_000);
    const inspect = (): void => {
      if (!output.value.includes(marker)) {
        return;
      }
      clearTimeout(timeout);
      child.stdout.removeListener("data", inspect);
      resolvePromise();
    };
    child.stdout.on("data", inspect);
    inspect();
  });
}

describe("API process lifecycle", () => {
  it("fails before listening when runtime configuration is missing", async () => {
    const child = spawn(process.execPath, [resolve("dist/main.js")], {
      env: {
        PATH: process.env.PATH,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stderr: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });

    const [code] = (await once(child, "exit")) as [
      number | null,
      NodeJS.Signals | null,
    ];

    expect(code).toBe(1);
    const output = Buffer.concat(stderr).toString("utf8");
    expect(output).toContain('"reason_code":"RUNTIME_CONFIG_INVALID"');
    expect(output).not.toMatch(/DAILYENERGY_|stack|secret/iu);
  });

  it("drains and completes Nest shutdown hooks on SIGTERM", async () => {
    const child = spawn(process.execPath, [resolve("dist/main.js")], {
      env: {
        PATH: process.env.PATH,
        ...syntheticEnvironment(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = {
      value: "",
    };
    child.stdout.on("data", (chunk: Buffer) => {
      output.value += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output.value += chunk.toString("utf8");
    });

    await waitForOutput(child, output, '"message_code":"API_STARTED"');
    child.kill("SIGTERM");
    const [code, signal] = (await once(child, "exit")) as [
      number | null,
      NodeJS.Signals | null,
    ];

    expect(code).toBe(0);
    expect(signal).toBeNull();
    expect(output.value).toContain('"message_code":"API_SHUTDOWN_STARTED"');
    expect(output.value).toContain('"message_code":"API_SHUTDOWN_COMPLETED"');
    expect(output.value).not.toMatch(/authorization|secret|stack/iu);
  }, 10_000);

  it("terminates with a fixed result when shutdown drain exceeds the grace deadline", async () => {
    const child = spawn(
      process.execPath,
      [resolve("dist-fixtures/test-fixtures/slow-shutdown.js")],
      {
        env: {
          PATH: process.env.PATH,
          ...syntheticEnvironment(),
          DAILYENERGY_SHUTDOWN_GRACE_MS: "1000",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const output = {
      value: "",
    };
    child.stdout.on("data", (chunk: Buffer) => {
      output.value += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output.value += chunk.toString("utf8");
    });

    await waitForOutput(child, output, '"message_code":"API_STARTED"');
    const startedAt = performance.now();
    child.kill("SIGTERM");
    const [code, signal] = (await once(child, "exit")) as [
      number | null,
      NodeJS.Signals | null,
    ];
    const elapsedMs = performance.now() - startedAt;

    expect(code).toBe(1);
    expect(signal).toBeNull();
    expect(elapsedMs).toBeGreaterThanOrEqual(800);
    expect(elapsedMs).toBeLessThan(3_000);
    expect(output.value).toContain('"message_code":"API_SHUTDOWN_STARTED"');
    expect(output.value).toContain('"message_code":"API_SHUTDOWN_TIMED_OUT"');
    expect(output.value).toContain(
      '"reason_code":"SHUTDOWN_DEADLINE_EXCEEDED"',
    );
    expect(output.value).not.toContain(
      '"message_code":"API_SHUTDOWN_COMPLETED"',
    );
  }, 10_000);
});
