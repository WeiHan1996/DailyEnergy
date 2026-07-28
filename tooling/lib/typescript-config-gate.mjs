import { execFile } from "node:child_process";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

export const protectedCompilerOptions = [
  "strict",
  "exactOptionalPropertyTypes",
  "forceConsistentCasingInFileNames",
  "noFallthroughCasesInSwitch",
  "noImplicitOverride",
  "noUncheckedIndexedAccess",
  "noUncheckedSideEffectImports",
  "verbatimModuleSyntax",
];

export async function resolveTypeScriptConfig({
  cwd,
  tsconfigPath,
  typeScriptCli,
}) {
  const { stdout } = await executeFile(
    process.execPath,
    [typeScriptCli, "-p", tsconfigPath, "--showConfig"],
    {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout);
}

export function resolvedConfigDiagnostics(label, resolvedConfig) {
  const diagnostics = [];
  for (const option of protectedCompilerOptions) {
    if (resolvedConfig.compilerOptions?.[option] !== true) {
      diagnostics.push({
        message: `${label} resolved compilerOptions.${option} must be true`,
        ruleId: "CONFIG_RESOLVED_STRICT",
      });
    }
  }
  if (Object.hasOwn(resolvedConfig.compilerOptions ?? {}, "paths")) {
    diagnostics.push({
      message: `${label} resolved compilerOptions.paths is forbidden`,
      ruleId: "CONFIG_RESOLVED_PATH_ALIAS",
    });
  }
  return diagnostics;
}
