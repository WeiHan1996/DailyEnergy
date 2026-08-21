import { posix } from "node:path";

import { importsForSource } from "./source-imports.mjs";

const allowedRuntimes = new Set([
  "client-safe",
  "server-core",
  "server-adapter",
  "server-asset",
  "tooling",
]);
const productionDependencyFields = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
];
const allDependencyFields = [...productionDependencyFields, "devDependencies"];
const sourceExtensions = /\.(?:c|m)?(?:j|t)sx?$/u;
const providerPackages = new Set([
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@mistralai/mistralai",
  "anthropic",
  "openai",
]);
const prismaPackages = new Set(["@prisma/client", "@prisma/adapter-pg"]);
const clientForbiddenPackages = new Set([
  "@prisma/client",
  "@prisma/adapter-pg",
  "bullmq",
  "ioredis",
  "openai",
  "anthropic",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
]);
const clientWorkspaceAllowlist = new Map([
  [
    "admin",
    new Set([
      "@daily-energy/api-client/admin",
      "@daily-energy/shared-schemas/client",
    ]),
  ],
  [
    "miniapp",
    new Set([
      "@daily-energy/api-client/miniapp",
      "@daily-energy/shared-schemas/client",
    ]),
  ],
]);
const clientBuildConfigurationPaths = new Set(["apps/admin/next.config.ts"]);
const allowedRuntimeDependencies = new Map([
  ["client-safe", new Set(["client-safe"])],
  ["server-core", new Set(["client-safe", "server-core"])],
  [
    "server-adapter",
    new Set(["client-safe", "server-core", "server-adapter", "server-asset"]),
  ],
  ["server-asset", new Set(["client-safe", "server-asset"])],
  ["tooling", new Set(["client-safe", "tooling"])],
]);

function diagnostic(ruleId, path, message) {
  return { message, path, ruleId };
}

function normalizeProject(project) {
  return {
    files: project.files ?? [],
    rootManifest: project.rootManifest ?? {
      dailyEnergy: { kind: "root", runtime: "tooling" },
      name: "fixture-root",
      private: true,
    },
    workspaces: project.workspaces ?? [],
  };
}

function importsFor(file) {
  if (Array.isArray(file.imports)) {
    return file.imports;
  }
  if (!sourceExtensions.test(file.path)) {
    return [];
  }
  return importsForSource(file.content, file.path);
}

function packageNameFromSpecifier(specifier) {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

function workspaceForFile(project, path) {
  return project.workspaces.find(
    (workspace) =>
      path === workspace.directory ||
      path.startsWith(`${workspace.directory}/`),
  );
}

function workspaceForSpecifier(project, specifier) {
  return project.workspaces.find(
    (workspace) =>
      specifier === workspace.manifest.name ||
      specifier.startsWith(`${workspace.manifest.name}/`),
  );
}

function declaredDependencies(manifest) {
  return new Set(
    allDependencyFields.flatMap((field) => Object.keys(manifest[field] ?? {})),
  );
}

function dependencyFieldsFor(manifest, dependencyName) {
  return allDependencyFields.filter((field) =>
    Object.hasOwn(manifest[field] ?? {}, dependencyName),
  );
}

function isTestFile(path) {
  return /(^|\/)(test|tests|__tests__|testing)(\/|$)|\.test\.[^.]+$/u.test(
    path,
  );
}

function normalizeRelativeImportTarget(filePath, specifier) {
  return posix.normalize(posix.join(posix.dirname(filePath), specifier));
}

function resolveRelativeImport(filePath, specifier, knownFiles) {
  const basePath = normalizeRelativeImportTarget(filePath, specifier);
  const candidates = new Set([
    basePath,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    `${basePath}.ts`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    `${basePath}.tsx`,
    `${basePath}/index.js`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ]);
  if (/\.(?:m|c)?js$/u.test(basePath)) {
    candidates.add(basePath.replace(/js$/u, "ts"));
    candidates.add(basePath.replace(/js$/u, "tsx"));
  }
  return [...candidates].find((candidate) => knownFiles.has(candidate));
}

function checkWorkspace(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const field of ["exports", "main", "module", "types"]) {
    if (Object.hasOwn(project.rootManifest, field)) {
      errors.push(
        diagnostic(
          "BOUNDARY_WORKSPACE_ROOT_EXPORT",
          "package.json",
          `root package cannot declare ${field}`,
        ),
      );
    }
  }
  for (const workspace of project.workspaces) {
    const expectedKind = workspace.directory.startsWith("apps/")
      ? "app"
      : "package";
    if (workspace.manifest.dailyEnergy?.kind !== expectedKind) {
      errors.push(
        diagnostic(
          "BOUNDARY_WORKSPACE_KIND",
          `${workspace.directory}/package.json`,
          `${workspace.manifest.name} must use kind ${expectedKind}`,
        ),
      );
    }
    for (const field of allDependencyFields) {
      for (const dependencyName of Object.keys(
        workspace.manifest[field] ?? {},
      )) {
        if (dependencyName.startsWith("@daily-energy/app-")) {
          errors.push(
            diagnostic(
              "BOUNDARY_WORKSPACE_APP_DEPENDENCY",
              `${workspace.directory}/package.json`,
              `${workspace.manifest.name} cannot depend on ${dependencyName}`,
            ),
          );
        }
      }
    }
  }
  return errors;
}

function checkManifest(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const workspace of project.workspaces) {
    const runtime = workspace.manifest.dailyEnergy?.runtime;
    if (!allowedRuntimes.has(runtime)) {
      errors.push(
        diagnostic(
          "BOUNDARY_MANIFEST_RUNTIME",
          `${workspace.directory}/package.json`,
          `${workspace.manifest.name} has an invalid runtime`,
        ),
      );
      continue;
    }
    for (const field of productionDependencyFields) {
      for (const dependencyName of Object.keys(
        workspace.manifest[field] ?? {},
      )) {
        const target = project.workspaces.find(
          (candidate) => candidate.manifest.name === dependencyName,
        );
        if (!target) {
          continue;
        }
        const targetRuntime = target.manifest.dailyEnergy?.runtime;
        if (!allowedRuntimeDependencies.get(runtime)?.has(targetRuntime)) {
          errors.push(
            diagnostic(
              "BOUNDARY_MANIFEST_RUNTIME_ZONE",
              `${workspace.directory}/package.json`,
              `${runtime} cannot depend on ${targetRuntime} in ${field}`,
            ),
          );
        }
      }
    }
    if (Object.hasOwn(workspace.tsconfig?.compilerOptions ?? {}, "paths")) {
      errors.push(
        diagnostic(
          "BOUNDARY_MANIFEST_PATH_ALIAS",
          `${workspace.directory}/tsconfig.json`,
          "workspace tsconfig cannot use paths to bypass package exports",
        ),
      );
    }
    for (const option of [
      "exactOptionalPropertyTypes",
      "noUncheckedIndexedAccess",
      "strict",
      "verbatimModuleSyntax",
    ]) {
      if (workspace.tsconfig?.compilerOptions?.[option] === false) {
        errors.push(
          diagnostic(
            "BOUNDARY_MANIFEST_STRICT_OVERRIDE",
            `${workspace.directory}/tsconfig.json`,
            `${workspace.manifest.name} cannot disable ${option}`,
          ),
        );
      }
    }
  }

  for (const file of project.files.filter(
    (candidate) =>
      candidate.path.startsWith("apps/") ||
      candidate.path.startsWith("packages/"),
  )) {
    if (isTestFile(file.path)) {
      continue;
    }
    const workspace = workspaceForFile(project, file.path);
    if (!workspace) {
      continue;
    }
    const declared = declaredDependencies(workspace.manifest);
    for (const specifier of importsFor(file)) {
      if (
        specifier.startsWith(".") ||
        specifier.startsWith("node:") ||
        specifier.startsWith("/")
      ) {
        continue;
      }
      const dependencyName = packageNameFromSpecifier(specifier);
      if (!declared.has(dependencyName)) {
        errors.push(
          diagnostic(
            "BOUNDARY_MANIFEST_UNDECLARED_IMPORT",
            file.path,
            `${specifier} is not declared by ${workspace.manifest.name}`,
          ),
        );
      }
      const target = project.workspaces.find(
        (candidate) => candidate.manifest.name === dependencyName,
      );
      if (!target) {
        continue;
      }
      const dependencyFields = dependencyFieldsFor(
        workspace.manifest,
        dependencyName,
      );
      const hasProductionDeclaration = dependencyFields.some((field) =>
        productionDependencyFields.includes(field),
      );
      if (
        dependencyFields.includes("devDependencies") &&
        !hasProductionDeclaration
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_MANIFEST_PRODUCTION_DEV_DEPENDENCY",
            file.path,
            `production source cannot import devDependency ${specifier}`,
          ),
        );
      }
      const sourceRuntime = workspace.manifest.dailyEnergy?.runtime;
      const targetRuntime = target.manifest.dailyEnergy?.runtime;
      if (
        allowedRuntimes.has(sourceRuntime) &&
        !allowedRuntimeDependencies.get(sourceRuntime)?.has(targetRuntime)
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_MANIFEST_SOURCE_RUNTIME_ZONE",
            file.path,
            `${sourceRuntime} production source cannot import ${targetRuntime} workspace ${specifier}`,
          ),
        );
      }
    }
  }
  return errors;
}

function checkExports(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const workspace of project.workspaces.filter(
    (candidate) => candidate.manifest.dailyEnergy?.kind === "package",
  )) {
    if (!Object.hasOwn(workspace.manifest, "exports")) {
      errors.push(
        diagnostic(
          "BOUNDARY_EXPORTS_MISSING",
          `${workspace.directory}/package.json`,
          `${workspace.manifest.name} must declare explicit exports`,
        ),
      );
      continue;
    }
    for (const exportPath of Object.keys(workspace.manifest.exports ?? {})) {
      if (exportPath.includes("*")) {
        errors.push(
          diagnostic(
            "BOUNDARY_EXPORTS_WILDCARD",
            `${workspace.directory}/package.json`,
            `${workspace.manifest.name} cannot export ${exportPath}`,
          ),
        );
      }
      if (
        exportPath.includes("/internal") ||
        exportPath.includes("/src") ||
        exportPath.includes("/domain") ||
        exportPath.includes("/repositories")
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_EXPORTS_INTERNAL",
            `${workspace.directory}/package.json`,
            `${workspace.manifest.name} exposes an internal path`,
          ),
        );
      }
    }
  }
  for (const file of project.files) {
    if (/(^|\/)db\/generated\/prisma\//u.test(file.path)) {
      continue;
    }
    if (/\bexport\s*\*\s*from\b/u.test(file.content)) {
      errors.push(
        diagnostic(
          "BOUNDARY_EXPORTS_SOURCE_WILDCARD",
          file.path,
          "wildcard source exports are forbidden",
        ),
      );
    }
    for (const specifier of importsFor(file)) {
      const target = workspaceForSpecifier(project, specifier);
      if (!target || specifier === target.manifest.name) {
        continue;
      }
      const subpath = `.${specifier.slice(target.manifest.name.length)}`;
      if (!Object.hasOwn(target.manifest.exports ?? {}, subpath)) {
        errors.push(
          diagnostic(
            "BOUNDARY_EXPORTS_SUBPATH",
            file.path,
            `${specifier} is not an exported subpath`,
          ),
        );
      }
    }
  }
  return errors;
}

function checkModuleGraph(input) {
  const project = normalizeProject(input);
  const errors = [];
  const graph = new Map();
  for (const workspace of project.workspaces) {
    const edges = new Set();
    for (const field of allDependencyFields) {
      for (const dependencyName of Object.keys(
        workspace.manifest[field] ?? {},
      )) {
        if (
          project.workspaces.some(
            (candidate) => candidate.manifest.name === dependencyName,
          )
        ) {
          edges.add(dependencyName);
        }
      }
    }
    graph.set(workspace.manifest.name, edges);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(name, path = []) {
    if (visiting.has(name)) {
      errors.push(
        diagnostic(
          "BOUNDARY_MODULE_CYCLE",
          "workspace graph",
          [...path, name].join(" -> "),
        ),
      );
      return;
    }
    if (visited.has(name)) {
      return;
    }
    visiting.add(name);
    for (const dependency of graph.get(name) ?? []) {
      visit(dependency, [...path, name]);
    }
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of graph.keys()) {
    visit(name);
  }

  const knownFiles = new Set(project.files.map((file) => file.path));
  const sourceGraph = new Map();
  for (const file of project.files) {
    if (/(^|\/)db\/generated\/prisma\//u.test(file.path)) {
      continue;
    }
    const edges = new Set();
    for (const specifier of importsFor(file)) {
      let relativeTargetPath;
      if (specifier.startsWith(".")) {
        const targetPath = normalizeRelativeImportTarget(file.path, specifier);
        relativeTargetPath = targetPath;
        const sourceWorkspace = workspaceForFile(project, file.path);
        const targetWorkspace = workspaceForFile(project, targetPath);
        if (
          sourceWorkspace &&
          targetWorkspace &&
          sourceWorkspace.directory !== targetWorkspace.directory
        ) {
          errors.push(
            diagnostic(
              "BOUNDARY_MODULE_CROSS_WORKSPACE_RELATIVE",
              file.path,
              `relative import ${specifier} crosses from ${sourceWorkspace.manifest.name} to ${targetWorkspace.manifest.name}; use package exports`,
            ),
          );
        }
        const target = resolveRelativeImport(file.path, specifier, knownFiles);
        if (target) {
          edges.add(target);
        }
      }
      if (
        file.path.startsWith("packages/server-core/src/modules/") &&
        relativeTargetPath !== undefined &&
        /\/modules\/[^/]+\/(?:domain|internal|spi)(?:\/|$)/u.test(
          relativeTargetPath,
        ) &&
        file.path.match(/\/modules\/([^/]+)\//u)?.[1] !==
          relativeTargetPath.match(/\/modules\/([^/]+)\//u)?.[1]
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_MODULE_INTERNAL",
            file.path,
            `cross-module internal import ${specifier} is forbidden`,
          ),
        );
      }
    }
    if (
      file.path.startsWith("packages/server-core/") &&
      /\b(forwardRef|serviceLocator|globalContainer)\b/u.test(file.content)
    ) {
      errors.push(
        diagnostic(
          "BOUNDARY_MODULE_SERVICE_LOCATOR",
          file.path,
          "service locator or forwardRef cannot hide a cycle",
        ),
      );
    }
    sourceGraph.set(file.path, edges);
  }

  const sourceVisiting = new Set();
  const sourceVisited = new Set();
  function visitSource(path, trail = []) {
    if (sourceVisiting.has(path)) {
      errors.push(
        diagnostic(
          "BOUNDARY_MODULE_SOURCE_CYCLE",
          path,
          [...trail, path].join(" -> "),
        ),
      );
      return;
    }
    if (sourceVisited.has(path)) {
      return;
    }
    sourceVisiting.add(path);
    for (const dependency of sourceGraph.get(path) ?? []) {
      visitSource(dependency, [...trail, path]);
    }
    sourceVisiting.delete(path);
    sourceVisited.add(path);
  }
  for (const path of sourceGraph.keys()) {
    visitSource(path);
  }
  return errors;
}

function checkClient(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const file of project.files) {
    const [area, appName] = file.path.split("/");
    const workspace = workspaceForFile(project, file.path);
    const isClientApp =
      area === "apps" &&
      clientWorkspaceAllowlist.has(appName) &&
      !clientBuildConfigurationPaths.has(file.path);
    const isClientPackage =
      area === "packages" &&
      workspace?.manifest.dailyEnergy?.runtime === "client-safe";
    if (!isClientApp && !isClientPackage) {
      continue;
    }
    for (const specifier of importsFor(file)) {
      const allowlist = clientWorkspaceAllowlist.get(appName);
      if (
        isClientApp &&
        specifier.startsWith("@daily-energy/") &&
        !allowlist.has(specifier)
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_CLIENT_WORKSPACE_IMPORT",
            file.path,
            `${appName} cannot import ${specifier}`,
          ),
        );
      }
      if (
        specifier.startsWith("node:") ||
        specifier.startsWith("@nestjs/") ||
        clientForbiddenPackages.has(packageNameFromSpecifier(specifier))
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_CLIENT_SERVER_IMPORT",
            file.path,
            `client-safe source cannot import ${specifier}`,
          ),
        );
      }
    }
  }
  return errors;
}

function checkCapability(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const file of project.files) {
    for (const specifier of importsFor(file)) {
      if (
        file.path.startsWith("packages/server-core/") &&
        (specifier.startsWith("@nestjs/") ||
          specifier.startsWith("@daily-energy/server-adapters") ||
          prismaPackages.has(packageNameFromSpecifier(specifier)) ||
          providerPackages.has(packageNameFromSpecifier(specifier)) ||
          ["bullmq", "dotenv", "ioredis"].includes(
            packageNameFromSpecifier(specifier),
          ))
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_CAPABILITY_SERVER_CORE",
            file.path,
            `server-core cannot import concrete runtime ${specifier}`,
          ),
        );
      }
      if (
        file.path.includes("/application/") &&
        /(^|\/)(controller|transport)(\/|$)/u.test(specifier)
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_CAPABILITY_APPLICATION_LAYER",
            file.path,
            `application source cannot import transport ${specifier}`,
          ),
        );
      }
      if (
        file.path.startsWith("apps/api/") &&
        (specifier === "@daily-energy/prompt-library" ||
          packageNameFromSpecifier(specifier) === "bullmq" ||
          specifier.startsWith("@daily-energy/server-adapters/ai") ||
          specifier.includes("worker-") ||
          specifier.includes("/migration"))
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_CAPABILITY_API",
            file.path,
            `API cannot import ${specifier}`,
          ),
        );
      }
      if (!file.path.startsWith("apps/worker/")) {
        continue;
      }
      const profile = file.path.match(
        /\/(interactive|background|restricted|migration)\.[^.]+$/u,
      )?.[1];
      if (!profile) {
        continue;
      }
      const permittedToken =
        profile === "migration" ? "/migration" : `/worker-${profile}`;
      if (
        specifier.startsWith("@daily-energy/server-adapters/") &&
        !specifier.endsWith(permittedToken) &&
        !(
          (profile === "interactive" || profile === "background") &&
          specifier.endsWith("/ai")
        )
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_CAPABILITY_WORKER",
            file.path,
            `${profile} cannot import ${specifier}`,
          ),
        );
      }
    }
    if (
      file.path.startsWith("packages/server-core/") &&
      /\bprocess\.env\b/u.test(file.content)
    ) {
      errors.push(
        diagnostic(
          "BOUNDARY_CAPABILITY_SERVER_ENV",
          file.path,
          "server-core cannot read process.env directly",
        ),
      );
    }
  }
  return errors;
}

function checkProvider(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const file of project.files) {
    for (const specifier of importsFor(file)) {
      const packageName = packageNameFromSpecifier(specifier);
      const isAiAdapter = file.path.startsWith(
        "packages/server-adapters/src/ai/",
      );
      if (providerPackages.has(packageName) && !isAiAdapter) {
        errors.push(
          diagnostic(
            "BOUNDARY_PROVIDER_LOCATION",
            file.path,
            `${specifier} is only allowed in the AI adapter`,
          ),
        );
      }
      if (
        specifier === "@daily-energy/prompt-library" &&
        !isAiAdapter &&
        !file.path.startsWith("tests/ai-evaluation/") &&
        !file.path.startsWith("tooling/")
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_PROVIDER_PROMPT_LOCATION",
            file.path,
            "prompt-library is only allowed in AI adapter/evaluation/tooling",
          ),
        );
      }
    }
  }
  return errors;
}

function isApplicationStartup(path) {
  return (
    /^apps\/[^/]+\/src\/(?:main|bootstrap)(?:\/|\.)/u.test(path) ||
    /^apps\/worker\/src\/entrypoints\/(?:interactive|background|restricted)\.[^.]+$/u.test(
      path,
    )
  );
}

function checkRestricted(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const file of project.files) {
    for (const specifier of importsFor(file)) {
      if (
        specifier.includes("/api-restricted") &&
        !file.path.includes("/entrypoints/restricted.") &&
        !file.path.startsWith("packages/server-adapters/src/db/") &&
        !file.path.startsWith("tests/")
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_RESTRICTED_API_LOCATION",
            file.path,
            `restricted API capability cannot be imported by ${file.path}`,
          ),
        );
      }
      if (
        specifier.includes("/worker-restricted") &&
        !file.path.includes("/entrypoints/restricted.") &&
        !file.path.startsWith("packages/server-adapters/src/db/") &&
        !file.path.startsWith("tests/")
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_RESTRICTED_LOCATION",
            file.path,
            `restricted capability cannot be imported by ${file.path}`,
          ),
        );
      }
      if (
        specifier.includes("/migration") &&
        !file.path.includes("/entrypoints/migration.") &&
        !file.path.includes("/entrypoints/entrypoints.test.") &&
        !file.path.startsWith("packages/server-adapters/src/db/") &&
        !file.path.startsWith("tests/database/")
      ) {
        errors.push(
          diagnostic(
            isApplicationStartup(file.path)
              ? "BOUNDARY_MIGRATION_STARTUP"
              : "BOUNDARY_MIGRATION_LOCATION",
            file.path,
            isApplicationStartup(file.path)
              ? `application startup cannot import migration capability ${specifier}`
              : `migration capability cannot be imported by ${file.path}`,
          ),
        );
      }
    }
  }
  return errors;
}

function checkContract(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const file of project.files.filter(
    (candidate) =>
      candidate.path.startsWith("apps/") || candidate.path.includes("/src/"),
  )) {
    for (const specifier of importsFor(file)) {
      if (
        /(^|\/)(openapi\/openapi\.yaml|prisma\/schema\.prisma)$/u.test(
          specifier,
        )
      ) {
        errors.push(
          diagnostic(
            "BOUNDARY_CONTRACT_ROOT_SOURCE",
            file.path,
            `runtime source cannot import root authority ${specifier}`,
          ),
        );
      }
    }
  }
  return errors;
}

function checkPrisma(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const file of project.files) {
    const isGeneratedPrisma = file.path.startsWith(
      "packages/server-adapters/src/db/generated/prisma/",
    );
    const isPublicAdapterSurface =
      /^packages\/server-adapters\/src\/(api(?:-restricted)?|worker-[^/]+|migration|testing)\//u.test(
        file.path,
      );
    for (const specifier of importsFor(file)) {
      const importsGeneratedPrisma =
        specifier.includes("/db/generated/prisma/") ||
        (isPublicAdapterSurface && specifier.includes("generated/prisma"));
      if (importsGeneratedPrisma && !isGeneratedPrisma) {
        errors.push(
          diagnostic(
            "BOUNDARY_PRISMA_PUBLIC_CONTRACT",
            file.path,
            `${specifier} would expose generated Prisma types outside the private runtime`,
          ),
        );
      }
      if (!prismaPackages.has(packageNameFromSpecifier(specifier))) {
        continue;
      }
      const allowed =
        /^packages\/server-adapters\/src\/(db|migration|testing)\//u.test(
          file.path,
        ) ||
        file.path.startsWith("tests/database/") ||
        file.path.startsWith("prisma/");
      if (!allowed) {
        errors.push(
          diagnostic(
            "BOUNDARY_PRISMA_LOCATION",
            file.path,
            `${specifier} is outside the DB adapter/migration/test allowlist`,
          ),
        );
      }
    }
  }
  return errors;
}

function checkGenerated(input) {
  const project = normalizeProject(input);
  const errors = [];
  for (const file of project.files.filter(
    (candidate) =>
      /(^|\/)generated\//u.test(candidate.path) &&
      !/(^|\/)db\/generated\/prisma\//u.test(candidate.path),
  )) {
    const header = file.content.split(/\r?\n/u).slice(0, 5).join("\n");
    if (!/@generated\b/u.test(header)) {
      errors.push(
        diagnostic(
          "BOUNDARY_GENERATED_MARKER",
          file.path,
          "generated source must declare @generated",
        ),
      );
    }
    if (!/source-fingerprint:\s*sha256:[a-f0-9]{64}\b/u.test(header)) {
      errors.push(
        diagnostic(
          "BOUNDARY_GENERATED_FINGERPRINT",
          file.path,
          "generated source must declare a sha256 source fingerprint",
        ),
      );
    }
  }
  return errors;
}

function checkSecretContent(input) {
  const project = normalizeProject(input);
  const errors = [];
  const forbiddenIdentifier =
    /\b(?:OPENAI|ANTHROPIC|PROVIDER|DATABASE|REDIS)_(?:API_)?(?:KEY|SECRET|TOKEN|URL)\b/u;
  for (const file of project.files) {
    const workspace = workspaceForFile(project, file.path);
    const isClient =
      file.path.startsWith("apps/miniapp/") ||
      file.path.startsWith("apps/admin/") ||
      workspace?.manifest.dailyEnergy?.runtime === "client-safe";
    if (isClient && forbiddenIdentifier.test(file.content)) {
      errors.push(
        diagnostic(
          "BOUNDARY_SECRET_CLIENT",
          file.path,
          "client-safe source contains a forbidden secret identifier",
        ),
      );
    }
  }
  return errors;
}

export const boundaryGates = new Map([
  ["workspace", checkWorkspace],
  ["manifest", checkManifest],
  ["exports", checkExports],
  ["module-graph", checkModuleGraph],
  ["client", checkClient],
  ["capability", checkCapability],
  ["provider", checkProvider],
  ["restricted", checkRestricted],
  ["contract", checkContract],
  ["prisma", checkPrisma],
  ["generated", checkGenerated],
  ["secret-content", checkSecretContent],
]);

export function runBoundaryGate(name, project) {
  const gate = boundaryGates.get(name);
  if (!gate) {
    throw new Error(`Unknown boundary gate: ${name}`);
  }
  return gate(project);
}

export function runAllBoundaryGates(project) {
  return [...boundaryGates.entries()].flatMap(([gateName, gate]) =>
    gate(project).map((item) => ({ ...item, gate: gateName })),
  );
}
