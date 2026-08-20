import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import type { ProtectedPreferredName } from "@daily-energy/server-adapters/api";

export interface PreferredNameCodec {
  protect(value: string): ProtectedPreferredName;
  reveal(value: ProtectedPreferredName): string;
}

export class AesGcmPreferredNameCodec implements PreferredNameCodec {
  public constructor(
    private readonly key: Buffer,
    private readonly keyVersion: string,
  ) {
    if (
      key.length !== 32 ||
      keyVersion.length === 0 ||
      keyVersion.length > 64
    ) {
      throw new Error("PROFILE_NAME_KEY_INVALID");
    }
  }

  public protect(value: string): ProtectedPreferredName {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]),
      keyVersion: this.keyVersion,
    };
  }

  public reveal(value: ProtectedPreferredName): string {
    if (value.keyVersion !== this.keyVersion || value.ciphertext.length < 29) {
      throw new Error("PROFILE_NAME_DECRYPT_FAILED");
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
      throw new Error("PROFILE_NAME_DECRYPT_FAILED");
    }
  }
}

export function developmentPreferredNameCodec(): PreferredNameCodec {
  return new AesGcmPreferredNameCodec(
    createHash("sha256")
      .update("dailyenergy-c002-development-synthetic-profile-name-v1", "utf8")
      .digest(),
    "development-synthetic-profile-v1",
  );
}

export function preferredNameCodecFromSecret(
  secret: string,
  keyVersion: string,
): PreferredNameCodec {
  const normalized = secret.trim();
  const key = /^[a-f0-9]{64}$/iu.test(normalized)
    ? Buffer.from(normalized, "hex")
    : Buffer.from(normalized, "base64");
  return new AesGcmPreferredNameCodec(key, keyVersion);
}

export const UNAVAILABLE_PREFERRED_NAME_CODEC: PreferredNameCodec = {
  protect: unavailable,
  reveal: unavailable,
};

function unavailable(): never {
  throw new Error("PROFILE_NAME_CODEC_UNAVAILABLE");
}
