#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const requiredOutputs = [
  "packages/server-core/dist/modules/generation/public/index.d.ts",
  "packages/server-core/dist/modules/generation/spi/index.d.ts",
  "packages/server-core/dist/modules/product-time/public/index.d.ts",
  "packages/server-core/dist/modules/product-time/spi/index.d.ts",
  "packages/server-adapters/dist/api/index.d.ts",
  "packages/server-adapters/dist/testing/index.d.ts",
  "packages/server-adapters/dist/worker-background/index.d.ts",
  "packages/server-adapters/dist/worker-interactive/index.d.ts",
  "packages/server-adapters/dist/worker-restricted/index.d.ts",
];

try {
  await Promise.all(
    requiredOutputs.map((file) => access(path.join(repositoryRoot, file))),
  );
} catch {
  for (const packageName of [
    "@daily-energy/server-core",
    "@daily-energy/server-adapters",
  ]) {
    const result = spawnSync("pnpm", ["--filter", packageName, "build"], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error("SERVER_ADAPTERS_BUILD_FAILED");
    }
  }
}
