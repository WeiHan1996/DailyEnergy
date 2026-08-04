import {
  MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION,
  parsePublicBuildConfig,
} from "../apps/miniapp/src/app/public-build-config.ts";

import {
  normalizeGeneratedSourceLineEndings,
  parseMiniappPublicConfig,
  renderMiniappPublicConfigSource,
} from "./lib/miniapp-public-config.mjs";

const schemaVersion = MINIAPP_PUBLIC_BUILD_CONFIG_SCHEMA_VERSION;
const baseConfig = {
  apiOrigin: "https://api.daily-energy.example",
  environment: "PRODUCTION",
  schemaVersion,
};
const cases = [
  { accepted: true, name: "https origin", value: baseConfig },
  {
    accepted: true,
    name: "https origin with maximum port",
    value: {
      ...baseConfig,
      apiOrigin: "https://api.daily-energy.example:65535",
    },
  },
  {
    accepted: true,
    name: "local http origin",
    value: {
      ...baseConfig,
      apiOrigin: "http://127.0.0.1:3000",
      environment: "LOCAL",
    },
  },
  {
    accepted: true,
    name: "runner localhost origin",
    value: {
      ...baseConfig,
      apiOrigin: "http://localhost:3000",
      environment: "MINIAPP_RUNNER",
    },
  },
  {
    accepted: false,
    name: "trailing slash",
    value: { ...baseConfig, apiOrigin: "https://api.daily-energy.example/" },
  },
  {
    accepted: false,
    name: "path",
    value: { ...baseConfig, apiOrigin: "https://api.daily-energy.example/v1" },
  },
  {
    accepted: false,
    name: "query",
    value: { ...baseConfig, apiOrigin: "https://api.daily-energy.example?a=1" },
  },
  {
    accepted: false,
    name: "fragment",
    value: { ...baseConfig, apiOrigin: "https://api.daily-energy.example#api" },
  },
  {
    accepted: false,
    name: "credentials",
    value: {
      ...baseConfig,
      apiOrigin: "https://name:password@api.daily-energy.example",
    },
  },
  {
    accepted: false,
    name: "non-local http origin",
    value: { ...baseConfig, apiOrigin: "http://api.daily-energy.example" },
  },
  {
    accepted: false,
    name: "invalid port",
    value: {
      ...baseConfig,
      apiOrigin: "https://api.daily-energy.example:65536",
    },
  },
  {
    accepted: false,
    name: "unknown environment",
    value: { ...baseConfig, environment: "TEST" },
  },
  {
    accepted: false,
    name: "unknown schema",
    value: { ...baseConfig, schemaVersion: "unknown" },
  },
  {
    accepted: false,
    name: "extra key",
    value: { ...baseConfig, extra: true },
  },
];
const errors = [];

const generatedSource = renderMiniappPublicConfigSource(baseConfig);
if (
  normalizeGeneratedSourceLineEndings(
    generatedSource.replaceAll("\n", "\r\n"),
  ) !== generatedSource
) {
  errors.push(
    "MINIAPP_GENERATED_SOURCE_LINE_ENDINGS: CRLF checkout must compare as canonical LF",
  );
}

function accepts(parser, value) {
  try {
    parser(value);
    return true;
  } catch {
    return false;
  }
}

for (const testCase of cases) {
  const buildAccepted = accepts(parseMiniappPublicConfig, testCase.value);
  const runtimeAccepted = accepts(parsePublicBuildConfig, testCase.value);
  if (buildAccepted !== runtimeAccepted) {
    errors.push(
      `MINIAPP_PUBLIC_CONFIG_PARITY: ${testCase.name}: build=${buildAccepted} runtime=${runtimeAccepted}`,
    );
  }
  if (buildAccepted !== testCase.accepted) {
    errors.push(
      `MINIAPP_PUBLIC_CONFIG_EXPECTATION: ${testCase.name}: expected=${testCase.accepted} actual=${buildAccepted}`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Miniapp public config parity Gate passed ${cases.length} shared acceptance cases.`,
  );
}
