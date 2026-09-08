import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  EXPRESSION_STYLE_POLICY_FINGERPRINT_V1,
  EXPRESSION_STYLE_POLICY_V1,
  EXPRESSION_STYLE_POLICY_VERSION,
  EXPRESSION_STYLE_SAMPLE_SET_VERSION,
  AuthoritativeExpressionStyleError,
  VisibleExpressionStyleValues,
  assertAuthoritativeExpressionStyleV1,
  classifySyntheticExpressionStyleV1,
  evaluateExpressionLanguageV1,
  fingerprintExpressionStyleJsonV1,
  resolveEffectiveExpressionStyleV1,
  resolveOptionalExpressionStylePreferenceV1,
  type ExpressionLanguageViolationCode,
  type VisibleExpressionStyle,
} from "./expression-style-policy.js";
import { DAILY_TEMPLATE_VERSION } from "./daily-template-registry.js";
import {
  DAILY_PROMPT_VERSION,
  PROMPT_RELEASE_CATALOG_V1,
  WEEKLY_PROMPT_VERSION,
} from "./prompt-package-registry.js";

interface CorpusSample {
  readonly action_signature: string;
  readonly fact_signature: string;
  readonly style: VisibleExpressionStyle;
  readonly text: string;
}

interface PersonalityCorpus {
  readonly corpus_fingerprint_sha256: string;
  readonly comparison_blocks: readonly {
    readonly samples: readonly CorpusSample[];
  }[];
  readonly evidence_boundary: {
    readonly pass_claim: string;
    readonly provider_calls: number;
  };
  readonly hard_negative_samples: readonly {
    readonly expected_code: ExpressionLanguageViolationCode;
    readonly text: string;
  }[];
  readonly policy_fingerprint_sha256: string;
  readonly policy_version: string;
  readonly sample_set_version: string;
  readonly synthetic_only: boolean;
  readonly thresholds: {
    readonly deterministic_blind_style_accuracy_min: number;
    readonly human_same_persona_score: string;
    readonly human_style_accuracy: string;
    readonly model_quality: string;
  };
}

const corpus = JSON.parse(
  await readFile(
    new URL(
      "../../../tests/ai-evaluation/ai005-personality-corpus.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as PersonalityCorpus;

describe("AI-005 expression style policy and synthetic corpus", () => {
  it("pins one immutable personality and version binding for all expression styles", () => {
    expect(EXPRESSION_STYLE_POLICY_V1.policyVersion).toBe(
      EXPRESSION_STYLE_POLICY_VERSION,
    );
    expect(EXPRESSION_STYLE_POLICY_V1.sampleSetVersion).toBe(
      EXPRESSION_STYLE_SAMPLE_SET_VERSION,
    );
    expect(EXPRESSION_STYLE_POLICY_FINGERPRINT_V1).toBe(
      "4c2c678baaf68bdd92cb3b769354b451f8122f5c5f5521fdebbb40e4f36ecb10",
    );
    expect(EXPRESSION_STYLE_POLICY_V1.policyFingerprint).toBe(
      EXPRESSION_STYLE_POLICY_FINGERPRINT_V1,
    );
    expect(EXPRESSION_STYLE_POLICY_V1.personalityId).toBe(
      "dailyenergy-digital-friend-v1",
    );
    expect(Object.isFrozen(EXPRESSION_STYLE_POLICY_V1)).toBe(true);
    expect(Object.isFrozen(EXPRESSION_STYLE_POLICY_V1.styles)).toBe(true);
    expect(
      Object.entries(EXPRESSION_STYLE_POLICY_V1.styles)
        .filter(([, value]) => value.visiblePreference)
        .map(([style]) => style),
    ).toEqual(VisibleExpressionStyleValues);
    expect(EXPRESSION_STYLE_POLICY_V1.bindings.daily).toEqual({
      promptVersion: DAILY_PROMPT_VERSION,
      templateVersion: DAILY_TEMPLATE_VERSION,
    });
    expect(EXPRESSION_STYLE_POLICY_V1.bindings.weekly).toEqual({
      promptVersion: WEEKLY_PROMPT_VERSION,
      templateVersion:
        PROMPT_RELEASE_CATALOG_V1.entries.WEEKLY_EXPRESSION_V1.templateVersion,
    });
  });

  it("maps warmth, humor and directness without changing the shared personality", () => {
    const styles = EXPRESSION_STYLE_POLICY_V1.styles;
    expect(styles.GENTLE.parameters.warmth).toBeGreaterThan(
      styles.BALANCED.parameters.warmth,
    );
    expect(styles.GENTLE.parameters.directness).toBeLessThan(
      styles.BALANCED.parameters.directness,
    );
    expect(styles.GENTLE.parameters.humor).toBeLessThan(
      styles.BALANCED.parameters.humor,
    );
    expect(styles.LIGHT_HUMOR.parameters.humor).toBeGreaterThan(
      styles.BALANCED.parameters.humor,
    );
    expect(styles.CLEAR_DIRECT.parameters.directness).toBeGreaterThan(
      styles.BALANCED.parameters.directness,
    );
    for (const profile of Object.values(styles)) {
      for (const value of Object.values(profile.parameters)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("defaults only optional preference projection and keeps authoritative snapshots strict", () => {
    expect(resolveOptionalExpressionStylePreferenceV1(undefined)).toEqual({
      reason: "MISSING",
      source: "SYSTEM_DEFAULT",
      style: "BALANCED",
    });
    expect(resolveOptionalExpressionStylePreferenceV1("CUSTOM_COACH")).toEqual({
      reason: "UNRECOGNIZED",
      source: "SYSTEM_DEFAULT",
      style: "BALANCED",
    });
    expect(resolveOptionalExpressionStylePreferenceV1("GENTLE")).toEqual({
      reason: "EXPLICIT",
      source: "USER_PREFERENCE",
      style: "GENTLE",
    });
    expect(() => assertAuthoritativeExpressionStyleV1("CUSTOM_COACH")).toThrow(
      AuthoritativeExpressionStyleError,
    );
  });

  it("lets care and uncertainty remove humor without changing the requested preference", () => {
    expect(
      resolveEffectiveExpressionStyleV1({
        humorCeiling: "NONE",
        requestedStyle: "LIGHT_HUMOR",
      }),
    ).toEqual({
      parameters: { directness: 50, humor: 0, warmth: 70 },
      policyVersion: EXPRESSION_STYLE_POLICY_VERSION,
      renderingStyle: "BALANCED",
      requestedStyle: "LIGHT_HUMOR",
    });
    expect(
      resolveEffectiveExpressionStyleV1({
        humorCeiling: "LIGHT",
        requestedStyle: "CLEAR_DIRECT",
      }).renderingStyle,
    ).toBe("CLEAR_DIRECT");
  });

  it("rejects every versioned shame, fear, overpraise, dependency and fragmentation negative", () => {
    for (const sample of corpus.hard_negative_samples) {
      const result = evaluateExpressionLanguageV1(sample.text);
      expect(result.status).toBe("REJECT");
      expect(result.violationCodes).toContain(sample.expected_code);
    }
  });

  it("keeps facts and actions identical while the blinded synthetic samples remain distinguishable", () => {
    let correct = 0;
    let total = 0;
    for (const block of corpus.comparison_blocks) {
      expect(
        new Set(block.samples.map(({ fact_signature: value }) => value)).size,
      ).toBe(1);
      expect(
        new Set(block.samples.map(({ action_signature: value }) => value)).size,
      ).toBe(1);
      expect(block.samples.map(({ style }) => style).sort()).toEqual(
        [...VisibleExpressionStyleValues].sort(),
      );
      for (const sample of block.samples) {
        expect(evaluateExpressionLanguageV1(sample.text).status).toBe("PASS");
        correct +=
          classifySyntheticExpressionStyleV1(sample.text) === sample.style
            ? 1
            : 0;
        total += 1;
      }
    }
    expect(correct / total).toBeGreaterThanOrEqual(
      corpus.thresholds.deterministic_blind_style_accuracy_min,
    );
  });

  it("pins the synthetic-only corpus and preserves MODEL/HUMAN/production pending states", () => {
    expect(corpus.policy_version).toBe(EXPRESSION_STYLE_POLICY_VERSION);
    expect(corpus.policy_fingerprint_sha256).toBe(
      EXPRESSION_STYLE_POLICY_FINGERPRINT_V1,
    );
    expect(corpus.sample_set_version).toBe(EXPRESSION_STYLE_SAMPLE_SET_VERSION);
    expect(corpus.synthetic_only).toBe(true);
    expect(corpus.evidence_boundary.provider_calls).toBe(0);
    expect(corpus.evidence_boundary.pass_claim).toBe(
      "PROHIBITED_UNTIL_AI_014_AND_AI_015",
    );
    expect(corpus.thresholds.human_style_accuracy).toBe("PENDING_AI_015");
    expect(corpus.thresholds.human_same_persona_score).toBe("PENDING_AI_015");
    expect(corpus.thresholds.model_quality).toBe("PENDING_AI_014");
    const { corpus_fingerprint_sha256: _fingerprint, ...source } = corpus;
    expect(corpus.corpus_fingerprint_sha256).toBe(
      fingerprintExpressionStyleJsonV1(source),
    );
  });
});
