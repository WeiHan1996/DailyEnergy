import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

export const DEVELOPMENT_SUBJECT_KEY_VERSION = "development-synthetic-v1";

const DEVELOPMENT_SUBJECT_KEY = createHash("sha256")
  .update("dailyenergy-c001-development-synthetic-identity-v1", "utf8")
  .digest();

export function protectDevelopmentSubject(subject: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", DEVELOPMENT_SUBJECT_KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(subject, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function unprotectDevelopmentSubject(
  ciphertext: Buffer,
  keyVersion: string,
): string {
  if (
    keyVersion !== DEVELOPMENT_SUBJECT_KEY_VERSION ||
    ciphertext.byteLength < 29
  ) {
    throw new Error("STABLE_SUBJECT_KEY_UNAVAILABLE");
  }
  try {
    const iv = ciphertext.subarray(0, 12);
    const tag = ciphertext.subarray(12, 28);
    const encrypted = ciphertext.subarray(28);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      DEVELOPMENT_SUBJECT_KEY,
      iv,
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("STABLE_SUBJECT_DECRYPT_FAILED");
  }
}

export function developmentSubjectLookupToken(
  providerCode: string,
  subject: string,
): Buffer {
  return createHmac("sha256", DEVELOPMENT_SUBJECT_KEY)
    .update(providerCode, "utf8")
    .update("\u0000", "utf8")
    .update(subject, "utf8")
    .digest();
}
