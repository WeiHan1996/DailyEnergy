import { createHash } from "node:crypto";

import { format, version as prettierVersion } from "prettier";

const TOKEN_TYPES = new Set([
  "color",
  "dimension",
  "duration",
  "fontFamily",
  "fontWeight",
  "number",
  "shadow",
]);
const REFERENCE_PATTERN = /^\{([A-Za-z0-9.]+)\}$/u;
const GENERATOR_VERSION = "daily-energy-design-tokens-v4";
const MODE_DIRECT_COLOR_PATHS = new Set([
  "semantic.default.color.overlay",
  "semantic.highContrast.color.brandPrimary",
  "semantic.highContrast.color.brandSoft",
  "semantic.highContrast.color.brandStrong",
  "semantic.highContrast.color.borderDefault",
  "semantic.highContrast.color.borderStrong",
  "semantic.highContrast.color.borderSubtle",
  "semantic.highContrast.color.dangerBorder",
  "semantic.highContrast.color.dangerSurface",
  "semantic.highContrast.color.dangerText",
  "semantic.highContrast.color.focus",
  "semantic.highContrast.color.infoBorder",
  "semantic.highContrast.color.infoSurface",
  "semantic.highContrast.color.infoText",
  "semantic.highContrast.color.overlay",
  "semantic.highContrast.color.safetyAction",
  "semantic.highContrast.color.safetyBorder",
  "semantic.highContrast.color.surfaceDisabled",
  "semantic.highContrast.color.surfaceSecondary",
  "semantic.highContrast.color.textMuted",
  "semantic.highContrast.color.textSecondary",
  "semantic.highContrast.color.warningBorder",
  "semantic.highContrast.color.warningSurface",
  "semantic.highContrast.color.warningText",
]);

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

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
  throw new Error(`DESIGN_TOKEN_ARTIFACT_FORMAT_UNSUPPORTED:${path}`);
}

async function formatArtifacts(artifacts) {
  return new Map(
    await Promise.all(
      [...artifacts].map(async ([path, content]) => [
        path,
        await format(content, { parser: artifactParser(path) }),
      ]),
    ),
  );
}

function isToken(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.type === "string" &&
    Object.hasOwn(value, "value")
  );
}

function flattenTokens(value, prefix = [], result = new Map()) {
  for (const [key, entry] of Object.entries(value)) {
    const path = [...prefix, key];
    if (isToken(entry)) {
      result.set(path.join("."), { ...entry, path });
      continue;
    }
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`DESIGN_TOKEN_TREE_INVALID:${path.join(".")}`);
    }
    flattenTokens(entry, path, result);
  }
  return result;
}

function assertToken(token, path) {
  if (!TOKEN_TYPES.has(token.type)) {
    throw new Error(`DESIGN_TOKEN_TYPE_INVALID:${path}:${token.type}`);
  }
  const reference =
    typeof token.value === "string"
      ? token.value.match(REFERENCE_PATTERN)
      : null;
  if (reference !== null) {
    return;
  }
  if (["dimension", "duration"].includes(token.type)) {
    if (
      typeof token.value !== "number" ||
      !["ms", "px", "vh"].includes(token.unit)
    ) {
      throw new Error(`DESIGN_TOKEN_UNIT_INVALID:${path}`);
    }
    return;
  }
  if (["fontWeight", "number"].includes(token.type)) {
    if (typeof token.value !== "number") {
      throw new Error(`DESIGN_TOKEN_NUMBER_INVALID:${path}`);
    }
    return;
  }
  if (typeof token.value !== "string" || token.value.length === 0) {
    throw new Error(`DESIGN_TOKEN_VALUE_INVALID:${path}`);
  }
}

function cssName(path) {
  return `--de-${path
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replaceAll(".", "-")
    .toLowerCase()}`;
}

function figmaName(path) {
  return path
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .split(".")
    .map((part) => part.replaceAll(" ", "-"))
    .join("/")
    .toLowerCase();
}

function formatCssValue(token) {
  if (["dimension", "duration"].includes(token.type)) {
    return `${token.value}${token.unit}`;
  }
  return String(token.value);
}

function figmaType(type) {
  if (type === "color") {
    return "COLOR";
  }
  if (["dimension", "duration", "fontWeight", "number"].includes(type)) {
    return "NUMBER";
  }
  return "STRING";
}

function figmaStarterCollectionName(source, mode) {
  return `${source.figma.semanticCollection} / ${mode}`;
}

function dtcgColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/iu)?.[1];
  const rgba = value.match(
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/iu,
  );
  const channels = hex
    ? [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((part) =>
        Number.parseInt(part, 16),
      )
    : rgba?.slice(1, 4).map(Number);
  const alpha = rgba ? Number(rgba[4]) : 1;
  if (channels === undefined || channels.some((channel) => channel > 255)) {
    throw new Error(`DESIGN_TOKEN_FIGMA_COLOR_INVALID:${value}`);
  }
  return {
    alpha,
    colorSpace: "srgb",
    components: channels.map((channel) => channel / 255),
    hex: `#${channels
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase(),
  };
}

function dtcgType(token, resolved) {
  if (token.type === "color") {
    return "color";
  }
  if (token.type === "dimension") {
    return resolved.unit === "px" ? "dimension" : "number";
  }
  if (token.type === "duration") {
    return "duration";
  }
  if (["fontWeight", "number"].includes(token.type)) {
    return "number";
  }
  return "string";
}

function dtcgDirectValue(token) {
  if (token.type === "color") {
    return dtcgColor(token.value);
  }
  if (token.type === "dimension") {
    return token.unit === "px"
      ? { unit: "px", value: token.value }
      : token.value;
  }
  if (token.type === "duration") {
    return { unit: "s", value: token.value / 1000 };
  }
  return token.value;
}

function setNestedToken(target, path, token) {
  const segments = figmaName(path).split("/");
  let current = target;
  for (const segment of segments.slice(0, -1)) {
    current[segment] ??= {};
    current = current[segment];
  }
  current[segments.at(-1)] = token;
}

function figmaAliasTarget(source, reference) {
  if (reference.startsWith("primitive.")) {
    return {
      collection: source.figma.primitiveCollection,
      name: figmaName(reference.slice("primitive.".length)),
    };
  }
  if (reference.startsWith("sharedSemantic.")) {
    return {
      collection: figmaStarterCollectionName(source, source.figma.defaultMode),
      name: figmaName(reference.slice("sharedSemantic.".length)),
    };
  }
  throw new Error(`DESIGN_TOKEN_FIGMA_ALIAS_INVALID:${reference}`);
}

function renderFigmaImport(
  source,
  allTokens,
  fingerprint,
  paths,
  relativePath,
) {
  const result = {
    $description: `Generated by ${GENERATOR_VERSION}; source ${fingerprint}`,
  };
  for (const path of paths.sort()) {
    const token = allTokens.get(path);
    const resolved = resolveReference(path, allTokens);
    const reference = referencePath(token);
    const rendered = { $type: dtcgType(token, resolved) };
    if (reference === undefined) {
      rendered.$value = dtcgDirectValue(token);
    } else {
      const target = figmaAliasTarget(source, reference);
      rendered.$value = dtcgDirectValue(resolved);
      rendered.$extensions = {
        "com.figma.aliasData": {
          targetVariableName: target.name,
          targetVariableSetName: target.collection,
        },
      };
    }
    setNestedToken(
      result,
      typeof relativePath === "function"
        ? relativePath(path)
        : path.slice(relativePath.length),
      rendered,
    );
  }
  return canonicalJson(result);
}

function resolveReference(path, allTokens, stack = []) {
  if (stack.includes(path)) {
    throw new Error(
      `DESIGN_TOKEN_REFERENCE_CYCLE:${[...stack, path].join("->")}`,
    );
  }
  const token = allTokens.get(path);
  if (token === undefined) {
    throw new Error(`DESIGN_TOKEN_REFERENCE_MISSING:${path}`);
  }
  const reference =
    typeof token.value === "string"
      ? token.value.match(REFERENCE_PATTERN)
      : null;
  if (reference === null) {
    return token;
  }
  const resolved = resolveReference(reference[1], allTokens, [...stack, path]);
  if (resolved.type !== token.type) {
    throw new Error(
      `DESIGN_TOKEN_REFERENCE_TYPE:${path}:${token.type}:${resolved.type}`,
    );
  }
  return { ...resolved, path: token.path };
}

function referencePath(token) {
  if (typeof token.value !== "string") {
    return undefined;
  }
  return token.value.match(REFERENCE_PATTERN)?.[1];
}

function modeTokenKeys(tokens, mode) {
  return [...tokens.keys()]
    .filter((path) => path.startsWith(`semantic.${mode}.`))
    .map((path) => path.slice(`semantic.${mode}.`.length))
    .sort();
}

function validateSource(source, allTokens) {
  if (
    source.schemaVersion !== 1 ||
    source.direction !== "A / Gentle Nature / 01B / DLY-003"
  ) {
    throw new Error("DESIGN_TOKEN_SOURCE_METADATA_INVALID");
  }
  for (const [path, token] of allTokens) {
    assertToken(token, path);
    resolveReference(path, allTokens);
    const reference = referencePath(token);
    if (path.startsWith("primitive.") && reference !== undefined) {
      throw new Error(`DESIGN_TOKEN_PRIMITIVE_ALIAS_FORBIDDEN:${path}`);
    }
    if (
      path.startsWith("semantic.") &&
      reference !== undefined &&
      !reference.startsWith("primitive.")
    ) {
      throw new Error(`DESIGN_TOKEN_SEMANTIC_REFERENCE_INVALID:${path}`);
    }
    if (
      path.startsWith("semantic.") &&
      reference === undefined &&
      (token.type !== "color" || !MODE_DIRECT_COLOR_PATHS.has(path))
    ) {
      throw new Error(`DESIGN_TOKEN_SEMANTIC_RAW_VALUE_FORBIDDEN:${path}`);
    }
    if (
      path.startsWith("sharedSemantic.") &&
      reference !== undefined &&
      !reference.startsWith("primitive.")
    ) {
      throw new Error(`DESIGN_TOKEN_SHARED_REFERENCE_INVALID:${path}`);
    }
    if (path.startsWith("sharedSemantic.") && reference === undefined) {
      throw new Error(`DESIGN_TOKEN_SHARED_RAW_VALUE_FORBIDDEN:${path}`);
    }
    if (
      path.startsWith("component.") &&
      reference !== undefined &&
      !reference.startsWith("primitive.") &&
      !reference.startsWith("sharedSemantic.")
    ) {
      throw new Error(`DESIGN_TOKEN_COMPONENT_REFERENCE_INVALID:${path}`);
    }
    if (path.startsWith("component.") && reference === undefined) {
      throw new Error(`DESIGN_TOKEN_COMPONENT_RAW_VALUE_FORBIDDEN:${path}`);
    }
  }
  const defaultKeys = modeTokenKeys(allTokens, "default");
  const highContrastKeys = modeTokenKeys(allTokens, "highContrast");
  if (JSON.stringify(defaultKeys) !== JSON.stringify(highContrastKeys)) {
    throw new Error("DESIGN_TOKEN_MODE_SHAPE_DRIFT");
  }
}

function renderHeader(fingerprint, prefix) {
  return [
    `${prefix} @generated by ${GENERATOR_VERSION}. Do not edit.`,
    `${prefix} source-fingerprint: ${fingerprint}`,
  ].join("\n");
}

function renderCssHeader(fingerprint) {
  return `/* @generated by ${GENERATOR_VERSION}. Do not edit.\n * source-fingerprint: ${fingerprint}\n */`;
}

function renderCssDeclarations(paths, allTokens, options = {}) {
  return paths
    .sort()
    .map((path) => {
      const token = allTokens.get(path);
      const namePath = options.stripPrefix
        ? path.slice(options.stripPrefix.length)
        : path;
      const reference = referencePath(token);
      const value =
        options.keepReferences && reference !== undefined
          ? `var(${cssName(reference.replace(/^sharedSemantic\./u, ""))})`
          : formatCssValue(resolveReference(path, allTokens));
      return `  ${cssName(namePath)}: ${value};`;
    })
    .join("\n");
}

function renderRuntimeCss(allTokens, fingerprint) {
  const defaultPaths = [...allTokens.keys()].filter((path) =>
    path.startsWith("semantic.default."),
  );
  const highContrastPaths = [...allTokens.keys()].filter((path) =>
    path.startsWith("semantic.highContrast."),
  );
  const sharedPaths = [...allTokens.keys()].filter((path) =>
    path.startsWith("sharedSemantic."),
  );
  const componentPaths = [...allTokens.keys()].filter((path) =>
    path.startsWith("component."),
  );
  const defaultDeclarations = renderCssDeclarations(defaultPaths, allTokens, {
    stripPrefix: "semantic.default.",
  });
  const highContrastDeclarations = renderCssDeclarations(
    highContrastPaths,
    allTokens,
    { stripPrefix: "semantic.highContrast." },
  );
  const sharedDeclarations = renderCssDeclarations(sharedPaths, allTokens, {
    stripPrefix: "sharedSemantic.",
  });
  const componentDeclarations = renderCssDeclarations(
    componentPaths,
    allTokens,
  );
  return `${renderCssHeader(fingerprint)}\n\npage,\n.de-theme-default {\n${defaultDeclarations}\n}\n\n.de-theme-high-contrast {\n${highContrastDeclarations}\n}\n\npage,\n.de-theme-default,\n.de-theme-high-contrast {\n${sharedDeclarations}\n${componentDeclarations}\n}\n\n.de-motion-reduced {\n  --de-motion-fast: 0ms;\n  --de-motion-standard: 0ms;\n  --de-motion-gentle: 0ms;\n  --de-motion-slow: 0ms;\n  --de-motion-distance: 0px;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  page,\n  .de-theme-default,\n  .de-theme-high-contrast {\n    --de-motion-fast: 0ms;\n    --de-motion-standard: 0ms;\n    --de-motion-gentle: 0ms;\n    --de-motion-slow: 0ms;\n    --de-motion-distance: 0px;\n  }\n}\n`;
}

function nestedResolved(paths, allTokens, stripPrefix) {
  const result = {};
  for (const path of paths.sort()) {
    const relative = path.slice(stripPrefix.length).split(".");
    let target = result;
    for (const segment of relative.slice(0, -1)) {
      target[segment] ??= {};
      target = target[segment];
    }
    const resolved = resolveReference(path, allTokens);
    target[relative.at(-1)] =
      resolved.type === "dimension" || resolved.type === "duration"
        ? { unit: resolved.unit, value: resolved.value }
        : resolved.value;
  }
  return result;
}

function renderTypeScript(allTokens, fingerprint) {
  const modes = Object.fromEntries(
    ["default", "highContrast"].map((mode) => {
      const paths = [...allTokens.keys()].filter(
        (path) =>
          path.startsWith(`semantic.${mode}.`) ||
          path.startsWith("sharedSemantic."),
      );
      const semantic = nestedResolved(
        paths.filter((path) => path.startsWith(`semantic.${mode}.`)),
        allTokens,
        `semantic.${mode}.`,
      );
      semantic.shared = nestedResolved(
        paths.filter((path) => path.startsWith("sharedSemantic.")),
        allTokens,
        "sharedSemantic.",
      );
      return [mode, semantic];
    }),
  );
  const componentPaths = [...allTokens.keys()].filter((path) =>
    path.startsWith("component."),
  );
  const component = nestedResolved(componentPaths, allTokens, "component.");
  return `${renderHeader(fingerprint, "//")}\n\nexport const DESIGN_TOKEN_SOURCE_FINGERPRINT = ${JSON.stringify(fingerprint)};\nexport const DESIGN_TOKEN_MODES = ["default", "highContrast"] as const;\nexport type DesignTokenMode = (typeof DESIGN_TOKEN_MODES)[number];\nexport const DESIGN_TOKENS = ${JSON.stringify({ component, modes }, null, 2)} as const;\n`;
}

function figmaValue(token, pathToFigmaName) {
  const reference = referencePath(token);
  if (reference !== undefined) {
    return { alias: pathToFigmaName(reference) };
  }
  if (["dimension", "duration"].includes(token.type)) {
    return token.value;
  }
  return token.value;
}

function renderFigmaManifest(source, allTokens, fingerprint) {
  const primitiveVariables = [...allTokens.entries()]
    .filter(([path]) => path.startsWith("primitive."))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, token]) => ({
      name: figmaName(path.slice("primitive.".length)),
      type: figmaType(token.type),
      valuesByMode: { Value: figmaValue(token, (value) => value) },
    }));
  const semanticKeys = modeTokenKeys(allTokens, "default");
  const semanticVariables = semanticKeys.map((key) => {
    const defaultToken = allTokens.get(`semantic.default.${key}`);
    const highContrastToken = allTokens.get(`semantic.highContrast.${key}`);
    return {
      name: figmaName(key),
      type: figmaType(defaultToken.type),
      valuesByMode: {
        [source.figma.defaultMode]: figmaValue(defaultToken, (reference) =>
          reference.startsWith("primitive.")
            ? `${source.figma.primitiveCollection}/${figmaName(reference.slice("primitive.".length))}`
            : reference,
        ),
        [source.figma.highContrastMode]: figmaValue(
          highContrastToken,
          (reference) =>
            reference.startsWith("primitive.")
              ? `${source.figma.primitiveCollection}/${figmaName(reference.slice("primitive.".length))}`
              : reference,
        ),
      },
    };
  });
  const sharedVariables = [...allTokens.entries()]
    .filter(([path]) => path.startsWith("sharedSemantic."))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, token]) => ({
      name: figmaName(path.slice("sharedSemantic.".length)),
      type: figmaType(token.type),
      valuesByMode: {
        [source.figma.defaultMode]: figmaValue(
          token,
          (reference) =>
            `${source.figma.primitiveCollection}/${figmaName(reference.slice("primitive.".length))}`,
        ),
        [source.figma.highContrastMode]: figmaValue(
          token,
          (reference) =>
            `${source.figma.primitiveCollection}/${figmaName(reference.slice("primitive.".length))}`,
        ),
      },
    }));
  const componentVariables = [...allTokens.entries()]
    .filter(([path]) => path.startsWith("component."))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, token]) => ({
      name: figmaName(path.slice("component.".length)),
      type: figmaType(token.type),
      valuesByMode: {
        Value: figmaValue(token, (reference) => {
          if (reference.startsWith("primitive.")) {
            return `${source.figma.primitiveCollection}/${figmaName(reference.slice("primitive.".length))}`;
          }
          return `${source.figma.semanticCollection}/${figmaName(reference.slice("sharedSemantic.".length))}`;
        }),
      },
    }));
  return canonicalJson({
    collections: [
      {
        modes: ["Value"],
        name: source.figma.primitiveCollection,
        variables: primitiveVariables,
      },
      {
        modes: [source.figma.defaultMode, source.figma.highContrastMode],
        name: source.figma.semanticCollection,
        variables: [...semanticVariables, ...sharedVariables],
      },
      {
        modes: ["Value"],
        name: source.figma.componentCollection,
        variables: componentVariables,
      },
    ],
    generator: GENERATOR_VERSION,
    sourceFingerprint: fingerprint,
    starterPlanMapping: {
      limitation: "one-mode-per-collection",
      collections: [
        source.figma.primitiveCollection,
        figmaStarterCollectionName(source, source.figma.defaultMode),
        figmaStarterCollectionName(source, source.figma.highContrastMode),
        source.figma.componentCollection,
      ],
    },
    styles: {
      effects: [
        { name: "DE / Effect / Raised", token: "primitive.shadow.raised" },
        { name: "DE / Effect / Sheet", token: "primitive.shadow.sheet" },
      ],
      text: [
        { name: "DE / Text / Meta", size: "sharedSemantic.font.metaSize" },
        { name: "DE / Text / Label", size: "sharedSemantic.font.labelSize" },
        { name: "DE / Text / Body", size: "sharedSemantic.font.bodySize" },
        {
          name: "DE / Text / Section",
          size: "sharedSemantic.font.sectionSize",
        },
        { name: "DE / Text / Action", size: "sharedSemantic.font.actionSize" },
        {
          name: "DE / Text / Page Title",
          size: "sharedSemantic.font.pageTitleSize",
        },
      ],
    },
  });
}

export async function buildDesignTokenArtifacts(source) {
  const allTokens = new Map([
    ...flattenTokens(source.primitive, ["primitive"]),
    ...flattenTokens(source.semantic, ["semantic"]),
    ...flattenTokens(source.sharedSemantic, ["sharedSemantic"]),
    ...flattenTokens(source.component, ["component"]),
  ]);
  validateSource(source, allTokens);
  const fingerprint = `sha256:${createHash("sha256")
    .update(GENERATOR_VERSION)
    .update("\0")
    .update(`prettier=${prettierVersion}`)
    .update("\0")
    .update(canonicalJson(source))
    .digest("hex")}`;
  const runtimeCss = renderRuntimeCss(allTokens, fingerprint);
  const primitivePaths = [...allTokens.keys()].filter((path) =>
    path.startsWith("primitive."),
  );
  const defaultSemanticPaths = [...allTokens.keys()].filter(
    (path) =>
      path.startsWith("semantic.default.") ||
      path.startsWith("sharedSemantic."),
  );
  const highContrastSemanticPaths = [...allTokens.keys()].filter(
    (path) =>
      path.startsWith("semantic.highContrast.") ||
      path.startsWith("sharedSemantic."),
  );
  const componentPaths = [...allTokens.keys()].filter((path) =>
    path.startsWith("component."),
  );
  const artifacts = await formatArtifacts(
    new Map([
      ["apps/miniapp/src/generated/design-tokens.wxss", runtimeCss],
      [
        "apps/miniapp/src/generated/design-tokens.ts",
        renderTypeScript(allTokens, fingerprint),
      ],
      [
        "docs/design/assets/d002/design-tokens.css",
        runtimeCss.replace(/^page,/gmu, ":root,"),
      ],
      [
        "docs/design/assets/d002/figma-variable-manifest.json",
        renderFigmaManifest(source, allTokens, fingerprint),
      ],
      [
        "docs/design/assets/d002/figma-import/primitive/Value.json",
        renderFigmaImport(
          source,
          allTokens,
          fingerprint,
          primitivePaths,
          "primitive.",
        ),
      ],
      [
        "docs/design/assets/d002/figma-import/semantic-default/Default.json",
        renderFigmaImport(
          source,
          allTokens,
          fingerprint,
          defaultSemanticPaths,
          (path) =>
            path.startsWith("semantic.default.")
              ? path.slice("semantic.default.".length)
              : path.slice("sharedSemantic.".length),
        ),
      ],
      [
        "docs/design/assets/d002/figma-import/semantic-high-contrast/High Contrast.json",
        renderFigmaImport(
          source,
          allTokens,
          fingerprint,
          highContrastSemanticPaths,
          (path) =>
            path.startsWith("semantic.highContrast.")
              ? path.slice("semantic.highContrast.".length)
              : path.slice("sharedSemantic.".length),
        ),
      ],
      [
        "docs/design/assets/d002/figma-import/component/Value.json",
        renderFigmaImport(
          source,
          allTokens,
          fingerprint,
          componentPaths,
          "component.",
        ),
      ],
    ]),
  );
  return {
    artifacts,
    fingerprint,
    tokens: allTokens,
  };
}

export function designTokenArtifactDiagnostic(path, actual, expected) {
  if (actual === undefined) {
    return {
      message: "generated design-token artifact is missing",
      path,
      ruleId: "DESIGN_TOKEN_ARTIFACT_MISSING",
    };
  }
  if (actual !== expected) {
    return {
      message:
        "generated design-token artifact drifted; run pnpm design-tokens:write",
      path,
      ruleId: "DESIGN_TOKEN_ARTIFACT_DRIFT",
    };
  }
  return undefined;
}

export function resolvedTokenValue(build, path) {
  return resolveReference(path, build.tokens).value;
}
