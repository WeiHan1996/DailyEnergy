import { createDecipheriv, createHash, createHmac } from "node:crypto";

import type { ProtectedExportText } from "@daily-energy/server-adapters/api";

export interface MatterTitleCodec {
  reveal(value: ProtectedExportText): string;
}

export class AesGcmMatterTitleCodec implements MatterTitleCodec {
  public constructor(
    private readonly key: Buffer,
    private readonly keyVersion: string,
  ) {
    if (key.length !== 32 || keyVersion.length < 1 || keyVersion.length > 64) {
      throw new Error("MATTER_TITLE_KEY_INVALID");
    }
  }

  public reveal(value: ProtectedExportText): string {
    if (value.keyVersion !== this.keyVersion || value.ciphertext.length < 29) {
      throw new Error("MATTER_TITLE_DECRYPT_FAILED");
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        value.ciphertext.subarray(0, 12),
      );
      decipher.setAuthTag(value.ciphertext.subarray(12, 28));
      return Buffer.concat([
        decipher.update(value.ciphertext.subarray(28)),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error("MATTER_TITLE_DECRYPT_FAILED");
    }
  }
}

export interface DeletionStatusTokenIssuer {
  issue(input: {
    readonly accountId: string;
    readonly challengeRef: string;
    readonly commandRef: string;
  }): string;
}

export class HmacDeletionStatusTokenIssuer implements DeletionStatusTokenIssuer {
  public constructor(private readonly key: Buffer) {
    if (key.length !== 32) {
      throw new Error("DELETION_STATUS_TOKEN_KEY_INVALID");
    }
  }

  public issue(input: {
    readonly accountId: string;
    readonly challengeRef: string;
    readonly commandRef: string;
  }): string {
    return createHmac("sha256", this.key)
      .update("deletion-status-v1\0", "utf8")
      .update(input.accountId, "utf8")
      .update("\0", "utf8")
      .update(input.challengeRef, "utf8")
      .update("\0", "utf8")
      .update(input.commandRef, "utf8")
      .digest("base64url");
  }
}

export function developmentMatterTitleCodec(): MatterTitleCodec {
  return new AesGcmMatterTitleCodec(
    createHash("sha256")
      .update("dailyenergy-c014-development-synthetic-matter-title-v1", "utf8")
      .digest(),
    "development-synthetic-matter-v1",
  );
}

export function developmentDeletionStatusTokenIssuer(): DeletionStatusTokenIssuer {
  return new HmacDeletionStatusTokenIssuer(
    createHash("sha256")
      .update("dailyenergy-c014-development-status-token-v1", "utf8")
      .digest(),
  );
}

export function deletionStatusTokenHash(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export function deletionStatusTokenFromAuthorization(
  authorization: string | undefined,
): string | undefined {
  const match = /^DeletionStatus ([A-Za-z0-9_-]{32,256})$/u.exec(
    authorization ?? "",
  );
  return match?.[1];
}

export const UNAVAILABLE_MATTER_TITLE_CODEC: MatterTitleCodec = {
  reveal: unavailable,
};

export const UNAVAILABLE_DELETION_STATUS_TOKEN_ISSUER: DeletionStatusTokenIssuer =
  { issue: unavailable };

function unavailable(): never {
  throw new Error("DATA_RIGHTS_CODEC_UNAVAILABLE");
}
