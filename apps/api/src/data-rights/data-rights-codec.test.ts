import { describe, expect, it } from "vitest";

import { AesGcmMatterTitleCodec } from "./data-rights-codec.js";

describe("AI-008 matter title codec", () => {
  const codec = new AesGcmMatterTitleCodec(
    Buffer.alloc(32, 4),
    "matter-key-v1",
  );

  it("round-trips ciphertext with a random IV and stable keyed fingerprint", () => {
    const first = codec.protect("周五做项目汇报");
    const second = codec.protect("周五做项目汇报");
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
    expect(codec.reveal(first)).toBe("周五做项目汇报");
    expect(codec.fingerprint("周五做项目汇报")).toEqual(
      codec.fingerprint("周五做项目汇报"),
    );
    expect(codec.fingerprint("周五做项目汇报")).not.toEqual(
      codec.fingerprint("周六做项目汇报"),
    );
  });

  it("rejects key-version drift and ciphertext tampering", () => {
    const protectedTitle = codec.protect("准备下周的展示");
    const tampered = Buffer.from(protectedTitle.ciphertext);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1;
    expect(() =>
      codec.reveal({ ...protectedTitle, ciphertext: tampered }),
    ).toThrowError("MATTER_TITLE_DECRYPT_FAILED");
    expect(() =>
      codec.reveal({ ...protectedTitle, keyVersion: "matter-key-v2" }),
    ).toThrowError("MATTER_TITLE_DECRYPT_FAILED");
  });
});
