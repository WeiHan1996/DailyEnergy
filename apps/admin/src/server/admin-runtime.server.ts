import "server-only";

import {
  evaluateAdminRuntime,
  type AdminRuntimeConfig,
} from "./admin-runtime-policy";

export function getAdminServerRuntime(): AdminRuntimeConfig {
  return evaluateAdminRuntime(process.env, {
    // E-005 deliberately does not implement or register a real SSO adapter.
    trustedIdentityAdapterAvailable: false,
  });
}
