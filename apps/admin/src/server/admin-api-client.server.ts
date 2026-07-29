import "server-only";

import {
  createAdminApiClient,
  type AdminApiClient,
} from "@daily-energy/api-client/admin";

import { createAdminFetchTransport } from "./admin-api-transport";
import { getAdminServerRuntime } from "./admin-runtime.server";
import { readAdminSessionToken } from "./admin-session.server";

export async function createAdminServerApiClient(): Promise<AdminApiClient> {
  const runtime = getAdminServerRuntime();
  if (
    runtime.availability.status !== "ready" ||
    runtime.apiOrigin === undefined
  ) {
    throw new Error("ADMIN_RUNTIME_DISABLED");
  }

  const sessionToken = await readAdminSessionToken(runtime);
  return createAdminApiClient(
    createAdminFetchTransport({
      apiOrigin: runtime.apiOrigin,
      ...(sessionToken === undefined ? {} : { sessionToken }),
    }),
  );
}
