import { resolve } from "node:path";

import { defineConfig, defineProject } from "vitest/config";

const repositoryRoot = import.meta.dirname;

function nodeProject(name: string, root: string, include: string[]) {
  return defineProject({
    extends: true,
    test: {
      environment: "node",
      include,
      name,
      retry: 0,
      root: resolve(repositoryRoot, root),
    },
  });
}

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/generated/**",
        "**/tests/**",
      ],
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "tests/artifacts/output/coverage",
      thresholds: {
        "apps/*/src/**": {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        "packages/server-core/src/**": {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        "packages/prompt-library/src/**": {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        "packages/shared-schemas/src/**": {
          branches: 95,
          functions: 100,
          lines: 95,
          statements: 95,
        },
      },
    },
    projects: [
      nodeProject("test-harness", ".", [
        "tests/fixtures/**/*.test.mjs",
        "tests/registry/runner-policy.test.mjs",
        "tests/registry/test-policy.test.mjs",
      ]),
      nodeProject("shared-schemas", "packages/shared-schemas", [
        "test/**/*.test.ts",
      ]),
      nodeProject("api-client", "packages/api-client", ["test/**/*.test.ts"]),
      nodeProject("server-core", "packages/server-core", ["src/**/*.test.ts"]),
      nodeProject("prompt-library", "packages/prompt-library", [
        "src/**/*.test.ts",
      ]),
      nodeProject("server-adapters", "packages/server-adapters", [
        "src/**/*.test.ts",
      ]),
      nodeProject("api", "apps/api", ["src/**/*.test.ts"]),
      nodeProject("miniapp", "apps/miniapp", ["src/**/*.test.ts"]),
      nodeProject("worker", "apps/worker", ["src/**/*.test.ts"]),
      nodeProject("admin", "apps/admin", ["src/**/*.test.ts"]),
    ],
    retry: 0,
    sequence: {
      shuffle: false,
    },
  },
});
