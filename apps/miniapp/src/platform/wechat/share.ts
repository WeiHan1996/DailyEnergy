import { MiniappPlatformError } from "../errors.js";
import type {
  ShareAppMessage,
  ShareAppMessageInput,
  SharePort,
} from "../ports.js";

const sharePathPattern = /^\/pages\/[a-z0-9/_-]+(?:\?[a-z0-9%&=_-]+)?$/iu;

export function createWechatSharePort(): SharePort {
  return Object.freeze({
    createAppMessage(input: ShareAppMessageInput): ShareAppMessage {
      const title = input.title.trim();
      if (
        title.length === 0 ||
        title.length > 60 ||
        !sharePathPattern.test(input.path)
      ) {
        throw new MiniappPlatformError("SHARE_PAYLOAD_INVALID");
      }
      return Object.freeze({
        ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
        path: input.path,
        title,
      });
    },
  });
}
