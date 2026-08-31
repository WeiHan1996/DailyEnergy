import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import type { ProtectedEveningNote } from "@daily-energy/server-adapters/api";

export interface EveningNoteCodec {
  protect(value: string): ProtectedEveningNote;
  reveal(value: ProtectedEveningNote): string;
}

export class AesGcmEveningNoteCodec implements EveningNoteCodec {
  public constructor(
    private readonly key: Buffer,
    private readonly keyVersion: string,
  ) {
    if (key.length !== 32 || keyVersion.length < 1 || keyVersion.length > 64) {
      throw new Error("EVENING_NOTE_KEY_INVALID");
    }
  }

  public protect(value: string): ProtectedEveningNote {
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

  public reveal(value: ProtectedEveningNote): string {
    if (value.keyVersion !== this.keyVersion || value.ciphertext.length < 29) {
      throw new Error("EVENING_NOTE_DECRYPT_FAILED");
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
      throw new Error("EVENING_NOTE_DECRYPT_FAILED");
    }
  }
}

export function developmentEveningNoteCodec(): EveningNoteCodec {
  return new AesGcmEveningNoteCodec(
    createHash("sha256")
      .update("dailyenergy-c012-development-synthetic-evening-note-v1", "utf8")
      .digest(),
    "development-synthetic-evening-v1",
  );
}

export const UNAVAILABLE_EVENING_NOTE_CODEC: EveningNoteCodec = {
  protect: unavailable,
  reveal: unavailable,
};

function unavailable(): never {
  throw new Error("EVENING_NOTE_CODEC_UNAVAILABLE");
}
