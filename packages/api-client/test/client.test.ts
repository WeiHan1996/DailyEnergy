import { describe, expect, it } from "vitest";

import {
  createMiniappApiClient,
  mapEveningSaveRequestToSubmission,
  miniappOperations,
  type ContractOperationInput,
  type operations as MiniappOperations,
} from "../src/miniapp.js";
import {
  adminOperations,
  createAdminApiClient,
  type operations as AdminOperations,
} from "../src/admin.js";
import { createContractTransportStub } from "../src/testing.js";

describe("audience-separated API clients", () => {
  it("keeps miniapp and Admin operations in disjoint manifests", () => {
    expect(Object.keys(miniappOperations)).not.toHaveLength(0);
    expect(Object.keys(adminOperations)).not.toHaveLength(0);
    expect(
      Object.keys(miniappOperations).every((name) => !/^admin/u.test(name)),
    ).toBe(true);
    expect(
      Object.keys(adminOperations).every((name) => /^admin/u.test(name)),
    ).toBe(true);
    expect(
      Object.values(miniappOperations).every(
        ({ path }) => !path.startsWith("/v1/admin/"),
      ),
    ).toBe(true);
    expect(
      Object.values(adminOperations).every(({ path }) =>
        path.startsWith("/v1/admin/"),
      ),
    ).toBe(true);
  });

  it("routes typed miniapp and Admin requests through replaceable transports", async () => {
    const miniappTransport = createContractTransportStub<MiniappOperations>({
      createWechatSession: () => ({
        body: {
          ok: false,
          request_id: "request-synthetic",
          server_now: "2026-07-29T08:00:00Z",
          error: {
            code: "FEATURE_DISABLED",
            category: "GUARD",
            message_key: "error.feature_disabled",
            message: "尚未开放。",
            retryable: false,
          },
        },
        headers: {},
        status: 400,
      }),
    });
    const adminTransport = createContractTransportStub<AdminOperations>({
      adminOpsOverview: () => ({
        body: {
          ok: false,
          request_id: "request-admin-synthetic",
          server_now: "2026-07-29T08:00:00Z",
          error: {
            code: "FEATURE_DISABLED",
            category: "GUARD",
            message_key: "error.feature_disabled",
            message: "尚未开放。",
            retryable: false,
          },
        },
        headers: {},
        status: 403,
      }),
    });
    const miniapp = createMiniappApiClient(miniappTransport);
    const admin = createAdminApiClient(adminTransport);

    const input = {
      body: {
        code: "synthetic-code",
      },
      parameters: {
        header: {},
      },
    } satisfies ContractOperationInput<
      MiniappOperations["createWechatSession"]
    >;
    await miniapp.request("createWechatSession", input);
    await admin.request("adminOpsOverview", {
      parameters: { header: {} },
    } satisfies ContractOperationInput<AdminOperations["adminOpsOverview"]>);

    expect(miniappTransport.requests[0]).toMatchObject({
      method: "POST",
      operationId: "createWechatSession",
      path: "/v1/auth/wechat/session",
    });
    expect(adminTransport.requests[0]).toMatchObject({
      method: "GET",
      operationId: "adminOpsOverview",
      path: "/v1/admin/ops/overview",
    });
  });

  it("maps the OpenAPI evening transport into the Zod domain submission", () => {
    const submission = mapEveningSaveRequestToSubmission({
      command_ref: "command-synthetic",
      product_date: "2026-07-29",
      expected_feedback_revision: 0,
      expected_helpfulness_revision: 0,
      overall_feeling: "STEADY",
      helpfulness_rating: "HELPFUL",
      task_patch: {
        task_ref: "task-synthetic",
        expected_revision: 1,
        status: "COMPLETED",
      },
      note_patch: {
        operation: "CLEAR",
      },
      client_context: {
        app_version: "0.1.0",
        entry_source: "evening-card-v1",
        view_schema_version: "1.0.0",
      },
    });

    expect(submission).toEqual({
      contract: "evening-reflection-submission",
      schema_version: "1.0.0",
      submission_id: "command-synthetic",
      product_date: "2026-07-29",
      expected_feedback_revision: 0,
      expected_helpfulness_revision: 0,
      overall_feeling: "STEADY",
      helpfulness_rating: "HELPFUL",
      task_patch: {
        task_id: "task-synthetic",
        expected_revision: 1,
        status: "COMPLETED",
      },
      note_patch: {
        operation: "CLEAR",
      },
      client_context: {
        entry_source: "evening-card-v1",
        view_schema_version: "1.0.0",
      },
    });
  });

  it("rejects mapper input that violates the Zod cross-field contract", () => {
    expect(() =>
      mapEveningSaveRequestToSubmission({
        command_ref: "command-synthetic",
        product_date: "2026-02-30",
        expected_feedback_revision: 0,
        expected_helpfulness_revision: 0,
        overall_feeling: "STEADY",
        helpfulness_rating: "HELPFUL",
        client_context: {
          entry_source: "evening-card-v1",
          view_schema_version: "1.0.0",
        },
      }),
    ).toThrow();
  });
});
