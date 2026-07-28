import {
  classifyMiniappDevtoolsError,
  formatMiniappDevtoolsResult,
} from "./lib/miniapp-devtools-result.mjs";

const connectionError = Object.assign(new Error("connect ECONNREFUSED"), {
  code: "ECONNREFUSED",
});
const cases = [
  {
    error: new Error("MINIAPP_DEVTOOLS_CLI_UNAVAILABLE"),
    expectedCategory: "MINIAPP_DEVTOOLS_CLI_UNAVAILABLE",
    expectedExitCode: 2,
    expectedStatus: "INFRA_BLOCKED",
    phase: "cli",
  },
  {
    error: new Error("MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT"),
    expectedCategory: "MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT",
    expectedExitCode: 2,
    expectedStatus: "INFRA_BLOCKED",
    phase: "launch",
  },
  {
    error: new Error("Wait timed out after 15000 ms"),
    expectedCategory: "MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT",
    expectedExitCode: 2,
    expectedStatus: "INFRA_BLOCKED",
    phase: "launch",
  },
  {
    error: connectionError,
    expectedCategory: "ECONNREFUSED",
    expectedExitCode: 2,
    expectedStatus: "INFRA_BLOCKED",
    phase: "launch",
  },
  {
    error: new Error(
      "Failed to launch wechat web devTools, please make sure http port is open",
    ),
    expectedCategory: "MINIAPP_DEVTOOLS_SERVICE_PORT_UNAVAILABLE",
    expectedExitCode: 2,
    expectedStatus: "INFRA_BLOCKED",
    phase: "launch",
  },
  {
    error: new Error(
      "Failed connecting to ws://127.0.0.1:9420, check if target project window is opened with automation enabled",
    ),
    expectedCategory: "MINIAPP_DEVTOOLS_ENDPOINT_UNREACHABLE",
    expectedExitCode: 2,
    expectedStatus: "INFRA_BLOCKED",
    phase: "launch",
  },
  {
    error: new Error("MINIAPP_DEVTOOLS_LAUNCH_SCREEN_MISMATCH"),
    expectedCategory: "MINIAPP_DEVTOOLS_LAUNCH_SCREEN_MISMATCH",
    expectedExitCode: 1,
    expectedStatus: "FAIL",
    phase: "smoke",
  },
  {
    error: new Error(
      "Connection closed, check if wechat web devTools is still running",
    ),
    expectedCategory: "MINIAPP_DEVTOOLS_CONNECTION_CLOSED",
    expectedExitCode: 1,
    expectedStatus: "FAIL",
    phase: "smoke",
  },
  {
    error: new TypeError("synthetic page data failure"),
    expectedCategory: "TYPEERROR",
    expectedExitCode: 1,
    expectedStatus: "FAIL",
    phase: "smoke",
  },
  {
    error: new Error("synthetic module load failure"),
    expectedCategory: "ERROR",
    expectedExitCode: 1,
    expectedStatus: "FAIL",
    phase: "launch",
  },
];
const errors = [];

for (const testCase of cases) {
  const result = classifyMiniappDevtoolsError(testCase.error, testCase.phase);
  if (
    result.category !== testCase.expectedCategory ||
    result.exitCode !== testCase.expectedExitCode ||
    result.status !== testCase.expectedStatus
  ) {
    errors.push(
      `MINIAPP_DEVTOOLS_CLASSIFICATION: phase=${testCase.phase} expected=${testCase.expectedStatus}/${testCase.expectedExitCode}/${testCase.expectedCategory} actual=${result.status}/${result.exitCode}/${result.category}`,
    );
  }
  if (
    !formatMiniappDevtoolsResult(result).startsWith(
      result.status === "INFRA_BLOCKED"
        ? "MINIAPP_DEVTOOLS_INFRA_BLOCKED:"
        : "MINIAPP_DEVTOOLS_FAIL:",
    )
  ) {
    errors.push(
      `MINIAPP_DEVTOOLS_FORMAT: phase=${testCase.phase} status=${result.status}`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Miniapp DevTools result Gate passed ${cases.length} classification cases.`,
  );
}
