import "server-only";

import { cookies } from "next/headers";

import type { AdminRuntimeConfig } from "./admin-runtime-policy";

export async function readAdminSessionToken(
  runtime: AdminRuntimeConfig,
): Promise<string | undefined> {
  if (runtime.availability.status !== "ready") {
    return undefined;
  }

  const cookieStore = await cookies();
  return cookieStore.get(runtime.session.cookieName)?.value;
}
