export const MINIAPP_PLATFORM_ERROR_CODES = [
  "LOGIN_FAILED",
  "NETWORK_FAILED",
  "NETWORK_PATH_INVALID",
  "SHARE_PAYLOAD_INVALID",
  "STORAGE_FAILED",
  "STORAGE_KEY_INVALID",
  "SUBSCRIPTION_FAILED",
  "SUBSCRIPTION_REQUEST_INVALID",
] as const;

export type MiniappPlatformErrorCode =
  (typeof MINIAPP_PLATFORM_ERROR_CODES)[number];

export class MiniappPlatformError extends Error {
  public constructor(public readonly code: MiniappPlatformErrorCode) {
    super(code);
    this.name = "MiniappPlatformError";
  }
}
