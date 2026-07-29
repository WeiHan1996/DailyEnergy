import * as z from "zod";

export const WechatSessionRequestSchema = z
  .object({
    code: z.string().min(1).max(256),
    channel: z.string().min(1).max(64).optional(),
  })
  .strict();

export type WechatSessionRequest = z.infer<typeof WechatSessionRequestSchema>;
