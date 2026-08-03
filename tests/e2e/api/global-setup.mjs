import { createApiApplication } from "../../../apps/api/dist/bootstrap/create-api-application.js";
import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "../../../apps/api/dist/bootstrap/runtime-config.js";

const environment = {
  DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
  DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
  DAILYENERGY_ENVIRONMENT: "CI",
  DAILYENERGY_LOG_LEVEL: "DEBUG",
  DAILYENERGY_MAINTENANCE_MODE: "OFF",
  DAILYENERGY_PORT: "0",
  DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
  DAILYENERGY_RELEASE_ID: "synthetic-api-playwright-v1",
  DAILYENERGY_RUNTIME_PROFILE: "API",
  DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
};

export default async function globalSetup() {
  const application = await createApiApplication(
    loadRuntimeConfig(environment),
    {
      adminAudienceVerifier: {
        verify: (authorization) => authorization === "Bearer synthetic-admin",
      },
      ordinaryLogSink: { write: () => undefined },
      publicAudienceVerifier: {
        verify: (authorization) => authorization === "Bearer synthetic-public",
      },
    },
  );
  await application.listen(0, "127.0.0.1");
  process.env.DAILYENERGY_API_E2E_BASE_URL = await application.getUrl();

  return async () => {
    await application.close();
  };
}
