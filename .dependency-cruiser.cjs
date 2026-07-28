"use strict";

module.exports = {
  forbidden: [
    {
      name: "S30-REPO-013:no-circular",
      comment: "Workspace source graphs must remain acyclic.",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "S31-TEST-007:no-production-to-tests",
      comment: "Production source cannot import tests or testing fixtures.",
      severity: "error",
      from: {
        path: "^(apps|packages)/",
        pathNot: "(^|/)(test|tests|__tests__|testing)(/|$)",
      },
      to: {
        path: "(^|/)(test|tests|__tests__)(/|$)",
      },
    },
    {
      name: "S30-REPO-012:no-undeclared-dependencies",
      comment: "Hoisting must not hide undeclared npm dependencies.",
      severity: "error",
      from: {
        path: "^(apps|packages)/",
      },
      to: {
        dependencyTypes: ["npm-no-pkg", "npm-unknown"],
      },
    },
    {
      name: "S30-REPO-012:no-production-to-dev-dependencies",
      comment: "Production source cannot rely on dev-only packages.",
      severity: "error",
      from: {
        path: "^(apps|packages)/[^/]+/src/",
      },
      to: {
        dependencyTypes: ["npm-dev"],
      },
    },
    {
      name: "S30-REPO-011:no-tsconfig-path-bypass",
      comment: "Cross-workspace TypeScript aliases are forbidden.",
      severity: "error",
      from: {
        path: "^(apps|packages)/",
      },
      to: {
        dependencyTypes: ["aliased"],
      },
    },
    {
      name: "S30-REPO-048:no-unresolvable-imports",
      comment: "All source imports must resolve in a clean checkout.",
      severity: "error",
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^|/)(dist|coverage|node_modules|\\.next|\\.turbo|prototype)(/|$)",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      extensions: [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".tsx"],
      mainFields: ["exports", "module", "main", "types"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
    tsPreCompilationDeps: true,
  },
};
