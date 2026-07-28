# ESLint Config

DailyEnergy 的 ESLint 10 flat config。

根 `eslint.config.mjs` 直接复用本包导出。配置覆盖 JavaScript、ESM、CommonJS
与 TypeScript 语法，禁止 inline disable 与 wildcard source export，并为 Node
tooling/server 文件提供显式 globals。

TypeScript 7 的类型正确性由 `@daily-energy/typescript-config` 和 `tsc` 负责。
当前 `typescript-eslint` 尚未声明 TypeScript 7 兼容，因此本包使用 Babel 8
parser 只解析 TypeScript 语法；lint 与 strict typecheck 必须一起通过。
