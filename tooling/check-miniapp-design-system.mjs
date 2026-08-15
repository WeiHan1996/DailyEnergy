import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

import { runMiniappDesignSystemGate } from "./lib/miniapp-design-system-gate.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const miniappRoot = resolve(repositoryRoot, "apps/miniapp");
const componentLibrary = JSON.parse(
  await readFile(resolve(miniappRoot, "component-library.json"), "utf8"),
);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if ([".json", ".ts", ".wxml", ".wxss"].includes(extname(path))) {
      files.push({
        content: await readFile(path, "utf8"),
        path: relative(repositoryRoot, path).split("\\").join("/"),
      });
    }
  }
}

await walk(resolve(miniappRoot, "src"));
const diagnostics = runMiniappDesignSystemGate({ componentLibrary, files });
if (diagnostics.length > 0) {
  console.error(
    diagnostics
      .map(({ message, path, ruleId }) => `${ruleId}: ${path}: ${message}`)
      .join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Miniapp design-system Gate passed ${componentLibrary.components.length} component contracts and ${files.length} source assets.`,
  );
}
