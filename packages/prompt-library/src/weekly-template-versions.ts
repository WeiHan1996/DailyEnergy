/**
 * Version tokens of the controlled Weekly templates.
 *
 * Two different identities are deliberately kept apart:
 *
 * - `WEEKLY_PROMPT_RELEASE_TEMPLATE_VERSION` (`weekly-template-v1`) is the
 *   template version pinned by the Accepted Prompt release catalog and the
 *   AI-005 style policy. It is historical and immutable and is the value
 *   `compilePromptRequestV1` binds into the provider request trace.
 * - `WEEKLY_TEMPLATE_VERSION` (`weekly-template-v2`) is the identity of the
 *   Gateway template fallback. v1 was never run through the strict structured
 *   output validator and binds a different opening fact set, so it cannot be
 *   the fallback; v2 is validator-conformant. The Gateway only requires the
 *   invocation to equal its own route manifest's template version.
 */
export const WEEKLY_PROMPT_RELEASE_TEMPLATE_VERSION = "weekly-template-v1";
export const WEEKLY_TEMPLATE_VERSION = "weekly-template-v2";
export const WEEKLY_TEMPLATE_RENDERER_VERSION =
  "controlled-weekly-template-renderer-v2";
