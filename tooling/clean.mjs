import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectories = [
  ".turbo",
  "packages/shared-schemas/coverage",
  "packages/shared-schemas/dist",
];

await Promise.all(
  artifactDirectories.map((directory) =>
    rm(resolve(repositoryRoot, directory), { force: true, recursive: true }),
  ),
);

console.log(`Removed ${artifactDirectories.join(", ")}`);
