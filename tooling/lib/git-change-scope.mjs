import { spawnSync } from "node:child_process";

function defaultRunGit(cwd, arguments_) {
  const execution = spawnSync("git", arguments_, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: undefined,
      NO_COLOR: "1",
    },
  });

  return {
    ok: execution.status === 0,
    status: execution.status,
    stderr: (execution.stderr ?? "").trim(),
    stdout: execution.stdout ?? "",
  };
}

function diagnostic(ruleId, detail) {
  return { detail, ruleId };
}

function addPaths(paths, output) {
  const delimiter = output.includes("\0") ? "\0" : "\n";
  for (const path of output.split(delimiter).filter(Boolean)) {
    paths.add(path);
  }
}

export function discoverGitChangeScope({
  cwd,
  runGit = (arguments_) => defaultRunGit(cwd, arguments_),
}) {
  const repository = runGit(["rev-parse", "--show-toplevel"]);
  if (!repository.ok) {
    return {
      baseline: undefined,
      diagnostics: [
        diagnostic(
          "GIT_REPOSITORY_UNAVAILABLE",
          "unable to establish a Git repository root",
        ),
      ],
      isDetached: undefined,
      paths: [],
    };
  }

  const head = runGit(["rev-parse", "--verify", "HEAD"]);
  if (!head.ok) {
    return {
      baseline: undefined,
      diagnostics: [
        diagnostic("GIT_HEAD_UNAVAILABLE", "unable to resolve HEAD"),
      ],
      isDetached: undefined,
      paths: [],
    };
  }

  const branch = runGit(["symbolic-ref", "--quiet", "--short", "HEAD"]);
  let baseline;
  for (const reference of ["origin/main", "main"]) {
    const mergeBase = runGit(["merge-base", reference, "HEAD"]);
    const mergeBaseSha = mergeBase.stdout.trim();
    if (mergeBase.ok && mergeBaseSha) {
      baseline = { reference, sha: mergeBaseSha };
      break;
    }
  }

  if (!baseline) {
    return {
      baseline: undefined,
      diagnostics: [
        diagnostic(
          "GIT_BASE_UNAVAILABLE",
          "unable to establish a trusted merge base from origin/main or main",
        ),
      ],
      isDetached: !branch.ok,
      paths: [],
    };
  }

  const diagnostics = [];
  const paths = new Set();
  const scans = [
    {
      arguments: [
        "diff",
        "--name-only",
        "-z",
        "--no-renames",
        baseline.sha,
        "HEAD",
      ],
      detail: `unable to compare ${baseline.reference} merge base with HEAD`,
      ruleId: "GIT_BASE_DIFF_FAILED",
    },
    {
      arguments: ["diff", "--name-only", "-z", "--no-renames"],
      detail: "unable to inspect unstaged changes",
      ruleId: "GIT_WORKTREE_SCAN_FAILED",
    },
    {
      arguments: ["diff", "--cached", "--name-only", "-z", "--no-renames"],
      detail: "unable to inspect staged changes",
      ruleId: "GIT_STAGED_SCAN_FAILED",
    },
    {
      arguments: ["ls-files", "-z", "--others", "--exclude-standard"],
      detail: "unable to inspect untracked files",
      ruleId: "GIT_UNTRACKED_SCAN_FAILED",
    },
  ];

  for (const scan of scans) {
    const result = runGit(scan.arguments);
    if (!result.ok) {
      diagnostics.push(diagnostic(scan.ruleId, scan.detail));
      continue;
    }
    addPaths(paths, result.stdout);
  }

  return {
    baseline,
    branch: branch.ok ? branch.stdout.trim() : undefined,
    diagnostics,
    headSha: head.stdout.trim(),
    isDetached: !branch.ok,
    paths: [...paths].sort(),
  };
}
