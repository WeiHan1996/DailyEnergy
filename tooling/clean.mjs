import { readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectories = [".turbo"];
for (const area of ["apps", "packages"]) {
  for (const entry of await readdir(resolve(repositoryRoot, area), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }
    for (const artifact of [".turbo", "coverage", "dist"]) {
      artifactDirectories.push(`${area}/${entry.name}/${artifact}`);
    }
  }
}

await Promise.all(
  artifactDirectories.map((directory) =>
    rm(resolve(repositoryRoot, directory), { force: true, recursive: true }),
  ),
);

console.log(`Removed ${artifactDirectories.join(", ")}`);
