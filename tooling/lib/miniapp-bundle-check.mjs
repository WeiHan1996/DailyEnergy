import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

export const MINIAPP_PAGE_REGISTRY = Object.freeze([
  "pages/launch/index",
  "pages/landing/index",
  "pages/onboarding/index",
  "pages/checkin-handoff/index",
  "pages/generation/index",
  "pages/today/index",
  "pages/evening/index",
  "pages/records/index",
  "pages/history-day/index",
  "pages/safety/index",
  "pages/recovery/index",
]);

const requiredFiles = [
  "app.js",
  "app.json",
  "app.wxss",
  "generated/public-build-config.js",
  ...MINIAPP_PAGE_REGISTRY.flatMap((pagePath) =>
    ["js", "json", "wxml", "wxss"].map(
      (extension) => `${pagePath}.${extension}`,
    ),
  ),
  "sitemap.json",
];
const forbiddenImportPattern =
  /(?:node:|@nestjs\/|@prisma\/|@daily-energy\/(?:server-|prompt-library)|\b(?:bullmq|ioredis|openai|anthropic)\b|@anthropic-ai\/sdk|@google\/generative-ai)/iu;
const forbiddenSecretIdentifier =
  /\b(?:OPENAI|ANTHROPIC|PROVIDER|DATABASE|REDIS)_(?:API_)?(?:KEY|SECRET|TOKEN|URL)\b/u;
const esModulePattern = /^\s*(?:export\s|import\s)/mu;

export const MINIAPP_BUNDLE_RULE_IDS = Object.freeze([
  "MINIAPP_BUNDLE_APP_CONFIG_INVALID",
  "MINIAPP_BUNDLE_ES_MODULE",
  "MINIAPP_BUNDLE_FILE_MISSING",
  "MINIAPP_BUNDLE_FORBIDDEN_IMPORT",
  "MINIAPP_BUNDLE_GENERATED_CONFIG",
  "MINIAPP_BUNDLE_PAGE_REGISTRY",
  "MINIAPP_BUNDLE_SECRET_IDENTIFIER",
  "MINIAPP_BUNDLE_TABBAR_FORBIDDEN",
  "MINIAPP_BUNDLE_TYPESCRIPT_PRESENT",
]);

function diagnostic(ruleId, path, message) {
  return { message, path, ruleId };
}

function parseAppConfig(entry, diagnostics) {
  let config;
  try {
    config = JSON.parse(entry.content);
  } catch {
    diagnostics.push(
      diagnostic(
        "MINIAPP_BUNDLE_APP_CONFIG_INVALID",
        entry.path,
        "app.json must be valid JSON",
      ),
    );
    return;
  }
  if (Object.hasOwn(config, "tabBar")) {
    diagnostics.push(
      diagnostic(
        "MINIAPP_BUNDLE_TABBAR_FORBIDDEN",
        entry.path,
        "the current bounded miniapp journey cannot define a tabBar",
      ),
    );
  }
  const pages = config.pages;
  if (
    !Array.isArray(pages) ||
    pages.length !== MINIAPP_PAGE_REGISTRY.length ||
    pages.some((page, index) => page !== MINIAPP_PAGE_REGISTRY[index])
  ) {
    diagnostics.push(
      diagnostic(
        "MINIAPP_BUNDLE_PAGE_REGISTRY",
        entry.path,
        "app.json must register the ordered, approved miniapp page boundary",
      ),
    );
  }
}

export function scanMiniappBundleEntries(entries, options = {}) {
  const diagnostics = [];
  const files = new Map(entries.map((entry) => [entry.path, entry]));
  const requiredBundleFiles = [
    ...requiredFiles,
    ...(options.requiredComponentPaths ?? []).flatMap((componentPath) =>
      ["js", "json", "wxml", "wxss"].map(
        (extension) => `components/${componentPath}/index.${extension}`,
      ),
    ),
  ];

  for (const path of requiredBundleFiles) {
    if (!files.has(path)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_BUNDLE_FILE_MISSING",
          path,
          "required miniapp bundle file is missing",
        ),
      );
    }
  }

  for (const entry of entries) {
    if (entry.path.endsWith(".ts") || entry.path.endsWith(".tsx")) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_BUNDLE_TYPESCRIPT_PRESENT",
          entry.path,
          "compiled miniapp bundle cannot contain TypeScript source",
        ),
      );
    }
    if (forbiddenImportPattern.test(entry.content)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_BUNDLE_FORBIDDEN_IMPORT",
          entry.path,
          "client bundle contains a server, provider, Prompt, or Node dependency",
        ),
      );
    }
    if (forbiddenSecretIdentifier.test(entry.content)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_BUNDLE_SECRET_IDENTIFIER",
          entry.path,
          "client bundle contains a forbidden secret identifier",
        ),
      );
    }
    if (entry.path.endsWith(".js") && esModulePattern.test(entry.content)) {
      diagnostics.push(
        diagnostic(
          "MINIAPP_BUNDLE_ES_MODULE",
          entry.path,
          "compiled miniapp JavaScript must use the CommonJS platform boundary",
        ),
      );
    }
  }

  const appConfig = files.get("app.json");
  if (appConfig !== undefined) {
    parseAppConfig(appConfig, diagnostics);
  }

  const generatedConfig = files.get("generated/public-build-config.js");
  const generatedHeader = generatedConfig?.content
    .split(/\r?\n/u)
    .slice(0, 5)
    .join("\n");
  if (
    generatedHeader === undefined ||
    !/@generated\b/u.test(generatedHeader) ||
    !/source-fingerprint:\s*sha256:[a-f0-9]{64}\b/u.test(generatedHeader)
  ) {
    diagnostics.push(
      diagnostic(
        "MINIAPP_BUNDLE_GENERATED_CONFIG",
        "generated/public-build-config.js",
        "public build config must carry generated provenance",
      ),
    );
  }

  return diagnostics;
}

async function loadEntries(directory) {
  const entries = [];
  async function walk(currentDirectory) {
    for (const entry of await readdir(currentDirectory, {
      withFileTypes: true,
    })) {
      const path = resolve(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (
        [".js", ".json", ".ts", ".tsx", ".wxml", ".wxs", ".wxss"].includes(
          extname(path),
        )
      ) {
        entries.push({
          content: await readFile(path, "utf8"),
          path: relative(directory, path).split("\\").join("/"),
        });
      }
    }
  }
  await walk(directory);
  return entries;
}

export async function scanMiniappBundle(directory) {
  const repositoryRoot = resolve(import.meta.dirname, "../..");
  const componentLibrary = JSON.parse(
    await readFile(
      resolve(repositoryRoot, "apps/miniapp/component-library.json"),
      "utf8",
    ),
  );
  const requiredComponentPaths = [
    ...new Set(componentLibrary.components.map((component) => component.path)),
  ];
  return scanMiniappBundleEntries(await loadEntries(directory), {
    requiredComponentPaths,
  });
}
