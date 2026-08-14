import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { format } from "prettier";

import {
  buildDesignTokenArtifacts,
  canonicalJson,
  designTokenArtifactDiagnostic,
  resolvedTokenValue,
} from "./lib/design-token-codegen.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const source = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "apps/miniapp/design-tokens.json"),
    "utf8",
  ),
);
const build = await buildDesignTokenArtifacts(source);
const secondBuild = await buildDesignTokenArtifacts(
  JSON.parse(canonicalJson(source)),
);

function artifactParser(path) {
  if (path.endsWith(".css") || path.endsWith(".wxss")) {
    return "css";
  }
  if (path.endsWith(".json")) {
    return "json";
  }
  if (path.endsWith(".ts")) {
    return "typescript";
  }
  throw new Error(`TEST_ARTIFACT_FORMAT_UNSUPPORTED:${path}`);
}

function relativeLuminance(hex) {
  const channels = hex
    .match(/[0-9a-f]{2}/giu)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  assert.equal(
    channels?.length,
    3,
    `expected an opaque hex color, received ${hex}`,
  );
  return channels
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

assert.equal(build.fingerprint, secondBuild.fingerprint);
assert.deepEqual([...build.artifacts], [...secondBuild.artifacts]);
for (const [path, content] of build.artifacts) {
  assert.equal(
    await format(content, { parser: artifactParser(path) }),
    content,
    `${path} must be Prettier-idempotent`,
  );
}
assert.equal(
  designTokenArtifactDiagnostic("tokens.wxss", "same", "same"),
  undefined,
);
assert.equal(
  designTokenArtifactDiagnostic("tokens.wxss", undefined, "expected")?.ruleId,
  "DESIGN_TOKEN_ARTIFACT_MISSING",
);
assert.equal(
  designTokenArtifactDiagnostic("tokens.wxss", "changed", "expected")?.ruleId,
  "DESIGN_TOKEN_ARTIFACT_DRIFT",
);

const runtimeCss = build.artifacts.get(
  "apps/miniapp/src/generated/design-tokens.wxss",
);
assert.match(runtimeCss, /^\/\* @generated/u);
assert.match(runtimeCss, /source-fingerprint: sha256:[a-f0-9]{64}/u);
assert.doesNotMatch(runtimeCss, /--de-primitive-/u);
assert.match(runtimeCss, /--de-color-canvas:/u);
assert.match(runtimeCss, /--de-component-button-height: 48px/u);
assert.match(runtimeCss, /prefers-reduced-motion: reduce/u);
assert.equal(
  resolvedTokenValue(build, "semantic.default.color.textPrimary"),
  "#1B2C25",
);

const textContrastPairs = [
  ["textPrimary", "canvas"],
  ["textPrimary", "surfaceSecondary"],
  ["textSecondary", "canvas"],
  ["textSecondary", "surfaceSecondary"],
  ["textMuted", "canvas"],
  ["textInverse", "brandPrimary"],
  ["brandStrong", "brandSoft"],
  ["infoText", "infoSurface"],
  ["warningText", "warningSurface"],
  ["dangerText", "dangerSurface"],
  ["safetyText", "safetyCanvas"],
  ["textInverse", "safetyAction"],
];
const nonTextContrastPairs = [
  ["focus", "canvas"],
  ["brandPrimary", "canvas"],
  ["safetyBorder", "safetyCanvas"],
];

for (const mode of ["default", "highContrast"]) {
  for (const [foreground, background] of textContrastPairs) {
    const ratio = contrastRatio(
      resolvedTokenValue(build, `semantic.${mode}.color.${foreground}`),
      resolvedTokenValue(build, `semantic.${mode}.color.${background}`),
    );
    assert.ok(
      ratio >= 4.5,
      `${mode} ${foreground}/${background} contrast ${ratio.toFixed(2)} is below 4.5:1`,
    );
  }
  for (const [foreground, background] of nonTextContrastPairs) {
    const ratio = contrastRatio(
      resolvedTokenValue(build, `semantic.${mode}.color.${foreground}`),
      resolvedTokenValue(build, `semantic.${mode}.color.${background}`),
    );
    assert.ok(
      ratio >= 3,
      `${mode} ${foreground}/${background} contrast ${ratio.toFixed(2)} is below 3:1`,
    );
  }
}

const figmaImports = {
  component: JSON.parse(
    build.artifacts.get(
      "docs/design/assets/d002/figma-import/component/Value.json",
    ),
  ),
  default: JSON.parse(
    build.artifacts.get(
      "docs/design/assets/d002/figma-import/semantic-default/Default.json",
    ),
  ),
  highContrast: JSON.parse(
    build.artifacts.get(
      "docs/design/assets/d002/figma-import/semantic-high-contrast/High Contrast.json",
    ),
  ),
  primitive: JSON.parse(
    build.artifacts.get(
      "docs/design/assets/d002/figma-import/primitive/Value.json",
    ),
  ),
};

function assertFigmaAliasValuesResolved(value, path = []) {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (value.$extensions?.["com.figma.aliasData"] !== undefined) {
    assert.doesNotMatch(
      String(value.$value),
      /^\{.+\}$/u,
      `${path.join("/")} must use a resolved import value for its cross-collection alias`,
    );
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    assertFigmaAliasValuesResolved(entry, [...path, key]);
  }
}

for (const [name, figmaImport] of Object.entries(figmaImports)) {
  assertFigmaAliasValuesResolved(figmaImport, [name]);
}

assert.deepEqual(figmaImports.primitive.color.paper["50"].$value, {
  alpha: 1,
  colorSpace: "srgb",
  components: [248 / 255, 246 / 255, 239 / 255],
  hex: "#F8F6EF",
});
assert.deepEqual(figmaImports.primitive.motion.fast.$value, {
  unit: "s",
  value: 0.16,
});
assert.equal(figmaImports.primitive.size["viewport-height"].$type, "number");
assert.deepEqual(figmaImports.default.color.canvas.$value, {
  alpha: 1,
  colorSpace: "srgb",
  components: [248 / 255, 246 / 255, 239 / 255],
  hex: "#F8F6EF",
});
assert.deepEqual(
  figmaImports.default.color.canvas.$extensions["com.figma.aliasData"],
  {
    targetVariableName: "color/paper/50",
    targetVariableSetName: "DE / Primitive",
  },
);
assert.deepEqual(figmaImports.default.font["score-size"].$value, {
  unit: "px",
  value: 28,
});
assert.equal(
  figmaImports.highContrast.color["brand-primary"].$value.hex,
  "#174E3C",
);
assert.equal(
  figmaImports.highContrast.color["brand-primary"].$extensions,
  undefined,
);
assert.deepEqual(figmaImports.component.button.height.$value, {
  unit: "px",
  value: 48,
});
assert.deepEqual(
  figmaImports.component.button.height.$extensions["com.figma.aliasData"],
  {
    targetVariableName: "size/control",
    targetVariableSetName: "DE / Primitive",
  },
);

const modeDrift = structuredClone(source);
delete modeDrift.semantic.highContrast.color.focus;
await assert.rejects(
  () => buildDesignTokenArtifacts(modeDrift),
  /DESIGN_TOKEN_MODE_SHAPE_DRIFT/u,
);

const missingReference = structuredClone(source);
missingReference.component.button.height.value = "{primitive.size.missing}";
await assert.rejects(
  () => buildDesignTokenArtifacts(missingReference),
  /DESIGN_TOKEN_REFERENCE_MISSING/u,
);

const primitiveAlias = structuredClone(source);
primitiveAlias.primitive.size.control.value = "{primitive.size.touchTarget}";
await assert.rejects(
  () => buildDesignTokenArtifacts(primitiveAlias),
  /DESIGN_TOKEN_PRIMITIVE_ALIAS_FORBIDDEN/u,
);

const unexpectedSemanticRaw = structuredClone(source);
unexpectedSemanticRaw.semantic.default.color.canvas.value = "#F8F6EF";
await assert.rejects(
  () => buildDesignTokenArtifacts(unexpectedSemanticRaw),
  /DESIGN_TOKEN_SEMANTIC_RAW_VALUE_FORBIDDEN/u,
);

const sharedSemanticRaw = structuredClone(source);
sharedSemanticRaw.sharedSemantic.font.bodySize = {
  type: "dimension",
  unit: "px",
  value: 16,
};
await assert.rejects(
  () => buildDesignTokenArtifacts(sharedSemanticRaw),
  /DESIGN_TOKEN_SHARED_RAW_VALUE_FORBIDDEN/u,
);

const componentRaw = structuredClone(source);
componentRaw.component.button.height = {
  type: "dimension",
  unit: "px",
  value: 48,
};
await assert.rejects(
  () => buildDesignTokenArtifacts(componentRaw),
  /DESIGN_TOKEN_COMPONENT_RAW_VALUE_FORBIDDEN/u,
);

console.log(
  `Design-token fixtures passed deterministic generation, ${textContrastPairs.length * 2} text contrast pairs, ${nonTextContrastPairs.length * 2} non-text contrast pairs, and 8 known-fail/known-pass rules (${build.fingerprint}).`,
);
