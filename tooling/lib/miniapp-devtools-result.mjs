const safeCodePattern = /^[A-Z][A-Z0-9_]{1,80}$/u;
const endpointCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
]);
const launchInfrastructureCategories = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
  "MINIAPP_DEVTOOLS_AUTOMATION_PORT_IN_USE",
  "MINIAPP_DEVTOOLS_CLI_UNAVAILABLE",
  "MINIAPP_DEVTOOLS_ENDPOINT_UNREACHABLE",
  "MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT",
  "MINIAPP_DEVTOOLS_SERVICE_PORT_UNAVAILABLE",
]);

function mappedMessageCategory(message) {
  if (/Wait timed out after \d+ ms/iu.test(message)) {
    return "MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT";
  }
  if (/Port \d+ is in use/iu.test(message)) {
    return "MINIAPP_DEVTOOLS_AUTOMATION_PORT_IN_USE";
  }
  if (/cliPath (?:is|option)/iu.test(message)) {
    return "MINIAPP_DEVTOOLS_CLI_UNAVAILABLE";
  }
  if (/http port is open/iu.test(message)) {
    return "MINIAPP_DEVTOOLS_SERVICE_PORT_UNAVAILABLE";
  }
  if (
    /(?:Failed connecting to|ECONNREFUSED|connection refused|connect(?:ion)? timeout|IDE service port|automation endpoint)/iu.test(
      message,
    )
  ) {
    return "MINIAPP_DEVTOOLS_ENDPOINT_UNREACHABLE";
  }
  if (/Connection closed/iu.test(message)) {
    return "MINIAPP_DEVTOOLS_CONNECTION_CLOSED";
  }
  return undefined;
}

function errorCategory(error) {
  if (error instanceof Error) {
    if (safeCodePattern.test(error.message)) {
      return error.message;
    }
    if (
      "code" in error &&
      typeof error.code === "string" &&
      safeCodePattern.test(error.code)
    ) {
      return error.code;
    }
    const mappedCategory = mappedMessageCategory(error.message);
    if (mappedCategory !== undefined) {
      return mappedCategory;
    }
    if (safeCodePattern.test(error.name.toUpperCase())) {
      return error.name.toUpperCase();
    }
  }
  return "UNKNOWN_ERROR";
}

export function classifyMiniappDevtoolsError(error, phase) {
  const category = errorCategory(error);
  const infrastructureBlocked =
    phase === "cli" ||
    (phase === "launch" &&
      (category === "MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT" ||
        launchInfrastructureCategories.has(category) ||
        (error instanceof Error &&
          "code" in error &&
          typeof error.code === "string" &&
          endpointCodes.has(error.code))));

  return Object.freeze({
    category,
    exitCode: infrastructureBlocked ? 2 : 1,
    status: infrastructureBlocked ? "INFRA_BLOCKED" : "FAIL",
  });
}

export function formatMiniappDevtoolsResult(result) {
  return result.status === "INFRA_BLOCKED"
    ? `MINIAPP_DEVTOOLS_INFRA_BLOCKED: ${result.category}`
    : `MINIAPP_DEVTOOLS_FAIL: ${result.category}`;
}
