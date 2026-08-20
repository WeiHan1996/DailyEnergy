import { describe, expect, it } from "vitest";

import {
  AesGcmPreferredNameCodec,
  developmentPreferredNameCodec,
} from "./preferred-name-codec.js";

describe("C-002 preferred-name protection", () => {
  it("round-trips without storing plaintext and rejects ciphertext tampering", () => {
    const codec = developmentPreferredNameCodec();
    const protectedName = codec.protect("小晨");

    expect(protectedName.ciphertext.toString("utf8")).not.toContain("小晨");
    expect(codec.reveal(protectedName)).toBe("小晨");

    const tampered = Buffer.from(protectedName.ciphertext);
    const lastIndex = tampered.length - 1;
    tampered[lastIndex] = tampered[lastIndex]! ^ 1;
    expect(() =>
      codec.reveal({ ...protectedName, ciphertext: tampered }),
    ).toThrow("PROFILE_NAME_DECRYPT_FAILED");
  });

  it("fails closed for a wrong key size or key version", () => {
    expect(
      () => new AesGcmPreferredNameCodec(Buffer.alloc(16), "key-v1"),
    ).toThrow("PROFILE_NAME_KEY_INVALID");
    const codec = developmentPreferredNameCodec();
    const protectedName = codec.protect("晨晨");
    expect(() =>
      codec.reveal({ ...protectedName, keyVersion: "unapproved-key" }),
    ).toThrow("PROFILE_NAME_DECRYPT_FAILED");
  });
});
