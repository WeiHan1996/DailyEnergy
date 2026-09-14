import {
  MatterCreateRequestSchema,
  MatterDeleteCommandRequestSchema,
  MatterListViewSchema,
  MatterTitleSchema,
  MatterTransitionRequestSchema,
  MatterUpdateRequestSchema,
  MatterViewSchema,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const commandRef = "01JABCDEFGHJKMNPQRSTVWXYZ";

describe("AI-008 matter contracts", () => {
  it("accepts a normalized bounded title and rejects malformed text", () => {
    expect(MatterTitleSchema.parse("周五做项目汇报")).toBe("周五做项目汇报");
    for (const invalid of [
      "",
      " 外圈空格",
      "多\n行",
      "e\u0301",
      "🙂".repeat(81),
    ]) {
      expect(MatterTitleSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("keeps create and update commands closed and unambiguous", () => {
    expect(
      MatterCreateRequestSchema.safeParse({
        command_ref: commandRef,
        daily_use_granted: true,
        title: "周五做项目汇报",
        weekly_use_granted: false,
      }).success,
    ).toBe(true);
    expect(
      MatterCreateRequestSchema.safeParse({
        account_id: "forged",
        command_ref: commandRef,
        daily_use_granted: false,
        title: "周五做项目汇报",
        weekly_use_granted: false,
      }).success,
    ).toBe(false);
    expect(
      MatterUpdateRequestSchema.safeParse({
        command_ref: commandRef,
        expected_revision: 1,
      }).success,
    ).toBe(false);
    expect(
      MatterUpdateRequestSchema.safeParse({
        clear_target_date: true,
        command_ref: commandRef,
        expected_revision: 1,
        target_date: "2026-09-12",
      }).success,
    ).toBe(false);
  });

  it("requires CAS and explicit deletion confirmation", () => {
    expect(
      MatterTransitionRequestSchema.safeParse({
        command_ref: commandRef,
        expected_revision: 2,
      }).success,
    ).toBe(true);
    expect(
      MatterDeleteCommandRequestSchema.safeParse({
        command_ref: commandRef,
        confirmation_version: "data-rights-matter-v1",
        confirmed: true,
        expected_revision: 2,
      }).success,
    ).toBe(true);
    expect(
      MatterDeleteCommandRequestSchema.safeParse({
        command_ref: commandRef,
        confirmation_version: "data-rights-matter-v1",
        confirmed: false,
        expected_revision: 2,
      }).success,
    ).toBe(false);
  });

  it("exposes only the user-managed matter projection", () => {
    const matter = {
      daily_use_granted: true,
      matter_ref: "matter-ref-one",
      revision: 3,
      status: "ACTIVE",
      target_date: "2026-09-12",
      title: "周五做项目汇报",
      updated_at: "2026-09-09T10:00:00+08:00",
      weekly_use_granted: false,
    };
    expect(MatterViewSchema.safeParse(matter).success).toBe(true);
    expect(
      MatterViewSchema.safeParse({ ...matter, title_ciphertext: "secret" })
        .success,
    ).toBe(false);
    expect(
      MatterListViewSchema.safeParse({
        items: [matter],
        page_info: { has_more: false },
      }).success,
    ).toBe(true);
  });
});
