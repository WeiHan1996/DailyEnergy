import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
import globals from "globals";

const sourceFiles = ["**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}"];
const nodeFiles = [
  "apps/api/**/*.{js,mjs,cjs,ts,mts,cts}",
  "apps/worker/**/*.{js,mjs,cjs,ts,mts,cts}",
  "packages/server-*/**/*.{js,mjs,cjs,ts,mts,cts}",
  "packages/prompt-library/**/*.{js,mjs,cjs,ts,mts,cts}",
  "tooling/**/*.{js,mjs,cjs,ts,mts,cts}",
  "tests/**/*.{js,mjs,cjs,ts,mts,cts}",
  "*.config.{js,mjs,cjs,ts,mts,cts}",
  ".dependency-cruiser.cjs",
  "eslint.config.mjs",
  "prettier.config.mjs",
];

export default [
  {
    name: "daily-energy/ignores",
    ignores: [
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/dist/**",
      "**/dist-fixtures/**",
      "**/node_modules/**",
      "packages/server-adapters/src/db/generated/prisma/**",
      "prototype/**",
      "tests/artifacts/output/**",
    ],
  },
  {
    ...js.configs.recommended,
    name: "daily-energy/javascript-recommended",
    files: sourceFiles,
  },
  {
    name: "daily-energy/base",
    files: sourceFiles,
    languageOptions: {
      ecmaVersion: 2024,
      parser: babelParser,
      parserOptions: {
        babelOptions: {
          babelrc: false,
          configFile: false,
          parserOpts: {
            plugins: ["decorators-legacy", "typescript", "jsx"],
          },
        },
        requireConfigFile: false,
      },
      sourceType: "module",
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
    rules: {
      "array-callback-return": "error",
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-control-regex": "off",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message:
            "Wildcard exports are forbidden; list the reviewed public surface explicitly.",
        },
      ],
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-const": "error",
      "prefer-template": "error",
    },
  },
  {
    name: "daily-energy/node",
    files: nodeFiles,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    name: "daily-energy/typescript-estree-compatibility",
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];
