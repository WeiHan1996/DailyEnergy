import { describe, expect, it } from "vitest";

import {
  ClientDailyContentViewSchema,
  DailyInteractionStateSchema,
  ExpressionPayloadSchema,
  GenerationInputSnapshotSchema,
  ProductDateSchema,
  PublishedDailyResultSchema,
  Rfc3339TimestampSchema,
  RuleFactsSchema,
} from "../src/index.js";
import {
  clientDailyContentViewFixture,
  cloneFixture,
  generationInputSnapshotFixture,
  publishedDailyResultFixture,
} from "./fixtures.js";

describe("daily content contracts", () => {
  it("accepts the Accepted generation snapshot example", () => {
    expect(
      GenerationInputSnapshotSchema.safeParse(generationInputSnapshotFixture)
        .success,
    ).toBe(true);
  });

  it("accepts the Accepted published and client examples", () => {
    expect(
      PublishedDailyResultSchema.safeParse(publishedDailyResultFixture).success,
    ).toBe(true);
    expect(
      ClientDailyContentViewSchema.safeParse(clientDailyContentViewFixture)
        .success,
    ).toBe(true);
  });

  it("accepts every remaining daily root schema independently", () => {
    expect(
      RuleFactsSchema.safeParse(publishedDailyResultFixture.facts).success,
    ).toBe(true);
    expect(
      ExpressionPayloadSchema.safeParse(publishedDailyResultFixture.expression)
        .success,
    ).toBe(true);
    expect(
      DailyInteractionStateSchema.safeParse({
        contract: "daily-interaction-state",
        schema_version: "1.0.0",
        result_id: "dr_example_20260720",
        product_date: "2026-07-20",
        is_lit: true,
        task: {
          task_id: "task_close_one_background",
          revision: 1,
          status: "UNMARKED",
        },
        helpfulness: { revision: 0, rating: "UNRATED" },
        updated_at: "2026-07-20T08:10:00Z",
      }).success,
    ).toBe(true);
  });

  it("accepts controlled-template and reduced-personalization variants", () => {
    const published = cloneFixture(publishedDailyResultFixture);
    published.provenance.generation_mode = "CONTROLLED_TEMPLATE";
    published.provenance.personalization_level = "REDUCED";
    const provenance = published.provenance as Record<string, unknown>;
    provenance.template_version = "daily-template-v1";
    delete provenance.prompt_version;
    delete provenance.provider;
    delete provenance.model;
    expect(PublishedDailyResultSchema.safeParse(published).success).toBe(true);

    const client = cloneFixture(clientDailyContentViewFixture);
    client.personalization_notice = "PERSONALIZATION_REDUCED";
    expect(ClientDailyContentViewSchema.safeParse(client).success).toBe(true);
  });

  it("rejects impossible product dates and timestamps without a timezone", () => {
    expect(ProductDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(
      Rfc3339TimestampSchema.safeParse("2026-07-20T08:05:00").success,
    ).toBe(false);
  });

  it("rejects unknown fields and null", () => {
    expect(
      GenerationInputSnapshotSchema.safeParse({
        ...generationInputSnapshotFixture,
        raw_wechat_token: "secret",
      }).success,
    ).toBe(false);
    const published = cloneFixture(publishedDailyResultFixture);
    (published.expression as Record<string, unknown>).closing = null;
    expect(PublishedDailyResultSchema.safeParse(published).success).toBe(false);
  });

  it("enforces canonical dimensions, display order, and focus", () => {
    const published = cloneFixture(publishedDailyResultFixture);
    [published.facts.dimensions[0], published.facts.dimensions[1]] = [
      published.facts.dimensions[1]!,
      published.facts.dimensions[0]!,
    ];
    expect(PublishedDailyResultSchema.safeParse(published).success).toBe(false);

    const duplicated = cloneFixture(publishedDailyResultFixture);
    duplicated.facts.display_order[4] = "pace";
    expect(PublishedDailyResultSchema.safeParse(duplicated).success).toBe(
      false,
    );

    const client = cloneFixture(clientDailyContentViewFixture);
    client.dimensions[0]!.is_focus = false;
    client.dimensions[1]!.is_focus = true;
    expect(ClientDailyContentViewSchema.safeParse(client).success).toBe(false);
  });

  it("enforces action, task, and ritual references", () => {
    const action = cloneFixture(publishedDailyResultFixture);
    action.expression.primary_action.action_id = "act_not_selected";
    expect(PublishedDailyResultSchema.safeParse(action).success).toBe(false);

    const task = cloneFixture(publishedDailyResultFixture);
    task.expression.optional_task.task_id = "task_unknown";
    expect(PublishedDailyResultSchema.safeParse(task).success).toBe(false);

    const ritual = cloneFixture(publishedDailyResultFixture);
    delete (ritual.expression.ritual_notes as Record<string, unknown>)
      .ritual_number_4;
    expect(PublishedDailyResultSchema.safeParse(ritual).success).toBe(false);
  });

  it("enforces band label tokens and generated-text safety", () => {
    const band = cloneFixture(publishedDailyResultFixture);
    band.facts.overall.label_token = "ROOM_TO_MOVE";
    expect(PublishedDailyResultSchema.safeParse(band).success).toBe(false);

    const unsafe = cloneFixture(publishedDailyResultFixture);
    unsafe.expression.closing = "今天看看 https://example.com 再决定。";
    expect(PublishedDailyResultSchema.safeParse(unsafe).success).toBe(false);
  });

  it("enforces total character budgets in addition to field budgets", () => {
    const value = cloneFixture(publishedDailyResultFixture);
    const text = (character: string, length: number) =>
      character.repeat(length);
    value.expression.greeting = text("早", 24);
    value.expression.state_response = text("稳", 60);
    value.expression.overall_summary = text("缓", 30);
    value.expression.core_tip = text("轻", 50);
    value.expression.explanation_paragraphs = [text("先", 70), text("再", 70)];
    value.expression.dimension_explanations = {
      pace: text("节", 35),
      action: text("行", 35),
      connection: text("沟", 35),
      resources: text("排", 35),
      recovery: text("休", 35),
    };
    value.expression.primary_action.instruction = text("做", 45);
    value.expression.primary_action.rationale = text("因", 35);
    value.expression.primary_action.constraint_label = text("限", 16);
    value.expression.optional_task.instruction = text("写", 35);
    value.expression.ritual_notes.ritual_color_sage = text("色", 24);
    value.expression.ritual_notes.ritual_number_4 = text("数", 24);
    value.expression.closing = text("收", 30);
    expect(PublishedDailyResultSchema.safeParse(value).success).toBe(false);
  });

  it("keeps internal scores out of the explicit client view", () => {
    const client = cloneFixture(clientDailyContentViewFixture);
    (client.dimensions[0] as Record<string, unknown>).score = 43;
    expect(ClientDailyContentViewSchema.safeParse(client).success).toBe(false);
  });
});
