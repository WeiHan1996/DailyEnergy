import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { scanAdminBrowserBundle } from "./lib/admin-bundle-check.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const browserOutputRoot = resolve(repositoryRoot, "apps/admin/.next/static");
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!/\.(?:css|js|json|map)$/u.test(entry.name)) {
      continue;
    }
    files.push({
      content: await readFile(path, "utf8"),
      path: relative(repositoryRoot, path).split(sep).join("/"),
    });
  }
}

try {
  await walk(browserOutputRoot);
} catch (error) {
  if (error?.code === "ENOENT") {
    console.error(
      "ADMIN_BUNDLE_OUTPUT_MISSING: apps/admin/.next/static does not exist",
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
}

if (process.exitCode !== 1) {
  const secretValues = Object.entries(process.env)
    .filter(([name, value]) => {
      return (
        /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL|REDIS_URL)/u.test(
          name,
        ) && (value?.length ?? 0) >= 12
      );
    })
    .map(([, value]) => value);
  const diagnostics = scanAdminBrowserBundle({
    files,
    secretValues,
  });

  if (diagnostics.length > 0) {
    console.error(
      diagnostics
        .map(({ message, path, ruleId }) => `${ruleId}: ${path}: ${message}`)
        .join("\n"),
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Admin browser bundle Gate passed ${files.length} static files with server-only, secret, restricted-field, and user-body scans.`,
    );
  }
}
