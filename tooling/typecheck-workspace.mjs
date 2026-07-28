import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const typeScriptCli = resolve(
  repositoryRoot,
  "node_modules/typescript/bin/tsc",
);
const tsconfigPath = process.argv[2] ?? "tsconfig.json";
const typecheck = spawnSync(
  process.execPath,
  [
    typeScriptCli,
    "-p",
    tsconfigPath,
    "--noEmit",
    "--incremental",
    "false",
    "--pretty",
    "false",
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
  },
);
const output = `${typecheck.stdout ?? ""}${typecheck.stderr ?? ""}`;

if (typecheck.status === 0) {
  process.stdout.write(output);
} else if (typecheck.status === 1 && /\berror TS18003:/u.test(output)) {
  const resolution = spawnSync(
    process.execPath,
    [typeScriptCli, "-p", tsconfigPath, "--showConfig"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  if (resolution.status !== 0) {
    process.stderr.write(
      `${resolution.stdout ?? ""}${resolution.stderr ?? ""}`,
    );
    process.exitCode = resolution.status ?? 1;
  } else {
    console.log(
      `Typecheck passed for ${tsconfigPath}: TypeScript resolved the project and found no source inputs yet.`,
    );
  }
} else {
  process.stderr.write(output);
  process.exitCode = typecheck.status ?? 1;
}
