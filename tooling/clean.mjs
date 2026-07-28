import { readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPaths = [".turbo"];
for (const area of ["apps", "packages"]) {
  for (const entry of await readdir(resolve(repositoryRoot, area), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }
    for (const artifact of [".turbo", "coverage", "dist"]) {
      artifactPaths.push(`${area}/${entry.name}/${artifact}`);
    }
    artifactPaths.push(`${area}/${entry.name}/tsconfig.tsbuildinfo`);
  }
}

await Promise.all(
  artifactPaths.map((path) =>
    rm(resolve(repositoryRoot, path), { force: true, recursive: true }),
  ),
);

console.log(`Removed ${artifactPaths.join(", ")}`);
