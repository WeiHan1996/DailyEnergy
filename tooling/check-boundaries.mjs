import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { boundaryGates, runAllBoundaryGates } from "./lib/boundary-engine.mjs";
import { loadBoundaryProject } from "./load-boundary-project.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = await loadBoundaryProject(repositoryRoot);
const errors = runAllBoundaryGates(project);

if (errors.length > 0) {
  console.error(
    errors
      .map(
        ({ gate, message, path, ruleId }) =>
          `${ruleId} [${gate}] ${path}: ${message}`,
      )
      .join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Boundary Gate passed ${boundaryGates.size} gate classes for ${project.workspaces.length} workspaces and ${project.files.length} source files.`,
  );
}
