const REQUIRED_COMPONENT_FILES = [
  "index.json",
  "index.ts",
  "index.wxml",
  "index.wxss",
];
const ALLOWED_HEX_PATHS = new Set([
  "apps/miniapp/src/generated/design-tokens.wxss",
]);
const HEX_COLOR_PATTERN = /#[0-9a-f]{3,8}\b/iu;
const RAW_PIXEL_PATTERN = /:\s*-?\d+(?:\.\d+)?(?:px|rpx|vh|vw)\b/iu;
const REQUIRED_ACCESSIBILITY_SIGNALS = {
  "choice-chip": ["aria-checked", "已选", "✓"],
  "confirm-sheet": ["aria-modal", "此操作可能无法撤销"],
  "inline-notice": ["aria-live", 'aria-role="status"'],
  "loading-skeleton": ["aria-busy", "prefers-reduced-motion"],
  "offline-state": ["离线内容", "上次同步"],
  "recoverable-error": ["aria-live", "已经保存的内容仍然保留"],
  "state-selector": ["aria-checked", "已选", "aria-live"],
};
const SAFETY_COPY_PROPERTIES = [
  "accessibleLabel",
  "actionLoadingLabel",
  "emergencyActionAccessibleLabel",
  "emergencyActionLabel",
  "eyebrow",
  "immediateLabel",
  "message",
  "resourcesLoadingLabel",
  "resourcesTitle",
  "resourcesUnavailableLabel",
  "title",
  "trustedPersonAccessibleLabel",
  "trustedPersonLabel",
];
const SAFETY_TYPESCRIPT_SIGNALS = [
  'this.triggerEvent("emergency")',
  'this.triggerEvent("trustedperson")',
];
const SAFETY_STRUCTURE_PROPERTY_PATTERNS = {
  resources:
    /\bresources\s*:\s*\{\s*type:\s*Array\s*,\s*value:\s*\[\](?:\s+as\s+string\[\])?\s*,?\s*\}/u,
  resourcesLoading:
    /\bresourcesLoading\s*:\s*\{\s*type:\s*Boolean\s*,\s*value:\s*false\s*,?\s*\}/u,
  resourcesUnavailable:
    /\bresourcesUnavailable\s*:\s*\{\s*type:\s*Boolean\s*,\s*value:\s*false\s*,?\s*\}/u,
};
const SAFETY_WXML_SIGNALS = [
  'aria-label="{{accessibleLabel}}"',
  'aria-role="main"',
  "{{eyebrow}}",
  "{{title}}",
  "{{message}}",
  "{{immediateLabel}}",
  'accessible-label="{{emergencyActionAccessibleLabel}}"',
  'label="{{emergencyActionLabel}}"',
  'loading-label="{{actionLoadingLabel}}"',
  'bind:press="handleEmergency"',
  'accessible-label="{{trustedPersonAccessibleLabel}}"',
  'label="{{trustedPersonLabel}}"',
  'bind:press="handleTrustedPerson"',
  "{{resourcesTitle}}",
  'aria-live="polite"',
  'wx:if="{{resourcesLoading}}"',
  "{{resourcesLoadingLabel}}",
  'wx:elif="{{resourcesUnavailable}}"',
  "{{resourcesUnavailableLabel}}",
  'wx:for="{{resources}}"',
  "{{item}}",
];
const SAFETY_NON_EMPTY_DEFAULT_PATTERN = /\bvalue\s*:\s*(?:"[^"]+"|'[^']+')/u;
const SAFETY_LITERAL_LABEL_PATTERN =
  /\b(?:aria-label|accessible-label|label|loading-label)="(?!\{\{)[^"]+"/u;

function diagnostic(ruleId, path, message) {
  return { message, path, ruleId };
}

function hasSafetyLiteralText(wxml) {
  return [...wxml.matchAll(/>([^<]+)</gu)].some(([, text]) => {
    const literal = text
      .replace(/\{\{[^}]+\}\}/gu, "")
      .replace(/!/gu, "")
      .replace(/\s+/gu, "");
    return literal.length > 0;
  });
}

function checkSafetyCopyBoundary(entries, diagnostics) {
  const typescriptPath = "apps/miniapp/src/components/safety-screen/index.ts";
  const wxmlPath = "apps/miniapp/src/components/safety-screen/index.wxml";
  const typescript = entries.get(typescriptPath) ?? "";
  const wxml = entries.get(wxmlPath) ?? "";

  for (const property of SAFETY_COPY_PROPERTIES) {
    const emptyProperty = new RegExp(
      `\\b${property}\\s*:\\s*\\{\\s*type:\\s*String\\s*,\\s*value:\\s*""\\s*,?\\s*\\}`,
      "u",
    );
    if (!emptyProperty.test(typescript)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
          typescriptPath,
          `SafetyScreen copy property must be injected with an empty default: ${property}`,
        ),
      );
    }
  }

  if (SAFETY_NON_EMPTY_DEFAULT_PATTERN.test(typescript)) {
    diagnostics.push(
      diagnostic(
        "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
        typescriptPath,
        "SafetyScreen must not ship non-empty string property defaults",
      ),
    );
  }

  for (const signal of SAFETY_TYPESCRIPT_SIGNALS) {
    if (!typescript.includes(signal)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
          typescriptPath,
          `SafetyScreen event contract is missing: ${signal}`,
        ),
      );
    }
  }

  for (const [property, pattern] of Object.entries(
    SAFETY_STRUCTURE_PROPERTY_PATTERNS,
  )) {
    if (!pattern.test(typescript)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
          typescriptPath,
          `SafetyScreen resource state property is missing: ${property}`,
        ),
      );
    }
  }

  for (const signal of SAFETY_WXML_SIGNALS) {
    if (!wxml.includes(signal)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
          wxmlPath,
          `SafetyScreen injected copy or structure binding is missing: ${signal}`,
        ),
      );
    }
  }

  if (wxml.split('loading-label="{{actionLoadingLabel}}"').length - 1 !== 2) {
    diagnostics.push(
      diagnostic(
        "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
        wxmlPath,
        "SafetyScreen must inject the loading label into both action buttons",
      ),
    );
  }

  if (hasSafetyLiteralText(wxml) || SAFETY_LITERAL_LABEL_PATTERN.test(wxml)) {
    diagnostics.push(
      diagnostic(
        "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
        wxmlPath,
        "SafetyScreen WXML must not embed user-visible Safety copy or labels",
      ),
    );
  }
}

export function runMiniappDesignSystemGate({ componentLibrary, files }) {
  const diagnostics = [];
  const entries = new Map(files.map((file) => [file.path, file.content]));
  const components = componentLibrary?.components;
  if (
    componentLibrary?.schemaVersion !== 1 ||
    !Array.isArray(components) ||
    components.length !== 17
  ) {
    diagnostics.push(
      diagnostic(
        "MINIAPP_DESIGN_COMPONENT_MANIFEST",
        "apps/miniapp/component-library.json",
        "component library must declare the 17 D-002 components",
      ),
    );
    return diagnostics;
  }

  const names = new Set();
  for (const component of components) {
    if (
      typeof component.name !== "string" ||
      typeof component.figmaName !== "string" ||
      typeof component.path !== "string" ||
      !Array.isArray(component.variants) ||
      component.variants.length === 0 ||
      !Array.isArray(component.states) ||
      component.states.length === 0
    ) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_DESIGN_COMPONENT_ENTRY",
          "apps/miniapp/component-library.json",
          "each component requires stable code/Figma names, variants, and states",
        ),
      );
      continue;
    }
    if (names.has(component.name)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_DESIGN_COMPONENT_DUPLICATE",
          "apps/miniapp/component-library.json",
          `component name is duplicated: ${component.name}`,
        ),
      );
    }
    names.add(component.name);
    for (const fileName of REQUIRED_COMPONENT_FILES) {
      const path = `apps/miniapp/src/components/${component.path}/${fileName}`;
      if (!entries.has(path)) {
        diagnostics.push(
          diagnostic(
            "MINIAPP_DESIGN_COMPONENT_FILE_MISSING",
            path,
            `${component.name} requires ${fileName}`,
          ),
        );
      }
    }
  }

  for (const file of files) {
    if (
      file.path.startsWith("apps/miniapp/src/") &&
      file.path.endsWith(".wxss") &&
      !ALLOWED_HEX_PATHS.has(file.path) &&
      HEX_COLOR_PATTERN.test(file.content)
    ) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_DESIGN_RAW_COLOR",
          file.path,
          "runtime WXSS must consume semantic/component tokens instead of raw colors",
        ),
      );
    }
    if (
      file.path.startsWith("apps/miniapp/src/") &&
      file.path.endsWith(".wxss") &&
      !ALLOWED_HEX_PATHS.has(file.path) &&
      RAW_PIXEL_PATTERN.test(file.content)
    ) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_DESIGN_RAW_DIMENSION",
          file.path,
          "runtime WXSS must consume semantic/component tokens instead of raw dimensions",
        ),
      );
    }
  }

  for (const [componentPath, signals] of Object.entries(
    REQUIRED_ACCESSIBILITY_SIGNALS,
  )) {
    const content = [...entries.entries()]
      .filter(([path]) => path.includes(`/components/${componentPath}/`))
      .map(([, value]) => value)
      .join("\n");
    for (const signal of signals) {
      if (!content.includes(signal)) {
        diagnostics.push(
          diagnostic(
            "MINIAPP_DESIGN_ACCESSIBILITY_SIGNAL",
            `apps/miniapp/src/components/${componentPath}`,
            `required non-color/accessibility signal is missing: ${signal}`,
          ),
        );
      }
    }
  }
  checkSafetyCopyBoundary(entries, diagnostics);
  return diagnostics;
}

export const MINIAPP_DESIGN_SYSTEM_RULE_IDS = Object.freeze([
  "MINIAPP_DESIGN_ACCESSIBILITY_SIGNAL",
  "MINIAPP_DESIGN_COMPONENT_DUPLICATE",
  "MINIAPP_DESIGN_COMPONENT_ENTRY",
  "MINIAPP_DESIGN_COMPONENT_FILE_MISSING",
  "MINIAPP_DESIGN_COMPONENT_MANIFEST",
  "MINIAPP_DESIGN_RAW_COLOR",
  "MINIAPP_DESIGN_RAW_DIMENSION",
  "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
]);
