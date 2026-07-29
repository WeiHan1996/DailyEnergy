import type {
  components,
  ContractOperationResponse,
  MiniappApiClient,
  operations,
} from "../src/miniapp.js";

export async function assertMiniappClientTypes(
  miniapp: MiniappApiClient,
): Promise<void> {
  // @ts-expect-error required request body must not be omitted
  await miniapp.request("createWechatSession");

  await miniapp.request("getDailyByDate", {
    // @ts-expect-error required path parameter must not be omitted
    parameters: { header: {} },
  });

  await miniapp.request("getLaunchState");

  const response = await miniapp.request("createWechatSession", {
    body: { code: "synthetic-code" },
  });

  const status: 200 | 400 | 422 | 429 | 503 = response.status;
  void status;

  if (response.status === 200) {
    const body: components["schemas"]["ApiSuccessSession"] = response.body;
    void body;
  } else {
    const body: components["schemas"]["ApiErrorBody"] = response.body;
    void body;
  }

  const invalidSuccessResponse = {
    body: {},
    headers: {},
    status: 200 as const,
  };
  // @ts-expect-error status 200 must carry the success envelope
  const responseWithInvalidBody: ContractOperationResponse<
    operations["createWechatSession"]
  > = invalidSuccessResponse;
  void responseWithInvalidBody;
}
